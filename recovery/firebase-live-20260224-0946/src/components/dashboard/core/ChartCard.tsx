
import React, { ReactNode } from 'react';
import { cn } from '../../../utils/cn';

interface ChartCardProps {
    title: string;
    subtitle?: string;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
    contentClassName?: string;
}

export const ChartCard: React.FC<ChartCardProps> = ({
    title,
    subtitle,
    action,
    children,
    className,
    contentClassName
}) => {
    return (
        <div className={cn(
            "bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden flex flex-col",
            className
        )}>
            <div className="px-6 py-4 border-b border-slate-50 dark:border-slate-700/50 flex justify-between items-center bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
                <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                        {title}
                    </h3>
                    {subtitle && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {subtitle}
                        </p>
                    )}
                </div>
                {action && (
                    <div className="flex items-center gap-2">
                        {action}
                    </div>
                )}
            </div>
            <div className={cn("p-6 flex-1", contentClassName)}>
                {children}
            </div>
        </div>
    );
};
