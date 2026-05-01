import React from 'react';
import { 
    EXCEL_FONT, BORDER_THIN, BORDER_THICK, BG_LABEL, 
    cellStyle, labelCellStyle, tableWrapperStyle,
    numberToKorean, formatCurrency, EstimateDraft
} from '../../utils/estimateUtils';

export const TitleComponent = React.memo(({ text, logoUrl }: { text: string; logoUrl?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', marginTop: '4px', paddingBottom: '0px', borderBottom: '2.5px solid #000', width: '100%' }}>
        <div style={{ flex: '0 0 250px', display: 'flex', alignItems: 'center' }}>
            {logoUrl && (
                <img
                    src={logoUrl}
                    alt="Logo"
                    style={{ height: '115px', width: 'auto', objectFit: 'contain' }}
                />
            )}
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', paddingBottom: '10px' }}>
            <span style={{ fontSize: '28pt', fontWeight: 900, fontFamily: EXCEL_FONT, letterSpacing: '0.5em', color: '#000', textAlign: 'center' }}>
                {text}
            </span>
        </div>
        <div style={{ flex: '0 0 200px' }}></div>
    </div>
));

export const InfoTableComponent = React.memo(({ draft, isEdit, updateDraft }: any) => {
    const inputStyle: React.CSSProperties = { width: '100%', border: 'none', outline: 'none', background: 'transparent', fontFamily: EXCEL_FONT, fontSize: '10pt', padding: '0 2px' };
    const wrapInput = (field: keyof EstimateDraft, placeholder = '') =>
        isEdit ? <input value={(draft[field] as string) || ''} onChange={e => updateDraft(field, e.target.value)} style={inputStyle} placeholder={placeholder} />
            : <span>{(draft[field] as string) || placeholder || ''}</span>;

    const isTransaction = draft.documentType === 'transaction';
    const accParts = (draft.supplierAccount || '').split(' ');
    const bank = accParts[0] || '';
    const accNo = accParts.slice(1).join(' ') || '';
    const rowHeight = '16.6%';

    return (
        <div style={{ display: 'flex', gap: '20px', marginBottom: '5px', alignItems: 'stretch' }}>
            <div style={{ ...tableWrapperStyle, flex: 1, marginBottom: 0 }}>
                <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <colgroup><col style={{ width: '80px' }} /><col style={{ width: 'auto' }} /></colgroup>
                    <tbody>
                        <tr>
                            <td colSpan={2} style={{ ...labelCellStyle(), borderBottom: BORDER_THIN, height: '28px', fontSize: '10pt', fontWeight: 900 }}>공 급 받 는 자</td>
                        </tr>
                        <tr>
                            <td style={{ ...labelCellStyle(), borderBottom: BORDER_THIN, borderRight: BORDER_THIN, height: rowHeight }}>업 체 명</td>
                            <td style={{ ...cellStyle(), borderBottom: BORDER_THIN, fontWeight: 700 }}>
                                {isEdit ? (
                                    <input value={draft.clientCompany} onChange={e => updateDraft('clientCompany', e.target.value)} style={{ ...inputStyle, fontWeight: 700 }} />
                                ) : (draft.clientCompany || '')}
                            </td>
                        </tr>
                        <tr>
                            <td style={{ ...labelCellStyle(), borderBottom: BORDER_THIN, borderRight: BORDER_THIN, height: rowHeight }}>현 장 명</td>
                            <td style={{ ...cellStyle(), borderBottom: BORDER_THIN }}>{wrapInput('projectName')}</td>
                        </tr>
                        <tr>
                            <td style={{ ...labelCellStyle(), borderBottom: BORDER_THIN, borderRight: BORDER_THIN, height: rowHeight }}>결제조건</td>
                            <td style={{ ...cellStyle(), borderBottom: BORDER_THIN }}>{wrapInput('paymentTerms')}</td>
                        </tr>
                        <tr>
                            <td style={{ ...labelCellStyle(), borderBottom: BORDER_THIN, borderRight: BORDER_THIN, height: rowHeight }}>비&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;고</td>
                            <td style={{ ...cellStyle(), borderBottom: BORDER_THIN }}>{wrapInput('notes')}</td>
                        </tr>
                        <tr>
                            <td style={{ ...labelCellStyle(), border: isTransaction ? BORDER_THIN : 'none', borderRight: BORDER_THIN, height: rowHeight }}>{isTransaction ? '작성일자' : '견적일자'}</td>
                            <td style={{ ...cellStyle(), border: isTransaction ? BORDER_THIN : 'none' }}>{wrapInput('issueDate')}</td>
                        </tr>
                        {isTransaction && (
                            <tr>
                                <td style={{ ...labelCellStyle(), borderRight: BORDER_THIN, height: rowHeight }}>담 당 자</td>
                                <td style={{ ...cellStyle() }}>{wrapInput('clientName')}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div style={{ ...tableWrapperStyle, flex: 1.3, marginBottom: 0 }}>
                <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <colgroup><col style={{ width: '85px' }} /><col style={{ width: 'auto' }} /><col style={{ width: '75px' }} /><col style={{ width: 'auto' }} /></colgroup>
                    <tbody>
                        <tr>
                            <td colSpan={4} style={{ ...labelCellStyle(), borderBottom: BORDER_THIN, height: '28px', fontSize: '10pt', fontWeight: 900 }}>공 급 자</td>
                        </tr>
                        <tr>
                            <td style={{ ...labelCellStyle(), borderBottom: BORDER_THIN, borderRight: BORDER_THIN, height: rowHeight }}>상&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;호</td>
                            <td colSpan={3} style={{ ...cellStyle(), borderBottom: BORDER_THIN, fontWeight: 700, position: 'relative' }}>
                                {wrapInput('supplierCompany')}
                                <img src="https://firebasestorage.googleapis.com/v0/b/cyee-9c1e4.firebasestorage.app/o/%EC%B2%AD%EC%97%B0%EB%8F%84%EC%9E%A5.jpg?alt=media&token=04a70f81-44dc-406d-ab92-b438d264e537" alt="도장" style={{ position: 'absolute', top: '15px', right: '10px', width: '48px', height: '48px', mixBlendMode: 'multiply', opacity: 0.9, pointerEvents: 'none', zIndex: 10 }} />
                            </td>
                        </tr>
                        <tr>
                            <td style={{ ...labelCellStyle(), borderBottom: BORDER_THIN, borderRight: BORDER_THIN, height: rowHeight }}>등록번호</td>
                            <td style={{ ...cellStyle(), borderBottom: BORDER_THIN, borderRight: BORDER_THIN, fontWeight: 700 }}>{wrapInput('supplierBizNo')}</td>
                            <td style={{ ...labelCellStyle(), borderBottom: BORDER_THIN, borderRight: BORDER_THIN }}>대 표</td>
                            <td style={{ ...cellStyle(), borderBottom: BORDER_THIN }}>{wrapInput('supplierName')}</td>
                        </tr>
                        <tr>
                            <td style={{ ...labelCellStyle(), borderBottom: BORDER_THIN, borderRight: BORDER_THIN, height: rowHeight }}>주&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;소</td>
                            <td colSpan={3} style={{ ...cellStyle(), borderBottom: BORDER_THIN }}>{wrapInput('supplierAddress')}</td>
                        </tr>
                        {isTransaction ? (
                            <>
                                <tr>
                                    <td style={{ ...labelCellStyle(), borderBottom: BORDER_THIN, borderRight: BORDER_THIN, height: rowHeight }}>전&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;화</td>
                                    <td style={{ ...cellStyle(), borderBottom: BORDER_THIN, borderRight: BORDER_THIN }}>{wrapInput('supplierContact')}</td>
                                    <td style={{ ...labelCellStyle(), borderBottom: BORDER_THIN, borderRight: BORDER_THIN }}>팩 스</td>
                                    <td style={{ ...cellStyle(), borderBottom: BORDER_THIN }}>{wrapInput('supplierFax')}</td>
                                </tr>
                                <tr>
                                    <td style={{ ...labelCellStyle(), borderRight: rowHeight, height: rowHeight }}>계&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;좌</td>
                                    <td colSpan={3} style={{ ...cellStyle() }}>{wrapInput('supplierAccount')}</td>
                                </tr>
                            </>
                        ) : (
                            <>
                                <tr>
                                    <td style={{ ...labelCellStyle(), borderBottom: BORDER_THIN, borderRight: BORDER_THIN, height: rowHeight }}>은&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;행</td>
                                    <td style={{ ...cellStyle(), borderBottom: BORDER_THIN, borderRight: BORDER_THIN }}>{bank}</td>
                                    <td style={{ ...labelCellStyle(), borderBottom: BORDER_THIN, borderRight: BORDER_THIN, fontSize: '9pt', padding: '0 2px' }}>계좌번호</td>
                                    <td style={{ ...cellStyle(), borderBottom: BORDER_THIN }}>{accNo}</td>
                                </tr>
                                <tr>
                                    <td style={{ ...labelCellStyle(), borderBottom: BORDER_THIN, borderRight: BORDER_THIN, height: rowHeight }}>전&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;화</td>
                                    <td style={{ ...cellStyle(), borderBottom: BORDER_THIN, borderRight: BORDER_THIN }}>{wrapInput('supplierContact')}</td>
                                    <td style={{ ...labelCellStyle(), borderBottom: BORDER_THIN, borderRight: BORDER_THIN }}>팩 스</td>
                                    <td style={{ ...cellStyle(), borderBottom: BORDER_THIN }}>{wrapInput('supplierFax')}</td>
                                </tr>
                                <tr>
                                    <td style={{ ...labelCellStyle(), borderRight: BORDER_THIN, height: rowHeight }}>담 당 자</td>
                                    <td style={{ ...cellStyle(), borderRight: BORDER_THIN }}>{wrapInput('supplierManager')}</td>
                                    <td style={{ ...labelCellStyle(), borderRight: BORDER_THIN }}>연 락 처</td>
                                    <td style={{ ...cellStyle() }}>{wrapInput('supplierManagerContact')}</td>
                                </tr>
                            </>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
});

export const AmountBarComponent = React.memo(({ subtotal, totalAmt, taxAmt, label, isTransaction, draft }: any) => {
    const vatRate = draft.vatRate || 10;
    const currentTaxAmt = taxAmt || (subtotal ? Math.round(subtotal * (vatRate / 100)) : 0);

    return (
        <div style={{ ...tableWrapperStyle, marginBottom: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                    <col style={{ width: '80px' }} />
                    <col style={{ width: '45px' }} />
                    <col style={{ width: 'auto' }} />
                    <col style={{ width: '165px' }} />
                    <col style={{ width: '155px' }} />
                    <col style={{ width: '60px' }} />
                    <col style={{ width: '180px' }} />
                </colgroup>
                <tbody>
                    <tr style={{ height: '36px' }}>
                        <td style={{ ...labelCellStyle(), borderRight: BORDER_THIN }}>{label || (isTransaction ? '합계금액' : '금      액')}</td>
                        <td style={{ ...labelCellStyle(), borderRight: BORDER_THIN }}>일 금</td>
                        <td style={{ ...cellStyle(), fontWeight: 700, fontSize: '9.5pt', textAlign: 'center', borderRight: BORDER_THIN }}>일금 {numberToKorean(totalAmt)}원 정</td>
                        <td style={{ ...cellStyle(), fontSize: '9pt', textAlign: 'right', paddingRight: '8px', borderRight: BORDER_THIN }}>공급가액: {formatCurrency(subtotal)}</td>
                        <td style={{ ...cellStyle(), fontSize: '9pt', textAlign: 'right', paddingRight: '8px', borderRight: BORDER_THIN }}>부가세: {formatCurrency(currentTaxAmt)}</td>
                        <td style={{ ...labelCellStyle(), borderRight: BORDER_THIN }}>총액</td>
                        <td style={{ ...cellStyle(), fontWeight: 900, fontSize: '9.5pt', textAlign: 'right', paddingRight: '12px', color: '#0056b3' }}>{formatCurrency(totalAmt)} 원</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
});
