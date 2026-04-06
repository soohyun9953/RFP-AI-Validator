import React, { useState, useCallback } from 'react';
import { ArrowRight, Loader2, PenTool } from 'lucide-react';
import InputSection from './InputSection';
import ResultDashboard from './ResultDashboard';
import { analyzeDocumentsWithLLM } from '../llmAnalyzer';

function TypoValidator({ apiKey }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [resultData, setResultData] = useState(null);

  const handleAnalyze = useCallback(async (ignoredGuideline, artifact, inspectionScope, glossary) => {
    setIsAnalyzing(true);
    setResultData(null);

    try {
      if (apiKey && apiKey.startsWith('AIza')) {
        // Guideline을 빈 문자열로 전달하여 순수 Typo 교정 모드 강제 트리거
        const result = await analyzeDocumentsWithLLM('', artifact, inspectionScope, apiKey, glossary);
        setResultData(result);
        setIsAnalyzing(false);
      } else {
        setIsAnalyzing(false);
        setResultData({
            score: 0,
            inspectionScope: inspectionScope || null,
            summary: `오탈자 점검은 LLM 전용 기능입니다. API Key를 올바르게 입력해주세요.`,
            rtm: [],
            requirementMapping: [],
            omissions: [],
            typos: [],
        });
      }
    } catch (e) {
        console.error('[TypoValidator] LLM 분석 오류:', e);
        setResultData({
            score: 0,
            inspectionScope: inspectionScope || null,
            summary: `교정교열 과정에서 오류가 발생했습니다: ${e?.message || '알 수 없는 오류'}`,
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
      <InputSection onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} isTypoMode={true} onReset={handleReset} />

      {isAnalyzing ? (
        <div className="glass-panel animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          <Loader2 size={48} color="var(--warning-color)" style={{ animation: 'spin 1.2s linear infinite', marginBottom: '20px' }} />
          <h2 style={{ margin: '0 0 8px', fontSize: '20px', color: 'var(--text-primary)' }}>문서 품질 및 문체 점검 진행 중...</h2>
          <p style={{ margin: 0, fontSize: '14px' }}>단어와 문맥을 파악하여 오탈자, 비문, 논리적 결함을 교정하고 있습니다. (최대 10~20초 소요)</p>
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
              <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> 교정 결과 닫기
            </button>
          </div>
          <ResultDashboard data={resultData} isTypoMode={true} />
        </div>
      ) : (
        <div className="glass-panel animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ padding: '24px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', marginBottom: '24px' }}>
            <ArrowRight size={48} color="var(--warning-color)" opacity={0.5} />
          </div>
          <h2 style={{ margin: '0 0 12px', fontSize: '20px', color: 'var(--text-primary)' }}>대기 중</h2>
          <p style={{ margin: 0, maxWidth: '400px', textAlign: 'center', lineHeight: '1.6' }}>
            우측 상단에 Gemini API Key를 입력하면 전문적인 문서 품질 및 오탈자/문맥 교정이 수행됩니다.<br /><br />
            좌측 영역에 &lt;검증 대상 문서&gt; 내용을 입력하고<br />
            <strong style={{ color: 'var(--warning-color)' }}>문서 품질 정밀 점검 시작</strong> 버튼을 누르면 AI 교정/교열 결과가 이곳에 표시됩니다.
          </p>
        </div>
      )}
    </div>
  );
}

export default TypoValidator;
