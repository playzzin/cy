import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChartBar,
    faCalendarDays,
    faFileExcel,
    faList,
    faListCheck,
    faPenToSquare,
    faTableCells,
    faUsers
} from '@fortawesome/free-solid-svg-icons';

export type OutputManagementTabKey = 'status' | 'input' | 'board-input' | 'list-v2' | 'calendar' | 'labor-check' | 'history';

interface OutputManagementTabsProps {
    activeTab: OutputManagementTabKey;
    onTabSelect?: (tab: OutputManagementTabKey) => void;
    rightSlot?: React.ReactNode;
    title?: string;
}

const OutputManagementTabs: React.FC<OutputManagementTabsProps> = ({
    activeTab,
    onTabSelect,
    rightSlot,
    title = '출력 관리'
}) => {
    const navigate = useNavigate();
    const tabRailRef = useRef<HTMLDivElement | null>(null);
    const activeTabRef = useRef<HTMLButtonElement | null>(null);

    const handleSelect = (tab: OutputManagementTabKey) => {
        if (onTabSelect) {
            onTabSelect(tab);
            return;
        }

        switch (tab) {
            case 'status':
                navigate('/jeonkuk/integrated-status');
                return;
            case 'input':
                navigate('/reports/daily?tab=input');
                return;
            case 'board-input':
                navigate('/reports/daily?tab=board-input');
                return;
            case 'list-v2':
                navigate('/reports/daily?tab=list-v2');
                return;
            case 'calendar':
                navigate('/reports/daily-worker-calendar');
                return;
            case 'labor-check':
                navigate('/reports/labor-check');
                return;
            case 'history':
                navigate('/jeonkuk/total-history');
                return;
            default:
                return;
        }
    };

    const tabs: Array<{ key: OutputManagementTabKey; label: string; icon: typeof faChartBar }> = [
        { key: 'status', label: '현황판', icon: faChartBar },
        { key: 'input', label: '일보작성', icon: faPenToSquare },
        { key: 'board-input', label: '보드입력', icon: faTableCells },
        { key: 'list-v2', label: '일보목록', icon: faList },
        { key: 'calendar', label: '개인달력', icon: faCalendarDays },
        { key: 'labor-check', label: '노임체크', icon: faListCheck },
        { key: 'history', label: '인원전체관리', icon: faUsers }
    ];

    useEffect(() => {
        const rail = tabRailRef.current;
        const activeButton = activeTabRef.current;
        if (!rail || !activeButton) return;

        const targetLeft = activeButton.offsetLeft - (rail.clientWidth - activeButton.clientWidth) / 2;
        rail.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    }, [activeTab]);

    return (
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
            <div className="px-3 pt-3 sm:px-6 sm:pt-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-end sm:gap-8">
                        <div className="whitespace-nowrap pb-1 sm:pb-3">
                            <div className="text-[11px] font-semibold tracking-[0.2em] text-slate-400">OUTPUT</div>
                            <h1 className="text-xl font-bold text-slate-800">{title}</h1>
                        </div>

                        <nav className="min-w-0 flex-1" aria-label="출력 관리 메뉴">
                            <div
                                ref={tabRailRef}
                                className="output-management-tab-rail flex gap-2 overflow-x-auto overscroll-x-contain scroll-smooth sm:gap-6"
                            >
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.key}
                                        ref={activeTab === tab.key ? activeTabRef : undefined}
                                        type="button"
                                        onClick={() => handleSelect(tab.key)}
                                        title={`${tab.label}으로 이동`}
                                        aria-current={activeTab === tab.key ? 'page' : undefined}
                                        className={`flex min-h-11 flex-shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-2 text-sm font-bold transition-colors focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${activeTab === tab.key
                                            ? 'border-brand-600 text-brand-600'
                                            : 'border-transparent text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        <FontAwesomeIcon icon={tab.icon} />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </nav>
                    </div>

                    {rightSlot ? (
                        <div className="flex-shrink-0 pb-2 sm:pb-3">{rightSlot}</div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export const OutputManagementMassUploadButton: React.FC = () => {
    const navigate = useNavigate();

    return (
        <button
            type="button"
            onClick={() => navigate('/mass-upload/daily-report')}
            className="text-sm font-bold text-green-600 hover:text-green-700 transition-colors flex items-center gap-2 whitespace-nowrap"
        >
            <FontAwesomeIcon icon={faFileExcel} />
            엑셀 일괄 등록
        </button>
    );
};

export default OutputManagementTabs;
