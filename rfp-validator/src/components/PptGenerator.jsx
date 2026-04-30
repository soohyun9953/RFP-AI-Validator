import React, { useState, useRef } from 'react';
import { Presentation, FileSpreadsheet, Upload, X, Loader2, Info, Settings, Download, Play, FileDown } from 'lucide-react';
import { parseExcelData, generatePptFromTemplate, applyTextDesignToPpt, replaceWordsInPpt } from '../utils/pptExporter';

export default function PptGenerator() {
    const [activeTab, setActiveTab] = useState('excel_mapping'); // 'excel_mapping' or 'text_design'
    
    // 엑셀 매핑 관련 State
    const [excelFile, setExcelFile] = useState(null);
    const [pptTemplate, setPptTemplate] = useState(null);
    const [excelDataPreview, setExcelDataPreview] = useState(null);
    const [templateLabel, setTemplateLabel] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationMode, setGenerationMode] = useState('single');
    const [chunkSize, setChunkSize] = useState(10);
    const [isDraggingExcel, setIsDraggingExcel] = useState(false);
    const [isDraggingTemplate, setIsDraggingTemplate] = useState(false);
    const excelInputRef = useRef(null);
    const pptInputRef = useRef(null);

    // 텍스트 디자인 일괄 변경 관련 State
    const [modifyPptFile, setModifyPptFile] = useState(null);
    const [targetText, setTargetText] = useState('');
    const [isModifying, setIsModifying] = useState(false);
    const [isDraggingModify, setIsDraggingModify] = useState(false);

    // 단어 일괄 수정 관련 State
    const [replacePptFile, setReplacePptFile] = useState(null);
    const [replaceRules, setReplaceRules] = useState('');
    const [isReplacing, setIsReplacing] = useState(false);
    const [isDraggingReplace, setIsDraggingReplace] = useState(false);

    const [errorMsg, setErrorMsg] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    // 엑셀 매핑 핸들러들
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

    const handleModifyPptDragEvents = {
        onDragOver: (e) => { e.preventDefault(); e.stopPropagation(); },
        onDragEnter: (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingModify(true); },
        onDragLeave: (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingModify(false); },
        onDrop: (e) => {
            e.preventDefault(); e.stopPropagation(); setIsDraggingModify(false);
            const file = e.dataTransfer.files[0];
            if (file) {
                const ext = file.name.split('.').pop().toLowerCase();
                if (ext !== 'pptx') {
                    setErrorMsg('PPT 파일은 .pptx 확장자만 지원합니다.');
                    return;
                }
                setModifyPptFile(file);
            }
        }
    };

    const handleReplacePptDragEvents = {
        onDragOver: (e) => { e.preventDefault(); e.stopPropagation(); },
        onDragEnter: (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingReplace(true); },
        onDragLeave: (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingReplace(false); },
        onDrop: (e) => {
            e.preventDefault(); e.stopPropagation(); setIsDraggingReplace(false);
            const file = e.dataTransfer.files[0];
            if (file) {
                const ext = file.name.split('.').pop().toLowerCase();
                if (ext !== 'pptx') {
                    setErrorMsg('PPT 파일은 .pptx 확장자만 지원합니다.');
                    return;
                }
                setReplacePptFile(file);
            }
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
        await new Promise(r => setTimeout(r, 800));
        try {
            await generatePptFromTemplate(pptTemplate, excelDataPreview, generationMode, chunkSize);
            setSuccessMsg('성공적으로 PPT 파일이 생성되어 다운로드되었습니다.');
            setExcelFile(null);
            setPptTemplate(null);
            setExcelDataPreview(null);
            setTemplateLabel('');
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

    // 텍스트 디자인 변경 핸들러
    const handleModifyDesign = async () => {
        if (!modifyPptFile) {
            setErrorMsg('PPT 파일을 등록해주세요.');
            return;
        }
        setErrorMsg(null);
        setSuccessMsg(null);
        setIsModifying(true);
        await new Promise(r => setTimeout(r, 800));
        try {
            await applyTextDesignToPpt(modifyPptFile, targetText.trim());
            setSuccessMsg('텍스트 디자인이 일괄 적용된 PPT 파일이 다운로드되었습니다.');
            setModifyPptFile(null);
            setTargetText('');
        } catch (err) {
            console.error(err);
            setErrorMsg(`변환 중 오류 발생: ${err.message || '알 수 없는 오류'}`);
        } finally {
            setIsModifying(false);
        }
    };

    // 텍스트 단어 일괄 수정 핸들러
    const handleReplaceWords = async () => {
        if (!replacePptFile) {
            setErrorMsg('PPT 파일을 등록해주세요.');
            return;
        }
        setErrorMsg(null);
        setSuccessMsg(null);
        setIsReplacing(true);
        await new Promise(r => setTimeout(r, 800));
        try {
            await replaceWordsInPpt(replacePptFile, replaceRules);
            setSuccessMsg('텍스트 단어가 일괄 수정된 PPT 파일이 다운로드되었습니다.');
            setReplacePptFile(null);
            setReplaceRules('');
        } catch (err) {
            console.error(err);
            setErrorMsg(`변환 중 오류 발생: ${err.message || '알 수 없는 오류'}`);
        } finally {
            setIsReplacing(false);
        }
    };

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
                        <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>PPT 스마트 편집기</h2>
                        <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                            데이터 매핑을 통한 PPT 생성 또는 텍스트 서식 일괄 변경 기능을 제공합니다.
                        </p>
                    </div>
                </div>

                {/* 탭 메뉴 */}
                <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '12px' }}>
                    <button 
                        onClick={() => { setActiveTab('excel_mapping'); setErrorMsg(null); setSuccessMsg(null); }}
                        className="interactive"
                        style={{
                            padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
                            background: activeTab === 'excel_mapping' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                            border: '1px solid ' + (activeTab === 'excel_mapping' ? 'var(--accent-blue)' : 'transparent'),
                            color: activeTab === 'excel_mapping' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                            fontWeight: 600, fontSize: '14px', transition: 'all 0.2s'
                        }}
                    >
                        엑셀 데이터 매핑 생성
                    </button>
                    <button 
                        onClick={() => { setActiveTab('text_design'); setErrorMsg(null); setSuccessMsg(null); }}
                        className="interactive"
                        style={{
                            padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
                            background: activeTab === 'text_design' ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
                            border: '1px solid ' + (activeTab === 'text_design' ? '#a855f7' : 'transparent'),
                            color: activeTab === 'text_design' ? '#c084fc' : 'var(--text-secondary)',
                            fontWeight: 600, fontSize: '14px', transition: 'all 0.2s'
                        }}
                    >
                        텍스트 디자인 일괄 변경
                    </button>
                    <button 
                        onClick={() => { setActiveTab('word_replace'); setErrorMsg(null); setSuccessMsg(null); }}
                        className="interactive"
                        style={{
                            padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
                            background: activeTab === 'word_replace' ? 'rgba(236, 72, 153, 0.1)' : 'transparent',
                            border: '1px solid ' + (activeTab === 'word_replace' ? '#ec4899' : 'transparent'),
                            color: activeTab === 'word_replace' ? '#f472b6' : 'var(--text-secondary)',
                            fontWeight: 600, fontSize: '14px', transition: 'all 0.2s'
                        }}
                    >
                        단어 일괄 수정
                    </button>
                </div>

                {/* 에러/성공 메시지 공통 표시 */}
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

                {/* 탭 컨텐츠 */}
                {activeTab === 'excel_mapping' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
                                        PPT 내 텍스트 상자에 <code>{`{열이름}`}</code> (예: <code>{`{성명}`}</code>, <code>{`{부서}`}</code>) 형식으로 입력하세요.<br/>
                                        <strong style={{ color: 'var(--accent-blue)' }}>* 자동 슬라이드 복제:</strong> 엑셀 행 개수만큼 슬라이드가 자동으로 생성되며 각 행의 데이터가 각 슬라이드에 채워집니다.
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
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
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
                ) : activeTab === 'text_design' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* 텍스트 디자인 일괄 변경 UI */}
                        <div 
                            {...handleModifyPptDragEvents}
                            style={{ 
                                border: `2px dashed ${isDraggingModify ? '#a855f7' : 'rgba(168, 85, 247, 0.3)'}`, 
                                borderRadius: '12px', padding: '24px',
                                background: isDraggingModify ? 'rgba(168, 85, 247, 0.1)' : 'rgba(168, 85, 247, 0.05)', 
                                display: 'flex', flexDirection: 'column', gap: '16px',
                                transition: 'all 0.2s ease', cursor: isDraggingModify ? 'copy' : 'default'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Presentation size={20} color="#c084fc" />
                                <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>1. 원본 PPT 파일(.pptx) 등록</h3>
                            </div>
                            <input
                                type="file"
                                accept=".pptx"
                                onChange={(e) => setModifyPptFile(e.target.files[0])}
                                style={{ display: 'none' }}
                                id="modify-ppt-upload"
                            />
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <button
                                    onClick={() => document.getElementById('modify-ppt-upload').click()}
                                    className="interactive"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
                                        background: 'var(--bg-secondary)', border: '1px solid var(--panel-border)',
                                        color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px'
                                    }}
                                >
                                    <Upload size={16} /> PPT 파일 찾기
                                </button>
                                {modifyPptFile && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', border: '1px solid #a855f7' }}>
                                        <span style={{ color: '#c084fc' }}>✔</span>
                                        {modifyPptFile.name}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ 
                            border: '1px solid var(--panel-border)', 
                            borderRadius: '12px', padding: '24px',
                            background: 'rgba(255, 255, 255, 0.02)', 
                            display: 'flex', flexDirection: 'column', gap: '16px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Info size={20} color="#c084fc" />
                                <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>2. 변경할 텍스트 지정</h3>
                            </div>
                            <input
                                type="text"
                                placeholder="디자인을 변경할 텍스트를 입력하세요 (예: 제목, 회사명 등)"
                                value={targetText}
                                onChange={(e) => setTargetText(e.target.value)}
                                style={{
                                    width: '100%', padding: '12px 16px', borderRadius: '8px',
                                    background: 'var(--bg-secondary)', border: '1px solid var(--panel-border)',
                                    color: 'var(--text-primary)', fontSize: '14px'
                                }}
                            />
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                💡 입력한 텍스트를 포함하는 모든 슬라이드의 텍스트 상자에 <strong>텍스트 윤곽선(실선, 흰색, 투명도 100%)</strong> 디자인이 일괄 적용됩니다.
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                            <button
                                className="interactive"
                                onClick={handleModifyDesign}
                                disabled={!modifyPptFile || isModifying}
                                style={{
                                    width: '100%',
                                    padding: '16px',
                                    background: (!modifyPptFile || isModifying) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #a855f7, #3b82f6)',
                                    color: (!modifyPptFile || isModifying) ? 'var(--text-muted)' : 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontSize: '16px',
                                    fontWeight: 700,
                                    cursor: (!modifyPptFile || isModifying) ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                }}
                            >
                                {isModifying ? (
                                    <><Loader2 size={20} className="animate-spin" /> 디자인 적용 중...</>
                                ) : (
                                    <><Play size={20} /> 디자인 일괄 적용 및 생성</>
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* 단어 일괄 수정 UI */}
                        <div 
                            {...handleReplacePptDragEvents}
                            style={{ 
                                border: `2px dashed ${isDraggingReplace ? '#ec4899' : 'rgba(236, 72, 153, 0.3)'}`, 
                                borderRadius: '12px', padding: '24px',
                                background: isDraggingReplace ? 'rgba(236, 72, 153, 0.1)' : 'rgba(236, 72, 153, 0.05)', 
                                display: 'flex', flexDirection: 'column', gap: '16px',
                                transition: 'all 0.2s ease', cursor: isDraggingReplace ? 'copy' : 'default'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Presentation size={20} color="#f472b6" />
                                <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>1. 원본 PPT 파일(.pptx) 등록</h3>
                            </div>
                            <input
                                type="file"
                                accept=".pptx"
                                onChange={(e) => setReplacePptFile(e.target.files[0])}
                                style={{ display: 'none' }}
                                id="replace-ppt-upload"
                            />
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <button
                                    onClick={() => document.getElementById('replace-ppt-upload').click()}
                                    className="interactive"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
                                        background: 'var(--bg-secondary)', border: '1px solid var(--panel-border)',
                                        color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px'
                                    }}
                                >
                                    <Upload size={16} /> PPT 파일 찾기
                                </button>
                                {replacePptFile && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', border: '1px solid #ec4899' }}>
                                        <span style={{ color: '#f472b6' }}>✔</span>
                                        {replacePptFile.name}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ 
                            border: '1px solid var(--panel-border)', 
                            borderRadius: '12px', padding: '24px',
                            background: 'rgba(255, 255, 255, 0.02)', 
                            display: 'flex', flexDirection: 'column', gap: '16px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Info size={20} color="#f472b6" />
                                <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>2. 수정할 단어 규칙 입력</h3>
                            </div>
                            <input
                                type="text"
                                placeholder="예: 애플리케이션(어플리케이션), AI(인공지능)"
                                value={replaceRules}
                                onChange={(e) => setReplaceRules(e.target.value)}
                                style={{
                                    width: '100%', padding: '12px 16px', borderRadius: '8px',
                                    background: 'var(--bg-secondary)', border: '1px solid var(--panel-border)',
                                    color: 'var(--text-primary)', fontSize: '14px'
                                }}
                            />
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                💡 형식: <code>기존단어(새로운단어)</code><br/>
                                복수의 단어를 수정하려면 쉼표(,)로 구분하여 입력하세요.<br/>
                                예시: <code>애플리케이션(어플리케이션), AI(인공지능), 테스트(검증)</code>
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                            <button
                                className="interactive"
                                onClick={handleReplaceWords}
                                disabled={!replacePptFile || isReplacing || !replaceRules.trim()}
                                style={{
                                    width: '100%',
                                    padding: '16px',
                                    background: (!replacePptFile || isReplacing || !replaceRules.trim()) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                                    color: (!replacePptFile || isReplacing || !replaceRules.trim()) ? 'var(--text-muted)' : 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontSize: '16px',
                                    fontWeight: 700,
                                    cursor: (!replacePptFile || isReplacing || !replaceRules.trim()) ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                }}
                            >
                                {isReplacing ? (
                                    <><Loader2 size={20} className="animate-spin" /> 단어 수정 적용 중...</>
                                ) : (
                                    <><Play size={20} /> 텍스트 단어 일괄 수정 및 생성</>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

