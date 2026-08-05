import React, { useEffect, useMemo, useState } from 'react';

export interface DailyReportMobileRow {
    key: string;
    date: string;
    siteName: string;
    siteType: string;
    paymentType: string;
    responsibleTeamName: string;
    workerName: string;
    workerTeamName: string;
    salaryModel: string;
    manDay: number;
    unitPrice: number;
    amount: number;
    workContent: string;
    isEmptyReport: boolean;
    isTargetReport: boolean;
}

interface DailyReportMobileListProps {
    rows: DailyReportMobileRow[];
    sortMode: 'date' | 'name' | 'site';
    formatNumber: (value: number) => string;
}

interface MobileRowGroup {
    key: string;
    date: string;
    siteName: string;
    rows: DailyReportMobileRow[];
    totalManDay: number;
}

const MOBILE_INITIAL_ROW_COUNT = 40;
const MOBILE_ROW_INCREMENT = 40;

const formatGroupDate = (value: string): string => {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return value;

    const date = new Date(year, month - 1, day);
    const weekday = new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(date);
    return `${month}월 ${day}일 ${weekday}`;
};

const buildGroups = (rows: DailyReportMobileRow[]): MobileRowGroup[] => {
    const groups: MobileRowGroup[] = [];

    rows.forEach((row) => {
        const key = `${row.date}::${row.siteName}`;
        const previous = groups[groups.length - 1];

        if (!previous || previous.key !== key) {
            groups.push({
                key,
                date: row.date,
                siteName: row.siteName || '미지정 현장',
                rows: [row],
                totalManDay: Number.isFinite(row.manDay) ? row.manDay : 0,
            });
            return;
        }

        previous.rows.push(row);
        previous.totalManDay += Number.isFinite(row.manDay) ? row.manDay : 0;
    });

    return groups;
};

const DailyReportMobileList: React.FC<DailyReportMobileListProps> = ({ rows, sortMode, formatNumber }) => {
    const [visibleCount, setVisibleCount] = useState(MOBILE_INITIAL_ROW_COUNT);
    const visibleRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);
    const groups = useMemo(() => buildGroups(visibleRows), [visibleRows]);
    const isGrouped = sortMode !== 'name';
    const hasMore = visibleRows.length < rows.length;

    useEffect(() => {
        setVisibleCount(MOBILE_INITIAL_ROW_COUNT);
    }, [rows, sortMode]);

    const loadMoreButton = hasMore ? (
        <button
            type="button"
            onClick={() => setVisibleCount((current) => Math.min(rows.length, current + MOBILE_ROW_INCREMENT))}
            className="daily-report-v2-mobile-load-more"
        >
            더 보기 ({formatNumber(visibleRows.length)} / {formatNumber(rows.length)})
        </button>
    ) : null;

    if (!isGrouped) {
        return (
            <div className="daily-report-v2-mobile-list" role="region" aria-label="이름순 일보 목록">
                <div role="list">
                {visibleRows.map((row) => (
                    <MobileReportCard key={row.key} row={row} formatNumber={formatNumber} showContext />
                ))}
                </div>
                {loadMoreButton}
            </div>
        );
    }

    return (
        <div className="daily-report-v2-mobile-list" role="region" aria-label="날짜와 현장별 일보 목록">
            {groups.map((group, groupIndex) => {
                const headingId = `daily-report-mobile-group-${groupIndex}`;
                return (
                <section key={group.key} className="daily-report-v2-mobile-group" aria-labelledby={headingId}>
                    <header className="daily-report-v2-mobile-group-header">
                        <div>
                            <time dateTime={group.date}>{formatGroupDate(group.date)}</time>
                            <h2 id={headingId}>{group.siteName}</h2>
                        </div>
                        <div className="daily-report-v2-mobile-group-total">
                            <span>{group.rows.length}건</span>
                            <strong>{group.totalManDay.toFixed(1)} 공수</strong>
                        </div>
                    </header>
                    <div role="list">
                        {group.rows.map((row) => (
                            <MobileReportCard key={row.key} row={row} formatNumber={formatNumber} />
                        ))}
                    </div>
                </section>
                );
            })}
            {loadMoreButton}
        </div>
    );
};

interface MobileReportCardProps {
    row: DailyReportMobileRow;
    formatNumber: (value: number) => string;
    showContext?: boolean;
}

const MobileReportCard: React.FC<MobileReportCardProps> = ({ row, formatNumber, showContext = false }) => (
    <article className={`daily-report-v2-mobile-card ${row.isTargetReport ? 'is-target-report' : ''}`} role="listitem">
        {showContext && (
            <div className="daily-report-v2-mobile-card-context">
                <span>{formatGroupDate(row.date)}</span>
                <span>{row.siteName || '미지정 현장'}</span>
            </div>
        )}
        <div className="daily-report-v2-mobile-card-main">
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <strong className="truncate text-[15px] text-slate-900">
                        {row.isEmptyReport ? '작업자 없음' : row.workerName}
                    </strong>
                    {row.salaryModel && <span className="daily-report-v2-mobile-badge">{row.salaryModel}</span>}
                    {row.isTargetReport && <span className="daily-report-v2-mobile-target-badge">선택된 일보</span>}
                </div>
                <p>{row.workerTeamName || '소속팀 미지정'}</p>
            </div>
            <div className="daily-report-v2-mobile-card-amount">
                <strong>{row.isEmptyReport ? '-' : row.manDay.toFixed(1)}</strong>
                <span>공수</span>
                <b>{row.isEmptyReport ? '-' : `${formatNumber(Math.round(row.amount))}원`}</b>
            </div>
        </div>
        <div className="daily-report-v2-mobile-card-tags">
            {row.siteType && <span>{row.siteType}</span>}
            {row.paymentType && <span>{row.paymentType}</span>}
            {row.responsibleTeamName && <span>현장 {row.responsibleTeamName}</span>}
        </div>
        <details className="daily-report-v2-mobile-card-details">
            <summary>상세 보기</summary>
            <dl>
                <div><dt>단가</dt><dd>{row.isEmptyReport ? '-' : `${formatNumber(Math.round(row.unitPrice))}원`}</dd></div>
                <div><dt>급여방식</dt><dd>{row.salaryModel || '-'}</dd></div>
                <div><dt>작업내용</dt><dd>{row.workContent || '-'}</dd></div>
            </dl>
        </details>
    </article>
);

export default React.memo(DailyReportMobileList);
