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
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('selected_model') || 'auto');
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


  useEffect(() => {
    localStorage.setItem('selected_model', selectedModel);
  }, [selectedModel]);

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
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
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

        <div className="sidebar-footer">
            <div className="quota-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>가용 API 키</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: keyCount > 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                        {keyCount}개 연결됨
                    </span>
                </div>
                <div className="quota-bar">
                    <div className="quota-fill" style={{ width: `${Math.min(keyCount * 25, 100)}%`, backgroundColor: keyCount > 1 ? 'var(--success-color)' : 'var(--warning-color)' }}></div>
                </div>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.4' }}>
                    {keyCount > 1 ? '멀티 키 로테이션이 활성화되었습니다. 할당량을 자동 관리합니다.' : 'API 키를 콤마(,)로 구분하여 추가 등록하면 할당량 문제를 예방할 수 있습니다.'}
                </p>
            </div>
        </div>
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

                <div className="divider"></div>

                <div className="setting-group">
                  <label>
                    <Cpu size={14} /> 분석 모델 선택
                  </label>
                  <select 
                    value={selectedModel} 
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="model-select"
                  >
                    <option value="models/gemini-3-flash-preview">Gemini 3 Flash (최신 프리뷰)</option>
                    <option value="models/gemini-2.0-flash">Gemini 2.0 Flash (속도 최상)</option>
                    <option value="models/gemini-1.5-flash-latest">Gemini 1.5 Flash (안정적)</option>
                    <option value="models/gemini-1.5-pro-latest">Gemini 1.5 Pro (높은 품질)</option>
                  </select>
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
          {activeTab === 'main' && <DocumentValidator apiKey={apiKey} selectedModel={selectedModel} />}
          {activeTab === 'typo' && <TypoValidator apiKey={apiKey} selectedModel={selectedModel} />}
          {activeTab === 'law' && <LawConsultant apiKey={apiKey} selectedModel={selectedModel} isMcpMode={false} />}
          {activeTab === 'law-mcp' && <LawConsultant apiKey={apiKey} selectedModel={selectedModel} isMcpMode={true} />}
          {activeTab === 'erd' && <ErdGenerator apiKey={apiKey} selectedModel={selectedModel} />}
          {activeTab === 'ppt' && <PptGenerator apiKey={apiKey} />}
          {activeTab === 'library' && <ReferenceLibrary />}
        </div>
      </main>


    </div>
  );
}

export default App;
