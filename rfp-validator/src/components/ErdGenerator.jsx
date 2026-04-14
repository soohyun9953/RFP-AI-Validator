import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Database, Download, FileText, Upload, Loader2, Play, CheckCircle2, AlertCircle, Info, Trash2, X, ChevronDown, Code2, BarChart3, BookOpen, Eye, Copy, Check } from 'lucide-react';
import mermaid from 'mermaid';
import { analyzeERDWithLLM } from '../erdAnalyzer';
import { processFile, ALL_ACCEPT } from '../utils/fileExtractor';

// ── Mermaid 다이어그램 렌더러 ──────────────────────────────────
const MermaidDiagram = ({ chart }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (chart && containerRef.current) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
        er: { useMaxWidth: true, fontSize: 14 }
      });
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      try {
        mermaid.render(id, chart).then(({ svg }) => {
          if (containerRef.current) containerRef.current.innerHTML = svg;
        });
      } catch (e) {
        if (containerRef.current)
          containerRef.current.innerHTML = `<div style="color:var(--danger-color);padding:20px;">다이어그램 렌더링 오류가 발생했습니다.</div>`;
      }
    }
  }, [chart]);

  return (
    <div ref={containerRef}
      style={{ width: '100%', overflowX: 'auto', background: 'rgba(0,0,0,0.2)',
        borderRadius: '12px', padding: '20px', display: 'flex',
        justifyContent: 'center', minHeight: '300px' }}
    />
  );
};

// ── JSON 원문 뷰어 모달 ────────────────────────────────────────
const JsonViewerModal = ({ data, onClose }) => {
  const [copied, setCopied] = useState(false);
  const jsonStr = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '90vw', maxWidth: '1000px', height: '85vh',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-secondary)', border: '1px solid var(--panel-border)',
        borderRadius: '20px', overflow: 'hidden',
        boxShadow: '0 30px 60px rgba(0,0,0,0.8)'
      }}>
        {/* 모달 헤더 */}
        <div style={{
          padding: '20px 28px', borderBottom: '1px solid var(--panel-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Code2 size={22} color="var(--accent-purple)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>ERD 설계 결과 원문 (JSON)</h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                mermaidCode · entities · relationships · normalizationNotes 포함
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={handleCopy} className="interactive" style={{
              padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--panel-border)',
              background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
              color: copied ? 'var(--success-color)' : 'var(--text-primary)',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
            }}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? '복사 완료!' : '전체 복사'}
            </button>
            <button onClick={() => {
              const blob = new Blob([jsonStr], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `ERD_Design_${new Date().toISOString().split('T')[0]}.json`;
              a.click();
            }} className="interactive" style={{
              padding: '8px 16px', borderRadius: '8px',
              background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)',
              color: 'var(--accent-purple)', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              <Download size={14} /> JSON 다운로드
            </button>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--panel-border)',
              color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px',
              borderRadius: '8px', display: 'flex', alignItems: 'center'
            }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* JSON 본문 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
          <pre style={{
            margin: 0, padding: '24px 28px', fontFamily: "'Fira Code', 'Consolas', monospace",
            fontSize: '13px', lineHeight: '1.7', color: '#e2e8f0',
            background: '#0d1117', height: '100%', overflowY: 'auto'
          }}>
            {/* 간단한 구문 강조를 위해 파트별로 분리 */}
            {jsonStr.split('\n').map((line, i) => {
              const keyMatch = line.match(/^(\s*)"([^"]+)":/);
              const strMatch = line.match(/:\s*"(.+)"[,]?$/);
              const numMatch = line.match(/:\s*(\d+)[,]?$/);

              if (keyMatch) {
                return (
                  <div key={i}>
                    <span style={{ color: '#6b8cff' }}>{line.match(/^\s*/)[0]}</span>
                    <span style={{ color: '#79c0ff' }}>"{keyMatch[2]}"</span>
                    <span style={{ color: '#c9d1d9' }}>: </span>
                    <span style={{ color: strMatch ? '#a5d6ff' : numMatch ? '#f8a261' : '#c9d1d9' }}>
                      {line.slice(keyMatch[0].length)}
                    </span>
                  </div>
                );
              }
              return <div key={i}><span style={{ color: '#c9d1d9' }}>{line}</span></div>;
            })}
          </pre>
        </div>
      </div>
    </div>
  );
};

