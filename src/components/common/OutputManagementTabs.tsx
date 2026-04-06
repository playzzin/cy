import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChartBar,
    faFileExcel,
    faList,
    faPenToSquare,
    faUsers
} from '@fortawesome/free-solid-svg-icons';

export type OutputManagementTabKey = 'status' | 'input' | 'list-v2' | 'history';

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
            case 'list-v2':
                navigate('/reports/daily?tab=list-v2');
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
        { key: 'list-v2', label: '일보목록v2', icon: faList },
        { key: 'history', label: '인원전체관리', icon: faUsers }
    ];

    return (
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
            <div className="px-6 pt-4">
                <div className="flex items-end justify-between gap-4">
                    <div className="flex items-end gap-8 overflow-x-auto">
                        <div className="pb-3 whitespace-nowrap">
                            <div className="text-[11px] font-semibold tracking-[0.2em] text-slate-400">OUTPUT</div>
                            <h1 className="text-xl font-bold text-slate-800">{title}</h1>
                        </div>

                        <div className="flex gap-6">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => handleSelect(tab.key)}
                                    className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === tab.key
                                        ? 'border-brand-600 text-brand-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <FontAwesomeIcon icon={tab.icon} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {rightSlot ? (
                        <div className="pb-3 flex-shrink-0">{rightSlot}</div>
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
