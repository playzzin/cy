import React from 'react';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface SupportPageHeaderProps {
    icon: IconDefinition;
    title: string;
    description: string;
    tone?: 'indigo' | 'blue' | 'emerald' | 'violet' | 'amber' | 'slate';
    actions?: React.ReactNode;
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
    actions
}) => (
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg shadow-lg ${toneClasses[tone]}`}>
                <FontAwesomeIcon icon={icon} className="text-lg" />
            </div>
            <div className="min-w-0">
                <h1 className="truncate text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{title}</h1>
                <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p>
            </div>
        </div>
        {actions && (
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                {actions}
            </div>
        )}
    </div>
);

export default SupportPageHeader;