// ── 결과 탭 뷰 ────────────────────────────────────────────────
const ResultSection = ({ result, onOpenJsonViewer }) => {
  const [activeTab, setActiveTab] = useState('diagram');
  const [copied, setCopied] = useState(false);

  const tabs = [
    { id: 'diagram', label: 'ERD 다이어그램', icon: BarChart3 },
    { id: 'entities', label: '엔티티 & 속성 명세', icon: Database },
    { id: 'relations', label: '관계 & 정규화', icon: BookOpen },
    { id: 'source', label: 'Mermaid 소스', icon: Code2 },
  ];

  const handleCopyMermaid = () => {
    navigator.clipboard.writeText(result.mermaidCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="animate-slide-up glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 탭 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0px 24px', borderBottom: '1px solid var(--panel-border)',
        background: 'rgba(0,0,0,0.2)', flexShrink: 0
      }}>
        <div style={{ display: 'flex' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="interactive" style={{
                padding: '16px 20px', background: 'transparent',
                border: 'none', borderBottom: isActive ? '2px solid var(--accent-purple)' : '2px solid transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500, fontSize: '13px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '7px',
                transition: 'all 0.2s', marginBottom: '-1px'
              }}>
                <Icon size={15} color={isActive ? 'var(--accent-purple)' : 'inherit'} />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onOpenJsonViewer} className="interactive" style={{
            padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(168,85,247,0.3)',
            background: 'rgba(168,85,247,0.08)', color: 'var(--accent-purple)',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <Eye size={14} /> JSON 원문 보기
          </button>
          <button onClick={() => {
            const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ERD_Design_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
          }} className="interactive" style={{
            padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--panel-border)',
            background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <Download size={14} /> JSON 저장
          </button>
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>

        {/* ── 탭 1: ERD 다이어그램 ── */}
        {activeTab === 'diagram' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <MermaidDiagram chart={result.mermaidCode} />
            <div style={{
              padding: '16px 20px', background: 'rgba(168,85,247,0.05)',
              borderRadius: '12px', border: '1px solid rgba(168,85,247,0.15)',
              fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.7'
            }}>
              <Info size={15} style={{ marginRight: '6px', verticalAlign: 'middle', color: 'var(--accent-purple)' }} />
              <strong style={{ color: 'var(--text-primary)' }}>설계 요약:</strong> {result.summary}
            </div>
          </div>
        )}

        {/* ── 탭 2: 엔티티 & 속성 명세 ── */}
        {activeTab === 'entities' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {result.entities.map((entity, i) => (
              <details key={i} open style={{
                background: 'rgba(255,255,255,0.02)', borderRadius: '12px',
                border: '1px solid var(--panel-border)', overflow: 'hidden'
              }}>
                <summary style={{
                  padding: '14px 18px', cursor: 'pointer', fontWeight: 700,
                  fontSize: '14px', color: 'var(--text-primary)', listStyle: 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'rgba(168,85,247,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      background: 'rgba(168,85,247,0.15)', color: 'var(--accent-purple)',
                      padding: '2px 8px', borderRadius: '5px', fontSize: '12px', fontWeight: 700
                    }}>#{i + 1}</span>
                    <span>{entity.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '13px' }}>
                      {entity.description}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--accent-blue)', fontWeight: 600 }}>
                    속성 {entity.attributes?.length ?? 0}개
                  </span>
                </summary>
                <div style={{ padding: '16px 18px', borderTop: '1px solid var(--panel-border)' }}>
                  <p style={{
                    margin: '0 0 14px', padding: '10px 14px', fontSize: '13px',
                    color: 'var(--text-secondary)', fontStyle: 'italic',
                    background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
                    borderLeft: '3px solid var(--accent-purple)'
                  }}>
                    💡 {entity.reason}
                  </p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--panel-border)' }}>속성명</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--panel-border)' }}>데이터 타입</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--panel-border)', width: '60px' }}>Key</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--panel-border)' }}>설명</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entity.attributes?.map((attr, j) => (
                        <tr key={j} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: attr.key ? 700 : 400, color: attr.key === 'PK' ? '#fbbf24' : attr.key === 'FK' ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                            {attr.name}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#a78bfa', fontSize: '12px', fontFamily: 'monospace' }}>
                            {attr.type}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {attr.key === 'PK'
                              ? <span style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>PK</span>
                              : attr.key === 'FK'
                              ? <span style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--accent-blue)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>FK</span>
                              : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>-</span>}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                            {attr.desc || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        )}

        {/* ── 탭 3: 관계 & 정규화 ── */}
        {activeTab === 'relations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h4 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={16} color="var(--accent-blue)" /> 주요 관계 정의 ({result.relationships?.length ?? 0}개)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {result.relationships?.map((rel, i) => (
                  <div key={i} style={{
                    padding: '16px 18px', background: 'rgba(255,255,255,0.02)',
                    borderRadius: '10px', borderLeft: '3px solid var(--accent-purple)',
                    border: '1px solid var(--panel-border)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{rel.from}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>→</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{rel.to}</span>
                      <span style={{
                        background: 'rgba(168,85,247,0.1)', color: 'var(--accent-purple)',
                        padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700
                      }}>{rel.type}</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
                      {rel.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} color="var(--warning-color)" /> 정규화 준수 논거
              </h4>
              <div style={{
                padding: '18px 20px', background: 'rgba(245,158,11,0.04)',
                border: '1px solid rgba(245,158,11,0.15)', borderRadius: '12px',
                fontSize: '14px', lineHeight: '1.8', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap'
              }}>
                {result.normalizationNotes}
              </div>
            </div>
          </div>
        )}

        {/* ── 탭 4: Mermaid 소스코드 ── */}
        {activeTab === 'source' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                아래 코드를 <a href="https://mermaid.live" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}>mermaid.live</a> 또는
                <a href="https://dbdiagram.io" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'underline', marginLeft: '4px' }}>dbdiagram.io</a>에 붙여넣기하면 편집할 수 있습니다.
              </p>
              <button onClick={handleCopyMermaid} className="interactive" style={{
                padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--panel-border)',
                background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                color: copied ? 'var(--success-color)' : 'var(--text-primary)',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', whiteSpace: 'nowrap'
              }}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? '복사 완료!' : '소스 복사'}
              </button>
            </div>
            <pre style={{
              margin: 0, padding: '20px 24px',
              background: '#0d1117', borderRadius: '12px',
              border: '1px solid var(--panel-border)',
              fontFamily: "'Fira Code', 'Consolas', monospace",
              fontSize: '13px', lineHeight: '1.7',
              color: '#a5d6ff', overflowX: 'auto', whiteSpace: 'pre'
            }}>
              {result.mermaidCode}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

