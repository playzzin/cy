import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRight,
    faBoxesStacked,
    faBuilding,
    faCalculator,
    faCircleCheck,
    faClock,
    faFileInvoice,
    faFileInvoiceDollar,
    faRotateRight,
    faTriangleExclamation,
    faTruck,
    faTruckFast,
} from '@fortawesome/free-solid-svg-icons';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import type { Company } from '../../services/companyService';
import type { OutboundTransaction } from '../../types/materials';
import { isDevAdminSessionEnabled } from '../../utils/devAdminSession';

type RentalDashboardData = {
    companies: Company[];
    dispatches: OutboundTransaction[];
};

const EMPTY_DATA: RentalDashboardData = { companies: [], dispatches: [] };

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

const getToday = (): string => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const getCurrentYearMonth = (): string => {
    const now = new Date();
    return String(now.getFullYear()) + '-' + String(now.getMonth() + 1).padStart(2, '0');
};

const dateText = (value: unknown): string => String(value ?? '').slice(0, 10);

const toNumber = (value: unknown): number => {
    const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
};

const statusMeta = (status: unknown): { label: string; className: string } => {
    if (status === 'delivered') return { label: '납품 완료', className: 'bg-emerald-50 text-emerald-700' };
    if (status === 'in-transit') return { label: '배송 중', className: 'bg-blue-50 text-blue-700' };
    return { label: '출고 대기', className: 'bg-amber-50 text-amber-700' };
};

const fetchByField = async <T,>(collectionName: string, field: string, values: string[]): Promise<T[]> => {
    if (values.length === 0) return [];
    const snapshots = await Promise.all(
        chunk(values, 10).map((valueChunk) => getDocs(query(collection(db, collectionName), where(field, 'in', valueChunk)))),
    );
    const seen = new Set<string>();
    return snapshots.flatMap((snapshot) => snapshot.docs)
        .filter((item) => !seen.has(item.id) && Boolean(seen.add(item.id)))
        .map((item) => ({ id: item.id, ...item.data() } as T));
};

const loadRentalDashboardData = async (uid: string): Promise<RentalDashboardData> => {
    const profile = await userService.getUser(uid);
    const linkedCompanyIds = parseLinkedCompanyIds(profile?.linkedCompanyIds);
    let companies: Company[] = [];

    if (linkedCompanyIds.length > 0) {
        const snapshots = await Promise.all(linkedCompanyIds.map((companyId) => getDoc(doc(db, 'companies', companyId))));
        companies = snapshots
            .filter((snapshot) => snapshot.exists())
            .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() } as Company))
            .filter((company) => company.type === '임대사');
    } else if (isDevAdminSessionEnabled()) {
        const snapshot = await getDocs(collection(db, 'companies'));
        companies = snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() } as Company))
            .filter((company) => company.type === '임대사');
    }

    const companyIds = uniqueTexts(companies.map((company) => company.id));
    const dispatches = await fetchByField<OutboundTransaction>('materialOutbounds', 'rentalCompanyId', companyIds);
    return { companies, dispatches };
};

const STAT_TONES = {
    orange: { surface: 'bg-orange-50', icon: 'text-orange-600' },
    amber: { surface: 'bg-amber-50', icon: 'text-amber-600' },
    sky: { surface: 'bg-sky-50', icon: 'text-sky-600' },
    emerald: { surface: 'bg-emerald-50', icon: 'text-emerald-600' },
};

type StatTone = keyof typeof STAT_TONES;

const StatCard: React.FC<{ label: string; value: string; description: string; icon: typeof faTruck; tone: StatTone }> = ({
    label, value, description, icon, tone,
}) => {
    const colors = STAT_TONES[tone];
    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-bold text-slate-500 sm:text-sm">{label}</p>
                    <p className="mt-1.5 text-xl font-black tracking-tight text-slate-950 sm:mt-2 sm:text-2xl">{value}</p>
                </div>
                <span className={'flex h-10 w-10 items-center justify-center rounded-xl sm:h-11 sm:w-11 ' + colors.surface}>
                    <FontAwesomeIcon icon={icon} className={'text-base sm:text-lg ' + colors.icon} />
                </span>
            </div>
            <p className="mt-2 text-[11px] font-medium leading-4 text-slate-400 sm:mt-3 sm:text-xs">{description}</p>
        </article>
    );
};

