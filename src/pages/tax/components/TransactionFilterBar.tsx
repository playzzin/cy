import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faUndo } from '@fortawesome/free-solid-svg-icons';
import { format, startOfMonth, endOfMonth, subMonths, startOfQuarter, subQuarters, addDays } from 'date-fns';

type FilterProps = {
    startDate: string;
    endDate: string;
    onDateChange: (start: string, end: string) => void;

    type: '전체' | '매출' | '매입';
    onTypeChange: (type: '전체' | '매출' | '매입') => void;

    search: string;
    onSearchChange: (value: string) => void;

    onRefresh: () => void;
    loading: boolean;
};

export const TransactionFilterBar: React.FC<FilterProps> = ({
    startDate,
    endDate,
    onDateChange,
    type,
    onTypeChange,
    search,
    onSearchChange,
    onRefresh,
    loading
}) => {
    // Quick Presets
    const setPreset = (preset: 'today' | 'yesterday' | 'thisMonth' | 'lastMonth' | 'lastQuarter') => {
        const today = new Date();
        let start = new Date();
        let end = new Date();

        switch (preset) {
            case 'today':
                // default
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
                end = endOfMonth(addDays(startOfQuarter(today), -1)); // End of last quarter
                // Simplified: just last 3 months approximation for accounting convenience often suffices, but let's be precise if possible or stick to "Last 3 Months"
                // Let's use "Last 3 Months" logic for simplicity in accounting context usually means "Recent trend"
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

                {/* Right: Type, Search, Action */}
                <div className="flex flex-col sm:flex-row gap-3 items-center w-full lg:w-auto">
                    {/* Type Filter */}
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        {(['전체', '매출', '매입'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => onTypeChange(t)}
                                className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${type === t
                                    ? t === '매출' ? 'bg-blue-600 text-white shadow-sm'
                                        : t === '매입' ? 'bg-red-500 text-white shadow-sm'
                                            : 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative w-full sm:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FontAwesomeIcon icon={faSearch} className="text-slate-400" />
                        </div>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none transition"
                            placeholder="거래처, 품목 검색..."
                        />
                    </div>

                    {/* Refresh Button */}
                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="w-full sm:w-auto bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-slate-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <FontAwesomeIcon icon={faUndo} className="animate-spin" />
                                <span>조회중</span>
                            </>
                        ) : (
                            <>
                                <FontAwesomeIcon icon={faUndo} />
                                <span>조회</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
