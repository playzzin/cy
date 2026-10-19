import React, { useEffect, useId, useMemo, useState } from 'react';
import type { DailyReportWorkerRow } from '../../services/dailyReportService';
import ResponsiveDetailDialog from '../common/ResponsiveDetailDialog';
import { resolveReportPayType } from '../../utils/payType';
import { groupWorkTeams, recordedWorkTeam, workTeamStyle, WorkHistoryTeam } from './workHistoryTeams';
import './WorkerWorkHistory.css';

type Props = { rows: DailyReportWorkerRow[]; month: string; loading: boolean; error: string; teams?: WorkHistoryTeam[] }
    & ({ workerName: string; siteName?: never } | { siteName: string; workerName?: never });
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
export const workHistoryAmount = (row: DailyReportWorkerRow) => {
    if (row.isSiteSupport) return 0;
    const calculated = number(row.manDay) * number(row.unitPrice);
    return calculated > 0 ? calculated : number(row.amount);
};
const money = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`;
const days = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
const workerCount = (rows: DailyReportWorkerRow[]) => new Set(rows.map(row => row.workerId || row.workerName || row.name)).size;
const EMPTY_TEAMS: WorkHistoryTeam[] = [];

export default function WorkerWorkHistory({ rows, month, workerName, siteName, loading, error, teams = EMPTY_TEAMS }: Props) {
    const isSite = siteName !== undefined;
    const subjectName = siteName ?? workerName;
    const title = isSite ? '출력일보' : '근무내역';
    const [mode, setMode] = useState<'calendar' | 'list'>('calendar');
    const [selectedDate, setSelectedDate] = useState('');
    const id = useId();
    useEffect(() => { setSelectedDate(''); }, [month, subjectName, loading, error]);
    const grouped = useMemo(() => {
        const result = new Map<string, DailyReportWorkerRow[]>();
        rows.filter(row => !row.isEmptyReport && row.date?.startsWith(`${month}-`)).forEach(row => result.set(row.date, [...(result.get(row.date) || []), row]));
        return result;
    }, [rows, month]);
    const visibleRows = Array.from(grouped.values()).flat();
    const totalDays = visibleRows.reduce((sum, row) => sum + number(row.manDay), 0);
    const totalAmount = visibleRows.reduce((sum, row) => sum + workHistoryAmount(row), 0);
    const hasRedactedWages = visibleRows.some(row => row.isSiteSupport);
    const supportDays = visibleRows.filter(row => recordedWorkTeam(row, teams).support).reduce((sum, row) => sum + number(row.manDay), 0);
    const hasOwnRows = visibleRows.some(row => !row.isSiteSupport);
    const monthTeams = groupWorkTeams(visibleRows, teams);
    const [year, monthNumber] = month.split('-').map(Number);
    const offset = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
    const dayCount = new Date(year, monthNumber, 0).getDate();
    const cellCount = Math.ceil((offset + dayCount) / 7) * 7;
    const selectedRows = grouped.get(selectedDate) || [];
    const today = new Date();
    const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return <section className="worker-history" aria-label={isSite ? '현장 출력일보' : '작업자 근무내역'}>
        <header className="worker-history__header"><h3>{title}</h3>
            {!loading && !error && <p>{grouped.size}일 · <strong>{days(totalDays)}공수</strong>
                {mode === 'list' && supportDays > 0 && <span className="worker-history__support-total"> · 지원 {days(supportDays)}공수 포함</span>}
                {hasOwnRows && <> · {hasRedactedWages ? '조회 가능 노무비 ' : ''}{money(totalAmount)}</>}</p>}
        </header>
        <div role="tablist" aria-label={`${title} 보기 방식`} className="worker-history__tabs">
            {(['calendar', 'list'] as const).map(value => <button key={value} type="button" role="tab" id={`${id}-${value}`}
                aria-selected={mode === value} aria-controls={`${id}-panel`} onClick={() => setMode(value)}>{value === 'calendar' ? '달력보기' : '목록보기'}</button>)}
        </div>
        <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${mode}`}>
            {loading ? <p role="status">{title}{isSite ? '를' : '을'} 불러오는 중입니다.</p> : error ? <p role="alert">{error}</p> : mode === 'calendar' ? <>
                <div className="worker-history__calendar-heading"><div><h4>{year}년 {monthNumber}월</h4>
                    <p className="worker-history__hint">{isSite ? '팀별 공수를 한눈에 확인하고 날짜를 눌러 작업자 내역을 보세요.' : '날짜를 누르면 현장과 금액을 자세히 볼 수 있습니다.'}</p></div>
                    <span className="worker-history__month-total">월 합계 <strong>{days(totalDays)}</strong> 공수</span></div>
                {isSite && monthTeams.length > 0 && <ul className="worker-history__legend" aria-label="팀별 색상과 월 공수">
                    {monthTeams.map(team => <li key={team.key} style={workTeamStyle(team.color) as React.CSSProperties}>
                        <i aria-hidden="true" /><span>{team.name}</span><strong>{days(team.manDay)}공수</strong>
                    </li>)}
                </ul>}
                <div className="worker-history__calendar" aria-label={`${subjectName}의 ${month} 출력일보 달력`}>
                    {['월', '화', '수', '목', '금', '토', '일'].map((day, index) => <span className={`worker-history__weekday${index === 5 ? ' worker-history__saturday' : index === 6 ? ' worker-history__sunday' : ''}`} key={day}>{day}</span>)}
                    {Array.from({ length: cellCount }, (_, index) => {
                        const day = index - offset + 1;
                        if (day < 1 || day > dayCount) return <span key={index} className="worker-history__blank" />;
                        const date = `${month}-${String(day).padStart(2, '0')}`;
                        const entries = grouped.get(date) || [];
                        const sum = entries.reduce((value, row) => value + number(row.manDay), 0);
                        const sites = Array.from(new Set(entries.map(row => row.siteName || '현장 미지정')));
                        const dayClass = ['worker-history__day', entries.length ? 'worker-history__day--worked' : '',
                            date === todayDate ? 'worker-history__day--today' : '', index % 7 === 5 ? 'worker-history__saturday' : index % 7 === 6 ? 'worker-history__sunday' : ''].filter(Boolean).join(' ');
                        return <button type="button" key={index} className={dayClass} aria-current={date === todayDate ? 'date' : undefined}
                            aria-label={`${date} 근무내역${entries.length ? ` ${days(sum)}공수` : ' 없음'}`} onClick={() => setSelectedDate(date)}>
                            <span className="worker-history__day-number">{day}{date === todayDate && <span className="worker-history__today-label">오늘</span>}</span>
                            {entries.length > 0 && <><span className="worker-history__day-total"><strong>{days(sum)}</strong><small>공수</small></span>
                                <small className="worker-history__day-count">{isSite ? `${workerCount(entries)}명` : sites.length > 1 ? `${sites.length}개 현장` : sites[0]}</small>
                                {isSite && <span className="worker-history__day-teams">{groupWorkTeams(entries, teams).map(team => <span key={team.key}
                                    className="worker-history__day-team" style={workTeamStyle(team.color) as React.CSSProperties}
                                    title={`${team.name} ${days(team.manDay)}공수`}>
                                    <span>{team.name}</span><b>{days(team.manDay)}</b>
                                </span>)}</span>}</>}
                            {entries.length === 0 && <span className="worker-history__no-work" aria-hidden="true">—</span>}
                        </button>;
                    })}
                </div>
            </> : grouped.size === 0 ? <p>선택한 기간의 근무내역이 없습니다.</p> : <div className="worker-history__list">
                {Array.from(grouped.entries()).sort(([a], [b]) => b.localeCompare(a)).map(([date, entries]) => <article key={date} className="worker-history__date" aria-label={`${date} 출력 내역`}>
                    <button type="button" className="worker-history__row" onClick={() => setSelectedDate(date)} aria-label={`${date} 근무 상세`}>
                        <span><strong>{date.slice(5)}</strong><small>{isSite ? `작업자 ${workerCount(entries)}명 · ${entries.length}건` : Array.from(new Set(entries.map(row => row.siteName || '현장 미지정'))).join(' · ')}</small></span>
                        <span>{days(entries.reduce((sum, row) => sum + number(row.manDay), 0))}공수
                            {entries.some(row => !row.isSiteSupport) && <strong>{hasRedactedWages ? '조회 가능 노무비 ' : ''}{money(entries.reduce((sum, row) => sum + workHistoryAmount(row), 0))}</strong>}</span>
                    </button>
                    {isSite && <ul className="worker-history__teams" aria-label={`${date} 팀별 공수`}>{groupWorkTeams(entries, teams).map(team => <li key={team.key} style={workTeamStyle(team.color) as React.CSSProperties}>
                        <div className="worker-history__team-heading"><span className={team.support ? 'worker-history__badge worker-history__badge--support' : 'worker-history__badge'}>{team.support ? '지원팀' : '내 팀'}</span>
                            <strong>{team.name}</strong><b>{days(team.manDay)}공수</b></div>
                        <ul aria-label={`${team.name} 작업자 공수`}>{[...team.workers.values()].map(worker => <li key={worker.key}><span>{worker.name}</span><strong>{days(worker.manDay)}공수</strong></li>)}</ul>
                    </li>)}</ul>}
                </article>)}
            </div>}
        </div>
        <ResponsiveDetailDialog open={!!selectedDate && !loading && !error} onOpenChange={open => { if (!open) setSelectedDate(''); }}
            title={`${selectedDate} ${title}`} description={`${subjectName} · ${selectedRows.length}건`}>
            {selectedRows.length === 0 ? <p>해당 날짜의 근무내역이 없습니다.</p> : selectedRows.map((row, index) => <article className="worker-history__detail" key={`${row.reportId}-${index}`}>
                {isSite && mode === 'list' && recordedWorkTeam(row, teams).support && <span className="worker-history__badge worker-history__badge--support">지원팀</span>}
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
