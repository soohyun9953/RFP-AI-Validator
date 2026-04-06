import React, { useState, useCallback } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import InputSection from './InputSection';
import ResultDashboard from './ResultDashboard';
import { analyzeDocuments } from '../mockAnalyzer';
import { analyzeDocumentsWithLLM } from '../llmAnalyzer';

function DocumentValidator({ apiKey }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [isLlmMode, setIsLlmMode] = useState(false);

  const handleAnalyze = useCallback(async (guideline, artifact, inspectionScope, glossary) => {
    setIsAnalyzing(true);
    setResultData(null);

    try {
      if (apiKey && apiKey.startsWith('AIza')) {
        setIsLlmMode(true);
        const result = await analyzeDocumentsWithLLM(guideline, artifact, inspectionScope, apiKey, glossary);
        setResultData(result);
        setIsAnalyzing(false);
      } else {
        setIsLlmMode(false);
        // 분석 시뮬레이션 (입력 텍스트를 실제로 파싱하여 결과 생성)
        setTimeout(() => {
          try {
            const result = analyzeDocuments(guideline, artifact, inspectionScope, glossary);
            setResultData(result);
          } catch (e) {
            console.error('[DocumentValidator] 분석 오류:', e);
            setResultData({
              score: 0,
              inspectionScope: inspectionScope || null,
              summary: `분석 중 오류가 발생했습니다: ${e?.message || '알 수 없는 오류'}`,
              rtm: [],
              requirementMapping: [],
              omissions: [],
              typos: [],
            });
          }
          setIsAnalyzing(false);
        }, 1500);
      }
    } catch (e) {
        console.error('[DocumentValidator] LLM 분석 오류:', e);
        setResultData({
            score: 0,
            inspectionScope: inspectionScope || null,
            summary: `LLM 검증 중 오류가 발생했습니다: ${e?.message || '알 수 없는 오류'}`,
            rtm: [],
            requirementMapping: [],
            omissions: [],
            typos: [],
        });
        setIsAnalyzing(false);
    }
  }, [apiKey]);

  const handleReset = () => {
    setResultData(null);
    setIsAnalyzing(false);
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', gap: '24px', minHeight: 0, overflow: 'hidden' }}>
      <InputSection onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} onReset={handleReset} />

      {isAnalyzing ? (
        <div className="glass-panel animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          <Loader2 size={48} color="var(--accent-color)" style={{ animation: 'spin 1.2s linear infinite', marginBottom: '20px' }} />
          <h2 style={{ margin: '0 0 8px', fontSize: '20px', color: 'var(--text-primary)' }}>{isLlmMode ? 'Gemini 의미론적 검증 진행 중...' : 'AI 검증 진행 중...'}</h2>
          <p style={{ margin: 0, fontSize: '14px' }}>{isLlmMode ? '최적의 최신 모델(Gemini 3 Flash 등)이 문맥과 의미를 깊이 있게 분석하고 있습니다. (최대 10~20초 소요)' : '입력된 문서를 분석하고 있습니다.'}</p>
        </div>
      ) : resultData ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
            <button 
              onClick={() => setResultData(null)}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid var(--panel-border)',
                padding: '6px 12px',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backdropFilter: 'blur(4px)'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            >
              <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> 검증 결과 닫기
            </button>
          </div>
          <ResultDashboard data={resultData} />
        </div>
      ) : (
        <div className="glass-panel animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ padding: '24px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', marginBottom: '24px' }}>
            <ArrowRight size={48} color="var(--accent-color)" opacity={0.5} />
          </div>
          <h2 style={{ margin: '0 0 12px', fontSize: '20px', color: 'var(--text-primary)' }}>대기 중</h2>
          <p style={{ margin: 0, maxWidth: '400px', textAlign: 'center', lineHeight: '1.6' }}>
            우측 상단에 Gemini API Key를 입력하면 LLM 기반 의미론적 점검이 수행됩니다.<br /><br />
            좌측 영역에 &lt;기준 문서&gt;와 &lt;산출물&gt; 내용을 입력하고<br />
            <strong style={{ color: 'var(--accent-color)' }}>검증 시작</strong> 버튼을 누르면 AI 분석 결과가 이곳에 표시됩니다.
          </p>
        </div>
      )}
    </div>
  );
}

export default DocumentValidator;
