/**
 * Mock Analyzer — 기준 문서·산출물 텍스트를 파싱하여 동적 검증 결과를 생성
 *
 * ── 동작 방식 ──
 * 1. 문서 기호의 종류(group)와 위치(indent)를 조합하여 동적 계층 레벨 결정
 * 2. 기준문서에서 추출된 요구사항 → "필수", 분석기가 추론 → "선택"
 * 3. 산출물 계층구조에서 대응 섹션을 찾아 매칭
 * 4. 매칭 결과를 기반으로 RTM, 매핑 상세, 누락 사항, 점수를 산출
 */

// ── 상수 ──────────────────────────────────────────────
const MAX_LINES = 1000;
const MAX_LINE_LEN = 2000;

function safeStr(val, maxLen = MAX_LINE_LEN) {
    if (val === null || val === undefined) return '';
    const s = String(val);
    return s.length > maxLen ? s.slice(0, maxLen) : s;
}

// ══════════════════════════════════════════════════════════
// 기호 분류 패턴 — symbolGroup + priority
// ══════════════════════════════════════════════════════════
/**
 * priority: 기호 자체가 가지는 계층 우선순위 (낮을수록 상위)
 *   1 = 로마숫자, 장/편/부      (최상위)
 *   2 = 정수 번호, 절/조/항     (주요 섹션)
 *   3 = 복합 번호, 원문자       (하위 섹션)
 *   4 = 불릿/기호, 요구사항 ID  (세부 항목)
 *
 * group: 같은 그룹의 기호가 반복되면 동일 레벨 (형제)
 */
const SYMBOL_RULES = [
    // priority 1: 대분류급
    { group: 'roman_kr', priority: 1, pattern: /^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[\s.·\-]/ },
    { group: 'chapter', priority: 1, pattern: /^제\s*\d+\s*[장편부]/ },
    { group: 'roman_en', priority: 1, pattern: /^[IVX]{1,4}[\s.]/ },
    { group: 'alpha_upper', priority: 1, pattern: /^[A-Z]\.\s/ },

    // priority 2: 중분류급
    { group: 'section', priority: 2, pattern: /^제\s*\d+\s*[절조항]/ },
    { group: 'num_dot', priority: 2, pattern: /^\d{1,2}\.\s/ },
    { group: 'num_paren', priority: 2, pattern: /^\d{1,2}\)\s/ },
    { group: 'hangul_dot', priority: 2, pattern: /^[가나다라마바사아자차카타파하]\.\s/ },

    // priority 3: 소분류급
    { group: 'num_c3', priority: 3, pattern: /^\d{1,2}\.\d{1,2}\.\d{1,2}[\s.]/ },
    { group: 'num_c2', priority: 3, pattern: /^\d{1,2}\.\d{1,2}[\s.]/ },
    { group: 'hangul_paren', priority: 3, pattern: /^[가나다라마바사아자차카타파하]\)\s/ },
    { group: 'paren_num', priority: 3, pattern: /^\(\d{1,2}\)\s/ },
    { group: 'circled', priority: 3, pattern: /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]\s?/ },

    // priority 4: 요구사항 ID
    { group: 'req_id', priority: 4, pattern: /^[A-Z]{2,5}-\d{1,4}\s*[:.)]?\s/ },

    // priority 4~6: 불릿 기호 (종류별 계층: ○ > - > •)
    { group: 'circle_bullet', priority: 4, pattern: /^[○●]\s/ },
    { group: 'square_bullet', priority: 4, pattern: /^[■□▪▸]\s/ },
    { group: 'dash_bullet', priority: 5, pattern: /^[-—–]\s/ },
    { group: 'dot_bullet', priority: 6, pattern: /^[•·※]\s/ },
];

// ══════════════════════════════════════════════════════════
// analyzeLine: 들여쓰기 + 기호 종류 동시 추출
// ══════════════════════════════════════════════════════════
function analyzeLine(rawLine) {
    if (!rawLine || !rawLine.trim()) return null;

    // 들여쓰기 계산 (탭 = 4칸)
    const leadingWs = rawLine.match(/^(\s*)/);
    const indent = (leadingWs ? leadingWs[1] : '').replace(/\t/g, '    ').length;
    const trimmed = rawLine.trim();
    if (!trimmed) return null;

    for (const rule of SYMBOL_RULES) {
        try {
            const m = trimmed.match(rule.pattern);
            if (m) {
                return {
                    indent,
                    group: rule.group,
                    priority: rule.priority,
                    marker: m[0].trim(),
                    content: trimmed.slice(m[0].length).trim() || trimmed,
                    raw: trimmed,
                    hasSymbol: true,
                };
            }
        } catch { /* skip */ }
    }

    return {
        indent,
        group: 'none',
        priority: 99,
        marker: '',
        content: trimmed,
        raw: trimmed,
        hasSymbol: false,
    };
}

