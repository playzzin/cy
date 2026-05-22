import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileInvoiceDollar, faUserCheck } from '@fortawesome/free-solid-svg-icons';

export type BillingMode = 'same' | 'custom' | 'split';

interface BillingModeSelectorProps {
    value: BillingMode;
    onChange: (mode: BillingMode) => void;
    sameLabel: string;
    sameDescription: string;
    customLabel?: string;
    customDescription?: string;
    disabled?: boolean;
    sameDisabled?: boolean;
    customDisabled?: boolean;
}

interface BillingStatusItem {
    label: string;
    value: React.ReactNode;
    tone?: 'slate' | 'emerald' | 'indigo' | 'amber';
}

interface BillingStatusSummaryProps {
    items: BillingStatusItem[];
}

const toneClasses: Record<NonNullable<BillingStatusItem['tone']>, string> = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-800',
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-800',
    amber: 'border-amber-100 bg-amber-50 text-amber-800'
};

export const BillingModeSelector: React.FC<BillingModeSelectorProps> = ({
    value,
    onChange,
    sameLabel,
    sameDescription,
    customLabel = '별도 청구대상',
    customDescription = '배정 대상과 청구 대상이 다를 때 선택',
    disabled = false,
    sameDisabled = false,
    customDisabled = false
}) => {
    const selectedValue = value === 'split' ? 'custom' : value;
    const options = [
        {
            key: 'same' as const,
            label: sameLabel,
            description: sameDescription,
            icon: faUserCheck,
            disabled: sameDisabled
        },
        {
            key: 'custom' as const,
            label: customLabel,
            description: customDescription,
            icon: faFileInvoiceDollar,
            disabled: customDisabled
        }
    ];

    return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {options.map((option) => {
                const isSelected = selectedValue === option.key;
                const isDisabled = disabled || option.disabled;

                return (
                    <button
                        key={option.key}
                        type="button"
                        onClick={() => !isDisabled && onChange(option.key)}
                        disabled={isDisabled}
                        className={`min-h-[78px] rounded-xl border p-3 text-left transition-all ${
                            isSelected
                                ? 'border-indigo-300 bg-indigo-50 text-indigo-900 shadow-sm'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/40'
                        } ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                        <div className="flex items-start gap-2">
                            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs ${
                                isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                                <FontAwesomeIcon icon={option.icon} />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-sm font-extrabold leading-tight">{option.label}</span>
                                <span className="mt-1 block text-xs font-semibold leading-snug text-slate-500">{option.description}</span>
                            </span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

export const BillingStatusSummary: React.FC<BillingStatusSummaryProps> = ({ items }) => (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {items.map((item) => {
            const tone = item.tone ?? 'slate';
            return (
                <div key={item.label} className={`rounded-xl border px-3 py-2 ${toneClasses[tone]}`}>
                    <div className="text-[11px] font-extrabold uppercase text-current opacity-60">{item.label}</div>
                    <div className="mt-1 min-h-[20px] truncate text-sm font-extrabold">{item.value}</div>
                </div>
            );
        })}
    </div>
);
