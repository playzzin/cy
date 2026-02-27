import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faUndo, faPlus, faUniversity } from '@fortawesome/free-solid-svg-icons';
import { format, startOfMonth, endOfMonth, subMonths, addDays } from 'date-fns';
import { BankAccount } from '../../../services/barobillAccountService';

type FilterProps = {
    accountNum: string;
    onAccountChange: (value: string) => void;
    accounts: BankAccount[];

    startDate: string;
    endDate: string;
    onDateChange: (start: string, end: string) => void;

    onRefresh: () => void;
    onRegister: () => void;
    loading: boolean;
};

// Helper map for bank codes
const BANK_CODES: Record<string, string> = {
    '004': '국민', '088': '신한', '020': '우리', '081': '하나',
    '011': '농협', '003': '기업', '023': 'SC제일', '002': '산업'
};

export const AccountInquiryFilterBar: React.FC<FilterProps> = ({
    accountNum,
    onAccountChange,
    accounts,
    startDate,
    endDate,
    onDateChange,
    onRefresh,
    onRegister,
    loading
}) => {
    // Quick Presets
    const setPreset = (preset: 'today' | 'yesterday' | 'thisMonth' | 'lastMonth') => {
        const today = new Date();
        let start = new Date();
        let end = new Date();

        switch (preset) {
            case 'today':
                break;
            case 'yesterday':
                start = addDays(today, -1);
                end = addDays(today, -1);
                break;
            case 'thisMonth':
                start = startOfMonth(today);
                end = today;
                break;
            case 'lastMonth':
                const lastM = subMonths(today, 1);
                start = startOfMonth(lastM);
                end = endOfMonth(lastM);
                break;
        }

        onDateChange(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-sm">
            <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">

                {/* Left: Account & Date */}
                <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">

                    {/* Account Selector */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FontAwesomeIcon icon={faUniversity} className="text-slate-400" />
                        </div>
                        <select
                            value={accountNum}
                            onChange={(e) => onAccountChange(e.target.value)}
                            className="pl-10 pr-8 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none appearance-none min-w-[240px] bg-white cursor-pointer"
                            style={{ backgroundImage: 'none' }}
                        >
                            {accounts.length === 0 && <option value="">계좌를 등록해주세요</option>}
                            {accounts.map(acc => {
                                const bankName = BANK_CODES[acc.bank] || acc.bank;
                                const display = acc.alias ? `${acc.alias} (${bankName})` : `${bankName} ${acc.accountNum}`;
                                return <option key={acc.accountNum} value={acc.accountNum}>{display}</option>;
                            })}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>

                    {/* Date Picker */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1">
                        <input
                            type="date"
                            className="bg-transparent border-none text-sm font-medium text-slate-700 outline-none px-2"
                            value={startDate}
                            onChange={(e) => onDateChange(e.target.value, endDate)}
                        />
                        <span className="text-slate-400">~</span>
                        <input
                            type="date"
                            className="bg-transparent border-none text-sm font-medium text-slate-700 outline-none px-2"
                            value={endDate}
                            onChange={(e) => onDateChange(startDate, e.target.value)}
                        />
                    </div>

                    {/* Presets */}
                    <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                        {[
                            { label: '오늘', value: 'today' },
                            { label: '어제', value: 'yesterday' },
                            { label: '이번달', value: 'thisMonth' },
                            { label: '지난달', value: 'lastMonth' },
                        ].map((p) => (
                            <button
                                key={p.value}
                                onClick={() => setPreset(p.value as any)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition whitespace-nowrap"
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex gap-2 w-full xl:w-auto mt-2 xl:mt-0">
                    <button
                        onClick={onRegister}
                        className="flex-1 xl:flex-none bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition flex items-center justify-center gap-2 shadow-sm"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        계좌 등록
                    </button>
                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="flex-1 xl:flex-none bg-slate-800 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-slate-700 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                    >
                        {loading ? (
                            <>
                                <FontAwesomeIcon icon={faUndo} className="animate-spin" />
                                <span>조회중</span>
                            </>
                        ) : (
                            <>
                                <FontAwesomeIcon icon={faSearch} />
                                <span>조회</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
