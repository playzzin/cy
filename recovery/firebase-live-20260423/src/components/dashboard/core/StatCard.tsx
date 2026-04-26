
import React from 'react';
import { motion } from 'framer-motion';
import { TrendBadge } from './TrendBadge';
import { cn } from '../../../utils/cn';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: number;
    trendLabel?: string;
    color?: 'blue' | 'emerald' | 'amber' | 'indigo' | 'rose' | 'slate';
    loading?: boolean;
    className?: string;
}

const colorStyles = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400",
    slate: "bg-slate-50 text-slate-600 dark:bg-slate-900/20 dark:text-slate-400",
};

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    icon: Icon,
    trend,
    trendLabel,
    color = 'blue',
    loading = false,
    className
}) => {
    return (
        <motion.div
            whileHover={{ y: -4, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)" }}
            className={cn(
                "bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700/50 shadow-sm transition-colors",
                className
            )}
        >
            <div className="flex justify-between items-start mb-4">
                <div className={cn("p-2.5 rounded-lg", colorStyles[color])}>
                    <Icon className="w-5 h-5" />
                </div>
                {trend !== undefined && (
                    <TrendBadge value={trend} label={trendLabel} />
                )}
            </div>

            <div className="space-y-1">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {title}
                </h3>
                {loading ? (
                    <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 animate-pulse rounded" />
                ) : (
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {value}
                    </div>
                )}
            </div>
        </motion.div>
    );
};