// ══════════════════════════════════════════════════════════
// HierarchyTracker — 기호 종류 + 들여쓰기 위치로 동적 레벨 결정
// ══════════════════════════════════════════════════════════
/**
 * 핵심 원리:
 *   1. 기호 우선순위(priority)가 다르면, priority 낮은 기호가 상위 레벨
 *   2. 같은 기호 그룹(group)이 같은 들여쓰기에서 반복 → 동일 레벨 (형제)
 *   3. 들여쓰기가 더 깊으면 같은 priority라도 하위 레벨
 *   4. 들여쓰기가 줄어들면 상위 레벨로 복귀
 *
 * 예시 (동적 레벨 할당):
 *   "Ⅰ. 총론"              → level 1  (priority 1, indent 0)
 *   "1. 프로젝트 개요"       → level 2  (priority 2, indent 0)
 *   "  1.1 배경"            → level 3  (priority 3, indent 2)
 *   "  1.2 목적"            → level 3  (같은 group 'num_c2', indent 2)
 *   "    ○ 세부 목적 A"     → level 4  (priority 4, indent 4)
 *   "    ○ 세부 목적 B"     → level 4  (같은 group, 같은 indent → 형제)
 *   "  1.3 범위"            → level 3  (group 'num_c2' + indent 2 → 복귀)
 *   "2. 현황 분석"           → level 2  (group 'num_dot' + indent 0 → 복귀)
 *   "Ⅱ. 제안요구사항"        → level 1  (group 'roman_kr' + indent 0 → 복귀)
 */
class HierarchyTracker {
    constructor() {
        this.levelMap = new Map();   // "group@indent" → assigned level
        this.stack = [];             // [{ level, group, indent, priority }]
    }

    determineLevel(lineInfo) {
        if (!lineInfo.hasSymbol) return 0;

        const key = `${lineInfo.group}@${lineInfo.indent}`;

        // ── CASE 1: 이미 등장한 (group+indent) 조합 → 같은 레벨 (형제) ──
        if (this.levelMap.has(key)) {
            const level = this.levelMap.get(key);
            // 스택에서 해당 레벨 이상 제거 (형제로 복귀)
            while (this.stack.length > 0 && this.stack[this.stack.length - 1].level >= level) {
                this.stack.pop();
            }
            this.stack.push({ level, group: lineInfo.group, indent: lineInfo.indent, priority: lineInfo.priority });
            return level;
        }

        // ── CASE 2: 새로운 조합 → 컨텍스트 기반 레벨 결정 ──
        let level;

        if (this.stack.length === 0) {
            level = 1;
        } else {
            const parent = this.stack[this.stack.length - 1];

            if (lineInfo.priority > parent.priority) {
                // 기호 우선순위가 더 낮음(숫자 큼) → 하위
                level = parent.level + 1;
            } else if (lineInfo.priority < parent.priority) {
                // 기호 우선순위가 더 높음(숫자 작음) → 상위로 복귀
                level = this._findUpperLevel(lineInfo.priority, lineInfo.indent);
            } else {
                // 같은 priority → 들여쓰기로 비교
                if (lineInfo.indent > parent.indent) {
                    level = parent.level + 1;
                } else if (lineInfo.indent < parent.indent) {
                    level = this._findUpperLevelByIndent(lineInfo.indent, parent.level);
                } else {
                    // 같은 priority + 같은 indent + 다른 group → 같은 레벨
                    level = parent.level;
                    while (this.stack.length > 0 && this.stack[this.stack.length - 1].level >= level) {
                        this.stack.pop();
                    }
                }
            }
        }

        this.levelMap.set(key, level);
        this.stack.push({ level, group: lineInfo.group, indent: lineInfo.indent, priority: lineInfo.priority });
        return level;
    }

    _findUpperLevel(priority, indent) {
        for (let i = this.stack.length - 1; i >= 0; i--) {
            if (this.stack[i].priority <= priority && this.stack[i].indent <= indent) {
                const level = this.stack[i].level;
                this.stack.splice(i);
                return level;
            }
        }
        return 1;
    }

    _findUpperLevelByIndent(indent, currentLevel) {
        for (let i = this.stack.length - 1; i >= 0; i--) {
            if (this.stack[i].indent <= indent) {
                const level = this.stack[i].level;
                this.stack.splice(i);
                return level;
            }
        }
        return Math.max(1, currentLevel - 1);
    }
}

function levelToLabel(level) {
    switch (level) {
        case 1: return '대분류';
        case 2: return '중분류';
        case 3: return '소분류';
        default: return level >= 4 ? '항목' : '본문';
    }
}

