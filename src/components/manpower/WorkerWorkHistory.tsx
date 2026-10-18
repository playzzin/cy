import React, { useEffect, useId, useMemo, useState } from 'react';
import type { DailyReportWorkerRow } from '../../services/dailyReportService';
import ResponsiveDetailDialog from '../common/ResponsiveDetailDialog';
import { resolveReportPayType } from '../../utils/payType';
import './WorkerWorkHistory.css';

type Props = { rows: DailyReportWorkerRow[]; month: string; loading: boolean; error: string }
    & ({ workerName: string; siteName?: never } | { siteName: string; workerName?: never });
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
export const workHistoryAmount = (row: DailyReportWorkerRow) => {
    const calculated = number(row.manDay) * number(row.unitPrice);
    return calculated > 0 ? calculated : number(row.amount);
};
const money = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`;
const days = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
const workerCount = (rows: DailyReportWorkerRow[]) => new Set(rows.map(row => row.workerId || row.workerName || row.name)).size;

export default function WorkerWorkHistory({ rows, month, workerName, siteName, loading, error }: Props) {
    const isSite = siteName !== undefined;
    const subjectName = siteName ?? workerName;
    const title = isSite ? '출력일보' : '근무내역';
    const [mode, setMode] = useState<'calendar' | 'list'>('calendar');
    const [selectedDate, setSelectedDate] = useState('');
    const id = useId();
    useEffect(() => { setSelectedDate(''); }, [month, subjectName, loading, error]);
    const grouped = useMemo(() => {
        const result = new Map<string, DailyReportWorkerRow[]>();
        rows.filter(row => row.date?.startsWith(`${month}-`)).forEach(row => result.set(row.date, [...(result.get(row.date) || []), row]));
        return result;
    }, [rows, month]);
    const visibleRows = Array.from(grouped.values()).flat();
    const totalDays = visibleRows.reduce((sum, row) => sum + number(row.manDay), 0);
    const totalAmount = visibleRows.reduce((sum, row) => sum + workHistoryAmount(row), 0);
    const hasSupport = visibleRows.some(row => row.isSiteSupport);
    const [year, monthNumber] = month.split('-').map(Number);
    const offset = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
    const dayCount = new Date(year, monthNumber, 0).getDate();
    const cellCount = Math.ceil((offset + dayCount) / 7) * 7;
    const selectedRows = grouped.get(selectedDate) || [];
    return <section className="worker-history" aria-label={isSite ? '현장 출력일보' : '작업자 근무내역'}>
        <header className="worker-history__header"><h3>{title}</h3>
            {!loading && !error && <p>{grouped.size}일 · <strong>{days(totalDays)}공수</strong> · {hasSupport ? '내 팀 ' : ''}{money(totalAmount)}</p>}
        </header>
        <div role="tablist" aria-label={`${title} 보기 방식`} className="worker-history__tabs">
            {(['calendar', 'list'] as const).map(value => <button key={value} type="button" role="tab" id={`${id}-${value}`}
                aria-selected={mode === value} aria-controls={`${id}-panel`} onClick={() => setMode(value)}>{value === 'calendar' ? '달력보기' : '목록보기'}</button>)}
        </div>
        <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${mode}`}>
            {loading ? <p role="status">{title}{isSite ? '를' : '을'} 불러오는 중입니다.</p> : error ? <p role="alert">{error}</p> : mode === 'calendar' ? <>
                <p className="worker-history__hint">{isSite ? '날짜를 누르면 작업자별 공수를 자세히 볼 수 있습니다.' : '날짜를 누르면 현장과 금액을 자세히 볼 수 있습니다.'}</p>
                <div className="worker-history__calendar" aria-label={`${subjectName}의 ${month} 출력일보 달력`}>
                    {['월', '화', '수', '목', '금', '토', '일'].map(day => <span className="worker-history__weekday" key={day}>{day}</span>)}
                    {Array.from({ length: cellCount }, (_, index) => {
                        const day = index - offset + 1;
                        if (day < 1 || day > dayCount) return <span key={index} className="worker-history__blank" />;
                        const date = `${month}-${String(day).padStart(2, '0')}`;
                        const entries = grouped.get(date) || [];
                        const sum = entries.reduce((value, row) => value + number(row.manDay), 0);
                        const sites = Array.from(new Set(entries.map(row => row.siteName || '현장 미지정')));
                        return <button type="button" key={index} className={entries.length ? 'worker-history__day worker-history__day--worked' : 'worker-history__day'}
                            aria-label={`${date} 근무내역${entries.length ? ` ${days(sum)}공수` : ' 없음'}`} onClick={() => setSelectedDate(date)}>
                            <span>{day}</span>{entries.length > 0 && <><strong>{days(sum)}</strong><small>{isSite ? `${workerCount(entries)}명` : sites.length > 1 ? `${sites.length}개 현장` : sites[0]}</small></>}
                        </button>;
                    })}
                </div>
            </> : grouped.size === 0 ? <p>선택한 기간의 근무내역이 없습니다.</p> : <div className="worker-history__list">
                {Array.from(grouped.entries()).sort(([a], [b]) => b.localeCompare(a)).map(([date, entries]) => <button type="button" key={date}
                    className="worker-history__row" onClick={() => setSelectedDate(date)} aria-label={`${date} 근무 상세`}>
                    <span><strong>{date.slice(5)}</strong><small>{isSite ? `작업자 ${workerCount(entries)}명 · ${entries.length}건` : Array.from(new Set(entries.map(row => row.siteName || '현장 미지정'))).join(' · ')}</small></span>
                    <span>{days(entries.reduce((sum, row) => sum + number(row.manDay), 0))}공수<strong>{hasSupport ? '내 팀 ' : ''}{money(entries.reduce((sum, row) => sum + workHistoryAmount(row), 0))}</strong></span>
                </button>)}
            </div>}
        </div>
        <ResponsiveDetailDialog open={!!selectedDate && !loading && !error} onOpenChange={open => { if (!open) setSelectedDate(''); }}
            title={`${selectedDate} ${title}`} description={`${subjectName} · ${selectedRows.length}건`}>
            {selectedRows.length === 0 ? <p>해당 날짜의 근무내역이 없습니다.</p> : selectedRows.map((row, index) => <article className="worker-history__detail" key={`${row.reportId}-${index}`}>
                <h4>{isSite ? row.workerName || row.name || '작업자 미지정' : row.siteName || '현장 미지정'}</h4><dl>
                    <div><dt>공수</dt><dd>{days(number(row.manDay))}공수</dd></div>
                    {!row.isSiteSupport && <><div><dt>단가</dt><dd>{money(number(row.unitPrice))}</dd></div>
                    <div><dt>금액</dt><dd>{money(workHistoryAmount(row))}</dd></div></>}
                    <div><dt>현장소속팀</dt><dd>{row.responsibleTeamName || row.teamName || '-'}</dd></div>
                    <div><dt>소속팀</dt><dd>{row.workerTeamName || '-'}</dd></div>
                    {isSite && !row.isSiteSupport && <div><dt>급여방식</dt><dd>{resolveReportPayType(row) || '-'}</dd></div>}
                    {row.workContent && <div><dt>작업내용</dt><dd>{row.workContent}</dd></div>}
                </dl>
            </article>)}
        </ResponsiveDetailDialog>
    </section>;
}
