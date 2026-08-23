import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRight,
    faBuilding,
    faCalendarDay,
    faChartLine,
    faCircleCheck,
    faClock,
    faFileInvoiceDollar,
    faHelmetSafety,
    faRotateRight,
    faTriangleExclamation,
    faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import type { Company } from '../../services/companyService';
import type { DailyReport } from '../../services/dailyReportService';
import type { Site } from '../../services/siteService';
import type { ProgressClaim } from '../../types/progressClaim';
import { isDevAdminSessionEnabled } from '../../utils/devAdminSession';
import { roundMoney, toProgressNumber } from '../../utils/progressClaimCalculations';

type DashboardData = {
    companies: Company[];
    sites: Site[];
    reports: DailyReport[];
    claims: ProgressClaim[];
};

const EMPTY_DATA: DashboardData = { companies: [], sites: [], reports: [], claims: [] };

const uniqueTexts = (values: unknown[]): string[] =>
    Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));

const chunk = <T,>(items: T[], size: number): T[][] => {
    const result: T[][] = [];
    for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
    return result;
};

const parseLinkedCompanyIds = (value: unknown): string[] => {
    if (Array.isArray(value)) return uniqueTexts(value);
    const text = String(value ?? '').trim();
    if (!text) return [];
    try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? uniqueTexts(parsed) : [text];
    } catch {
        return [text];
    }
};

const dateText = (value: unknown): string => String(value ?? '').slice(0, 10);
const getCurrentYearMonth = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
const getToday = (): string => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
const formatWon = (value: number): string => `${Math.round(value).toLocaleString('ko-KR')}원`;
const formatCompactWon = (value: number): string => {
    if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`;
    if (value >= 10_000) return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만`;
    return formatWon(value);
};

const getClaimAmount = (claim: ProgressClaim): number => {
    const snapshot = claim.confirmedSnapshot;
    return roundMoney(
        snapshot?.billingAmount
        ?? snapshot?.currentAmount
        ?? claim.progressLines.reduce((sum, line) => sum + toProgressNumber(line.currentQuantity) * toProgressNumber(line.unitPrice), 0)
    );
};

const getCumulativeProgress = (claim?: ProgressClaim): number => {
    const snapshot = claim?.confirmedSnapshot;
    if (!snapshot?.contractAmount) return 0;
    return Math.max(0, Math.min(100, Math.round((snapshot.cumulativeAmount / snapshot.contractAmount) * 100)));
};

const getSiteStatusLabel = (status?: string | null): string => {
    if (status === 'completed') return '완료';
    if (status === 'planned') return '예정';
    return '진행 중';
};

const getClaimStatusLabel = (status?: string): string => ({
    draft: '작성 중', review: '검토 중', confirmed: '확정', billed: '청구 완료', paid: '입금 완료',
}[String(status || '')] || '확인 필요');

const getLatestClaimBySite = (claims: ProgressClaim[]): Map<string, ProgressClaim> => {
    const result = new Map<string, ProgressClaim>();
    claims.forEach((claim) => {
        const current = result.get(claim.siteId);
        if (!current || String(claim.yearMonth).localeCompare(String(current.yearMonth)) > 0) result.set(claim.siteId, claim);
    });
    return result;
};

const fetchByField = async <T extends object>(
    collectionName: string,
    field: string,
    values: string[]
): Promise<T[]> => {
    if (values.length === 0) return [];
    const snapshots = await Promise.all(
        chunk(values, 10).map((valueChunk) => getDocs(query(collection(db, collectionName), where(field, 'in', valueChunk))))
    );
    const seen = new Set<string>();
    return snapshots.flatMap((snapshot) => snapshot.docs)
        .filter((item) => !seen.has(item.id) && Boolean(seen.add(item.id)))
        .map((item) => ({ id: item.id, ...item.data() } as unknown as T));
};

