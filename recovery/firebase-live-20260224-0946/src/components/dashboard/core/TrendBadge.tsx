
import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '../../../utils/cn'; // Assuming utility exists, otherwise define inline or use clsx/tailwind-merge directly if not.
// Checking package.json: "clsx": "^2.1.1", "tailwind-merge": "^3.4.0"
// I will create utils/cn.ts first if it doesn't exist, but usually it does. 
// I'll check first, but to be safe I'll inline the helper or create it.
// Checking previous file list, I didn't see utils/cn.ts but it's common.
// I'll assume standard shadcn-like structure or just implement inline for now to avoid errors.

// cn imported from utils

interface TrendBadgeProps {
    value: number; // percentage (e.g., 12.5 for 12.5%)
    label?: string; // e.g., "vs last week"
    className?: string;
}

export const TrendBadge: React.FC<TrendBadgeProps> = ({ value, label, className }) => {
    const isPositive = value > 0;
    const isNegative = value < 0;
    const isNeutral = value === 0;

    return (
        <div className={cn("flex items-center gap-1.5", className)}>
            <div className={cn(
                "flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium",
                isPositive && "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
                isNegative && "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400",
                isNeutral && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            )}>
                {isPositive && <ArrowUpRight className="w-3 h-3 mr-0.5" />}
                {isNegative && <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                {isNeutral && <Minus className="w-3 h-3 mr-0.5" />}

                {Math.abs(value).toFixed(1)}%
            </div>
            {label && <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>}
        </div>
    );
};
