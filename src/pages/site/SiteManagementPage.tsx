import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    faBuilding, faMapMarkerAlt, faCalendarAlt, faHardHat,
    faSearch, faTimes, faChartPie, faList
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { format, parseISO, isValid } from 'date-fns';

import { siteService, Site } from '../../services/siteService';
import { manpowerService } from '../../services/manpowerService';
import { dailyReportService, DailyReport, DailyReportWorker } from '../../services/dailyReportService';
import materialService from '../../services/materialService';
import { InboundTransaction, OutboundTransaction } from '../../types/materials';
import { listGalleryImages } from '../../services/geminiImageService';

// ----------------------------------------------------------------------
// Types & Interfaces
// ----------------------------------------------------------------------

interface SiteDetailModalProps {
    site: Site;
    onClose: () => void;
}

interface WorkerSummary {
    workerId: string;
    name: string;
    role: string;
    teamName: string;
    totalManDay: number;
    lastWorkDate: string;
    companyName: string; // 소속 회사 (협력사 등)
}

interface CompanyManDaySummary {
    [key: string]: any; // Recharts compatibility
    companyName: string;
    totalManDay: number;
    color: string;
}

interface SiteReportSummary {
    firstDate: string;
    lastDate: string;
    totalManDay: number;
}

interface MaterialTransactionSummary {
    id: string;
    type: 'inbound' | 'outbound';
    transactionDate: string;
    itemName: string;
    spec: string;
    quantity: number;
    unit: string;
}

const getContractorDisplayName = (site: Site): string => {
    // siteType이 '외부팀'이거나 partnerName에 '외부'가 포함된 경우 빈 문자열 반환
    const siteType = String(site.siteType ?? '').trim();
    const partnerName = String(site.partnerName ?? '').trim();
    if (siteType.includes('외부팀') || partnerName.includes('외부')) return '';
    const candidates = [site.companyName, site.constructorCompanyName, site.partnerName]
        .map((value) => String(value || '').trim())
        .filter(Boolean);
    return candidates[0] || '청연';
};

const getReportSiteKey = (siteId?: string | null, siteName?: string | null): string => {
    const id = String(siteId || '').trim();
    if (id) return `id:${id}`;
    const name = String(siteName || '').trim();
    if (name) return `name:${name}`;
    return '';
};

const pickFallbackBirdseyeImage = (site: Site, pool: string[]): string => {
    if (pool.length === 0) return '';
    const seedSource = String(site.id || site.code || site.name || 'site');
    const seed = seedSource.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return pool[seed % pool.length] || '';
};

const BIRDSEYE_URL_CACHE_KEY = 'site-management-birdseye-urls-v1';
const OPTIMIZED_BIRDSEYE_IMAGE_IDS = new Set([
    'birdseye_1774047026148',
    'birdseye_1774047124635',
    'birdseye_1776116842323',
    'birdseye_1776116877637',
    'birdseye_1776116927326',
    'birdseye_1776116965248',
    'birdseye_1776117044575',
    'birdseye_1776117074770',
    'birdseye_1776117117011',
    'birdseye_1776117173931',
    'birdseye_1776117230488',
    'birdseye_1776117297663',
    'birdseye_1776117385934',
    'birdseye_1776117423961',
    'birdseye_1776614682782',
    'birdseye_1776843533735',
]);

const getPrioritySiteImageCount = (): number => {
    if (typeof window === 'undefined') return 4;
    if (window.innerWidth >= 1536) return 6;
    if (window.innerWidth >= 1280) return 4;
    if (window.innerWidth >= 1024) return 3;
    if (window.innerWidth >= 640) return 2;
    return 1;
};

const getOptimizedBirdseyeUrl = (url: string): string => {
    if (!url) return '';

    try {
        const decodedPath = decodeURIComponent(new URL(url, window.location.origin).pathname);
        const fileName = decodedPath.split('/').pop() || '';
        const imageId = fileName.replace(/\.[^.]+$/, '');
        return OPTIMIZED_BIRDSEYE_IMAGE_IDS.has(imageId)
            ? `/assets/site-thumbnails/${imageId}.webp`
            : '';
    } catch {
        return '';
    }
};

const readCachedBirdseyeUrls = (): string[] => {
    try {
        const cached = window.localStorage.getItem(BIRDSEYE_URL_CACHE_KEY);
        if (!cached) return [];
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed)
            ? parsed.map((url) => String(url || '').trim()).filter(Boolean).slice(0, 64)
            : [];
    } catch {
        return [];
    }
};

