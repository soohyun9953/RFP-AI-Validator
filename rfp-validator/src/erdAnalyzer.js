export async function analyzeERDWithLLM(documentText, apiKey, onProgress, selectedModel = 'auto') {
    const keys = String(apiKey).split(',').map(k => k.trim()).filter(k => k.startsWith('AIza'));
    if (keys.length === 0) {
        throw new Error("유효한 API 키가 제공되지 않았습니다.");
    }

    let currentKeyIndex = 0;

    // 사용량 기록 유틸리티
    const recordUsage = (modelName) => {
        try {
            const usage = JSON.parse(localStorage.getItem('gemini_model_usage') || '{}');
            usage[modelName] = (usage[modelName] || 0) + 1;
            localStorage.setItem('gemini_model_usage', JSON.stringify(usage));
            window.dispatchEvent(new CustomEvent('gemini_usage_updated'));
        } catch (e) {
            console.error("Usage recording failed:", e);
        }
    };

    const systemPrompt = `당신은 최고 수준의 데이터베이스 설계 전문가이자 데이터 아키텍트입니다.
입력된 비즈니스 요구사항 또는 프로젝트 문서를 분석하여 최적화된 논리적 데이터 모델을 도출하고 Mermaid.js erDiagram 형식으로 시각화 코드를 생성하는 것이 당신의 사명입니다.

[설계 원칙]
1. **정규화 준수**: 기본적으로 제3정규형(3NF)을 목표로 설계하십시오.
2. **엔티티 명명**: 비즈니스 맥락을 명확히 반영하는 영문 엔티티명과 한글 설명을 병기하십시오.
3. **속성 정의**: 모든 엔티티에 적절한 속성(Attribute)을 나열하고 PK(Primary Key)와 FK(Foreign Key)를 명확히 구분하십시오.
4. **관계 정의**: 엔티티 간의 관계 차수(1:1, 1:N, M:N)와 참여 제약 조건(Mandatory/Optional)을 논리적으로 설정하십시오.
5. **반정규화**: 성능상 반드시 필요한 경우에만 제한적으로 적용하고 그 근거를 제시하십시오.

[출력 형식]
반드시 프론트엔드 렌더링을 위해 아래 JSON 구조로만 응답하십시오.
(주의: **프로젝트의 모든 엔티티는 "entities" 배열에 단 하나도 빠짐없이 100% 기재되어야 합니다. 내용이 길어지더라도 절대 중간에 생략하거나 축약하지 마십시오.**)

{
  "entities": [
    {
      "name": "<엔티티 영문명>",
      "description": "<엔티티 한글 설명>",
      "reason": "<해당 엔티티 선정 사유>",
      "attributes": [
        { "name": "<속성명>", "type": "<데이터타입>", "key": "<PK/FK/null>", "desc": "<속성 설명>" }
      ]
    }
  ],
  "relationships": [
    {
      "from": "<엔티티A_영문명>",
      "to": "<엔티티B_영문명>",
      "type": "<1:1, 1:N, M:N>",
      "desc": "<관계 설명 및 제약 조건>"
    }
  ],
  "normalizationNotes": "<정규화 준수 여부 및 반정규화 논거에 대한 상세 설명>",
  "summary": "<전체 데이터 모델링 전략 및 설계 방향 요약>",
  "mermaidCode": "<erDiagram으로 시작하는 Mermaid.js 시각화 코드>"
}

[Mermaid 작성 가이드]
- **erDiagram**으로 시작하십시오. (**절대로 Table { ... } 같은 DBML 형식을 섞지 마십시오.**)
- 엔티티 간의 관계는 `EntityA ||--o{ EntityB : "관련성"` 형식을 사용하십시오.
- 엔티티명이나 관계 설명에 공백이 있다면 반드시 `" "` (큰따옴표)로 감싸십시오.
- 속성이 있는 경우 아래 형식을 따르십시오:
  ```
  EntityName {
    type name PK "설명"
  }
  ```
- **코드 내에 어떤 경우에도 역슬래시(\\) 문자를 포함하지 마십시오.**
- 관계 차수 기호(|o, o|, ||, }o, o{ 등)를 정확히 사용하십시오.

[데이터 안정성 가이드]
- **절대 주의**: JSON 내부의 모든 문자열값에서 실제 줄바꿈(raw newline)을 사용하지 마십시오. 줄바꿈이 필요한 경우 반드시 \\n 이스케이프 문자를 사용하십시오.
- 모든 필드(특히 reason, normalizationNotes, summary)는 핵심 위주로 명확하고 간결하게 작성하여 전체 응답 길이를 최적화하십시오.
- 응답이 잘리지 않도록 최대 길이에 도달하기 전에 논리적으로 JSON을 마감하십시오.

[주의사항]
- 결과는 반드시 순수 JSON 형태여야 합니다.
- **다시 한 번 강력하게 지시합니다. JSON 구조의 entities 배열에 기입된 항목들은 생략되거나 축약되어서는 안 됩니다.**`;

    const userInput = `
[시스템 지시사항]
${systemPrompt}

[입력 데이터 - 분석 대상 문서]
${(documentText || '').substring(0, 20000)}
`;

    if (onProgress) onProgress("데이터베이스 모델 분석 및 ERD 설계 중...");

    try {
        const FALLBACK_MODELS = [
            "models/gemini-2.0-flash",
            "models/gemini-3-flash-preview",
            "models/gemini-1.5-flash-latest",
            "models/gemini-1.5-pro-latest"
        ];
        
        let initialModel = selectedModel && selectedModel !== 'auto' ? selectedModel : FALLBACK_MODELS[0];
        if (!initialModel.startsWith('models/')) initialModel = `models/${initialModel}`;
        
        let currentModelIndex = FALLBACK_MODELS.indexOf(initialModel);
        if (currentModelIndex === -1) currentModelIndex = 0;

        const fetchWithRetry = async (maxModelRetries = 3) => {
            let modelRetries = 0;
            while (modelRetries < maxModelRetries) {
                const activeKey = keys[currentKeyIndex];
                const modelId = FALLBACK_MODELS[currentModelIndex];
                const fetchUrl = `https://generativelanguage.googleapis.com/v1beta/${modelId}:generateContent?key=${activeKey}`;
                
                const fetchOptions = {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ role: "user", parts: [{ text: userInput }] }],
                        generationConfig: { 
                            temperature: 0.1, 
                            maxOutputTokens: 16384,
                            responseMimeType: "application/json"
                        }
                    })
                };

                const response = await fetch(fetchUrl, fetchOptions);
                
                if (response.ok) {
                    recordUsage(modelId); // 사용량 기록
                    return response;
                }

                if (response.status === 429) {
                    // 1. 다음 API 키로 즉시 시도
                    if (keys.length > 1 && (currentKeyIndex + 1) < keys.length) {
                        currentKeyIndex++;
                        if (onProgress) onProgress(`현재 키 할당량 초과... 다음 키로 교체 시도 중 (${currentKeyIndex + 1}/${keys.length})`);
                        continue;
                    }

                    // 2. 모든 키가 소진된 경우 -> 5초 대기 후 모델 변경
                    modelRetries++;
                    if (modelRetries < maxModelRetries) {
                        currentKeyIndex = 0; // 새 모델은 첫 번째 키부터 다시
                        const nextModelIndex = (currentModelIndex + 1) % FALLBACK_MODELS.length;
                        const nextModelName = FALLBACK_MODELS[nextModelIndex].split('/').pop();
                        
                        if (onProgress) onProgress(`모든 API 할당량 초과... 5초 후 모델을 [${nextModelName}]으로 변경하여 재시도합니다.`);
                        
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        currentModelIndex = nextModelIndex;
                        continue;
                    }
                    
                    throw new Error("모든 API 키와 모델의 사용 한도가 소진되었습니다.");
                }

                const errData = await response.json();
                throw new Error(errData.error?.message || response.statusText);
            }
            throw new Error("모든 API 키의 사용 한도가 초과되었습니다.");
        };

        const response = await fetchWithRetry();
        const data = await response.json();
        let content = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

        let jsonStr = content.trim();
        if (jsonStr.includes("```")) {
            jsonStr = jsonStr.replace(/^[\s\S]*?```(?:json|JSON)?\s*/, '');
            jsonStr = jsonStr.replace(/\s*```[\s\S]*$/, '');
        }

        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("ERD Analysis Error:", e);
        throw new Error(`ERD 설계 실패: ${e.message}`);
    }
}
