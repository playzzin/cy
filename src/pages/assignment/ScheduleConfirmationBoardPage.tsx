import React from 'react';
import FieldSchedulePlannerPage from './FieldSchedulePlannerPage';

const ScheduleConfirmationBoardPage: React.FC = () => {
    return (
        <div
            className="min-h-0 overflow-visible bg-slate-100 lg:h-[calc(100dvh_-_var(--header-height)_-_40px)] lg:overflow-hidden"
        >
            <FieldSchedulePlannerPage mode="schedule-confirmation" />
        </div>
    );
};

export default ScheduleConfirmationBoardPage;
