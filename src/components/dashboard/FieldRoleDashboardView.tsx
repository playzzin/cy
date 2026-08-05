import React, { useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
    faArrowRight,
    faCalendarCheck,
    faChartLine,
    faClipboardCheck,
    faClipboardList,
    faClock,
    faHandHoldingDollar,
    faHardHat,
    faLocationDot,
    faSpinner,
    faUserCheck,
    faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { dailyReportService, type DailyReport } from '../../services/dailyReportService';
import type { Worker } from '../../services/manpowerService';
import { useRouteAction } from '../../hooks/useRouteAction';

export type FieldDashboardRole = 'teamLead' | 'foreman' | 'worker';

interface FieldRoleDashboardViewProps {
    role: FieldDashboardRole;
    linkedWorker: Worker | null;
}

interface RoleAction {
    label: string;
    description: string;
    path: string;
    icon: IconDefinition;
    tone: string;
}

interface ScopedReport extends DailyReport {
    scopedManDay: number;
}

const ROLE_COPY: Record<FieldDashboardRole, {
    eyebrow: string;
    title: string;
    description: string;
    gradient: string;
    actions: RoleAction[];
}> = {
    teamLead: {
        eyebrow: 'TEAM LEAD · 팀 운영',
        title: '오늘의 팀 운영을 빠르게 정리하세요',
        description: '팀 출역, 일보, 현장 흐름을 확인하고 필요한 업무로 바로 이어집니다.',
        gradient: 'from-cyan-950 via-cyan-800 to-teal-700',
        actions: [
            { label: '일보 작성', description: '팀 작업 내용과 출역을 기록합니다.', path: '/reports/daily?tab=input', icon: faCalendarCheck, tone: 'bg-cyan-50 text-cyan-700 ring-cyan-100' },
            { label: '팀 요청함', description: '휴무·인원·경비 요청을 확인합니다.', path: '/team/requests', icon: faClipboardCheck, tone: 'bg-indigo-50 text-indigo-700 ring-indigo-100' },
            { label: '현장 현황', description: '담당 현장의 진행 상태를 봅니다.', path: '/dashboard/site-status', icon: faLocationDot, tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
            { label: '팀 정산', description: '팀별 공수와 정산 흐름을 확인합니다.', path: '/payroll/team-settlement', icon: faHandHoldingDollar, tone: 'bg-amber-50 text-amber-700 ring-amber-100' },
        ],
    },
    foreman: {
        eyebrow: 'FOREMAN · 현장 실행',
        title: '당일 현장 실행에 필요한 정보만 모았습니다',
        description: '오늘 출역과 작업 기록을 확인하고, 현장에서 필요한 업무를 바로 처리하세요.',
        gradient: 'from-emerald-950 via-emerald-800 to-lime-700',
        actions: [
            { label: '일보 작성', description: '오늘 작업과 인원을 바로 입력합니다.', path: '/reports/daily?tab=input', icon: faCalendarCheck, tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
            { label: '오늘 출역', description: '오늘 기록된 출역을 확인합니다.', path: '/reports/daily?tab=list-v2', icon: faUserCheck, tone: 'bg-sky-50 text-sky-700 ring-sky-100' },
            { label: '현장 현황', description: '현장별 공수와 진행을 확인합니다.', path: '/dashboard/site-status', icon: faLocationDot, tone: 'bg-teal-50 text-teal-700 ring-teal-100' },
            { label: '업무 요청', description: '요청된 업무를 확인하고 처리합니다.', path: '/todo', icon: faClipboardCheck, tone: 'bg-slate-100 text-slate-700 ring-slate-200' },
        ],
    },
    worker: {
        eyebrow: 'WORKER · 개인 업무',
        title: '오늘 내 출역과 신청 현황을 확인하세요',
        description: '배정된 현장, 출역 기록, 급여와 개인 신청 업무를 한곳에서 관리합니다.',
        gradient: 'from-slate-950 via-slate-800 to-teal-700',
        actions: [
            { label: '내 출역 확인', description: '최근 출역과 일보 기록을 봅니다.', path: '/reports/daily?tab=list-v2', icon: faUserCheck, tone: 'bg-teal-50 text-teal-700 ring-teal-100' },
            { label: '내 일정', description: '배정 현장과 확정 일정을 확인합니다.', path: '/assignment/schedule-confirmation', icon: faCalendarCheck, tone: 'bg-cyan-50 text-cyan-700 ring-cyan-100' },
            { label: '가불 신청', description: '가불 신청과 처리 상태를 확인합니다.', path: '/payroll/advance-request', icon: faHandHoldingDollar, tone: 'bg-amber-50 text-amber-700 ring-amber-100' },
            { label: '휴무 신청', description: '휴무와 개인 일정 요청을 등록합니다.', path: '/assignment/off-duty-request', icon: faClipboardCheck, tone: 'bg-violet-50 text-violet-700 ring-violet-100' },
        ],
    },
};

const normalize = (value: unknown): string => String(value ?? '').trim();

const sameValue = (left: unknown, right: unknown): boolean => {
    const leftText = normalize(left);
    const rightText = normalize(right);
    return Boolean(leftText && rightText && leftText === rightText);
};

const getReportManDay = (report: DailyReport): number => {
    const total = Number(report.totalManDay) || 0;
    return total > 0
        ? total
        : (report.workers || []).reduce((sum, worker) => sum + (Number(worker.manDay) || 0), 0);
};

const getWorkerManDay = (report: DailyReport, workerId: string): number => (
    (report.workers || [])
        .filter((worker) => sameValue(worker.workerId, workerId))
        .reduce((sum, worker) => sum + (Number(worker.manDay) || 0), 0)
);

const isOwnTeamReport = (report: DailyReport, linkedWorker: Worker | null): boolean => {
    const teamId = normalize(linkedWorker?.teamId);
    const teamName = normalize(linkedWorker?.teamName);

    if (sameValue(report.teamId, teamId) || sameValue(report.teamName, teamName)) return true;

    return (report.workers || []).some((worker) => (
        sameValue(worker.teamId, teamId) || sameValue(worker.workerTeamName, teamName)
    ));
};

const isOwnWorkerReport = (report: DailyReport, linkedWorker: Worker | null): boolean => {
    const workerId = normalize(linkedWorker?.id);
    return Boolean(workerId && (report.workers || []).some((worker) => sameValue(worker.workerId, workerId)));
};

const formatManDay = (value: number): string => value.toLocaleString('ko-KR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});

const getWorkContent = (report: DailyReport, linkedWorker: Worker | null, role: FieldDashboardRole): string => {
    if (role === 'worker') {
        const ownWorkerRow = (report.workers || []).find((worker) => sameValue(worker.workerId, linkedWorker?.id));
        if (normalize(ownWorkerRow?.workContent)) return normalize(ownWorkerRow?.workContent);
    }

    return normalize(report.workContent) || '등록된 작업 내용이 없습니다.';
};

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex min-h-44 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm font-medium leading-6 text-slate-400">
        {message}
    </div>
);

const SectionHeading: React.FC<{ title: string; description: string; actionLabel?: string; onAction?: () => void }> = ({
    title,
    description,
    actionLabel,
    onAction,
}) => (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
            <h2 className="text-base font-black text-slate-950">{title}</h2>
            <p className="mt-1 text-xs font-medium leading-5 text-slate-400">{description}</p>
        </div>
        {actionLabel && onAction && (
            <button type="button" onClick={onAction} className="shrink-0 text-sm font-extrabold text-slate-700 transition hover:text-slate-950">
                {actionLabel}<FontAwesomeIcon icon={faArrowRight} className="ml-1.5 text-xs" />
            </button>
        )}
    </div>
);

export const FieldRoleDashboardView: React.FC<FieldRoleDashboardViewProps> = ({ role, linkedWorker }) => {
    const runRouteAction = useRouteAction();
    const [reports, setReports] = useState<DailyReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const config = ROLE_COPY[role];
    const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
    const period = useMemo(() => ({ start: format(subDays(new Date(), 30), 'yyyy-MM-dd'), end: today }), [today]);

    useEffect(() => {
        let active = true;

        const loadReports = async () => {
            setLoading(true);
            setError('');
            try {
                const nextReports = await dailyReportService.getReports({
                    startDate: period.start,
                    endDate: period.end,
                });
                if (active) setReports(nextReports);
            } catch (loadError) {
                console.error('[FieldRoleDashboardView] Failed to load reports:', loadError);
                if (active) setError('출역 기록을 불러오지 못했습니다. 잠시 후 다시 확인해주세요.');
            } finally {
                if (active) setLoading(false);
            }
        };

        void loadReports();
        return () => { active = false; };
    }, [period.end, period.start]);

    const scopedReports = useMemo<ScopedReport[]>(() => reports
        .filter((report) => role === 'worker'
            ? isOwnWorkerReport(report, linkedWorker)
            : isOwnTeamReport(report, linkedWorker))
        .map((report) => ({
            ...report,
            scopedManDay: role === 'worker'
                ? getWorkerManDay(report, normalize(linkedWorker?.id))
                : getReportManDay(report),
        }))
        .filter((report) => report.scopedManDay > 0), [linkedWorker, reports, role]);

    const todayReports = useMemo(() => scopedReports.filter((report) => report.date === today), [scopedReports, today]);
    const todayManDay = useMemo(() => todayReports.reduce((sum, report) => sum + report.scopedManDay, 0), [todayReports]);
    const monthManDay = useMemo(() => scopedReports.reduce((sum, report) => sum + report.scopedManDay, 0), [scopedReports]);
    const uniqueSites = useMemo(() => new Set(scopedReports.map((report) => normalize(report.siteId)).filter(Boolean)), [scopedReports]);
    const uniqueWorkers = useMemo(() => {
        const members = new Set<string>();
        scopedReports.forEach((report) => (report.workers || []).forEach((worker) => {
            if (normalize(worker.workerId)) members.add(normalize(worker.workerId));
        }));
        return members;
    }, [scopedReports]);
    const recentReports = useMemo(() => [...scopedReports]
        .sort((left, right) => right.date.localeCompare(left.date))
        .slice(0, 4), [scopedReports]);
    const siteSummaries = useMemo(() => {
        const sites = new Map<string, { id: string; name: string; manDay: number; reportCount: number }>();
        scopedReports.forEach((report) => {
            const id = normalize(report.siteId) || normalize(report.siteName) || 'unknown-site';
            const current = sites.get(id) || {
                id,
                name: normalize(report.siteName) || '미지정 현장',
                manDay: 0,
                reportCount: 0,
            };
            current.manDay += report.scopedManDay;
            current.reportCount += 1;
            sites.set(id, current);
        });
        return [...sites.values()].sort((left, right) => right.manDay - left.manDay).slice(0, 4);
    }, [scopedReports]);
    const weeklyTrend = useMemo(() => Array.from({ length: 7 }, (_, index) => {
        const date = format(subDays(new Date(), 6 - index), 'yyyy-MM-dd');
        const manDay = scopedReports
            .filter((report) => report.date === date)
            .reduce((sum, report) => sum + report.scopedManDay, 0);
        return { date, label: format(new Date(`${date}T00:00:00`), 'M/d'), manDay };
    }), [scopedReports]);
    const maxWeeklyManDay = Math.max(...weeklyTrend.map((item) => item.manDay), 1);
    const latestReport = recentReports[0];
    const todayStatus = todayReports.length > 0
        ? (role === 'worker' ? '오늘 출역 확인됨' : `오늘 일보 ${todayReports.length}건 확인됨`)
        : (role === 'worker' ? '오늘 출역 확인 필요' : '오늘 일보 작성 필요');
    const profileReady = Boolean(normalize(linkedWorker?.id));
    const identityLabel = normalize(linkedWorker?.name) || (role === 'worker' ? '내 작업자 프로필' : '소속 팀 프로필');
    const teamLabel = normalize(linkedWorker?.teamName) || '소속 팀 미지정';

    const metrics = role === 'teamLead'
        ? [
            { label: '오늘 팀 공수', value: `${formatManDay(todayManDay)} 공수`, description: todayStatus, icon: faUsers, tone: 'bg-cyan-50 text-cyan-700' },
            { label: '이번 달 누적', value: `${formatManDay(monthManDay)} 공수`, description: '최근 30일 팀 작업 기준', icon: faChartLine, tone: 'bg-indigo-50 text-indigo-700' },
            { label: '확인된 팀원', value: `${uniqueWorkers.size}명`, description: '최근 출역 기록 기준', icon: faUserCheck, tone: 'bg-emerald-50 text-emerald-700' },
            { label: '투입 현장', value: `${uniqueSites.size}곳`, description: '최근 30일 출역 현장', icon: faLocationDot, tone: 'bg-amber-50 text-amber-700' },
        ]
        : role === 'foreman'
            ? [
                { label: '오늘 현장 공수', value: `${formatManDay(todayManDay)} 공수`, description: todayStatus, icon: faHardHat, tone: 'bg-emerald-50 text-emerald-700' },
                { label: '이번 달 누적', value: `${formatManDay(monthManDay)} 공수`, description: '최근 30일 작업 기준', icon: faChartLine, tone: 'bg-teal-50 text-teal-700' },
                { label: '작업 현장', value: `${uniqueSites.size}곳`, description: '최근 출역 기록 기준', icon: faLocationDot, tone: 'bg-sky-50 text-sky-700' },
                { label: '최근 일보', value: latestReport ? latestReport.date.replace(/-/g, '.') : '-', description: latestReport ? '마지막 기록 일자' : '작성된 일보 없음', icon: faClipboardList, tone: 'bg-amber-50 text-amber-700' },
            ]
            : [
                { label: '오늘 내 공수', value: `${formatManDay(todayManDay)} 공수`, description: todayStatus, icon: faUserCheck, tone: 'bg-teal-50 text-teal-700' },
                { label: '이번 달 누적', value: `${formatManDay(monthManDay)} 공수`, description: '최근 30일 내 출역 기준', icon: faChartLine, tone: 'bg-cyan-50 text-cyan-700' },
                { label: '출역 현장', value: `${uniqueSites.size}곳`, description: '최근 출역 기록 기준', icon: faLocationDot, tone: 'bg-indigo-50 text-indigo-700' },
                { label: '최근 출역', value: latestReport ? latestReport.date.replace(/-/g, '.') : '-', description: latestReport ? '마지막 확인 일자' : '출역 기록 없음', icon: faClock, tone: 'bg-amber-50 text-amber-700' },
            ];

    if (loading) {
        return (
            <div className="flex min-h-[480px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="text-center text-sm font-bold text-slate-500"><FontAwesomeIcon icon={faSpinner} spin className="mb-3 block text-3xl text-slate-400" />출역 정보를 불러오는 중입니다.</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className={`overflow-hidden rounded-2xl bg-gradient-to-br ${config.gradient} px-5 py-6 text-white shadow-lg sm:px-7 sm:py-7`}>
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white/90"><FontAwesomeIcon icon={role === 'teamLead' ? faUsers : role === 'foreman' ? faHardHat : faUserCheck} />{config.eyebrow}</span>
                        <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">{config.title}</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">{config.description}</p>
                    </div>
                    <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm">
                        <p className="font-extrabold text-white">{identityLabel}</p>
                        <p className="mt-1 text-xs font-medium text-white/65">{teamLabel} · {profileReady ? todayStatus : '프로필 연결 필요'}</p>
                    </div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 sm:grid-cols-4">
                    {metrics.map((metric) => <div key={metric.label}><p className="text-xs font-bold text-white/65">{metric.label}</p><p className="mt-1 text-lg font-black sm:text-xl">{metric.value}</p></div>)}
                </div>
            </section>

            {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">{error}</div>}
            {!profileReady && <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium leading-6 text-sky-800">작업자 프로필을 연결하면 내 팀과 개인 출역 기록을 기준으로 정확한 대시보드를 확인할 수 있습니다.</div>}

            <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                {metrics.map((metric) => (
                    <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-5">
                        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-slate-500 sm:text-sm">{metric.label}</p><p className="mt-1.5 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{metric.value}</p></div><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${metric.tone}`}><FontAwesomeIcon icon={metric.icon} /></span></div>
                        <p className="mt-2 text-[11px] font-medium leading-4 text-slate-400 sm:mt-3 sm:text-xs">{metric.description}</p>
                    </article>
                ))}
            </section>

            {role === 'teamLead' && (
                <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
                    <div className="xl:col-span-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <SectionHeading title="팀 운영 현황" description="최근 출역 기록을 기준으로 현장별 팀 공수를 확인합니다." actionLabel="일보 목록" onAction={() => runRouteAction('/reports/daily?tab=list-v2')} />
                        <div className="divide-y divide-slate-100">
                            {siteSummaries.length > 0 ? siteSummaries.map((site) => <button key={site.id} type="button" onClick={() => runRouteAction('/dashboard/site-status')} className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50 sm:px-6"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700"><FontAwesomeIcon icon={faLocationDot} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-black text-slate-800">{site.name}</span><span className="mt-1 block text-xs font-medium text-slate-400">최근 일보 {site.reportCount}건</span></span><span className="shrink-0 text-sm font-black text-slate-800">{formatManDay(site.manDay)} 공수</span></button>) : <EmptyState message="최근 30일 동안 소속 팀의 출역 기록이 없습니다." />}
                        </div>
                    </div>
                    <aside className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <SectionHeading title="오늘의 확인" description="팀장이 우선 확인할 항목입니다." />
                        <div className="space-y-3 p-5">
                            <div className="rounded-xl bg-cyan-50 p-4"><p className="text-xs font-bold text-cyan-700">일일 보고 상태</p><p className="mt-2 text-sm font-black text-slate-900">{todayStatus}</p></div>
                            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">최근 작업 현장</p><p className="mt-2 truncate text-sm font-black text-slate-900">{latestReport?.siteName || '최근 출역 기록이 없습니다.'}</p><p className="mt-1 truncate text-xs font-medium text-slate-500">{latestReport ? getWorkContent(latestReport, linkedWorker, role) : '일보가 등록되면 작업 내용이 표시됩니다.'}</p></div>
                        </div>
                    </aside>
                </section>
            )}

            {role === 'foreman' && (
                <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
                    <div className="xl:col-span-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <SectionHeading title="오늘 현장 실행" description="현장에서 바로 확인하고 처리해야 할 작업 흐름입니다." actionLabel="일보 작성" onAction={() => runRouteAction('/reports/daily?tab=input')} />
                        <div className="grid gap-3 p-5 sm:grid-cols-3">
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-700">출역 확인</p><p className="mt-2 text-sm font-black text-slate-900">{todayReports.length > 0 ? `${todayReports.length}건 기록됨` : '확인 필요'}</p><p className="mt-2 text-xs font-medium leading-5 text-slate-500">오늘 인원과 공수가 맞는지 확인하세요.</p></div>
                            <div className="rounded-xl border border-teal-100 bg-teal-50 p-4"><p className="text-xs font-bold text-teal-700">작업 기록</p><p className="mt-2 text-sm font-black text-slate-900">{latestReport?.siteName || '현장 미확인'}</p><p className="mt-2 text-xs font-medium leading-5 text-slate-500">작업 내용과 특이사항을 일보에 남기세요.</p></div>
                            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4"><p className="text-xs font-bold text-amber-700">다음 조치</p><p className="mt-2 text-sm font-black text-slate-900">{todayReports.length > 0 ? '일보 검토' : '일보 작성'}</p><p className="mt-2 text-xs font-medium leading-5 text-slate-500">누락된 기록 없이 오늘 작업을 마감하세요.</p></div>
                        </div>
                    </div>
                    <aside className="xl:col-span-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <SectionHeading title="최근 작업 기록" description="가장 최근의 현장 작업 내용입니다." />
                        {latestReport ? <div className="p-5"><span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{latestReport.date.replace(/-/g, '.')}</span><p className="mt-3 text-base font-black text-slate-900">{latestReport.siteName || '미지정 현장'}</p><p className="mt-2 text-sm leading-6 text-slate-500">{getWorkContent(latestReport, linkedWorker, role)}</p><button type="button" onClick={() => runRouteAction('/reports/daily?tab=list-v2')} className="mt-5 text-sm font-extrabold text-emerald-700">출역 기록 보기<FontAwesomeIcon icon={faArrowRight} className="ml-1.5 text-xs" /></button></div> : <EmptyState message="최근 작업 기록이 없습니다." />}
                    </aside>
                </section>
            )}

            {role === 'worker' && (
                <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
                    <div className="xl:col-span-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <SectionHeading title="내 출역 기록" description="최근 7일간 개인 출역 공수입니다." actionLabel="전체 출역 보기" onAction={() => runRouteAction('/reports/daily?tab=list-v2')} />
                        <div className="grid grid-cols-7 gap-2 px-5 pb-6 pt-5 sm:gap-3 sm:px-6">
                            {weeklyTrend.map((item) => <div key={item.date} className="min-w-0 text-center"><div className="flex h-28 items-end rounded-xl bg-slate-50 p-1.5 sm:h-36"><div className={`w-full rounded-lg bg-gradient-to-t ${item.manDay > 0 ? 'from-teal-600 to-cyan-400' : 'from-slate-200 to-slate-100'}`} style={{ height: `${Math.max((item.manDay / maxWeeklyManDay) * 100, item.manDay > 0 ? 12 : 5)}%` }} /></div><p className="mt-2 text-[11px] font-bold text-slate-500">{item.label}</p><p className="mt-1 truncate text-xs font-black text-slate-800">{formatManDay(item.manDay)}</p></div>)}
                        </div>
                    </div>
                    <aside className="xl:col-span-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <SectionHeading title="오늘 내 업무" description="오늘의 배정 및 출역 상태를 확인하세요." />
                        <div className="p-5"><div className="rounded-xl bg-teal-50 p-4"><p className="text-xs font-bold text-teal-700">출역 상태</p><p className="mt-2 text-base font-black text-slate-900">{todayStatus}</p><p className="mt-2 text-xs font-medium leading-5 text-slate-500">{todayReports[0]?.siteName || '오늘 확인된 현장 기록이 없습니다.'}</p></div><button type="button" onClick={() => runRouteAction('/worker/home')} className="mt-4 inline-flex items-center text-sm font-extrabold text-teal-700">내 업무 홈 열기<FontAwesomeIcon icon={faArrowRight} className="ml-1.5 text-xs" /></button></div>
                    </aside>
                </section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <SectionHeading title="빠른 실행" description="현재 역할에서 자주 사용하는 업무로 이동합니다." />
                <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
                    {config.actions.map((action) => <button key={action.path} type="button" onClick={() => runRouteAction(action.path)} className="group rounded-xl border border-slate-200 p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${action.tone}`}><FontAwesomeIcon icon={action.icon} /></span><p className="mt-4 text-sm font-black text-slate-900">{action.label}<FontAwesomeIcon icon={faArrowRight} className="ml-1.5 text-xs text-slate-300 transition group-hover:text-slate-700" /></p><p className="mt-1 text-xs font-medium leading-5 text-slate-400">{action.description}</p></button>)}
                </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <SectionHeading title={role === 'worker' ? '최근 내 작업' : '최근 일보'} description="최근 기록된 작업과 공수를 확인합니다." actionLabel="일보 목록" onAction={() => runRouteAction('/reports/daily?tab=list-v2')} />
                <div className="divide-y divide-slate-100">
                    {recentReports.length > 0 ? recentReports.map((report) => <button key={`${report.id || report.date}-${report.siteId}`} type="button" onClick={() => runRouteAction('/reports/daily?tab=list-v2')} className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-slate-50 sm:px-6"><span className="w-20 shrink-0 text-xs font-bold text-slate-400">{report.date.replace(/-/g, '.')}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-800">{report.siteName || '미지정 현장'}</span><span className="mt-0.5 block truncate text-xs font-medium text-slate-400">{getWorkContent(report, linkedWorker, role)}</span></span><span className="shrink-0 text-sm font-black text-slate-700">{formatManDay(report.scopedManDay)} 공수</span></button>) : <EmptyState message={profileReady ? '최근 30일 동안 확인할 출역 기록이 없습니다.' : '프로필 연결 후 개인 출역 기록을 확인할 수 있습니다.'} />}
                </div>
            </section>
        </div>
    );
};
