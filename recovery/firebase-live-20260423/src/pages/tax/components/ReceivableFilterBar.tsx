import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faUndo, faThumbtack } from '@fortawesome/free-solid-svg-icons';
import { format, startOfMonth, endOfMonth, subMonths, startOfQuarter, subQuarters, addDays } from 'date-fns';

type FilterProps = {
    startDate: string;
    endDate: string;
    onDateChange: (start: string, end: string) => void;

    status: '전체' | '미수' | '완납';
    onStatusChange: (status: '전체' | '미수' | '완납') => void;

    search: string;
    onSearchChange: (value: string) => void;

    onRefresh: () => void;
    loading: boolean;
    isFixed?: boolean;
    onFixedChange?: (fixed: boolean) => void;
};

export const ReceivableFilterBar: React.FC<FilterProps> = ({
    startDate,
    endDate,
    onDateChange,
    status,
    onStatusChange,
    search,
    onSearchChange,
    onRefresh,
    loading,
    isFixed,
    onFixedChange
}) => {
    // Quick Presets
    const setPreset = (preset: 'today' | 'yesterday' | 'thisMonth' | 'lastMonth' | 'lastQuarter') => {
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
            case 'lastQuarter':
                const lastQ = subQuarters(today, 1);
                start = startOfQuarter(lastQ);
                end = endOfMonth(addDays(startOfQuarter(today), -1));
                start = subMonths(today, 3);
                break;
        }
        onDateChange(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-sm">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">

                {/* Left: Date Range & Presets */}
                <div className="flex flex-col sm:flex-row gap-3 items-center w-full lg:w-auto">
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

                    <div className="flex gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-hide">
                        {[
                            { label: '오늘', value: 'today' },
                            { label: '어제', value: 'yesterday' },
                            { label: '이번달', value: 'thisMonth' },
                            { label: '지난달', value: 'lastMonth' },
                        ].map((p) => (
                            <button
                                key={p.value}
                                onClick={() => setPreset(p.value as any)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition whitespace-nowrap"
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: Status Filter, Search, Refresh */}
                <div className="flex flex-col sm:flex-row gap-3 items-center w-full lg:w-auto">

                    {/* Status Filter */}
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        {['전체', '미수', '완납'].map((t) => (
                            <button
                                key={t}
                                onClick={() => onStatusChange(t as any)}
                                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${status === t
                                    ? 'bg-white text-emerald-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative w-full sm:w-64">
                        <input
                            type="text"
                            placeholder="거래처명, 품목 검색..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    </div>

                    {/* Refresh */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => onFixedChange && onFixedChange(!isFixed)}
                            className={`p-2 rounded-lg transition-all ${isFixed
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100'
                                }`}
                            title={isFixed ? "틀고정 해제" : "틀고정 활성화"}
                        >
                            <FontAwesomeIcon icon={faThumbtack} style={{ transform: isFixed ? 'rotate(-45deg)' : 'none' }} />
                        </button>

                        <button
                            onClick={onRefresh}
                            disabled={loading}
                            className={`p-2 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all ${loading ? 'animate-spin opacity-50' : ''
                                }`}
                            title="새로고침"
                        >
                            <FontAwesomeIcon icon={faUndo} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