// ══════════════════════════════════════════════════════════
// parseDocumentStructure — 문서 계층 파싱
// ══════════════════════════════════════════════════════════
function parseDocumentStructure(text) {
    if (!text || !text.trim()) return [];

    const rawLines = text.split(/\r?\n/).slice(0, MAX_LINES);
    const tracker = new HierarchyTracker();
    const items = [];
    const pathStack = {};

    for (const rawLine of rawLines) {
        try {
            const lineInfo = analyzeLine(rawLine);
            if (!lineInfo) continue;

            const level = tracker.determineLevel(lineInfo);

            if (level === 0) {
                if (items.length > 0) {
                    items[items.length - 1].fullContent += ' ' + lineInfo.content;
                }
                continue;
            }

            pathStack[level] = lineInfo.content.slice(0, 60);
            for (const key of Object.keys(pathStack)) {
                if (Number(key) > level) delete pathStack[key];
            }

            const pathParts = [];
            for (let i = 1; i <= level; i++) {
                if (pathStack[i]) pathParts.push(pathStack[i]);
            }

            items.push({
                level,
                label: levelToLabel(level),
                marker: lineInfo.marker,
                content: lineInfo.content,
                fullContent: lineInfo.content,
                path: pathParts.join(' > '),
                raw: lineInfo.raw,
                indent: lineInfo.indent,
                symbolGroup: lineInfo.group,
            });
        } catch { continue; }
    }

    return items;
}

// ══════════════════════════════════════════════════════════
// 메타/헤더 행(표 컬럼명 등) 판별 함수 (점검대상에서 제외)
// ══════════════════════════════════════════════════════════
function isDocumentHeaderRow(text) {
    if (!text) return false;
    const clean = text.replace(/\s/g, '').toUpperCase();
    return clean.includes('LV1|LV2') || 
           clean.includes('요구사항ID|') || 
           clean.includes('대분류|중분류|') || 
           clean.includes('정의|화면/기능') ||
           clean.startsWith('LV1|');
}

// ══════════════════════════════════════════════════════════
// 요구사항 추출 (계층 인식)
//
// 핵심: "하위 항목을 가진 항목 = 헤더(컨텍스트)" → 검증 대상 아님
//       "하위 항목이 없는 말단 항목 = 요구사항"   → 검증 대상
// ══════════════════════════════════════════════════════════
function extractRequirementsFromStructure(structuredItems) {
    if (!structuredItems || structuredItems.length === 0) return [];

    const requirements = [];
    const usedIds = new Set();
    let autoIdx = 1;

    // 1단계: 각 항목이 "헤더(상위 분류)"인지 "말단(요구사항)"인지 판별
    //   → 바로 다음 항목의 레벨이 현재보다 크면 헤더 (자식이 있음)
    const isHeader = new Array(structuredItems.length).fill(false);
    for (let i = 0; i < structuredItems.length - 1; i++) {
        if (structuredItems[i + 1].level > structuredItems[i].level) {
            isHeader[i] = true;
        }
    }

    // 계층 경로에서 카테고리 컨텍스트 추적
    const context = {}; // level → content (현재 활성 헤더 정보)

    for (let i = 0; i < structuredItems.length; i++) {
        const item = structuredItems[i];
        try {
            // 헤더인 경우: 검증 대상 아님, 카테고리 컨텍스트로 저장
            if (isHeader[i]) {
                context[item.level] = item.content.slice(0, 60);
                // 하위 레벨 컨텍스트 초기화
                for (const key of Object.keys(context)) {
                    if (Number(key) > item.level) delete context[key];
                }
                continue;
            }

            // 말단 항목 → 검증 대상 요구사항으로 추출
            const content = item.fullContent || item.content;
            if (!content || content.trim().length < 3) continue;

            // 기준문서 헤더(컬럼명 등) 제외
            if (isDocumentHeaderRow(content)) continue;

            // ID 추출
            let id;
            const idMatch = content.match(/^([A-Z]{2,5}-\d{1,4})/i);
            if (idMatch) {
                id = idMatch[1].toUpperCase();
            } else {
                id = `REQ-${String(autoIdx).padStart(3, '0')}`;
                autoIdx++;
            }
            while (usedIds.has(id)) { id = `${id}-${usedIds.size + 1}`; }
            usedIds.add(id);

            // 카테고리: 가장 가까운 상위 헤더에서 가져오기
            let category = '';
            // level 2 → level 1 순으로 가장 가까운 헤더
            for (let lv = item.level - 1; lv >= 1; lv--) {
                if (context[lv]) {
                    category = context[lv];
                    break;
                }
            }
            if (!category) category = guessCategory(content);

            // 대분류/중분류 (경로에서 추출)
            const majorCategory = context[1] || '';
            const middleCategory = context[2] || context[1] || '';

            requirements.push({
                id,
                category,
                majorCategory,
                middleCategory,
                level: item.level,
                levelLabel: item.label,
                content: content.trim(),
                path: item.path,
                type: '필수', // 기준문서에서 직접 추출 → 필수
            });
        } catch { continue; }
    }

    return requirements;
}

