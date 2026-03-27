import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { teamService, Team } from '../../services/teamService';
import { companyService, Company } from '../../services/companyService';
import { manpowerService } from '../../services/manpowerService';
import { dailyReportService, DailyReport, DailyReportWorker } from '../../services/dailyReportService';
import materialService from '../../services/materialService';
import { userService } from '../../services/userService';
import { useAuth } from '../../contexts/AuthContext';
import { InboundTransaction, OutboundTransaction } from '../../types/materials';

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

const getReportSiteKey = (siteId?: string | null, siteName?: string | null): string => {
    const id = String(siteId || '').trim();
    if (id) return `id:${id}`;
    const name = String(siteName || '').trim();
    if (name) return `name:${name}`;
    return '';
};

const includesCheongyeonKeyword = (value: string | null | undefined) => (
    String(value || '').trim().toLowerCase().includes('청연')
);

const findResponsibleTeam = (site: Site, teams: Team[]) => {
    const normalize = (value: string | null | undefined) => String(value || '').trim().toLowerCase();
    const responsibleTeamId = String(site.responsibleTeamId || '').trim();
    const responsibleTeamName = normalize(site.responsibleTeamName);

    return teams.find((team) => {
        const teamId = String(team.id || '').trim();
        const teamLegacyId = String(team.legacyId || '').trim();
        const teamName = normalize(team.name);
        return (responsibleTeamId && (teamId === responsibleTeamId || teamLegacyId === responsibleTeamId))
            || (responsibleTeamName && teamName === responsibleTeamName);
    });
};

const resolveTeamCompanyName = (team: Team | undefined, companies: Company[]) => {
    if (!team) return '';
    const rawCompanyId = String(team.companyId || '').trim();
    const linkedCompany = rawCompanyId
        ? companies.find((company) => company.id === rawCompanyId || company.legacyId === rawCompanyId)
        : null;

    return String(linkedCompany?.name || team.companyName || '').trim();
};

const hasCheongyeonResponsibleTeam = (site: Site, teams: Team[], companies: Company[]) => {
    const responsibleTeam = findResponsibleTeam(site, teams);
    return includesCheongyeonKeyword(resolveTeamCompanyName(responsibleTeam, companies));
};

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

