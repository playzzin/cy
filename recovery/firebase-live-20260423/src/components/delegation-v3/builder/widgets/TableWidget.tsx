import React from 'react';
import styled from 'styled-components';
import { BuilderElement } from '../types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faMinus } from '@fortawesome/free-solid-svg-icons';

interface TableWidgetProps {
    element: BuilderElement;
    isSelected: boolean;
    data: any[]; // The worker list
    onSelect?: (multi: boolean) => void;
    onChange: (id: string, updates: Partial<BuilderElement>) => void;
    snapping?: boolean;
    readOnly?: boolean;
}

export const TableWidget: React.FC<TableWidgetProps> = ({
    element,
    isSelected,
    data,
    onChange,
    readOnly = false
}) => {
    // Only internal logic related to Table Structure
    const isStatic = element.content.tableType === 'static';
    const staticData = element.content.staticData || [['', '', ''], ['', '', ''], ['', '', '']];
    const dynamicHeaders = ['번호', '위임인', '주민번호', '주소', '단가', '청구금액', '서명'];
    const colCount = isStatic ? (staticData[0]?.length || 3) : dynamicHeaders.length;
    const columnWidths = element.content.columnWidths?.length === colCount
        ? element.content.columnWidths
        : Array(colCount).fill(100 / colCount);

    const [selectedCell, setSelectedCell] = React.useState<{ r: number, c: number } | null>(null);
    const tableRef = React.useRef<HTMLTableElement>(null);

    const updateStaticCell = (rowIndex: number, colIndex: number, value: string) => {
        const newData = [...staticData.map(row => [...row])];
        newData[rowIndex][colIndex] = value;
        onChange(element.id, {
            content: { ...element.content, staticData: newData }
        });
    };

    const handleCellClick = (e: React.MouseEvent, r: number, c: number) => {
        if (readOnly) return;
        e.stopPropagation();
        setSelectedCell({ r, c });
    };

    const handleContextMenu = (e: React.MouseEvent, r: number, c: number) => {
        if (readOnly) return;
        e.preventDefault();
        e.stopPropagation();
        setSelectedCell({ r, c });
    };

    // Table Operations
    const insertRow = (targetIndex: number) => {
        if (targetIndex < 0 || targetIndex > staticData.length) return;

        const newRow = Array(colCount).fill('');
        const newData = [...staticData.map(r => [...r])];
        newData.splice(targetIndex, 0, newRow);

        onChange(element.id, { content: { ...element.content, staticData: newData } });
        setSelectedCell(null);
    };

    const deleteRow = (targetIndex: number = selectedCell?.r ?? -1) => {
        if (targetIndex === -1 || staticData.length <= 1) return;
        const newData = staticData.filter((_, idx) => idx !== targetIndex);
        onChange(element.id, { content: { ...element.content, staticData: newData } });
        setSelectedCell(null);
    };

    const insertCol = (targetIndex: number) => {
        if (targetIndex < 0 || targetIndex > colCount) return;

        const newData = staticData.map(row => {
            const newRow = [...row];
            if (targetIndex >= newRow.length) {
                newRow.push('');
            } else {
                newRow.splice(targetIndex, 0, '');
            }
            return newRow;
        });

        const newColCount = colCount + 1;
        const newWidths = Array(newColCount).fill(100 / newColCount);

        onChange(element.id, {
            content: {
                ...element.content,
                staticData: newData,
                columnWidths: newWidths
            }
        });
        setSelectedCell(null);
    };

    const deleteCol = (targetIndex: number = selectedCell?.c ?? -1) => {
        if (targetIndex === -1 || colCount <= 1) return;
        const newData = staticData.map(row => row.filter((_, idx) => idx !== targetIndex));
        const newColCount = colCount - 1;
        const newWidths = Array(newColCount).fill(100 / newColCount);

        onChange(element.id, {
            content: {
                ...element.content,
                staticData: newData,
                columnWidths: newWidths
            }
        });
        setSelectedCell(null);
    };

    const resolveNumber = (value: unknown, fallback: number) => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
            const n = Number(value.toString().replaceAll(',', '').trim());
            if (Number.isFinite(n)) return n;
        }
        return fallback;
    };

    const resolvedDynamicRows = !isStatic
        ? data.map((delegator, idx) => {
            const overrides = element.content.dataOverrides?.[delegator.id || ''] || {};
            const workDays = resolveNumber((overrides as any).workDays, resolveNumber(delegator.workDays, 1));
            const unitPrice = resolveNumber((overrides as any).unitPrice, resolveNumber(delegator.unitPrice, 0));
            const claimAmount = resolveNumber((overrides as any).claimAmount, unitPrice * workDays);

            return {
                delegator,
                idx,
                overrides,
                workDays,
                unitPrice,
                claimAmount
            };
        })
        : [];

    const totalAmount = !isStatic
        ? resolvedDynamicRows.reduce((sum, row) => sum + (row.claimAmount || 0), 0)
        : data.reduce((sum, d) => sum + (d.claimAmount || 0), 0);

    // Column Resizing
    const handleColResizeStart = (e: React.MouseEvent, colIndex: number) => {
        if (readOnly) return;
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startWidths = [...columnWidths];
        const tableWidth = tableRef.current?.offsetWidth || 1;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const deltaPx = moveEvent.clientX - startX;
            const deltaPercent = (deltaPx / tableWidth) * 100;

            const newWidths = [...startWidths];
            if (colIndex < newWidths.length - 1) {
                const currentW = newWidths[colIndex];
                const nextW = newWidths[colIndex + 1];

                if (currentW + deltaPercent < 5 || nextW - deltaPercent < 5) return;

                newWidths[colIndex] = currentW + deltaPercent;
                newWidths[colIndex + 1] = nextW - deltaPercent;

                onChange(element.id, {
                    content: { ...element.content, columnWidths: newWidths }
                });
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    return (
        <WidgetContainer $isSelected={isSelected} $style={element.style} style={{ fontSize: `${element.style.fontSize}pt` }}>
            <StyledTableWrapper ref={tableRef as any}>
                <StyledTable>
                    {isStatic ? (
                        <>
                            <colgroup>
                                {columnWidths.map((w, idx) => (
                                    <col key={idx} style={{ width: `${w}%` }} />
                                ))}
                            </colgroup>
                            <tbody>
                                {staticData.map((row, rIdx) => (
                                    <tr key={rIdx}>
                                        {row.map((cell, cIdx) => (
                                            <td
                                                key={cIdx}
                                                style={{ padding: 0, position: 'relative', border: selectedCell?.r === rIdx && selectedCell?.c === cIdx ? '2px solid #3b82f6' : '1px solid #000' }}
                                                onClick={(e) => handleCellClick(e, rIdx, cIdx)}
                                                onContextMenu={(e) => handleContextMenu(e, rIdx, cIdx)}
                                            >
                                                <input
                                                    type="text"
                                                    value={cell}
                                                    onChange={(e) => updateStaticCell(rIdx, cIdx, e.target.value)}
                                                    readOnly={readOnly}
                                                    style={{
                                                        width: '100%',
                                                        border: 'none',
                                                        outline: 'none',
                                                        background: selectedCell?.r === rIdx && selectedCell?.c === cIdx ? '#eff6ff' : 'transparent',
                                                        textAlign: 'center',
                                                        padding: '4px',
                                                        fontFamily: 'inherit',
                                                        fontSize: 'inherit'
                                                    }}
                                                />
                                                {!readOnly && cIdx < colCount - 1 && (
                                                    <ColResizer
                                                        onMouseDown={(e) => handleColResizeStart(e, cIdx)}
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </>
                    ) : (
                        <>
                            <colgroup>
                                {columnWidths.map((w, idx) => (
                                    <col key={idx} style={{ width: `${w}%` }} />
                                ))}
                            </colgroup>
                            <thead>
                                <tr>
                                    {dynamicHeaders.map((defaultHeader, idx) => (
                                        <th key={idx} style={{ padding: 0 }}>
                                            <input
                                                type="text"
                                                value={element.content.headerOverrides?.[idx] ?? defaultHeader}
                                                onChange={(e) => {
                                                    const newHeaders = {
                                                        ...element.content.headerOverrides,
                                                        [idx]: e.target.value
                                                    };
                                                    onChange(element.id, { content: { ...element.content, headerOverrides: newHeaders } });
                                                }}
                                                readOnly={readOnly}
                                                style={{
                                                    width: '100%',
                                                    border: 'none',
                                                    background: 'transparent',
                                                    textAlign: 'center',
                                                    fontWeight: 'bold',
                                                    fontSize: 'inherit',
                                                    padding: '4px'
                                                }}
                                            />
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {resolvedDynamicRows.map((row) => {
                                    const { delegator, idx, overrides, unitPrice, claimAmount, workDays } = row;

                                    const updateOverride = (field: string, value: string | number) => {
                                        if (!delegator.id) return;
                                        const newOverrides = {
                                            ...element.content.dataOverrides,
                                            [delegator.id]: {
                                                ...element.content.dataOverrides?.[delegator.id],
                                                [field]: value
                                            }
                                        };
                                        onChange(element.id, { content: { ...element.content, dataOverrides: newOverrides } });
                                    };

                                    const inputStyle = (align: 'left' | 'center' | 'right') => ({
                                        width: '100%',
                                        border: 'none',
                                        background: 'transparent',
                                        textAlign: align,
                                        padding: '4px'
                                    } as React.CSSProperties);

                                    return (
                                        <tr key={delegator.id || idx}>
                                            <td className="text-center">{idx + 1}</td>
                                            <td style={{ padding: 0 }}>
                                                {readOnly ? (
                                                    <div style={inputStyle('center')}>{(overrides as any).name ?? delegator.name}</div>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={(overrides as any).name ?? delegator.name}
                                                        onChange={(e) => updateOverride('name', e.target.value)}
                                                        style={inputStyle('center')}
                                                    />
                                                )}
                                            </td>
                                            <td style={{ padding: 0 }}>
                                                {readOnly ? (
                                                    <div style={inputStyle('center')}>{(overrides as any).idNumber ?? delegator.idNumber}</div>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={(overrides as any).idNumber ?? delegator.idNumber}
                                                        onChange={(e) => updateOverride('idNumber', e.target.value)}
                                                        style={inputStyle('center')}
                                                    />
                                                )}
                                            </td>
                                            <td style={{ padding: 0 }}>
                                                {readOnly ? (
                                                    <div style={inputStyle('left')}>{(overrides as any).address ?? delegator.address}</div>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={(overrides as any).address ?? delegator.address}
                                                        onChange={(e) => updateOverride('address', e.target.value)}
                                                        style={inputStyle('left')}
                                                    />
                                                )}
                                            </td>
                                            <td style={{ padding: 0 }}>
                                                {readOnly ? (
                                                    <div style={inputStyle('right')}>{unitPrice.toLocaleString()}</div>
                                                ) : (
                                                    <input
                                                        type="number"
                                                        value={unitPrice}
                                                        onChange={(e) => {
                                                            const nextUnit = resolveNumber(e.target.value, 0);
                                                            updateOverride('unitPrice', nextUnit);
                                                            updateOverride('claimAmount', nextUnit * workDays);
                                                        }}
                                                        style={inputStyle('right')}
                                                    />
                                                )}
                                            </td>
                                            <td style={{ padding: 0 }}>
                                                {readOnly ? (
                                                    <div style={inputStyle('right')}>{claimAmount.toLocaleString()}</div>
                                                ) : (
                                                    <input
                                                        type="number"
                                                        value={claimAmount}
                                                        onChange={(e) => updateOverride('claimAmount', resolveNumber(e.target.value, 0))}
                                                        style={inputStyle('right')}
                                                    />
                                                )}
                                            </td>
                                            <td className="text-center">
                                                {delegator.signature && <img src={delegator.signature} alt="서명" style={{ height: '20px', margin: '0 auto' }} />}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {data.length > 0 && (
                                    <tr style={{ fontWeight: 'bold', background: '#f8fafc' }}>
                                        <td colSpan={5} className="text-center">합계</td>
                                        <td className="text-right">{totalAmount.toLocaleString()}</td>
                                        <td></td>
                                    </tr>
                                )}
                                {data.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center text-slate-400 py-4">
                                            작업자를 선택하면 이곳에 표시됩니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </>
                    )}
                </StyledTable>
            </StyledTableWrapper>

            {/* Table Context Menu / Toolbar */}
            {
                selectedCell && !readOnly && isStatic && (
                    <TableToolbar onMouseDown={e => e.stopPropagation()}>
                        <div className="flex gap-1 items-center bg-slate-800 text-white p-1 rounded shadow-lg text-xs">
                            <span className="px-2 opacity-50">행</span>
                            <ToolbarBtn onClick={() => insertRow(selectedCell.r)} title="위쪽에 행 추가"><FontAwesomeIcon icon={faPlus} className="rotate-180" /></ToolbarBtn>
                            <ToolbarBtn onClick={() => insertRow(selectedCell.r + 1)} title="아래쪽에 행 추가"><FontAwesomeIcon icon={faPlus} /></ToolbarBtn>
                            <ToolbarBtn onClick={() => deleteRow()} title="행 삭제" $danger><FontAwesomeIcon icon={faTrash} /></ToolbarBtn>
                            <div className="w-px h-3 bg-slate-600 mx-1"></div>
                            <span className="px-2 opacity-50">열</span>
                            <ToolbarBtn onClick={() => insertCol(selectedCell.c)} title="왼쪽에 열 추가"><FontAwesomeIcon icon={faPlus} className="-rotate-90" /></ToolbarBtn>
                            <ToolbarBtn onClick={() => insertCol(selectedCell.c + 1)} title="오른쪽에 열 추가"><FontAwesomeIcon icon={faPlus} className="rotate-90" /></ToolbarBtn>
                            <ToolbarBtn onClick={() => deleteCol()} title="열 삭제" $danger><FontAwesomeIcon icon={faTrash} /></ToolbarBtn>
                        </div>
                    </TableToolbar>
                )
            }

            {/* Quick Add/Remove Buttons via Edge API */}
            {isSelected && !readOnly && isStatic && (
                <>
                    {/* Bottom Row Controls */}
                    <EdgeControlGroup $pos="bottom">
                        <EdgeActionButton
                            title="마지막 행 추가"
                            onClick={(e) => { e.stopPropagation(); insertRow(staticData.length); }}
                        >
                            <FontAwesomeIcon icon={faPlus} size="xs" />
                        </EdgeActionButton>
                        {staticData.length > 1 && (
                            <EdgeActionButton
                                $danger
                                title="마지막 행 삭제"
                                onClick={(e) => { e.stopPropagation(); deleteRow(staticData.length - 1); }}
                            >
                                <FontAwesomeIcon icon={faMinus} size="xs" />
                            </EdgeActionButton>
                        )}
                    </EdgeControlGroup>

                    {/* Right Col Controls */}
                    <EdgeControlGroup $pos="right">
                        <EdgeActionButton
                            title="마지막 열 추가"
                            onClick={(e) => { e.stopPropagation(); insertCol(colCount); }}
                        >
                            <FontAwesomeIcon icon={faPlus} size="xs" />
                        </EdgeActionButton>
                        {colCount > 1 && (
                            <EdgeActionButton
                                $danger
                                title="마지막 열 삭제"
                                onClick={(e) => { e.stopPropagation(); deleteCol(colCount - 1); }}
                            >
                                <FontAwesomeIcon icon={faMinus} size="xs" />
                            </EdgeActionButton>
                        )}
                    </EdgeControlGroup>
                </>
            )}
        </WidgetContainer >
    );
};

const WidgetContainer = styled.div<{ $isSelected: boolean; $style?: BuilderElement['style'] }>`
    width: 100%;
    height: 100%;
    /* wrapper handles drag handling */
    cursor: default; 
    background: ${props => props.$style?.backgroundColor || 'white'};
`;

const StyledTable = styled.table`
    width: 100%;
    border-collapse: collapse;
    font-size: inherit;

    th, td {
        border: 1px solid #000;
        padding: 4px;
        word-break: break-all;
    }
    th {
        background: #f1f5f9;
        font-weight: bold;
        text-align: center;
        white-space: nowrap;
    }
`;

const TableToolbar = styled.div`
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%) translateY(-8px);
    z-index: 20;
    white-space: nowrap;
`;

const ToolbarBtn = styled.button<{ $danger?: boolean }>`
    padding: 4px 8px;
    color: ${props => props.$danger ? '#fca5a5' : '#e2e8f0'};
    transition: all 0.2s;
    border-radius: 4px;

    &:hover {
        background: rgba(255,255,255,0.1);
        color: ${props => props.$danger ? '#f87171' : 'white'};
    }
`;

const ColResizer = styled.div`
    position: absolute;
    top: 0;
    right: -2px;
    bottom: 0;
    width: 4px;
    cursor: col-resize;
    z-index: 10;
    
    &:hover {
        background: #3b82f6;
    }
`;

const StyledTableWrapper = styled.div`
    width: 100%;
    height: 100%;
`;

const EdgeControlGroup = styled.div<{ $pos: 'bottom' | 'right' }>`
    position: absolute;
    display: flex;
    gap: 4px;
    z-index: 30;
    transition: transform 0.2s;

    ${props => props.$pos === 'bottom' ? `
        bottom: -12px;
        left: 50%;
        transform: translateX(-50%);
        flex-direction: row;
    ` : `
        top: 50%;
        right: -12px;
        transform: translateY(-50%);
        flex-direction: column;
    `}
`;

const EdgeActionButton = styled.button<{ $danger?: boolean }>`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: ${props => props.$danger ? '#ef4444' : '#3b82f6'};
    color: white;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
        background: ${props => props.$danger ? '#dc2626' : '#2563eb'};
        transform: scale(1.1);
    }
`;
