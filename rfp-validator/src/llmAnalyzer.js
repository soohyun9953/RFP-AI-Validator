export async function analyzeDocumentsWithLLM(guidelineText, artifactText, inspectionScope, apiKey, glossaryText, onProgress, selectedModel = 'auto') {
    const keys = String(apiKey).split(',').map(k => k.trim()).filter(k => k.startsWith('AIza'));
    if (keys.length === 0) {
        throw new Error("유효한 API 키가 제공되지 않았습니다.");
    }

    let currentKeyIndex = 0;
    const isOnlyTypoCheck = !guidelineText || guidelineText.trim() === '';
    
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

    let systemPrompt = '';
    if (onProgress) onProgress("분석 프롬프트 구성 중...");
    if (isOnlyTypoCheck) {
        systemPrompt = `[시스템 역할]
당신은 최고의 섬세함과 엄격함을 지닌 교정 교열 전문 에이전트입니다. 시간이 아무리 오래 걸려도 좋으니, 제출된 문서의 **모든 문장을 단 하나도 빠짐없이 스플릿(split)하고 한 문장 한 문장 돋보기를 들이대듯 세밀하게 점검**해야 합니다. 대충 축소하거나 대표 예시만 나열하는 것은 엄격하게 금지됩니다.

[극단적 세밀함 검토 기준 및 규칙]
1. 문서의 가장 첫 문장부터 마지막 문장까지 100% 전수조사를 실시하세요. '대표적인 오류'만 지적하는 것은 당신의 임무 실패입니다. 파악된 수십~수백 개의 오류를 끝까지 지치지 않고 모두 나열해야 합니다.
2. '용어 사전'이 제공된 경우, 산출물의 단어가 사전에 정의된 표준 용어 및 표기법과 일치하는지 최우선으로 검증하라. 어긋날 경우 무조건 오류로 판정하고 사전 기준으로 교정하라.
3. [필수 파악] 단순 띄어쓰기 및 맞춤법 점검과 더불어, 문서 전체의 맥락을 분석하여 **논리적/구조적 결함과 문체 완성도**를 과감하게 도출하십시오:
   - 목차-본문 불일치 (목차 제목과 실제 본문 헤드라인 불일치)
   - 수치 정합성 위배 (앞단락 수치와 뒷단락 요약 수치 충돌 등)
   - 허위 참조 오류 ('그림 X', '표 Y' 등 존재하지 않는 개체 참조)
   - 가독성 및 문체 교정: 주어-술어 호응 어색, 모호한 추상적 표현(구체적 기술 용어로 교정 제안), 문장 끝맺음 '~함', '~임' 불일치 (기본적으로 단문 개조식 어조에 맞춤)
   위 결함을 발견하면 errorType을 '[구조/논리 결함]' 또는 '[문체/가독성 결함]'으로 명시하고 심층 교정안을 제시하세요.
   **[중요 예외 규칙: 숫자+단위 붙여쓰기 절대 허용]** '6가지', '3개', '10명' 등 아라비아 숫자 뒤 단위/의존 명사 붙여쓰기(예: 6가지)는 실무 허용이므로 절대 띄어쓰기 오류로 지적하지 마십시오.
4. 오류가 없는 문단(또는 섹션)이 있다면 생략해도 되지만 검토를 건너뛴 것은 아니어야 합니다.
5. 찾아낸 모든 수백 개의 오류 내역을 하나로 모아 아래 데이터 형식인 JSON 배열에 모두 담아서 출력하라.

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
        systemPrompt = `당신은 최고 수준의 IT 감리 전문가이자 공공 프로젝트 산출물 검증 전문 에이전트입니다.
당신의 임무는 입력된 **'기준 문서(Base Document)'**와 **'산출물(Artifact)'**의 성격과 특성을 먼저 파악하고, 그 상관관계에 기반하여 이행 여부 및 내용적 충분성(Adequacy)을 지능적으로 검증하는 것입니다.

[검증 전 필수 분석: 문서의 특성 및 컨텍스트 파악]
- 분석 시작 전, 기준 문서와 산출물의 내용을 대조하여 각 문서가 프로젝트의 어느 단계(예: 요건 정의, 업무 프로세스 분석, 시스템 설계 등)에 해당하는지 파악하십시오.
- 입력된 문서의 특성을 고려하여 점검하십시오. (예: 기준 문서가 '프로세스 정의서'이고 산출물이 '응용아키텍처'라면, 업무 흐름이 아키텍처 컴포넌트나 인터페이스 설계에 어떻게 논리적으로 투영되었는지 도메인 지식을 활용하여 점검합니다.)

[핵심 검증 원칙 - 지능적 전수 조사]
1. **문장 단위 전수 추출 및 논리 대조**: 
   - 기준 문서의 모든 본문 문장을 독립된 요건으로 추출하고, 산출물에서 그 요건이 '문서의 목적과 성격에 맞게' 적절히 반영되었는지 확인하십시오.
2. **지능적 충분성(Adequacy) 판정 (오탈자 검사 제외)**:
   - 이 모드에서는 단순 맞춤법보다는 **내용의 실질적 완성도와 논리적 완결성**에 집중합니다. (오탈자 점검은 별도 모드이므로 여기서 수행하지 마십시오.)
   - **이행(O)**: 산출물의 특성에 맞게 기술 수준이 충분히 구체적이고 전문적으로 작성된 경우.
   - **부분 이행(△)**: 언급은 있으나 문서의 특성상 기대되는 상세도가 낮거나 실행 방안이 모호한 경우.
   - **미이행(X)**: 핵심 취지가 누락되었거나 문서 성격상 반드시 포함되어야 할 설계/수행 내용이 없는 경우.
3. **전문가적 Gap 분석**:
   - '부분 이행' 또는 '미이행' 시, 어떤 기술적/관리적 내용이 보완되어야 하는지 문서의 특성을 고려하여 구체적인 개선 방향을 'gap' 필드에 제시하십시오.
4. **구조적 결함 및 정합성 수색 (typos 배열 활용)**:
   - 오탈자가 아닌, **목차-본문 불일치, 수치 간의 모순, 존재하지 않는 기능 참조** 등 문서 전체의 구조적 결함을 발견 시 'typos' 배열에 전문적으로 기록하십시오.

[출력 형식 제한]
반드시 아래 JSON 형식으로만 출력하세요. 모든 항목은 JSON 배열 내의 개별 객체여야 합니다.
{
  "score": <총점(0~100 정수, 이행 비중 및 내용 충실도 기반)>,
  "inspectionScope": "<전달받은 점검범위 또는 null>",
  "summary": "<입력된 문서들의 특성(예: 프로세스 정의서 vs 설계서) 분석 결과와 이를 바탕으로 한 종합 검증 의견 (매우 상세하게)>",
  "requirementMapping": [
    {
      "id": "<REQ-001 부터 순차 부여>",
      "category": "<요구사항 카테고리>",
      "type": "<'필수' 또는 '선택'>",
      "levelLabel": "<'개별문장'>",
      "path": "<기준 문서 내 위치>",
      "requirement": "<기준 문서에서 추출된 개별 문장 원문 그대로>",
      "artifactSection": "<대응되는 산출물 위치 (없으면 '해당 없음')>",
      "artifactContent": "<산출물의 문서 특성에 맞춰 재구성된 설계/반영 내용 요약 (없으면 '관련 내용 없음')>",
      "status": "<'이행(O)', '부분 이행(△)', '미이행(X)' 중 택 1>",
      "gap": "<부족 사유 및 문서 특성을 고려한 구체적 보완 권고 (이행 시 null)>"
    }
  ],
  "typos": [
    {
      "location": "<위치>",
      "originalText": "<원문>",
      "correction": "<구조적 수정안>",
      "reason": "<[구조 결함], [논리 상충] 등 머리말을 포함한 분석 사유>"
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
        const FALLBACK_MODELS = [
            "models/gemini-2.5-pro",
            "models/gemini-2.5-flash",
            "models/gemini-2.5-flash-lite",
            "models/gemini-1.5-flash",
            "models/gemini-1.5-pro",
            "models/gemini-1.5-flash-8b",
            "models/gemini-2.0-flash-exp"
        ];
        
        let initialModel = selectedModel && selectedModel !== 'auto' ? selectedModel : FALLBACK_MODELS[0];
        if (!initialModel.startsWith('models/')) initialModel = `models/${initialModel}`;
        
        let currentModelIndex = FALLBACK_MODELS.indexOf(initialModel);
        if (currentModelIndex === -1) currentModelIndex = 0;

        const fetchWithRetry = async (maxModelRetries = FALLBACK_MODELS.length) => {
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
                        generationConfig: { temperature: 0.1 }
                    })
                };

                if (onProgress) {
                    const keyInfo = keys.length > 1 ? ` (키 ${currentKeyIndex + 1}/${keys.length} 사용 중)` : '';
                    onProgress(`${modelId.split('/').pop()} 모델로 분석 요청 중...${keyInfo}`);
                }

                const response = await fetch(fetchUrl, fetchOptions);
                
                if (response.ok) {
                    recordUsage(modelId); // 사용량 기록
                    return response;
                }

                const errData = await response.json().catch(() => ({}));
                const errMsg = errData.error?.message || response.statusText || '';
                const isModelUnavailable = response.status === 404
                    || response.status === 400
                    || errMsg.toLowerCase().includes('not found')
                    || errMsg.toLowerCase().includes('not supported')
                    || errMsg.toLowerCase().includes('deprecated');

                if (response.status === 429 || isModelUnavailable) {
                    // 1. 다음 API 키로 즉시 시도 (할당량 초과 시)
                    if (response.status === 429 && keys.length > 1 && (currentKeyIndex + 1) < keys.length) {
                        currentKeyIndex++;
                        if (onProgress) onProgress(`현재 키 할당량 초과... 다음 키로 교체 시도 중 (${currentKeyIndex + 1}/${keys.length})`);
                        continue;
                    }

                    // 2. 모델 변경: 5초 대기 후 다음 모델로 전환
                    modelRetries++;
                    if (modelRetries < maxModelRetries) {
                        currentKeyIndex = 0;
                        const nextModelIndex = (currentModelIndex + 1) % FALLBACK_MODELS.length;
                        const nextModelName = FALLBACK_MODELS[nextModelIndex].split('/').pop();
                        const reason = isModelUnavailable && response.status !== 429 ? '모델 미지원' : '할당량 초과';
                        
                        if (onProgress) onProgress(`[${reason}] 5초 후 모델을 [${nextModelName}]으로 변경하여 재시도합니다.`);
                        
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        currentModelIndex = nextModelIndex;
                        continue;
                    }
                    
                    throw new Error("모든 API 키와 모델의 사용 한도가 소진되었습니다.");
                }
                
                throw new Error(errMsg || response.statusText);
            }
            throw new Error("모든 모델을 시도했으나 응답을 받지 못했습니다.");
        };

        const response = await fetchWithRetry();
        const data = await response.json();
        let content = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

        if (content.includes("```")) {
            const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (match && match[1]) content = match[1];
        }

        const parsed = JSON.parse(content);

        if (parsed.requirementMapping && Array.isArray(parsed.requirementMapping)) {
            if (!parsed.rtm) {
                parsed.rtm = parsed.requirementMapping.map(req => ({
                    type: req.type || '필수',
                    requirement: req.requirement || '-',
                    status: req.status || '미이행(X)',
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
        if (e.message.includes("quota")) throw new Error("Gemini API 할당량이 초과되었습니다.");
        throw new Error(`Gemini 검증 실패: ${e.message}`);
    }
}
