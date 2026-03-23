import React, { useState, useRef, useCallback } from 'react';
import { Target, FileText, Play, Loader2, Upload, X, ClipboardList, AlertCircle, FileSpreadsheet } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

// Vite 환경을 고려한 PDF 워커 파일 내부 임포트 방식 (안정적 번들링)
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// ── 파일 처리 유틸 ─────────────────────────────────────────

/** 파일 확장자 가져오기 */
function getFileExtension(filename) {
    return (filename || '').split('.').pop().toLowerCase();
}

/** 지원 파일 확장자 매핑 */
const SUPPORTED_EXTENSIONS = {
    text: ['txt', 'md', 'csv', 'json', 'html', 'xml'],
    pdf: ['pdf'],
    excel: ['xlsx', 'xls'],
    pptx: ['pptx'],
    hwpx: ['hwpx'],
    unsupported: ['hwp', 'ppt', 'docx', 'doc'],
};

const ALL_ACCEPT = '.txt,.md,.csv,.json,.html,.xml,.pdf,.xlsx,.xls,.doc,.docx,.hwp,.hwpx,.ppt,.pptx';

/** 확장자 → 파일 타입 분류 */
function classifyFile(ext) {
    for (const [type, exts] of Object.entries(SUPPORTED_EXTENSIONS)) {
        if (exts.includes(ext)) return type;
    }
    return 'text'; // 알 수 없으면 텍스트로 시도
}

// ── PDF 텍스트 추출 (좌표 기반 줄 재구성) ──────────────────────
async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const allPageLines = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const items = textContent.items;
        if (!items || items.length === 0) continue;

        const validItems = items.filter(item =>
            item.str && item.str.trim().length > 0 && item.transform
        );
        if (validItems.length === 0) continue;

        const LINE_THRESHOLD = 3;
        const lines = [];
        let currentLine = [];
        let currentY = null;

        const sorted = [...validItems].sort((a, b) => {
            const yDiff = b.transform[5] - a.transform[5];
            if (Math.abs(yDiff) > LINE_THRESHOLD) return yDiff;
            return a.transform[4] - b.transform[4];
        });

        for (const item of sorted) {
            const y = item.transform[5];
            const x = item.transform[4];
            if (currentY === null || Math.abs(y - currentY) > LINE_THRESHOLD) {
                if (currentLine.length > 0) lines.push(currentLine);
                currentLine = [{ text: item.str, x, width: item.width || 0 }];
                currentY = y;
            } else {
                currentLine.push({ text: item.str, x, width: item.width || 0 });
            }
        }
        if (currentLine.length > 0) lines.push(currentLine);

        for (const lineItems of lines) {
            lineItems.sort((a, b) => a.x - b.x);
            let lineText = '';
            for (let i = 0; i < lineItems.length; i++) {
                const item = lineItems[i];
                if (i > 0) {
                    const prev = lineItems[i - 1];
                    const gap = item.x - (prev.x + prev.width);
                    if (gap > 2) lineText += ' ';
                }
                lineText += item.text;
            }
            const trimmed = lineText.trim();
            if (trimmed.length > 0) allPageLines.push(trimmed);
        }

        if (pageNum < pdf.numPages) allPageLines.push('');
    }

    return allPageLines
        .reduce((acc, line) => {
            if (line === '' && acc.length > 0 && acc[acc.length - 1] === '') return acc;
            acc.push(line);
            return acc;
        }, [])
        .join('\n')
        .trim();
}

// ── 엑셀 텍스트 추출 ─────────────────────────────────────────
async function extractTextFromExcel(file) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const allText = [];

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        // 시트 이름 추가 (여러 시트인 경우)
        if (workbook.SheetNames.length > 1) {
            allText.push(`[시트: ${sheetName}]`);
        }

        // 셀 데이터를 2D 배열로 변환
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        for (const row of rows) {
            // 빈 행 건너뛰기
            const cells = row.map(cell => String(cell ?? '').trim()).filter(c => c.length > 0);
            if (cells.length === 0) continue;

            // 셀을 탭 또는 " | "로 연결 (셀이 1개면 그대로, 여러 개면 구분자 포함)
            if (cells.length === 1) {
                allText.push(cells[0]);
            } else {
                allText.push(cells.join(' | '));
            }
        }

        allText.push(''); // 시트 간 구분
    }

    return allText.join('\n').trim();
}

