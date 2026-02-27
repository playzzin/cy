import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChartPie,
    faUsers,
    faCoins,
    faCalendarAlt,
    faTrophy,
    faLayerGroup,
    faHardHat,
    faBuilding,
    faHandshake,
    faChevronLeft,
    faChevronRight,
    faArrowRight,
    faPercent,
    faTimes,
    faRobot,
    faPaperPlane,
    faCopy,
    faCheck,
    faBolt,
    faArrowUp,
    faArrowDown,
    faSync
} from '@fortawesome/free-solid-svg-icons';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, getDay, getDaysInMonth, isSameMonth, startOfWeek, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
    manpowerAnalyticsService,
    ManpowerStats,
    TeamManpowerSummary,
    SiteManpowerSummary,
    WorkerManpowerSummary,
    DailySummary,
    SupportAnalysis
} from '../../services/manpowerAnalyticsService';
import { analyzeWithAI, EXAMPLE_QUESTIONS, AnalyticsResult, ChatMessage, AnalyticsDebug } from '../../services/geminiAnalyticsService';
import { AiResultCharts } from './components/AiResultCharts';

// --- Types & Interfaces ---

interface DateRange {
    startDate: string;
    endDate: string;
}

type TabId = 'dashboard' | 'calendar' | 'team' | 'site' | 'worker' | 'support' | 'ai';

// --- Animation Variants ---

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.05 }
    }
};

const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { type: "spring", stiffness: 300, damping: 30 }
    }
};

// --- Sub-Components ---

const StatCard = ({ title, value, unit, icon, color, delay }: { title: string, value: string, unit: string, icon: any, color: string, delay: number }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className="relative overflow-hidden p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm group hover:bg-slate-800/80 transition-all duration-300"
    >
        <div className={`absolute top-0 right-0 w-24 h-24 bg-${color}-500/10 rounded-full blur-2xl -mr-6 -mt-6 transition-opacity opacity-50 group-hover:opacity-100`} />
        <div className="relative z-10 flex justify-between items-start">
            <div>
                <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-white tracking-tight">
                    {value} <span className="text-lg text-slate-500 font-normal ml-1">{unit}</span>
                </h3>
            </div>
            <div className={`w-12 h-12 rounded-xl bg-${color}-500/20 flex items-center justify-center text-${color}-400 group-hover:scale-110 transition-transform`}>
                <FontAwesomeIcon icon={icon} className="text-xl" />
            </div>
        </div>
    </motion.div>
);

const RankingItem = ({ rank, name, value, subValue, max, color }: { rank: number, name: string, value: string, subValue: string, max: number, color: string }) => {
    let numericValue = 0;
    if (typeof value === 'string') {
        numericValue = parseFloat(value.replace(/,/g, '').replace(/[^0-9.]/g, ''));
    } else {
        numericValue = Number(value);
    }
    const safeMax = max > 0 ? max : 1;
    const percentage = Math.min(100, (numericValue / safeMax) * 100);

    return (
        <motion.div
            variants={itemVariants}
            className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-700/50 group"
        >
            <div className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm ${rank <= 3 ? `bg-${color}-500/20 text-${color}-400` : 'bg-slate-700/50 text-slate-400'}`}>
                {rank}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-slate-200 font-medium truncate">{name}</span>
                    <div className="text-right">
                        <span className="text-white font-bold block">{value}</span>
                        <span className="text-xs text-slate-500">{subValue}</span>
                    </div>
                </div>
                <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full rounded-full bg-gradient-to-r from-${color}-600 to-${color}-400 opacity-80 group-hover:opacity-100`}
                    />
                </div>
            </div>
        </motion.div>
    );
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900/90 border border-slate-700 p-3 rounded-lg shadow-xl backdrop-blur-md">
                <p className="text-slate-300 text-xs mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-slate-400">{entry.name}:</span>
                        <span className="text-white font-bold">
                            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const AiSkeletonLoader = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3 w-full max-w-3xl">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-1">
            <FontAwesomeIcon icon={faRobot} className="text-sm text-indigo-400 animate-pulse" />
        </div>
        <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="text-sm text-slate-400 ml-2">데이터를 분석하고 차트를 생성중입니다...</span>
            </div>
            <div className="h-64 bg-slate-800/30 rounded-xl border border-slate-700/30 animate-pulse" />
            <div className="space-y-2">
                <div className="h-3 bg-slate-800/30 rounded w-full animate-pulse" />
                <div className="h-3 bg-slate-800/30 rounded w-5/6 animate-pulse" />
            </div>
        </div>
    </motion.div>
);

// --- Calendar Components ---

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const CHART_COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];

interface CalendarCellData {
    date: Date;
    dateStr: string;
    isCurrentMonth: boolean;
    summary: DailySummary | null;
}