/**
 * 구조화된 문서에서 특정 ID(예: CSR-011)의 하위 항목을 모두 추출하여
 * 개별 요구사항으로 반환한다.
 *
 * CSR-011이 헤더(상위 분류)인 경우:
 *   CSR-011 협업 및 커뮤니케이션 관리 요건 분석    ← 헤더 (이후 하위가 검증 대상)
 *     ○ 이해관계자 간 커뮤니케이션 기능 요건 분석  ← 하위 항목 → 개별 검증
 *       - 커뮤니케이션 공간 구축 기능 요구사항     ← 더 하위 → 개별 검증
 *         • 공지사항, FAQ, Q&A ...               ← 최하위 → 개별 검증
 */
function extractChildrenOfIds(scopeIds, structuredItems) {
    if (!structuredItems || structuredItems.length === 0) return [];

    const childRequirements = [];
    const usedIds = new Set();
    let childIdx = 1;

    for (const targetId of scopeIds) {
        // 구조에서 해당 ID를 포함하는 항목(헤더) 찾기
        let parentIdx = -1;
        let parentLevel = -1;
        for (let i = 0; i < structuredItems.length; i++) {
            const item = structuredItems[i];
            const text = ((item.raw || '') + ' ' + (item.content || '')).toUpperCase();
            if (text.includes(targetId)) {
                parentIdx = i;
                parentLevel = item.level;
                break;
            }
        }

        if (parentIdx < 0) continue;

        // 해당 ID 이후의 하위 항목 수집 (레벨이 parentLevel보다 큰 항목)
        const parentContent = structuredItems[parentIdx].content || '';
        for (let i = parentIdx + 1; i < structuredItems.length; i++) {
            const item = structuredItems[i];
            // 같은 레벨이거나 더 상위면 종료 (다른 섹션 시작)
            if (item.level <= parentLevel) break;

            const content = item.fullContent || item.content;
            if (!content || content.trim().length < 3) continue;

            // 기준문서 헤더(컬럼명 등) 제외
            if (isDocumentHeaderRow(content)) continue;

            // 다음 항목이 더 하위 레벨이면 현재 항목은 중간 헤더 → 컨텍스트로 활용
            const hasChildren = (i + 1 < structuredItems.length) &&
                structuredItems[i + 1].level > item.level;

            // 중간 헤더도 검증 대상으로 포함 (세부 내용 중심 점검)
            const id = `${targetId}-${String(childIdx).padStart(2, '0')}`;
            if (usedIds.has(id)) continue;
            usedIds.add(id);
            childIdx++;

            childRequirements.push({
                id,
                category: parentContent.slice(0, 60),
                majorCategory: parentContent.slice(0, 60),
                middleCategory: hasChildren ? content.slice(0, 60) : '',
                level: item.level,
                levelLabel: item.label,
                content: content.trim(),
                path: item.path || `${targetId} > ${content.slice(0, 40)}`,
                type: '필수', // 기준문서의 세부 내용 → 필수
            });
        }
    }

    return childRequirements;
}

function guessCategory(text) {
    try {
        const t = (text || '').toLowerCase();
        if (/보안|암호|인증|접근\s?제어|방화벽|isms|개인정보/.test(t)) return '보안';
        if (/성능|응답\s?시간|tps|가용성|sla|rto|rpo|부하/.test(t)) return '비기능';
        if (/클라우드|인프라|서버|네트워크|msa|컨테이너|배포/.test(t)) return '인프라';
        if (/데이터|db|데이터베이스|스키마|백업|복구|마이그레이션/.test(t)) return '데이터';
        return '기능';
    } catch { return '기능'; }
}

