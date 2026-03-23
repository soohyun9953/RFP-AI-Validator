export async function analyzeDocumentsWithLLM(guidelineText, artifactText, inspectionScope, apiKey) {
    if (!apiKey) {
        throw new Error("API 키가 제공되지 않았습니다.");
    }

    const systemPrompt = `당신은 대한민국 최고 수준의 IT 감리 전문가이자 RFP(제안요청서)/ISMP 검증 AI입니다.
본 분석의 목적은 기준문서 상위 제목이나 문단을 뭉뚱그려 검토하는 것이 아니라, 마침표나 불렛 포인트로 나뉘는 **'모든 상세 실행 문장 단위'**로 쪼개어 각각이 ISMP 산출물에 구체적으로 반영되었는지 논리적으로 검증하는 것입니다. 절대 여러 문장을 하나로 요약하거나 묶지 마세요.

[단계별 분석 지시]
Step 1 (요구사항 원자화 - 가장 중요): 기준 문서의 '상세 설명' 또는 '요구사항 본문'을 철저하게 '마침표(.)' 또는 불렛 포인트(○, -, •) 기준으로 분할하여, 의미 있는 "완전한 문장 단위(Atomic Sentence)"로 단 하나도 누락 없이 추출하세요. 즉 한 단락에 문장이 5개라면 반드시 5개의 독립된 JSON 항목(Row)으로 도출해야 합니다.
Step 2 (산출물 정밀 매핑): 앞서 쪼개진 추출 문장 각각에 대해, ISMP 산출물 텍스트를 파헤쳐 해당 개별 요건(문장)이 구체적으로 분석/설계된 '정확한 위치(페이지 등)'와 '핵심 구절'을 찾아 1:1로 매핑하세요.
Step 3 (엄격한 이행 등급 판정): 문장별로 '이행(O)', '부분 이행(△)', '미이행(X)' 중 하나로 명확히 판정하세요. 
- 특히 기술적 사양이나 난이도가 높은 요건(예: 생성형 AI, 보안 통신 등)은 단어만 유사하게 등장했다고 이행 처리하지 말고, "구체적 실행 방안 또는 설계"가 명기되어 있어야만 이행으로 인정합니다.

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
      "id": "<REQ-001 등 고유 ID 부여>",
      "category": "<요구사항 카테고리>",
      "type": "<'필수' 또는 '선택'>",
      "levelLabel": "<'개별실행항목'>",
      "path": "<상위 제목 구조 반영>",
      "requirement": "<Step 1에서 추출한 개별 실행 문장 원문 전체>",
      "artifactSection": "<Step 2에서 매핑된 산출물 측의 명확한 페이지 번호와 위치>",
      "artifactContent": "<산출물에서 발견된 구체적 실행 방안 또는 내용 요약 (최대 200자)>",
      "coverageRate": <충족률(0~100 정수)>,
      "status": "<'이행(O)', '부분 이행(△)', '미이행(X)' 의 문자열만 가능>",
      "gap": "<왜 부분 이행, 혹은 미이행인지 명확한 사유 작성 (이행 시 null)>"
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

    const userInput = `
[시스템 지시사항]
${systemPrompt}

[입력 데이터]
--- 기준 문서 ---
${(guidelineText || '').substring(0, 15000)}

--- 산출물 ---
${(artifactText || '').substring(0, 30000)}

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
