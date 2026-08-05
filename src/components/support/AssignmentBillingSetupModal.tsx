import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboardCheck, faFileInvoiceDollar, faTimes, faUsers } from '@fortawesome/free-solid-svg-icons';

export type AssignmentBillingSection = 'assignment' | 'billing';
export type AssignmentBillingSummaryTone = 'slate' | 'indigo' | 'emerald' | 'amber';

export interface AssignmentBillingSummaryItem {
    label: string;
    value: React.ReactNode;
    tone?: AssignmentBillingSummaryTone;
}

interface AssignmentBillingSetupModalProps {
    isOpen: boolean;
    title: string;
    subtitle?: string;
    resourceLabel?: string;
    initialSection?: AssignmentBillingSection;
    summaryItems?: AssignmentBillingSummaryItem[];
    ledgerHint?: string;
    assignmentContent?: React.ReactNode;
    billingContent?: React.ReactNode;
    onClose: () => void;
}

const summaryToneClasses: Record<AssignmentBillingSummaryTone, string> = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-800',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-100 bg-amber-50 text-amber-800'
};

export const AssignmentBillingSetupModal: React.FC<AssignmentBillingSetupModalProps> = ({
    isOpen,
    title,
    subtitle,
    resourceLabel = '대상',
    initialSection = 'assignment',
    summaryItems = [],
    ledgerHint,
    assignmentContent,
    billingContent,
    onClose
}) => {
    const hasAssignment = Boolean(assignmentContent);
    const hasBilling = Boolean(billingContent);
    const titleId = React.useId();
    const panelId = React.useId();
    const [activeSection, setActiveSection] = React.useState<AssignmentBillingSection>(
        initialSection === 'billing' && hasBilling ? 'billing' : 'assignment'
    );

    React.useEffect(() => {
        if (!isOpen) return;
        if (initialSection === 'billing' && hasBilling) {
            setActiveSection('billing');
            return;
        }
        if (hasAssignment) {
            setActiveSection('assignment');
            return;
        }
        if (hasBilling) {
            setActiveSection('billing');
        }
    }, [hasAssignment, hasBilling, initialSection, isOpen]);

    if (!isOpen) return null;

    const tabs: Array<{
        key: AssignmentBillingSection;
        label: string;
        description: string;
        icon: typeof faUsers;
        enabled: boolean;
    }> = [
        {
            key: 'assignment',
            label: '배정 대상',
            description: `${resourceLabel} 사용자 변경`,
            icon: faUsers,
            enabled: hasAssignment
        },
        {
            key: 'billing',
            label: '청구 방식',
            description: '누구에게 청구할지 선택',
            icon: faFileInvoiceDollar,
            enabled: hasBilling
        }
    ];

    const activeContent = activeSection === 'billing' ? billingContent : assignmentContent;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="assignment-billing-modal flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white text-slate-800 shadow-2xl animate-fade-in-up"
            >
                <style>{`
                    .assignment-billing-modal input,
                    .assignment-billing-modal select,
                    .assignment-billing-modal textarea {
                        background-color: #ffffff;
                        color: #1f2937;
                        caret-color: #1f2937;
                    }
                    .assignment-billing-modal input::placeholder,
                    .assignment-billing-modal textarea::placeholder {
                        color: #94a3b8;
                    }
                    .assignment-billing-modal option {
                        background-color: #ffffff;
                        color: #1f2937;
                    }
                    .assignment-billing-modal input[type="checkbox"],
                    .assignment-billing-modal input[type="radio"] {
                        background-color: initial;
                    }
                `}</style>
                <div className="border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm text-white shadow-sm shadow-indigo-100">
                                    <FontAwesomeIcon icon={activeSection === 'billing' ? faFileInvoiceDollar : faUsers} />
                                </span>
                                <div className="min-w-0">
                                    <p className="text-xs font-extrabold text-indigo-500">빠른 배정/청구 설정</p>
                                    <h2 id={titleId} className="truncate text-lg font-black text-slate-900 sm:text-xl">{title}</h2>
                                </div>
                            </div>
                            {subtitle && (
                                <p className="mt-2 text-sm font-medium text-slate-500 sm:ml-11">{subtitle}</p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                            aria-label="닫기"
                        >
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    </div>

                    {(summaryItems.length > 0 || ledgerHint) && (
                        <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)]">
                            {summaryItems.length > 0 && (
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                    {summaryItems.map((item) => {
                                        const tone = item.tone ?? 'slate';
                                        return (
                                            <div key={item.label} className={`rounded-lg border px-3 py-2 ${summaryToneClasses[tone]}`}>
                                                <div className="text-[11px] font-extrabold text-current opacity-60">{item.label}</div>
                                                <div className="mt-1 truncate text-sm font-extrabold">{item.value}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {ledgerHint && (
                                <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-800">
                                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-[11px] text-white">
                                        <FontAwesomeIcon icon={faClipboardCheck} />
                                    </span>
                                    <div className="min-w-0">
                                        <div className="text-[11px] font-extrabold opacity-70">관리대장 반영</div>
                                        <div className="mt-0.5 text-xs font-bold leading-snug">{ledgerHint}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {hasAssignment && hasBilling && (
                        <div className="mt-4 grid grid-cols-2 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="배정 및 청구 설정 단계">
                            {tabs.map((tab, index) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    role="tab"
                                    id={`${panelId}-${tab.key}-tab`}
                                    aria-controls={`${panelId}-${tab.key}`}
                                    aria-selected={activeSection === tab.key}
                                    onClick={() => tab.enabled && setActiveSection(tab.key)}
                                    disabled={!tab.enabled}
                                    className={`min-w-0 rounded-md px-3 py-2 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                                        activeSection === tab.key
                                            ? 'bg-white text-indigo-700 shadow-sm'
                                            : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
                                    } ${!tab.enabled ? 'cursor-not-allowed opacity-40' : ''}`}
                                >
                                    <div className="flex items-center gap-2 text-sm font-extrabold">
                                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                                            activeSection === tab.key ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                                        }`}>
                                            {index + 1}
                                        </span>
                                        <FontAwesomeIcon icon={tab.icon} className="text-xs" />
                                        <span>{tab.label}</span>
                                    </div>
                                    <div className="mt-0.5 hidden truncate text-[11px] font-semibold text-slate-400 sm:block">
                                        {tab.description}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div
                    id={`${panelId}-${activeSection}`}
                    role="tabpanel"
                    aria-labelledby={`${panelId}-${activeSection}-tab`}
                    className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-6"
                >
                    {activeContent}
                </div>
            </div>
        </div>
    );
};

export default AssignmentBillingSetupModal;
