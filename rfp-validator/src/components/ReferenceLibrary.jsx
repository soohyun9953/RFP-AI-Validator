import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ExternalLink, FileText, Info, Search, AlertCircle } from 'lucide-react';

const ReferenceLibrary = () => {
    const [docs, setDocs] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newDoc, setNewDoc] = useState({ title: '', content: '', type: 'text' });
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const savedDocs = localStorage.getItem('rfp_reference_docs');
        if (savedDocs) {
            setDocs(JSON.parse(savedDocs));
        }
    }, []);

    const saveDocs = (updatedDocs) => {
        setDocs(updatedDocs);
        localStorage.setItem('rfp_reference_docs', JSON.stringify(updatedDocs));
    };

    const handleAdd = (e) => {
        e.preventDefault();
        if (!newDoc.title.trim() || !newDoc.content.trim()) return;

        const updatedDocs = [
            ...docs,
            { ...newDoc, id: Date.now(), createdAt: new Date().toISOString() }
        ];
        saveDocs(updatedDocs);
        setNewDoc({ title: '', content: '', type: 'text' });
        setIsAdding(false);
    };

    const handleDelete = (id) => {
        if (window.confirm('이 문서를 삭제하시겠습니까?')) {
            const updatedDocs = docs.filter(doc => doc.id !== id);
            saveDocs(updatedDocs);
        }
    };

    const filteredDocs = docs.filter(doc => 
        doc.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '24px', background: 'var(--bg-primary)', overflowY: 'auto' }}>
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={24} color="var(--accent-color)" /> 참고 자료 및 가이드 관리
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        AI 답변 내 키워드 클릭 시 우선적으로 보여줄 문서를 등록합니다. (법제처에 없는 가이드 등)
                    </p>
                </div>
                <button 
                    onClick={() => setIsAdding(!isAdding)}
                    style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, transition: 'all 0.2s' }}
                >
                    <Plus size={18} /> {isAdding ? '취소' : '새 문서 등록'}
                </button>
            </div>

            {isAdding && (
                <div className="glass-panel animate-fade-in" style={{ marginBottom: '24px', padding: '24px', border: '1px solid var(--panel-border)', borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }}>
                    <form onSubmit={handleAdd}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>문서 제목 (정확하게 입력)</label>
                                <input 
                                    type="text" 
                                    value={newDoc.title}
                                    onChange={e => setNewDoc({...newDoc, title: e.target.value})}
                                    placeholder="예: 소프트웨어 제안요청서 작성 표준 가이드"
                                    style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                                    required
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>연결 유형</label>
                                <select 
                                    value={newDoc.type}
                                    onChange={e => setNewDoc({...newDoc, type: e.target.value})}
                                    style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                                >
                                    <option value="text">내용 직접 입력 (팝업 노출)</option>
                                    <option value="link">외부 링크 (URL 이동)</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                {newDoc.type === 'text' ? '문서 내용' : '이동할 URL'}
                            </label>
                            {newDoc.type === 'text' ? (
                                <textarea 
                                    value={newDoc.content}
                                    onChange={e => setNewDoc({...newDoc, content: e.target.value})}
                                    placeholder="문서의 핵심 내용이나 요약을 입력하세요."
                                    style={{ width: '100%', height: '120px', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}
                                    required
                                />
                            ) : (
                                <input 
                                    type="url" 
                                    value={newDoc.content}
                                    onChange={e => setNewDoc({...newDoc, content: e.target.value})}
                                    placeholder="https://example.com/guide.pdf"
                                    style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                                    required
                                />
                            )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button type="button" onClick={() => setIsAdding(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>취소</button>
                            <button type="submit" style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '8px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>저장하기</button>
                        </div>
                    </form>
                </div>
            )}

            <div style={{ position: 'relative', marginBottom: '20px' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input 
                    type="text" 
                    placeholder="등록된 문서 검색..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '12px 12px 12px 40px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
            </div>

            <div style={{ flex: 1 }}>
                {filteredDocs.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                        {filteredDocs.map(doc => (
                            <div key={doc.id} className="glass-panel" style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'transform 0.2s' }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: doc.type === 'link' ? '#60a5fa' : '#34d399', fontWeight: 600, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                                            {doc.type === 'link' ? <ExternalLink size={12} /> : <FileText size={12} />}
                                            {doc.type === 'link' ? 'LINK' : 'TEXT'}
                                        </div>
                                        <button onClick={() => handleDelete(doc.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer', padding: '4px' }}><Trash2 size={16} /></button>
                                    </div>
                                    <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: 'var(--text-primary)', lineHeight: '1.4' }}>{doc.title}</h3>
                                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {doc.content}
                                    </p>
                                </div>
                                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>{new Date(doc.createdAt).toLocaleDateString()} 등록</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', gap: '16px', opacity: 0.7 }}>
                        <Info size={48} strokeWidth={1} />
                        <p>등록된 참고 자료가 없습니다. 가이드 문서나 매뉴얼을 등록해 보세요.</p>
                    </div>
                )}
            </div>

            <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', gap: '12px' }}>
                <AlertCircle size={20} color="var(--accent-color)" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>💡 매칭 팁:</strong> AI 답변에서 자주 언급되는 문서의 명칭을 <strong>정확하게</strong> 제목으로 등록하세요. 공백은 자동으로 무시되어 매칭되지만, 명칭 자체가 다를 경우 연결되지 않을 수 있습니다.
                </div>
            </div>
        </div>
    );
};

export default ReferenceLibrary;
