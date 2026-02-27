
import React from 'react';
import { DashboardPeriod } from '../../../types/dashboard';
import { cn } from '../../../utils/cn';
import { Calendar } from 'lucide-react';

interface PeriodSelectorProps {
    period: DashboardPeriod;
    onChange: (period: DashboardPeriod) => void;
    className?: string;
}

const periods: { value: DashboardPeriod; label: string }[] = [
    { value: 'today', label: '오늘' },
    { value: 'week', label: '이번 주' },
    { value: 'month', label: '이번 달' },
    { value: 'custom', label: '직접 선택' },
];

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
    period,
    onChange,
    className
}) => {
    return (
        <div className={cn("inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg", className)}>
            {periods.map((p) => (
                <button
                    key={p.value}
                    onClick={() => onChange(p.value)}
                    className={cn(
                        "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
                        period === p.value
                            ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    )}
                >
                    {p.label}
                </button>
            ))}
            {/* Custom Range Picker Trigger could go here if implemented with detailed DatePicker */}
        </div>
    );
};
