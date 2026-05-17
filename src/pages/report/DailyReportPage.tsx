import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DailyReportBoardInput from './DailyReportBoardInput';
import DailyReportInput from './DailyReportInput';
import DailyReportListV2 from './DailyReportListV2';
import OutputManagementTabs, { OutputManagementTabKey } from '../../components/common/OutputManagementTabs';

const DailyReportPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const tab = searchParams.get('tab');
    const activeTab = tab === 'list'
        ? 'list-v2'
        : tab === 'list-v2' || tab === 'input' || tab === 'board-input'
            ? tab
            : 'input';
    const isBoardInputTab = activeTab === 'board-input';

    useEffect(() => {
        if (!tab) {
            const next = new URLSearchParams(searchParams);
            next.set('tab', 'input');
            setSearchParams(next, { replace: true });
            return;
        }

        if (tab === 'list') {
            const next = new URLSearchParams(searchParams);
            next.set('tab', 'list-v2');
            setSearchParams(next, { replace: true });
        }
    }, [searchParams, setSearchParams, tab]);

    const handleTabChange = (nextTab: string) => {
        const next = new URLSearchParams(searchParams);
        next.set('tab', nextTab);
        setSearchParams(next);
    };

    const handleTopTabSelect = (nextTab: OutputManagementTabKey) => {
        if (nextTab === 'input' || nextTab === 'board-input' || nextTab === 'list-v2') {
            handleTabChange(nextTab);
            return;
        }

        if (nextTab === 'status') {
            navigate('/jeonkuk/integrated-status');
            return;
        }

        navigate('/jeonkuk/total-history');
    };

    return (
        <div
            className={`flex min-h-0 flex-col bg-[#f1f5f9] font-['Pretendard'] ${
                isBoardInputTab
                    ? 'h-[calc(100vh_-_var(--header-height)_-_40px)] max-h-[calc(100vh_-_var(--header-height)_-_40px)] overflow-hidden md:h-[calc(100vh_-_var(--header-height)_-_60px)] md:max-h-[calc(100vh_-_var(--header-height)_-_60px)]'
                    : 'h-full'
            }`}
        >
            <OutputManagementTabs
                activeTab={isBoardInputTab ? 'board-input' : activeTab === 'list-v2' ? 'list-v2' : 'input'}
                onTabSelect={handleTopTabSelect}
                title="출력일보 관리"
            />

            {/* Content Area */}
            <div className={`flex-1 min-h-0 ${isBoardInputTab ? 'overflow-hidden' : ''}`}>
                {activeTab === 'input' ? (
                    <DailyReportInput />
                ) : activeTab === 'board-input' ? (
                    <DailyReportBoardInput />
                ) : (
                    <div className="h-full min-h-0 px-3 pt-3 pb-1 md:px-4 md:pt-4 md:pb-1">
                        <DailyReportListV2
                            initialDate={searchParams.get('date') || undefined}
                            targetReportId={searchParams.get('reportId') || undefined}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailyReportPage;
