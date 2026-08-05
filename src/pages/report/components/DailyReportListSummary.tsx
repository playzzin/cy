import React from 'react';
import { DailyReportListSummaryMetrics } from '../dailyReportListMetrics';

interface DailyReportListSummaryProps {
    metrics: DailyReportListSummaryMetrics;
    formatNumber: (value: number) => string;
}

const DailyReportListSummary: React.FC<DailyReportListSummaryProps> = ({ metrics, formatNumber }) => {
    const items = [
        { label: '결과', value: `${formatNumber(metrics.rowCount)}건` },
        { label: '작업자', value: `${formatNumber(metrics.workerCount)}명` },
        { label: '현장', value: `${formatNumber(metrics.siteCount)}개` },
        { label: '작업일', value: `${formatNumber(metrics.dateCount)}일` },
        { label: '총 공수', value: metrics.totalManDay.toFixed(1), tone: 'blue' },
        { label: '총 금액', value: `${formatNumber(Math.round(metrics.totalAmount))}원`, tone: 'navy' },
    ];

    return (
        <section
            className="daily-report-v2-summary"
            aria-label={`조회 결과 ${metrics.rowCount}건, 작업자 ${metrics.workerCount}명, 현장 ${metrics.siteCount}개, 총 공수 ${metrics.totalManDay.toFixed(1)}, 총 금액 ${formatNumber(Math.round(metrics.totalAmount))}원`}
        >
            <div className="daily-report-v2-summary-scroll">
                {items.map((item) => (
                    <div
                        key={item.label}
                        className={`daily-report-v2-summary-card ${item.tone ? `daily-report-v2-summary-card--${item.tone}` : ''}`}
                    >
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default React.memo(DailyReportListSummary);
