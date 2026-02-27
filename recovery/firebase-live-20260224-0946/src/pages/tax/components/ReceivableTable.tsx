import React from 'react';
import { ReceivableLedger } from '../../../services/receivableService';
import { format } from 'date-fns';

type TableProps = {
    records: ReceivableLedger[];
    loading: boolean;
    onRowClick?: (record: ReceivableLedger) => void;
    selectedId?: string | null;
    isFixed?: boolean;
};

export const ReceivableTable: React.FC<TableProps> = ({
    records,
    loading,
    onRowClick,
    selectedId,
    isFixed
}) => {
    // Calculate totals for footer
    const totals = records.reduce((acc, r) => ({
        total: acc.total + r.invoiceData.totalAmount,
        paid: acc.paid + r.totalPaidAmount,
        outstanding: acc.outstanding + r.outstandingAmount
    }), { total: 0, paid: 0, outstanding: 0 });

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
                <span className="text-slate-400">데이터가 없습니다.</span>
            </div>
        );
    }

    return (
        <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="overflow-auto flex-1">
                <table className="w-full text-sm text-center text-slate-600">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className={`px-3 py-3 font-bold border-b border-slate-200 whitespace-nowrap transition-all ${isFixed ? 'sticky left-0 z-20 bg-slate-50' : ''}`}>작성일자</th>
                            <th className={`px-3 py-3 font-bold border-b border-slate-200 whitespace-nowrap transition-all ${isFixed ? 'sticky left-[100px] z-20 bg-slate-50 border-r border-slate-200' : ''}`}>거래처명</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 whitespace-nowrap text-left">품목</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 whitespace-nowrap text-right">청구금액</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 whitespace-nowrap text-right">수금액</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 whitespace-nowrap text-right">미수잔액</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 whitespace-nowrap">상태</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 whitespace-nowrap">최근수금일</th>
                        </tr>
                    </thead>
                    <tbody>
                        {records.map((record) => (
                            <tr
                                key={record.id}
                                className={`border-b hover:bg-slate-50 transition-colors cursor-pointer ${selectedId === record.id ? 'bg-blue-50 hover:bg-blue-100' : ''}`}
                                onClick={() => onRowClick && onRowClick(record)}
                            >
                                <td className={`px-3 py-2 whitespace-nowrap text-slate-500 transition-all ${isFixed ? 'sticky left-0 z-10 bg-inherit shadow-[1px_0_0_0_rgba(226,232,240,1)]' : ''}`}>
                                    {record.invoiceData.date}
                                </td>
                                <td className={`px-3 py-2 whitespace-nowrap font-medium text-slate-800 transition-all ${isFixed ? 'sticky left-[100px] z-10 bg-inherit border-r border-slate-200 shadow-[1px_0_0_0_rgba(226,232,240,1)]' : ''}`}>
                                    {record.invoiceData.partnerName}
                                </td>
                                <td className="px-3 py-2 text-left max-w-[200px] truncate text-slate-600" title={record.invoiceData.itemName}>
                                    {record.invoiceData.itemName}
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-slate-700">
                                    {record.invoiceData.totalAmount.toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-emerald-600">
                                    {record.totalPaidAmount > 0 ? record.totalPaidAmount.toLocaleString() : '-'}
                                </td>
                                <td className="px-3 py-2 text-right font-bold text-red-600">
                                    {record.outstandingAmount !== 0 ? record.outstandingAmount.toLocaleString() : '-'}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    <StatusBadge status={record.status} />
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-slate-400 text-xs">
                                    {record.lastPaymentDate || '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-200 sticky bottom-0 z-10">
                        <tr>
                            <td colSpan={3} className="px-3 py-3 text-center">합계</td>
                            <td className="px-3 py-3 text-right text-blue-700">{totals.total.toLocaleString()}</td>
                            <td className="px-3 py-3 text-right text-emerald-700">{totals.paid.toLocaleString()}</td>
                            <td className="px-3 py-3 text-right text-red-700">{totals.outstanding.toLocaleString()}</td>
                            <td colSpan={2}></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

const StatusBadge = ({ status }: { status: string }) => {
    let colorClass = 'bg-slate-100 text-slate-600';
    if (status === '완납') colorClass = 'bg-emerald-100 text-emerald-700';
    if (status === '미수') colorClass = 'bg-red-100 text-red-700';
    if (status === '부분수납') colorClass = 'bg-orange-100 text-orange-700';
    if (status === '과입금') colorClass = 'bg-blue-100 text-blue-700';

    return (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
            {status}
        </span>
    );
};