// ── PPTX 텍스트 추출 ─────────────────────────────────────────
async function extractTextFromPPTX(file) {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const textBlocks = [];
    
    const slideRegex = /^ppt\/slides\/slide\d+\.xml$/;
    const slideFiles = Object.keys(zip.files).filter(name => slideRegex.test(name));
    
    slideFiles.sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0], 10);
        const numB = parseInt(b.match(/\d+/)[0], 10);
        return numA - numB;
    });

    for (const fileName of slideFiles) {
        const content = await zip.files[fileName].async('string');
        const regex = /<a:t.*?>([\s\S]*?)<\/a:t>/g;
        let match;
        const slideText = [];
        while ((match = regex.exec(content)) !== null) {
            slideText.push(match[1].replace(/<[^>]+>/g, '')); 
        }
        if (slideText.length > 0) {
            textBlocks.push(`[슬라이드 ${fileName.match(/\d+/)[0]}]\n` + slideText.join(' '));
        }
    }
    
    return textBlocks.join('\n\n').trim();
}

// ── HWPX 텍스트 추출 ─────────────────────────────────────────
async function extractTextFromHWPX(file) {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const textBlocks = [];
    
    const sectionRegex = /^Contents\/section\d+\.xml$/;
    const sectionFiles = Object.keys(zip.files).filter(name => sectionRegex.test(name));
    
    sectionFiles.sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0], 10);
        const numB = parseInt(b.match(/\d+/)[0], 10);
        return numA - numB;
    });

    for (const fileName of sectionFiles) {
        const content = await zip.files[fileName].async('string');
        const regex = /<hp:t.*?>([\s\S]*?)<\/hp:t>/g;
        let match;
        const sectionText = [];
        while ((match = regex.exec(content)) !== null) {
            let text = match[1].replace(/<[^>]+>/g, '');
            // XML 엔티티 디코딩
            text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
            sectionText.push(text);
        }
        if (sectionText.length > 0) {
            textBlocks.push(sectionText.join(' '));
        }
    }
    
    return textBlocks.join('\n\n').trim();
}

// ── 통합 파일 처리 함수 ───────────────────────────────────────
async function processFile(file) {
    const ext = getFileExtension(file.name);
    const type = classifyFile(ext);

    switch (type) {
        case 'pdf': {
            const text = await extractTextFromPDF(file);
            if (!text || text.trim().length === 0) {
                throw new Error('PDF에서 텍스트를 추출하지 못했습니다. 이미지 기반 PDF일 수 있습니다.');
            }
            return text;
        }
        case 'excel': {
            const text = await extractTextFromExcel(file);
            if (!text || text.trim().length === 0) {
                throw new Error('엑셀 파일에서 데이터를 추출하지 못했습니다. 파일이 비어있을 수 있습니다.');
            }
            return text;
        }
        case 'pptx': {
            const text = await extractTextFromPPTX(file);
            if (!text || text.trim().length === 0) {
                throw new Error('PPTX 파일에서 텍스트를 추출하지 못했습니다.');
            }
            return text;
        }
        case 'hwpx': {
            const text = await extractTextFromHWPX(file);
            if (!text || text.trim().length === 0) {
                throw new Error('HWPX 파일에서 텍스트를 추출하지 못했습니다.');
            }
            return text;
        }
        case 'unsupported':
            throw new Error(
                `${ext.toUpperCase()} 구형 바이너리 파일은 브라우저 공간에서 직접 읽을 수 없습니다. (비표준 압축포맷). 가능한 최신 포맷인 HWPX(.hwpx) 나 PPTX(.pptx), 또는 PDF로 변환 후 업로드해 주세요.`
            );
        case 'text':
        default: {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve(ev.target.result);
                reader.onerror = () => reject(new Error('파일 읽기에 실패했습니다.'));
                reader.readAsText(file, 'UTF-8');
            });
        }
    }
}

// ── 파일 타입 아이콘/라벨 ──────────────────────────────────────
function getFileTypeLabel(ext) {
    const type = classifyFile(ext);
    switch (type) {
        case 'pdf': return { label: 'PDF', color: '#ef4444' };
        case 'excel': return { label: 'Excel', color: '#22c55e' };
        case 'pptx': return { label: 'PPTX', color: '#f97316' };
        case 'hwpx': return { label: 'HWPX', color: '#0ea5e9' };
        case 'text': return { label: ext.toUpperCase(), color: '#3b82f6' };
        default: return { label: ext.toUpperCase(), color: '#9ca3af' };
    }
}

