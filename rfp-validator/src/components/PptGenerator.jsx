import React, { useState, useRef } from 'react';
import { Presentation, FileSpreadsheet, Upload, X, Loader2, Info, Settings, Download, Play, FileDown } from 'lucide-react';
import { parseExcelData, generatePptFromTemplate } from '../utils/pptExporter';

export default function PptGenerator() {
    const [excelFile, setExcelFile] = useState(null);
    const [pptTemplate, setPptTemplate] = useState(null);
    const [excelDataPreview, setExcelDataPreview] = useState(null);
    const [templateLabel, setTemplateLabel] = useState('');
    
    // Status states
    const [isParsing, setIsParsing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);
    
    // Options
    const [generationMode, setGenerationMode] = useState('single'); // 'single', 'chunk', or 'multiple'
    const [chunkSize, setChunkSize] = useState(10); // 한 슬라이드(표)에 들어갈 기본 행 개수

    const [isDraggingExcel, setIsDraggingExcel] = useState(false);
    const [isDraggingTemplate, setIsDraggingTemplate] = useState(false);

    const excelInputRef = useRef(null);
    const pptInputRef = useRef(null);

    const processExcelFile = async (file) => {
        if (!file) return;
        
        setErrorMsg(null);
        setSuccessMsg(null);
        setExcelFile(file);
        setIsParsing(true);
        setExcelDataPreview(null);
        
        try {
            const data = await parseExcelData(file);
            if (data.length === 0) {
                setErrorMsg('엑셀 파일에 데이터가 없습니다.');
            } else {
                setExcelDataPreview(data);
            }
        } catch (err) {
            console.error(err);
            setErrorMsg('엑셀 파일 분석 중 오류가 발생했습니다. 올바른 파일인지 확인해주세요.');
        } finally {
            setIsParsing(false);
        }
    };

    const handleExcelChange = (e) => processExcelFile(e.target.files[0]);

    const processTemplateFile = (file) => {
        if (!file) return;
        
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'pptx') {
            setErrorMsg('PPT 템플릿은 .pptx 확장자만 지원합니다.');
            return;
        }
        
        setErrorMsg(null);
        setSuccessMsg(null);
        setPptTemplate(file);
        setTemplateLabel(file.name);
    };

    const handleTemplateChange = (e) => processTemplateFile(e.target.files[0]);

    const handleExcelDragEvents = {
        onDragOver: (e) => { e.preventDefault(); e.stopPropagation(); },
        onDragEnter: (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingExcel(true); },
        onDragLeave: (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingExcel(false); },
        onDrop: (e) => {
            e.preventDefault(); e.stopPropagation(); setIsDraggingExcel(false);
            const file = e.dataTransfer.files[0];
            if (file) processExcelFile(file);
        }
    };

    const handleTemplateDragEvents = {
        onDragOver: (e) => { e.preventDefault(); e.stopPropagation(); },
        onDragEnter: (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingTemplate(true); },
        onDragLeave: (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingTemplate(false); },
        onDrop: (e) => {
            e.preventDefault(); e.stopPropagation(); setIsDraggingTemplate(false);
            const file = e.dataTransfer.files[0];
            if (file) processTemplateFile(file);
        }
    };

    const handleGenerate = async () => {
        if (!excelFile || !pptTemplate || !excelDataPreview) {
            setErrorMsg('엑셀 파일과 PPT 템플릿을 모두 등록해주세요.');
            return;
        }
        
        setErrorMsg(null);
        setSuccessMsg(null);
        setIsGenerating(true);

        // 시각적 효과를 위한 작은 지연
        await new Promise(r => setTimeout(r, 800));

        try {
            await generatePptFromTemplate(pptTemplate, excelDataPreview, generationMode, chunkSize);
            setSuccessMsg('성공적으로 PPT 파일이 생성되어 다운로드되었습니다.');
        } catch (err) {
            console.error(err);
            if (err.message && err.message.includes("Can't find end of central directory")) {
                setErrorMsg('유효하지 않은 PPTX 파일입니다. 손상되었거나 암호가 걸려있을 수 있습니다.');
            } else {
                setErrorMsg(`변환 중 오류 발생: ${err.message || '알 수 없는 오류'}`);
            }
        } finally {
            setIsGenerating(false);
        }
    };
    
    // 파싱된 엑셀 데이터의 속성 이름들 가져오기 (컬럼 헤더들)
    const columns = excelDataPreview && excelDataPreview.length > 0 ? Object.keys(excelDataPreview[0]) : [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="glass-panel animate-slide-up" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* 헤더 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '16px' }}>
                    <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px' }}>
                        <Presentation size={24} color="var(--accent-blue)" />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>PPT 생성 (엑셀기준)</h2>
                        <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                            작성된 엑셀 데이터를 지정한 파워포인트(.pptx) 양식 파일에 자동으로 채워 넣습니다.
                        </p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* 데이터 엑셀 업로드 영역 */}
                    <div 
                        {...handleExcelDragEvents}
                        style={{ 
                            border: `2px dashed ${isDraggingExcel ? 'var(--success-color)' : 'rgba(34, 197, 94, 0.3)'}`, 
                            borderRadius: '12px', padding: '24px',
                            background: isDraggingExcel ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)', 
                            display: 'flex', flexDirection: 'column', gap: '16px',
                            transition: 'all 0.2s ease', cursor: isDraggingExcel ? 'copy' : 'default'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileSpreadsheet size={20} color="var(--success-color)" />
                            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>1. 엑셀 데이터 등록</h3>
                        </div>
                        
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleExcelChange}
                            ref={excelInputRef}
                            style={{ display: 'none' }}
                        />
                        
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <button
                                onClick={() => excelInputRef.current?.click()}
                                className="interactive"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
                                    background: 'var(--bg-secondary)', border: '1px solid var(--panel-border)',
                                    color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px'
                                }}
                            >
                                {isParsing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                엑셀 찾아보기 (.xlsx)
                            </button>
                            {excelFile && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', border: '1px solid var(--success-color)' }}>
                                    <span style={{ color: 'var(--success-color)' }}>✔</span>
                                    {excelFile.name}
                                </div>
                            )}
                        </div>

                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                            💡 1행이 라벨(변수명)이 되고, 2행부터 실제 데이터로 간주합니다.
                        </div>
                    </div>

                    {/* PPT 양식 파일 업로드 영역 */}
                    <div 
                        {...handleTemplateDragEvents}
                        style={{ 
                            border: `2px dashed ${isDraggingTemplate ? 'var(--accent-blue)' : 'rgba(59, 130, 246, 0.3)'}`, 
                            borderRadius: '12px', padding: '24px',
                            background: isDraggingTemplate ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)', 
                            display: 'flex', flexDirection: 'column', gap: '16px',
                            transition: 'all 0.2s ease', cursor: isDraggingTemplate ? 'copy' : 'default'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Presentation size={20} color="var(--accent-blue)" />
                            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>2. PPT 양식(.pptx) 등록</h3>
                        </div>
                        
                        <input
                            type="file"
                            accept=".pptx"
                            onChange={handleTemplateChange}
                            ref={pptInputRef}
                            style={{ display: 'none' }}
                        />
                        
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <button
                                onClick={() => pptInputRef.current?.click()}
                                className="interactive"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
                                    background: 'var(--bg-secondary)', border: '1px solid var(--panel-border)',
                                    color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px'
                                }}
                            >
                                <Upload size={16} /> PPT 템플릿 찾기
                            </button>
                            {pptTemplate && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', border: '1px solid var(--accent-blue)' }}>
                                    <span style={{ color: 'var(--accent-blue)' }}>✔</span>
                                    {templateLabel}
                                </div>
                            )}
                        </div>

                        <div style={{ 
                            fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', 
                            marginTop: '4px', background: 'rgba(255,255,255,0.03)', 
                            padding: '14px 18px', borderRadius: '8px', borderLeft: '3px solid var(--accent-blue)'
                        }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                💡 PPT 템플릿 매핑 가이드
                            </div>
                            <p style={{ margin: 0 }}>
                                PPT 내 텍스트 상자에 <code>{`{열이름}`}</code> 정해진 규칙대로 입력하면 엑셀 데이터가 매핑됩니다.<br/>
                                <strong>예순번 예시:</strong> <code>{`{사업명_1}`}</code>, <code>{`{사업명_2}`}</code> ... <code>{`{사업명_10}`}</code><br/>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>* 엑셀 행 개수만큼 슬라이드가 자동 복제되어 생성됩니다.</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* 데이터 컬럼 매핑 프리뷰 */}
                {excelDataPreview && (
                    <div className="animate-fade-in" style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <Info size={18} color="var(--warning-color)" />
                            <h4 style={{ margin: 0, fontSize: '15px' }}>사용 가능한 템플릿 태그 (총 {excelDataPreview.length}개 행 인식됨)</h4>
                        </div>
                        <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            등록된 엑셀에서 아래 열(Column)들이 식별되었습니다. PPT의 텍스트상자에 아래 태그들을 적어주세요. <br/>
                            <strong style={{ color: 'var(--accent-blue)' }}>* 표 양식 {chunkSize}줄 세팅 시:</strong> 1번 줄에는 <code>{`{열이름_1}`}</code>, 2번 줄에는 <code>{`{열이름_2}`}</code> ... {chunkSize}번 줄에는 <code>{`{열이름_${chunkSize}}`}</code> 처럼 순번을 붙여 표 칸을 미리 채워주셔야 합니다!
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {columns.map(col => (
                                <div key={col} style={{ 
                                    padding: '4px 8px', background: 'rgba(168,85,247,0.1)', color: '#c084fc',
                                    borderRadius: '6px', fontSize: '13px', fontFamily: 'monospace', fontWeight: 600, border: '1px solid rgba(168,85,247,0.2)'
                                }}>
                                    {`{${col}}`}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 생성 옵션 패널 */}
                <div style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Settings size={18} color="var(--text-secondary)" />
                        <h4 style={{ margin: 0, fontSize: '15px' }}>생성 (Export) 방침 선택</h4>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', opacity: generationMode === 'single' ? 1 : 0.6 }}>
                            <input 
                                type="radio" 
                                name="mode" 
                                checked={generationMode === 'single'} 
                                onChange={() => setGenerationMode('single')}
                                style={{ marginTop: '3px' }}
                            />
                            <div>
                                <strong style={{ display: 'block', fontSize: '14px', marginBottom: '4px', color: generationMode === 'single' ? 'var(--accent-blue)' : 'inherit' }}>단일 파일 통합 생성 (추천)</strong>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>모든 데이터를 하나의 PPT 파일 내에 각각의 슬라이드로 복제하여 생성합니다. (ZIP 압축 없음)</span>
                            </div>
                        </label>
                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', opacity: generationMode === 'chunk' ? 1 : 0.6 }}>
                            <input 
                                type="radio" 
                                name="mode" 
                                checked={generationMode === 'chunk'} 
                                onChange={() => setGenerationMode('chunk')}
                                style={{ marginTop: '3px' }}
                            />
                            <div>
                                <strong style={{ display: 'block', fontSize: '14px', marginBottom: '4px', color: generationMode === 'chunk' ? 'var(--accent-blue)' : 'inherit' }}>지정 행(Row) 분할 표 생성</strong>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>엑셀 데이터를 설정한 개수만큼 잘라서 표에 채운 여러 개의 PPT를 생성 후 압축(.zip) 제공합니다.</span>
                                
                                {generationMode === 'chunk' && (
                                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '6px' }}>
                                        <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>1개의 PPT 파일에 들어갈 표의 행 개수:</span>
                                        <input 
                                            type="number" 
                                            min="1" 
                                            max="100" 
                                            value={chunkSize} 
                                            onChange={e => setChunkSize(parseInt(e.target.value) || 1)}
                                            style={{ 
                                                width: '60px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--panel-border)', 
                                                background: 'var(--bg-dark)', color: 'var(--text-primary)', outline: 'none'
                                            }}
                                        />
                                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>개</span>
                                    </div>
                                )}
                            </div>
                        </label>
                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', opacity: generationMode === 'multiple' ? 1 : 0.6 }}>
                            <input 
                                type="radio" 
                                name="mode" 
                                checked={generationMode === 'multiple'} 
                                onChange={() => setGenerationMode('multiple')}
                                style={{ marginTop: '3px' }}
                            />
                            <div>
                                <strong style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>개별 파일 분리 다운로드 (행 1개당 PPT 1개)</strong>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>엑셀 데이터 행(Row) 개수만큼 모두 개별 독립된 PPT 파일들이 무한 생성됩니다. <br/>(수료증, 개별 보고서, 이력서, 개별 이슈 카드용)</span>
                            </div>
                        </label>
                    </div>
                </div>

                {/* 액션 & 메시지 */}
                {errorMsg && (
                    <div className="animate-fade-in" style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <X size={16} /> {errorMsg}
                    </div>
                )}
                {successMsg && (
                    <div className="animate-fade-in" style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileDown size={16} /> {successMsg}
                    </div>
                )}

                <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                    <button
                        className="interactive"
                        onClick={handleGenerate}
                        disabled={!excelFile || !pptTemplate || isGenerating}
                        style={{
                            width: '100%',
                            padding: '16px',
                            background: (!excelFile || !pptTemplate || isGenerating) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #0284c7, #3b82f6)',
                            color: (!excelFile || !pptTemplate || isGenerating) ? 'var(--text-muted)' : 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '16px',
                            fontWeight: 700,
                            cursor: (!excelFile || !pptTemplate || isGenerating) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px'
                        }}
                    >
                        {isGenerating ? (
                            <><Loader2 size={20} className="animate-spin" /> 파워포인트 문서 자동 치환 및 생성 중...</>
                        ) : (
                            <><Play size={20} fill={(!excelFile || !pptTemplate) ? 'none' : 'currentColor'} /> 엑셀 ↔ PPT 자동 매핑 및 파일 변환 시작</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
