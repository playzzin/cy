import React from 'react';
import { 
    EXCEL_FONT, BORDER_THIN, BORDER_THICK, 
    COMMON_UNITS,
    cellStyle, labelCellStyle, tableWrapperStyle,
    formatCurrency, formatDecimal, createItem
} from '../../utils/estimateUtils';

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

export const TransactionTable = React.memo(({ draft, itemsWithCalc, isEdit, updateItem, setDraft }: any) => {
    const inputStyle: React.CSSProperties = { width: '100%', border: 'none', outline: 'none', background: 'transparent', fontFamily: EXCEL_FONT, fontSize: 'calc(9pt + var(--estimate-font-size-offset, 0pt))', textAlign: 'center' };
    const vatRate = draft.vatRate || 10;
    const visibleItems = isEdit ? itemsWithCalc : itemsWithCalc.filter((item: any) => {
        const category = String(item.category || '').trim();
        const isDefaultPlaceholderCategory = category === '시스템 동바리' || category === '시스템 비계';
        const hasLineValue =
            String(item.section || '').trim() !== '' ||
            String(item.label || '').trim() !== '' ||
            String(item.unit || '').trim() !== '' ||
            String(item.note || '').trim() !== '' ||
            (Number(item.quantity) || 0) > 0 ||
            (Number(item.finalUnitPrice) || 0) > 0 ||
            (Number(item.amount) || 0) > 0;

        return hasLineValue || (category !== '' && !isDefaultPlaceholderCategory);
    });

    return (
        <div style={{ ...tableWrapperStyle, overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: isEdit ? '1400px' : '1340px', borderCollapse: 'collapse', tableLayout: 'fixed', whiteSpace: 'nowrap' }}>
                <colgroup><col style={{ width: '135px' }} /><col style={{ width: '260px' }} /><col style={{ width: '80px' }} /><col style={{ width: '90px' }} /><col style={{ width: '130px' }} /><col style={{ width: '150px' }} /><col style={{ width: '130px' }} /><col style={{ width: '230px' }} />{isEdit && <col style={{ width: '55px' }} />}</colgroup>
                <thead>
                    <tr style={{ height: 'calc(32px + var(--estimate-table-row-offset, 0px))' }}>
                        <th style={{ ...labelCellStyle(), border: BORDER_THIN, borderBottom: BORDER_THICK }}>날짜</th>
                        <th style={{ ...labelCellStyle(), border: BORDER_THIN, borderBottom: BORDER_THICK }}>품목</th>
                        <th style={{ ...labelCellStyle(), border: BORDER_THIN, borderBottom: BORDER_THICK }}>단위</th>
                        <th style={{ ...labelCellStyle(), border: BORDER_THIN, borderBottom: BORDER_THICK }}>수량</th>
                        <th style={{ ...labelCellStyle(), border: BORDER_THIN, borderBottom: BORDER_THICK }}>단가</th>
                        <th style={{ ...labelCellStyle(), border: BORDER_THIN, borderBottom: BORDER_THICK }}>공급가액</th>
                        <th style={{ ...labelCellStyle(), border: BORDER_THIN, borderBottom: BORDER_THICK }}>세액</th>
                        <th style={{ ...labelCellStyle(), border: BORDER_THIN, borderBottom: BORDER_THICK }}>비고</th>
                        {isEdit && <th style={{ ...labelCellStyle(), border: BORDER_THIN, borderBottom: BORDER_THICK }}>삭제</th>}
                    </tr>
                </thead>
                <tbody style={{ borderBottom: BORDER_THICK }}>
                    {visibleItems.map((item: any) => {
                        const supplyAmt = item.amount || 0;
                        const vatAmt = supplyAmt ? Math.round(supplyAmt * vatRate / 100) : 0;
                        return (
                            <tr key={item.id} style={{ height: 'calc(24px + var(--estimate-table-row-offset, 0px))' }}>
                                <td style={{ ...cellStyle(), border: BORDER_THIN, textAlign: 'center' }}>
                                    {isEdit ? (
                                        <input value={item.itemDate || ''} onChange={e => updateItem(item.id, 'itemDate', e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} placeholder="날짜" />
                                    ) : (item.itemDate || '')}
                                </td>
                                <td style={{ ...cellStyle(), border: BORDER_THIN, textAlign: 'left', paddingLeft: '4px' }}>{isEdit ? <input value={item.category} onChange={e => updateItem(item.id, 'category', e.target.value)} style={{ ...inputStyle, textAlign: 'left' }} /> : item.category}</td>
                                <td style={{ ...cellStyle(), border: BORDER_THIN }}>{isEdit ? (
                                    <>
                                        <input value={item.unit} list="units-list" onChange={e => updateItem(item.id, 'unit', e.target.value)} style={inputStyle} />
                                        <datalist id="units-list">{COMMON_UNITS.map(u => <option key={u} value={u} />)}</datalist>
                                    </>
                                ) : item.unit}</td>
                                <td style={{ ...cellStyle(), border: BORDER_THIN, textAlign: 'right', paddingRight: '4px' }}>{isEdit ? <input type="text" inputMode="decimal" value={formatEditableDecimal(item.quantity)} onChange={e => updateItem(item.id, 'quantity', parseFormattedNumber(e.target.value))} style={{ ...inputStyle, textAlign: 'right' }} /> : (item.quantity ? formatDecimal(item.quantity) : '')}</td>
                                <td style={{ ...cellStyle(), border: BORDER_THIN, textAlign: 'right', paddingRight: '4px' }}>{isEdit ? <input type="text" inputMode="numeric" value={formatEditableCurrency(item.finalUnitPrice)} onChange={e => updateItem(item.id, 'finalUnitPrice', parseFormattedNumber(e.target.value))} style={{ ...inputStyle, textAlign: 'right' }} /> : (item.finalUnitPrice ? formatCurrency(item.finalUnitPrice) : '')}</td>
                                <td style={{ ...cellStyle(), border: BORDER_THIN, textAlign: 'right', paddingRight: '4px', fontWeight: 700 }}>{supplyAmt ? formatCurrency(supplyAmt) : ''}</td>
                                <td style={{ ...cellStyle(), border: BORDER_THIN, textAlign: 'right', paddingRight: '4px' }}>{vatAmt ? formatCurrency(vatAmt) : ''}</td>
                                <td style={{ ...cellStyle(), border: BORDER_THIN, textAlign: 'left', paddingLeft: '4px' }}>{isEdit ? <input value={item.note || ''} onChange={e => updateItem(item.id, 'note', e.target.value)} style={{ ...inputStyle, textAlign: 'left' }} /> : item.note}</td>
                                {isEdit && <td style={{ ...cellStyle(), border: BORDER_THIN, padding: '0' }}><button onClick={() => setDraft((d: any) => ({ ...d, items: d.items.filter((it: any) => it.id !== item.id) }))} style={{ width: '100%', height: '100%', background: '#ef5350', color: '#fff', border: 'none', cursor: 'pointer' }}>×</button></td>}
                            </tr>
                        );
                    })}
                    {!isEdit && Array.from({ length: Math.max(0, 15 - visibleItems.length) }).map((_, i) => (
                        <tr key={`empty-${i}`} style={{ height: 'calc(24px + var(--estimate-table-row-offset, 0px))' }}>
                            <td style={{ ...cellStyle(), border: BORDER_THIN }}></td>
                            <td style={{ ...cellStyle(), border: BORDER_THIN }}></td>
                            <td style={{ ...cellStyle(), border: BORDER_THIN }}></td>
                            <td style={{ ...cellStyle(), border: BORDER_THIN }}></td>
                            <td style={{ ...cellStyle(), border: BORDER_THIN }}></td>
                            <td style={{ ...cellStyle(), border: BORDER_THIN }}></td>
                            <td style={{ ...cellStyle(), border: BORDER_THIN }}></td>
                            <td style={{ ...cellStyle(), border: BORDER_THIN }}></td>
                        </tr>
                    ))}
                    {isEdit && (
                        <tr style={{ height: 'calc(32px + var(--estimate-table-row-offset, 0px))', backgroundColor: '#f8fafc' }}>
                            <td colSpan={8} style={{ ...cellStyle(), border: BORDER_THIN, padding: '0' }}>
                                <button 
                                    onClick={() => setDraft((d: any) => ({ ...d, items: [...d.items, createItem()] }))}
                                    style={{ width: '100%', height: '100%', background: 'transparent', color: '#6366f1', border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 'calc(11pt + var(--estimate-font-size-offset, 0pt))' }}
                                >
                                    + 항목 추가
                                </button>
                            </td>
                            <td style={{ ...cellStyle(), border: BORDER_THIN }}></td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
});