export const SiteManagementPage: React.FC = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [sites, setSites] = useState<Site[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [filteredSites, setFilteredSites] = useState<Site[]>([]);
    const [keyword, setKeyword] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedSite, setSelectedSite] = useState<Site | null>(null);
    const [siteReportSummaryMap, setSiteReportSummaryMap] = useState<Record<string, SiteReportSummary>>({});

    // Permission States
    const [userTeams, setUserTeams] = useState<any[]>([]);
    const [isRestricted, setIsRestricted] = useState(false);

    // Initial Load & Query Param Handling
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                // 1. Fetch User Data & Team Affiliation
                if (currentUser) {
                    const userData = await userService.getUser(currentUser.uid);
                    if (userData && userData.role !== 'admin' && userData.role !== '사장') {
                        const { teamService } = await import('../../services/teamService');
                        const { manpowerService } = await import('../../services/manpowerService');
                        
                        const linkedWorkerIds = userData.linkedWorkerIds || [];
                        const userWorkers = await Promise.all(
                            linkedWorkerIds.map(id => manpowerService.getWorker(id))
                        );
                        
                        const teamIds = Array.from(new Set(userWorkers.map(w => w?.teamId).filter(Boolean)));
                        const fetchedTeams = await Promise.all(
                            teamIds.map(id => teamService.getTeam(id as string))
                        );
                        
                        const validTeams = fetchedTeams.filter(Boolean);
                        setUserTeams(validTeams);
                        
                        // Check if any team belongs to '청연'
                        const allCompanies = await companyService.getCompanies();
                        const cheongyeonAffiliation = validTeams.some(t => 
                            includesCheongyeonKeyword(resolveTeamCompanyName(t as Team, allCompanies)) ||
                            includesCheongyeonKeyword(t?.name) ||
                            includesCheongyeonKeyword(userData.department)
                        );
                        
                        if (cheongyeonAffiliation) {
                            setIsRestricted(true);
                        }
                    }
                }

                // 2. Fetch Sites & Reports
                const [data, allReports, allTeams, allCompanies] = await Promise.all([
                    siteService.getSites(),
                    dailyReportService.getReports(),
                    teamService.getTeams(),
                    companyService.getCompanies(),
                ]);
                setSites(data);
                setTeams(allTeams);
                setCompanies(allCompanies);
                setFilteredSites(data);

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

                // Auto-open modal if siteId is present in URL
                const targetSiteId = searchParams.get('siteId');
                if (targetSiteId) {
                    const targetSite = data.find(
                        (site) => site.id === targetSiteId && hasCheongyeonResponsibleTeam(site, allTeams, allCompanies)
                    );
                    if (targetSite) {
                        setSelectedSite(targetSite);
                    }
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [searchParams, currentUser]);

    const getSiteSummary = useCallback((site: Site): SiteReportSummary | null => {
        const keyById = getReportSiteKey(site.id, null);
        if (keyById && siteReportSummaryMap[keyById]) return siteReportSummaryMap[keyById];
        const keyByName = getReportSiteKey(null, site.name);
        if (keyByName && siteReportSummaryMap[keyByName]) return siteReportSummaryMap[keyByName];
        return null;
    }, [siteReportSummaryMap]);

    // Filter Logic
    useEffect(() => {
        let baseSites = sites.filter((site) => hasCheongyeonResponsibleTeam(site, teams, companies));

        // Apply Restriction Filter
        if (isRestricted) {
            const allowedTeamIds = userTeams.map(t => t.id);
            baseSites = baseSites.filter(s => allowedTeamIds.includes(s.responsibleTeamId));
        }

        const lower = keyword.toLowerCase().trim();
        if (!lower) {
            setFilteredSites(baseSites);
            return;
        }

        setFilteredSites(baseSites.filter(s =>
            s.name.toLowerCase().includes(lower) ||
            s.code.toLowerCase().includes(lower) ||
            (s.address && s.address.toLowerCase().includes(lower)) ||
            (s.responsibleTeamName && s.responsibleTeamName.toLowerCase().includes(lower)) ||
            (s.companyName && s.companyName.toLowerCase().includes(lower)) ||
            (s.constructorCompanyName && s.constructorCompanyName.toLowerCase().includes(lower)) ||
            (s.partnerName && s.partnerName.toLowerCase().includes(lower))
        ));
    }, [companies, keyword, sites, isRestricted, teams, userTeams]);

    return (
        <div className="min-h-screen bg-slate-900 p-6 md:p-10 flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                        <FontAwesomeIcon icon={faBuilding} className="text-blue-500" />
                        통합 현장 관리 시스템
                    </h1>
                    <p className="text-slate-400 mt-2">
                        {isRestricted 
                            ? "본인 담당 팀의 현장 현황을 조회할 수 있습니다."
                            : "모든 현장의 자재, 인력, 공정 현황을 한눈에 관리하세요."}
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
                <>
                    {filteredSites.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-20">
                            <div className="text-4xl mb-4">🔍</div>
                            <p>검색 결과가 없거나 접근 가능한 현장이 없습니다.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredSites.map(site => (
                                (() => {
                                    const siteSummary = getSiteSummary(site);
                                    const periodText = siteSummary ? `${siteSummary.firstDate} ~ ${siteSummary.lastDate}` : '- ~ -';
                                    const totalManDayText = siteSummary ? siteSummary.totalManDay.toFixed(1) : '0.0';
                                    return (
                                <motion.div
                                    key={site.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    whileHover={{ y: -5, transition: { duration: 0.2 } }}
                                    onClick={() => setSelectedSite(site)}
                                    className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 overflow-hidden cursor-pointer group flex flex-col h-full"
                                >
                                    <div className="aspect-square w-full bg-slate-700 relative overflow-hidden">
                                        {site.imageUrl ? (
                                            <img src={site.imageUrl} alt={site.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-600">
                                                <FontAwesomeIcon icon={faBuilding} size="3x" />
                                            </div>
                                        )}
                                        <div className="absolute top-3 right-3">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-sm ${site.status === 'active'
                                                ? 'bg-green-500/80 text-white'
                                                : 'bg-slate-600/80 text-slate-200'
                                                }`}>
                                                {site.status === 'active' ? '진행중' : '완료/예정'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="p-5 flex-1 flex flex-col">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <h3 className="text-lg font-bold text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-1">
                                                {site.name}
                                            </h3>
                                            <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold whitespace-nowrap">
                                                총공수 {totalManDayText}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mb-4 font-mono bg-slate-900 inline-block px-1.5 py-0.5 rounded self-start border border-slate-700">
                                            {site.code}
                                        </p>

                                        <div className="space-y-2 mt-auto">
                                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                                <div className="w-4 text-center text-slate-500"><FontAwesomeIcon icon={faHardHat} /></div>
                                                <span>담당팀: {site.responsibleTeamName || '미지정'}</span>
                                            </div>
                                            <div className="flex items-start gap-2 text-sm text-slate-400">
                                                <div className="w-4 mt-0.5 text-center text-slate-500"><FontAwesomeIcon icon={faMapMarkerAlt} /></div>
                                                <span className="line-clamp-2">{site.address || '주소 없음'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                                <div className="w-4 text-center text-slate-500"><FontAwesomeIcon icon={faCalendarAlt} /></div>
                                                <span>{periodText}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-800 px-5 py-3 border-t border-slate-700 flex justify-between items-center text-xs text-slate-500">
                                        <span>클릭하여 상세 정보 보기</span>
                                        <FontAwesomeIcon icon={faChartPie} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
                                    </div>
                                </motion.div>
                                    );
                                })()
                            ))}
                        </div>
                    )}
                </>
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

export default SiteManagementPage;