interface SitePreviewImageProps {
    siteName: string;
    originalUrl: string;
    optimizedFallbackUrl: string;
    fallbackUrl: string;
    priority: boolean;
}

const SitePreviewImage = React.memo<SitePreviewImageProps>(({ siteName, originalUrl, optimizedFallbackUrl, fallbackUrl, priority }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [shouldLoad, setShouldLoad] = useState(priority);
    const [activeIndex, setActiveIndex] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    const candidateUrls = useMemo(
        () => Array.from(new Set([originalUrl, optimizedFallbackUrl, fallbackUrl].filter(Boolean))),
        [originalUrl, optimizedFallbackUrl, fallbackUrl]
    );
    const activeUrl = candidateUrls[activeIndex] || '';

    useEffect(() => {
        setActiveIndex(0);
        setLoaded(false);
        setFailed(false);
    }, [originalUrl, optimizedFallbackUrl, fallbackUrl]);

    useEffect(() => {
        if (priority || shouldLoad) {
            setShouldLoad(true);
            return;
        }

        const target = containerRef.current;
        if (!target || typeof IntersectionObserver === 'undefined') {
            setShouldLoad(true);
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            setShouldLoad(true);
            observer.disconnect();
        }, { rootMargin: '600px 0px' });

        observer.observe(target);
        return () => observer.disconnect();
    }, [priority, shouldLoad]);

    const handleError = () => {
        if (activeIndex + 1 < candidateUrls.length) {
            setLoaded(false);
            setActiveIndex((index) => index + 1);
            return;
        }
        setFailed(true);
    };

    return (
        <div ref={containerRef} className="absolute inset-0">
            {!loaded && !failed && activeUrl && (
                <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-700 via-slate-600 to-slate-700" />
            )}
            {shouldLoad && activeUrl && !failed ? (
                <img
                    src={activeUrl}
                    alt={siteName}
                    width={320}
                    height={240}
                    loading={priority ? 'eager' : 'lazy'}
                    decoding="async"
                    {...{ fetchpriority: priority ? 'high' : 'low' }}
                    className={`h-full w-full object-cover transition-[opacity,transform] duration-300 group-hover:scale-[1.02] ${loaded ? 'opacity-80 group-hover:opacity-100' : 'opacity-0'}`}
                    onLoad={() => setLoaded(true)}
                    onError={handleError}
                />
            ) : null}
            {(!activeUrl || failed) && (
                <div className="flex h-full w-full items-center justify-center bg-slate-800 text-slate-600">
                    <FontAwesomeIcon icon={faBuilding} size="2x" />
                </div>
            )}
        </div>
    );
});

SitePreviewImage.displayName = 'SitePreviewImage';

// ----------------------------------------------------------------------
// Component: SiteDetailModal (Dark Theme)
// ----------------------------------------------------------------------

