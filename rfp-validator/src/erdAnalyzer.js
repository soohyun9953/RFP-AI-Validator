export async function analyzeERDWithLLM(documentText, apiKey, onProgress) {
    if (!apiKey) {
        throw new Error("API 키가 제공되지 않았습니다.");
    }

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

{
  "mermaidCode": "erDiagram\\n    USER ||--o{ ORDER : places\\n    ...",
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
      "from": "<엔티티A>",
      "to": "<엔티티B>",
      "type": "<1:1, 1:N, M:N>",
      "desc": "<관계 설명 및 제약 조건>"
    }
  ],
  "normalizationNotes": "<정규화 준수 여부 및 반정규화 논거에 대한 상세 설명>",
  "summary": "<전체 데이터 모델링 전략 및 설계 방향 요약>"
}

[주의사항]
- 결과는 반드시 유효한 JSON이어야 하며, mermaidCode 내의 줄바꿈은 \\n으로 처리하십시오.
- 마크다운 블록(\`\`\`json ...) 없이 순수 JSON 문자열만 출력하거나, 마크다운 블록이 포함된다면 반드시 파싱 가능한 형태여야 합니다.`;

    const userInput = `
[시스템 지시사항]
${systemPrompt}

[입력 데이터 - 분석 대상 문서]
${(documentText || '').substring(0, 1000000)}
`;

    if (onProgress) onProgress("데이터베이스 모델 분석 및 ERD 설계 중...");

    try {
        let targetModel = "models/gemini-2.0-flash";
        // 사용 가능한 모델 리스트 확인 (기존 lmmAnalyzer와 동일 로직)
        try {
            const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            if (listRes.ok) {
                const listData = await listRes.json();
                if (listData && listData.models) {
                    const validModels = listData.models.filter(m => 
                        m.supportedGenerationMethods?.includes('generateContent') && 
                        m.name.includes('gemini')
                    );
                    const flash3x = validModels.find(m => m.name.includes('gemini-3') && m.name.includes('flash'));
                    if (flash3x) targetModel = flash3x.name;
                    else {
                        const flash20 = validModels.find(m => m.name.includes('gemini-2.0-flash'));
                        if (flash20) targetModel = flash20.name;
                    }
                }
            }
        } catch(err) { console.warn("모델 탐색 실패:", err); }

        const fetchUrl = `https://generativelanguage.googleapis.com/v1beta/${targetModel.startsWith('models/') ? targetModel : `models/${targetModel}`}:generateContent?key=${apiKey}`;

        const fetchOptions = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: userInput }] }],
                generationConfig: { temperature: 0.1 }
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
            if (match && match[1]) content = match[1];
        }

        return JSON.parse(content);
    } catch (e) {
        console.error("ERD Analysis Error:", e);
        throw new Error(`ERD 설계 실패: ${e.message}`);
    }
}
