import React from 'react';
import { Team } from '../../../services/teamService';

export type TaxAffairsRecord = {
    id: string;
    date: string;
    type: '매출' | '매입';
    partnerName: string;
    description: string;
    supplyAmount: number;
    taxAmount: number;
    totalAmount: number;
    invoiceNum?: string;

    // New fields
    siteName?: string;
    teamName?: string;
    memo?: string;
};

type TableProps = {
    records: TaxAffairsRecord[];
    loading: boolean;
    editable?: boolean;
    onUpdate?: (id: string, field: keyof TaxAffairsRecord, value: string) => void;
    selectable?: boolean;
    selectedIds?: string[];
    onSelectionChange?: (ids: string[]) => void;
    teams?: Team[]; // Optional: if provided, renders a dropdown for Team Name
};

export const TransactionTable: React.FC<TableProps> = ({
    records,
    loading,
    editable = false,
    onUpdate,
    selectable = false,
    selectedIds = [], // Duplicate selectable removed
    onSelectionChange,
    teams
}) => {
    // Calculate Totals for Footer
    const totals = records.reduce((acc, r) => ({
        supply: acc.supply + r.supplyAmount,
        tax: acc.tax + r.taxAmount,
        total: acc.total + r.totalAmount
    }), { supply: 0, tax: 0, total: 0 });

    if (loading) {
        return (
            <div className="w-full h-64 flex items-center justify-center bg-white rounded-xl border border-slate-200">
                <span className="text-slate-500">데이터를 불러오는 중입니다...</span>
            </div>
        );
    }

    if (records.length === 0) {
        return (
            <div className="w-full h-64 flex items-center justify-center bg-white rounded-xl border border-slate-200">
                <span className="text-slate-400">조회된 내역이 없습니다.</span>
            </div>
        );
    }

    const handleInputChange = (id: string, field: keyof TaxAffairsRecord, value: string) => {
        if (onUpdate) {
            onUpdate(id, field, value);
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!onSelectionChange) return;
        if (e.target.checked) {
            onSelectionChange(records.map(r => r.id));
        } else {
            onSelectionChange([]);
        }
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        if (!onSelectionChange) return;
        if (checked) {
            onSelectionChange([...selectedIds, id]);
        } else {
            onSelectionChange(selectedIds.filter(selectedId => selectedId !== id));
        }
    };

    const allSelected = records.length > 0 && selectedIds.length === records.length;

    return (
        <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-auto max-h-[600px]">
                <table className="w-full text-sm text-center text-slate-600">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            {selectable && (
                                <th className="px-3 py-3 font-bold border-b border-slate-200 min-w-[40px]">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                        checked={allSelected}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                            )}
                            <th className="px-3 py-3 font-bold border-b border-slate-200 min-w-[90px]">작성일자</th>
                            <th className="px-2 py-3 font-bold border-b border-slate-200 min-w-[50px]">구분</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 text-left min-w-[140px]">공급받는자/공급자</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 text-left min-w-[120px]">현장명</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 text-left min-w-[80px]">팀명</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 text-left min-w-[150px]">품목</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 text-right min-w-[100px]">공급가액</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 text-right min-w-[90px]">세액</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 text-right min-w-[100px]">합계금액</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 text-left min-w-[100px]">비고</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 text-center min-w-[120px]">승인번호</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {records.map((record) => (
                            <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                                {selectable && (
                                    <td className="px-3 py-2">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            checked={selectedIds.includes(record.id)}
                                            onChange={(e) => handleSelectRow(record.id, e.target.checked)}
                                        />
                                    </td>
                                )}
                                <td className="px-3 py-2 whitespace-nowrap text-slate-500">{record.date}</td>
                                <td className="px-2 py-2 whitespace-nowrap">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${record.type === '매출'
                                        ? 'bg-blue-50 text-blue-600'
                                        : 'bg-red-50 text-red-600'
                                        }`}>
                                        {record.type}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-left font-medium text-slate-700 truncate max-w-[150px]" title={record.partnerName}>
                                    {record.partnerName}
                                </td>

                                {/* Site Name */}
                                <td className="px-3 py-2 text-left text-slate-600">
                                    {editable ? (
                                        <input
                                            type="text"
                                            className="w-full text-xs px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                                            value={record.siteName || ''}
                                            placeholder="현장명 입력"
                                            onChange={(e) => handleInputChange(record.id, 'siteName', e.target.value)}
                                        />
                                    ) : (
                                        <span className="truncate max-w-[120px] block" title={record.siteName}>{record.siteName || '-'}</span>
                                    )}
                                </td>

                                {/* Team Name */}
                                <td className="px-3 py-2 text-left text-slate-600">
                                    {editable ? (
                                        teams ? (
                                            <select
                                                className="w-full text-xs px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                                                value={record.teamName || ''}
                                                onChange={(e) => handleInputChange(record.id, 'teamName', e.target.value)}
                                            >
                                                <option value="">팀 선택</option>
                                                {teams.map(team => (
                                                    <option key={team.id} value={team.name}>
                                                        {team.name}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                className="w-full text-xs px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                                                value={record.teamName || ''}
                                                placeholder="팀명"
                                                onChange={(e) => handleInputChange(record.id, 'teamName', e.target.value)}
                                            />
                                        )
                                    ) : (
                                        <span className="truncate max-w-[80px] block" title={record.teamName}>{record.teamName || '-'}</span>
                                    )}
                                </td>

                                <td className="px-3 py-2 text-left text-slate-500 truncate max-w-[150px]" title={record.description}>
                                    {record.description}
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-slate-700">
                                    {Math.floor(record.supplyAmount).toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-500">
                                    {Math.floor(record.taxAmount).toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-right font-bold text-slate-800">
                                    {Math.floor(record.totalAmount).toLocaleString()}
                                </td>

                                {/* Memo */}
                                <td className="px-3 py-2 text-left text-slate-600">
                                    {editable ? (
                                        <input
                                            type="text"
                                            className="w-full text-xs px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                                            value={record.memo || ''}
                                            placeholder="비고"
                                            onChange={(e) => handleInputChange(record.id, 'memo', e.target.value)}
                                        />
                                    ) : (
                                        <span className="truncate max-w-[100px] block" title={record.memo}>{record.memo || '-'}</span>
                                    )}
                                </td>

                                <td className="px-3 py-2 text-center text-xs text-slate-400">
                                    {record.invoiceNum}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold sticky bottom-0 z-10 border-t-2 border-slate-200">
                        <tr>
                            {selectable && <td className="px-3 py-3"></td>}
                            <td className="px-3 py-3 text-center" colSpan={2}>합계</td>
                            <td className="px-3 py-3 text-left" colSpan={4}>총 {records.length.toLocaleString()} 건</td>
                            <td className="px-3 py-3 text-right text-slate-900">{totals.supply.toLocaleString()}</td>
                            <td className="px-3 py-3 text-right text-slate-600">{totals.tax.toLocaleString()}</td>
                            <td className="px-3 py-3 text-right text-blue-900">{totals.total.toLocaleString()}</td>
                            <td className="px-3 py-3" colSpan={2}></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};
