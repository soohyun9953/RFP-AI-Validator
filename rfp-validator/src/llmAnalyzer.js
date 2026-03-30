export async function analyzeDocumentsWithLLM(guidelineText, artifactText, inspectionScope, apiKey, glossaryText) {
    if (!apiKey) {
        throw new Error("API 키가 제공되지 않았습니다.");
    }

    const isOnlyTypoCheck = !guidelineText || guidelineText.trim() === '';
    
    let systemPrompt = '';
    if (isOnlyTypoCheck) {
        systemPrompt = `[시스템 역할]
너는 철저한 교정 교열 전문가다. 입력된 문서의 전체 목차와 섹션을 먼저 리스트업한 뒤, 한 섹션이라도 건너뛰지 않고 모든 문장을 하나하나 검토하여 오탈자, 띄어쓰기, 비문, 도메인 용어 오류를 찾아내라.

[검토 기준 및 규칙]
1. '대표적인 예시'만 들지 말고, 발견된 모든 오류를 하나도 빠짐없이 나열하라.
2. '용어 사전'이 제공된 경우, 산출물의 단어가 사전에 정의된 표준 용어 및 표기법과 일치하는지 최우선으로 검증하라. 어긋날 경우 무조건 오류로 판정하고 사전 기준으로 교정하라.
3. [필수 파악] 단순 오탈자만 찾는 것은 절반의 실패입니다. 반드시 전체 문서 맥락을 분석하여 **논리적/구조적 결함과 문체 완성도 중심**으로 과감하게 수색하십시오:
   - 목차-본문 불일치 (목차 제목과 실제 본문 헤드라인 불일치)
   - 수치 정합성 위배 (앞단락 수치와 뒷단락 요약 수치 충돌 등)
   - 허위 참조 오류 ('그림 X', '표 Y' 등 존재하지 않는 개체 참조)
   - 가독성 및 문체 교정: 주어-술어 호응 어색, 모호한 추상적 표현(구체적 기술 용어로 교정 제안), 문장 끝맺음 '~함', '~임' 불일치 (모두 단문 개조식 어조에 맞게 검수)
   이러한 결함을 발견하면 errorType을 '[구조/논리 결함]' 또는 '[문체/가독성 결함]'으로 명시하고 구체적인 교정안을 도출하세요.
   **[중요 예외 규칙: 숫자+단위 붙여쓰기 절대 허용]** '6가지', '3개', '10명' 등 아라비아 숫자 바로 뒤에 단위나 의존 명사가 붙어 쓰인 경우(예: 6가지)는 실무 허용 표기법이므로 절대로 띄어쓰기 오류로 지적하지 마십시오.
4. 오류가 없는 페이지(또는 섹션)가 있다면 반드시 '해당 페이지 이상 없음'이라고 명시하라.
5. 찾아낸 모든 맞춤법 오류 및 논리적 결함들을 아래 데이터 형식으로 합쳐서 출력하라.

[출력 형식]
반드시 프론트엔드 표 렌더링을 위해 아래 JSON 데이터 배열로만 출력하라. (아래 필드명을 엄격히 유지할 것)
{
  "score": 100,
  "inspectionScope": "<점검범위 텍스트 또는 null>",
  "summary": "<전체 문서의 목차/섹션 리스트업 및 교정/교열 결과에 대한 종합 요약 (상세하게)>",
  "requirementMapping": [],
  "typos": [
    {
      "page": "<페이지 번호 또는 섹션/목차명>",
      "originalText": "<원문 문장 전체가 있을경우, 아니면 '해당 페이지 이상 없음'>",
      "correction": "<수정 제안 문장>",
      "errorType": "<오류 유형 (오탈자/띄어쓰기/비문/도메인 용어/이상 없음 등)>"
    }
  ]
}`;
    } else {
        systemPrompt = `당신은 최고 수준의 IT 감리 전문가이자 다단계 산출물 기준문서 검증 AI입니다.
당신의 임무는 '기준 문서(Base Document)'의 전체 내용을 단 한 줄도 빠짐없이 정밀 분석하여, 모든 문장을 **'개별 문장 단위(Atomic Sentence)'**로 요건화한 후 검증 문서(산출물)와 1:1 검증하는 것입니다.

[핵심 규칙 - 절대 준수]
1. 기준 문서의 **한 줄, 한 줄 빠짐없이 모든 문장**을 추출하여 산출물에 반영되었는지, 누락된 것은 없는지 철저히 검증하세요. (단, 단순 제목, 표의 헤더, 무의미한 인사말 등은 요건이 아니므로 추출 항목에서 완전히 제외하세요.)
2. 실제 '구현, 설계, 준수'해야 할 내용이 담긴 모든 문장을 빠짐없이 추출하여 각각 개별 항목으로 만드세요. 여러 문장을 하나로 요약하거나 합치면(Merging) 절대 안 됩니다. 반드시 문장 단위로 분할하세요.
3. 충족률(%)을 계산하지 마세요. 추출된 각 문장별로 산출물을 분석하여 오직 **'이행(O)', '부분 이행(△)', '미이행(X)'** 중 하나로 판정하세요.
4. 산출물에서 내용이 **누락된 것은 반드시 '미이행(X)'**으로 판정하고 명시하세요. 구체적 실행 방안이나 명세가 없는 경우에도 '미이행(X)' 또는 '부분 이행(△)'으로 판정합니다.
5. [핵심 지시사항] 산출물 품질 점검 시, 오탈자나 띄어쓰기 확인에만 그치지 말고 **논리적 일관성 확보 및 공공기관용 보고서 문체 다듬기**를 최우선으로 수색하세요. 다음 결함을 'typos' 배열에 최우선적으로 포함해야 합니다:
   ① 목차와 본문 헤드라인 불일치
   ② 앞/뒤 통계 및 수치 불일치
   ③ 존재하지 않는 참조('그림 X', '표 Y')
   ④ 주술 호응 오류 및 모호한 추상적 표현 (상세 기술 용어로 교정 필수)
   ⑤ 끝맺음 어미 '~함', '~임' 등 개조식 문체 일관성 붕괴
   이런 구조적/문체적 오류를 발견하면 reason에 '[구조/논리 결함]' 또는 '[가독성 결함]'이라는 말머리를 달아 확실히 지적해 주세요. (맞춤법 및 용어 사전 위배 사항도 함께 포함하되, **'6가지', '3개'처럼 아라비아 숫자에 단위가 붙어 쓰인 경우는 실무 완벽 허용이므로 절대 띄어쓰기 오류로 잡지 마세요.**)

[출력 형식 제한]
반드시 아래 JSON 형식으로만 출력하세요. (토큰 절약을 위해 rtm과 omissions 필드는 LLM 응답에서 생략합니다. requirementMapping과 typos에 집중하세요.)
{
  "score": <총점(0~100 정수, 전체 이행 비율)>,
  "inspectionScope": "<점검범위 텍스트 또는 null>",
  "summary": "<분석에 대한 2~3문장 요약>",
  "requirementMapping": [
    {
      "id": "<REQ-001 부터 순차 부여>",
      "category": "<요구사항 카테고리 (기능, 보안, 인프라 등)>",
      "type": "<'필수' 또는 '선택'>",
      "levelLabel": "<'개별문장'>",
      "path": "<상위 목차/문단 컨텍스트 (예: 2.1 보안 요건)>",
      "requirement": "<추출된 개별 요구사항 문장 원문 그대로>",
      "artifactSection": "<대응되는 산출물 페이지/위치 (없으면 '해당 없음')>",
      "artifactContent": "<산출물에 작성된 설계/수행 내용 요약 (없으면 '관련 내용 없음')>",
      "status": "<'이행(O)', '부분 이행(△)', '미이행(X)' 중 택 1>",
      "gap": "<부분 이행/미이행 시 구체적 사유 및 부족한 점 (이행 시 null)>"
    }
  ],
  "typos": [
    {
      "location": "<위치(문단/문장)>",
      "originalText": "<기존 내용 (원문 그대로)>",
      "correction": "<교정 제안>",
      "reason": "<사유 (오류 유형 및 설명)>"
    }
  ]
} `;
    }


    const userInput = isOnlyTypoCheck ? `
[시스템 지시사항]
${systemPrompt}

[입력 데이터]${glossaryText ? `\n--- 용어 사전 ---\n${glossaryText.substring(0, 50000)}` : ''}

--- 산출물 ---
${(artifactText || '').substring(0, 2000000)}

--- 점검 범위 ---
${inspectionScope || '없음'}
` : `
[시스템 지시사항]
${systemPrompt}

[입력 데이터]${glossaryText ? `\n--- 용어 사전 ---\n${glossaryText.substring(0, 50000)}` : ''}

--- 기준 문서 ---
${(guidelineText || '').substring(0, 500000)}

--- 산출물 ---
${(artifactText || '').substring(0, 2000000)}

--- 점검 범위 (해당 내용이 있으면 위주로 더 엄격히 볼 것) ---
${inspectionScope || '없음'}
`;

    try {
        let targetModel = "models/gemini-3.0-flash";
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
                        const flash3x = validModels.find(m => m.name.includes('gemini-3') && m.name.includes('flash'));
                        const flash20 = validModels.find(m => m.name.includes('gemini-2.0-flash'));
                        const flash15 = validModels.find(m => m.name.includes('gemini-1.5-flash'));
                        if (flash3x) targetModel = flash3x.name;
                        else if (flash20) targetModel = flash20.name;
                        else if (flash15) targetModel = flash15.name;
                        else targetModel = validModels[0].name;
                    }
                }
            }
        } catch(err) {
            console.warn("모델 탐색 실패 (Fallback 모델 사용):", err);
        }

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

        if (content.includes("```")) {
            const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (match && match[1]) {
                content = match[1];
            }
        }

        const parsed = JSON.parse(content);

        // LLM 토큰 절약을 위해 생략한 rtm과 omissions 필드를 JS에서 동기화하여 자동 생성
        if (parsed.requirementMapping && Array.isArray(parsed.requirementMapping)) {
            if (!parsed.rtm) {
                parsed.rtm = parsed.requirementMapping.map(req => ({
                    type: req.type || '필수',
                    requirement: req.requirement || '-',
                    status: req.status || '미이행(X)',  // 이행(O), 부분 이행(△), 미이행(X)
                    location: req.artifactSection || '해당 없음',
                    category: req.category || '-',
                    levelLabel: req.levelLabel || '개별문장'
                }));
            }
            if (!parsed.omissions) {
                parsed.omissions = parsed.requirementMapping
                    .filter(req => req.status !== '이행(O)')
                    .map(req => ({
                        title: `[ID: ${req.id || 'N/A'}] ${(req.requirement || '').substring(0, 30)}...`,
                        evidence: req.requirement || '-',
                        reason: req.gap || '구체적인 수행/설계 방안이 누락되었습니다.',
                        recommendation: '해당 요건을 만족하기 위한 구체적인 명세와 실행계획을 산출물에 추가해야 합니다.'
                    }));
            }
            if (!parsed.typos) parsed.typos = [];
        } else {
            parsed.requirementMapping = [];
            parsed.rtm = [];
            parsed.omissions = [];
            parsed.typos = [];
        }

        return parsed;
    } catch (e) {
        console.error("Gemini API Error:", e);
        throw new Error(`Gemini 검증 실패: ${e.message}`);
    }
}
