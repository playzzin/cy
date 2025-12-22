import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { Site } from '../../services/siteService';

export interface TypingRow {
    id: number;
    name: string;
    manDay: number;
    teamId: string;
    teamName: string; // "팀구분"
    siteTeamName: string; // "현장 소속팀"
    workerId?: string;
    role?: string;
    unitPrice?: number;
    payType?: string;
    content?: string;
}

export interface TypingTableData {
    id: number;
    siteId: string;
    rows: TypingRow[];
}

interface TypingTableProps {
    table: TypingTableData;
    index: number;
    sites: Site[];
    onSiteChange: (tableId: number, siteId: string) => void;
    onNameChange: (tableId: number, rowId: number, name: string) => void;
    onRowChange: (tableId: number, rowId: number, field: keyof TypingRow, value: any) => void;
    onAddRows: (tableId: number, count: number) => void;
}

const TypingTable: React.FC<TypingTableProps> = ({
    table,
    index,
    sites,
    onSiteChange,
    onNameChange,
    onRowChange,
    onAddRows
}) => {
    const tableRef = React.useRef<HTMLDivElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
        if (e.nativeEvent.isComposing) return; // Ignore IME composition events

        const maxRows = table.rows.length;
        const maxCols = 2; // Name(0), ManDay(1)

        let nextRow = rowIdx;
        let nextCol = colIdx;

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                nextRow = Math.max(0, rowIdx - 1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                nextRow = Math.min(maxRows - 1, rowIdx + 1);
                break;
            case 'ArrowLeft':
                if (e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
                    e.preventDefault();
                    nextCol = Math.max(0, colIdx - 1);
                }
                break;
            case 'ArrowRight':
                if (e.currentTarget.selectionStart === e.currentTarget.value.length) {
                    e.preventDefault();
                    nextCol = Math.min(maxCols - 1, colIdx + 1);
                }
                break;
            case 'Enter':
                e.preventDefault();
                nextRow = Math.min(maxRows - 1, rowIdx + 1);
                break;
            default:
                return;
        }

        if (nextRow !== rowIdx || nextCol !== colIdx) {
            const nextInput = tableRef.current?.querySelector(
                `input[data-row-idx="${nextRow}"][data-col-idx="${nextCol}"]`
            ) as HTMLInputElement;
            nextInput?.focus();
        }
    };

    return (
        <div ref={tableRef} className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden min-w-[450px] flex-1">
            {/* Table Header with Site Selection */}
            <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-700 text-sm">장부 {index + 1}</span>
                    <select
                        value={table.siteId}
                        onChange={(e) => onSiteChange(table.id, e.target.value)}
                        className="border-slate-200 rounded-lg text-xs py-1.5 pl-2 pr-8 focus:ring-brand-500 focus:border-brand-500 font-medium text-slate-600"
                    >
                        <option value="">현장을 선택하세요</option>
                        {sites.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                        <th className="px-2 py-3 border-b border-slate-200 w-10 text-center">No</th>
                        <th className="px-2 py-3 border-b border-slate-200 text-left">이름</th>
                        <th className="px-2 py-3 border-b border-slate-200 w-16 text-center">공수</th>
                        <th className="px-2 py-3 border-b border-slate-200 w-24 text-center">단가</th>
                        <th className="px-2 py-3 border-b border-slate-200 w-20 text-center">구분</th>
                        <th className="px-2 py-3 border-b border-slate-200 w-24 text-center">팀</th>
                        <th className="px-2 py-3 border-b border-slate-200 w-24 text-center">현장담당</th>
                        <th className="px-2 py-3 border-b border-slate-200 w-32 text-center">작업내용</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {table.rows.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-2 py-3 text-slate-400 font-mono text-xs text-center">{idx + 1}</td>
                            <td className="px-2 py-2">
                                <input
                                    type="text"
                                    data-row-idx={idx}
                                    data-col-idx={0}
                                    value={row.name}
                                    onChange={(e) => onNameChange(table.id, row.id, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, idx, 0)}
                                    className="w-full border-slate-200 rounded focus:ring-brand-500 focus:border-brand-500 text-sm p-1.5 font-bold text-slate-700 placeholder-slate-300"
                                    placeholder="이름"
                                />
                            </td>
                            <td className="px-2 py-2">
                                <input
                                    type="number"
                                    step="0.1"
                                    data-row-idx={idx}
                                    data-col-idx={1}
                                    value={row.manDay}
                                    onChange={(e) => onRowChange(table.id, row.id, 'manDay', parseFloat(e.target.value))}
                                    onKeyDown={(e) => handleKeyDown(e, idx, 1)}
                                    className="w-full border-slate-200 rounded focus:ring-brand-500 focus:border-brand-500 text-sm p-1.5 text-center font-bold text-brand-600"
                                />
                            </td>
                            <td className="px-2 py-2">
                                <input
                                    type="text" // Text to allow commas or formatting if needed, but keeping it simple for now
                                    data-row-idx={idx}
                                    data-col-idx={2}
                                    value={row.unitPrice || ''}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                        onRowChange(table.id, row.id, 'unitPrice', val ? parseInt(val) : 0);
                                    }}
                                    onKeyDown={(e) => handleKeyDown(e, idx, 2)}
                                    className="w-full border-slate-200 rounded focus:ring-brand-500 focus:border-brand-500 text-sm p-1.5 text-center text-slate-600"
                                    placeholder="단가"
                                />
                            </td>
                            <td className="px-2 py-2">
                                <input
                                    type="text"
                                    data-row-idx={idx}
                                    data-col-idx={3}
                                    value={row.payType || ''}
                                    onChange={(e) => onRowChange(table.id, row.id, 'payType', e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, idx, 3)}
                                    className="w-full border-slate-200 rounded focus:ring-brand-500 focus:border-brand-500 text-sm p-1.5 text-center text-slate-600"
                                    placeholder="구분"
                                />
                            </td>
                            <td className="px-2 py-2">
                                <input
                                    type="text"
                                    value={row.teamName}
                                    readOnly
                                    className="w-full border-none bg-transparent text-center text-xs text-slate-500 font-medium p-0"
                                />
                            </td>
                            <td className="px-2 py-2">
                                <input
                                    type="text"
                                    value={row.siteTeamName}
                                    readOnly
                                    className="w-full border-none bg-transparent text-center text-xs text-slate-500 font-medium p-0"
                                />
                            </td>
                            <td className="px-2 py-2">
                                <input
                                    type="text"
                                    data-row-idx={idx}
                                    data-col-idx={4}
                                    value={row.content || ''}
                                    onChange={(e) => onRowChange(table.id, row.id, 'content', e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, idx, 4)}
                                    className="w-full border-slate-200 rounded focus:ring-brand-500 focus:border-brand-500 text-sm p-1.5 text-left text-slate-600"
                                    placeholder="작업내용"
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                <button
                    onClick={() => onAddRows(table.id, 5)}
                    className="text-xs text-slate-500 hover:text-brand-600 font-bold flex items-center justify-center gap-1 w-full py-1"
                >
                    <FontAwesomeIcon icon={faPlus} />
                    줄 추가
                </button>
            </div>
        </div>
    );
};

export default TypingTable;
