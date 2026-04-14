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
  "summary": "<전체 데이터 모델링 전략 및 설계 방향 요약>"
}

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
        let targetModel = "models/gemini-2.0-flash";
        let availableModels = [];
        // 무료 요금제 한도를 아끼기 위해 매번 모델 리스트를 fetch하는 대신 안정적인 모델들을 하드코딩하여 사용합니다.
        availableModels = ["models/gemini-2.0-flash", "models/gemini-1.5-flash", "models/gemini-2.5-flash"];

        // 지능형 재시도 로직 정의 (Exponential Backoff)
        const fetchWithRetry = async (url, options, maxRetries = 5) => {
            let retries = 0;
            while (retries < maxRetries) {
                const response = await fetch(url, options);
                if (response.ok) return response;

                // 429: 할당량 초과 시 대기 후 재시도
                if (response.status === 429) {
                    const waitTime = Math.pow(2, retries) * 3000 + (Math.random() * 2000); // 3~5s, 6~8s...
                    const waitSec = Math.round(waitTime / 1000);
                    
                    if (onProgress) onProgress(`API 한도 초과로 인해 ${waitSec}초 후 자동 재시도합니다... (시도 ${retries + 1}/${maxRetries})`);
                    console.warn(`[ERD API] 429 발생. ${waitSec}초 대기 중...`);
                    
                    await new Promise(r => setTimeout(r, waitTime));
                    retries++;
                    continue;
                }

                const errData = await response.json();
                throw new Error(errData.error?.message || response.statusText);
            }
            throw new Error("분당 요청 한도가 모두 소진되었습니다. 잠시 후(약 1분 뒤) 다시 시도해 주세요.");
        };

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

        const response = await fetchWithRetry(fetchUrl, fetchOptions);
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
