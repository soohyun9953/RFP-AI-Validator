import React, { useState, useEffect } from 'react';
import { Search, FileText, Database, Info, ExternalLink, ChevronRight, FileType, Clock, HardDrive, Filter, RefreshCw, Loader2 } from 'lucide-react';
import { loadRagData, searchRag } from '../utils/ragService';

const RagKnowledgeBase = () => {
    const [allDocs, setAllDocs] = useState([]);
    const [filteredDocs, setFilteredDocs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [stats, setStats] = useState({ count: 0, size: 0 });
    const [isIndexing, setIsIndexing] = useState(false);

    const init = async (refresh = false) => {
        setIsLoading(true);
        const data = await loadRagData(refresh);
        setAllDocs(data);
        setFilteredDocs(data);
        
        const totalSize = data.reduce((acc, doc) => acc + (doc.size || 0), 0);
        setStats({
            count: data.length,
            size: (totalSize / (1024 * 1024)).toFixed(1)
        });
        setIsLoading(false);
    };

    useEffect(() => {
        init();
    }, []);

    const handleReindex = async () => {
        if (!window.confirm('로컬 산출물 폴더를 다시 스캔하여 지식베이스를 갱신하시겠습니까?\n(약 수초~수십초가 소요될 수 있습니다)')) return;
        
        setIsIndexing(true);
        try {
            const response = await fetch('/api/reindex', { method: 'POST' });
            const result = await response.json();
            if (result.success) {
                await init(true);
                alert('지식베이스 인덱싱이 완료되었습니다.');
            } else {
                alert('인덱싱 실패: ' + result.error);
            }
        } catch (error) {
            console.error('Reindex error:', error);
            alert('인덱싱 중 오류가 발생했습니다. 개발 서버 상태를 확인하세요.');
        } finally {
            setIsIndexing(false);
        }
    };

    const handleSearch = async (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        
        if (!value.trim()) {
            setFilteredDocs(allDocs);
            return;
        }

        const results = await searchRag(value, 50);
        setFilteredDocs(results);
    };

    const formatSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Header Area */}
            <div className="glass-panel animate-slide-up" style={{ padding: '24px 32px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--panel-border)', borderRadius: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        <Database size={28} color="var(--accent-blue)" />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>ISMP RAG 지식베이스</h2>
                        <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>데스크탑 산출물 폴더 기반 인덱싱 데이터 ({stats.count}개 파일, {stats.size}MB)</p>
                    </div>
                </div>

                <button 
                    onClick={handleReindex}
                    disabled={isIndexing}
                    className="interactive"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 20px',
                        background: isIndexing ? 'rgba(255,255,255,0.05)' : 'rgba(59, 130, 246, 0.1)',
                        border: `1px solid ${isIndexing ? 'var(--panel-border)' : 'rgba(59, 130, 246, 0.3)'}`,
                        borderRadius: '12px',
                        color: isIndexing ? 'var(--text-muted)' : 'var(--accent-blue)',
                        fontWeight: 700,
                        fontSize: '14px',
                        cursor: isIndexing ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    {isIndexing ? (
                        <><Loader2 size={18} className="animate-spin" /> 인덱싱 중...</>
                    ) : (
                        <><RefreshCw size={18} /> 지식베이스 갱신</>
                    )}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: selectedDoc ? '1fr 1.2fr' : '1fr', gap: '24px', flex: 1, overflow: 'hidden' }}>
                {/* Search and List Column */}
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '16px' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input 
                            type="text" 
                            placeholder="전체 지식 베이스 키워드 검색..." 
                            value={searchTerm} 
                            onChange={handleSearch}
                            style={{ 
                                width: '100%', 
                                padding: '14px 14px 14px 52px', 
                                background: 'rgba(255,255,255,0.03)', 
                                borderRadius: '14px', 
                                fontSize: '15px', 
                                border: '1px solid var(--glass-border)',
                                color: 'var(--text-primary)',
                                outline: 'none',
                                transition: 'all 0.2s'
                            }} 
                        />
                    </div>

                    <div className="glass-panel" style={{ flex: 1, overflowY: 'auto', padding: '12px', borderRadius: '16px' }}>
                        {isLoading ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>로딩 중...</div>
                        ) : filteredDocs.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {filteredDocs.map(doc => (
                                    <button
                                        key={doc.id}
                                        onClick={() => setSelectedDoc(doc)}
                                        className="interactive"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '12px 16px',
                                            borderRadius: '12px',
                                            background: selectedDoc?.id === doc.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                            border: `1px solid ${selectedDoc?.id === doc.id ? 'rgba(59, 130, 246, 0.3)' : 'transparent'}`,
                                            textAlign: 'left',
                                            width: '100%',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ 
                                            width: '36px', height: '36px', borderRadius: '10px', 
                                            background: doc.type === 'pptx' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            {doc.type === 'pptx' ? <FileType size={18} color="#f59e0b" /> : <FileText size={18} color="#ef4444" />}
                                        </div>
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {doc.title}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                                                <span>{doc.type.toUpperCase()}</span>
                                                <span>•</span>
                                                <span>{formatSize(doc.size)}</span>
                                                {doc.score > 0 && (
                                                    <>
                                                        <span>•</span>
                                                        <span style={{ color: 'var(--accent-blue)' }}>정확도 {doc.score}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <ChevronRight size={16} color="var(--text-muted)" />
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>검색 결과가 없습니다.</div>
                        )}
                    </div>
                </div>

                {/* Detail View Column */}
                {selectedDoc && (
                    <div className="glass-panel animate-scale-in" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '16px', border: '1px solid var(--panel-border)' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Document Details</div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedDoc.title}</h3>
                                <div style={{ fontSize: '13px', color: 'var(--accent-blue)', marginTop: '6px', wordBreak: 'break-all' }}>
                                    {selectedDoc.path}
                                </div>
                            </div>
                            <button onClick={() => setSelectedDoc(null)} style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                닫기
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                            <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '14px' }}>
                                    <Info size={16} /> 요약 정보
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>파일 형식</div>
                                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{selectedDoc.type.toUpperCase()} Document</div>
                                    </div>
                                    <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>페이지/슬라이드</div>
                                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{selectedDoc.pages?.length || 0} Pages</div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', borderLeft: '3px solid var(--accent-blue)', paddingLeft: '10px' }}>
                                    추출된 텍스트 내용
                                </div>
                                <div style={{ 
                                    fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.7', 
                                    whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.1)', padding: '20px', 
                                    borderRadius: '12px', border: '1px solid var(--glass-border)' 
                                }}>
                                    {selectedDoc.content}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.1)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <Info size={20} color="var(--accent-blue)" />
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    이 지식베이스는 로컬 데스크탑의 산출물 폴더를 실시간으로 참조합니다. 파일이 추가되거나 변경된 경우 추출 스크립트를 재실행하여 인덱스를 갱신해야 합니다.
                </div>
            </div>
        </div>
    );
};

export default RagKnowledgeBase;
