import React from 'react';
import { BankAccountLog } from '../../../services/barobillAccountService';

type TableProps = {
    records: BankAccountLog[];
    loading: boolean;
};

export const AccountTransactionTable: React.FC<TableProps> = ({
    records,
    loading
}) => {
    // Calculate Totals for Footer (Visible records only)
    const totals = records.reduce((acc, r) => ({
        deposit: acc.deposit + (Number(r.Deposit) || 0),
        withdraw: acc.withdraw + (Number(r.Withdraw) || 0)
    }), { deposit: 0, withdraw: 0 });

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

    const formatDateTime = (val: string) => {
        if (!val || val.length !== 14) return val;
        // YYYYMMDDHHMMSS -> YYYY-MM-DD HH:MM:SS
        return `${val.substring(0, 4)}-${val.substring(4, 6)}-${val.substring(6, 8)} ${val.substring(8, 10)}:${val.substring(10, 12)}:${val.substring(12, 14)}`;
    };

    const getDescription = (data: BankAccountLog) => {
        if (data.TransRemark1 && data.TransRemark1.trim()) return data.TransRemark1;
        if (data.MgtRemark1 && data.MgtRemark1.trim()) return data.MgtRemark1;
        if (data.TransRemark2 && data.TransRemark2.trim()) return data.TransRemark2;
        return data.Summary || '';
    };

    return (
        <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-auto max-h-[600px]">
                <table className="w-full text-sm text-center text-slate-600">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 min-w-[140px]">거래일시</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 text-left min-w-[200px]">내용(보낸분/받는분)</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 text-right min-w-[100px]">입금액</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 text-right min-w-[100px]">출금액</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 text-right min-w-[120px]">잔액</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 text-center min-w-[80px]">취급점</th>
                            <th className="px-3 py-3 font-bold border-b border-slate-200 text-left min-w-[150px]">메모</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {records.map((record, index) => (
                            <tr key={`${record.TransDT}-${index}`} className="hover:bg-slate-50 transition-colors">
                                <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                                    {formatDateTime(record.TransDT)}
                                </td>
                                <td className="px-3 py-2 text-left font-medium text-slate-700">
                                    <div className="text-slate-900">{record.TransRemark1}</div>
                                    {record.TransRemark2 && record.TransRemark2 !== record.TransRemark1 && (
                                        <div className="text-xs text-slate-500">{record.TransRemark2}</div>
                                    )}
                                    {record.MgtRemark1 && record.MgtRemark1 !== record.TransRemark1 && (
                                        <div className="text-xs text-slate-400">{record.MgtRemark1}</div>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-right text-red-600 font-medium">
                                    {Number(record.Deposit) > 0 ? Number(record.Deposit).toLocaleString() : '-'}
                                </td>
                                <td className="px-3 py-2 text-right text-blue-600 font-medium">
                                    {Number(record.Withdraw) > 0 ? Number(record.Withdraw).toLocaleString() : '-'}
                                </td>
                                <td className="px-3 py-2 text-right font-bold text-slate-800">
                                    {Number(record.Balance).toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-center text-xs text-slate-400">
                                    {record.TransOffice}
                                </td>
                                <td className="px-3 py-2 text-left text-slate-500 truncate max-w-[150px]" title={record.Memo}>
                                    {record.Memo}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold sticky bottom-0 z-10 border-t-2 border-slate-200">
                        <tr>
                            <td className="px-3 py-3 text-center" colSpan={2}>합계 (현재 페이지)</td>
                            <td className="px-3 py-3 text-right text-red-600">{totals.deposit.toLocaleString()}</td>
                            <td className="px-3 py-3 text-right text-blue-600">{totals.withdraw.toLocaleString()}</td>
                            <td className="px-3 py-3" colSpan={3}></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};
