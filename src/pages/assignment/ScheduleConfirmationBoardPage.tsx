import React from 'react';
import FieldSchedulePlannerPage from './FieldSchedulePlannerPage';

const ScheduleConfirmationBoardPage: React.FC = () => {
    return (
        <div
            className="h-[calc(100dvh_-_var(--header-height)_-_20px)] min-h-0 overflow-y-auto overscroll-contain bg-slate-100 md:h-[calc(100dvh_-_var(--header-height)_-_40px)] lg:overflow-hidden"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
        >
            <FieldSchedulePlannerPage mode="schedule-confirmation" />
        </div>
    );
};

export default ScheduleConfirmationBoardPage;
