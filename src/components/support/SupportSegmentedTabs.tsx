import React from 'react';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export interface SupportSegmentedTabOption<T extends string> {
    id: T;
    label: string;
    icon: IconDefinition;
}

interface SupportSegmentedTabsProps<T extends string> {
    options: SupportSegmentedTabOption<T>[];
    activeId: T;
    onChange: (id: T) => void;
    ariaLabel: string;
}

export function SupportSegmentedTabs<T extends string>({
    options,
    activeId,
    onChange,
    ariaLabel
}: SupportSegmentedTabsProps<T>) {
    return (
        <div className="support-scroll-x w-full lg:w-auto lg:shrink-0" role="tablist" aria-label={ariaLabel}>
            <div className="support-scroll-inner flex rounded-lg bg-slate-100 p-1">
                {options.map((option) => {
                    const isActive = activeId === option.id;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            aria-current={isActive ? 'page' : undefined}
                            onClick={() => onChange(option.id)}
                            className={`inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md px-4 text-sm font-extrabold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:px-5 ${
                                isActive
                                    ? 'bg-white text-indigo-700 shadow-sm'
                                    : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
                            }`}
                        >
                            <FontAwesomeIcon icon={option.icon} className="mr-2 text-xs" />
                            {option.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default SupportSegmentedTabs;
