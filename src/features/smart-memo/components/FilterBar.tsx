import React from 'react';
import { motion } from 'framer-motion';
import { useMemoStore } from '../store/useMemoStore';
import { MemoColor, MemoType, MemoSortField } from '../types/memo';
import { cn } from '../lib/utils';
import {
    SortAsc,
    SortDesc,
    FileText,
    CheckSquare,
    X,
    Filter
} from 'lucide-react';

const COLORS: MemoColor[] = ['white', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'];

const COLOR_CLASSES: Record<MemoColor, string> = {
    white: 'bg-white border-2',
    red: 'bg-rose-400',
    orange: 'bg-orange-400',
    yellow: 'bg-amber-400',
    green: 'bg-emerald-400',
    blue: 'bg-sky-400',
    purple: 'bg-violet-400',
    gray: 'bg-slate-400',
};

const SORT_OPTIONS: { value: MemoSortField; label: string }[] = [
    { value: 'manual', label: '수동' },
    { value: 'createdAt', label: '생성일' },
    { value: 'updatedAt', label: '수정일' },
    { value: 'title', label: '제목' },
    { value: 'color', label: '색상' },
];

interface FilterBarProps {
    className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({ className }) => {
    const filters = useMemoStore(state => state.filters);
    const setFilters = useMemoStore(state => state.setFilters);
    const sortConfig = useMemoStore(state => state.sortConfig);
    const setSortConfig = useMemoStore(state => state.setSortConfig);

    const hasActiveFilters = filters.colorFilter || filters.typeFilter;

    const clearFilters = () => {
        setFilters({ colorFilter: null, typeFilter: null });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "flex items-center gap-4 p-3 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200/50 dark:border-zinc-700/50",
                className
            )}
        >
            {/* Filter Icon */}
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Filter size={16} />
                <span className="text-xs font-medium hidden sm:inline">필터</span>
            </div>

            {/* Color Filter */}
            <div className="flex items-center gap-1">
                {COLORS.map(color => (
                    <button
                        key={color}
                        onClick={() => setFilters({
                            colorFilter: filters.colorFilter === color ? null : color
                        })}
                        className={cn(
                            "w-5 h-5 rounded-full transition-all duration-200 cursor-pointer",
                            COLOR_CLASSES[color],
                            filters.colorFilter === color
                                ? "ring-2 ring-offset-2 ring-blue-500 scale-110"
                                : "hover:scale-110 opacity-60 hover:opacity-100"
                        )}
                        title={color}
                    />
                ))}
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-slate-200 dark:bg-zinc-700" />

            {/* Type Filter */}
            <div className="flex items-center gap-1">
                <button
                    onClick={() => setFilters({
                        typeFilter: filters.typeFilter === 'text' ? null : 'text'
                    })}
                    className={cn(
                        "p-1.5 rounded-lg transition-all",
                        filters.typeFilter === 'text'
                            ? "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400"
                            : "text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-700"
                    )}
                    title="텍스트 메모"
                >
                    <FileText size={16} />
                </button>
                <button
                    onClick={() => setFilters({
                        typeFilter: filters.typeFilter === 'checklist' ? null : 'checklist'
                    })}
                    className={cn(
                        "p-1.5 rounded-lg transition-all",
                        filters.typeFilter === 'checklist'
                            ? "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400"
                            : "text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-700"
                    )}
                    title="체크리스트"
                >
                    <CheckSquare size={16} />
                </button>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
                <button
                    onClick={clearFilters}
                    className="p-1 rounded-full bg-red-100 text-red-500 hover:bg-red-200 transition-colors"
                    title="필터 초기화"
                >
                    <X size={14} />
                </button>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Sort Controls */}
            <div className="flex items-center gap-2">
                <select
                    value={sortConfig.field}
                    onChange={(e) => setSortConfig({ ...sortConfig, field: e.target.value as MemoSortField })}
                    className="text-xs bg-transparent border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    {SORT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <button
                    onClick={() => setSortConfig({
                        ...sortConfig,
                        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'
                    })}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
                    title={sortConfig.direction === 'asc' ? '오름차순' : '내림차순'}
                >
                    {sortConfig.direction === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
                </button>
            </div>
        </motion.div>
    );
};
