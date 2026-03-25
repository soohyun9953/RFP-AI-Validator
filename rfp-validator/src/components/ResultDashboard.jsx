import React from 'react';
import { ShieldAlert, CheckCircle2, XCircle, FileWarning, AlertTriangle, ClipboardList, ArrowRightLeft, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

/** 매핑 결과를 엑셀 파일로 내보내기 */
async function exportToExcel(data) {
    const wb = XLSX.utils.book_new();

    // ── 시트1: 요구사항 매핑 현황 (RTM) ──
    const rtmRows = (data.rtm || []).map((item, idx) => ({
        '번호': idx + 1,
        '분류': item.type || '필수',
        '기준 문서 요건': item.requirement || '',
        '카테고리': item.category || '',
        '수준': item.levelLabel || '',
        '상태': item.status || '',
        '산출물 증빙 위치': item.location || '',
    }));
    const ws1 = XLSX.utils.json_to_sheet(rtmRows);
    ws1['!cols'] = [
        { wch: 5 }, { wch: 6 }, { wch: 50 }, { wch: 15 }, { wch: 8 }, { wch: 10 }, { wch: 40 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, '매핑현황(RTM)');

    // ── 시트2: 매핑 상세 ──
    const detailRows = (data.requirementMapping || []).map((item, idx) => ({
        '번호': idx + 1,
        'ID': item.id || '',
        '분류': item.type || '필수',
        '카테고리': item.category || '',
        '수준': item.levelLabel || '',
        '계층 경로': item.path || '',
        '요구사항': item.requirement || '',
        '산출물 대응 섹션': item.artifactSection || '',
        '산출물 기술 내용': (item.artifactContent || '').replace(/^"|"$/g, ''),
        '상태': item.status || '',
        '차이점': item.gap || '',
    }));
    const ws2 = XLSX.utils.json_to_sheet(detailRows);
    ws2['!cols'] = [
        { wch: 5 }, { wch: 10 }, { wch: 6 }, { wch: 15 }, { wch: 8 }, { wch: 40 },
        { wch: 50 }, { wch: 30 }, { wch: 40 }, { wch: 10 }, { wch: 50 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, '매핑상세');

    // ── 시트3: 누락 사항 ──
    if (data.omissions && data.omissions.length > 0) {
        const omissionRows = data.omissions.map((item, idx) => ({
            '번호': idx + 1,
            '항목': item.title || '',
            '근거': item.evidence || '',
            '사유': item.reason || '',
            '권고사항': item.recommendation || '',
        }));
        const ws3 = XLSX.utils.json_to_sheet(omissionRows);
        ws3['!cols'] = [
            { wch: 5 }, { wch: 30 }, { wch: 50 }, { wch: 50 }, { wch: 50 },
        ];
        XLSX.utils.book_append_sheet(wb, ws3, '누락사항');
    }
    // 저장 위치 선택 → 다운로드
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const fileName = `RFP_검증결과_${dateStr}.xlsx`;

    // File System Access API 지원 시 → 저장 위치 선택 대화상자
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{
                    description: 'Excel 파일',
                    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
                }],
            });
            const writable = await handle.createWritable();
            const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            await writable.write(new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
            await writable.close();
            return;
        } catch (err) {
            // 사용자가 취소했거나 API 오류 → 폴백
            if (err.name === 'AbortError') return; // 사용자 취소
            console.warn('showSaveFilePicker 실패, 기본 다운로드로 전환:', err);
        }
    }

    // 폴백: 기본 다운로드 (브라우저 기본 다운로드 폴더)
    XLSX.writeFile(wb, fileName);
}