// ══════════════════════════════════════════════════════════
// 산출물 매칭 (계층 인식)
// ══════════════════════════════════════════════════════════
function matchRequirementToArtifact(requirement, artifactStructure, artifactLines) {
    const defaultResult = { found: false, section: '해당 없음', snippet: '산출물 내 관련 내용 없음', score: 0, artifactPath: '' };

    try {
        if ((!artifactStructure || artifactStructure.length === 0) && (!artifactLines || artifactLines.length === 0)) {
            return defaultResult;
        }

        const keywords = extractKeywords(requirement.content);
        if (keywords.length === 0) return defaultResult;

        let bestScore = 0;
        let bestItem = null;

        // 1) 구조화된 항목에서 매칭
        for (const item of artifactStructure) {
            try {
                const searchText = (item.fullContent || item.content || '').toLowerCase();
                // 경로(상위 분류)의 텍스트도 탐색 범위에 포함
                const pathText = (item.path || '').toLowerCase();
                const combinedText = searchText + ' ' + pathText;

                let itemScore = 0;
                for (const kw of keywords) {
                    if (combinedText.includes(kw.toLowerCase())) {
                        itemScore += kw.length;
                    }
                }
                // 같은 계층 수준이면 가산점
                if (item.level === requirement.level) {
                    itemScore *= 1.2;
                }
                // 같은 계층 경로 키워드가 겹치면 추가 가산점
                if (requirement.path && item.path) {
                    const reqPathWords = requirement.path.toLowerCase().split(/[\s>]+/).filter(w => w.length >= 2);
                    const artPathWords = item.path.toLowerCase().split(/[\s>]+/).filter(w => w.length >= 2);
                    const overlap = reqPathWords.filter(w => artPathWords.some(aw => aw.includes(w) || w.includes(aw)));
                    if (overlap.length > 0) {
                        itemScore *= (1 + overlap.length * 0.15);
                    }
                }
                if (itemScore > bestScore) {
                    bestScore = itemScore;
                    bestItem = item;
                }
            } catch { continue; }
        }

        // 2) 폴백: 원본 줄 검색
        if (bestScore === 0 && artifactLines && artifactLines.length > 0) {
            for (let i = 0; i < artifactLines.length; i++) {
                try {
                    const lineLower = (artifactLines[i] || '').toLowerCase();
                    let lineScore = 0;
                    for (const kw of keywords) {
                        if (lineLower.includes(kw.toLowerCase())) {
                            lineScore += kw.length;
                        }
                    }
                    if (lineScore > bestScore) {
                        bestScore = lineScore;
                        bestItem = {
                            content: artifactLines[i],
                            fullContent: artifactLines[i],
                            path: `${i + 1}번째 줄 부근`,
                            level: 0,
                            label: '본문',
                        };
                    }
                } catch { continue; }
            }
        }

        if (bestScore === 0 || !bestItem) return defaultResult;

        const totalKeywordLen = keywords.reduce((s, k) => s + k.length, 0) || 1;
        const coverageRate = Math.min(100, Math.round((bestScore / totalKeywordLen) * 100));

        return {
            found: true,
            section: bestItem.path || `(${bestItem.label})`,
            snippet: safeStr(bestItem.fullContent || bestItem.content, 200),
            score: coverageRate,
            artifactPath: bestItem.path || '',
        };
    } catch (e) {
        console.error('[mockAnalyzer] matchRequirementToArtifact 오류:', e);
        return defaultResult;
    }
}

function extractKeywords(text) {
    try {
        if (!text) return [];
        const stopwords = new Set([
            '및', '의', '를', '을', '이', '가', '에', '는', '은', '로', '으로',
            '한', '할', '하는', '해야', '해야한다', '한다', '있어야', '위한',
            '것', '수', '등', '시', '때', '대한', '관련', '필요', '경우',
            'the', 'a', 'an', 'is', 'are', 'and', 'or', 'to', 'for', 'of', 'in', 'on'
        ]);
        return safeStr(text)
            .replace(/[()[\]{}:;.,!?'"<>\/\\|`~@#$%^&*+=]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 2 && !stopwords.has(w.toLowerCase()))
            .slice(0, 50);
    } catch { return []; }
}

/**
 * 점검범위 텍스트를 개별 점검항목(체크포인트)으로 분해한다.
 * 구분자: 쉼표, 세미콜론, 줄바꿈, 불릿 기호, 숫자 번호 등
 *
 * 예: "인증 시스템 2FA 구현 여부, 비밀번호 정책 준수, 세션 관리"
 *   → ["인증 시스템 2FA 구현 여부", "비밀번호 정책 준수", "세션 관리"]
 *
 * 예: "1. 접근통제 정책\n2. 로그 감사\n3. 암호화 적용"
 *   → ["접근통제 정책", "로그 감사", "암호화 적용"]
 */
function parseScopeIntoCheckpoints(scopeText) {
    if (!scopeText || !scopeText.trim()) return [];

    try {
        // 줄바꿈으로 먼저 분리
        let items = scopeText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

        // 각 줄을 쉼표/세미콜론으로 추가 분리
        const expanded = [];
        for (const item of items) {
            const parts = item.split(/[,;，；]/).map(p => p.trim()).filter(p => p.length > 0);
            expanded.push(...parts);
        }

        // 선행 번호/기호 제거하여 순수 내용만 추출
        return expanded
            .map(item => {
                return item
                    .replace(/^\d{1,3}[.)]\s*/, '')       // "1. " "2) "
                    .replace(/^\(\d{1,3}\)\s*/, '')        // "(1) "
                    .replace(/^[A-Z]{2,5}-\d{1,4}\s*[:.)]?\s*/, '') // "CSR-011: "
                    .replace(/^[-·○●■□▪▸※•]\s*/, '')   // "- " "○ "
                    .replace(/^[가나다라]\.\s*/, '')         // "가. "
                    .replace(/^\s*(을|를|의|에서|에|로|와|과|대해|대한|기준으로|중심으로)\s+/g, '') // 조사로 시작하는 경우
                    .trim();
            })
            .filter(item => item.length >= 3); // 3글자 이상만 유효
    } catch {
        return [];
    }
}