const RentalDashboardView: React.FC = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState<RentalDashboardData>(EMPTY_DATA);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const today = useMemo(getToday, []);
    const currentYearMonth = useMemo(getCurrentYearMonth, []);

    const load = useCallback(async (isRefresh = false) => {
        if (!currentUser?.uid) {
            setLoading(false);
            setData(EMPTY_DATA);
            return;
        }

        if (isRefresh) setRefreshing(true); else setLoading(true);
        setError('');
        try {
            const nextData = await loadRentalDashboardData(currentUser.uid);
            setData(nextData);
            setSelectedCompanyId((current) => nextData.companies.some((company) => company.id === current)
                ? current
                : String(nextData.companies[0]?.id || ''));
        } catch (loadError) {
            console.error('[RentalDashboardView] Failed to load dashboard data:', loadError);
            setError('임대 현황 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
            setData(EMPTY_DATA);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [currentUser?.uid]);

    useEffect(() => {
        void load();
    }, [load]);

    const selectedCompany = useMemo(
        () => data.companies.find((company) => company.id === selectedCompanyId) || null,
        [data.companies, selectedCompanyId],
    );
    const dispatches = useMemo(
        () => data.dispatches.filter((row) => !selectedCompanyId || String(row.rentalCompanyId || '') === selectedCompanyId),
        [data.dispatches, selectedCompanyId],
    );
    const recentDispatches = useMemo(
        () => [...dispatches].sort((a, b) => dateText(b.transactionDate).localeCompare(dateText(a.transactionDate))).slice(0, 6),
        [dispatches],
    );
    const metrics = useMemo(() => {
        const currentMonth = dispatches.filter((row) => dateText(row.transactionDate).startsWith(currentYearMonth));
        const todayDispatches = dispatches.filter((row) => dateText(row.transactionDate) === today);
        const pendingDispatches = dispatches.filter((row) => row.deliveryStatus !== 'delivered');
        return {
            todayCount: todayDispatches.length,
            pendingDispatches,
            deliveredCount: currentMonth.filter((row) => row.deliveryStatus === 'delivered').length,
            monthQuantity: currentMonth.reduce((sum, row) => sum + toNumber(row.quantity), 0),
            materialCount: new Set(currentMonth.map((row) => String(row.materialId || row.itemName || '')).filter(Boolean)).size,
            siteCount: new Set(currentMonth.map((row) => String(row.siteId || row.siteName || '')).filter(Boolean)).size,
        };
    }, [currentYearMonth, dispatches, today]);

    if (loading) {
        return <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="text-center"><FontAwesomeIcon icon={faRotateRight} spin className="mb-3 text-3xl text-orange-600" /><p className="text-sm font-bold text-slate-500">임대 출고 현황을 불러오는 중입니다.</p></div></div>;
    }

    if (!error && data.companies.length === 0) {
        return <section className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 px-6 py-12 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-orange-600 shadow-sm"><FontAwesomeIcon icon={faBuilding} className="text-xl" /></span><h2 className="mt-5 text-xl font-black text-slate-950">연결된 임대사가 없습니다</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">계정에 임대사 회사를 연결하면, 해당 회사의 출고·납품 현황과 자재 흐름을 이 화면에서 확인할 수 있습니다.</p></section>;
    }

    return (
        <div className="space-y-6">
            <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-orange-950 to-amber-800 px-5 py-6 text-white shadow-lg sm:px-7">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-orange-100"><FontAwesomeIcon icon={faTruck} /> 임대사 전용</span><h1 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">{selectedCompany?.name || '임대 출고 현황'}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-orange-100/80">연결된 임대사의 자재 출고, 납품 진행과 현장별 운송 흐름을 한 화면에서 확인합니다.</p></div>
                    <div className="flex flex-wrap items-center gap-2">
                        {data.companies.length > 1 && <label className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold text-white"><span className="sr-only">임대사 선택</span><select value={selectedCompanyId} onChange={(event) => setSelectedCompanyId(event.target.value)} className="max-w-[180px] cursor-pointer bg-transparent pr-2 text-white outline-none">{data.companies.map((company) => <option key={company.id} value={company.id} className="text-slate-950">{company.name}</option>)}</select></label>}
                        <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3.5 text-sm font-extrabold text-slate-800 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"><FontAwesomeIcon icon={faRotateRight} spin={refreshing} /> 새로고침</button>
                    </div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 sm:grid-cols-4">
                    <div><p className="text-xs font-bold text-orange-100/70">오늘 출고</p><p className="mt-1 text-xl font-black">{metrics.todayCount}건</p></div>
                    <div><p className="text-xs font-bold text-orange-100/70">출고·배송 대기</p><p className="mt-1 text-xl font-black">{metrics.pendingDispatches.length}건</p></div>
                    <div><p className="text-xs font-bold text-orange-100/70">이번 달 납품</p><p className="mt-1 text-xl font-black">{metrics.deliveredCount}건</p></div>
                    <div><p className="text-xs font-bold text-orange-100/70">운영 현장</p><p className="mt-1 text-xl font-black">{metrics.siteCount}곳</p></div>
                </div>
            </section>

            {error && <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5" /><div className="flex-1 font-medium">{error}</div><button type="button" onClick={() => void load(true)} className="font-extrabold underline">다시 시도</button></div>}

            <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard label="오늘 출고" value={String(metrics.todayCount) + '건'} description={today.replace(/-/g, '.') + ' 기준 출고 접수'} icon={faTruckFast} tone="orange" />
                <StatCard label="출고·배송 대기" value={String(metrics.pendingDispatches.length) + '건'} description="출고 대기 또는 배송 중인 건" icon={faClock} tone="amber" />
                <StatCard label="이번 달 출고 수량" value={metrics.monthQuantity.toLocaleString('ko-KR')} description={currentYearMonth.replace('-', '.') + ' 기준 전체 수량'} icon={faBoxesStacked} tone="sky" />
                <StatCard label="취급 자재" value={String(metrics.materialCount) + '종'} description="이번 달 출고된 자재 기준" icon={faCircleCheck} tone="emerald" />
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
                <div className="xl:col-span-3 rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="text-base font-black text-slate-950">최근 출고·납품</h2><p className="mt-1 text-xs font-medium text-slate-400">연결된 임대사의 최신 자재 운송 기록입니다.</p></div><button type="button" onClick={() => navigate('/materials')} className="text-sm font-extrabold text-orange-600 hover:text-orange-700">자재 관리 <FontAwesomeIcon icon={faArrowRight} className="ml-1" /></button></div>
                    <div className="divide-y divide-slate-100">
                        {recentDispatches.length > 0 ? recentDispatches.map((dispatch) => {
                            const status = statusMeta(dispatch.deliveryStatus);
                            return <button type="button" key={dispatch.id} onClick={() => navigate('/materials')} className="w-full px-5 py-4 text-left transition hover:bg-slate-50 sm:px-6"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-black text-slate-800">{dispatch.itemName || '자재명 미지정'}</p><span className={'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ' + status.className}>{status.label}</span></div><p className="mt-1 truncate text-xs font-medium text-slate-400">{dispatch.siteName || '현장 미지정'} · {dispatch.spec || '규격 미지정'} · {dateText(dispatch.transactionDate).replace(/-/g, '.')}</p></div><span className="shrink-0 text-sm font-black text-slate-800">{toNumber(dispatch.quantity).toLocaleString('ko-KR')} {dispatch.unit || ''}</span></div></button>;
                        }) : <div className="px-6 py-12 text-center text-sm font-medium text-slate-400">등록된 출고·납품 기록이 없습니다.</div>}
                    </div>
                </div>

                <aside className="xl:col-span-2 space-y-6">
                    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="text-base font-black text-slate-950">확인이 필요한 출고</h2></div><div className="divide-y divide-slate-100">
                        {metrics.pendingDispatches.slice(0, 3).map((dispatch) => { const status = statusMeta(dispatch.deliveryStatus); return <button key={dispatch.id} type="button" onClick={() => navigate('/materials')} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><FontAwesomeIcon icon={faTruck} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-800">{dispatch.itemName || '자재명 미지정'}</span><span className="mt-0.5 block text-xs font-medium text-slate-400">{dispatch.siteName || '현장 미지정'} · {status.label}</span></span><FontAwesomeIcon icon={faArrowRight} className="text-xs text-slate-300" /></button>; })}
                        {metrics.pendingDispatches.length === 0 && <div className="flex items-center gap-3 px-5 py-6 text-sm font-bold text-emerald-700"><FontAwesomeIcon icon={faCircleCheck} /> 출고·배송 대기 건이 없습니다.</div>}
                    </div></section>
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-black text-slate-950">빠른 이동</h2><div className="mt-4 grid grid-cols-2 gap-2">{[{ label: '임대 거래명세', path: '/transaction/manage', icon: faFileInvoice }, { label: '임대 견적', path: '/estimate/manage', icon: faCalculator }, { label: '자재 관리', path: '/materials', icon: faBoxesStacked }, { label: '스마트 장부', path: '/payroll/workbook-ledger-upgrade', icon: faFileInvoiceDollar }].map((action) => <button key={action.label} type="button" onClick={() => navigate(action.path)} className="rounded-xl border border-slate-200 px-3 py-3 text-left transition hover:border-orange-200 hover:bg-orange-50"><FontAwesomeIcon icon={action.icon} className="text-sm text-orange-600" /><span className="ml-2 text-xs font-extrabold text-slate-700">{action.label}</span></button>)}</div></section>
                </aside>
            </section>
        </div>
    );
};

export default RentalDashboardView;
