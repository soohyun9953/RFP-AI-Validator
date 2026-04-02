import React, { useState, useCallback, useEffect } from 'react';
import './index.css';
import { ShieldCheck, ArrowRight, Loader2, Key, HelpCircle, X, BookOpen } from 'lucide-react';
import { Analytics } from "@vercel/analytics/react";
import InputSection from './components/InputSection';
import ResultDashboard from './components/ResultDashboard';
import { analyzeDocuments } from './mockAnalyzer';
import { analyzeDocumentsWithLLM } from './llmAnalyzer';

function App() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [isLlmMode, setIsLlmMode] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('gemini_api_key', apiKey);
  }, [apiKey]);

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
            console.error('[App] 분석 오류:', e);
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
        console.error('[App] LLM 분석 오류:', e);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '24px', gap: '20px', overflow: 'hidden' }}>
      <header className="glass-panel" style={{ padding: '20px 30px', display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
        <ShieldCheck size={36} color="var(--success-color)" />
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, letterSpacing: '-0.5px' }}>AI Document Validator</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
            수석 감리 전문가 - 다단계 산출물 및 기준문서 자동 검증 시스템
          </p>
        </div>
        <button 
            onClick={() => setIsManualOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '8px 16px', borderRadius: '8px', color: 'var(--accent-color)', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600, fontSize: '13px' }}>
            <BookOpen size={16} /> 간단 사용 방법
        </button>
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
      {isManualOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div className="glass-panel animate-fade-in" style={{ width: '800px', maxWidth: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', border: '1px solid var(--panel-border)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
               <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--panel-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)' }}>
                   <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}><HelpCircle size={20} color="var(--accent-color)" /> AI 자동 검증 시스템 간단 사용 방법</h2>
                   <button onClick={() => setIsManualOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
               </div>
               <div style={{ padding: '24px 32px', overflowY: 'auto', flex: 1, color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '14px' }}>
                   <h3 style={{ color: 'var(--text-primary)', marginTop: 0, fontSize: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>📌 개요</h3>
                   <p>본 시스템은 공공 및 기업의 IT 프로젝트 제안요청서(RFP), ISMP, 산출물 등의 품질을 수석 감리원 수준으로 자동 점검하는 AI 도구입니다.</p>
                   
                   <h3 style={{ color: 'var(--text-primary)', marginTop: '24px', fontSize: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>📝 사용 방법 (데이터 입력 4단계)</h3>
                   <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                       <li><strong>1. 기준 문서 (필수/선택) :</strong> 타겟 산출물을 평가하기 위한 원본 기준(제안요청서, 요구사항 정의서 등)을 업로드합니다. (단순 맞춤법/교정교열이 목적일 경우 비워두셔도 됩니다.)</li>
                       <li><strong>2. 대상 산출물 (필수) :</strong> 검증 대상이 되는 실제 작성 문서 텍스트나 파일을 업로드합니다.</li>
                       <li><strong>3. 프로젝트 용어 사전 (선택) :</strong> 프로젝트에서 사용하기로 확정된 도메인 전문 용어 사전을 넣으시면 AI가 이를 완벽한 최우선 잣대로 삼아 오기재된 용어나 표기법을 전부 적발합니다.</li>
                       <li><strong>4. 점검 범위 (선택) :</strong> <em>"보안 파트 위주로 논리성을 검증해줘"</em> 와 같이 추가적인 중점 지시사항이나 특정 섹션을 AI에게 강력하게 지시할 수 있습니다.</li>
                   </ul>

                   <h3 style={{ color: 'var(--text-primary)', marginTop: '24px', fontSize: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>🔍 결과 분석 및 엑셀 리포트 추출</h3>
                   <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                       <li>
                           LLM(인공지능) 기능 활성화를 위해 우측 상단 키 입력란에 <strong>Google Gemini API Key</strong>를 반드시 입력해야 합니다.<br/>
                           <span style={{ fontSize: '13px', color: 'var(--accent-color)' }}>※ API 키는 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'underline' }}>구글 AI 스튜디오(Google AI Studio)</a>에서 무료로 발급받을 수 있습니다.</span>
                       </li>
                       <li>약 10초~20초 뒤, 우측 결과 대시보드에 문서 전체의 요구사항 준수율 현황과 각 문장별 <strong>오탈자 / 논리 오류 표</strong>가 나타납니다.</li>
                       <li>우측 상단의 <strong>[결과 엑셀 저장]</strong>을 클릭하면 원본 데이터 레이아웃에 맞춰 원문, 수정 제안, 사유가 담긴 엑셀 보고서(.xlsx)가 즉각적으로 컴퓨터에 다운로드됩니다.</li>
                   </ul>
               </div>
            </div>
        </div>
      )}
      <Analytics />
    </div>
  );
}

export default App;
