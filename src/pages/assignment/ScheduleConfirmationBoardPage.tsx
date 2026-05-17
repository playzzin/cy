import React from 'react';
import FieldSchedulePlannerPage from './FieldSchedulePlannerPage';

const ScheduleConfirmationBoardPage: React.FC = () => {
    return (
        <div className="h-[calc(100vh_-_var(--header-height)_-_20px)] min-h-0 overflow-hidden bg-slate-100 md:h-[calc(100vh_-_var(--header-height)_-_40px)]">
            <FieldSchedulePlannerPage mode="schedule-confirmation" />
        </div>
    );
};

export default ScheduleConfirmationBoardPage;