// ── 메인 ErdGenerator 컴포넌트 ────────────────────────────────
const ErdGenerator = ({ apiKey }) => {
  const [inputText, setInputText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // ── 드래그 앤 드롭 핸들러 ──
  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDragOver  = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;
    setFileName(file.name);
    setIsLoading(true);
    setError(null);
    try {
      const text = await processFile(file);
      setInputText(text);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      setError("분석할 요구사항 내용을 입력하거나 문서를 업로드해 주세요.");
      return;
    }
    setError(null);
    setIsAnalyzing(true);
    setResult(null);
    try {
      const data = await analyzeERDWithLLM(inputText, apiKey, (msg) => setProgressMsg(msg));
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setInputText('');
    setFileName('');
    setResult(null);
    setError(null);
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px', overflowY: 'auto', paddingRight: '8px' }}>

        {/* ── 입력 섹션 ── */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Database size={20} color="var(--accent-purple)" />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>비즈니스 요구사항 입력</h3>
            </div>
            {(inputText || fileName) && (
              <button onClick={handleReset} className="interactive"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Trash2 size={14} /> 초기화
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button onClick={() => fileInputRef.current?.click()} disabled={isLoading || isAnalyzing} className="interactive"
              style={{ padding: '10px 18px', borderRadius: '10px', background: 'rgba(168,85,247,0.1)', color: 'var(--accent-purple)', border: '1px solid rgba(168,85,247,0.2)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {isLoading ? '문서 읽는 중...' : '요구사항 문서 업로드'}
            </button>
            {fileName && (
              <div style={{ fontSize: '13px', color: 'var(--success-color)', background: 'rgba(16,185,129,0.1)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={14} /> {fileName}
              </div>
            )}
            <input type="file" ref={fileInputRef} hidden accept={ALL_ACCEPT} onChange={(e) => handleFileSelect(e.target.files[0])} />
          </div>

          {/* 드래그 앤 드롭 wrapping zone */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{ position: 'relative' }}
          >
            <textarea placeholder="데이터베이스 설계의 근거가 될 비즈니스 로직, 요구사항, RFP 내용 등을 자유롭게 입력하세요. 상세할수록 정확한 모델이 도출됩니다. (파일을 이 영역에 드래그해도 됩니다)"
              value={inputText} onChange={(e) => setInputText(e.target.value)}
              style={{ width: '100%', height: '160px', background: isDragging ? 'rgba(59,130,246,0.06)' : 'rgba(0,0,0,0.2)', border: `1px solid ${isDragging ? 'var(--accent-blue)' : 'var(--panel-border)'}`, borderRadius: '12px', padding: '16px', color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.6', resize: 'none', transition: 'border-color 0.2s, background 0.2s', boxSizing: 'border-box' }}
            />
            {/* 드래그 오버레이 */}
            {isDragging && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(59,130,246,0.1)',
                border: '2px dashed var(--accent-blue)',
                borderRadius: '12px',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '10px',
                pointerEvents: 'none', backdropFilter: 'blur(2px)'
              }}>
                <Upload size={36} color="var(--accent-blue)" />
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-blue)' }}>파일을 여기에 놓으세요</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>PDF, Excel, PPTX, HWPX, TXT 지원</span>
              </div>
            )}
          </div>

          <button className="interactive" onClick={handleAnalyze}
            disabled={isAnalyzing || isLoading || !inputText.trim()}
            style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))', color: 'white', fontWeight: 700, fontSize: '16px', cursor: 'pointer', boxShadow: '0 8px 20px rgba(168,85,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: (isAnalyzing || isLoading || !inputText.trim()) ? 0.6 : 1 }}>
            {isAnalyzing ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} fill="currentColor" />}
            {isAnalyzing ? progressMsg || 'AI 분석 중...' : 'ERD 논리 모델 설계 시작'}
          </button>
        </div>

        {/* ── 에러 표시 ── */}
        {error && (
          <div className="animate-fade-in" style={{ padding: '16px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', flexShrink: 0 }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {/* ── 결과 탭 뷰 (① 탭 UI) ── */}
        {result && (
          <ResultSection result={result} onOpenJsonViewer={() => setShowJsonModal(true)} />
        )}

        {/* 하단 여백 */}
        <div style={{ height: '20px', flexShrink: 0 }} />
      </div>

      {/* ── JSON 원문 뷰어 모달 (② 팝업 JSON 뷰어) ── */}
      {showJsonModal && result && (
        <JsonViewerModal data={result} onClose={() => setShowJsonModal(false)} />
      )}
    </>
  );
};

export default ErdGenerator;
