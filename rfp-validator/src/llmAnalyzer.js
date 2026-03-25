export async function analyzeDocumentsWithLLM(guidelineText, artifactText, inspectionScope, apiKey) {
    if (!apiKey) {
        throw new Error("API 키가 제공되지 않았습니다.");
    }

    const systemPrompt = `당신은 최고 수준의 IT 감리 전문가이자 RFP(제안요청서) 검증 AI입니다.
당신의 임무는 기준 문서에서 덩어리진 단위(문단, 카테고리)로 대충 평가하는 것이 아니라, 문서를 정밀 분석하여 **'실제 수행이나 준수를 요구하는 모든 개별 문장 단위(Atomic Sentence)'**로 요건을 철저히 분리하여 1:1 검증하는 것입니다.

[핵심 규칙 - 절대 준수]
1. 단순 제목(예: "제안요청서", "사업명:~"), 표의 헤더, 무의미한 인사말 등은 요구사항이 아니므로 추출 항목에서 완전히 제외하세요.
2. 실제 '구현, 설계, 준수'해야 할 내용이 담긴 모든 문장을 빠짐없이 추출하여 각각 개별 항목으로 만드세요. 여러 문장을 하나로 요약하거나 합치면(Merging) 절대 안 됩니다. 반드시 문장 단위로 분할하세요.
3. 충족률(%)을 계산하지 마세요. 추출된 각 문장별로 산출물을 분석하여 오직 **'이행(O)', '부분 이행(△)', '미이행(X)'** 중 하나로 판정하세요.
4. 산출물에서 내용이 **누락된 것은 반드시 '미이행(X)'**으로 판정하고 명시하세요. 구체적 실행 방안이나 명세가 없는 경우에도 '미이행(X)' 또는 '부분 이행(△)'으로 판정합니다.

[출력 형식 제한]
반드시 아래 JSON 형식으로만 출력하세요. (토큰 절약을 위해 rtm과 omissions 필드는 LLM 응답에서 생략합니다. requirementMapping에 집중하세요.)
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
  ]
}`;

    const userInput = `
[시스템 지시사항]
${systemPrompt}

[입력 데이터]
--- 기준 문서 ---
${(guidelineText || '').substring(0, 20000)}

--- 산출물 ---
${(artifactText || '').substring(0, 40000)}

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
        } else {
            parsed.requirementMapping = [];
            parsed.rtm = [];
            parsed.omissions = [];
        }

        return parsed;
    } catch (e) {
        console.error("Gemini API Error:", e);
        throw new Error(`Gemini 검증 실패: ${e.message}`);
    }
}
