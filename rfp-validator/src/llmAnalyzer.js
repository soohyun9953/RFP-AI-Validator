export async function analyzeDocumentsWithLLM(guidelineText, artifactText, inspectionScope, apiKey) {
    if (!apiKey) {
        throw new Error("API 키가 제공되지 않았습니다.");
    }

    const systemPrompt = `당신은 대한민국 최고 수준의 IT 감리 전문가이자 RFP(제안요청서)/ISMP 검증 AI입니다.
본 분석의 목적은 입력된 **모든 점검 문장 목록(JSON 배열 형태)** 전체에 대하여, 각각의 문장이 ISMP 산출물에 구체적으로 반영되었는지 논리적으로 검증하는 것입니다. 제공된 점검 항목을 절대 요약하거나 누락하지 마세요.

[단계별 분석 지시]
Step 1 (엄격한 항목 1:1 대응 - 가장 중요): 제가 제공한 '기준 문서 문장 목록' 배열에 있는 **모든 객체(id, content)**를 단 하나도 빠짐없이 순회하며, 산출물 측에 해당 내용(content)이 구체적으로 설계/분석되었는지 정확한 위치와 핵심 구절을 찾아 1:1로 매핑하세요. 제공된 문장 수와 결과 배열의 크기가 완벽히 일치해야 합니다. (절대로 요약이나 스킵하지 마세요)
Step 2 (구체성 검증 및 이행 판정): 각 문장별로 '충족', '부분충족', '미충족' 중 하나로 명확히 판정하세요. 
- 단어만 유사하게 등장했다고 이행 처리하지 말고, "구체적 실행 방안 또는 설계"가 명기되어 있어야만 이행으로 인정합니다.
- 점검 범위(Inspection Scope)가 주어지면, 해당 점검 범위와 관련된 항목에 대해서는 더욱 엄격하고 깐깐하게 평가하고 gap(차이점)을 상세하게 기술하세요.

[출력 형식 제한]
반드시 아래 JSON 형식으로만 출력해야 합니다.
{
  "score": <총점(0~100 정수, 전체 이행 비율)>,
  "inspectionScope": "<점검범위 텍스트 또는 null>",
  "summary": "<전체적인 분석에 대한 2~3문장 요약 (의미론적 분석임을 강조하세요)>",
  "rtm": [
    {
      "type": "<'필수' 또는 '선택'>",
      "requirement": "<추출된 개별 실행 문장 요약 (최대 50자)>",
      "status": "<'Pass', 'Partial', 'Fail' 의 문자열만 가능 (각각 이행, 부분이행, 미이행에 해당하는 영문 코드값)>",
      "location": "<산출물 내 발견 페이지 및 위치 요약>",
      "category": "<요구사항 카테고리 (예: 기능, 비기능, 보안)>",
      "levelLabel": "<'대분류', '중분류', '항목' 중 택 1>",
      "coverageRate": <충족률(0~100 정수)>
    }
  ],
  "requirementMapping": [
    {
      "id": "<입력된 문장 객체의 id를 그대로 사용>",
      "category": "<요구사항 카테고리 추론>",
      "type": "<입력된 문장 객체의 type을 그대로 사용>",
      "levelLabel": "<'개별문장'>",
      "path": "<'본문'>",
      "requirement": "<입력된 문장 객체의 content를 원문 그대로 사용>",
      "artifactSection": "<Step 1에서 매핑된 산출물 측의 명확한 페이지 번호와 위치 (미충족 시 '해당 없음')>",
      "artifactContent": "<산출물에서 발견된 구체적 실행 방안 또는 내용 요약 (최대 200자, 미충족 시 '산출물 내 관련 내용 없음')>",
      "coverageRate": <충족률(0~100 정수)>,
      "status": "<'충족', '부분충족', '미충족' 의 문자열만 가능>",
      "gap": "<왜 부분 충족, 혹은 미충족인지 명확한 사유 작성 (충족 시 null)>"
    }
  ],
  "omissions": [
    {
      "title": "<누락/미흡 항목 제목>",
      "evidence": "<기준 문서에 있는 개별 실행 문장 본문>",
      "reason": "<기술적 난이도를 고려했을 때 왜 미이행/부분이행인지 구체적인 사유 기입>",
      "recommendation": "<이렇게 보완/설계되어야 한다는 날카로운 감리 전문가로서의 권고>"
    }
  ]
}`;

// 문장 단위로 쪼개기 위한 헬퍼 함수
function extractAllSentences(text) {
    if (!text || !text.trim()) return [];
    // 1. 줄바꿈 기호나 마침표(.), 물음표(?), 느낌표(!) 뒤의 공백을 기준으로 분할
    const rawSegments = text.split(/(?<=[.!?])\s+|\n/);
    const sentences = [];
    let currentId = 1;
    for (let seg of rawSegments) {
        // 불릿 기호 장식 문자 우선 제거
        let clean = seg.replace(/^[-·○●■□▪▸※•\d\.\(\)]+\s*/, '').trim();
        // 헤더 문자열 판별 (표 컬럼명 등)
        const isHeader = clean.replace(/\s/g, '').toUpperCase().includes('LV1|LV2') || clean.startsWith('LV1|');
        if (clean.length > 5 && !isHeader) {
            sentences.push({ id: `SENT-${String(currentId).padStart(4, '0')}`, type: '필수', content: clean });
            currentId++;
        }
    }
    return sentences;
}

    // JS 기반으로 문장 목록 사전 추출 (LLM이 문장을 요약/누락하는 것을 원천 차단)
    const sentencesToInspect = extractAllSentences(guidelineText || '').slice(0, 500); // 토큰 초과 대비 최대 500문장
    const sentencesJson = JSON.stringify(sentencesToInspect, null, 2);

    const userInput = `
[시스템 지시사항]
${systemPrompt}

[입력 데이터]
--- 기준 문서 문장 목록 (이 배열의 모든 id에 대해 requirementMapping 항목을 생성할 것!) ---
${sentencesJson}

--- 산출물 텍스트 원문 ---
${(artifactText || '').substring(0, 40000)}

--- 점검 범위 (선택) ---
${inspectionScope || '없음'}
`;

    try {
        // 1. API 키가 접근할 수 있는 사용 가능한 모델 목록(ListModels) 자동 탐색
        let targetModel = "models/gemini-3.0-flash"; // 최후의 보루 (사용자 요청 반영)
        try {
            const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            if (listRes.ok) {
                const listData = await listRes.json();
                if (listData && listData.models) {
                    const validModels = listData.models.filter(m => 
                        m.supportedGenerationMethods?.includes('generateContent') && 
                        m.name.includes('gemini')
                    );
                    
                    if (validModels.length > 0) {
                        // 사용자 요청(Gemini 3 Flash)을 반영하여 3.x Flash > 2.0 Flash > 1.5 Flash 순으로 최우선 탐색
                        const flash3x = validModels.find(m => m.name.includes('gemini-3') && m.name.includes('flash'));
                        const flash20 = validModels.find(m => m.name.includes('gemini-2.0-flash'));
                        const flash15 = validModels.find(m => m.name.includes('gemini-1.5-flash'));
                        const pro3x = validModels.find(m => m.name.includes('gemini-3') && m.name.includes('pro'));
                        const pro15 = validModels.find(m => m.name.includes('gemini-1.5-pro'));
                        
                        if (flash3x) targetModel = flash3x.name;
                        else if (flash20) targetModel = flash20.name;
                        else if (flash15) targetModel = flash15.name;
                        else if (pro3x) targetModel = pro3x.name;
                        else if (pro15) targetModel = pro15.name;
                        else targetModel = validModels[0].name;
                    }
                }
            }
        } catch(err) {
            console.warn("모델 탐색 실패 (Fallback 모델 사용):", err);
        }

        // 2. 동적으로 탐색된 모델명(예: "models/gemini-...")을 URL에 결합
        const fetchUrl = `https://generativelanguage.googleapis.com/v1beta/${targetModel.startsWith('models/') ? targetModel : `models/${targetModel}`}:generateContent?key=${apiKey}`;

        const fetchOptions = {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: userInput }]
                }],
                generationConfig: {
                    temperature: 0.1
                }
            })
        };

        const response = await fetch(fetchUrl, fetchOptions);

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || response.statusText);
        }

        const data = await response.json();
        let content = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

        // JSON 코드 블록 마크다운이 섞여있을 수 있으므로 제거
        if (content.includes("\`\`\`")) {
            const match = content.match(/\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/);
            if (match && match[1]) {
                content = match[1];
            }
        }

        return JSON.parse(content);
    } catch (e) {
        console.error("Gemini API Error:", e);
        throw new Error(`Gemini 검증 실패: ${e.message}`);
    }
}