const CalendarView: React.FC<{
    dailySummaries: DailySummary[];
    formatCurrency: (val: number) => string;
}> = ({ dailySummaries, formatCurrency }) => {
    const [calMonth, setCalMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    const summaryMap = useMemo(() => {
        const map = new Map<string, DailySummary>();
        dailySummaries.forEach(s => map.set(s.date, s));
        return map;
    }, [dailySummaries]);

    const maxManDay = useMemo(() => {
        return dailySummaries.reduce((max, s) => Math.max(max, s.totalManDay), 0);
    }, [dailySummaries]);

    const calendarCells = useMemo((): CalendarCellData[][] => {
        const monthStart = startOfMonth(calMonth);
        const weekStart = startOfWeek(monthStart, { weekStartsOn: 0 });
        const rows: CalendarCellData[][] = [];
        let current = weekStart;

        for (let week = 0; week < 6; week++) {
            const row: CalendarCellData[] = [];
            for (let day = 0; day < 7; day++) {
                const dateStr = format(current, 'yyyy-MM-dd');
                row.push({
                    date: current,
                    dateStr,
                    isCurrentMonth: isSameMonth(current, calMonth),
                    summary: summaryMap.get(dateStr) || null
                });
                current = addDays(current, 1);
            }
            rows.push(row);
            if (week >= 4 && !row.some(c => c.isCurrentMonth)) break;
        }
        return rows;
    }, [calMonth, summaryMap]);

    const selectedSummary = selectedDate ? summaryMap.get(selectedDate) : null;

    const getHeatColor = (manDay: number): string => {
        if (manDay === 0 || maxManDay === 0) return '';
        const intensity = Math.min(1, manDay / maxManDay);
        if (intensity < 0.2) return 'bg-cyan-500/10';
        if (intensity < 0.4) return 'bg-cyan-500/20';
        if (intensity < 0.6) return 'bg-cyan-500/30';
        if (intensity < 0.8) return 'bg-cyan-500/40';
        return 'bg-cyan-500/50';
    };

    return (
        <div className="space-y-6">
            {/* Month Navigation */}
            <motion.div variants={itemVariants} className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => setCalMonth(subMonths(calMonth, 1))}
                        className="w-10 h-10 rounded-xl bg-slate-700/50 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                    >
                        <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                    <h3 className="text-xl font-bold text-white">
                        {format(calMonth, 'yyyy년 M월', { locale: ko })}
                    </h3>
                    <button
                        onClick={() => setCalMonth(addMonths(calMonth, 1))}
                        className="w-10 h-10 rounded-xl bg-slate-700/50 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                    >
                        <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                </div>

                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                    {WEEKDAYS.map((d, i) => (
                        <div key={d} className={`text-center text-xs font-bold py-2 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-500'}`}>
                            {d}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="space-y-1">
                    {calendarCells.map((week, wi) => (
                        <div key={wi} className="grid grid-cols-7 gap-1">
                            {week.map((cell) => {
                                const dayOfWeek = getDay(cell.date);
                                const hasSummary = cell.summary && cell.summary.totalManDay > 0;
                                const isSelected = selectedDate === cell.dateStr;

                                return (
                                    <button
                                        key={cell.dateStr}
                                        onClick={() => hasSummary ? setSelectedDate(isSelected ? null : cell.dateStr) : undefined}
                                        className={`
                                            relative min-h-[80px] p-2 rounded-xl border transition-all text-left
                                            ${!cell.isCurrentMonth ? 'opacity-30' : ''}
                                            ${isSelected ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700/30 hover:border-slate-600/50'}
                                            ${hasSummary ? 'cursor-pointer' : 'cursor-default'}
                                            ${hasSummary ? getHeatColor(cell.summary!.totalManDay) : 'bg-slate-800/30'}
                                        `}
                                    >
                                        <div className={`text-xs font-bold mb-1 ${dayOfWeek === 0 ? 'text-red-400' : dayOfWeek === 6 ? 'text-blue-400' : 'text-slate-400'}`}>
                                            {format(cell.date, 'd')}
                                        </div>
                                        {hasSummary && (
                                            <div className="space-y-0.5">
                                                <div className="text-[11px] text-cyan-400 font-bold">
                                                    {cell.summary!.totalManDay.toFixed(1)}공수
                                                </div>
                                                <div className="text-[10px] text-slate-500">
                                                    {cell.summary!.workerCount}명
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Selected Date Detail */}
            <AnimatePresence>
                {selectedSummary && selectedDate && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-slate-800/50 p-6 rounded-2xl border border-cyan-500/30"
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                <div className="w-1 h-5 bg-cyan-500 rounded-full" />
                                {format(new Date(selectedDate), 'yyyy년 M월 d일 (EEEE)', { locale: ko })} 상세
                            </h4>
                            <button onClick={() => setSelectedDate(null)} className="text-slate-500 hover:text-white transition-colors">
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>

                        {/* KPI Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-700/30">
                                <div className="text-xs text-slate-500 mb-1">총 공수</div>
                                <div className="text-lg font-bold text-cyan-400">{selectedSummary.totalManDay.toFixed(1)}</div>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-700/30">
                                <div className="text-xs text-slate-500 mb-1">투입 인원</div>
                                <div className="text-lg font-bold text-emerald-400">{selectedSummary.workerCount}명</div>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-700/30">
                                <div className="text-xs text-slate-500 mb-1">총 금액</div>
                                <div className="text-lg font-bold text-indigo-400">{formatCurrency(selectedSummary.totalAmount)}</div>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-700/30">
                                <div className="text-xs text-slate-500 mb-1">팀 / 현장</div>
                                <div className="text-lg font-bold text-amber-400">{selectedSummary.teamCount} / {selectedSummary.siteCount}</div>
                            </div>
                        </div>

                        {/* Team & Site Breakdown */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h5 className="text-sm font-bold text-slate-400 mb-3">팀별 투입</h5>
                                <div className="space-y-2">
                                    {selectedSummary.teams.map((t, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/30">
                                            <span className="text-sm text-slate-300">{t.teamName}</span>
                                            <div className="text-right">
                                                <span className="text-sm font-bold text-cyan-400">{t.manDay.toFixed(1)}</span>
                                                <span className="text-xs text-slate-600 ml-2">{t.workerCount}명</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h5 className="text-sm font-bold text-slate-400 mb-3">현장별 투입</h5>
                                <div className="space-y-2">
                                    {selectedSummary.sites.map((s, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/30">
                                            <span className="text-sm text-slate-300 truncate mr-2">{s.siteName}</span>
                                            <div className="text-right flex-shrink-0">
                                                <span className="text-sm font-bold text-indigo-400">{s.manDay.toFixed(1)}</span>
                                                <span className="text-xs text-slate-600 ml-2">{s.workerCount}명</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- Support Analysis Components ---

const SupportView: React.FC<{
    supportData: SupportAnalysis | null;
    formatCurrency: (val: number) => string;
    formatNumber: (num: number) => string;
}> = ({ supportData, formatCurrency, formatNumber }) => {
    if (!supportData) return <p className="text-center text-slate-500 py-12">지원팀 데이터가 없습니다.</p>;

    const hasSupportData = supportData.totalSupportManDay > 0;

    return (
        <div className="space-y-6">
            {/* Support KPI Cards */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/50">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                            <FontAwesomeIcon icon={faHandshake} />
                        </div>
                        <span className="text-sm text-slate-400">지원 총 공수</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{supportData.totalSupportManDay.toFixed(1)} <span className="text-sm text-slate-500">공수</span></div>
                </div>
                <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/50">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400">
                            <FontAwesomeIcon icon={faCoins} />
                        </div>
                        <span className="text-sm text-slate-400">지원 총 금액</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{formatCurrency(supportData.totalSupportAmount)} <span className="text-sm text-slate-500">원</span></div>
                </div>
                <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/50">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-400">
                            <FontAwesomeIcon icon={faUsers} />
                        </div>
                        <span className="text-sm text-slate-400">지원 인원</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{supportData.totalSupportWorkers} <span className="text-sm text-slate-500">명</span></div>
                </div>
                <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/50">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400">
                            <FontAwesomeIcon icon={faPercent} />
                        </div>
                        <span className="text-sm text-slate-400">전체 대비 비율</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{supportData.supportRatio.toFixed(1)} <span className="text-sm text-slate-500">%</span></div>
                </div>
            </motion.div>

            {!hasSupportData ? (
                <motion.div variants={itemVariants} className="bg-slate-800/50 p-12 rounded-2xl border border-slate-700/50 text-center">
                    <FontAwesomeIcon icon={faHandshake} className="text-4xl text-slate-600 mb-4" />
                    <p className="text-slate-400 text-lg">선택한 기간에 지원팀 데이터가 없습니다.</p>
                    <p className="text-slate-600 text-sm mt-2">작업자의 급여방식(salaryModel)이 '지원팀' 또는 '용역팀'인 데이터를 분석합니다.</p>
                </motion.div>
            ) : (
                <>
                    {/* Support Daily Trend */}
                    <motion.div variants={itemVariants} className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <div className="w-1 h-5 bg-amber-500 rounded-full" />
                            지원 vs 일반 공수 추이
                        </h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={supportData.dailyTrend}>
                                    <defs>
                                        <linearGradient id="colorSupport" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorNormal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#64748b"
                                        tickFormatter={(str) => { try { return format(new Date(str), 'MM.dd'); } catch { return str; } }}
                                        fontSize={12}
                                    />
                                    <YAxis stroke="#64748b" fontSize={12} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <Area type="monotone" dataKey="normalManDay" name="일반 공수" stroke="#06b6d4" fillOpacity={1} fill="url(#colorNormal)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="supportManDay" name="지원 공수" stroke="#f59e0b" fillOpacity={1} fill="url(#colorSupport)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    {/* Team Support Summary & Support Flows */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Team Support Summary */}
                        <motion.div variants={itemVariants} className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <div className="w-1 h-5 bg-orange-500 rounded-full" />
                                팀별 지원 현황
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-slate-400 text-xs border-b border-slate-700">
                                            <th className="p-2">팀명</th>
                                            <th className="p-2 text-right">지원 공수</th>
                                            <th className="p-2 text-right">지원 금액</th>
                                            <th className="p-2 text-right">인원</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {supportData.teamSummaries.map((ts, idx) => (
                                            <tr key={idx} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                                                <td className="p-2 text-sm font-medium text-white">{ts.teamName}</td>
                                                <td className="p-2 text-sm text-right text-amber-400 font-bold">{ts.sentManDay.toFixed(1)}</td>
                                                <td className="p-2 text-sm text-right text-slate-300">{formatCurrency(ts.sentAmount)}</td>
                                                <td className="p-2 text-sm text-right text-slate-400">{ts.sentWorkerCount}명</td>
                                            </tr>
                                        ))}
                                        {supportData.teamSummaries.length === 0 && (
                                            <tr><td colSpan={4} className="text-center p-6 text-slate-600">데이터 없음</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>

                        {/* Support Flow (Team -> Site) */}
                        <motion.div variants={itemVariants} className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <div className="w-1 h-5 bg-pink-500 rounded-full" />
                                지원 흐름 (팀 → 현장)
                            </h3>
                            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                                {supportData.flows.slice(0, 20).map((flow, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-3 rounded-xl bg-slate-900/30 border border-slate-700/20">
                                        <div className="flex-shrink-0">
                                            <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg">{flow.fromTeamName}</span>
                                        </div>
                                        <FontAwesomeIcon icon={faArrowRight} className="text-slate-600 text-xs flex-shrink-0" />
                                        <div className="flex-shrink-0">
                                            <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg truncate max-w-[120px] inline-block">{flow.toSiteName || '미지정'}</span>
                                        </div>
                                        <div className="ml-auto text-right flex-shrink-0">
                                            <div className="text-xs text-white font-bold">{flow.workerName}</div>
                                            <div className="text-[10px] text-slate-500">{flow.totalManDay.toFixed(1)}공수 / {flow.dates.length}일</div>
                                        </div>
                                    </div>
                                ))}
                                {supportData.flows.length === 0 && (
                                    <p className="text-center text-slate-600 py-6">지원 흐름 데이터 없음</p>
                                )}
                            </div>
                        </motion.div>
                    </div>

                    {/* Support Workers Table */}
                    <motion.div variants={itemVariants} className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 overflow-hidden">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <div className="w-1 h-5 bg-rose-500 rounded-full" />
                            지원 작업자 상세
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-slate-400 text-sm border-b border-slate-700">
                                        <th className="p-3">순위</th>
                                        <th className="p-3">성명</th>
                                        <th className="p-3">급여방식</th>
                                        <th className="p-3 text-right">총 공수</th>
                                        <th className="p-3 text-right">근무 일수</th>
                                        <th className="p-3 text-right">총 금액</th>
                                        <th className="p-3">소속팀</th>
                                        <th className="p-3">투입 현장</th>
                                    </tr>
                                </thead>
                                <tbody className="text-slate-300">
                                    {supportData.supportWorkers.map((sw, idx) => (
                                        <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                                            <td className="p-3 font-medium text-slate-500">{idx + 1}</td>
                                            <td className="p-3 font-bold text-white">{sw.workerName}</td>
                                            <td className="p-3">
                                                <span className="text-xs px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400">{sw.salaryModel}</span>
                                            </td>
                                            <td className="p-3 text-right font-bold text-amber-400">{sw.totalManDay.toFixed(1)}</td>
                                            <td className="p-3 text-right">{sw.workDays}일</td>
                                            <td className="p-3 text-right">{formatCurrency(sw.totalAmount)}</td>
                                            <td className="p-3 text-xs text-slate-500 truncate max-w-[120px]">{sw.teams.join(', ')}</td>
                                            <td className="p-3 text-xs text-slate-500 truncate max-w-[150px]">{sw.sites.join(', ')}</td>
                                        </tr>
                                    ))}
                                    {supportData.supportWorkers.length === 0 && (
                                        <tr><td colSpan={8} className="text-center p-8 text-slate-500">지원 작업자 데이터가 없습니다.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                </>
            )}
        </div>
    );
};

// --- AI Analytics Components ---

/** Renders the appropriate aggregated table based on analysisType */
const AiAggregatedTable: React.FC<{
    result: AnalyticsResult;
    formatCurrency: (val: number) => string;
}> = ({ result, formatCurrency }) => {
    const type = result.query.analysisType;

    // Team Summary
    if ((type === 'team_summary' || type === 'general') && result.teamAgg.length > 0) {
        return (
            <div className="bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
                <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700/30">
                    <span className="text-sm font-bold text-white">팀별 공수 순위</span>
                    <span className="text-xs text-slate-500 ml-2">{result.teamAgg.length}개 팀</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead><tr className="text-slate-500 text-xs border-b border-slate-700/30">
                            <th className="px-4 py-2">순위</th><th className="px-4 py-2">팀명</th>
                            <th className="px-4 py-2 text-right">총 공수</th><th className="px-4 py-2 text-right">인원</th>
                            <th className="px-4 py-2 text-right">총 금액</th><th className="px-4 py-2 text-right">가동일</th>
                            <th className="px-4 py-2 text-right">일평균</th>
                        </tr></thead>
                        <tbody>{result.teamAgg.map((t, i) => (
                            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                <td className="px-4 py-2 text-xs text-slate-600">{i + 1}</td>
                                <td className="px-4 py-2 text-sm font-medium text-white">{t.teamName}</td>
                                <td className="px-4 py-2 text-sm text-right font-bold text-cyan-400">{t.totalManDay.toFixed(1)}</td>
                                <td className="px-4 py-2 text-sm text-right text-slate-300">{t.workerCount}명</td>
                                <td className="px-4 py-2 text-sm text-right text-amber-400">{formatCurrency(t.totalAmount)}</td>
                                <td className="px-4 py-2 text-sm text-right text-slate-400">{t.days}일</td>
                                <td className="px-4 py-2 text-sm text-right text-slate-400">{t.avgDailyManDay.toFixed(1)}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </div>
        );
    }

    // Site Summary
    if (type === 'site_summary' && result.siteAgg.length > 0) {
        return (
            <div className="bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
                <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700/30">
                    <span className="text-sm font-bold text-white">현장별 공수 현황</span>
                    <span className="text-xs text-slate-500 ml-2">{result.siteAgg.length}개 현장</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead><tr className="text-slate-500 text-xs border-b border-slate-700/30">
                            <th className="px-4 py-2">순위</th><th className="px-4 py-2">현장명</th>
                            <th className="px-4 py-2 text-right">총 공수</th><th className="px-4 py-2 text-right">인원</th>
                            <th className="px-4 py-2 text-right">팀 수</th><th className="px-4 py-2 text-right">총 금액</th>
                            <th className="px-4 py-2 text-right">가동일</th>
                        </tr></thead>
                        <tbody>{result.siteAgg.map((s, i) => (
                            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                <td className="px-4 py-2 text-xs text-slate-600">{i + 1}</td>
                                <td className="px-4 py-2 text-sm font-medium text-white">{s.siteName}</td>
                                <td className="px-4 py-2 text-sm text-right font-bold text-indigo-400">{s.totalManDay.toFixed(1)}</td>
                                <td className="px-4 py-2 text-sm text-right text-slate-300">{s.workerCount}명</td>
                                <td className="px-4 py-2 text-sm text-right text-slate-400">{s.teamCount}팀</td>
                                <td className="px-4 py-2 text-sm text-right text-amber-400">{formatCurrency(s.totalAmount)}</td>
                                <td className="px-4 py-2 text-sm text-right text-slate-400">{s.days}일</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </div>
        );
    }

    // Worker Ranking / Detail
    if ((type === 'worker_ranking' || type === 'worker_detail') && result.workerAgg.length > 0) {
        return (
            <div className="bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
                <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700/30">
                    <span className="text-sm font-bold text-white">작업자별 공수</span>
                    <span className="text-xs text-slate-500 ml-2">{result.workerAgg.length}명</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead><tr className="text-slate-500 text-xs border-b border-slate-700/30">
                            <th className="px-4 py-2">순위</th><th className="px-4 py-2">이름</th>
                            <th className="px-4 py-2 text-right">총 공수</th><th className="px-4 py-2 text-right">근무일</th>
                            <th className="px-4 py-2 text-right">총 금액</th><th className="px-4 py-2">급여방식</th>
                            <th className="px-4 py-2">소속팀</th><th className="px-4 py-2">투입현장</th>
                        </tr></thead>
                        <tbody>{result.workerAgg.map((w, i) => (
                            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                <td className="px-4 py-2 text-xs text-slate-600">{i + 1}</td>
                                <td className="px-4 py-2 text-sm font-medium text-white">{w.name}</td>
                                <td className="px-4 py-2 text-sm text-right font-bold text-emerald-400">{w.totalManDay.toFixed(1)}</td>
                                <td className="px-4 py-2 text-sm text-right text-slate-300">{w.workDays}일</td>
                                <td className="px-4 py-2 text-sm text-right text-amber-400">{formatCurrency(w.totalAmount)}</td>
                                <td className="px-4 py-2 text-xs text-slate-500">{w.salaryModel || '-'}</td>
                                <td className="px-4 py-2 text-xs text-slate-500 truncate max-w-[100px]">{w.teams.join(', ')}</td>
                                <td className="px-4 py-2 text-xs text-slate-500 truncate max-w-[120px]">{w.sites.join(', ')}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </div>
        );
    }

    // Daily Summary
    if (type === 'daily_summary' && result.dailyAgg.length > 0) {
        return (
            <div className="bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
                <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700/30">
                    <span className="text-sm font-bold text-white">일별 현황</span>
                    <span className="text-xs text-slate-500 ml-2">{result.dailyAgg.length}일</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead><tr className="text-slate-500 text-xs border-b border-slate-700/30">
                            <th className="px-4 py-2">날짜</th><th className="px-4 py-2 text-right">총 공수</th>
                            <th className="px-4 py-2 text-right">인원</th><th className="px-4 py-2 text-right">팀</th>
                            <th className="px-4 py-2 text-right">현장</th><th className="px-4 py-2 text-right">총 금액</th>
                        </tr></thead>
                        <tbody>{result.dailyAgg.map((d, i) => (
                            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                <td className="px-4 py-2 text-sm font-medium text-white">{d.date}</td>
                                <td className="px-4 py-2 text-sm text-right font-bold text-cyan-400">{d.totalManDay.toFixed(1)}</td>
                                <td className="px-4 py-2 text-sm text-right text-slate-300">{d.workerCount}명</td>
                                <td className="px-4 py-2 text-sm text-right text-slate-400">{d.teamCount}팀</td>
                                <td className="px-4 py-2 text-sm text-right text-slate-400">{d.siteCount}현장</td>
                                <td className="px-4 py-2 text-sm text-right text-amber-400">{formatCurrency(d.totalAmount)}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </div>
        );
    }

    // Salary Model / Support
    if ((type === 'salary_model_analysis' || type === 'support_analysis') && result.salaryModelAgg.length > 0) {
        return (
            <div className="bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
                <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700/30">
                    <span className="text-sm font-bold text-white">급여방식별 현황</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead><tr className="text-slate-500 text-xs border-b border-slate-700/30">
                            <th className="px-4 py-2">급여방식</th><th className="px-4 py-2 text-right">총 공수</th>
                            <th className="px-4 py-2 text-right">인원</th><th className="px-4 py-2 text-right">총 금액</th>
                        </tr></thead>
                        <tbody>{result.salaryModelAgg.map((s, i) => (
                            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                <td className="px-4 py-2 text-sm font-medium text-white">
                                    <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-xs">{s.salaryModel}</span>
                                </td>
                                <td className="px-4 py-2 text-sm text-right font-bold text-cyan-400">{s.totalManDay.toFixed(1)}</td>
                                <td className="px-4 py-2 text-sm text-right text-slate-300">{s.workerCount}명</td>
                                <td className="px-4 py-2 text-sm text-right text-amber-400">{formatCurrency(s.totalAmount)}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </div>
        );
    }

    // Fallback: show team summary for general if available
    if (result.teamAgg.length > 0) {
        return <AiAggregatedTable result={{ ...result, query: { ...result.query, analysisType: 'team_summary' } }} formatCurrency={formatCurrency} />;
    }

    return <p className="text-center text-slate-500 py-4">조건에 맞는 데이터가 없습니다.</p>;
};

/** Detail view showing raw worker rows (expandable) */
const AiDetailTable: React.FC<{
    result: AnalyticsResult;
    formatCurrency: (val: number) => string;
}> = ({ result, formatCurrency }) => {
    if (result.detailRows.length === 0) return null;

    return (
        <div className="space-y-3">
            {result.detailRows.map((row, ri) => (
                <div key={ri} className="bg-slate-900/40 rounded-lg border border-slate-700/20 overflow-hidden">
                    <div className="px-3 py-2 bg-slate-800/60 border-b border-slate-700/20 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">{row.date}</span>
                        {row.siteName && <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{row.siteName}</span>}
                        {row.teamName && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">{row.teamName}</span>}
                        <span className="ml-auto text-[10px] text-slate-500">{row.workerCount}명 · {row.totalManDay.toFixed(1)}공수</span>
                    </div>
                    <table className="w-full text-left border-collapse">
                        <tbody>{row.workers.map((w, wi) => (
                            <tr key={wi} className="border-b border-slate-800/30 last:border-0">
                                <td className="px-3 py-1.5 text-xs text-white">{w.name}</td>
                                <td className="px-3 py-1.5 text-xs text-slate-500">{w.role || '-'}</td>
                                <td className="px-3 py-1.5 text-xs text-right text-cyan-400 font-bold">{w.manDay.toFixed(1)}</td>
                                <td className="px-3 py-1.5 text-xs text-right text-slate-400">{formatCurrency(w.unitPrice)}</td>
                                <td className="px-3 py-1.5 text-xs text-right text-amber-400">{formatCurrency(w.amount)}</td>
                                <td className="px-3 py-1.5 text-[10px] text-slate-600">{w.salaryModel || w.payType || ''}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            ))}
        </div>
    );
};

/** Comparison table: current vs previous period */
const AiComparisonTable: React.FC<{
    result: AnalyticsResult;
    formatCurrency: (val: number) => string;
}> = ({ result, formatCurrency }) => {
    if (!result.comparison) return null;
    const { comparison, summary } = result;

    const diffVal = (cur: number, prev: number) => cur - prev;
    const diffPct = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev * 100) : (cur > 0 ? 100 : 0);
    const renderDiff = (cur: number, prev: number, isCurrency = false) => {
        const diff = diffVal(cur, prev);
        const pct = diffPct(cur, prev);
        if (diff === 0) return <span className="text-slate-500">—</span>;
        const isUp = diff > 0;
        return (
            <span className={isUp ? 'text-emerald-400' : 'text-rose-400'}>
                <FontAwesomeIcon icon={isUp ? faArrowUp : faArrowDown} className="text-[10px] mr-1" />
                {isCurrency ? formatCurrency(Math.abs(Math.round(diff))) : Math.abs(Math.round(diff * 10) / 10)}
                <span className="text-[10px] ml-1 opacity-70">({pct > 0 ? '+' : ''}{pct.toFixed(1)}%)</span>
            </span>
        );
    };

    // Merge teams: current + previous
    const teamCompare = (() => {
        const map = new Map<string, { cur: number; prev: number }>();
        result.teamAgg.forEach(t => map.set(t.teamName, { cur: t.totalManDay, prev: 0 }));
        comparison.prevTeamAgg.forEach(t => {
            const existing = map.get(t.teamName);
            if (existing) existing.prev = t.totalManDay;
            else map.set(t.teamName, { cur: 0, prev: t.totalManDay });
        });
        return Array.from(map.entries())
            .map(([name, { cur, prev }]) => ({ name, cur, prev, diff: cur - prev }))
            .sort((a, b) => b.cur - a.cur);
    })();

    return (
        <div className="space-y-4">
            {/* Period comparison header */}
            <div className="bg-slate-900/50 rounded-xl border border-slate-700/30 p-4">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-5 bg-violet-500 rounded-full" />
                    <span className="text-sm font-bold text-white">기간 비교 분석</span>
                </div>

                {/* KPI comparison */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                        { label: '총 공수', cur: summary.totalManDay, prev: comparison.prevSummary.totalManDay },
                        { label: '총 금액', cur: summary.totalAmount, prev: comparison.prevSummary.totalAmount, isCurrency: true },
                        { label: '투입 인원', cur: summary.totalWorkers, prev: comparison.prevSummary.totalWorkers },
                    ].map((item, i) => (
                        <div key={i} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/20">
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">{item.label}</div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-lg font-bold text-white">
                                        {item.isCurrency ? formatCurrency(Math.round(item.cur)) : Math.round(item.cur * 10) / 10}
                                    </span>
                                    <span className="text-xs text-slate-500 ml-1">현재</span>
                                </div>
                                <span className="text-slate-600 mx-2">→</span>
                                <div>
                                    <span className="text-sm text-slate-400">
                                        {item.isCurrency ? formatCurrency(Math.round(item.prev)) : Math.round(item.prev * 10) / 10}
                                    </span>
                                    <span className="text-xs text-slate-600 ml-1">이전</span>
                                </div>
                            </div>
                            <div className="mt-2 text-sm">
                                {renderDiff(item.cur, item.prev, item.isCurrency)}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2 mt-3 text-[10px] text-slate-600">
                    <span className="px-2 py-0.5 rounded bg-slate-800/80">현재: {summary.dateRange}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800/80">이전: {comparison.prevPeriod}</span>
                </div>
            </div>

            {/* Team comparison table */}
            {teamCompare.length > 0 && (
                <div className="bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700/30">
                        <span className="text-sm font-bold text-white">팀별 증감 비교</span>
                        <span className="text-xs text-slate-500 ml-2">{teamCompare.length}개 팀</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-slate-500 text-xs border-b border-slate-700/30">
                                    <th className="px-4 py-2">팀명</th>
                                    <th className="px-4 py-2 text-right">현재 공수</th>
                                    <th className="px-4 py-2 text-right">이전 공수</th>
                                    <th className="px-4 py-2 text-right">증감</th>
                                    <th className="px-4 py-2 text-right">증감률</th>
                                </tr>
                            </thead>
                            <tbody>
                                {teamCompare.map((t, i) => {
                                    const diff = t.diff;
                                    const pct = t.prev > 0 ? ((diff / t.prev) * 100) : (t.cur > 0 ? 100 : 0);
                                    return (
                                        <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-2 text-sm font-medium text-white">{t.name}</td>
                                            <td className="px-4 py-2 text-sm text-right font-bold text-cyan-400">{t.cur.toFixed(1)}</td>
                                            <td className="px-4 py-2 text-sm text-right text-slate-400">{t.prev.toFixed(1)}</td>
                                            <td className="px-4 py-2 text-sm text-right">
                                                {diff === 0 ? (
                                                    <span className="text-slate-500">—</span>
                                                ) : (
                                                    <span className={diff > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                                        <FontAwesomeIcon icon={diff > 0 ? faArrowUp : faArrowDown} className="text-[10px] mr-1" />
                                                        {Math.abs(Math.round(diff * 10) / 10)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-right">
                                                {diff === 0 ? (
                                                    <span className="text-slate-500">0%</span>
                                                ) : (
                                                    <span className={diff > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                                        {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

const AiAnalyticsView: React.FC<{
    messages: ChatMessage[];
    input: string;
    setInput: (v: string) => void;
    onSubmit: (q: string) => void;
    onReset?: () => void;
    loading: boolean;
    formatCurrency: (val: number) => string;
}> = ({ messages, input, setInput, onSubmit, onReset, loading, formatCurrency }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const toggleDetail = useCallback((msgId: string) => {
        setExpandedDetails(prev => {
            const next = new Set(prev);
            if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
            return next;
        });
    }, []);

    const handleCopyTable = useCallback((result: AnalyticsResult, msgId: string) => {
        const lines: string[] = [];
        const type = result.query.analysisType;

        if (type === 'team_summary' || type === 'general') {
            lines.push('순위\t팀명\t총공수\t인원\t총금액\t가동일\t일평균');
            result.teamAgg.forEach((t, i) => lines.push(`${i + 1}\t${t.teamName}\t${t.totalManDay.toFixed(1)}\t${t.workerCount}\t${t.totalAmount}\t${t.days}\t${t.avgDailyManDay.toFixed(1)}`));
        } else if (type === 'site_summary') {
            lines.push('순위\t현장명\t총공수\t인원\t팀수\t총금액\t가동일');
            result.siteAgg.forEach((s, i) => lines.push(`${i + 1}\t${s.siteName}\t${s.totalManDay.toFixed(1)}\t${s.workerCount}\t${s.teamCount}\t${s.totalAmount}\t${s.days}`));
        } else if (type === 'worker_ranking' || type === 'worker_detail') {
            lines.push('순위\t이름\t총공수\t근무일\t총금액\t급여방식\t팀\t현장');
            result.workerAgg.forEach((w, i) => lines.push(`${i + 1}\t${w.name}\t${w.totalManDay.toFixed(1)}\t${w.workDays}\t${w.totalAmount}\t${w.salaryModel}\t${w.teams.join('/')}\t${w.sites.join('/')}`));
        } else {
            lines.push('날짜\t현장\t팀\t이름\t직종\t공수\t단가\t금액');
            result.detailRows.forEach(row => row.workers.forEach(w =>
                lines.push(`${row.date}\t${row.siteName}\t${row.teamName}\t${w.name}\t${w.role || ''}\t${w.manDay.toFixed(1)}\t${w.unitPrice}\t${w.amount}`)
            ));
        }

        navigator.clipboard.writeText(lines.join('\n'));
        setCopiedId(msgId);
        setTimeout(() => setCopiedId(null), 2000);
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(input); }
    }, [input, onSubmit]);

    return (
        <div className="flex flex-col" style={{ minHeight: '600px' }}>
            <div className="flex-1 space-y-6 pb-4">
                {messages.length === 0 ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-16">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/20 flex items-center justify-center mb-6">
                            <FontAwesomeIcon icon={faRobot} className="text-3xl text-cyan-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">AI 통계 분석</h3>
                        <p className="text-slate-400 text-center max-w-lg mb-8">
                            자연어로 일보 데이터를 분석하세요. 팀별/현장별/작업자별/급여방식별 집계를 자동으로 수행합니다.<br />
                            <span className="text-slate-500 text-xs">모든 수치는 실제 DB 데이터 기반입니다.</span>
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-2xl w-full">
                            {EXAMPLE_QUESTIONS.map((eq, idx) => (
                                <button key={idx} onClick={() => onSubmit(eq.text)} disabled={loading}
                                    className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/30 hover:bg-slate-800/80 transition-all text-left group">
                                    <span className="text-[10px] font-bold text-cyan-500/60 uppercase tracking-wider mb-1 block">{eq.category}</span>
                                    <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{eq.text}</span>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                ) : (
                    <div className="space-y-6">
                        {/* Reset / 새 분석 button */}
                        {onReset && (
                            <div className="flex justify-end">
                                <button onClick={onReset}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/60 border border-slate-700/30 text-xs text-slate-400 hover:text-white hover:border-cyan-500/30 transition-all">
                                    <FontAwesomeIcon icon={faSync} className="text-[10px]" />
                                    새 분석
                                </button>
                            </div>
                        )}
                        {messages.map((msg) => (
                            <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                                {msg.role === 'user' ? (
                                    <div className="max-w-[70%] px-5 py-3 rounded-2xl rounded-tr-sm bg-cyan-600/20 border border-cyan-500/30">
                                        <p className="text-sm text-cyan-100 whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                ) : (
                                    <div className="w-full space-y-4">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <FontAwesomeIcon icon={faRobot} className="text-sm text-indigo-400" />
                                            </div>
                                            <p className="text-sm text-slate-300 pt-1">{msg.content}</p>
                                        </div>

                                        {msg.result && msg.result.success && (
                                            <div className="ml-11 space-y-4">
                                                {/* Summary Cards */}
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    {[
                                                        { label: '총 공수', value: msg.result.summary.totalManDay.toFixed(1), color: 'text-cyan-400' },
                                                        { label: '총 금액', value: `${formatCurrency(msg.result.summary.totalAmount)}원`, color: 'text-amber-400' },
                                                        { label: '투입 인원', value: `${msg.result.summary.totalWorkers}명`, color: 'text-emerald-400' },
                                                        { label: '일보 수', value: `${msg.result.summary.totalReports}건`, color: 'text-indigo-400' },
                                                    ].map((card, ci) => (
                                                        <div key={ci} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/30">
                                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{card.label}</div>
                                                            <div className={`text-lg font-bold ${card.color}`}>{card.value}</div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Query Tags */}
                                                <div className="flex flex-wrap gap-2 text-xs">
                                                    <span className="px-2 py-1 rounded-lg bg-slate-800/60 text-slate-400">기간: {msg.result.summary.dateRange}</span>
                                                    {msg.result.query.siteName && <span className="px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400">현장: {msg.result.query.siteName}</span>}
                                                    {msg.result.query.teamName && <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400">팀: {msg.result.query.teamName}</span>}
                                                    {msg.result.query.workerTeamName && <span className="px-2 py-1 rounded-lg bg-teal-500/10 text-teal-400">소속팀: {msg.result.query.workerTeamName}</span>}
                                                    {msg.result.query.workerName && <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400">작업자: {msg.result.query.workerName}</span>}
                                                    {msg.result.query.salaryModel && <span className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400">급여방식: {msg.result.query.salaryModel}</span>}
                                                    <span className="px-2 py-1 rounded-lg bg-violet-500/10 text-violet-400">분석: {msg.result.query.analysisType}</span>
                                                    {msg.result.debug && (
                                                        <span className="px-2 py-1 rounded-lg bg-slate-800/60 text-slate-500">
                                                            DB {msg.result.debug.rawReportCount}건→필터 {msg.result.debug.filteredReportCount}건
                                                            {msg.result.debug.timings && ` (${Math.round((msg.result.debug.timings.parse + msg.result.debug.timings.fetch + msg.result.debug.timings.insight) / 100) / 10}s)`}
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Debug: Applied filters & validation logs */}
                                                {msg.result.debug && (msg.result.debug.appliedFilters.length > 0 || msg.result.debug.queryValidation.length > 0) && (
                                                    <div className="text-[10px] text-slate-600 space-y-0.5">
                                                        {msg.result.debug.appliedFilters.map((f, fi) => (
                                                            <div key={fi}>🔍 {f}</div>
                                                        ))}
                                                        {msg.result.debug.queryValidation.map((v, vi) => (
                                                            <div key={vi}>⚙️ {v}</div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Aggregated Summary Table */}
                                                <AiResultCharts result={msg.result} />
                                                <AiAggregatedTable result={msg.result} formatCurrency={formatCurrency} />

                                                {/* Comparison Table */}
                                                {msg.result.comparison && <AiComparisonTable result={msg.result} formatCurrency={formatCurrency} />}

                                                {/* Alternative Result (애매한 팀 필터 시) */}
                                                {msg.result.alternativeResult && (
                                                    <div className="bg-slate-900/50 rounded-xl border border-amber-500/20 overflow-hidden">
                                                        <div className="px-4 py-3 bg-amber-500/5 border-b border-amber-500/10 flex items-center gap-2">
                                                            <div className="w-1 h-5 bg-amber-500 rounded-full" />
                                                            <span className="text-sm font-bold text-amber-400">대안 결과</span>
                                                            <span className="text-xs text-slate-500">{msg.result.alternativeResult.label}</span>
                                                        </div>
                                                        <div className="p-4 space-y-3">
                                                            {/* Alt Summary */}
                                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                                {[
                                                                    { label: '총 공수', value: msg.result.alternativeResult.summary.totalManDay.toFixed(1), color: 'text-amber-400' },
                                                                    { label: '총 금액', value: `${formatCurrency(msg.result.alternativeResult.summary.totalAmount)}원`, color: 'text-orange-400' },
                                                                    { label: '투입 인원', value: `${msg.result.alternativeResult.summary.totalWorkers}명`, color: 'text-yellow-400' },
                                                                ].map((c, ci) => (
                                                                    <div key={ci} className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/20">
                                                                        <div className="text-[10px] text-slate-500 mb-1">{c.label}</div>
                                                                        <div className={`text-sm font-bold ${c.color}`}>{c.value}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {/* Alt Worker table (top 10) */}
                                                            {msg.result.alternativeResult.workerAgg.length > 0 && (
                                                                <div className="overflow-x-auto">
                                                                    <table className="w-full text-left border-collapse">
                                                                        <thead><tr className="text-slate-500 text-xs border-b border-slate-700/30">
                                                                            <th className="px-3 py-1.5">순위</th><th className="px-3 py-1.5">이름</th>
                                                                            <th className="px-3 py-1.5 text-right">총 공수</th><th className="px-3 py-1.5">소속팀</th>
                                                                        </tr></thead>
                                                                        <tbody>{msg.result.alternativeResult.workerAgg.slice(0, 10).map((w, i) => (
                                                                            <tr key={i} className="border-b border-slate-800/30">
                                                                                <td className="px-3 py-1.5 text-xs text-slate-600">{i + 1}</td>
                                                                                <td className="px-3 py-1.5 text-xs text-white">{w.name}</td>
                                                                                <td className="px-3 py-1.5 text-xs text-right font-bold text-amber-400">{w.totalManDay.toFixed(1)}</td>
                                                                                <td className="px-3 py-1.5 text-[10px] text-slate-500">{w.teams.join(', ')}</td>
                                                                            </tr>
                                                                        ))}</tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                            <p className="text-[10px] text-slate-600 italic">
                                                                위 결과는 현장 담당팀이 아닌, 작업자 소속팀 기준으로 필터링한 결과입니다.
                                                                정확한 구분이 필요하면 "소속팀" 또는 "담당팀"을 명시해주세요.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* AI Insight */}
                                                {msg.result.aiInsight && (
                                                    <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-900/20 to-indigo-900/20 border border-cyan-500/10">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <FontAwesomeIcon icon={faBolt} className="text-xs text-cyan-400" />
                                                            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">AI 인사이트</span>
                                                        </div>
                                                        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{msg.result.aiInsight}</p>
                                                    </div>
                                                )}

                                                {/* Actions: Copy + Detail Toggle */}
                                                <div className="flex gap-2 flex-wrap">
                                                    <button onClick={() => handleCopyTable(msg.result!, msg.id)}
                                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/30 text-xs text-slate-400 hover:text-white hover:border-slate-600 transition-all">
                                                        <FontAwesomeIcon icon={copiedId === msg.id ? faCheck : faCopy} className={copiedId === msg.id ? 'text-emerald-400' : ''} />
                                                        {copiedId === msg.id ? '복사됨!' : '테이블 복사'}
                                                    </button>
                                                    {msg.result.detailRows.length > 0 && (
                                                        <button onClick={() => toggleDetail(msg.id)}
                                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${expandedDetails.has(msg.id)
                                                                ? 'bg-cyan-600/20 border-cyan-500/30 text-cyan-400'
                                                                : 'bg-slate-800/60 border-slate-700/30 text-slate-400 hover:text-white hover:border-slate-600'
                                                                }`}>
                                                            <FontAwesomeIcon icon={faLayerGroup} />
                                                            {expandedDetails.has(msg.id) ? '상세 접기' : `상세보기 (${msg.result.detailRows.length}건)`}
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Expanded Detail */}
                                                <AnimatePresence>
                                                    {expandedDetails.has(msg.id) && (
                                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                                            className="overflow-hidden">
                                                            <div className="pt-2">
                                                                <div className="text-xs text-slate-500 mb-2 font-bold uppercase tracking-wider">일보별 상세 내역</div>
                                                                <AiDetailTable result={msg.result} formatCurrency={formatCurrency} />
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}

                                        {/* Error/Empty state with helpful guidance */}
                                        {msg.result && !msg.result.success && msg.result.error && (
                                            <div className="ml-11 space-y-3">
                                                <div className="p-4 rounded-xl bg-rose-900/10 border border-rose-500/20 flex items-start gap-4">
                                                    <div className="text-2xl text-rose-500 opacity-80">
                                                        <FontAwesomeIcon icon={faTimes} />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-rose-400 uppercase tracking-wider mb-1">분석 실패 / 데이터 없음</div>
                                                        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{msg.result.error}</p>
                                                        <div className="mt-3 p-3 rounded-lg bg-rose-500/5 text-xs text-rose-300/80">
                                                            <strong className="block mb-1">💡 팁:</strong>
                                                            질문을 조금 더 구체적으로 해보세요. (예: "2024년 1월 김철수 공수" vs "김철수 공수")
                                                        </div>
                                                    </div>
                                                </div>
                                                {msg.result.debug && (
                                                    <div className="flex flex-wrap gap-2 text-xs">
                                                        <span className="px-2 py-1 rounded-lg bg-slate-800/60 text-slate-500">기간: {msg.result.query.startDate} ~ {msg.result.query.endDate}</span>
                                                        <span className="px-2 py-1 rounded-lg bg-slate-800/60 text-slate-500">DB {msg.result.debug.rawReportCount}건</span>
                                                        {msg.result.debug.appliedFilters.map((f, fi) => (
                                                            <span key={fi} className="px-2 py-1 rounded-lg bg-slate-800/60 text-slate-600">{f}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        ))}

                        {loading && <AiSkeletonLoader />}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="sticky bottom-0 pt-4 bg-gradient-to-t from-[#0f172a] via-[#0f172a] to-transparent">
                <div className="flex gap-3 items-end bg-slate-800/60 border border-slate-700/50 rounded-2xl p-2 backdrop-blur-sm">
                    <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                        placeholder="질문을 입력하세요... (예: 12월 팀별 공수 순위, 지난달 일급제 작업자 TOP 10)"
                        rows={1} disabled={loading}
                        className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 resize-none outline-none px-3 py-2 max-h-[120px] overflow-y-auto disabled:opacity-50"
                        style={{ minHeight: '40px' }} />
                    <button onClick={() => onSubmit(input)} disabled={!input.trim() || loading}
                        className="flex-shrink-0 w-10 h-10 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white flex items-center justify-center transition-all">
                        <FontAwesomeIcon icon={faPaperPlane} className="text-sm" />
                    </button>
                </div>
                <p className="text-[10px] text-slate-600 text-center mt-2">
                    AI가 자연어를 분석하여 실제 DB 데이터를 조회합니다. 팀별·현장별·작업자별·급여방식별 자동 집계.
                </p>
            </div>
        </div>
    );
};

// --- Main Page Component ---

const DailyReportStatisticsPage: React.FC = () => {
    // State
    const [dateRange, setDateRange] = useState<DateRange>({
        startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    });
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('dashboard');

    // Data State
    const [stats, setStats] = useState<ManpowerStats | null>(null);
    const [teamData, setTeamData] = useState<TeamManpowerSummary[]>([]);
    const [siteData, setSiteData] = useState<SiteManpowerSummary[]>([]);
    const [workerData, setWorkerData] = useState<WorkerManpowerSummary[]>([]);
    const [dailyTrend, setDailyTrend] = useState<any[]>([]);
    const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
    const [supportData, setSupportData] = useState<SupportAnalysis | null>(null);

    // AI Chat State
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    // Filter Quick Actions
    const handleQuickDate = (type: 'thisMonth' | 'lastMonth' | '3months') => {
        const today = new Date();
        let start = new Date();
        let end = new Date();

        if (type === 'thisMonth') {
            start = startOfMonth(today);
            end = endOfMonth(today);
        } else if (type === 'lastMonth') {
            const lastMonth = subMonths(today, 1);
            start = startOfMonth(lastMonth);
            end = endOfMonth(lastMonth);
        } else if (type === '3months') {
            start = subMonths(today, 3);
            end = today;
        }

        setDateRange({
            startDate: format(start, 'yyyy-MM-dd'),
            endDate: format(end, 'yyyy-MM-dd')
        });
    };

    // Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const { startDate, endDate } = dateRange;
                const [statResult, teamResult, siteResult, workerResult, periodResult, dailySummaryResult, supportResult] = await Promise.all([
                    manpowerAnalyticsService.getManpowerStatistics(startDate, endDate),
                    manpowerAnalyticsService.getTeamManpower(startDate, endDate),
                    manpowerAnalyticsService.getSiteManpower(startDate, endDate),
                    manpowerAnalyticsService.getWorkerManpower(startDate, endDate),
                    manpowerAnalyticsService.getManpowerByPeriod(startDate, endDate),
                    manpowerAnalyticsService.getDailySummary(startDate, endDate),
                    manpowerAnalyticsService.getSupportAnalysis(startDate, endDate)
                ]);

                setStats(statResult);
                setTeamData(teamResult);
                setSiteData(siteResult);
                setWorkerData(workerResult);
                setDailySummaries(dailySummaryResult);
                setSupportData(supportResult);

                // Process Daily Trend
                const trendMap = new Map<string, { date: string, manDay: number, amount: number }>();
                periodResult.forEach(item => {
                    const current = trendMap.get(item.date) || { date: item.date, manDay: 0, amount: 0 };
                    current.manDay += item.totalManDay;
                    let dailyAmount = 0;
                    item.workers.forEach(w => dailyAmount += (w.manDay || 0) * (w.unitPrice || 0));
                    current.amount += dailyAmount;
                    trendMap.set(item.date, current);
                });
                setDailyTrend(Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date)));

            } catch (error) {
                console.error("Failed to fetch analytics:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [dateRange]);

    // AI Submit Handler
    const handleAiSubmit = useCallback(async (question: string) => {
        if (!question.trim() || aiLoading) return;

        const userMsg: ChatMessage = {
            id: `msg_${Date.now()}_user`,
            role: 'user',
            content: question.trim(),
            timestamp: Date.now(),
        };
        setChatMessages(prev => [...prev, userMsg]);
        setChatInput('');
        setAiLoading(true);

        try {
            const result = await analyzeWithAI(question.trim());
            const assistantMsg: ChatMessage = {
                id: `msg_${Date.now()}_ai`,
                role: 'assistant',
                content: result.success
                    ? `${result.parsedQuestion}에 대한 분석 결과입니다.`
                    : (result.error || '분석에 실패했습니다.'),
                result: result.success ? result : undefined,
                timestamp: Date.now(),
            };
            setChatMessages(prev => [...prev, assistantMsg]);
        } catch (err: any) {
            const errorMsg: ChatMessage = {
                id: `msg_${Date.now()}_err`,
                role: 'assistant',
                content: err?.message || 'AI 분석 중 오류가 발생했습니다.',
                timestamp: Date.now(),
            };
            setChatMessages(prev => [...prev, errorMsg]);
        } finally {
            setAiLoading(false);
        }
    }, [aiLoading]);

    // Formatters
    const formatCurrency = useCallback((val: number) => new Intl.NumberFormat('ko-KR').format(val), []);
    const formatNumber = useCallback((num: number) => new Intl.NumberFormat('ko-KR').format(num), []);

    // Tab definitions
    const tabs: Array<{ id: TabId; label: string; icon: any }> = [
        { id: 'dashboard', label: '대시보드', icon: faLayerGroup },
        { id: 'calendar', label: '달력', icon: faCalendarAlt },
        { id: 'team', label: '팀별 현황', icon: faUsers },
        { id: 'site', label: '현장별 현황', icon: faBuilding },
        { id: 'worker', label: '작업자 분석', icon: faHardHat },
        { id: 'support', label: '지원팀 분석', icon: faHandshake },
        { id: 'ai', label: 'AI 분석', icon: faRobot }
    ];

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-cyan-500/30 p-6">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-900/10 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-900/10 blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto space-y-8">
                {/* Header & Controls */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-widest">
                                Analytics V3.0
                            </span>
                        </div>
                        <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">
                            일일 업무 보고 <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">통계 분석</span>
                        </h1>
                        <p className="text-slate-400">
                            기간별 인력, 비용 및 프로젝트 성과에 대한 종합적인 인사이트를 제공합니다.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 bg-slate-800/50 p-2 rounded-2xl border border-slate-700/50 backdrop-blur-md">
                        <div className="flex items-center gap-2 px-2">
                            <div className="relative">
                                <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                                <input
                                    type="date"
                                    value={dateRange.startDate}
                                    onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                                    className="pl-8 pr-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white focus:ring-1 focus:ring-cyan-500 outline-none w-32 transition-all hover:bg-slate-900"
                                />
                            </div>
                            <span className="text-slate-500 font-bold">~</span>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={dateRange.endDate}
                                    onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                                    className="pl-3 pr-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white focus:ring-1 focus:ring-cyan-500 outline-none w-32 transition-all hover:bg-slate-900"
                                />
                            </div>
                        </div>
                        <div className="h-full w-px bg-slate-700 hidden sm:block" />
                        <div className="flex gap-1">
                            {['thisMonth', 'lastMonth', '3months'].map((t) => (
                                <button
                                    key={t}
                                    onClick={() => handleQuickDate(t as any)}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                                >
                                    {t === 'thisMonth' ? '이번 달' : t === 'lastMonth' ? '지난 달' : '3개월'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title="총 투입 공수"
                        value={formatNumber(stats?.totalManDay || 0)}
                        unit="공수"
                        icon={faHardHat}
                        color="cyan"
                        delay={0}
                    />
                    <StatCard
                        title="총 인건비"
                        value={formatCurrency(stats?.totalAmount || 0)}
                        unit="원"
                        icon={faCoins}
                        color="indigo"
                        delay={0.1}
                    />
                    <StatCard
                        title="활성 작업자 수"
                        value={formatNumber(stats?.totalWorkers || 0)}
                        unit="명"
                        icon={faUsers}
                        color="emerald"
                        delay={0.2}
                    />
                    <StatCard
                        title="일 평균 공수"
                        value={(stats?.avgManDay || 0).toFixed(1)}
                        unit="공수/일"
                        icon={faChartPie}
                        color="violet"
                        delay={0.3}
                    />
                </div>

                {/* Navigation Tabs */}
                <div className="flex gap-4 lg:gap-8 border-b border-slate-800 overflow-x-auto pb-px">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-4 flex items-center gap-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                                ? 'border-cyan-500 text-cyan-400'
                                : 'border-transparent text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <FontAwesomeIcon icon={tab.icon} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={loading ? 'loading' : activeTab}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        variants={containerVariants}
                        className="space-y-6"
                    >
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4" />
                                <p className="text-slate-400 animate-pulse">데이터를 분석 중입니다...</p>
                            </div>
                        ) : activeTab === 'dashboard' ? (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Daily Trend Chart */}
                                <motion.div variants={itemVariants} className="lg:col-span-2 bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                        <div className="w-1 h-5 bg-cyan-500 rounded-full" />
                                        일별 공수 추이
                                    </h3>
                                    <div className="h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={dailyTrend}>
                                                <defs>
                                                    <linearGradient id="colorManDay" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                                <XAxis
                                                    dataKey="date"
                                                    stroke="#64748b"
                                                    tickFormatter={(str) => { try { return format(new Date(str), 'MM.dd'); } catch { return str; } }}
                                                    fontSize={12}
                                                />
                                                <YAxis stroke="#64748b" fontSize={12} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Area
                                                    type="monotone"
                                                    dataKey="manDay"
                                                    name="공수"
                                                    stroke="#06b6d4"
                                                    fillOpacity={1}
                                                    fill="url(#colorManDay)"
                                                    strokeWidth={3}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </motion.div>

                                {/* Cost Breakdown */}
                                <motion.div variants={itemVariants} className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                        <div className="w-1 h-5 bg-indigo-500 rounded-full" />
                                        비용 분석
                                    </h3>
                                    <div className="h-[300px] flex items-center justify-center relative">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={teamData.slice(0, 5) as any[]}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={100}
                                                    paddingAngle={5}
                                                    dataKey="totalAmount"
                                                    nameKey="teamName"
                                                >
                                                    {teamData.slice(0, 5).map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<CustomTooltip />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span className="text-2xl font-bold text-white">
                                                {formatCurrency(teamData.reduce((acc, curr) => acc + curr.totalAmount, 0))}
                                            </span>
                                            <span className="text-xs text-slate-500">원 (Total)</span>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Top Performers Row */}
                                <motion.div variants={itemVariants} className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Top Teams */}
                                    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 flex flex-col">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                                <FontAwesomeIcon icon={faTrophy} className="text-cyan-400" /> Top Teams
                                            </h4>
                                            <span className="text-xs text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-lg">공수 기준</span>
                                        </div>
                                        <div className="space-y-2">
                                            {teamData.slice(0, 5).map((team, idx) => (
                                                <RankingItem
                                                    key={idx}
                                                    rank={idx + 1}
                                                    name={team.teamName}
                                                    value={`${team.totalManDay.toFixed(1)} 공수`}
                                                    subValue={formatCurrency(team.totalAmount) + ' 원'}
                                                    max={teamData[0]?.totalManDay || 1}
                                                    color="cyan"
                                                />
                                            ))}
                                            {teamData.length === 0 && <p className="text-center text-slate-600 py-4">데이터가 없습니다.</p>}
                                        </div>
                                    </div>

                                    {/* Top Sites */}
                                    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 flex flex-col">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                                <FontAwesomeIcon icon={faBuilding} className="text-indigo-400" /> Top Sites
                                            </h4>
                                            <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg">공수 기준</span>
                                        </div>
                                        <div className="space-y-2">
                                            {siteData.slice(0, 5).map((site, idx) => (
                                                <RankingItem
                                                    key={idx}
                                                    rank={idx + 1}
                                                    name={site.siteName}
                                                    value={`${site.totalManDay.toFixed(1)} 공수`}
                                                    subValue={formatCurrency(site.totalAmount) + ' 원'}
                                                    max={siteData[0]?.totalManDay || 1}
                                                    color="indigo"
                                                />
                                            ))}
                                            {siteData.length === 0 && <p className="text-center text-slate-600 py-4">데이터가 없습니다.</p>}
                                        </div>
                                    </div>

                                    {/* Top Workers */}
                                    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 flex flex-col">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                                <FontAwesomeIcon icon={faHardHat} className="text-emerald-400" /> Top Workers
                                            </h4>
                                            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">공수 기준</span>
                                        </div>
                                        <div className="space-y-2">
                                            {workerData.slice(0, 5).map((worker, idx) => (
                                                <RankingItem
                                                    key={idx}
                                                    rank={idx + 1}
                                                    name={worker.workerName}
                                                    value={`${worker.totalManDay.toFixed(1)} 공수`}
                                                    subValue={`${worker.workDays}일 근무`}
                                                    max={workerData[0]?.totalManDay || 1}
                                                    color="emerald"
                                                />
                                            ))}
                                            {workerData.length === 0 && <p className="text-center text-slate-600 py-4">데이터가 없습니다.</p>}
                                        </div>
                                    </div>
                                </motion.div>
                            </div>

                        ) : activeTab === 'calendar' ? (
                            <CalendarView dailySummaries={dailySummaries} formatCurrency={formatCurrency} />

                        ) : activeTab === 'team' ? (
                            <motion.div variants={itemVariants} className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 overflow-hidden">
                                <h3 className="text-lg font-bold text-white mb-4">팀별 상세 성과</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="text-slate-400 text-sm border-b border-slate-700">
                                                <th className="p-3">순위</th>
                                                <th className="p-3">팀명</th>
                                                <th className="p-3 text-right">총 공수</th>
                                                <th className="p-3 text-right">출력 인원</th>
                                                <th className="p-3 text-right">총 금액</th>
                                                <th className="p-3 text-right">투입 일수</th>
                                                <th className="p-3 text-right">일 평균 공수</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-slate-300">
                                            {teamData.map((team, index) => (
                                                <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                                                    <td className="p-3 font-medium text-slate-500">{index + 1}</td>
                                                    <td className="p-3 font-bold text-white">{team.teamName}</td>
                                                    <td className="p-3 text-right font-bold text-cyan-400">{team.totalManDay.toFixed(1)}</td>
                                                    <td className="p-3 text-right">{team.workerCount}명</td>
                                                    <td className="p-3 text-right">{formatCurrency(team.totalAmount)}</td>
                                                    <td className="p-3 text-right">{team.days}일</td>
                                                    <td className="p-3 text-right">{team.avgDailyManDay.toFixed(1)}</td>
                                                </tr>
                                            ))}
                                            {teamData.length === 0 && (
                                                <tr>
                                                    <td colSpan={7} className="text-center p-8 text-slate-500">데이터가 없습니다.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>

                        ) : activeTab === 'site' ? (
                            <motion.div variants={itemVariants} className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 overflow-hidden">
                                <h3 className="text-lg font-bold text-white mb-4">현장별 상세 성과</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="text-slate-400 text-sm border-b border-slate-700">
                                                <th className="p-3">순위</th>
                                                <th className="p-3">현장명</th>
                                                <th className="p-3 text-right">총 공수</th>
                                                <th className="p-3 text-right">투입 팀 수</th>
                                                <th className="p-3 text-right">투입 인원 (연인원)</th>
                                                <th className="p-3 text-right">총 금액</th>
                                                <th className="p-3 text-right">가동 일수</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-slate-300">
                                            {siteData.map((site, index) => (
                                                <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                                                    <td className="p-3 font-medium text-slate-500">{index + 1}</td>
                                                    <td className="p-3 font-bold text-white">{site.siteName}</td>
                                                    <td className="p-3 text-right font-bold text-indigo-400">{site.totalManDay.toFixed(1)}</td>
                                                    <td className="p-3 text-right">{site.teamCount}개 팀</td>
                                                    <td className="p-3 text-right">{site.workerCount}명</td>
                                                    <td className="p-3 text-right">{formatCurrency(site.totalAmount)}</td>
                                                    <td className="p-3 text-right">{site.days}일</td>
                                                </tr>
                                            ))}
                                            {siteData.length === 0 && (
                                                <tr>
                                                    <td colSpan={7} className="text-center p-8 text-slate-500">데이터가 없습니다.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>

                        ) : activeTab === 'worker' ? (
                            <motion.div variants={itemVariants} className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 overflow-hidden">
                                <h3 className="text-lg font-bold text-white mb-4">작업자별 성과 순위</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="text-slate-400 text-sm border-b border-slate-700">
                                                <th className="p-3">순위</th>
                                                <th className="p-3">성명</th>
                                                <th className="p-3 text-right">총 공수</th>
                                                <th className="p-3 text-right">출근 일수</th>
                                                <th className="p-3 text-right">총 지급액 (추정)</th>
                                                <th className="p-3 text-right">일 평균 공수</th>
                                                <th className="p-3">주요 투입 현장</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-slate-300">
                                            {workerData.map((worker, index) => (
                                                <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                                                    <td className="p-3 font-medium text-slate-500">{index + 1}</td>
                                                    <td className="p-3 font-bold text-white">{worker.workerName}</td>
                                                    <td className="p-3 text-right font-bold text-emerald-400">{worker.totalManDay.toFixed(1)}</td>
                                                    <td className="p-3 text-right">{worker.workDays}일</td>
                                                    <td className="p-3 text-right">{formatCurrency(worker.totalAmount)}</td>
                                                    <td className="p-3 text-right">{worker.avgManDay.toFixed(2)}</td>
                                                    <td className="p-3 text-xs text-slate-500 truncate max-w-[200px]">
                                                        {Array.isArray(worker.sites) ? worker.sites.join(', ') : worker.sites}
                                                    </td>
                                                </tr>
                                            ))}
                                            {workerData.length === 0 && (
                                                <tr>
                                                    <td colSpan={7} className="text-center p-8 text-slate-500">데이터가 없습니다.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>

                        ) : activeTab === 'support' ? (
                            <SupportView supportData={supportData} formatCurrency={formatCurrency} formatNumber={formatNumber} />
                        ) : activeTab === 'ai' ? (
                            <AiAnalyticsView
                                messages={chatMessages}
                                input={chatInput}
                                setInput={setChatInput}
                                onSubmit={handleAiSubmit}
                                onReset={() => setChatMessages([])}
                                loading={aiLoading}
                                formatCurrency={formatCurrency}
                            />
                        ) : null}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default DailyReportStatisticsPage;
