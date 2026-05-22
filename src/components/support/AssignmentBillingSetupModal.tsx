import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileInvoiceDollar, faTimes, faUsers } from '@fortawesome/free-solid-svg-icons';

export type AssignmentBillingSection = 'assignment' | 'billing';

interface AssignmentBillingSetupModalProps {
    isOpen: boolean;
    title: string;
    subtitle?: string;
    resourceLabel?: string;
    initialSection?: AssignmentBillingSection;
    assignmentContent?: React.ReactNode;
    billingContent?: React.ReactNode;
    onClose: () => void;
}

export const AssignmentBillingSetupModal: React.FC<AssignmentBillingSetupModalProps> = ({
    isOpen,
    title,
    subtitle,
    resourceLabel = '대상',
    initialSection = 'assignment',
    assignmentContent,
    billingContent,
    onClose
}) => {
    const hasAssignment = Boolean(assignmentContent);
    const hasBilling = Boolean(billingContent);
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
            label: '배정',
            description: `${resourceLabel} 배정 변경`,
            icon: faUsers,
            enabled: hasAssignment
        },
        {
            key: 'billing',
            label: '청구',
            description: '청구대상 설정',
            icon: faFileInvoiceDollar,
            enabled: hasBilling
        }
    ];

    const activeContent = activeSection === 'billing' ? billingContent : assignmentContent;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-4">
            <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-fade-in-up">
                <div className="border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm text-white shadow-lg shadow-indigo-100">
                                    <FontAwesomeIcon icon={activeSection === 'billing' ? faFileInvoiceDollar : faUsers} />
                                </span>
                                <div className="min-w-0">
                                    <p className="text-xs font-extrabold uppercase tracking-wider text-indigo-500">배정/청구 설정</p>
                                    <h2 className="truncate text-lg font-black text-slate-900 sm:text-xl">{title}</h2>
                                </div>
                            </div>
                            {subtitle && (
                                <p className="mt-2 text-sm font-medium text-slate-500 sm:ml-11">{subtitle}</p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                            aria-label="닫기"
                        >
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    </div>

                    {hasAssignment && hasBilling && (
                        <div className="mt-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => tab.enabled && setActiveSection(tab.key)}
                                    disabled={!tab.enabled}
                                    className={`min-w-0 rounded-lg px-3 py-2 text-left transition-all ${
                                        activeSection === tab.key
                                            ? 'bg-white text-indigo-700 shadow-sm'
                                            : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
                                    } ${!tab.enabled ? 'cursor-not-allowed opacity-40' : ''}`}
                                >
                                    <div className="flex items-center gap-2 text-sm font-extrabold">
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

                <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-6">
                    {activeContent}
                </div>
            </div>
        </div>
    );
};

export default AssignmentBillingSetupModal;
