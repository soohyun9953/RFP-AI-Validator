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
6. **★ Mermaid 작성 규칙 (에러 방지 필수) ★**:
   - **관계 정의 시**: \`||--o{\` 등으로 관계를 연결할 때는 **반드시 순수 '영문 ID'만** 사용하십시오. 절대 대괄호나 한글 별칭을 섞으면 안 됩니다. (정상 예: \`USER ||--o{ ORDER : "주문"\` / 오류 예: \`USER["사용자"] ||--o{\`)
   - **엔티티 블록 정의 시**: 영문 ID 바로 뒤에 띄어쓰기 없이 대괄호와 쌍따옴표를 사용해 한글 설명을 붙이십시오. (예: \`USER["사용자 정보"] { varchar 회원아이디 PK }\`)
   - **속성명**: 영문이 아닌 한글 설명(띄어쓰기는 붙여쓰거나 언더바(_) 사용)을 기입하십시오.

[출력 형식]
반드시 프론트엔드 렌더링을 위해 아래 JSON 구조로만 응답하십시오.
(주의: **mermaidCode에 그려진 모든 엔티티는 "entities" 배열에 단 하나도 빠짐없이 100% 기재되어야 합니다. 내용이 길어지더라도 절대 중간에 생략하거나 축약하지 마십시오.**)

{
  "mermaidCode": "erDiagram\\n    USER ||--o{ ORDER : \\"생성\\"\\n    USER[\\"사용자 정보\\"] {\\n        varchar 회원_아이디 PK\\n        varchar 비밀번호\\n    }\\n    ORDER[\\"주문 내역\\"] {\\n        int 주문번호 PK\\n    }\\n ...",
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
- 마크다운 블록(\`\`\`json ...) 없이 순수 JSON 문자열만 출력하거나, 마크다운 블록이 포함된다면 반드시 파싱 가능한 형태여야 합니다.
- **다시 한 번 강력하게 지시합니다. 다이어그램(mermaidCode) 상에 연결된 모든 엔티티의 개수와 JSON 구조의 entities 배열에 기입된 항목 개수는 반드시 일치해야 합니다. 절대로 일부 항목을 생략하거나 축약하지 마십시오.**`;

    const userInput = `
[시스템 지시사항]
${systemPrompt}

[입력 데이터 - 분석 대상 문서]
${(documentText || '').substring(0, 1000000)}
`;

    if (onProgress) onProgress("데이터베이스 모델 분석 및 ERD 설계 중...");

    try {
        let targetModel = "models/gemini-2.0-flash";
        let availableModels = [];
        try {
            const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            if (listRes.ok) {
                const listData = await listRes.json();
                if (listData && listData.models) {
                    const validModels = listData.models.filter(m => 
                        m.supportedGenerationMethods?.includes('generateContent') && 
                        m.name.includes('gemini')
                    );
                    const flash25 = validModels.find(m => m.name.includes('gemini-2.5-flash'));
                    const flash20 = validModels.find(m => m.name.includes('gemini-2.0-flash'));
                    const flash15 = validModels.find(m => m.name.includes('gemini-1.5-flash'));
                    
                    if (flash25) availableModels.push(flash25.name);
                    if (flash20) availableModels.push(flash20.name);
                    if (flash15) availableModels.push(flash15.name);
                }
            }
        } catch(err) { console.warn("모델 탐색 실패:", err); }

        if (availableModels.length === 0) {
            // API 키 권한 문제 등으로 탐색 모델 목록을 가져오지 못한 경우 안전한 하드코딩 모델 풀 기본 제공
            availableModels = ["models/gemini-2.5-flash", "models/gemini-2.0-flash", "models/gemini-1.5-flash"];
        }

        let response = null;
        let lastErrorMsg = "";

        for (const model of availableModels) {
            targetModel = model;
            console.log("ERD 설계 시도 모델:", targetModel);

            const fetchUrl = `https://generativelanguage.googleapis.com/v1beta/${targetModel.startsWith('models/') ? targetModel : `models/${targetModel}`}:generateContent?key=${apiKey}`;

            const fetchOptions = {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: userInput }] }],
                    generationConfig: { 
                        temperature: 0.1, 
                        maxOutputTokens: 8192,
                        responseMimeType: "application/json"
                    }
                })
            };

            try {
                response = await fetch(fetchUrl, fetchOptions);
                if (response.ok) {
                    break; // 응답 성공 시 다른 모델 시도 중단
                } else {
                    const err = await response.json();
                    lastErrorMsg = err.error?.message || response.statusText;
                    console.warn(`모델 ${targetModel} 응답 거부(사유: ${lastErrorMsg}). 다음 모델로 자동 전환합니다.`);
                }
            } catch (err) {
                 lastErrorMsg = err.message;
                 console.warn(`모델 ${targetModel} 네트워크 예외 발생(${err.message}). 다음 모델로 자동 전환합니다.`);
            }
        }

        if (!response || !response.ok) {
            throw new Error(`모든 가용 AI 모델이 응답을 거부했습니다. (마지막 사유: ${lastErrorMsg}). 서버 과부하이므로 잠시 후 재시도하세요.`);
        }

        const data = await response.json();
        let content = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

        let jsonStr = content.trim();
        if (jsonStr.includes("```")) {
            jsonStr = jsonStr.replace(/^[\s\S]*?```(?:json|JSON)?\s*/, '');
            jsonStr = jsonStr.replace(/\s*```[\s\S]*$/, '');
        }

        let parsedData;
        try {
            parsedData = JSON.parse(jsonStr);
        } catch (err) {
            console.error("JSON 파싱 실패 원본 길이:", jsonStr.length, "내용:", jsonStr);
            let truncStr = jsonStr.length > 60 ? (jsonStr.slice(0, 30) + "..." + jsonStr.slice(-30)) : jsonStr;
            const msg = err.message || "";
            if (msg.includes("end of JSON input") || msg.includes("unterminated") || msg.includes("Unexpected token")) {
                throw new Error(`AI 응답 파싱 실패 (${msg}): 결과가 생성 도중 짤렸거나 형식이 잘못되었습니다. (본문크기: ${jsonStr.length}자) 분석 범위를 줄여 재시도해주세요. [${truncStr}]`);
            }
            throw new Error(`AI 응답 형식 오류 (${msg}) [${truncStr}]`);
        }
        
        return parsedData;
    } catch (e) {
        console.error("ERD Analysis Error:", e);
        throw new Error(`ERD 설계 실패: ${e.message}`);
    }
}