// ══════════════════════════════════════════════════════════
// 메인 분석 함수
// ══════════════════════════════════════════════════════════
export function analyzeDocuments(guidelineText, artifactText, inspectionScope) {
    try {
        // 1) 기준문서 계층 파싱
        const guidelineStructure = parseDocumentStructure(guidelineText);

        // 2) 요구사항 추출 (계층 인식)
        let requirements = extractRequirementsFromStructure(guidelineStructure);
        if (requirements.length === 0) {
            requirements = fallbackExtractRequirements(guidelineText);
        }
        if (requirements.length === 0) {
            return createEmptyResult(inspectionScope);
        }

        // 3) 산출물 계층 파싱
        const artifactStructure = parseDocumentStructure(artifactText);
        const artifactLines = (artifactText || '')
            .split(/\r?\n/).map(l => safeStr(l).trim()).filter(l => l.length > 0).slice(0, MAX_LINES);

        // 4) 점검범위 필터링 (ID, 번호, 키워드 3단계)
        let scopeFiltered = false;
        if (inspectionScope && inspectionScope.trim()) {
            try {
                let filtered = [];

                // 4-1) ID 패턴 매칭 (CSR-011, REQ-001 등)
                //   → ID가 요구사항 목록에 있으면 직접 필터
                //   → ID가 헤더(상위 분류)인 경우, 구조에서 해당 ID의 하위 항목을 모두 추출
                const scopeIds = [];
                const scopeIdPattern = /[A-Z]{2,5}-\d{1,4}/gi;
                let m;
                while ((m = scopeIdPattern.exec(inspectionScope)) !== null) {
                    scopeIds.push(m[0].toUpperCase());
                }
                if (scopeIds.length > 0) {
                    // 먼저 기존 요구사항에서 직접 매칭 시도
                    filtered = requirements.filter(r =>
                        r && r.id && scopeIds.includes(r.id.toUpperCase())
                    );

                    // ID가 요구사항에 없으면 → 구조에서 해당 ID를 헤더로 찾고 하위 항목 추출
                    if (filtered.length === 0) {
                        const childReqs = extractChildrenOfIds(scopeIds, guidelineStructure);
                        if (childReqs.length > 0) {
                            filtered = childReqs;
                        }
                    }

                    // path에 해당 ID가 포함된 요구사항도 추가
                    if (filtered.length === 0) {
                        filtered = requirements.filter(r =>
                            r && scopeIds.some(sid =>
                                (r.path || '').toUpperCase().includes(sid) ||
                                (r.content || '').toUpperCase().includes(sid)
                            )
                        );
                    }
                }

                // 4-2) 번호 패턴 매칭 (1.1, 3.2.1, (3) 등 마커/번호)
                if (filtered.length === 0) {
                    const numPatterns = [];
                    // "1.1", "3.2", "1.2.3" 등
                    const numMatch = inspectionScope.match(/\d{1,2}(?:\.\d{1,2}){1,3}/g);
                    if (numMatch) numPatterns.push(...numMatch);
                    // "1.", "2.", "3." 등 단독 번호
                    const singleNum = inspectionScope.match(/(?:^|\s)(\d{1,2})\.(?:\s|$)/g);
                    if (singleNum) numPatterns.push(...singleNum.map(s => s.trim()));

                    if (numPatterns.length > 0) {
                        filtered = requirements.filter(r => {
                            if (!r) return false;
                            const marker = (r.path || '') + ' ' + (r.content || '');
                            return numPatterns.some(np => {
                                const npClean = np.replace(/\.$/, '').trim();
                                return marker.includes(npClean);
                            });
                        });
                    }
                }

                // 4-3) 키워드 매칭 (점검범위 텍스트에서 핵심 단어 추출 → 요구사항 내용 검색)
                if (filtered.length === 0) {
                    const scopeKeywords = extractKeywords(inspectionScope)
                        .filter(k => k.length >= 2);
                    if (scopeKeywords.length > 0) {
                        // 각 요구사항에 대해 키워드 매칭 점수 계산
                        const scored = requirements.map(r => {
                            const text = ((r.content || '') + ' ' + (r.path || '') + ' ' + (r.category || '')).toLowerCase();
                            let score = 0;
                            for (const kw of scopeKeywords) {
                                if (text.includes(kw.toLowerCase())) {
                                    score += kw.length;
                                }
                            }
                            return { req: r, score };
                        }).filter(s => s.score > 0);

                        if (scored.length > 0) {
                            // 매칭 점수 상위 항목만 선택 (최소 2점 이상)
                            const maxScore = Math.max(...scored.map(s => s.score));
                            const threshold = Math.max(2, maxScore * 0.3);
                            filtered = scored
                                .filter(s => s.score >= threshold)
                                .sort((a, b) => b.score - a.score)
                                .map(s => s.req);
                        }
                    }
                }

                if (filtered.length > 0) {
                    requirements = filtered;
                    scopeFiltered = true;
                }
            } catch { /* 점검범위 파싱 실패 시 전체 진행 */ }

            // 4-4) 점검범위 세분화: 점검범위 텍스트를 개별 점검항목으로 분해하여 추가
            try {
                const scopeItems = parseScopeIntoCheckpoints(inspectionScope);
                if (scopeItems.length > 0) {
                    let cpIdx = 1;
                    for (const checkpoint of scopeItems) {
                        // 기존 요구사항과 중복 여부 확인 (키워드 70% 이상 겹치면 중복)
                        const cpKeywords = extractKeywords(checkpoint);
                        if (cpKeywords.length === 0) continue;

                        const isDuplicate = requirements.some(r => {
                            const reqKw = extractKeywords(r.content);
                            if (reqKw.length === 0) return false;
                            const overlap = cpKeywords.filter(ck =>
                                reqKw.some(rk => rk.toLowerCase() === ck.toLowerCase())
                            );
                            return overlap.length >= cpKeywords.length * 0.7;
                        });

                        if (!isDuplicate) {
                            requirements.push({
                                id: `CHK-${String(cpIdx).padStart(3, '0')}`,
                                category: '점검범위 세부항목',
                                majorCategory: '',
                                middleCategory: '',
                                level: 4,
                                levelLabel: '점검항목',
                                content: checkpoint.trim(),
                                path: '점검범위 > ' + checkpoint.slice(0, 40),
                                type: '선택', // 사용자가 추가 지정한 점검 → 선택
                            });
                            cpIdx++;
                        }
                    }
                }
            } catch { /* 세분화 실패 시 기존 요구사항으로 계속 */ }
        }

        // 5) 각 요구사항 ↔ 산출물 매칭
        const mappingResults = [];
        for (const req of requirements) {
            try {
                const match = matchRequirementToArtifact(req, artifactStructure, artifactLines);

                let status, coverageRate;
                if (!match.found) {
                    status = '미충족'; coverageRate = 0;
                } else if (match.score >= 70) {
                    status = '충족'; coverageRate = Math.max(70, match.score);
                } else if (match.score >= 30) {
                    status = '부분충족'; coverageRate = match.score;
                } else {
                    status = '미충족'; coverageRate = match.score;
                }

                mappingResults.push({
                    id: req.id || 'UNKNOWN',
                    category: req.category || '기능',
                    type: req.type || '필수',
                    levelLabel: req.levelLabel || '',
                    path: req.path || '',
                    requirement: safeStr(req.content, 200),
                    artifactSection: match.section || '해당 없음',
                    artifactContent: match.found ? `"${safeStr(match.snippet, 200)}"` : '산출물 내 관련 내용 없음',
                    coverageRate: isNaN(coverageRate) ? 0 : coverageRate,
                    status,
                    gap: status !== '충족'
                        ? `산출물에서 "${safeStr(req.content, 40)}" 관련 내용이 ${!match.found ? '발견되지 않았습니다.' : '부분적으로만 확인되며, 구체적 명세가 부족합니다.'}`
                        : null,
                });
            } catch (e) {
                console.warn(`[mockAnalyzer] 요구사항 ${req?.id || '?'} 매칭 오류:`, e);
                mappingResults.push({
                    id: req?.id || 'ERR', category: req?.category || '기능', type: req?.type || '필수',
                    levelLabel: '', path: '',
                    requirement: safeStr(req?.content || '(파싱 오류)', 200),
                    artifactSection: '분석 오류',
                    artifactContent: `분석 중 오류: ${e?.message || '알 수 없는 오류'}`,
                    coverageRate: 0, status: '미충족', gap: '분석 중 오류 발생',
                });
            }
        }

        // 6) RTM
        const rtm = mappingResults.map(r => {
            try {
                return {
                    type: r.type,
                    requirement: (r.requirement || '').length > 50 ? r.requirement.slice(0, 50) + '…' : (r.requirement || ''),
                    status: r.status === '충족' ? 'Pass' : r.status === '미충족' ? 'Fail' : 'Partial',
                    location: r.artifactSection || '해당 없음',
                    category: r.category || '',
                    levelLabel: r.levelLabel || '',
                    coverageRate: r.coverageRate ?? 0,
                };
            } catch {
                return { type: '선택', requirement: '(오류)', status: 'Fail', location: '오류', category: '', levelLabel: '', coverageRate: 0 };
            }
        });

        // 7) 누락 사항
        const omissions = mappingResults.filter(r => r.status !== '충족').map(r => {
            try {
                return {
                    title: `${r.id} ${(r.requirement || '').slice(0, 40)}${(r.requirement || '').length > 40 ? '…' : ''}`,
                    evidence: `기준문서 [${r.type}] 요구사항 ${r.id}: "${r.requirement || ''}"`,
                    reason: r.gap || '상세 사유를 확인할 수 없습니다.',
                    recommendation: r.status === '미충족'
                        ? `산출물에 "${(r.requirement || '').slice(0, 30)}" 관련 내용을 신규 추가해야 합니다.`
                        : `산출물 내 해당 내용의 구체적 명세(수치, 기준, 방법론 등)를 보완해야 합니다.`,
                };
            } catch {
                return { title: `${r?.id || '?'} (오류)`, evidence: '오류', reason: '분석 중 오류', recommendation: '다시 검증해 주세요.' };
            }
        });

        // 8) 점수
        let totalScore = 0;
        if (mappingResults.length > 0) {
            const sum = mappingResults.reduce((s, r) => s + (isNaN(r.coverageRate) ? 0 : r.coverageRate), 0);
            totalScore = Math.round(sum / mappingResults.length);
        }

        // 9) 요약
        const metCount = mappingResults.filter(r => r.status === '충족').length;
        const partialCount = mappingResults.filter(r => r.status === '부분충족').length;
        const unmetCount = mappingResults.filter(r => r.status === '미충족').length;
        const requiredCount = mappingResults.filter(r => r.type === '필수').length;
        const optionalCount = mappingResults.filter(r => r.type === '선택').length;

        let summaryText = '';
        if (inspectionScope && inspectionScope.trim()) {
            summaryText += `사용자 지정 점검범위("${safeStr(inspectionScope, 80)}")를 중심으로 분석을 수행하였습니다. `;
            if (scopeFiltered) {
                summaryText += `점검범위에 명시된 요구사항 ID를 기준으로 ${requirements.length}건을 집중 검증하였습니다. `;
            }
        }
        summaryText += `총 ${mappingResults.length}건의 요구사항(필수 ${requiredCount}건, 선택 ${optionalCount}건) 중 `
            + `충족 ${metCount}건, 부분충족 ${partialCount}건, 미충족 ${unmetCount}건으로 분석되었습니다.`;
        if (unmetCount > 0) summaryText += ` 미충족 항목에 대한 보완이 필요합니다.`;

        return {
            score: isNaN(totalScore) ? 0 : totalScore,
            inspectionScope: inspectionScope || null,
            summary: summaryText,
            rtm,
            requirementMapping: mappingResults,
            omissions,
        };
    } catch (e) {
        console.error('[mockAnalyzer] analyzeDocuments 최상위 오류:', e);
        return {
            score: 0, inspectionScope: inspectionScope || null,
            summary: `분석 중 오류가 발생했습니다: ${e?.message || '알 수 없는 오류'}`,
            rtm: [], requirementMapping: [], omissions: [],
        };
    }
}

