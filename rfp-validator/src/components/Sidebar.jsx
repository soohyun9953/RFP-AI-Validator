import React from 'react';
import { ShieldCheck, Scale, FileText, Settings, LayoutDashboard, PenTool, Library } from 'lucide-react';

function Sidebar({ activeMenu, setActiveMenu }) {
  const menuItems = [
    { id: 'validator', label: 'AI 제안/산출물 검증', icon: <FileText size={20} /> },
    { id: 'typo', label: 'AI 문서 품질/오탈자 점검', icon: <PenTool size={20} /> },
    { id: 'law_general', label: 'AI 법률 자문 (Gemini)', icon: <Scale size={20} /> },
    { id: 'law', label: 'AI 법률 자문 (MCP)', icon: <Scale size={20} /> },
    { id: 'reference', label: '참고 자료 관리', icon: <Library size={20} /> },
  ];

  return (
    <aside className="animate-fade-in" style={{ width: '280px', flexShrink: 0, padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 10, background: 'rgba(0,0,0,0.2)', borderRight: '1px solid var(--glass-border)', backdropFilter: 'blur(10px)' }}>
      <div style={{ padding: '0 12px 40px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)', letterSpacing: '-0.5px', fontWeight: 700 }}>
          <div style={{ background: 'var(--accent-blue)', borderRadius: '8px', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)' }}>
            <LayoutDashboard size={20} color="white" />
          </div>
          PM Dashboard
        </h2>
        <p style={{ margin: '8px 0 0 42px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500, opacity: 0.8 }}>공공 프로젝트 관리 시스템</p>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ padding: '0 12px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            Workspaces
        </div>
        {menuItems.map(item => {
          const isActive = activeMenu === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveMenu(item.id)}
              className={`interactive ${isActive ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '14px 18px',
                background: isActive ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                border: `1px solid ${isActive ? 'rgba(59, 130, 246, 0.25)' : 'transparent'}`,
                borderRadius: '14px',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                fontSize: '14px',
                boxShadow: isActive ? '0 4px 12px rgba(0, 0, 0, 0.2)' : 'none'
              }}
            >
              <div style={{ 
                color: isActive ? 'var(--accent-blue)' : 'inherit',
                transition: 'all 0.3s'
              }}>{item.icon}</div>
              {item.label}
            </button>
          )
        })}
      </nav>

      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--glass-border)', paddingTop: '24px' }}>
        <button
          className="interactive"
          style={{
            display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px',
            background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'not-allowed', opacity: 0.5,
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