const loadClientDashboardData = async (uid: string): Promise<DashboardData> => {
    const profile = await userService.getUser(uid);
    const linkedCompanyIds = parseLinkedCompanyIds(profile?.linkedCompanyIds);
    let companies: Company[] = [];

    if (linkedCompanyIds.length > 0) {
        const linkedSnapshots = await Promise.all(linkedCompanyIds.map((companyId) => getDoc(doc(db, 'companies', companyId))));
        companies = linkedSnapshots.filter((snapshot) => snapshot.exists())
            .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() } as Company));
    } else if (isDevAdminSessionEnabled()) {
        const snapshot = await getDocs(collection(db, 'companies'));
        companies = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Company))
            .filter((company) => company.type === '건설사');
    }

    const clientCompanyIds = uniqueTexts(companies.map((company) => company.id));
    const sites = await fetchByField<Site>('sites', 'clientCompanyId', clientCompanyIds);
    const siteIds = uniqueTexts(sites.map((site) => site.id));
    const [reports, claims] = await Promise.all([
        fetchByField<DailyReport>('daily_reports', 'companyId', clientCompanyIds),
        fetchByField<ProgressClaim>('progress_claims', 'siteId', siteIds),
    ]);
    return { companies, sites, reports, claims };
};

interface StatCardProps {
    label: string;
    value: string;
    description: string;
    icon: typeof faBuilding;
    tone: 'blue' | 'indigo' | 'emerald' | 'amber';
}

const STAT_TONES: Record<StatCardProps['tone'], { surface: string; icon: string }> = {
    blue: { surface: 'bg-blue-50', icon: 'text-blue-600' },
    indigo: { surface: 'bg-indigo-50', icon: 'text-indigo-600' },
    emerald: { surface: 'bg-emerald-50', icon: 'text-emerald-600' },
    amber: { surface: 'bg-amber-50', icon: 'text-amber-600' },
};