const SiteDetailModal: React.FC<SiteDetailModalProps> = ({ site, onClose }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'materials' | 'reports' | 'workcontent'>('overview');
    const [loading, setLoading] = useState(false);

    // Data States
    const [workerSummaries, setWorkerSummaries] = useState<WorkerSummary[]>([]);
    const [companySummaries, setCompanySummaries] = useState<CompanyManDaySummary[]>([]);
    const [reports, setReports] = useState<DailyReport[]>([]);
    const [inboundTransactions, setInboundTransactions] = useState<InboundTransaction[]>([]);
    const [outboundTransactions, setOutboundTransactions] = useState<OutboundTransaction[]>([]);
    const totalOutputManDay = useMemo(() => reports.reduce((acc, report) => {
        const reportManDay = (report.workers || []).reduce((sum, worker) => sum + (typeof worker.manDay === 'number' ? worker.manDay : 0), 0);
        return acc + reportManDay;
    }, 0), [reports]);

    const totalInboundQuantity = useMemo(
        () => inboundTransactions.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0),
        [inboundTransactions]
    );

    const totalOutboundQuantity = useMemo(
        () => outboundTransactions.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0),
        [outboundTransactions]
    );

    const recentMaterialTransactions = useMemo<MaterialTransactionSummary[]>(() => {
        const inbound = inboundTransactions.map((row) => ({
            id: row.id,
            type: 'inbound' as const,
            transactionDate: row.transactionDate || '',
            itemName: row.itemName || '-',
            spec: row.spec || '-',
            quantity: Number(row.quantity) || 0,
            unit: row.unit || '',
        }));

        const outbound = outboundTransactions.map((row) => ({
            id: row.id,
            type: 'outbound' as const,
            transactionDate: row.transactionDate || '',
            itemName: row.itemName || '-',
            spec: row.spec || '-',
            quantity: Number(row.quantity) || 0,
            unit: row.unit || '',
        }));

        return [...inbound, ...outbound]
            .sort((a, b) => String(b.transactionDate).localeCompare(String(a.transactionDate)))
            .slice(0, 8);
    }, [inboundTransactions, outboundTransactions]);

    useEffect(() => {
        if (!site.id) return;
        loadData();
    }, [site.id]);

    const loadData = async () => {
        if (!site.id) return;
        setLoading(true);
        try {
            // 출력일보 + 작업자 마스터를 함께 읽어 작업자 소속을 정확히 매핑한다.
            const [fetchedReports, workers] = await Promise.all([
                dailyReportService.getReportsBySite(site.id),
                manpowerService.getWorkers(),
            ]);
            const sortedReports = [...fetchedReports].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
            setReports(sortedReports);

            // 자재 조회 실패가 출력일보/작업자 데이터 로딩을 막지 않도록 분리 처리한다.
            const [inboundResult, outboundResult] = await Promise.allSettled([
                materialService.getInboundTransactions({ siteId: site.id }),
                materialService.getOutboundTransactions({ siteId: site.id }),
            ]);

            if (inboundResult.status === 'fulfilled') {
                const sortedInbound = [...inboundResult.value].sort((a, b) => String(b.transactionDate || '').localeCompare(String(a.transactionDate || '')));
                setInboundTransactions(sortedInbound);
            } else {
                console.error('Failed to load inbound transactions:', inboundResult.reason);
                setInboundTransactions([]);
            }

            if (outboundResult.status === 'fulfilled') {
                const sortedOutbound = [...outboundResult.value].sort((a, b) => String(b.transactionDate || '').localeCompare(String(a.transactionDate || '')));
                setOutboundTransactions(sortedOutbound);
            } else {
                console.error('Failed to load outbound transactions:', outboundResult.reason);
                setOutboundTransactions([]);
            }

            const workerById = new Map<string, (typeof workers)[number]>();
            workers.forEach((worker) => {
                const id = String(worker.id ?? '').trim();
                const legacyId = String(worker.legacyId ?? '').trim();
                if (id) workerById.set(id, worker);
                if (legacyId && !workerById.has(legacyId)) workerById.set(legacyId, worker);
            });

            // 작업자/업체 누적 공수 집계
            const wMap = new Map<string, WorkerSummary>();
            const cMap = new Map<string, number>();

            sortedReports.forEach((report: DailyReport) => {
                report.workers.forEach((w: DailyReportWorker) => {
                    const workerMaster = workerById.get(String(w.workerId ?? '').trim());
                    const resolvedTeamName = String(
                        w.workerTeamName
                        || workerMaster?.teamName
                        || report.teamName
                        || ''
                    ).trim();
                    const resolvedCompanyName = String(
                        workerMaster?.companyName
                        || '소속미지정'
                    ).trim();

                    // Worker Summary
                    const key = w.workerId;
                    const existing = wMap.get(key);
                    const manDay = typeof w.manDay === 'number' ? w.manDay : 0;

                    if (existing) {
                        existing.totalManDay += manDay;
                        if (report.date > existing.lastWorkDate) existing.lastWorkDate = report.date;
                    } else {
                        wMap.set(key, {
                            workerId: key,
                            name: w.name,
                            role: w.role || '',
                            teamName: resolvedTeamName,
                            totalManDay: manDay,
                            lastWorkDate: report.date || '',
                            companyName: resolvedCompanyName,
                        });
                    }

                    // Company ManDay Summary (worker master 기반)
                    const companyKey = resolvedCompanyName || '소속미지정';
                    cMap.set(companyKey, (cMap.get(companyKey) || 0) + manDay);
                });
            });

            setWorkerSummaries(Array.from(wMap.values()).sort((a, b) => b.totalManDay - a.totalManDay));

            // Colors for Pie Chart
            const COLORS = ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#F472B6'];
            setCompanySummaries(Array.from(cMap.entries()).map(([name, total], idx) => ({
                companyName: name,
                totalManDay: total,
                color: COLORS[idx % COLORS.length]
            })));

        } catch (error) {
            console.error("Failed to load site details:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- Render Helpers ---
    const renderReportsTab = () => {
        return (
            <div className="space-y-6 h-full flex flex-col">
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-300">총 출력공수</h4>
                    <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-sm font-bold">
                        {totalOutputManDay.toFixed(1)}
                    </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-64">
                    {/* Pie Chart: ManDay by Company */}
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm flex flex-col">
                        <h4 className="text-sm font-bold text-slate-400 mb-4">업체별 누적 공수 분포</h4>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={companySummaries}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="totalManDay"
                                        nameKey="companyName"
                                        stroke="none"
                                    >
                                        {companySummaries.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                        itemStyle={{ color: '#f8fafc' }}
                                    />
                                    <Legend formatter={(value) => <span className="text-slate-400">{value}</span>} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Bar Chart: Daily Trend (Last 14 days) */}
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm flex flex-col">
                        <h4 className="text-sm font-bold text-slate-400 mb-4">최근 7일 공수 투입 현황</h4>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={reports.slice(0, 7).reverse()}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={{ stroke: '#475569' }} tickLine={{ stroke: '#475569' }} />
                                    <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={{ stroke: '#475569' }} tickLine={{ stroke: '#475569' }} />
                                    <RechartsTooltip
                                        cursor={{ fill: '#334155', opacity: 0.4 }}
                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                    />
                                    <Bar dataKey="totalManDay" name="투입공수" fill="#6366F1" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                        <h3 className="font-bold text-slate-200 flex items-center gap-2">
                            <FontAwesomeIcon icon={faHardHat} className="text-indigo-500" /> 투입 작업자 명단
                        </h3>
                        <span className="text-xs text-slate-500">총 {workerSummaries.length}명 투입됨</span>
                    </div>
                    <div className="flex-1 overflow-auto w-full custom-scrollbar">
                        <table className="w-full text-sm text-left text-slate-400">
                            <thead className="text-xs text-slate-300 uppercase bg-slate-700/50 sticky top-0 z-10 font-bold tracking-wider">
                                <tr>
                                    <th className="px-6 py-3 whitespace-nowrap">성명</th>
                                    <th className="px-6 py-3 whitespace-nowrap">직종</th>
                                    <th className="px-6 py-3 whitespace-nowrap">소속(업체)</th>
                                    <th className="px-6 py-3 whitespace-nowrap">팀명</th>
                                    <th className="px-6 py-3 whitespace-nowrap text-right">누적공수</th>
                                    <th className="px-6 py-3 whitespace-nowrap text-right">최근출역일</th>
                                </tr>
                            </thead>
                            <tbody className="bg-slate-800 divide-y divide-slate-700/50">
                                {workerSummaries.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                                            투입 기록이 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    workerSummaries.map((worker, idx) => (
                                        <tr key={idx} className="hover:bg-slate-700/30 transition-colors border-b border-slate-700/50 last:border-0">
                                            <td className="px-6 py-3.5 whitespace-nowrap font-medium text-white">{worker.name}</td>
                                            <td className="px-6 py-3.5 whitespace-nowrap text-slate-300">
                                                <span className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-300 text-xs">
                                                    {worker.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3.5 whitespace-nowrap">{worker.companyName}</td>
                                            <td className="px-6 py-3.5 whitespace-nowrap text-slate-500">{worker.teamName}</td>
                                            <td className="px-6 py-3.5 whitespace-nowrap text-right text-indigo-400 font-bold">{worker.totalManDay.toFixed(1)}</td>
                                            <td className="px-6 py-3.5 whitespace-nowrap text-right text-slate-500">{worker.lastWorkDate}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderWorkContentTab = () => {
        return (
            <div className="h-full bg-slate-800 rounded-xl border border-slate-700 shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                    <h3 className="font-bold text-slate-200 flex items-center gap-2">
                        <FontAwesomeIcon icon={faList} className="text-indigo-400" /> 작업내용 이력
                    </h3>
                    <span className="text-xs text-slate-500">총 {reports.length}건</span>
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-sm text-left text-slate-400">
                        <thead className="text-xs text-slate-300 uppercase bg-slate-700/50 sticky top-0 z-10 font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-3 whitespace-nowrap">날짜</th>
                                <th className="px-6 py-3 whitespace-nowrap">팀명</th>
                                <th className="px-6 py-3 whitespace-nowrap">작업내용</th>
                            </tr>
                        </thead>
                        <tbody className="bg-slate-800 divide-y divide-slate-700/50">
                            {reports.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-10 text-center text-slate-500">
                                        작업내용 기록이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                reports.map((report, idx) => {
                                    const fallbackFromWorkers = (report.workers || [])
                                        .map((w) => String(w.workContent || '').trim())
                                        .filter(Boolean);
                                    const uniqueWorkerContents = Array.from(new Set(fallbackFromWorkers));
                                    const content = String(report.workContent || '').trim()
                                        || (uniqueWorkerContents.length > 0 ? uniqueWorkerContents.join(' / ') : '-');

                                    return (
                                        <tr key={report.id || `${report.date}-${idx}`} className="hover:bg-slate-700/30 transition-colors border-b border-slate-700/50 last:border-0 align-top">
                                            <td className="px-6 py-3.5 whitespace-nowrap text-slate-300 font-medium">{report.date || '-'}</td>
                                            <td className="px-6 py-3.5 whitespace-nowrap text-slate-400">{report.teamName || '-'}</td>
                                            <td className="px-6 py-3.5 text-slate-200 leading-relaxed break-keep">{content}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderMaterialsTab = () => {
        return (
            <div className="space-y-4 h-full flex flex-col">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-300">총 입고수량</h4>
                        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-sm font-bold">
                            {totalInboundQuantity.toLocaleString()}
                        </span>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-300">총 출고수량</h4>
                        <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-sm font-bold">
                            {totalOutboundQuantity.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                        <h3 className="font-bold text-slate-200 flex items-center gap-2">
                            <FontAwesomeIcon icon={faList} className="text-blue-400" /> 자재 입출고 내역
                        </h3>
                        <span className="text-xs text-slate-500">최근 {recentMaterialTransactions.length}건</span>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-sm text-left text-slate-400">
                            <thead className="text-xs text-slate-300 uppercase bg-slate-700/50 sticky top-0 z-10 font-bold tracking-wider">
                                <tr>
                                    <th className="px-6 py-3 whitespace-nowrap">일자</th>
                                    <th className="px-6 py-3 whitespace-nowrap">구분</th>
                                    <th className="px-6 py-3 whitespace-nowrap">품명</th>
                                    <th className="px-6 py-3 whitespace-nowrap">규격</th>
                                    <th className="px-6 py-3 whitespace-nowrap text-right">수량</th>
                                </tr>
                            </thead>
                            <tbody className="bg-slate-800 divide-y divide-slate-700/50">
                                {recentMaterialTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                                            자재 입출고 내역이 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    recentMaterialTransactions.map((row) => (
                                        <tr key={`${row.type}-${row.id}`} className="hover:bg-slate-700/30 transition-colors border-b border-slate-700/50 last:border-0">
                                            <td className="px-6 py-3.5 whitespace-nowrap text-slate-300">{row.transactionDate || '-'}</td>
                                            <td className="px-6 py-3.5 whitespace-nowrap">
                                                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${row.type === 'inbound' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                                    {row.type === 'inbound' ? '입고' : '출고'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3.5 whitespace-nowrap text-slate-200">{row.itemName}</td>
                                            <td className="px-6 py-3.5 whitespace-nowrap text-slate-400">{row.spec}</td>
                                            <td className="px-6 py-3.5 whitespace-nowrap text-right text-slate-200 font-semibold">{row.quantity.toLocaleString()} {row.unit}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-800"
            >
                {/* Header */}
                <div className="bg-slate-800 px-6 py-4 flex justify-between items-center border-b border-slate-700">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="w-8 h-8 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center">
                                <FontAwesomeIcon icon={faBuilding} />
                            </span>
                            {site.name}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${site.status === 'active'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-slate-700 text-slate-400'
                                }`}>
                                {site.status === 'active' ? '진행중' : '완료/대기'}
                            </span>
                        </h2>
                        <div className="text-sm text-slate-400 mt-1 flex gap-4">
                            <span className="flex items-center gap-1"><FontAwesomeIcon icon={faMapMarkerAlt} /> {site.address || '주소 미입력'}</span>
                            <span className="flex items-center gap-1"><FontAwesomeIcon icon={faCalendarAlt} /> {site.startDate || '-'} ~ {site.endDate || '-'}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-700 bg-slate-800 px-6">
                    {(['overview', 'materials', 'reports', 'workcontent'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            {tab === 'overview' && '개요'}
                            {tab === 'materials' && '자재 입출고'}
                            {tab === 'reports' && '출력 일보'}
                            {tab === 'workcontent' && '작업내용'}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 p-6 overflow-hidden bg-slate-900">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                            데이터 로딩중...
                        </div>
                    ) : (
                        <div className="h-full">
                            {activeTab === 'overview' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm">
                                        <h3 className="text-lg font-bold text-slate-200 mb-4">현장 요약</h3>
                                        <dl className="grid grid-cols-2 gap-y-4">
                                            <dt className="text-sm text-slate-500">코드</dt>
                                            <dd className="text-sm font-medium text-slate-300">{site.code}</dd>
                                            <dt className="text-sm text-slate-500">총 출력공수</dt>
                                            <dd className="text-sm font-medium text-indigo-300">{totalOutputManDay.toFixed(1)}</dd>
                                            <dt className="text-sm text-slate-500">담당 팀</dt>
                                            <dd className="text-sm font-medium text-slate-300">{site.responsibleTeamName || '-'}</dd>
                                            <dt className="text-sm text-slate-500">시공사</dt>
                                            <dd className="text-sm font-medium text-slate-300">{getContractorDisplayName(site)}</dd>
                                            <dt className="text-sm text-slate-500">발주사</dt>
                                            <dd className="text-sm font-medium text-slate-300">{site.clientCompanyName || '-'}</dd>
                                        </dl>
                                    </div>

                                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm flex flex-col justify-center items-center text-center">
                                        <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center text-2xl mb-4">
                                            <FontAwesomeIcon icon={faHardHat} />
                                        </div>
                                        <div className="text-3xl font-bold text-white">{workerSummaries.length}명</div>
                                        <div className="text-sm text-slate-400 mt-1">총 투입 작업자</div>
                                    </div>
                                </div>
                            )}
                            {activeTab === 'materials' && renderMaterialsTab()}
                            {activeTab === 'reports' && renderReportsTab()}
                            {activeTab === 'workcontent' && renderWorkContentTab()}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};



// ----------------------------------------------------------------------
// Component: SiteManagementPage (Main, Dark Theme)
// ----------------------------------------------------------------------

interface SiteManagementPageProps {
    closedOnly?: boolean;
}

const isClosedSite = (site: Site): boolean => {
    const normalized = String(site.status || '').trim().toLowerCase();
    return normalized === 'completed' || normalized === 'closed' || normalized === '마감';
};

const SiteManagementPageBase: React.FC<SiteManagementPageProps> = ({ closedOnly = false }) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [sites, setSites] = useState<Site[]>([]);
    const [filteredSites, setFilteredSites] = useState<Site[]>([]);
    const [keyword, setKeyword] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedSite, setSelectedSite] = useState<Site | null>(null);
    const [siteReportSummaryMap, setSiteReportSummaryMap] = useState<Record<string, SiteReportSummary>>({});
    const [birdseyeUrls, setBirdseyeUrls] = useState<string[]>(readCachedBirdseyeUrls);
    const reportSummaryLoadStartedRef = useRef(false);
    const priorityImageCount = useMemo(getPrioritySiteImageCount, []);

    // Initial Load & Query Param Handling
    useEffect(() => {
        let mounted = true;

        const init = async () => {
            setLoading(true);
            try {
                const data = await siteService.getSites();
                if (!mounted) return;

                // '외부팀' 현장 제외
                let filtered = closedOnly ? data.filter(isClosedSite) : data;
                filtered = filtered.filter(site => {
                    // ㈜청연이엔지 현장만 포함
                    const companyName = String(site.companyName ?? '').trim();
                    if (companyName !== '㈜청연이엔지') return false;
                    const siteType = String(site.siteType ?? '').trim();
                    const partnerName = String(site.partnerName ?? '').trim();
                    // siteType에 '외부팀'이 포함되거나 partnerName에 '외부'가 포함되면 제외
                    if (siteType.includes('외부팀')) return false;
                    if (partnerName.includes('외부')) return false;
                    return true;
                });
                setSites(filtered);
                setFilteredSites(filtered);

                // Auto-open modal if siteId is present in URL
                const targetSiteId = searchParams.get('siteId');
                if (targetSiteId) {
                    const targetSite = filtered.find(s => s.id === targetSiteId);
                    if (targetSite) {
                        setSelectedSite(targetSite);
                    }
                }
            } catch (error) {
                console.error(error);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        init();

        return () => {
            mounted = false;
        };
    }, [closedOnly, searchParams]);

    // Render site cards first. The much larger report collection is summarized in the background.
    useEffect(() => {
        if (loading || reportSummaryLoadStartedRef.current) return;
        reportSummaryLoadStartedRef.current = true;
        let mounted = true;

        const loadReportSummaries = async () => {
            try {
                const allReports = await dailyReportService.getReports();
                if (!mounted) return;

                const summaryMap: Record<string, SiteReportSummary> = {};
                allReports.forEach((report) => {
                    const key = getReportSiteKey(report.siteId, report.siteName);
                    if (!key || !report.date) return;
                    const reportManDay = (report.workers || []).reduce((sum, worker) => sum + (typeof worker.manDay === 'number' ? worker.manDay : 0), 0);
                    const existing = summaryMap[key];
                    if (!existing) {
                        summaryMap[key] = {
                            firstDate: report.date,
                            lastDate: report.date,
                            totalManDay: reportManDay,
                        };
                        return;
                    }
                    if (report.date < existing.firstDate) existing.firstDate = report.date;
                    if (report.date > existing.lastDate) existing.lastDate = report.date;
                    existing.totalManDay += reportManDay;
                });
                setSiteReportSummaryMap(summaryMap);
            } catch (error) {
                console.error('Failed to load site report summaries:', error);
            }
        };

        loadReportSummaries();
        return () => {
            mounted = false;
        };
    }, [loading]);

    useEffect(() => {
        let mounted = true;

        const loadBirdseyeFallbackPool = async () => {
            try {
                // Query the small category first instead of scanning hundreds of gallery documents.
                const { images: categoryImages } = await listGalleryImages('birdseye', 64);
                if (!mounted) return;

                let urls = categoryImages
                    .map((image) => String(image.url || '').trim())
                    .filter(Boolean);

                // Keep compatibility with older metadata that used tags instead of a category.
                if (urls.length === 0) {
                    const { images } = await listGalleryImages(undefined, 96);
                    urls = images
                        .filter((image) => {
                            if (image.category === 'birdseye') return true;
                            const tags = Array.isArray(image.tags) ? image.tags : [];
                            return tags.some((tag) => /birdseye|조감도/i.test(String(tag)));
                        })
                        .map((image) => String(image.url || '').trim())
                        .filter(Boolean);
                }

                const uniqueUrls = Array.from(new Set(urls)).slice(0, 64);
                if (uniqueUrls.length === 0) return;

                setBirdseyeUrls(uniqueUrls);
                try {
                    window.localStorage.setItem(BIRDSEYE_URL_CACHE_KEY, JSON.stringify(uniqueUrls));
                } catch {
                    // Local cache is an optional speed-up; memory state is enough for this visit.
                }
            } catch (error) {
                console.error('Failed to load birdseye fallback pool for site management:', error);
            }
        };

        loadBirdseyeFallbackPool();
        return () => {
            mounted = false;
        };
    }, []);

    const getSiteSummary = useCallback((site: Site): SiteReportSummary | null => {
        const keyById = getReportSiteKey(site.id, null);
        if (keyById && siteReportSummaryMap[keyById]) return siteReportSummaryMap[keyById];
        const keyByName = getReportSiteKey(null, site.name);
        if (keyByName && siteReportSummaryMap[keyByName]) return siteReportSummaryMap[keyByName];
        return null;
    }, [siteReportSummaryMap]);

    // Filter Logic
    useEffect(() => {
        if (!keyword.trim()) {
            setFilteredSites(sites);
            return;
        }
        const lower = keyword.toLowerCase();
        setFilteredSites(sites.filter(s =>
            s.name.toLowerCase().includes(lower) ||
            s.code.toLowerCase().includes(lower) ||
            (s.address && s.address.toLowerCase().includes(lower)) ||
            (s.responsibleTeamName && s.responsibleTeamName.toLowerCase().includes(lower)) ||
            (s.companyName && s.companyName.toLowerCase().includes(lower)) ||
            (s.constructorCompanyName && s.constructorCompanyName.toLowerCase().includes(lower)) ||
            (s.partnerName && s.partnerName.toLowerCase().includes(lower))
        ));
    }, [keyword, sites]);

    return (
        <div className="min-h-screen bg-slate-900 p-6 md:p-10 flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                        <FontAwesomeIcon icon={faBuilding} className="text-blue-500" />
                        {closedOnly ? '마감 현장 관리 시스템' : '통합 현장 관리 시스템'}
                    </h1>
                    <p className="text-slate-400 mt-2">
                        {closedOnly
                            ? '마감된 현장의 자재, 인력, 공정 현황만 모아 관리합니다.'
                            : '모든 현장의 자재, 인력, 공정 현황을 한눈에 관리하세요.'}
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full md:w-80">
                        <input
                            type="text"
                            placeholder="현장명, 코드, 주소 검색"
                            className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all shadow-lg text-white placeholder-slate-500"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                        />
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3.5 top-3.5 text-slate-500" />
                    </div>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                    현장 목록을 불러오는 중...
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
                    {filteredSites.map((site, index) => (
                        (() => {
                            const siteSummary = getSiteSummary(site);
                            const periodText = siteSummary ? `${siteSummary.firstDate} ~ ${siteSummary.lastDate}` : '- ~ -';
                            const totalManDayText = siteSummary ? siteSummary.totalManDay.toFixed(1) : '0.0';
                            const fallbackImageUrl = pickFallbackBirdseyeImage(site, birdseyeUrls);
                            const optimizedFallbackImageUrl = getOptimizedBirdseyeUrl(fallbackImageUrl);
                            const originalImageUrl = String(site.imageUrl || '').trim();
                            return (
                        <motion.div
                            key={site.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -5, transition: { duration: 0.2 } }}
                            onClick={() => setSelectedSite(site)}
                            className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden cursor-pointer group flex flex-col h-full"
                        >
                            <div className="aspect-[4/3] w-full bg-slate-700 relative overflow-hidden">
                                <SitePreviewImage
                                    siteName={site.name}
                                    originalUrl={originalImageUrl}
                                    optimizedFallbackUrl={optimizedFallbackImageUrl}
                                    fallbackUrl={fallbackImageUrl}
                                    priority={index < priorityImageCount}
                                />
                                <div className="absolute top-3 right-3">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm backdrop-blur-sm ${site.status === 'active'
                                        ? 'bg-green-500/80 text-white'
                                        : 'bg-slate-600/80 text-slate-200'
                                        }`}>
                                        {site.status === 'active' ? '진행중' : '완료/예정'}
                                    </span>
                                </div>
                            </div>

                            <div className="p-3.5 flex-1 flex flex-col">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <h3 className="text-sm font-bold text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-2 leading-5">
                                        {site.name}
                                    </h3>
                                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold whitespace-nowrap">
                                        총공수 {totalManDayText}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-500 mb-3 font-mono bg-slate-900 inline-block px-1.5 py-0.5 rounded self-start border border-slate-700">
                                    {site.code}
                                </p>

                                <div className="space-y-1.5 mt-auto">
                                    <div className="flex items-center gap-2 text-xs text-slate-400 leading-4">
                                        <div className="w-3.5 text-center text-slate-500"><FontAwesomeIcon icon={faHardHat} /></div>
                                        <span>
                                            담당팀: {site.responsibleTeamName || '미지정'}
                                            {' '}| 시공사: {getContractorDisplayName(site)}
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-2 text-xs text-slate-400 leading-4">
                                        <div className="w-3.5 mt-0.5 text-center text-slate-500"><FontAwesomeIcon icon={faMapMarkerAlt} /></div>
                                        <span className="line-clamp-2">{site.address || '주소 없음'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-400 leading-4">
                                        <div className="w-3.5 text-center text-slate-500"><FontAwesomeIcon icon={faCalendarAlt} /></div>
                                        <span>{periodText}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-800 px-3.5 py-2 border-t border-slate-700 flex justify-between items-center text-[10px] text-slate-500">
                                <span>클릭하여 상세 정보 보기</span>
                                <FontAwesomeIcon icon={faChartPie} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
                            </div>
                        </motion.div>
                            );
                        })()
                    ))}
                </div>
            )}

            {/* Modal */}
            <AnimatePresence>
                {selectedSite && (
                    <SiteDetailModal site={selectedSite} onClose={() => setSelectedSite(null)} />
                )}
            </AnimatePresence>
        </div>
    );
};

export const SiteManagementPage: React.FC = () => {
    return <SiteManagementPageBase />;
};

export const ClosedSiteManagementPage: React.FC = () => {
    return <SiteManagementPageBase closedOnly />;
};

export default SiteManagementPage;
