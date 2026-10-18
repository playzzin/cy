import React, { useMemo } from 'react';
import type { DailyReportWorkerRow } from '../../services/dailyReportService';

const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const format = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 4 });

export default function SiteWorkforceSummary({ rows, month, loading, error }: {
    rows: DailyReportWorkerRow[]; month: string; loading: boolean; error: string;
}) {
    const groups = useMemo(() => {
        const teams = new Map<string, { key: string; name: string; support: boolean; manDay: number;
            workers: Map<string, { key: string; name: string; manDay: number; dates: Set<string> }> }>();
        rows.filter(row => !row.isEmptyReport).forEach(row => {
            const key = row.workerTeamId ? `id:${row.workerTeamId}` : `name:${row.workerTeamName || '소속 미확인'}`;
            const team = teams.get(key) ?? { key, name: row.workerTeamName || '소속 미확인',
                support: row.isSiteSupport === true, manDay: 0, workers: new Map() };
            const workerKey = row.workerId ? `id:${row.workerId}` : `name:${row.workerName}`;
            const worker = team.workers.get(workerKey) ?? { key: workerKey, name: row.workerName || '작업자 미지정', manDay: 0, dates: new Set<string>() };
            worker.manDay += number(row.manDay);
            worker.dates.add(row.date);
            team.manDay += number(row.manDay);
            team.support ||= row.isSiteSupport === true;
            team.workers.set(workerKey, worker);
            teams.set(key, team);
        });
        return [...teams.values()].sort((a, b) => Number(a.support) - Number(b.support) || a.name.localeCompare(b.name, 'ko-KR'));
    }, [rows]);
    const support = groups.filter(team => team.support);
    return <section className="sr-workforce" aria-label="현장 팀·작업자별 공수" aria-busy={loading}>
        <header className="sr-workforce__header">
            <div><h3>팀·작업자별 공수</h3><p>{month} · 지원 인원을 포함한 현장 근무내역</p></div>
            {!loading && !error && <span>지원 {support.length}팀 · <strong>{format(support.reduce((sum, team) => sum + team.manDay, 0))}공수</strong></span>}
        </header>
        {loading ? <p role="status">현장 공수를 불러오는 중입니다.</p> : error ? <p role="alert">{error}</p>
            : groups.length === 0 ? <p>선택한 월의 근무내역이 없습니다.</p> : <div className="sr-workforce__teams">
                {groups.map(team => <details className="sr-workforce__team" key={team.key} open>
                    <summary><span className={team.support ? 'sr-workforce__badge sr-workforce__badge--support' : 'sr-workforce__badge'}>{team.support ? '지원팀' : '내 팀'}</span>
                        <strong>{team.name}</strong><small>{team.workers.size}명</small><b>{format(team.manDay)}공수</b></summary>
                    <ul aria-label={`${team.name} 작업자 공수`}>
                        {[...team.workers.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')).map(worker => <li key={worker.key}>
                            <span>{worker.name}</span><small>{worker.dates.size}일</small><strong>{format(worker.manDay)}공수</strong>
                        </li>)}
                    </ul>
                </details>)}
            </div>}
    </section>;
}
