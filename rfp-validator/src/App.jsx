import React, { useState, useEffect } from 'react';
import './index.css';
import { ShieldCheck, Key, HelpCircle, X, BookOpen, Fingerprint, PenTool, Scale } from 'lucide-react';
import { Analytics } from "@vercel/analytics/react";
import Sidebar from './components/Sidebar';
import DocumentValidator from './components/DocumentValidator';
import TypoValidator from './components/TypoValidator';
import LawConsultant from './components/LawConsultant';

function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [activeMenu, setActiveMenu] = useState('validator'); // 'validator' or 'law'
  const [isManualOpen, setIsManualOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('gemini_api_key', apiKey);
  }, [apiKey]);

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--bg-primary)', overflow: 'hidden' }}>
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px', gap: '20px' }}>
        <header className="glass-panel" style={{ padding: '20px 30px', display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
          {activeMenu === 'validator' ? (
            <ShieldCheck size={36} color="var(--success-color)" />
          ) : activeMenu === 'typo' ? (
            <PenTool size={36} color="var(--warning-color)" />
          ) : activeMenu === 'law' ? (
            <Fingerprint size={36} color="var(--accent-color)" />
          ) : (
            <Scale size={36} color="var(--success-color)" />
          )}
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, letterSpacing: '-0.5px' }}>
              {activeMenu === 'validator' ? 'AI Document Validator' : activeMenu === 'typo' ? 'AI Quality & Typo Checker' : activeMenu === 'law' ? 'AI Legal & Compliance Advisor (MCP)' : 'AI Legal Advisor (Gemini)'}
            </h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
              {activeMenu === 'validator' 
                ? '수석 감리 전문가 - 다단계 산출물 및 기준문서 자동 검증 시스템'
                : activeMenu === 'typo'
                ? '교정교열 전문가 - 산출물 품질 점검 및 다층 로직/오탈자 검증'
                : activeMenu === 'law'
                ? '공공사업 PM 특화 - 소프트웨어 진흥법 및 국가계약법 실시간 자문'
                : '지식 기반 자문 - Gemini의 내부 학습 데이터를 이용한 빠른 규정 검토'}
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
                width: '180px', fontSize: '13px'
              }}
            />
            {apiKey && apiKey.startsWith('AIza') && <span style={{ fontSize: '11px', color: 'var(--success-color)', fontWeight: 600 }}>LLM 활성</span>}
          </div>
        </header>

        <main style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
          <div style={{ display: activeMenu === 'validator' ? 'block' : 'none', height: '100%' }}>
            <DocumentValidator apiKey={apiKey} />
          </div>
          <div style={{ display: activeMenu === 'typo' ? 'block' : 'none', height: '100%' }}>
            <TypoValidator apiKey={apiKey} />
          </div>
          <div style={{ display: activeMenu === 'law' ? 'block' : 'none', height: '100%' }}>
            <LawConsultant apiKey={apiKey} isMcpMode={true} />
          </div>
          <div style={{ display: activeMenu === 'law_general' ? 'block' : 'none', height: '100%' }}>
            <LawConsultant apiKey={apiKey} isMcpMode={false} />
          </div>
        </main>

        {isManualOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
              <div className="glass-panel animate-fade-in" style={{ width: '800px', maxWidth: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', border: '1px solid var(--panel-border)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                 <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--panel-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)' }}>
                     <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}><HelpCircle size={20} color="var(--accent-color)" /> PM Dashboard 간단 사용 방법</h2>
                     <button onClick={() => setIsManualOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
                 </div>
                 <div style={{ padding: '24px 32px', overflowY: 'auto', flex: 1, color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '14px' }}>
                     <h3 style={{ color: 'var(--text-primary)', marginTop: 0, fontSize: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>📌 개요</h3>
                     <p>본 시스템은 공공 및 기업의 IT 프로젝트 PM을 위한 통합 대시보드입니다. 산출물 검증과 규정 검토를 한 곳에서 처리할 수 있습니다.</p>
                     
                     <h3 style={{ color: 'var(--text-primary)', marginTop: '24px', fontSize: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>📝 기능 1: AI 문서 검증</h3>
                     <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                         <li><strong>기준 문서 vs 대상 산출물:</strong> 우측 탭에서 문서 검증 메뉴를 클릭하고 기준 문서와 검증할 산출물을 올립니다.</li>
                         <li><strong>추적 행렬(RTM) 자동 생성:</strong> 기준 대비 누락되거나 맞춤법 틀린 부분을 AI가 10~20초 안에 찾아내어 보고합니다.</li>
                     </ul>

                     <h3 style={{ color: 'var(--text-primary)', marginTop: '24px', fontSize: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>⚖️ 기능 2: AI 법률 자문 (신규)</h3>
                     <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                         <li>좌측 메뉴에서 <strong>AI 법률 자문 (MCP)</strong> 탭을 클릭하여 챗봇을 호출합니다.</li>
                         <li>PM 업무 중 헷갈리는 국가계약법, 하도급 제약, 소프트웨어 진흥법 조항을 일상어로 물어보면 관련된 법적 근거가 포함된 해설을 받을 수 있습니다.</li>
                     </ul>

                     <h3 style={{ color: 'var(--text-primary)', marginTop: '24px', fontSize: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>🔍 공통 필수 사항 (API 키)</h3>
                     <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                         <li>
                             모든 AI 기능을 사용하려면 우측 상단 키 입력란에 <strong>Google Gemini API Key</strong>를 반드시 입력해야 합니다.<br/>
                             <span style={{ fontSize: '13px', color: 'var(--accent-color)' }}>※ API 키는 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'underline' }}>구글 AI 스튜디오</a>에서 무료로 발급받을 수 있습니다.</span>
                         </li>
                     </ul>
                 </div>
              </div>
          </div>
        )}
      </div>
      <Analytics />
    </div>
  );
}

export default App;
