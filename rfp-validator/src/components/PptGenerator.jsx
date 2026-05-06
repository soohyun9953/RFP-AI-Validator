import React, { useState, useRef } from 'react';
import { Presentation, FileSpreadsheet, Upload, X, Loader2, Info, Settings, Download, Play, FileDown } from 'lucide-react';
import { parseExcelData, generatePptFromTemplate, processPptBatch } from '../utils/pptExporter';

export default function PptGenerator() {
    const [activeTab, setActiveTab] = useState('excel_mapping'); // 'excel_mapping' or 'batch_edit'
    
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

    // PPT 일괄 편집 (단어 수정 + 디자인 변경) 관련 State
    const [batchPptFiles, setBatchPptFiles] = useState([]);
    const [replaceRules, setReplaceRules] = useState('');
    const [applyDesignChecked, setApplyDesignChecked] = useState(false);
    const [designTargetText, setDesignTargetText] = useState('');
    const [isProcessingBatch, setIsProcessingBatch] = useState(false);
    const [isDraggingBatch, setIsDraggingBatch] = useState(false);

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

    const handleBatchPptDragEvents = {
        onDragOver: (e) => { e.preventDefault(); e.stopPropagation(); },
        onDragEnter: (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingBatch(true); },
        onDragLeave: (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingBatch(false); },
        onDrop: (e) => {
            e.preventDefault(); e.stopPropagation(); setIsDraggingBatch(false);
            const files = Array.from(e.dataTransfer.files);
            const validFiles = files.filter(f => f.name.toLowerCase().endsWith('.pptx'));
            if (validFiles.length > 0) {
                setBatchPptFiles(prev => [...prev, ...validFiles]);
            } else {
                setErrorMsg('PPT 파일(.pptx)만 지원합니다.');
            }
        }
    };

    const handleBatchFileChange = (e) => {
        const files = Array.from(e.target.files);
        const validFiles = files.filter(f => f.name.toLowerCase().endsWith('.pptx'));
        if (validFiles.length > 0) {
            setBatchPptFiles(prev => [...prev, ...validFiles]);
        }
    };

    const removeBatchFile = (indexToRemove) => {
        setBatchPptFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
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

    // 일괄 편집 핸들러 (단어 수정 + 디자인 적용 + 다중 파일 + 폴더 지정)
    const handleBatchProcess = async () => {
        if (batchPptFiles.length === 0) {
            setErrorMsg('PPT 파일을 1개 이상 등록해주세요.');
            return;
        }

        let parsedRules = [];
        if (replaceRules.trim()) {
            const parts = replaceRules.split(',');
            for (const part of parts) {
                const trimmed = part.trim();
                if (!trimmed) continue;
                const match = trimmed.match(/^(.+?)\((.+?)\)$/);
                if (match) {
                    parsedRules.push({ oldWord: match[1].trim(), newWord: match[2].trim() });
                } else {
                    setErrorMsg(`규칙 형식이 올바르지 않습니다: "${trimmed}" (예: 기존단어(새단어))`);
                    return;
                }
            }
        }

        if (parsedRules.length === 0 && !applyDesignChecked) {
            setErrorMsg('적용할 단어 수정 규칙이나 텍스트 디자인 변경을 선택해주세요.');
            return;
        }

        setErrorMsg(null);
        setSuccessMsg(null);
        setIsProcessingBatch(true);

        try {
            let directoryHandle = null;
            if ('showDirectoryPicker' in window) {
                try {
                    directoryHandle = await window.showDirectoryPicker({
                        id: 'ppt-batch-output',
                        mode: 'readwrite',
                        startIn: 'downloads'
                    });
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.error('Directory Picker Error:', err);
                    } else {
                        // 취소한 경우 중단
                        setIsProcessingBatch(false);
                        return;
                    }
                }
            }

            let successCount = 0;

            for (const file of batchPptFiles) {
                try {
                    const modifiedBlob = await processPptBatch(file, {
                        replaceRules: parsedRules,
                        applyDesign: applyDesignChecked,
                        targetText: designTargetText
                    });

                    const fileName = `수정_${file.name}`;
                    
                    if (directoryHandle) {
                        const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
                        const writable = await fileHandle.createWritable();
                        await writable.write(modifiedBlob);
                        await writable.close();
                    } else {
                        // Fallback: 일반 다운로드
                        const { saveAs } = await import('file-saver');
                        saveAs(modifiedBlob, fileName);
                    }
                    successCount++;
                } catch (fileErr) {
                    console.error(`Error processing ${file.name}:`, fileErr);
                    // 개별 파일 에러 시 다음 파일로 계속 진행 (사용자 알림 필요 시 추가 가능)
                }
            }

            if (successCount > 0) {
                setSuccessMsg(`성공적으로 ${successCount}개의 파일이 일괄 편집되어 저장되었습니다.`);
                setBatchPptFiles([]);
                setReplaceRules('');
                setApplyDesignChecked(false);
                setDesignTargetText('');
            } else {
                setErrorMsg('처리된 파일이 없습니다. 변경 대상 텍스트가 존재하는지 확인해주세요.');
            }
        } catch (err) {
            console.error(err);
            setErrorMsg(`작업 중 오류 발생: ${err.message || '알 수 없는 오류'}`);
        } finally {
            setIsProcessingBatch(false);
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
                        onClick={() => { setActiveTab('batch_edit'); setErrorMsg(null); setSuccessMsg(null); }}
                        className="interactive"
                        style={{
                            padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
                            background: activeTab === 'batch_edit' ? 'rgba(236, 72, 153, 0.1)' : 'transparent',
                            border: '1px solid ' + (activeTab === 'batch_edit' ? '#ec4899' : 'transparent'),
                            color: activeTab === 'batch_edit' ? '#f472b6' : 'var(--text-secondary)',
                            fontWeight: 600, fontSize: '14px', transition: 'all 0.2s'
                        }}
                    >
                        PPT 텍스트/디자인 일괄 편집
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
                ) : activeTab === 'batch_edit' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* 일괄 편집 (다중 파일) UI */}
                        <div 
                            {...handleBatchPptDragEvents}
                            style={{ 
                                border: `2px dashed ${isDraggingBatch ? '#ec4899' : 'rgba(236, 72, 153, 0.3)'}`, 
                                borderRadius: '12px', padding: '24px',
                                background: isDraggingBatch ? 'rgba(236, 72, 153, 0.1)' : 'rgba(236, 72, 153, 0.05)', 
                                display: 'flex', flexDirection: 'column', gap: '16px',
                                transition: 'all 0.2s ease', cursor: isDraggingBatch ? 'copy' : 'default'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Presentation size={20} color="#f472b6" />
                                <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>1. 원본 PPT 파일(.pptx) 다중 등록</h3>
                            </div>
                            <input
                                type="file"
                                accept=".pptx"
                                multiple
                                onChange={handleBatchFileChange}
                                style={{ display: 'none' }}
                                id="batch-ppt-upload"
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                    <button
                                        onClick={() => document.getElementById('batch-ppt-upload').click()}
                                        className="interactive"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
                                            background: 'var(--bg-secondary)', border: '1px solid var(--panel-border)',
                                            color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px'
                                        }}
                                    >
                                        <Upload size={16} /> PPT 파일(들) 찾기
                                    </button>
                                </div>
                                
                                {batchPptFiles.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                                        {batchPptFiles.map((file, idx) => (
                                            <div key={idx} style={{ 
                                                display: 'flex', alignItems: 'center', gap: '6px', 
                                                background: 'rgba(0,0,0,0.2)', padding: '4px 10px', 
                                                borderRadius: '6px', fontSize: '12.5px', border: '1px solid #a855f7' 
                                            }}>
                                                <span style={{ color: '#c084fc' }}>✔</span>
                                                <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                                                <button 
                                                    onClick={() => removeBatchFile(idx)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex' }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ 
                            border: '1px solid var(--panel-border)', 
                            borderRadius: '12px', padding: '24px',
                            background: 'rgba(255, 255, 255, 0.02)', 
                            display: 'flex', flexDirection: 'column', gap: '20px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Settings size={20} color="#a855f7" />
                                <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>2. 일괄 편집 옵션 설정</h3>
                            </div>
                            
                            {/* 옵션 1: 단어 수정 */}
                            <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)' }}>
                                    옵션 A: 수정할 단어 규칙 입력 (선택)
                                </div>
                                <input
                                    type="text"
                                    placeholder="예: 애플리케이션(어플리케이션), AI(인공지능)"
                                    value={replaceRules}
                                    onChange={(e) => setReplaceRules(e.target.value)}
                                    style={{
                                        width: '100%', padding: '12px 16px', borderRadius: '8px',
                                        background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)',
                                        color: 'var(--text-primary)', fontSize: '14px', marginBottom: '8px'
                                    }}
                                />
                                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                                    형식: <code>기존단어(새로운단어)</code> (복수는 쉼표로 구분)
                                </div>
                            </div>

                            {/* 옵션 2: 텍스트 디자인 */}
                            <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={applyDesignChecked}
                                        onChange={(e) => setApplyDesignChecked(e.target.checked)}
                                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#a855f7' }}
                                    />
                                    옵션 B: 텍스트 윤곽선 디자인 일괄 변경 적용(흰색 실선, 투명도 100%, 너비 0.75)
                                </label>
                                
                                {applyDesignChecked && (
                                    <div className="animate-slide-up" style={{ paddingLeft: '28px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <input
                                            type="text"
                                            placeholder="특정 단어가 포함된 텍스트 박스만 변경할 경우 입력 (비워두면 전체 적용)"
                                            value={designTargetText}
                                            onChange={(e) => setDesignTargetText(e.target.value)}
                                            style={{
                                                width: '100%', padding: '10px 14px', borderRadius: '8px',
                                                background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)',
                                                color: 'var(--text-primary)', fontSize: '13.5px'
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                            <button
                                className="interactive"
                                onClick={handleBatchProcess}
                                disabled={batchPptFiles.length === 0 || isProcessingBatch || (!replaceRules.trim() && !applyDesignChecked)}
                                style={{
                                    width: '100%',
                                    padding: '16px',
                                    background: (batchPptFiles.length === 0 || isProcessingBatch || (!replaceRules.trim() && !applyDesignChecked)) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #a855f7, #3b82f6)',
                                    color: (batchPptFiles.length === 0 || isProcessingBatch || (!replaceRules.trim() && !applyDesignChecked)) ? 'var(--text-muted)' : 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontSize: '16px',
                                    fontWeight: 700,
                                    cursor: (batchPptFiles.length === 0 || isProcessingBatch || (!replaceRules.trim() && !applyDesignChecked)) ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                }}
                            >
                                {isProcessingBatch ? (
                                    <><Loader2 size={20} className="animate-spin" /> 폴더에 순차적으로 적용 및 저장 중...</>
                                ) : (
                                    <><Play size={20} /> 저장할 폴더 선택 및 일괄 편집 실행</>
                                )}
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

