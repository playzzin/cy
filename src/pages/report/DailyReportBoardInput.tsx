import React from 'react';
import FieldSchedulePlannerPage from '../assignment/FieldSchedulePlannerPage';

const DailyReportBoardInput: React.FC = () => {
    return (
        <div className="h-full min-h-0 overflow-hidden">
            <FieldSchedulePlannerPage mode="daily-report" />
        </div>
    );
};

export default DailyReportBoardInput;