// ── 폴백: 줄 단위 요구사항 추출 ───────────────────────────────
function fallbackExtractRequirements(guidelineText) {
    if (!guidelineText || !guidelineText.trim()) return [];

    const lines = guidelineText.split(/\r?\n/).map(l => safeStr(l).trim()).filter(l => l.length > 3).slice(0, MAX_LINES);
    const requirements = [];
    const usedIds = new Set();
    let autoIdx = 1;

    for (const line of lines) {
        try {
            let id, content;
            const idMatch = line.match(/^([A-Z]{2,5}-\d{1,4})\s*[:.)]?\s*(.+)/i);
            if (idMatch) {
                id = idMatch[1].toUpperCase();
                content = (idMatch[2] || '').trim();
            } else {
                const numMatch = line.match(/^(\d{1,3})\s*[.)]\s*(.+)/);
                if (numMatch) {
                    id = `REQ-${String(numMatch[1]).padStart(3, '0')}`;
                    content = (numMatch[2] || '').trim();
                } else {
                    id = `REQ-${String(autoIdx).padStart(3, '0')}`;
                    content = line;
                    autoIdx++;
                }
            }
            if (!content || content.length < 3) continue;
            
            // 기준문서 헤더(컬럼명 등) 제외
            if (isDocumentHeaderRow(content)) continue;

            while (usedIds.has(id)) { id = `${id}-${usedIds.size + 1}`; }
            usedIds.add(id);
            requirements.push({
                id, category: guessCategory(content),
                majorCategory: '', middleCategory: '',
                level: 4, levelLabel: '항목',
                content, path: '', type: '필수',
            });
        } catch { continue; }
    }
    return requirements;
}

function createEmptyResult(inspectionScope) {
    return {
        score: 0, inspectionScope: inspectionScope || null,
        summary: '기준 문서에서 요구사항을 추출할 수 없습니다. 기준 문서에 요구사항을 줄 단위로 입력하거나, "CSR-001: 내용" 형태로 작성해 주세요.',
        rtm: [], requirementMapping: [], omissions: [],
    };
}
