import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilter, faRotateRight, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

export const DailyReportListLoadingState: React.FC = () => (
    <div className="daily-report-v2-loading-state" role="status" aria-live="polite">
        <div className="daily-report-v2-loading-spinner" aria-hidden="true" />
        <strong>일보 목록을 불러오는 중입니다.</strong>
        <span>조회 기간에 따라 잠시 걸릴 수 있어요.</span>
    </div>
);
interface DailyReportListErrorStateProps {
    message: string;
    startDate: string;
    endDate: string;
    onRetry: () => void;
}

export const DailyReportListErrorState: React.FC<DailyReportListErrorStateProps> = ({
    message,
    startDate,
    endDate,
    onRetry,
}) => (
    <div className="daily-report-v2-error-state" role="alert">
        <div className="daily-report-v2-error-icon" aria-hidden="true">
            <FontAwesomeIcon icon={faTriangleExclamation} />
        </div>
        <div>
            <h2>일보 목록을 불러오지 못했습니다</h2>
            <p>{message}</p>
            <span>{startDate} ~ {endDate}</span>
        </div>
        <button type="button" onClick={onRetry}>
            <FontAwesomeIcon icon={faRotateRight} />
            다시 시도
        </button>
    </div>
);

interface DailyReportListEmptyStateProps {
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    activeFilterLabels: string[];
    hasActiveListFilters: boolean;
    onClearFilters: () => void;
    onToday: () => void;
}

export const DailyReportListEmptyState: React.FC<DailyReportListEmptyStateProps> = ({
    title,
    description,
    startDate,
    endDate,
    activeFilterLabels,
    hasActiveListFilters,
    onClearFilters,
    onToday,
}) => (
    <div className="daily-report-v2-empty-state" role="status" aria-live="polite">
        <div className="daily-report-v2-empty-icon" aria-hidden="true">
            <FontAwesomeIcon icon={faFilter} />
        </div>
        <div className="daily-report-v2-empty-copy">
            <h2>{title}</h2>
            <p>{description}</p>
        </div>
        <div className="daily-report-v2-empty-meta" aria-label="현재 조회 조건">
            <span>기간: {startDate} ~ {endDate}</span>
            {activeFilterLabels.length > 0
                ? activeFilterLabels.map((label) => <span key={label}>{label}</span>)
                : <span>추가 필터 없음</span>}
        </div>
        <div className="daily-report-v2-empty-actions">
            {hasActiveListFilters && (
                <button
                    type="button"
                    onClick={onClearFilters}
                    className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                >
                    필터 초기화
                </button>
            )}
            <button
                type="button"
                onClick={onToday}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white border border-blue-600 hover:bg-blue-700"
            >
                오늘 날짜로 조회
            </button>
        </div>
    </div>
);
