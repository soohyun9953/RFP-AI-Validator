import React, { useState, useCallback, useEffect } from 'react';
import './index.css';
import { ShieldCheck, ArrowRight, Loader2, Key } from 'lucide-react';
import InputSection from './components/InputSection';
import ResultDashboard from './components/ResultDashboard';
import { analyzeDocuments } from './mockAnalyzer';
import { analyzeDocumentsWithLLM } from './llmAnalyzer';

function App() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [isLlmMode, setIsLlmMode] = useState(false);

  useEffect(() => {
    localStorage.setItem('gemini_api_key', apiKey);
  }, [apiKey]);

  const handleAnalyze = useCallback(async (guideline, artifact, inspectionScope) => {
    setIsAnalyzing(true);
    setResultData(null);

    try {
      if (apiKey && apiKey.startsWith('AIza')) {
        setIsLlmMode(true);
        const result = await analyzeDocumentsWithLLM(guideline, artifact, inspectionScope, apiKey);
        setResultData(result);
        setIsAnalyzing(false);
      } else {
        setIsLlmMode(false);
        // 분석 시뮬레이션 (입력 텍스트를 실제로 파싱하여 결과 생성)
        setTimeout(() => {
          try {
            const result = analyzeDocuments(guideline, artifact, inspectionScope);
            setResultData(result);
          } catch (e) {
            console.error('[App] 분석 오류:', e);
            setResultData({
              score: 0,
              inspectionScope: inspectionScope || null,
              summary: `분석 중 오류가 발생했습니다: ${e?.message || '알 수 없는 오류'}`,
              rtm: [],
              requirementMapping: [],
              omissions: [],
            });
          }
          setIsAnalyzing(false);
        }, 1500);
      }
    } catch (e) {
        console.error('[App] LLM 분석 오류:', e);
        setResultData({
            score: 0,
            inspectionScope: inspectionScope || null,
            summary: `LLM 검증 중 오류가 발생했습니다: ${e?.message || '알 수 없는 오류'}`,
            rtm: [],
            requirementMapping: [],
            omissions: [],
        });
        setIsAnalyzing(false);
    }
  }, [apiKey]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '24px', gap: '20px', overflow: 'hidden' }}>
      <header className="glass-panel" style={{ padding: '20px 30px', display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
        <ShieldCheck size={36} color="var(--success-color)" />
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, letterSpacing: '-0.5px' }}>RFP AI Validator</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
            수석 규제 감사관 - 제안요청서 &amp; 가이드라인 자동 검증 시스템
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
          <Key size={16} color="var(--text-secondary)" />
          <input
            type="password"
            placeholder="Gemini API Key (AIza...)"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            style={{
              background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)',
              width: '200px', fontSize: '13px'
            }}
          />
          {apiKey && apiKey.startsWith('AIza') && <span style={{ fontSize: '11px', color: 'var(--success-color)', fontWeight: 600 }}>LLM 활성</span>}
        </div>
      </header>

      <main style={{ display: 'flex', flex: 1, gap: '24px', minHeight: 0 }}>
        <InputSection onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />

        {isAnalyzing ? (
          <div className="glass-panel animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            <Loader2 size={48} color="var(--accent-color)" style={{ animation: 'spin 1.2s linear infinite', marginBottom: '20px' }} />
            <h2 style={{ margin: '0 0 8px', fontSize: '20px', color: 'var(--text-primary)' }}>{isLlmMode ? 'Gemini 의미론적 검증 진행 중...' : 'AI 검증 진행 중...'}</h2>
            <p style={{ margin: 0, fontSize: '14px' }}>{isLlmMode ? '최적의 최신 모델(Gemini 3 Flash 등)이 문맥과 의미를 깊이 있게 분석하고 있습니다. (최대 10~20초 소요)' : '입력된 문서를 분석하고 있습니다.'}</p>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : resultData ? (
          <ResultDashboard data={resultData} />
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
      </main>
    </div>
  );
}

export default App;
