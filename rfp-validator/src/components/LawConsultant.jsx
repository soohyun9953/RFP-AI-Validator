import React, { useState, useRef, useEffect } from 'react';
import { Send, Scale, User, Bot, Loader2, Sparkles, X, Copy, Check } from 'lucide-react';
import { askLawAssistant, askGeneralLawAssistant } from '../lawAnalyzer';

const renderMessageWithLawHighlight = (text) => {
    if (!text) return null;
    // 「법령명」 또는 제O조(의O) 제O항 패턴, 그리고 「」없이 나오는 한글 법령명도 폴백으로 인식
    const regex = /(「[^」]+」|[가-힣]{2,10}(?:기본법|진흥법|보호법|계약법|촉진법|이용법|관리법|처리법|지원법|특별법|처벌법|에관한법률|에관한특별법|하도급법|조례|훈령|규칙|지침|고시|예규)|제\d+조(?:의\d+)?(?:\s?제\d+항)?(?:의\d+)?)/g;
    const parts = text.split(regex);
    
    return parts.map((part, i) => {
        const isLawName = part.match(/^「[^」]+」$/) || part.match(/^[가-힣]{2,10}(?:기본법|진흥법|보호법|계약법|촉진법|이용법|관리법|처리법|지원법|특별법|처벌법|에관한법률|에관한특별법|하도급법|조례|훈령|규칙|지침|고시|예규)$/);
        const isClause = part.match(/^제\d+조(?:의\d+)?(?:\s?제\d+항)?(?:의\d+)?$/);

        if (isLawName || isClause) {
            const cleanQuery = encodeURIComponent(part.replace(/[「」]/g, '').trim());
            const isClickable = !!isLawName;
            
            return (
                <span key={i} style={{
                    background: isClickable ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: isClickable ? '#60a5fa' : '#34d399',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    margin: '0 2px',
                    cursor: isClickable ? 'pointer' : 'default',
                    border: `1px solid ${isClickable ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                    transition: 'all 0.2s',
                }} 
                title={isClickable ? `${part} 국가법령정보센터에서 법령표 검색` : '해당 법령 내 조항 번호'}
                onClick={() => {
                    if (isClickable) {
                        const rawName = part.replace(/[「」]/g, '').trim();
                        // 국가법령정보센터의 직접 링크(Friendly URL)는 공백이 없어야 정확히 이동함
                        const cleanNameForLink = rawName.replace(/\s/g, '');
                        let path = '법령';
                        
                        // 지침, 고시, 훈령, 예규 등은 행정규칙으로 분류
                        if (rawName.endsWith('지침') || rawName.endsWith('고시') || rawName.endsWith('훈령') || rawName.endsWith('예규') || rawName.endsWith('규정')) {
                            path = '행정규칙';
                        } else if (rawName.endsWith('조례')) {
                            path = '조례';
                        }
                        
                        window.open(`https://www.law.go.kr/${path}/${encodeURIComponent(cleanNameForLink)}`, '_blank');
                    }
                }}
                onMouseOver={(e) => { 
                    if (isClickable) {
                        e.target.style.background = 'rgba(59, 130, 246, 0.3)'; 
                        e.target.style.textDecoration = 'underline'; 
                    }
                }}
                onMouseOut={(e) => { 
                    if (isClickable) {
                        e.target.style.background = 'rgba(59, 130, 246, 0.15)'; 
                        e.target.style.textDecoration = 'none'; 
                    }
                }}
                >
                    {part}
                </span>
            );
        }
        return <span key={i}>{part}</span>;
    });
};