const StatCard: React.FC<StatCardProps> = ({ label, value, description, icon, tone }) => {
    const colors = STAT_TONES[tone];
    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-bold text-slate-500 sm:text-sm">{label}</p><p className="mt-1.5 text-xl font-black tracking-tight text-slate-950 sm:mt-2 sm:text-2xl">{value}</p></div>
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${colors.surface}`}><FontAwesomeIcon icon={icon} className={`text-base sm:text-lg ${colors.icon}`} /></span>
            </div>
            <p className="mt-2 text-[11px] font-medium leading-4 text-slate-400 sm:mt-3 sm:text-xs">{description}</p>
        </article>
    );
};

const ClientDashboardView: React.FC = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState<DashboardData>(EMPTY_DATA);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const today = useMemo(getToday, []);
    const currentYearMonth = useMemo(getCurrentYearMonth, []);

    const load = useCallback(async (isRefresh = false) => {
        if (!currentUser?.uid) { setLoading(false); setData(EMPTY_DATA); return; }
        if (isRefresh) setRefreshing(true); else setLoading(true);
        setError('');
        try {
            const nextData = await loadClientDashboardData(currentUser.uid);
            setData(nextData);
            setSelectedCompanyId((current) => nextData.companies.some((company) => company.id === current) ? current : String(nextData.companies[0]?.id || ''));
        } catch (loadError) {
            console.error('[ClientDashboardView] Failed to load dashboard data:', loadError);
            setError('대시보드 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
            setData(EMPTY_DATA);
        } finally { setLoading(false); setRefreshing(false); }
    }, [currentUser?.uid]);

    useEffect(() => { void load(); }, [load]);

    const scopedSites = useMemo(() => data.sites.filter((site) => !selectedCompanyId || String(site.clientCompanyId || '') === selectedCompanyId), [data.sites, selectedCompanyId]);
    const scopedSiteIds = useMemo(() => new Set(scopedSites.map((site) => String(site.id || ''))), [scopedSites]);
    const scopedReports = useMemo(() => data.reports.filter((report) => scopedSiteIds.has(String(report.siteId || ''))), [data.reports, scopedSiteIds]);
    const scopedClaims = useMemo(() => data.claims.filter((claim) => scopedSiteIds.has(String(claim.siteId || ''))), [data.claims, scopedSiteIds]);
    const latestClaimBySite = useMemo(() => getLatestClaimBySite(scopedClaims), [scopedClaims]);

    const metrics = useMemo(() => {
        const activeSites = scopedSites.filter((site) => site.status !== 'completed');
        const monthReports = scopedReports.filter((report) => dateText(report.date).startsWith(currentYearMonth));
        const monthClaims = scopedClaims.filter((claim) => String(claim.yearMonth) === currentYearMonth);
        const pendingClaims = scopedClaims.filter((claim) => ['draft', 'review'].includes(String(claim.status)));
        return {
            activeSiteCount: activeSites.length,
            todayManDay: scopedReports.filter((report) => dateText(report.date) === today).reduce((sum, report) => sum + toProgressNumber(report.totalManDay), 0),
            monthManDay: monthReports.reduce((sum, report) => sum + toProgressNumber(report.totalManDay), 0),
            monthBilling: monthClaims.reduce((sum, claim) => sum + getClaimAmount(claim), 0),
            pendingClaims,
        };
    }, [currentYearMonth, scopedClaims, scopedReports, scopedSites, today]);

    const recentReports = useMemo(() => [...scopedReports].sort((a, b) => dateText(b.date).localeCompare(dateText(a.date))).slice(0, 5), [scopedReports]);
    const sitesWithoutTodayReport = useMemo(() => {
        const reportedSiteIds = new Set(scopedReports.filter((report) => dateText(report.date) === today).map((report) => String(report.siteId || '')));
        return scopedSites.filter((site) => site.status !== 'completed' && !reportedSiteIds.has(String(site.id || ''))).slice(0, 3);
    }, [scopedReports, scopedSites, today]);

    if (loading) return <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="text-center"><FontAwesomeIcon icon={faRotateRight} spin className="mb-3 text-3xl text-blue-600" /><p className="text-sm font-bold text-slate-500">건설 현황을 불러오는 중입니다.</p></div></div>;

    if (!error && data.companies.length === 0) return (
        <section className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 px-6 py-12 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm"><FontAwesomeIcon icon={faBuilding} className="text-xl" /></span>
            <h2 className="mt-5 text-xl font-black text-slate-950">연결된 건설 회사가 없습니다</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">계정에 건설 회사를 연결하면, 해당 회사의 현장·출력·기성 현황만 이 화면에서 확인할 수 있습니다.</p>
        </section>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-end gap-2">
                {data.companies.length > 1 && <label className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm"><span className="sr-only">건설 회사 선택</span><select value={selectedCompanyId} onChange={(event) => setSelectedCompanyId(event.target.value)} className="max-w-[180px] cursor-pointer bg-transparent pr-2 outline-none">{data.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>}
                <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-extrabold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"><FontAwesomeIcon icon={faRotateRight} spin={refreshing} /> 새로고침</button>
            </div>

            {error && <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5" /><div className="flex-1 font-medium">{error}</div><button type="button" onClick={() => void load(true)} className="font-extrabold underline">다시 시도</button></div>}

            <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard label="진행 중 현장" value={`${metrics.activeSiteCount}곳`} description="완료 처리되지 않은 연결 현장" icon={faHelmetSafety} tone="blue" />
                <StatCard label="오늘 투입 공수" value={`${metrics.todayManDay.toLocaleString('ko-KR')} 공수`} description={`${today.replace(/-/g, '.')} 기준 일보 집계`} icon={faUsers} tone="indigo" />
                <StatCard label="이번 달 청구" value={formatCompactWon(metrics.monthBilling)} description={`${currentYearMonth.replace('-', '.')} 기성 기준`} icon={faFileInvoiceDollar} tone="emerald" />
                <StatCard label="검토 대기 기성" value={`${metrics.pendingClaims.length}건`} description="작성 또는 검토 상태의 기성" icon={faClock} tone="amber" />
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
                <div className="xl:col-span-3 rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="text-base font-black text-slate-950">현장 진행 현황</h2><p className="mt-1 text-xs font-medium text-slate-400">기성 진행률과 최신 인력 투입 현황입니다.</p></div><button onClick={() => navigate('/payroll/progress-claims')} className="text-sm font-extrabold text-blue-600 hover:text-blue-700">기성관리 <FontAwesomeIcon icon={faArrowRight} className="ml-1" /></button></div>
                    <div className="divide-y divide-slate-100">
                        {scopedSites.length > 0 ? scopedSites.slice(0, 6).map((site) => {
                            const claim = latestClaimBySite.get(String(site.id || ''));
                            const progress = getCumulativeProgress(claim);
                            const monthManDay = scopedReports.filter((report) => String(report.siteId || '') === String(site.id || '') && dateText(report.date).startsWith(currentYearMonth)).reduce((sum, report) => sum + toProgressNumber(report.totalManDay), 0);
                            return <button type="button" key={site.id} onClick={() => navigate(`/payroll/progress-claims?siteId=${encodeURIComponent(String(site.id || ''))}`)} className="w-full px-5 py-4 text-left transition hover:bg-slate-50 sm:px-6"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-black text-slate-800">{site.name}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${site.status === 'completed' ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-700'}`}>{getSiteStatusLabel(site.status)}</span></div><p className="mt-1 truncate text-xs font-medium text-slate-400">{site.address || '주소 미등록'} · 이번 달 {monthManDay.toLocaleString('ko-KR')} 공수</p></div><span className="shrink-0 text-sm font-black text-slate-800">{progress}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${progress}%` }} /></div><div className="mt-2 flex justify-between text-[11px] font-semibold text-slate-400"><span>{claim ? `${claim.yearMonth} ${getClaimStatusLabel(claim.status)}` : '등록된 기성 없음'}</span><span>{claim ? formatWon(getClaimAmount(claim)) : ''}</span></div></button>;
                        }) : <div className="px-6 py-12 text-center text-sm font-medium text-slate-400">연결된 현장이 없습니다.</div>}
                    </div>
                </div>

                <aside className="xl:col-span-2 space-y-6">
                    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="text-base font-black text-slate-950">확인이 필요한 항목</h2></div><div className="divide-y divide-slate-100">
                        {metrics.pendingClaims.slice(0, 3).map((claim) => <button key={claim.id} type="button" onClick={() => navigate(`/payroll/progress-claims?siteId=${encodeURIComponent(claim.siteId)}`)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><FontAwesomeIcon icon={faFileInvoiceDollar} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-800">{claim.siteName}</span><span className="mt-0.5 block text-xs font-medium text-slate-400">{claim.yearMonth} · {getClaimStatusLabel(claim.status)}</span></span><FontAwesomeIcon icon={faArrowRight} className="text-xs text-slate-300" /></button>)}
                        {metrics.pendingClaims.length === 0 && sitesWithoutTodayReport.slice(0, 2).map((site) => <button key={site.id} type="button" onClick={() => navigate('/payroll/client-site-labor')} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><FontAwesomeIcon icon={faCalendarDay} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-800">{site.name}</span><span className="mt-0.5 block text-xs font-medium text-slate-400">오늘 일보가 아직 집계되지 않았습니다.</span></span><FontAwesomeIcon icon={faArrowRight} className="text-xs text-slate-300" /></button>)}
                        {metrics.pendingClaims.length === 0 && sitesWithoutTodayReport.length === 0 && <div className="flex items-center gap-3 px-5 py-6 text-sm font-bold text-emerald-700"><FontAwesomeIcon icon={faCircleCheck} /> 현재 확인이 필요한 항목이 없습니다.</div>}
                    </div></section>
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-black text-slate-950">빠른 이동</h2><div className="mt-4 grid grid-cols-2 gap-2">{[{ label: '현장 출력', path: '/payroll/client-site-labor', icon: faUsers }, { label: '기성 관리', path: '/payroll/progress-claims', icon: faChartLine }, { label: '현장별 지원', path: '/payroll/support-client-site', icon: faBuilding }, { label: '기성 청구서', path: '/payroll/progress-claim-invoice', icon: faFileInvoiceDollar }].map((action) => <button key={action.label} type="button" onClick={() => navigate(action.path)} className="rounded-xl border border-slate-200 px-3 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50"><FontAwesomeIcon icon={action.icon} className="text-sm text-blue-600" /><span className="ml-2 text-xs font-extrabold text-slate-700">{action.label}</span></button>)}</div></section>
                </aside>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="text-base font-black text-slate-950">최근 일보</h2><p className="mt-1 text-xs font-medium text-slate-400">연결 현장의 최신 작업 기록입니다.</p></div><button onClick={() => navigate('/payroll/client-site-labor')} className="text-sm font-extrabold text-blue-600 hover:text-blue-700">현장 출력 보기 <FontAwesomeIcon icon={faArrowRight} className="ml-1" /></button></div><div className="divide-y divide-slate-100">{recentReports.length > 0 ? recentReports.map((report) => <button key={report.id} type="button" onClick={() => navigate('/payroll/client-site-labor')} className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-slate-50 sm:px-6"><span className="w-20 shrink-0 text-xs font-bold text-slate-400">{dateText(report.date).replace(/-/g, '.')}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-800">{report.siteName || '현장 미지정'}</span><span className="mt-0.5 block truncate text-xs font-medium text-slate-400">{report.workContent || report.teamName || '작업 내용이 등록되지 않았습니다.'}</span></span><span className="shrink-0 text-sm font-black text-slate-700">{toProgressNumber(report.totalManDay).toLocaleString('ko-KR')} 공수</span></button>) : <div className="px-6 py-10 text-center text-sm font-medium text-slate-400">등록된 일보가 없습니다.</div>}</div></section>
        </div>
    );
};

export default ClientDashboardView;
