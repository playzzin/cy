import React from 'react';
import { 
    EXCEL_FONT, BORDER_THIN, BORDER_THICK, 
    COMMON_CATEGORIES, COMMON_SECTIONS, COMMON_UNITS,
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

export const EstimateTable = React.memo(({ draft, itemsWithCalc, subtotal, isEdit, updateItem, setDraft }: any) => {
    const inputStyle: React.CSSProperties = { width: '100%', border: 'none', outline: 'none', background: 'transparent', fontFamily: EXCEL_FONT, fontSize: 'calc(9pt + var(--estimate-font-size-offset, 0pt))', textAlign: 'center' };
    const installRatio = draft.installRatio || 50;
    const removeRatio = 100 - installRatio;

    const isRental = draft.estimateMode === 'rental';

    return (
        <div style={{ ...tableWrapperStyle, overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: isEdit ? '1400px' : '1340px', borderCollapse: 'collapse', tableLayout: 'fixed', whiteSpace: 'nowrap' }}>
                <colgroup>
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '250px' }} />
                    <col style={{ width: '75px' }} />
                    <col style={{ width: '90px' }} />
                    {/* 인건비 */}
                    <col style={{ width: '125px' }} />
                    <col style={{ width: '145px' }} />
                    
                    {isRental ? (
                        <>
                            {/* 임대료 */}
                            <col style={{ width: '125px' }} />
                            <col style={{ width: '145px' }} />
                        </>
                    ) : (
                        <>
                            {/* 청구 */}
                            <col style={{ width: '125px' }} />
                            <col style={{ width: '145px' }} />
                        </>
                    )}
                    <col style={{ width: '190px' }} />
                    {isEdit && <col style={{ width: '42px' }} />}
                </colgroup>
                <thead>
                    <tr style={{ height: 'calc(32px + var(--estimate-table-row-offset, 0px))' }}>
                        <th rowSpan={2} style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>품 명</th>
                        <th rowSpan={2} style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>설치 구간</th>
                        <th rowSpan={2} style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>단위</th>
                        <th rowSpan={2} style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>물 량</th>
                        <th colSpan={2} style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THIN })}>인 건 비</th>
                        {isRental ? (
                            <th colSpan={2} style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THIN })}>임 대 료</th>
                        ) : (
                            <th colSpan={2} style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THIN })}>청 구</th>
                        )}
                        <th rowSpan={2} style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>비 고</th>
                        {isEdit && <th rowSpan={2} style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>삭제</th>}
                    </tr>
                    <tr style={{ height: 'calc(28px + var(--estimate-table-row-offset, 0px))' }}>
                        <th style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>단 가</th>
                        <th style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>금 액</th>
                        {isRental ? (
                            <>
                                <th style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>단 가</th>
                                <th style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>금 액</th>
                            </>
                        ) : (
                            <>
                                <th style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>설치 {installRatio}%</th>
                                <th style={labelCellStyle({ border: BORDER_THIN, borderBottom: BORDER_THICK })}>해체 {removeRatio}%</th>
                            </>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {(() => {
                        const allExistingCategories = Array.from(new Set(itemsWithCalc.map((i: any) => i.category || '')));
                        const finalCategories = allExistingCategories.filter(cat => cat && cat !== '기타');

                        const totalQty = itemsWithCalc.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
                        const totalLabor = itemsWithCalc.reduce((s: number, i: any) => s + (i.laborAmount || 0), 0);
                        const totalRental = itemsWithCalc.reduce((s: number, i: any) => s + (i.rentalAmount || 0), 0);
                        const totalInstall = itemsWithCalc.reduce((s: number, i: any) => s + (i.install50 || 0), 0);
                        const totalRemove = itemsWithCalc.reduce((s: number, i: any) => s + (i.remove50 || 0), 0);

                        return (
                            <>
                                {finalCategories.map((cat: any, cIdx: number) => {
                                    const realItems = itemsWithCalc.filter((i: any) => (i.category || '') === cat);
                                    const MIN_ROWS = 4;
                                    const displayItems = [...realItems];
                                    while (displayItems.length < MIN_ROWS) {
                                        displayItems.push({ id: `empty-${cat}-${displayItems.length}`, category: cat, isFiller: true });
                                    }

                                    const gQty = realItems.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
                                    const gAmount = realItems.reduce((s: number, i: any) => s + (i.amount || 0), 0);
                                    const gLabor = realItems.reduce((s: number, i: any) => s + (i.laborAmount || 0), 0);
                                    const gRental = realItems.reduce((s: number, i: any) => s + (i.rentalAmount || 0), 0);
                                    const gInstall = realItems.reduce((s: number, i: any) => s + (i.install50 || 0), 0);
                                    const gRemove = realItems.reduce((s: number, i: any) => s + (i.remove50 || 0), 0);

                                    return (
                                        <React.Fragment key={`group-idx-${cIdx}`}>
                                            {displayItems.map((item: any, rIdx: number) => (
                                                <tr key={item.id} style={{ height: 'calc(28px + var(--estimate-table-row-offset, 0px))' }} className="group/row hover:bg-slate-50">
                                                    {rIdx === 0 && (
                                                        <td rowSpan={displayItems.length + 1} style={{ ...cellStyle(), border: BORDER_THIN, fontWeight: 900, backgroundColor: '#fcfcfc', color: '#64748b', fontSize: 'calc(9.5pt + var(--estimate-font-size-offset, 0pt))', verticalAlign: 'middle' }}>
                                                            {isEdit && !item.isFiller ? (
                                                                <>
                                                                    <input
                                                                        value={cat}
                                                                        list="categories-list"
                                                                        onChange={e => {
                                                                            const newCat = e.target.value;
                                                                            setDraft((prev: any) => ({
                                                                                ...prev,
                                                                                items: prev.items.map((i: any) => 
                                                                                    (i.category || '') === cat ? { ...i, category: newCat } : i
                                                                                )
                                                                            }));
                                                                        }}
                                                                        style={{ ...inputStyle, fontWeight: 900, fontSize: 'calc(9.5pt + var(--estimate-font-size-offset, 0pt))', color: '#64748b' }}
                                                                    />
                                                                    <datalist id="categories-list">
                                                                        {COMMON_CATEGORIES.map(c => <option key={c} value={c} />)}
                                                                    </datalist>
                                                                </>
                                                            ) : cat}
                                                        </td>
                                                    )}
                                                    <td style={{ ...cellStyle(), border: BORDER_THIN, textAlign: 'left', paddingLeft: '6px' }}>
                                                        {item.isFiller ? '' : (isEdit ? (
                                                            <>
                                                                <input value={item.section} list="sections-list" onChange={e => updateItem(item.id, 'section', e.target.value)} style={{ ...inputStyle, textAlign: 'left' }} />
                                                                <datalist id="sections-list">{COMMON_SECTIONS.map(s => <option key={s} value={s} />)}</datalist>
                                                            </>
                                                        ) : item.section)}
                                                    </td>
                                                    <td style={{ ...cellStyle(), border: BORDER_THIN }}>
                                                        {item.isFiller ? '' : (isEdit ? (
                                                            <>
                                                                <input value={item.unit} list="units-list" onChange={e => updateItem(item.id, 'unit', e.target.value)} style={inputStyle} />
                                                                <datalist id="units-list">{COMMON_UNITS.map(u => <option key={u} value={u} />)}</datalist>
                                                            </>
                                                        ) : item.unit)}
                                                    </td>
                                                    <td style={{ ...cellStyle(), border: BORDER_THIN, textAlign: 'right', paddingRight: '4px' }}>
                                                        {item.isFiller ? '' : (isEdit ? (
                                                            <input
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={formatEditableDecimal(item.quantity)}
                                                                onChange={e => updateItem(item.id, 'quantity', parseFormattedNumber(e.target.value))}
                                                                style={{ ...inputStyle, textAlign: 'right' }}
                                                            />
                                                        ) : (item.quantity ? formatDecimal(item.quantity) : '-'))}
                                                    </td>

                                                    {/* 인건비 */}
                                                    <td style={{ ...cellStyle(), border: BORDER_THIN, textAlign: 'right', paddingRight: '4px' }}>
                                                        {item.isFiller ? '' : (isEdit ? (
                                                            <input 
                                                                type="text"
                                                                inputMode="numeric"
                                                                value={formatEditableCurrency(isRental ? item.laborUnitPrice : item.finalUnitPrice)}
                                                                onChange={e => updateItem(item.id, isRental ? 'laborUnitPrice' : 'finalUnitPrice', parseFormattedNumber(e.target.value))}
                                                                style={{ ...inputStyle, textAlign: 'right' }} 
                                                            />
                                                        ) : (isRental ? (item.laborUnitPrice ? formatCurrency(item.laborUnitPrice) : '-') : (item.finalUnitPrice ? formatCurrency(item.finalUnitPrice) : '-')))}
                                                    </td>
                                                    <td style={{ ...cellStyle(), border: BORDER_THIN, textAlign: 'right', paddingRight: '4px', fontWeight: isRental ? 400 : 700 }}>
                                                        {item.isFiller ? '' : (isRental ? (item.laborAmount ? formatCurrency(item.laborAmount) : '-') : (item.amount ? formatCurrency(item.amount) : '-'))}
                                                    </td>

                                                    {isRental ? (
                                                        <>
                                                            {/* 임대료 방식 전용 컬럼 */}
                                                            <td style={{ ...cellStyle(), border: BORDER_THIN, textAlign: 'right', paddingRight: '4px' }}>
                                                                {item.isFiller ? '' : (isEdit ? (
                                                                    <input
                                                                        type="text"
                                                                        inputMode="numeric"
                                                                        value={formatEditableCurrency(item.rentalUnitPrice)}
                                                                        onChange={e => updateItem(item.id, 'rentalUnitPrice', parseFormattedNumber(e.target.value))}
                                                                        style={{ ...inputStyle, textAlign: 'right' }}
                                                                    />
                                                                ) : (item.rentalUnitPrice ? formatCurrency(item.rentalUnitPrice) : '-'))}
                                                            </td>
                                                            <td style={{ ...cellStyle(), border: BORDER_THIN, textAlign: 'right', paddingRight: '4px', fontWeight: 700 }}>
                                                                {item.isFiller ? '' : (item.rentalAmount ? formatCurrency(item.rentalAmount) : '-')}
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {/* 표준 방식 전용 컬럼 */}
                                                            <td style={{ ...cellStyle(), border: BORDER_THIN, textAlign: 'right', paddingRight: '4px' }}>
                                                                {item.isFiller ? '' : (item.install50 ? formatCurrency(item.install50) : '-')}
                                                            </td>
                                                            <td style={{ ...cellStyle(), border: BORDER_THIN, textAlign: 'right', paddingRight: '4px' }}>
                                                                {item.isFiller ? '' : (item.remove50 ? formatCurrency(item.remove50) : '-')}
                                                            </td>
                                                        </>
                                                    )}

                                                    <td style={{ ...cellStyle(), border: BORDER_THIN }}>
                                                        {item.isFiller ? '' : (isEdit ? <input value={item.note || ''} onChange={e => updateItem(item.id, 'note', e.target.value)} style={inputStyle} /> : (item.note || ''))}
                                                    </td>
                                                    {isEdit && (
                                                        <td style={{ ...cellStyle(), padding: '0', backgroundColor: '#fff' }}>
                                                            {!item.isFiller && (
                                                                <button onClick={() => setDraft((d: any) => ({ ...d, items: d.items.filter((it: any) => it.id !== item.id) }))} style={{ width: '100%', height: '100%', background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer' }}>×</button>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                            <tr style={{ height: 'calc(30px + var(--estimate-table-row-offset, 0px))', backgroundColor: '#eef2ff' }}>
                                                <td style={{ ...labelCellStyle(), border: BORDER_THIN, textAlign: 'center', color: '#4338ca', letterSpacing: '1em', backgroundColor: '#eef2ff' }}>합 계</td>
                                                <td style={{ ...cellStyle(), border: BORDER_THIN }}></td>
                                                <td style={{ ...cellStyle(), border: BORDER_THIN, textAlign: 'right', paddingRight: '4px', fontWeight: 800 }}>{gQty ? formatDecimal(gQty) : '0'}</td>
                                                <td style={{ ...cellStyle(), border: BORDER_THIN }}></td>
                                                <td style={{ ...cellStyle(), border: BORDER_THIN, textAlign: 'right', paddingRight: '4px', fontWeight: 800 }}>{isRental ? (gLabor ? formatCurrency(gLabor) : '0') : (gAmount ? formatCurrency(gAmount) : '0')}</td>
                                                
                                                {isRental ? (
                                                    <>
                                                        <td style={{ ...cellStyle(), border: BORDER_THIN }}></td>
                                                        <td style={{ ...cellStyle(), border: BORDER_THIN, textAlign: 'right', paddingRight: '4px', fontWeight: 800 }}>{gRental ? formatCurrency(gRental) : '0'}</td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td style={{ ...cellStyle(), border: BORDER_THIN, textAlign: 'right', paddingRight: '4px', fontWeight: 800 }}>{gInstall ? formatCurrency(gInstall) : '0'}</td>
                                                        <td style={{ ...cellStyle(), border: BORDER_THIN, textAlign: 'right', paddingRight: '4px', fontWeight: 800 }}>{gRemove ? formatCurrency(gRemove) : '0'}</td>
                                                    </>
                                                )}
                                                
                                                <td style={{ ...cellStyle(), border: BORDER_THIN }}></td>
                                                {isEdit && (
                                                    <td style={{ ...cellStyle(), border: BORDER_THIN, padding: '0', backgroundColor: '#f5f3ff' }}>
                                                        <button
                                                            onClick={() => setDraft((d: any) => ({ ...d, items: [...d.items, createItem({ category: cat })] }))}
                                                            style={{ width: '100%', height: '100%', background: 'transparent', color: '#6366f1', border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 'calc(14pt + var(--estimate-font-size-offset, 0pt))' }}
                                                            title="항목 추가"
                                                        >
                                                            +
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        </React.Fragment>
                                    );
                                })}
                                <tr style={{ height: 'calc(32px + var(--estimate-table-row-offset, 0px))', backgroundColor: '#f8fafc' }}>
                                    <td colSpan={3} style={{ ...labelCellStyle(), border: BORDER_THICK, fontSize: 'calc(10pt + var(--estimate-font-size-offset, 0pt))', fontWeight: 950, letterSpacing: '1.5em', textAlign: 'center', backgroundColor: '#f8fafc', color: '#000' }}>총&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;계</td>
                                    <td style={{ ...cellStyle(), border: BORDER_THICK, textAlign: 'right', paddingRight: '4px', fontWeight: 950, fontSize: 'calc(9.5pt + var(--estimate-font-size-offset, 0pt))' }}>{totalQty ? formatDecimal(totalQty) : '0'}</td>
                                    <td style={{ ...cellStyle(), border: BORDER_THICK }}></td>
                                    <td style={{ ...cellStyle(), border: BORDER_THICK, textAlign: 'right', paddingRight: '4px', fontWeight: 950, color: '#000', fontSize: 'calc(10pt + var(--estimate-font-size-offset, 0pt))', backgroundColor: '#ffff00' }}>{formatCurrency(subtotal)}</td>
                                    
                                    {isRental ? (
                                        <>
                                            <td style={{ ...cellStyle(), border: BORDER_THICK }}></td>
                                            <td style={{ ...cellStyle(), border: BORDER_THICK, textAlign: 'right', paddingRight: '4px', fontWeight: 950, fontSize: 'calc(9.5pt + var(--estimate-font-size-offset, 0pt))' }}>{totalRental ? formatCurrency(totalRental) : '0'}</td>
                                        </>
                                    ) : (
                                        <>
                                            <td style={{ ...cellStyle(), border: BORDER_THICK, textAlign: 'right', paddingRight: '4px', fontWeight: 950, fontSize: 'calc(9.5pt + var(--estimate-font-size-offset, 0pt))' }}>{totalInstall ? formatCurrency(totalInstall) : '0'}</td>
                                            <td style={{ ...cellStyle(), border: BORDER_THICK, textAlign: 'right', paddingRight: '4px', fontWeight: 950, fontSize: 'calc(9.5pt + var(--estimate-font-size-offset, 0pt))' }}>{totalRemove ? formatCurrency(totalRemove) : '0'}</td>
                                        </>
                                    )}
                                    
                                    <td style={{ ...cellStyle(), border: BORDER_THICK }}></td>
                                    {isEdit && <td style={{ ...cellStyle(), border: BORDER_THICK }}></td>}
                                </tr>
                            </>
                        );
                    })()}
                </tbody>
            </table>
        </div>
    );
});
