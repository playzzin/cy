import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import './MonthNavigator.css';

const YEAR_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const shiftYearMonth = (yearMonth: string, offset: number): string => {
    const match = YEAR_MONTH_PATTERN.exec(yearMonth);
    if (!match || !Number.isInteger(offset)) return yearMonth;

    const date = new Date(Number(match[1]), Number(match[2]) - 1 + offset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const formatYearMonth = (yearMonth: string): string => {
    const match = YEAR_MONTH_PATTERN.exec(yearMonth);
    if (!match) return yearMonth;
    return `${match[1]}년 ${Number(match[2])}월`;
};

interface MonthNavigatorProps {
    value: string;
    onChange: (nextMonth: string) => void;
    disabled?: boolean;
    ariaLabel?: string;
}

const MonthNavigator: React.FC<MonthNavigatorProps> = ({
    value,
    onChange,
    disabled = false,
    ariaLabel = '조회월',
}) => (
    <div className="month-navigator" role="group" aria-label={ariaLabel}>
        <button
            type="button"
            className="month-navigator__button"
            onClick={() => onChange(shiftYearMonth(value, -1))}
            disabled={disabled}
            aria-label="이전 달"
            title="이전 달"
        >
            <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <output className="month-navigator__value" aria-live="polite">
            {formatYearMonth(value)}
        </output>
        <button
            type="button"
            className="month-navigator__button"
            onClick={() => onChange(shiftYearMonth(value, 1))}
            disabled={disabled}
            aria-label="다음 달"
            title="다음 달"
        >
            <ChevronRight size={18} aria-hidden="true" />
        </button>
    </div>
);

export default MonthNavigator;