function LawConsultant({ apiKey, isMcpMode = true }) {
  const [messages, setMessages] = useState([
    { role: 'model', text: isMcpMode 
        ? '안녕하세요! 실시간 법령 조회가 가능한 [MCP 기반] AI 법률 자문입니다.\n\n지능형 검색 도구를 사용하여 최신 법령을 직접 조회하고 답변해 드립니다.\n(※ MCP 모드는 정확한 검색을 위해 여러 번의 AI 호출이 발생하여 토큰 소모량이 많을 수 있습니다.)'
        : '안녕하세요! [일반 지식 기반] AI 법률 자문입니다.\n\n실시간 검색 없이 Gemini의 내부 지식만으로 빠르게 답변해 드립니다. 가벼운 규정 확인에 적합하며 토큰 사용이 경제적입니다.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mcpQueryStatus, setMcpQueryStatus] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    if (!apiKey || !apiKey.startsWith('AIza')) {
        alert("유효한 Gemini API Key를 우측 상단에 입력해 주세요.");
        return;
    }

    const userMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setMcpQueryStatus(null);

    try {
      let responseText = "";
      if (isMcpMode) {
        responseText = await askLawAssistant(userMessage.text, apiKey, messages, (keyword) => {
          setMcpQueryStatus(`LexGuard MCP에서 '${keyword}' 관련 실시간 법령 조회 중...`);
        });
      } else {
        responseText = await askGeneralLawAssistant(userMessage.text, apiKey, messages);
      }
      const botMessage = { role: 'model', text: responseText };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: `오류가 발생했습니다: ${error.message}` }]);
    } finally {
      setIsLoading(false);
      setMcpQueryStatus(null);
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', border: '1px solid var(--panel-border)', borderRadius: '12px' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--panel-border)', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        {isMcpMode ? <Scale size={24} color="var(--accent-color)" /> : <Sparkles size={24} color="var(--success-color)" />}
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>
            {isMcpMode ? 'AI 법률/규정 자문 에이전트 (MCP)' : 'AI 법률/규정 일반 자문 (Gemini)'}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            {isMcpMode ? '한국 법령(korean-law-mcp) 기반 실무 검토 및 해설' : '실시간 검색 없는 Gemini 내부 지식 기반 빠른 해설'}
            {isMcpMode && <span style={{ marginLeft: '10px', color: '#f87171', fontWeight: 600, fontSize: '11px' }}>※ 실시간 검색 시 토큰 소모량이 많을 수 있음</span>}
          </p>
        </div>
        <button
          onClick={() => {
            if (window.confirm('대화 내역을 모두 삭제하고 초기화하시겠습니까?')) {
              setMessages([{
                role: 'model',
                text: isMcpMode
                  ? '안녕하세요! 실시간 법령 조회가 가능한 [MCP 기반] AI 법률 자문입니다.\n\n지능형 검색 도구를 사용하여 최신 법령을 직접 조회하고 답변해 드립니다.\n(예시: "소프트웨어 진흥법 상 대기업 참여제한 예외 사유 알려줘")'
                  : '안녕하세요! [일반 지식 기반] AI 법률 자문입니다.\n\n실시간 검색 없이 Gemini의 내부 지식만으로 빠르게 답변해 드립니다. 가벼운 규정 확인에 적합합니다.'
              }]);
            }
          }}
          style={{
            marginLeft: 'auto',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '6px 12px',
            borderRadius: '6px',
            color: 'var(--danger-color)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
        >
          <X size={14} /> 대화 초기화
        </button>
      </div>

      {/* Message List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '16px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
            <div style={{ 
                width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: msg.role === 'user' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                color: msg.role === 'user' ? 'var(--accent-color)' : 'var(--text-primary)'
             }}>
                {msg.role === 'user' ? <User size={20} /> : <Bot size={20} color="var(--success-color)" />}
            </div>
            <div style={{
                background: msg.role === 'user' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0, 0, 0, 0.2)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(59, 130, 246, 0.3)' : 'var(--panel-border)'}`,
                padding: '16px', borderRadius: '12px', maxWidth: '80%', lineHeight: '1.6', fontSize: '14px', color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap', position: 'relative', group: 'true'
            }}>
                {msg.role === 'model' ? renderMessageWithLawHighlight(msg.text) : msg.text}
                
                {msg.role === 'model' && (
                  <button
                    onClick={() => handleCopy(msg.text, idx)}
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      background: 'rgba(255, 255, 255, 0.15)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      color: copiedId === idx ? 'var(--success-color)' : 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: 'all 0.2s',
                      opacity: 1,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      zIndex: 10,
                      fontSize: '11px',
                      fontWeight: 600
                    }}
                    title="답변 복사"
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {copiedId === idx ? <Check size={12} /> : <Copy size={12} />}
                    {copiedId === idx ? '복사됨' : '복사'}
                  </button>
                )}
            </div>
          </div>
        ))}
        {isLoading && (
            <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 255, 255, 0.1)' }}>
                    <Bot size={20} color="var(--success-color)" />
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Loader2 size={16} color="var(--accent-color)" style={{ animation: 'spin 1.2s linear infinite', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{mcpQueryStatus || 'Gemini가 답변을 생성하는 중...'}</span>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ padding: '20px', borderTop: '1px solid var(--panel-border)', background: 'rgba(0,0,0,0.1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '12px', background: 'var(--bg-primary)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
            <input 
                type="text" 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="어떤 지침에 대해 궁금하신가요? (예: 과업변경심의위원회를 개최하려면 조건이 있나요?)"
                style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '14px' }}
                disabled={isLoading}
            />
            <button 
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                style={{ 
                    background: 'var(--accent-color)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', 
                    cursor: (isLoading || !input.trim()) ? 'not-allowed' : 'pointer', opacity: (isLoading || !input.trim()) ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px', transition: 'all 0.2s'
                }}
            >
                <Send size={16} /> 질문하기
            </button>
        </div>
        <p style={{ margin: '8px 0 0 4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            * AI를 통해 실무 보조용 법적 정보를 제공하며, 실제 법적 효력을 갖는 공식 유권해석은 아닙니다.
        </p>
      </div>
    </div>
  );
}

export default LawConsultant;
