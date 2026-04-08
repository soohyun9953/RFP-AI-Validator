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
        <div className="glass-panel animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', padding: '40px', textAlign: 'center' }}>
          <div style={{ position: 'relative', marginBottom: '32px' }}>
            <div style={{ position: 'absolute', inset: -20, background: 'var(--accent-amber)', opacity: 0.2, filter: 'blur(30px)', borderRadius: '50%' }}></div>
            <Loader2 size={64} color="var(--warning-color)" className="animate-spin" style={{ position: 'relative' }} />
          </div>
          <h2 style={{ margin: '0 0 12px', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 700, letterSpacing: '-0.5px' }}>AI 품질 및 문체 점검 중...</h2>
          <p style={{ margin: 0, fontSize: '15px', maxWidth: '450px', lineHeight: '1.6', opacity: 0.8 }}>
            단어와 문맥을 심층 분석하여 오탈자, 비문, 그리고 논리적 결함을 교정하고 있습니다.<br/>
            전문 수석 감리원이 검토하는 수준의 정밀도가 적용됩니다.
          </p>
        </div>
      ) : resultData ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '24px', right: '24px', zIndex: 10 }}>
            <button 
              onClick={() => setResultData(null)}
              className="interactive"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--glass-border)',
                padding: '8px 16px',
                borderRadius: '10px',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backdropFilter: 'blur(8px)'
              }}
            >
              <ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} /> 결과 닫기
            </button>
          </div>
          <ResultDashboard data={resultData} isTypoMode={true} />
        </div>
      ) : (
        <div className="glass-panel animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
          <div style={{ padding: '32px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.1)', marginBottom: '32px', boxShadow: '0 0 40px rgba(245, 158, 11, 0.1)' }}>
            <PenTool size={56} color="var(--warning-color)" opacity={0.6} />
          </div>
          <h2 style={{ margin: '0 0 16px', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 700, letterSpacing: '-0.5px' }}>분석 대기 중</h2>
          <div style={{ maxWidth: '420px', textAlign: 'center', lineHeight: '1.7', fontSize: '15px', color: 'var(--text-secondary)' }}>
            <p style={{ marginBottom: '16px' }}>좌측 영역에 <strong style={{ color: 'var(--text-primary)' }}>&lt;검증 대상 문서&gt;</strong> 내용을 입력하거나 파일을 업로드하세요.</p>
            <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.1)', color: 'var(--text-muted)', fontSize: '13px' }}>
                💡 <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>Tip:</span> 전문적인 오탈자 및 문체 교정을 위해 우측 상단에 Gemini API Key 입력을 확인해 주세요.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TypoValidator;
