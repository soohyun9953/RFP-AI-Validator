import React, { useState, useEffect } from 'react';
import './index.css';
import ReferenceLibrary from './components/ReferenceLibrary';
import { ShieldCheck, Key, HelpCircle, X, BookOpen, Fingerprint, PenTool, Scale, Library, Info, Clock, Trash2, ArrowUpRight, FileText, ExternalLink } from 'lucide-react';
import { Analytics } from "@vercel/analytics/react";
import Sidebar from './components/Sidebar';
import DocumentValidator from './components/DocumentValidator';
import TypoValidator from './components/TypoValidator';
import LawConsultant from './components/LawConsultant';

function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [activeMenu, setActiveMenu] = useState('validator'); // 'validator' or 'law'
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [refModal, setRefModal] = useState({ open: false, title: '', content: '', blob: null, ext: '', filename: '' });

  // ... (useEffect for open_reference_modal remains the same) ...
  useEffect(() => {
    const handleOpenRef = (e) => {
        setRefModal({ 
            open: true, 
            title: e.detail.title, 
            content: e.detail.content,
            blob: e.detail.blob,
            ext: e.detail.ext,
            filename: e.detail.filename
        });
    };
    window.addEventListener('open_reference_modal', handleOpenRef);
    return () => window.removeEventListener('open_reference_modal', handleOpenRef);
  }, []);

  useEffect(() => {
    localStorage.setItem('gemini_api_key', apiKey);
  }, [apiKey]);

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--bg-dark)', overflow: 'hidden', position: 'relative' }}>
      {/* Subtle Background Glows */}
      <div className="bg-glow-container" style={{ opacity: 0.4 }}>
        <div className="glow-blob" style={{ background: 'var(--accent-purple)', top: '20%', right: '10%', filter: 'blur(150px)', opacity: 0.1 }}></div>
      </div>

      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 32px', gap: '24px', position: 'relative', zIndex: 1, background: 'var(--bg-dark)' }}>
        <header className="glass-panel animate-slide-up" style={{ padding: '24px 32px', display: 'flex', alignItems: 'center', gap: '20px', flexShrink: 0, border: '1px solid var(--glass-border)' }}>
          {activeMenu === 'validator' ? (
            <ShieldCheck size={36} color="var(--accent-purple)" />
          ) : activeMenu === 'typo' ? (
            <PenTool size={36} color="var(--accent-blue)" />
          ) : activeMenu === 'law' || activeMenu === 'law_general' ? (
            <Fingerprint size={36} color="var(--accent-purple)" />
          ) : (
            <Library size={36} color="var(--accent-blue)" />
          )}
          <div style={{ flex: 1 }}>
            <h1 key={`title-${activeMenu}`} className="animate-fade-in" style={{ margin: 0, fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
              {activeMenu === 'validator' ? 'AI Document Validator' 
                : activeMenu === 'typo' ? 'AI Quality & Typo Checker' 
                : activeMenu === 'law' ? 'AI Legal & Compliance Advisor (MCP)' 
                : activeMenu === 'reference' ? 'Reference Library Management'
                : 'AI Legal Advisor (Gemini)'}
            </h1>
            <p key={`desc-${activeMenu}`} className="animate-fade-in" style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '14px', animationDelay: '0.1s' }}>
              {activeMenu === 'validator' 
                ? '수석 감리 전문가 - 다단계 산출물 및 기준문서 자동 검증 시스템'
                : activeMenu === 'typo'
                ? '교정교열 전문가 - 산출물 품질 점검 및 다층 로직/오탈자 검증'
                : activeMenu === 'law'
                ? '공공사업 PM 특화 - 소프트웨어 진흥법 및 국가계약법 실시간 자문'
                : activeMenu === 'reference'
                ? '사용자 등록 문서 보관소 - AI 답변 및 검토의 객관적 근거가 되는 참고자료 관리'
                : '지식 기반 자문 - Gemini의 내부 지식을 이용한 빠른 규정 검토'}
            </p>
          </div>
          <button 
              onClick={() => setIsManualOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '8px 16px', borderRadius: '10px', color: 'var(--accent-purple)', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600, fontSize: '13px' }}>
              <BookOpen size={16} /> 간단 사용 방법
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '8px 16px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
            <Key size={16} color="var(--text-muted)" />
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
            {apiKey && apiKey.startsWith('AIza') && <span style={{ fontSize: '11px', color: 'var(--accent-purple)', fontWeight: 600 }}>LLM 활성</span>}
          </div>
        </header>

        <main style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
          <div className={`page-container ${activeMenu === 'validator' ? 'active' : 'inactive'}`}>
            <DocumentValidator apiKey={apiKey} />
          </div>
          <div className={`page-container ${activeMenu === 'typo' ? 'active' : 'inactive'}`}>
            <TypoValidator apiKey={apiKey} />
          </div>
          <div className={`page-container ${activeMenu === 'law' ? 'active' : 'inactive'}`}>
            <LawConsultant key="mcp-advisor" apiKey={apiKey} isMcpMode={true} />
          </div>
          <div className={`page-container ${activeMenu === 'law_general' ? 'active' : 'inactive'}`}>
            <LawConsultant key="general-advisor" apiKey={apiKey} isMcpMode={false} />
          </div>
          <div className={`page-container ${activeMenu === 'reference' ? 'active' : 'inactive'}`}>
            <ReferenceLibrary />
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
                      <h3 style={{ color: 'var(--text-primary)', marginTop: 0, fontSize: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>📌 PM Dashboard 4대 핵심 기능</h3>
                      <p>본 시스템은 IT 프로젝트 PM의 업무 효율을 극대화하기 위해 설계된 통합 관리 도구입니다.</p>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '10px', border: '1px solid var(--panel-border)' }}>
                              <h4 style={{ color: 'var(--success-color)', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }}><ShieldCheck size={18} /> 1. AI 제안/산출물 검증</h4>
                              <p style={{ margin: 0, fontSize: '13px' }}><strong>기준 문서(RFP)</strong>와 <strong>산출물</strong>을 비교하여 요구사항 누락 여부와 정합성을 문장 단위로 정밀 분석합니다. RTM(추적행렬)이 자동 생성됩니다.</p>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '10px', border: '1px solid var(--panel-border)' }}>
                              <h4 style={{ color: 'var(--warning-color)', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }}><PenTool size={18} /> 2. AI 품질/오탈자 점검</h4>
                              <p style={{ margin: 0, fontSize: '13px' }}>전문 <strong>교정교열</strong> 엔진이 문맥상의 오류, 비문, 오탈자뿐만 아니라 공공기관 특유의 '개조식 문체' 적합성까지 한 번에 점검합니다.</p>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '10px', border: '1px solid var(--panel-border)' }}>
                              <h4 style={{ color: 'var(--success-color)', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }}><Scale size={18} /> 3. AI 법률 자문 (Gemini)</h4>
                              <p style={{ margin: 0, fontSize: '13px' }}>Gemini의 방대한 내부 지식을 사용하여 <strong>빠르고 가볍게</strong> 규정을 검토합니다. 일상적인 가이드라인이나 일반적인 지식 검색에 최적화되어 있습니다.</p>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '10px', border: '1px solid var(--panel-border)' }}>
                              <h4 style={{ color: 'var(--accent-color)', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }}><Fingerprint size={18} /> 4. AI 법률 자문 (MCP)</h4>
                              <p style={{ margin: 0, fontSize: '13px' }}><strong>국가계약법, 소진법</strong> 등 실시간 법령 정보를 직접 조회하여 답변합니다. PM 업무 중 발생하는 법적 쟁점에 대해 가장 정확한 근거를 제공합니다.</p>
                          </div>
                      </div>

                      <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)', marginTop: '20px' }}>
                          <h4 style={{ color: 'var(--accent-color)', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: '8px' }}><Library size={20} /> 5. 참고 자료/가이드 관리 (사용자 등록)</h4>
                          <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: 500 }}>
                              법령정보센터에 없는 <strong>특수 가이드, 사업 매뉴얼, 지침서</strong> 등을 직접 등록하세요.
                          </p>
                          <ul style={{ paddingLeft: '20px', marginTop: '10px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <li>등록된 문서의 제목이 AI 답변 중에 나오면 링크 클릭 시 사용자가 등록한 <strong>내용을 우선적</strong>으로 보여줍니다.</li>
                              <li>PDF 링크(URL)나 텍스트 본문(팝업) 중 선택하여 등록할 수 있습니다.</li>
                          </ul>
                      </div>

                      <h3 style={{ color: 'var(--text-primary)', marginTop: '32px', fontSize: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>🔍 공통 필수 사항 (API 키)</h3>
                      <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                          <li>
                              모든 기능을 사용하려면 우측 상단 키 입력란에 <strong>Google Gemini API Key</strong>를 반드시 입력해야 합니다.<br/>
                              <span style={{ fontSize: '13px', color: 'var(--accent-color)' }}>※ API 키는 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'underline' }}>구글 AI 스튜디오</a>에서 무료로 발급받을 수 있습니다.</span>
                          </li>
                      </ul>
                  </div>
              </div>
          </div>
        )}
        {/* 참고 문서 내용 표시용 통합 모달 */}
        {refModal.open && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
              <div className="glass-panel animate-fade-in" style={{ width: '95vw', height: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', border: '1px solid var(--panel-border)', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 1)' }}>
                  {/* Header */}
                  <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--panel-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Library size={24} color="var(--accent-color)" />
                          <div>
                              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', fontWeight: 700 }}>{refModal.title}</h3>
                              {refModal.filename && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{refModal.filename}</span>}
                          </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <button 
                              onClick={() => {
                                  if (refModal.blob) {
                                      window.open(URL.createObjectURL(refModal.blob), '_blank');
                                  } else {
                                      const newWin = window.open('', '_blank');
                                      if (newWin) {
                                          newWin.document.write(`<pre style="white-space: pre-wrap; font-family: sans-serif; padding: 20px;">${refModal.content}</pre>`);
                                          newWin.document.title = refModal.title;
                                          newWin.document.close();
                                      }
                                  }
                              }}
                              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--panel-border)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                              <ExternalLink size={14} /> 새 탭에서 열기
                          </button>
                          {refModal.blob && (
                              <button 
                                  onClick={() => {
                                      const url = URL.createObjectURL(refModal.blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = refModal.filename || 'download';
                                      a.click();
                                      URL.revokeObjectURL(url);
                                  }}
                                  style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: 'var(--accent-color)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                              >
                                  <ArrowUpRight size={14} /> 원본 다운로드
                              </button>
                          )}
                          <button onClick={() => setRefModal({ ...refModal, open: false })} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%' }}><X size={24} /></button>
                      </div>

                  </div>

                  {/* Content Area */}
                  <div style={{ flex: 1, position: 'relative', background: '#0a0a0a', overflow: 'hidden', display: 'flex' }}>
                      {refModal.blob ? (
                          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                              {(refModal.ext === 'pdf') ? (
                                  <iframe 
                                      src={URL.createObjectURL(refModal.blob) + '#toolbar=0'} 
                                      style={{ width: '100%', height: '100%', border: 'none' }}
                                      title="PDF Viewer"
                                  />
                              ) : (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(refModal.ext)) ? (
                                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                                      <img src={URL.createObjectURL(refModal.blob)} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--panel-border)' }} />
                                  </div>
                              ) : (
                                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                      <div style={{ padding: '20px 32px', background: 'rgba(59, 130, 246, 0.05)', borderBottom: '1px solid var(--panel-border)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                          ⚠️ 해당 파일 형식은 브라우저에서 직접 볼 수 없어 텍스트 미리보기를 표시합니다. 상단의 버튼을 통해 원본을 다운로드할 수 있습니다.
                                      </div>
                                      <div style={{ flex: 1, padding: '32px', overflowY: 'auto', color: 'var(--text-primary)', lineHeight: '1.8', fontSize: '15px', whiteSpace: 'pre-wrap' }}>
                                          {refModal.content}
                                      </div>
                                  </div>
                              )}
                          </div>
                      ) : (
                          <div style={{ flex: 1, padding: '40px', overflowY: 'auto', color: 'var(--text-primary)', lineHeight: '1.8', fontSize: '16px', whiteSpace: 'pre-wrap', background: 'var(--bg-primary)' }}>
                              {refModal.content}
                          </div>
                      )}
                  </div>

                  {/* Footer */}
                  <div style={{ padding: '16px 32px', borderTop: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.2)' }}>
                      <button onClick={() => setRefModal({ ...refModal, open: false })} style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '12px 32px', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '15px' }}>문서 닫기</button>
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
