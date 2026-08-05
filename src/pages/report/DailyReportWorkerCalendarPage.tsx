import React from 'react';
import { useSearchParams } from 'react-router-dom';
import OutputManagementTabs from '../../components/common/OutputManagementTabs';
import DailyReportWorkerCalendar from './DailyReportWorkerCalendar';

const DailyReportWorkerCalendarPage: React.FC = () => {
    const [searchParams] = useSearchParams();

    return (
        <div className="flex h-full min-h-0 flex-col bg-[#f1f5f9] font-['Pretendard']">
            <OutputManagementTabs
                activeTab="calendar"
                title="출력일보 관리"
            />
            <div className="min-h-0 flex-1 px-3 pt-3 pb-1 md:px-4 md:pt-4 md:pb-1">
                <DailyReportWorkerCalendar
                    initialDate={searchParams.get('date') || undefined}
                    initialSiteId={searchParams.get('siteId') || undefined}
                />
            </div>
        </div>
    );
};

export default DailyReportWorkerCalendarPage;
