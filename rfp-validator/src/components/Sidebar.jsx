import React from 'react';
import { ShieldCheck, Scale, FileText, Settings, LayoutDashboard, PenTool } from 'lucide-react';

function Sidebar({ activeMenu, setActiveMenu }) {
  const menuItems = [
    { id: 'validator', label: 'AI 제안/산출물 검증', icon: <FileText size={20} /> },
    { id: 'typo', label: 'AI 문서 품질/오탈자 점검', icon: <PenTool size={20} /> },
    { id: 'law_general', label: 'AI 법률 자문 (Gemini)', icon: <Scale size={20} /> },
    { id: 'law', label: 'AI 법률 자문 (MCP)', icon: <Scale size={20} /> },
  ];

  return (
    <aside className="glass-panel animate-fade-in" style={{ width: '260px', flexShrink: 0, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px', borderRight: '1px solid var(--panel-border)', borderRadius: '0' }}>
      <div style={{ padding: '0 8px 32px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <LayoutDashboard size={22} color="var(--accent-color)" />
          PM Dashboard
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>공공 프로젝트 관리 시스템</p>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ padding: '0 8px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
            Workspaces
        </div>
        {menuItems.map(item => {
          const isActive = activeMenu === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveMenu(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                border: `1px solid ${isActive ? 'rgba(59, 130, 246, 0.3)' : 'transparent'}`,
                borderRadius: '8px',
                color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'left',
                width: '100%',
                fontSize: '14px'
              }}
            >
              <div style={{ opacity: isActive ? 1 : 0.7 }}>{item.icon}</div>
              {item.label}
            </button>
          )
        })}
      </nav>

      <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
            background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'not-allowed', opacity: 0.5,
            textAlign: 'left', width: '100%', fontSize: '14px'
          }}
          disabled
        >
          <Settings size={20} />
          환경 설정
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
