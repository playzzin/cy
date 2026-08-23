import React from 'react';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface SupportPageHeaderProps {
    icon: IconDefinition;
    title: string;
    description: string;
    tone?: 'indigo' | 'blue' | 'emerald' | 'violet' | 'amber' | 'slate';
    actions?: React.ReactNode;
    compact?: boolean;
}

const toneClasses: Record<NonNullable<SupportPageHeaderProps['tone']>, string> = {
    indigo: 'bg-indigo-600 text-white shadow-indigo-100',
    blue: 'bg-blue-600 text-white shadow-blue-100',
    emerald: 'bg-emerald-600 text-white shadow-emerald-100',
    violet: 'bg-violet-600 text-white shadow-violet-100',
    amber: 'bg-amber-500 text-white shadow-amber-100',
    slate: 'bg-slate-900 text-white shadow-slate-100'
};

export const SupportPageHeader: React.FC<SupportPageHeaderProps> = ({
    icon,
    title,
    description,
    tone = 'indigo',
    actions,
    compact = false
}) => (
    <div className={compact
        ? 'flex min-h-12 flex-col justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm lg:flex-row lg:items-center'
        : 'flex flex-col justify-between gap-4 lg:flex-row lg:items-center'}>
        <div className={`min-w-0 items-center gap-2.5 ${compact ? 'hidden 2xl:flex' : 'flex'}`}>
            <div className={`flex shrink-0 items-center justify-center rounded-lg shadow-lg ${toneClasses[tone]} ${compact ? 'h-8 w-8' : 'h-12 w-12'}`}>
                <FontAwesomeIcon icon={icon} className={compact ? 'text-sm' : 'text-lg'} />
            </div>
            <div className="min-w-0">
                <h1 className={compact ? 'truncate text-sm font-black text-slate-900' : 'truncate text-xl font-black tracking-tight text-slate-950 sm:text-2xl'}>{title}</h1>
                <p className={compact ? 'hidden text-xs font-semibold text-slate-500' : 'mt-1 text-sm font-semibold text-slate-500'}>{description}</p>
            </div>
        </div>
        {actions && (
            <div className={`flex w-full flex-wrap items-center gap-2 sm:justify-end ${compact ? 'lg:w-auto' : 'sm:w-auto'}`}>
                {actions}
            </div>
        )}
    </div>
);

export default SupportPageHeader;