export default function ResultDashboard({ data }) {
    if (!data) return null;

    return (
        <div className="glass-panel animate-fade-in" style={{ flex: 2, display: 'flex', flexDirection: 'column', padding: '24px', gap: '24px', overflowY: 'auto' }}>
            {/* 점검범위 표시 */}
            {data.inspectionScope && (
                <section style={{ padding: '14px 20px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <ClipboardList size={18} color="var(--accent-color)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-color)' }}>적용된 점검범위</span>
                        <p style={{ margin: '4px 0 0', fontSize: '14px', lineHeight: '1.5', color: 'var(--text-primary)' }}>{data.inspectionScope}</p>
                    </div>
                </section>
            )}

            {/* 1. 종합 준수 현황 */}
            <section style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '200px' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: 'var(--text-secondary)' }}>전체 준수율</h3>
                    <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: `conic-gradient(var(--success-color) ${data.score}%, rgba(255,255,255,0.1) 0)` }}>
                        <div style={{ position: 'absolute', width: '90px', height: '90px', background: 'var(--panel-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold' }}>
                            {data.score}%
                        </div>
                    </div>
                </div>

                <div className="glass-panel" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <ShieldAlert size={20} color="var(--warning-color)" />
                        <h3 style={{ margin: 0, fontSize: '18px' }}>평가 요약</h3>
                    </div>
                    <p style={{ margin: 0, lineHeight: '1.6', color: 'var(--text-primary)', fontSize: '15px' }}>
                        {data.summary}
                    </p>
                </div>
            </section>

            {/* 2. 요구사항 추적 매트릭스 (RTM) */}
            <section className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={20} color="var(--accent-color)" />
                    요구사항 매핑 현황 (Semantic Map)
                </h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--panel-border)', color: 'var(--text-secondary)' }}>
                                <th style={{ padding: '12px 16px', fontWeight: 500 }}>분류</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500 }}>기준 문서 요건</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500 }}>상태</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500 }}>산출물 증빙 위치</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.rtm.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: idx % 2 === 0 ? 'rgba(0,0,0,0.1)' : 'transparent' }}>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span style={{
                                            padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500,
                                            background: item.type === '필수' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                            color: item.type === '필수' ? 'var(--danger-color)' : 'var(--accent-color)'
                                        }}>
                                            {item.type}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>{item.requirement}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span style={{
                                            display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600,
                                            color: item.status === '이행(O)' ? 'var(--success-color)' : item.status === '미이행(X)' ? 'var(--danger-color)' : 'var(--warning-color)'
                                        }}>
                                            {item.status === '이행(O)' ? <CheckCircle2 size={16} /> : item.status === '미이행(X)' ? <XCircle size={16} /> : <AlertTriangle size={16} />}
                                            {item.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-secondary)' }}>{item.location}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* 2.5 요구사항별 산출물 매핑 상세 */}
            {data.requirementMapping && data.requirementMapping.length > 0 && (
                <section className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                            <ArrowRightLeft size={20} color="var(--accent-color)" />
                            요구사항별 산출물 매핑 상세
                        </h3>
                        <button
                            onClick={() => exportToExcel(data)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '8px 16px', fontSize: '13px', fontWeight: 600,
                                background: 'rgba(34, 197, 94, 0.12)',
                                color: '#22c55e',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                flexShrink: 0,
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(34,197,94,0.12)'}
                        >
                            <Download size={16} />
                            엑셀 저장
                        </button>
                    </div>

                    {/* 요약 통계 */}
                    {(() => {
                        const total = data.requirementMapping.length;
                        const met = data.requirementMapping.filter(i => i.status === '이행(O)').length;
                        const partial = data.requirementMapping.filter(i => i.status === '부분 이행(△)').length;
                        const unmet = data.requirementMapping.filter(i => i.status === '미이행(X)').length;
                        return (
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                                {[
                                    { label: '전체', value: total, color: 'var(--accent-color)', bg: 'rgba(59,130,246,0.1)' },
                                    { label: '이행(O)', value: met, color: 'var(--success-color)', bg: 'rgba(16,185,129,0.1)' },
                                    { label: '부분 이행(△)', value: partial, color: 'var(--warning-color)', bg: 'rgba(245,158,11,0.1)' },
                                    { label: '미이행(X)', value: unmet, color: 'var(--danger-color)', bg: 'rgba(239,68,68,0.1)' },
                                ].map((stat, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '8px 14px', borderRadius: '8px',
                                        background: stat.bg, border: `1px solid ${stat.color}22`,
                                    }}>
                                        <span style={{ fontSize: '22px', fontWeight: 700, color: stat.color }}>{stat.value}</span>
                                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{stat.label}</span>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}

                    {/* 매핑 카드 목록 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {data.requirementMapping.map((item, idx) => {
                            const statusColor = item.status === '이행(O)'
                                ? 'var(--success-color)'
                                : item.status === '부분 이행(△)'
                                    ? 'var(--warning-color)'
                                    : 'var(--danger-color)';
                            const statusBg = item.status === '이행(O)'
                                ? 'rgba(16,185,129,0.1)'
                                : item.status === '부분 이행(△)'
                                    ? 'rgba(245,158,11,0.1)'
                                    : 'rgba(239,68,68,0.1)';
                            const statusIcon = item.status === '이행(O)'
                                ? <CheckCircle2 size={14} />
                                : item.status === '부분 이행(△)'
                                    ? <AlertTriangle size={14} />
                                    : <XCircle size={14} />;

                            return (
                                <div key={idx} style={{
                                    background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '18px',
                                    borderLeft: `4px solid ${statusColor}`,
                                }}>
                                    {/* 헤더: ID + 필수/선택 + 분류 + 상태 */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                        <span style={{
                                            fontSize: '12px', fontWeight: 700, padding: '3px 8px',
                                            background: 'rgba(59,130,246,0.15)', color: 'var(--accent-color)',
                                            borderRadius: '4px', fontFamily: 'monospace',
                                        }}>{item.id}</span>
                                        <span style={{
                                            fontSize: '11px', fontWeight: 600, padding: '2px 6px',
                                            background: item.type === '필수' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
                                            color: item.type === '필수' ? 'var(--danger-color)' : 'var(--accent-color)',
                                            borderRadius: '3px',
                                            border: `1px solid ${item.type === '필수' ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.25)'}`,
                                        }}>{item.type || '필수'}</span>
                                        <span style={{
                                            fontSize: '12px', fontWeight: 500, padding: '3px 8px',
                                            background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)',
                                            borderRadius: '4px',
                                        }}>{item.category}</span>
                                        {item.levelLabel && (
                                            <span style={{
                                                fontSize: '10px', fontWeight: 500, padding: '2px 6px',
                                                background: 'rgba(168,85,247,0.1)', color: '#a855f7',
                                                borderRadius: '3px',
                                            }}>{item.levelLabel}</span>
                                        )}
                                        <span style={{
                                            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px',
                                            fontSize: '13px', fontWeight: 600, padding: '3px 10px',
                                            background: statusBg, color: statusColor, borderRadius: '4px',
                                        }}>
                                            {statusIcon}
                                            {item.status}
                                        </span>
                                    </div>

                                    {/* 계층 경로 */}
                                    {item.path && (
                                        <div style={{
                                            fontSize: '11px', color: 'var(--text-secondary)',
                                            marginBottom: '8px', padding: '4px 8px',
                                            background: 'rgba(255,255,255,0.03)', borderRadius: '4px',
                                            fontFamily: 'monospace', opacity: 0.8,
                                        }}>
                                            📂 {item.path}
                                        </div>
                                    )}

                                    {/* 요구사항 원문 */}
                                    <p style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 500, lineHeight: '1.5' }}>
                                        {item.requirement}
                                    </p>

                                    {/* 매핑 정보 2열 그리드 */}
                                    <div style={{
                                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
                                        fontSize: '13px', marginBottom: '14px',
                                    }}>
                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>
                                            <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontSize: '12px' }}>📄 산출물 대응 섹션</span>
                                            <span style={{ color: 'var(--text-primary)' }}>{item.artifactSection}</span>
                                        </div>
                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>
                                            <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontSize: '12px' }}>📝 기술 내용</span>
                                            <span style={{ color: 'var(--text-primary)', lineHeight: '1.5' }}>{item.artifactContent}</span>
                                        </div>
                                    </div>

                                    {/* 차이점 (gap) */}
                                    {item.gap && (
                                        <div style={{
                                            padding: '10px 12px', borderRadius: '6px',
                                            background: `${statusBg}`, border: `1px solid ${statusColor}33`,
                                            fontSize: '13px', lineHeight: '1.6',
                                        }}>
                                            <span style={{ fontWeight: 600, color: statusColor, marginRight: '6px' }}>⚠ 차이점:</span>
                                            <span style={{ color: 'var(--text-primary)' }}>{item.gap}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* 3. 주요 누락/비준수 상세 */}
            <section className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileWarning size={20} color="var(--danger-color)" />
                    주요 누락(Omission) 및 비준수 사항
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {data.omissions.map((omission, idx) => (
                        <div key={idx} style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--danger-color)' }}>
                            <h4 style={{ margin: '0 0 12px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ background: 'var(--danger-color)', color: '#fff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                                    {idx + 1}
                                </span>
                                {omission.title}
                            </h4>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <span style={{ color: 'var(--text-secondary)', minWidth: '80px' }}>기준 근거:</span>
                                    <span style={{ color: 'var(--text-primary)' }}>{omission.evidence}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <span style={{ color: 'var(--text-secondary)', minWidth: '80px' }}>판단 이유:</span>
                                    <span style={{ color: 'var(--text-primary)' }}>{omission.reason}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', padding: '8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                    <span style={{ color: 'var(--accent-color)', fontWeight: 600, minWidth: '80px' }}>개선 권고:</span>
                                    <span style={{ color: 'var(--text-primary)' }}>{omission.recommendation}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
