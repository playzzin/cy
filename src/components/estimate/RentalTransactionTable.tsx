import React from 'react';
import {
    EXCEL_FONT, BORDER_THIN, BORDER_THICK,
    cellStyle, labelCellStyle, tableWrapperStyle,
    formatCurrency, formatDecimal, createItem
} from '../../utils/estimateUtils';

const RENTAL_UNITS = ['EA', 'SET', '㎡', '㎥', 'M', 'DAY'];

const parseFormattedNumber = (value: string): number => {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatEditableDecimal = (value: number | null | undefined): string => (
    value ? formatDecimal(value) : ''
);

const formatEditableCurrency = (value: number | null | undefined): string => (
    value ? formatCurrency(value) : ''
);

export const RentalTransactionTable = React.memo(({ draft, itemsWithCalc, isEdit, updateItem, setDraft }: any) => {
    const inputStyle: React.CSSProperties = {
        width: '100%',
        border: 'none',
        outline: 'none',
        background: 'transparent',
        fontFamily: EXCEL_FONT,
        fontSize: 'calc(9pt + var(--estimate-font-size-offset, 0pt))',
        textAlign: 'center'
    };
    const vatRate = draft.vatRate || 10;
    const noteColumnStyle: React.CSSProperties = {
        position: 'sticky',
        right: isEdit ? '55px' : 0,
        zIndex: 2,
        textAlign: 'center',
        boxShadow: '-2px 0 4px rgba(15, 23, 42, 0.08)'
    };
    const deleteColumnStyle: React.CSSProperties = {
        position: 'sticky',
        right: 0,
        zIndex: 3
    };

    return (
        <div style={{ ...tableWrapperStyle, width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: isEdit ? '1320px' : '1265px', margin: '0 auto', borderCollapse: 'collapse', tableLayout: 'fixed', whiteSpace: 'nowrap' }}>
                <colgroup>
                    <col style={{ width: '110px' }} />
                    <col style={{ width: '230px' }} />
                    <col style={{ width: '65px' }} />
                    <col style={{ width: '75px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '88px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '118px' }} />
                    <col style={{ width: '105px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '155px' }} />
                    {isEdit && <col style={{ width: '55px' }} />}
                </colgroup>
                <thead>
                    <tr style={{ height: 'calc(34px + var(--estimate-table-row-offset, 0px))' }}>
                        <th style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>날짜</th>
                        <th style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>품목</th>
                        <th style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>단위</th>
                        <th style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>수량</th>
                        <th style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>기본료</th>
                        <th style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>사용일수</th>
                        <th style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>단가</th>
                        <th style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>공급가</th>
                        <th style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>부가세</th>
                        <th style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>합계</th>
                        <th style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK, ...noteColumnStyle, zIndex: 4 })}>비고</th>
                        {isEdit && <th style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK, ...deleteColumnStyle, zIndex: 5 })}>삭제</th>}
                    </tr>
                </thead>
                <tbody style={{ borderBottom: BORDER_THICK }}>
                    {itemsWithCalc.map((item: any) => {
                        const supplyAmt = item.amount || 0;
                        const vatAmt = draft.includeVat ? Math.round(supplyAmt * vatRate / 100) : 0;
                        const lineTotal = supplyAmt + vatAmt;

                        return (
                            <tr key={item.id} style={{ height: 'calc(28px + var(--estimate-table-row-offset, 0px))' }}>
                                <td style={cellStyle({ border: BORDER_THIN, textAlign: 'center', padding: '4px' })}>
                                    {isEdit ? (
                                        <input value={item.itemDate || ''} onChange={e => updateItem(item.id, 'itemDate', e.target.value)} style={inputStyle} placeholder="날짜" />
                                    ) : (item.itemDate || '')}
                                </td>
                                <td style={cellStyle({ border: BORDER_THIN, textAlign: 'left', padding: '4px 6px' })}>
                                    {isEdit ? (
                                        <input value={item.section || item.label || ''} onChange={e => updateItem(item.id, 'section', e.target.value)} style={{ ...inputStyle, textAlign: 'left' }} placeholder="품목/규격" />
                                    ) : (item.section || item.label || '')}
                                </td>
                                <td style={cellStyle({ border: BORDER_THIN, padding: '4px' })}>
                                    {isEdit ? (
                                        <>
                                            <input value={item.unit || ''} list="rental-units-list" onChange={e => updateItem(item.id, 'unit', e.target.value)} style={inputStyle} />
                                            <datalist id="rental-units-list">{RENTAL_UNITS.map(u => <option key={u} value={u} />)}</datalist>
                                        </>
                                    ) : item.unit}
                                </td>
                                <td style={cellStyle({ border: BORDER_THIN, textAlign: 'right', padding: '4px 6px' })}>
                                    {isEdit ? (
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={formatEditableDecimal(item.quantity)}
                                            onChange={e => updateItem(item.id, 'quantity', parseFormattedNumber(e.target.value))}
                                            style={{ ...inputStyle, textAlign: 'right' }}
                                        />
                                    ) : (item.quantity ? formatDecimal(item.quantity) : '')}
                                </td>
                                <td style={cellStyle({ border: BORDER_THIN, textAlign: 'right', padding: '4px 6px' })}>
                                    {isEdit ? (
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={formatEditableCurrency(item.finalUnitPrice)}
                                            onChange={e => updateItem(item.id, 'finalUnitPrice', parseFormattedNumber(e.target.value))}
                                            style={{ ...inputStyle, textAlign: 'right' }}
                                        />
                                    ) : (item.finalUnitPrice ? formatCurrency(item.finalUnitPrice) : '')}
                                </td>
                                <td style={cellStyle({ border: BORDER_THIN, textAlign: 'right', padding: '4px 6px' })}>
                                    {isEdit ? (
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={formatEditableDecimal(item.period)}
                                            onChange={e => updateItem(item.id, 'period', parseFormattedNumber(e.target.value))}
                                            style={{ ...inputStyle, textAlign: 'right' }}
                                        />
                                    ) : (item.period ? formatDecimal(item.period) : '')}
                                </td>
                                <td style={cellStyle({ border: BORDER_THIN, textAlign: 'right', padding: '4px 6px' })}>
                                    {isEdit ? (
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={formatEditableCurrency(item.rentalUnitPrice)}
                                            onChange={e => updateItem(item.id, 'rentalUnitPrice', parseFormattedNumber(e.target.value))}
                                            style={{ ...inputStyle, textAlign: 'right' }}
                                        />
                                    ) : (item.rentalUnitPrice ? formatCurrency(item.rentalUnitPrice) : '')}
                                </td>
                                <td style={cellStyle({ border: BORDER_THIN, textAlign: 'right', padding: '4px 6px', fontWeight: 700 })}>{supplyAmt ? formatCurrency(supplyAmt) : ''}</td>
                                <td style={cellStyle({ border: BORDER_THIN, textAlign: 'right', padding: '4px 6px' })}>{vatAmt ? formatCurrency(vatAmt) : ''}</td>
                                <td style={cellStyle({ border: BORDER_THIN, textAlign: 'right', padding: '4px 6px', fontWeight: 900 })}>{lineTotal ? formatCurrency(lineTotal) : ''}</td>
                                <td style={cellStyle({ border: BORDER_THIN, padding: '4px 6px', overflow: 'hidden', ...noteColumnStyle })}>
                                    {isEdit ? <input value={item.note || ''} onChange={e => updateItem(item.id, 'note', e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} /> : item.note}
                                </td>
                                {isEdit && (
                                    <td style={cellStyle({ border: BORDER_THIN, padding: '0', ...deleteColumnStyle })}>
                                        <button onClick={() => setDraft((d: any) => ({ ...d, items: d.items.filter((it: any) => it.id !== item.id) }))} style={{ width: '100%', height: '100%', background: '#ef5350', color: '#fff', border: 'none', cursor: 'pointer' }}>×</button>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                    {!isEdit && Array.from({ length: Math.max(0, 15 - itemsWithCalc.length) }).map((_, i) => (
                        <tr key={`rental-empty-${i}`} style={{ height: 'calc(28px + var(--estimate-table-row-offset, 0px))' }}>
                            {Array.from({ length: 11 }).map((__, col) => (
                                <td key={col} style={cellStyle({ border: BORDER_THIN, ...(col === 10 ? noteColumnStyle : {}) })}></td>
                            ))}
                        </tr>
                    ))}
                    {isEdit && (
                        <tr style={{ height: 'calc(34px + var(--estimate-table-row-offset, 0px))', backgroundColor: '#f8fafc' }}>
                            <td colSpan={11} style={cellStyle({ border: BORDER_THIN, padding: '0' })}>
                                <button
                                    onClick={() => setDraft((d: any) => ({ ...d, items: [...d.items, createItem({ category: '임대자재', section: '', unit: 'EA', period: draft.items?.[0]?.period || 26 })] }))}
                                    style={{ width: '100%', height: '100%', background: 'transparent', color: '#6366f1', border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 'calc(11pt + var(--estimate-font-size-offset, 0pt))' }}
                                >
                                    + 임대 항목 추가
                                </button>
                            </td>
                            <td style={cellStyle({ border: BORDER_THIN, ...deleteColumnStyle })}></td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
});