// ── FileUploadArea 컴포넌트 ──────────────────────────────────
function FileUploadArea({ label, icon: Icon, fileName, onFileSelect, onFileClear, textValue, onTextChange, placeholder, isLoading, loadError }) {
    const fileRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    // 파일 처리 공통 핸들러
    const handleFile = useCallback(async (file) => {
        if (!file) return;
        onFileSelect(file.name, '', true); // 로딩 시작
        try {
            const text = await processFile(file);
            onFileSelect(file.name, text, false);
        } catch (err) {
            console.error('파일 처리 오류:', err);
            onFileSelect(file.name, '', false, err.message);
        }
    }, [onFileSelect]);

    // 파일 선택 핸들러
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        handleFile(file);
        e.target.value = ''; // input 초기화
    };

    // 드래그앤드롭 핸들러
    const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    const fileExt = fileName ? getFileExtension(fileName) : null;
    const fileTypeInfo = fileExt ? getFileTypeLabel(fileExt) : null;
    const loadingLabel = fileExt
        ? classifyFile(fileExt) === 'pdf' ? 'PDF 추출 중...'
            : classifyFile(fileExt) === 'excel' ? 'Excel 변환 중...'
                : classifyFile(fileExt) === 'pptx' ? 'PPTX 추출 중...'
                    : classifyFile(fileExt) === 'hwpx' ? 'HWPX 파싱 중...'
                        : '파일 읽는 중...'
        : '파일 처리 중...';

    return (
        <div
            style={{
                display: 'flex', flexDirection: 'column', flex: 1, gap: '8px',
                position: 'relative',
            }}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <label style={{
                fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: '6px',
            }}>
                <Icon size={16} /> {label}
            </label>

            {/* 파일 선택 버튼 + 파일명 */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                    onClick={() => fileRef.current?.click()}
                    disabled={isLoading}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 14px', fontSize: '13px', fontWeight: 500,
                        background: 'rgba(59, 130, 246, 0.12)',
                        color: 'var(--accent-color)',
                        border: '1px dashed rgba(59,130,246,0.4)',
                        borderRadius: '6px',
                        cursor: isLoading ? 'wait' : 'pointer',
                        transition: 'all 0.2s',
                        flexShrink: 0,
                        opacity: isLoading ? 0.6 : 1,
                    }}
                    onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.12)'; }}
                >
                    {isLoading
                        ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        : <Upload size={14} />}
                    {isLoading ? loadingLabel : '파일 선택'}
                </button>
                {fileName && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '6px 10px', fontSize: '12px',
                        background: loadError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: loadError ? 'var(--danger-color)' : 'var(--success-color)',
                        borderRadius: '6px',
                        border: `1px solid ${loadError ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                        overflow: 'hidden', flex: 1,
                    }}>
                        {fileTypeInfo && (
                            <span style={{
                                fontSize: '10px', padding: '1px 4px', borderRadius: '3px',
                                background: `${fileTypeInfo.color}22`, color: fileTypeInfo.color,
                                fontWeight: 600, flexShrink: 0,
                            }}>{fileTypeInfo.label}</span>
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fileName}
                        </span>
                        <button
                            onClick={onFileClear}
                            style={{
                                background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                                cursor: 'pointer', padding: '2px', display: 'flex', flexShrink: 0,
                            }}
                        >
                            <X size={12} />
                        </button>
                    </div>
                )}
                <input
                    ref={fileRef}
                    type="file"
                    accept={ALL_ACCEPT}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />
            </div>

            {/* 에러 메시지 */}
            {loadError && (
                <div style={{
                    padding: '8px 12px', fontSize: '12px', lineHeight: '1.5',
                    background: 'rgba(239, 68, 68, 0.08)',
                    color: 'var(--danger-color)',
                    borderRadius: '6px',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    display: 'flex', gap: '6px', alignItems: 'flex-start',
                }}>
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                    {loadError}
                </div>
            )}

            {/* 텍스트 영역 + 드래그앤드롭 오버레이 */}
            <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
                <textarea
                    placeholder={placeholder}
                    value={textValue}
                    onChange={e => onTextChange(e.target.value)}
                    style={{ flex: 1, resize: 'none', lineHeight: '1.5', width: '100%' }}
                />
                {/* 드래그 오버레이 */}
                {isDragging && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(59, 130, 246, 0.12)',
                        border: '2px dashed var(--accent-color)',
                        borderRadius: '8px',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: '8px',
                        zIndex: 10,
                        backdropFilter: 'blur(4px)',
                        pointerEvents: 'none',
                    }}>
                        <Upload size={32} color="var(--accent-color)" />
                        <span style={{
                            fontSize: '14px', fontWeight: 600,
                            color: 'var(--accent-color)',
                        }}>
                            파일을 여기에 놓으세요
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            PDF, Excel, TXT 파일 지원
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── 메인 InputSection ──────────────────────────────────────
export default function InputSection({ onAnalyze, isAnalyzing }) {
    const [guideline, setGuideline] = useState('');
    const [artifact, setArtifact] = useState('');
    const [inspectionScope, setInspectionScope] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [guidelineFile, setGuidelineFile] = useState('');
    const [artifactFile, setArtifactFile] = useState('');
    const [guidelineLoading, setGuidelineLoading] = useState(false);
    const [artifactLoading, setArtifactLoading] = useState(false);
    const [guidelineError, setGuidelineError] = useState(null);
    const [artifactError, setArtifactError] = useState(null);

    const handleGuidelineFile = (name, content, loading = false, error = null) => {
        setGuidelineFile(name);
        setGuidelineLoading(loading);
        setGuidelineError(error);
        if (content) setGuideline(content);
        if (error) setGuideline('');
    };

    const handleArtifactFile = (name, content, loading = false, error = null) => {
        setArtifactFile(name);
        setArtifactLoading(loading);
        setArtifactError(error);
        if (content) setArtifact(content);
        if (error) setArtifact('');
    };

    return (
        <div className="glass-panel animate-fade-in" style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            padding: '24px', gap: '20px',
            minWidth: '400px', maxWidth: '500px',
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                borderBottom: '1px solid var(--panel-border)', paddingBottom: '16px',
            }}>
                <FileText size={20} color="var(--accent-color)" />
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>데이터 입력</h2>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                    <span style={{
                        fontSize: '10px', padding: '3px 6px',
                        background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                        borderRadius: '4px', fontWeight: 600,
                    }}>PDF</span>
                    <span style={{
                        fontSize: '10px', padding: '3px 6px',
                        background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                        borderRadius: '4px', fontWeight: 600,
                    }}>Excel</span>
                    <span style={{
                        fontSize: '10px', padding: '3px 6px',
                        background: 'rgba(249,115,22,0.1)', color: '#f97316',
                        borderRadius: '4px', fontWeight: 600,
                    }}>PPTX</span>
                    <span style={{
                        fontSize: '10px', padding: '3px 6px',
                        background: 'rgba(14,165,233,0.1)', color: '#0ea5e9',
                        borderRadius: '4px', fontWeight: 600,
                    }}>HWPX</span>
                    <span style={{
                        fontSize: '10px', padding: '3px 6px',
                        background: 'rgba(59,130,246,0.1)', color: '#3b82f6',
                        borderRadius: '4px', fontWeight: 600,
                    }}>TXT</span>
                </div>
            </div>

            <FileUploadArea
                label="1. 기준 문서 (가이드라인 / RFP)"
                icon={Target}
                fileName={guidelineFile}
                onFileSelect={handleGuidelineFile}
                onFileClear={() => { setGuidelineFile(''); setGuideline(''); setGuidelineError(null); }}
                textValue={guideline}
                onTextChange={setGuideline}
                placeholder="파일을 드래그하여 놓거나, 파일 선택 버튼을 클릭하세요.&#10;직접 텍스트를 붙여넣을 수도 있습니다."
                isLoading={guidelineLoading}
                loadError={guidelineError}
            />

            <FileUploadArea
                label="2. 검증할 산출물 (수행 계획서 등)"
                icon={FileText}
                fileName={artifactFile}
                onFileSelect={handleArtifactFile}
                onFileClear={() => { setArtifactFile(''); setArtifact(''); setArtifactError(null); }}
                textValue={artifact}
                onTextChange={setArtifact}
                placeholder="파일을 드래그하여 놓거나, 파일 선택 버튼을 클릭하세요.&#10;직접 텍스트를 붙여넣을 수도 있습니다."
                isLoading={artifactLoading}
                loadError={artifactError}
            />

            {/* 3. 점검범위 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{
                    fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                    <ClipboardList size={16} /> 3. 점검범위 및 주요 점검 사항 (선택)
                </label>
                <textarea
                    placeholder="예: CSR-011을 기준으로 검증해주세요."
                    value={inspectionScope}
                    onChange={e => setInspectionScope(e.target.value)}
                    style={{ resize: 'none', lineHeight: '1.5', minHeight: '90px', maxHeight: '140px' }}
                />
            </div>

            <button
                className="primary"
                onClick={() => onAnalyze(guideline, artifact, inspectionScope)}
                disabled={isAnalyzing || guidelineLoading || artifactLoading || (!guideline && !artifact)}
                style={{
                    marginTop: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '8px', padding: '16px', fontSize: '16px',
                    opacity: (isAnalyzing || guidelineLoading || artifactLoading || (!guideline && !artifact)) ? 0.6 : 1,
                    cursor: (isAnalyzing || guidelineLoading || artifactLoading || (!guideline && !artifact)) ? 'not-allowed' : 'pointer',
                }}
            >
                {isAnalyzing ? (
                    <>
                        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                        AI 검증 진행 중...
                    </>
                ) : (
                    <>
                        <Play size={20} />
                        엄격한 검증 시작 (4단계 추론)
                    </>
                )}
            </button>

            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
}
