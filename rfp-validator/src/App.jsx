import React, { useState, useEffect, useCallback } from 'react';
import DocumentValidator from './components/DocumentValidator';
import TypoValidator from './components/TypoValidator';
import LawConsultant from './components/LawConsultant';
import ErdGenerator from './components/ErdGenerator';
import ReferenceLibrary from './components/ReferenceLibrary';
import PptGenerator from './components/PptGenerator';
import { 
  Shield, 
  Activity, 
  FileText, 
  CheckCircle2, 
  MessageSquare, 
  Database, 
  Settings, 
  Key, 
  AlertCircle, 
  Info, 
  Globe, 
  PlusCircle, 
  Menu, 
  X,
  BarChart3,
  Cpu,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { processFile } from './utils/fileExtractor';

function App() {
  const [activeTab, setActiveTab] = useState('main');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [modelUsage, setModelUsage] = useState(() => JSON.parse(localStorage.getItem('gemini_model_usage') || '{}'));
  const [showSettings, setShowSettings] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');

  // 사이드바 상태 저장
  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', isSidebarCollapsed);
  }, [isSidebarCollapsed]);

  // 로컬 스토리지 동기화
  useEffect(() => {
    localStorage.setItem('gemini_api_key', apiKey);
  }, [apiKey]);




  // 사용량 업데이트 이벤트 리스너
  useEffect(() => {
    const handleUsageUpdate = () => {
        setModelUsage(JSON.parse(localStorage.getItem('gemini_model_usage') || '{}'));
    };
    window.addEventListener('gemini_usage_updated', handleUsageUpdate);
    return () => window.removeEventListener('gemini_usage_updated', handleUsageUpdate);
  }, []);

  const tabs = [
    { id: 'main', label: 'AI 산출물 검증', icon: Shield, color: 'var(--accent-blue)' },
    { id: 'typo', label: 'AI 교정교열', icon: CheckCircle2, color: 'var(--accent-purple)' },
    { id: 'law', label: 'AI 법률 자문(제미나이)', icon: MessageSquare, color: 'var(--success-color)' },
    { id: 'law-mcp', label: 'AI 법률 자문(MCP)', icon: MessageSquare, color: 'var(--accent-purple)' },
    { id: 'erd', label: 'AI ERD 설계', icon: Database, color: 'var(--warning-color)' },
    { id: 'ppt', label: 'PPT 생성(엑셀기준)', icon: FileText, color: '#f97316' },
    { id: 'library', label: '참고자료 라이브러리', icon: Activity, color: '#64748b' },
  ];

  const activeTabData = tabs.find(t => t.id === activeTab);

  const keyCount = apiKey.split(',').filter(k => k.trim().startsWith('AIza')).length;

  return (
    <div className={`app-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-container">
            <div className="logo-icon">
              <Shield size={24} color="white" />
            </div>
            {!isSidebarCollapsed && (
              <div className="logo-text">
                <h1>건강한 프로젝트</h1>
                <span>AI 산출물 검수 v1.0</span>
              </div>
            )}
          </div>
          
          <button 
            className="sidebar-toggle-btn"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? "펼치기" : "접기"}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>

          <button className="mobile-close" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsMobileMenuOpen(false);
                }}
              >
                <div className="nav-icon-wrapper" style={{ color: isActive ? tab.color : 'inherit' }}>
                  <Icon size={20} />
                </div>
                {!isSidebarCollapsed && <span>{tab.label}</span>}
                {isActive && !isSidebarCollapsed && <div className="active-indicator" style={{ backgroundColor: tab.color }} />}
              </button>
            );
          })}
        </nav>


      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="content-header">
          <div className="header-left">
            <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <div className="breadcrumb">
              <span className="breadcrumb-parent">Validator Space</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">{activeTabData?.label}</span>
            </div>
          </div>

          <div className="header-right">
            {/* API Status Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '8px', padding: '4px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span className="mobile-hide-text" style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>API Multi-Key</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: keyCount > 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                  {keyCount} Keys Connected
                </span>
              </div>
              <div style={{ width: '32px', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(keyCount * 25, 100)}%`, height: '100%', backgroundColor: keyCount > 1 ? 'var(--success-color)' : 'var(--warning-color)' }}></div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', marginRight: '8px' }}>
              <span className="mobile-hide-text" style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Last Update</span>
              <span style={{ fontSize: '12px', color: 'var(--accent-blue)', fontWeight: 700, fontFamily: 'monospace' }}>2026. 04. 17 11:00</span>
            </div>
            
            <button 
              className={`settings-btn ${showSettings ? 'active' : ''}`} 
              onClick={() => setShowSettings(!showSettings)}
              title="API 설정 및 모델 관리"
            >
              <Settings size={20} />
            </button>
          </div>

          {/* Settings Dropdown */}
          {showSettings && (
            <div className="settings-dropdown animate-scale-in">
              <div className="settings-header">
                <Settings size={16} />
                <h3>환경 설정 및 모델 관리</h3>
              </div>
              
              <div className="settings-body">
                <div className="setting-group">
                  <label>
                    <Key size={14} /> Gemini API Keys 
                    <span className="badge">{keyCount}개</span>
                  </label>
                  <div className="input-wrapper">
                    <input 
                      type="password" 
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="AIza..., AIza... (여러 개는 콤마로 구분)"
                    />
                  </div>
                  <p className="helper-text">할당량 초과 시 자동으로 다음 키로 전환됩니다.</p>
                </div>



                <div className="setting-group usage-section">
                  <label>
                    <BarChart3 size={14} /> 모델별 누적 사용량
                  </label>
                  <div className="usage-stats">
                    {Object.keys(modelUsage).length === 0 ? (
                        <div className="no-usage">사용 기록이 없습니다.</div>
                    ) : (
                        Object.entries(modelUsage).map(([model, count]) => (
                            <div key={model} className="usage-item">
                                <span className="model-name">{model.split('/').pop()}</span>
                                <span className="use-count">{count}회</span>
                            </div>
                        ))
                    )}
                  </div>
                  {Object.keys(modelUsage).length > 0 && (
                      <button 
                        className="reset-usage-btn"
                        onClick={() => {
                            if(window.confirm('사용 통계를 초기화하시겠습니까?')) {
                                localStorage.removeItem('gemini_model_usage');
                                setModelUsage({});
                            }
                        }}
                      >통계 초기화</button>
                  )}
                </div>
              </div>
            </div>
          )}
        </header>

        <div className="content-body">
          {activeTab === 'main' && <DocumentValidator apiKey={apiKey} />}
          {activeTab === 'typo' && <TypoValidator apiKey={apiKey} />}
          {activeTab === 'law' && <LawConsultant apiKey={apiKey} isMcpMode={false} />}
          {activeTab === 'law-mcp' && <LawConsultant apiKey={apiKey} isMcpMode={true} />}
          {activeTab === 'erd' && <ErdGenerator apiKey={apiKey} />}
          {activeTab === 'ppt' && <PptGenerator apiKey={apiKey} />}
          {activeTab === 'library' && <ReferenceLibrary />}
        </div>
      </main>


    </div>
  );
}

export default App;
