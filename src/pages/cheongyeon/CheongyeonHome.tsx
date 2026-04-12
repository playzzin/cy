import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faPlay, faHelmetSafety, faChartLine, faNetworkWired, faUsers, faCalendarDays, faBuilding, faHandshake, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { storage } from '../../config/firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';
import { useSiteMode } from '../../contexts/SiteModeContext';
import logoConstruction from '../../assets/logo_construction.jpg';
import ceoPortrait from '../../assets/ceo_portrait.png';

type SiteWorkerHighlight = {
    id: string;
    name: string;
    role: string;
    shifts: number;
};

type SiteHighlight = {
    key: string;
    siteId: string;
    siteName: string;
    latestDate: string;
    reportCount: number;
    totalWorkers: number;
    teamNames: string[];
    workers: SiteWorkerHighlight[];
};

type HeroSlide = {
    stage: string;
    title: string;
    description: string;
    image: string;
};

const toDateNumber = (date: string): number => Number(String(date || '').replace(/-/g, '')) || 0;
const toDateString = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};
const toKoreanDate = (date: string): string => {
    const [y, m, d] = String(date || '').split('-');
    if (!y || !m || !d) return '-';
    return `${y}.${m}.${d}`;
};

type DailyStatRow = { totalWorkers: number; totalManDay: number; siteCount: number; teamCount: number };
type DashboardStats = {
    yesterday: DailyStatRow;
    yearToDate: DailyStatRow;
    yesterdayLabel: string;
    yearToDateLabel: string;
};

type MonthlyTrendRow = {
    monthKey: string;
    monthLabel: string;
    manDay: number;
    siteCount: number;
};

type DailyTrendRow = {
    dateKey: string;
    dateLabel: string;
    totalWorkers: number;
    totalManDay: number;
    siteCount: number;
    teamCount: number;
};

type StatMetric = {
    key: keyof DailyStatRow;
    label: string;
    unit: string;
    color: string;
    fill: string;
    icon: any;
    decimals?: number;
};

const getCurrentYearRange = (): { start: string; end: string; label: string } => {
    // 올해 누적 기준 (1월 1일 ~ 오늘)
    const year = new Date().getFullYear();
    const today = toDateString(new Date());
    return { start: `${year}-01-01`, end: today, label: `${year}년` };
};

const getRecent30DayWindow = (): { start: string; end: string; dateKeys: string[] } => {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 29);
    const dateKeys = Array.from({ length: 30 }).map((_, idx) => {
        const current = new Date(startDate);
        current.setDate(startDate.getDate() + idx);
        return toDateString(current);
    });

    return {
        start: toDateString(startDate),
        end: toDateString(endDate),
        dateKeys,
    };
};

const toMonthKey = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const getCurrentYearMonthWindow = (): { start: string; end: string; monthKeys: string[] } => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), 0, 1);
    const monthKeys = Array.from({ length: now.getMonth() + 1 }).map((_, idx) => {
        const monthDate = new Date(now.getFullYear(), idx, 1);
        return toMonthKey(monthDate);
    });
    return {
        start: toDateString(startDate),
        end: toDateString(now),
        monthKeys,
    };
};

const buildMonthlyTrend = (reports: DailyReport[], monthKeys: string[]): MonthlyTrendRow[] => {
    const monthMap = new Map<string, { manDay: number; siteSet: Set<string> }>();
    monthKeys.forEach((key) => monthMap.set(key, { manDay: 0, siteSet: new Set<string>() }));

    reports.forEach((report) => {
        const reportDate = String(report.date || '').trim();
        const monthKey = reportDate.slice(0, 7);
        const bucket = monthMap.get(monthKey);
        if (!bucket) return;

        const reportManDay = (report.workers || []).reduce((acc, worker) => {
            const manDay = typeof worker.manDay === 'number' ? worker.manDay : 0;
            return acc + manDay;
        }, 0);

        bucket.manDay += reportManDay;

        const siteKey = String(report.siteId || report.siteName || '').trim();
        if (siteKey) bucket.siteSet.add(siteKey);
    });

    return monthKeys.map((monthKey) => {
        const month = monthMap.get(monthKey);
        const monthLabel = `${monthKey.slice(0, 4)}.${monthKey.slice(5, 7)}`;
        return {
            monthKey,
            monthLabel,
            manDay: Math.round((month?.manDay || 0) * 10) / 10,
            siteCount: month?.siteSet.size || 0,
        };
    });
};

const buildDailyTrend = (reports: DailyReport[], dateKeys: string[]): DailyTrendRow[] => {
    const dateMap = new Map<string, {
        workerSet: Set<string>;
        siteSet: Set<string>;
        teamSet: Set<string>;
        totalManDay: number;
    }>();

    dateKeys.forEach((key) => {
        dateMap.set(key, {
            workerSet: new Set<string>(),
            siteSet: new Set<string>(),
            teamSet: new Set<string>(),
            totalManDay: 0,
        });
    });

    reports.forEach((report) => {
        const dateKey = String(report.date || '').trim();
        const bucket = dateMap.get(dateKey);
        if (!bucket) return;

        const siteKey = String(report.siteId || report.siteName || '').trim();
        if (siteKey) bucket.siteSet.add(siteKey);

        const teamKey = String((report as any).teamId || report.teamName || '').trim();
        if (teamKey) bucket.teamSet.add(teamKey);

        (report.workers || []).forEach((worker) => {
            const workerKey = String(worker.workerId || worker.name || '').trim();
            if (workerKey) bucket.workerSet.add(workerKey);
            bucket.totalManDay += typeof worker.manDay === 'number' ? worker.manDay : 0;
        });
    });

    return dateKeys.map((dateKey) => {
        const bucket = dateMap.get(dateKey);
        return {
            dateKey,
            dateLabel: dateKey.replace(/-/g, '.'),
            totalWorkers: bucket?.workerSet.size || 0,
            totalManDay: Math.round(((bucket?.totalManDay || 0) * 10)) / 10,
            siteCount: bucket?.siteSet.size || 0,
            teamCount: bucket?.teamSet.size || 0,
        };
    });
};

const extractWorkerNames = (reports: DailyReport[]): string[] => {
    const set = new Set<string>();
    reports.forEach((report) => {
        (report.workers || []).forEach((worker) => {
            const name = String(worker.name || '').trim();
            if (name) set.add(name);
        });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
};

const computeStatRow = (reports: DailyReport[]): DailyStatRow => {
    const workers = new Set<string>();
    const sites = new Set<string>();
    const teams = new Set<string>();
    let totalManDay = 0;
    reports.forEach(r => {
        const siteKey = String(r.siteId || r.siteName || '').trim();
        if (siteKey) sites.add(siteKey);
        const teamKey = String((r as any).teamId || r.teamName || '').trim();
        if (teamKey) teams.add(teamKey);
        (r.workers || []).forEach(w => {
            const wKey = String(w.workerId || w.name || '').trim();
            if (wKey) workers.add(wKey);
            totalManDay += typeof w.manDay === 'number' ? w.manDay : 0;
        });
    });
    return { totalWorkers: workers.size, totalManDay: Math.round(totalManDay * 10) / 10, siteCount: sites.size, teamCount: teams.size };
};

const STAT_METRICS: StatMetric[] = [
    { key: 'totalWorkers', label: '총 출역 인원', unit: '명', icon: faUsers, color: 'from-amber-400 to-orange-500', fill: '#f59e0b' },
    { key: 'totalManDay', label: '총 투입 공수', unit: '', icon: faChartLine, color: 'from-blue-400 to-cyan-500', fill: '#06b6d4', decimals: 1 },
    { key: 'siteCount', label: '출력 현장 수', unit: '개', icon: faBuilding, color: 'from-emerald-400 to-green-500', fill: '#22c55e' },
];

const statSectionVariant: Variants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.8, ease: 'easeOut' },
    },
};

const HERO_SLIDES: HeroSlide[] = [
    {
        stage: '1단계 기획',
        title: '현장 분석과 공정 설계를 먼저 완성합니다',
        description: '현장 조건, 동선, 위험요소를 사전에 정리해 공정 손실을 줄이고 실행 가능성이 높은 시공 플랜을 수립합니다.',
        image: '/assets/images/dashboard/slider1.png',
    },
    {
        stage: '2단계 시공',
        title: '숙련 인력과 표준 공정으로 정확하게 시공합니다',
        description: '시스템 동바리·비계 시공 표준을 기반으로 품질과 속도를 동시에 확보하며 일정 변동에도 유연하게 대응합니다.',
        image: '/assets/images/dashboard/slider2.png',
    },
    {
        stage: '3단계 운영',
        title: '일일 데이터 기반으로 현장을 지속 관리합니다',
        description: '출력일보, 인력, 공수, 현장 지표를 연결해 이슈를 빠르게 파악하고 다음 작업을 안정적으로 이어갑니다.',
        image: '/assets/images/dashboard/slider3.png',
    },
    {
        stage: '4단계 품질',
        title: '품질·안전 기준을 단계별로 점검해 리스크를 낮춥니다',
        description: '시공 품질, 안전 수칙, 현장 이슈를 동시 관리해 공정 중단을 최소화하고 안정적인 진행률을 유지합니다.',
        image: logoConstruction,
    },
    {
        stage: '5단계 성과',
        title: '완료 이후에도 데이터로 성과를 분석하고 개선합니다',
        description: '프로젝트 종료 후 주요 지표를 정리해 다음 현장 계획에 반영하고 운영 효율을 지속적으로 고도화합니다.',
        image: ceoPortrait,
    },
];

type AnimatedBarShapeProps = {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fill?: string;
    index?: number;
};

const AnimatedBarShape: React.FC<AnimatedBarShapeProps> = ({
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    fill = '#06b6d4',
    index = 0,
}) => {
    const safeHeight = Math.max(0, height);
    const startY = y + safeHeight;

    return (
        <motion.rect
            x={x}
            width={width}
            rx={6}
            ry={6}
            fill={fill}
            initial={{ y: startY, height: 0, opacity: 0.9 }}
            animate={{ y, height: safeHeight, opacity: 1 }}
            transition={{ duration: 0.55, delay: index * 0.07, ease: 'easeOut' }}
        />
    );
};

const CheongyeonHome: React.FC = () => {
    const { isDarkMode } = useSiteMode();
    const [playCount, setPlayCount] = useState(0);
    const [isIntro, setIsIntro] = useState(false); // 처음부터 컨텐츠 표시 (어두운 배경)
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [videoLoaded, setVideoLoaded] = useState(false);
    const [siteHighlights, setSiteHighlights] = useState<SiteHighlight[]>([]);
    const [loadingHighlights, setLoadingHighlights] = useState(true);
    const [highlightError, setHighlightError] = useState<string | null>(null);
    const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendRow[]>([]);
    const [dailyTrend, setDailyTrend] = useState<DailyTrendRow[]>([]);
    const [trendMode, setTrendMode] = useState<'daily' | 'monthly'>('daily');
    const [summaryScope, setSummaryScope] = useState<'yesterday' | 'yearToDate'>('yesterday');
    const [activeHeroIndex, setActiveHeroIndex] = useState(0);
    const [animatedStats, setAnimatedStats] = useState<{ yesterday: DailyStatRow; yearToDate: DailyStatRow }>({
        yesterday: { totalWorkers: 0, totalManDay: 0, siteCount: 0, teamCount: 0 },
        yearToDate: { totalWorkers: 0, totalManDay: 0, siteCount: 0, teamCount: 0 },
    });
    const videoRef = useRef<HTMLVideoElement>(null);
    const navigate = useNavigate();

    // Firebase Storage에서 비디오 URL 동적으로 가져오기
    useEffect(() => {
        const loadVideo = async () => {
            try {
                const storageRef = ref(storage, 'logo_cy.mp4');
                const url = await getDownloadURL(storageRef);
                setVideoUrl(url);
            } catch (error) {
                console.error('Failed to load video from Firebase Storage:', error);
            }
        };
        loadVideo();
    }, []);

    useEffect(() => {
        const loadRecentSiteHighlights = async () => {
            setLoadingHighlights(true);
            setHighlightError(null);

            try {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 20);

                const reports = await dailyReportService.getReports({
                    startDate: toDateString(start),
                    endDate: toDateString(end),
                });

                const sortedReports = [...reports].sort((a: DailyReport, b: DailyReport) => toDateNumber(b.date) - toDateNumber(a.date));

                const grouped = new Map<string, {
                    key: string;
                    siteId: string;
                    siteName: string;
                    latestDate: string;
                    reportCount: number;
                    teamNames: Set<string>;
                    workerMap: Map<string, SiteWorkerHighlight>;
                }>();

                sortedReports.forEach((report) => {
                    const siteId = String(report.siteId || '').trim();
                    const siteName = String(report.siteName || '').trim() || '현장명 미기록';
                    const key = siteId || `name:${siteName}`;

                    if (!grouped.has(key)) {
                        grouped.set(key, {
                            key,
                            siteId,
                            siteName,
                            latestDate: String(report.date || ''),
                            reportCount: 0,
                            teamNames: new Set<string>(),
                            workerMap: new Map<string, SiteWorkerHighlight>(),
                        });
                    }

                    const bucket = grouped.get(key)!;
                    bucket.reportCount += 1;

                    if (toDateNumber(report.date) > toDateNumber(bucket.latestDate)) {
                        bucket.latestDate = String(report.date || '');
                    }

                    const teamName = String(report.teamName || '').trim();
                    if (teamName) bucket.teamNames.add(teamName);

                    (report.workers || []).forEach((worker, index) => {
                        const workerName = String(worker.name || '').trim() || `미기록 작업자 ${index + 1}`;
                        const workerId = String(worker.workerId || '').trim();
                        const workerKey = workerId || `name:${workerName}`;
                        const role = String(worker.role || '').trim() || '팀원';
                        const shiftValue = (Number(worker.manDay) > 0 ? Number(worker.manDay) : 1);

                        const existing = bucket.workerMap.get(workerKey);
                        if (existing) {
                            existing.shifts += shiftValue;
                            if (existing.role === '팀원' && role !== '팀원') {
                                existing.role = role;
                            }
                            return;
                        }

                        bucket.workerMap.set(workerKey, {
                            id: workerKey,
                            name: workerName,
                            role,
                            shifts: shiftValue,
                        });
                    });
                });

                const highlights: SiteHighlight[] = Array.from(grouped.values())
                    .map((bucket) => ({
                        key: bucket.key,
                        siteId: bucket.siteId,
                        siteName: bucket.siteName,
                        latestDate: bucket.latestDate,
                        reportCount: bucket.reportCount,
                        totalWorkers: bucket.workerMap.size,
                        teamNames: Array.from(bucket.teamNames).slice(0, 3),
                        workers: Array.from(bucket.workerMap.values())
                            .sort((a, b) => b.shifts - a.shifts)
                            .slice(0, 12),
                    }))
                    .sort((a, b) => toDateNumber(b.latestDate) - toDateNumber(a.latestDate))
                    .slice(0, 14);

                setSiteHighlights(highlights);
            } catch (error) {
                console.error('Failed to load dashboard2 highlights:', error);
                setHighlightError('최근 출력일보 데이터를 불러오지 못했습니다.');
            } finally {
                setLoadingHighlights(false);
            }
        };

        loadRecentSiteHighlights();
    }, []);

    useEffect(() => {
        const loadStats = async () => {
            setLoadingStats(true);
            try {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = toDateString(yesterday);
                const { start: ytdStart, end: ytdEnd, label: ytdLabel } = getCurrentYearRange();
                const { start: trendStart, end: trendEnd, monthKeys } = getCurrentYearMonthWindow();
                const { start: dailyStart, end: dailyEnd, dateKeys } = getRecent30DayWindow();

                const [yReports, ytdReports, trendReports, dailyReports] = await Promise.all([
                    dailyReportService.getReports({ startDate: yesterdayStr, endDate: yesterdayStr }),
                    dailyReportService.getReports({ startDate: ytdStart, endDate: ytdEnd }),
                    dailyReportService.getReports({ startDate: trendStart, endDate: trendEnd }),
                    dailyReportService.getReports({ startDate: dailyStart, endDate: dailyEnd }),
                ]);

                setDashboardStats({
                    yesterday: computeStatRow(yReports),
                    yearToDate: computeStatRow(ytdReports),
                    yesterdayLabel: yesterdayStr,
                    yearToDateLabel: ytdLabel,
                });
                setMonthlyTrend(buildMonthlyTrend(trendReports, monthKeys));
                setDailyTrend(buildDailyTrend(dailyReports, dateKeys));
            } catch (err) {
                console.error('Failed to load dashboard stats:', err);
            } finally {
                setLoadingStats(false);
            }
        };
        loadStats();
    }, []);

    useEffect(() => {
        if (!dashboardStats || loadingStats) return;

        const duration = 2400;
        const startedAt = performance.now();
        let rafId = 0;

        const animate = (now: number) => {
            const progress = Math.min((now - startedAt) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);

            const lerp = (target: number) => target * eased;

            setAnimatedStats({
                yesterday: {
                    totalWorkers: Math.round(lerp(dashboardStats.yesterday.totalWorkers)),
                    totalManDay: Math.round(lerp(dashboardStats.yesterday.totalManDay) * 10) / 10,
                    siteCount: Math.round(lerp(dashboardStats.yesterday.siteCount)),
                    teamCount: Math.round(lerp(dashboardStats.yesterday.teamCount)),
                },
                yearToDate: {
                    totalWorkers: Math.round(lerp(dashboardStats.yearToDate.totalWorkers)),
                    totalManDay: Math.round(lerp(dashboardStats.yearToDate.totalManDay) * 10) / 10,
                    siteCount: Math.round(lerp(dashboardStats.yearToDate.siteCount)),
                    teamCount: Math.round(lerp(dashboardStats.yearToDate.teamCount)),
                },
            });

            if (progress < 1) {
                rafId = requestAnimationFrame(animate);
            }
        };

        rafId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafId);
    }, [dashboardStats, loadingStats]);

    const handleVideoEnded = () => {
        const nextCount = playCount + 1;
        setPlayCount(nextCount);

        if (nextCount === 1) {
            setIsIntro(false);
            if (videoRef.current) {
                videoRef.current.currentTime = 0;
                videoRef.current.play();
            }
        } else if (nextCount < 3) {
            if (videoRef.current) {
                videoRef.current.currentTime = 0;
                videoRef.current.play();
            }
        }
    };

    const handleReplayIntro = () => {
        setIsIntro(true);
        setPlayCount(0);
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play();
        }
    };

    const formatStatValue = (value: number, decimals = 0): string => {
        if (decimals > 0) return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        return Math.round(value).toLocaleString();
    };

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setTrendMode((prev) => (prev === 'daily' ? 'monthly' : 'daily'));
            setSummaryScope((prev) => (prev === 'yesterday' ? 'yearToDate' : 'yesterday'));
        }, 7000);

        return () => window.clearInterval(intervalId);
    }, []);

    const manDayGraphData = trendMode === 'daily'
        ? dailyTrend.map((row) => ({ label: row.dateLabel, value: row.totalManDay }))
        : monthlyTrend.map((row) => ({ label: row.monthLabel, value: row.manDay }));

    const siteGraphData = trendMode === 'daily'
        ? dailyTrend.map((row) => ({ label: row.dateLabel, value: row.siteCount }))
        : monthlyTrend.map((row) => ({ label: row.monthLabel, value: row.siteCount }));

    const activeSummaryStats = summaryScope === 'yesterday' ? animatedStats.yesterday : animatedStats.yearToDate;

    useEffect(() => {
        const id = window.setInterval(() => {
            setActiveHeroIndex((prev) => (prev + 1) % HERO_SLIDES.length);
        }, 5500);

        return () => window.clearInterval(id);
    }, []);

    const handlePrevHero = () => {
        setActiveHeroIndex((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
    };

    const handleNextHero = () => {
        setActiveHeroIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    };

    const activeHero = HERO_SLIDES[activeHeroIndex];

    return (
        <div className={`relative min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'} overflow-x-hidden`}>
            {/* Video Background (Absolute within main content) */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                {videoUrl && (
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        onEnded={handleVideoEnded}
                        onLoadedData={() => setVideoLoaded(true)}
                        className={`w-full h-full object-cover transition-opacity duration-1000 ${videoLoaded ? (isIntro ? 'opacity-100' : 'opacity-50') : 'opacity-0'}`}
                    >
                        <source src={videoUrl} type="video/mp4" />
                    </video>
                )}
                {/* 항상 어두운 오버레이 표시 (비디오 로딩 전에도) */}
                <div className={`absolute inset-0 bg-slate-900 transition-opacity duration-1000 ${isIntro ? 'opacity-0' : 'opacity-60'}`} />
                <div className={`absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-slate-900/80 transition-opacity duration-1000 ${isIntro ? 'opacity-0' : 'opacity-100'}`} />
            </div>

            {/* 1. Recent Daily Report Highlights */}
            <section className={`relative z-10 w-full px-0 pt-2 pb-20 transition-all duration-1000 ${isIntro ? 'opacity-0 translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
                <div className="mb-10 w-full animate-slideUp">
                    <div className="rounded-none border-y border-white/15 bg-slate-900/45 backdrop-blur-md overflow-hidden md:rounded-none">
                        <div className="relative aspect-[16/8] md:aspect-[16/6] xl:aspect-[16/5.2]">
                            <AnimatePresence mode="wait">
                                <motion.img
                                    key={`${activeHero.stage}-${activeHero.image}`}
                                    src={activeHero.image}
                                    alt={activeHero.stage}
                                    className="absolute inset-0 h-full w-full object-cover"
                                    initial={{ opacity: 0, scale: 1.08, x: 18 }}
                                    animate={{ opacity: 1, scale: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 1.03, x: -18 }}
                                    transition={{ duration: 0.7, ease: 'easeOut' }}
                                />
                            </AnimatePresence>

                            <div className="absolute inset-0 bg-gradient-to-r from-black/78 via-black/48 to-black/20" />

                            <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-8 lg:p-10">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={`hero-copy-${activeHeroIndex}`}
                                        className="max-w-4xl"
                                        initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
                                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                        exit={{ opacity: 0, y: -10, filter: 'blur(8px)' }}
                                        transition={{ duration: 0.45, ease: 'easeOut' }}
                                    >
                                        <div className="inline-flex items-center rounded-full border border-white/30 bg-black/35 px-3 py-1 text-xs font-semibold text-amber-200">
                                            {activeHero.stage}
                                        </div>
                                        <h1 className="mt-3 text-2xl md:text-4xl xl:text-5xl font-bold text-white leading-tight break-keep">
                                            {activeHero.title}
                                        </h1>
                                        <p className="mt-3 text-sm md:text-base xl:text-lg text-slate-200 leading-relaxed break-keep">
                                            {activeHero.description}
                                        </p>
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            <button
                                type="button"
                                onClick={handlePrevHero}
                                className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full border border-white/35 bg-black/30 text-white hover:bg-black/45"
                                aria-label="이전 슬라이드"
                            >
                                <FontAwesomeIcon icon={faChevronLeft} />
                            </button>
                            <button
                                type="button"
                                onClick={handleNextHero}
                                className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full border border-white/35 bg-black/30 text-white hover:bg-black/45"
                                aria-label="다음 슬라이드"
                            >
                                <FontAwesomeIcon icon={faChevronRight} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-2 bg-black/40">
                            {HERO_SLIDES.map((slide, index) => (
                                <button
                                    key={slide.stage}
                                    type="button"
                                    onClick={() => setActiveHeroIndex(index)}
                                    className={`relative overflow-hidden rounded-xl border text-left transition-all ${
                                        activeHeroIndex === index
                                            ? 'border-amber-400/70 ring-1 ring-amber-400/60'
                                            : 'border-white/15 hover:border-white/40'
                                    }`}
                                >
                                    <div className="relative h-20 md:h-24">
                                        <img src={slide.image} alt={slide.stage} className="h-full w-full object-cover" />
                                        <div className={`absolute inset-0 transition-colors ${activeHeroIndex === index ? 'bg-black/30' : 'bg-black/58'}`} />
                                        <div className="absolute inset-x-0 bottom-0 p-2">
                                            <div className="text-[11px] text-amber-200 font-semibold">{slide.stage}</div>
                                            <div className="text-xs text-white truncate">{slide.title}</div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 mt-7">
                        <button
                            className="px-6 py-3 bg-transparent border border-amber-400/60 text-amber-200 rounded-full font-medium text-base transition-all flex items-center gap-2 group hover:bg-amber-500/10 hover:text-amber-300"
                            onClick={handleReplayIntro}
                        >
                            <FontAwesomeIcon icon={faPlay} className="text-sm" /> 브랜드 영상 다시보기
                        </button>
                    </div>
                </div>

                {loadingHighlights ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className="h-72 rounded-3xl bg-white/5 border border-white/10" />
                        ))}
                    </div>
                ) : highlightError ? (
                    <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-6 py-5 text-red-100">
                        {highlightError}
                    </div>
                ) : siteHighlights.length === 0 ? null : (
                    <div className="overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        <div className="flex gap-5 w-max pr-8">
                            {siteHighlights.map((site) => (
                                <article
                                    key={site.key}
                                    className="w-[340px] md:w-[380px] rounded-3xl p-6 bg-white/5 backdrop-blur-md border border-white/10 hover:border-amber-500/50 transition-all duration-300 hover:-translate-y-1"
                                >
                                    <header className="flex items-start justify-between gap-3 mb-4">
                                        <div>
                                            <div className="text-xs text-amber-300/90 tracking-wide uppercase mb-1">최근 일보 {toKoreanDate(site.latestDate)}</div>
                                            <h3 className="text-xl font-bold text-white leading-tight break-keep">{site.siteName}</h3>
                                        </div>
                                        <button
                                            onClick={() => site.siteId ? navigate(`/site/management?siteId=${site.siteId}`) : navigate('/site/management')}
                                            className="text-[11px] px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-200 hover:bg-amber-500/25 transition-colors"
                                        >
                                            현장 보기
                                        </button>
                                    </header>

                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                        <div className="rounded-xl bg-slate-900/70 border border-white/10 p-3 text-center">
                                            <div className="text-lg font-bold text-white">{site.reportCount}</div>
                                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">일보 건수</div>
                                        </div>
                                        <div className="rounded-xl bg-slate-900/70 border border-white/10 p-3 text-center">
                                            <div className="text-lg font-bold text-white">{site.totalWorkers}</div>
                                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">작업자</div>
                                        </div>
                                        <div className="rounded-xl bg-slate-900/70 border border-white/10 p-3 text-center">
                                            <div className="text-lg font-bold text-white">{site.teamNames.length}</div>
                                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">팀</div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {site.teamNames.length > 0 ? site.teamNames.map((team) => (
                                            <span key={team} className="text-[11px] px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-100">
                                                {team}
                                            </span>
                                        )) : (
                                            <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-500/20 border border-slate-400/30 text-slate-200">
                                                팀 정보 미기록
                                            </span>
                                        )}
                                    </div>

                                    <div className="rounded-2xl bg-black/25 border border-white/10 p-4">
                                        <div className="flex items-center gap-2 text-xs text-slate-300 mb-3 uppercase tracking-wider">
                                            <FontAwesomeIcon icon={faUsers} className="text-amber-300" /> 투입 작업자
                                        </div>
                                        <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto pr-1">
                                            {site.workers.map((worker) => (
                                                <div key={worker.id} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/10 text-sm text-white">
                                                    <span className="w-5 h-5 rounded-full bg-amber-500/25 text-amber-100 text-[11px] flex items-center justify-center font-bold">
                                                        {worker.name.slice(0, 1)}
                                                    </span>
                                                    <span className="font-medium">{worker.name}</span>
                                                    <span className="text-[10px] text-slate-300">{worker.role}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <footer className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
                                        <span className="inline-flex items-center gap-1"><FontAwesomeIcon icon={faCalendarDays} /> 최근 업데이트 {toKoreanDate(site.latestDate)}</span>
                                        <span className="inline-flex items-center gap-1"><FontAwesomeIcon icon={faBuilding} /> 청연ENG 출력일보</span>
                                    </footer>
                                </article>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* Stats Cards Section */}
            <section className={`relative z-10 px-8 pb-20 max-w-[1800px] mx-auto transition-all duration-1000 ${isIntro ? 'opacity-0 translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
                <motion.div
                    variants={statSectionVariant}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                    className="flex items-center gap-3 mb-4"
                >
                    <span className={`w-2 h-2 rounded-full animate-pulse ${trendMode === 'daily' ? 'bg-amber-500' : 'bg-cyan-400'}`} />
                    <span className={`text-sm font-semibold tracking-widest uppercase ${trendMode === 'daily' ? 'text-amber-300' : 'text-cyan-300'}`}>
                        {trendMode === 'daily' ? '최근 한달 일자별 지표' : `올해 1월 ~ 현재월 월별 지표 (${new Date().getFullYear()}년)`}
                    </span>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {loadingStats
                        ? Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse" />
                        ))
                        : STAT_METRICS.map((metric) => (
                            <motion.div
                                key={`summary-${metric.key}`}
                                variants={statSectionVariant}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true, amount: 0.2 }}
                                className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/20 p-5 flex items-center gap-4 text-left"
                            >
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${metric.color} flex items-center justify-center text-white text-xl flex-shrink-0 shadow-lg`}>
                                    <FontAwesomeIcon icon={metric.icon} />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-white">
                                        {formatStatValue(activeSummaryStats[metric.key], metric.decimals || 0)}{metric.unit}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5">{metric.label}</div>
                                </div>
                            </motion.div>
                        ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <motion.div
                        variants={statSectionVariant}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.7, delay: 0 }}
                        className="rounded-2xl bg-white/5 border border-white/10 p-5 backdrop-blur-md"
                    >
                        <h4 className="text-sm text-amber-200 font-semibold mb-3">
                            {trendMode === 'daily' ? '최근 한달 일자별 투입 공수' : '올해 1월부터 현재월까지 월별 투입 공수'}
                        </h4>
                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={manDayGraphData}>
                                    <XAxis
                                        dataKey="label"
                                        interval={0}
                                        minTickGap={0}
                                        height={64}
                                        tick={{ fill: '#cbd5e1', fontSize: 10 }}
                                        angle={-45}
                                        textAnchor="end"
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        formatter={(value?: number) => [`${formatStatValue(Number(value ?? 0), 1)}`, '투입 공수']}
                                        labelFormatter={(label: string) => trendMode === 'daily' ? `${label}` : `${label}월`}
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                                    />
                                    <Bar
                                        key={`manDay-${trendMode}`}
                                        dataKey="value"
                                        fill="#06b6d4"
                                        radius={[6, 6, 0, 0]}
                                        isAnimationActive={false}
                                        shape={(props: any) => <AnimatedBarShape {...props} />}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    <motion.div
                        variants={statSectionVariant}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.7, delay: 0.2 }}
                        className="rounded-2xl bg-white/5 border border-white/10 p-5 backdrop-blur-md"
                    >
                        <h4 className="text-sm text-cyan-200 font-semibold mb-3">
                            {trendMode === 'daily' ? '최근 한달 일자별 출력 현장 수' : '올해 1월부터 현재월까지 월별 출력 현장 수'}
                        </h4>
                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={siteGraphData}>
                                    <XAxis
                                        dataKey="label"
                                        interval={0}
                                        minTickGap={0}
                                        height={64}
                                        tick={{ fill: '#cbd5e1', fontSize: 10 }}
                                        angle={-45}
                                        textAnchor="end"
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        formatter={(value?: number) => [`${Number(value ?? 0).toLocaleString()}개 현장`, '현장 수']}
                                        labelFormatter={(label: string) => trendMode === 'daily' ? `${label}` : `${label}월`}
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                                    />
                                    <Bar
                                        key={`site-${trendMode}`}
                                        dataKey="value"
                                        fill="#06b6d4"
                                        radius={[6, 6, 0, 0]}
                                        isAnimationActive={false}
                                        shape={(props: any) => <AnimatedBarShape {...props} />}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* 2. Feature Cards Section */}
            <div className="relative z-10 px-8 py-32 max-w-[1800px] mx-auto">
                <div className="mb-20">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Innovative <span className="text-amber-500">System</span></h2>
                    <div className="w-20 h-1 bg-amber-500 rounded-full mb-6"></div>
                    <p className="text-xl text-slate-400 max-w-2xl break-keep">
                        체계적인 관리 시스템과 투명한 운영으로 건설 문화를 선도합니다.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        {
                            icon: faNetworkWired,
                            title: '체계적인 ERP 구축',
                            desc: '자체 개발된 전사적 자원 관리(ERP) 시스템을 통해 인력, 자재, 비용 등 현장의 모든 요소를 데이터화하여 통합 관리합니다. 불필요한 누수를 막고 공정 효율을 극대화하여 스마트한 건설 환경을 조성합니다.',
                            color: 'from-amber-400 to-orange-500'
                        },
                        {
                            icon: faChartLine,
                            title: '실시간 현황 제공',
                            desc: '클라이언트에게 전용 대시보드를 통해 공정률, 투입 인력, 자재 현황을 실시간으로 투명하게 공유합니다. 데이터에 기반한 정확한 의사결정을 돕고, 현장 상황을 언제 어디서나 모니터링할 수 있는 신뢰 서비스를 제공합니다.',
                            color: 'from-blue-400 to-cyan-500'
                        },
                        {
                            icon: faHelmetSafety,
                            title: '투명한 상생 경영',
                            desc: '근로자의 노무비 지급 내역과 근태를 투명하게 공개하고 정직하게 정산하여, 현장 근로자와의 깊은 신뢰를 구축합니다. 모두가 만족하는 공정한 근로 문화를 정착시켜 장기적인 상생 파트너십을 실현합니다.',
                            color: 'from-emerald-400 to-green-500'
                        },
                        {
                            icon: faHandshake,
                            title: '광범위한 협력 네트워크',
                            desc: '다수의 전문 협력사 및 시공팀과 강력한 네트워크를 형성하여, 현장 규모와 특성에 맞는 최적의 숙련공을 즉시 배치합니다. 긴급한 공정 변경에도 유연하게 대처하며, 압도적인 기동력으로 빠르고 완벽한 시공을 약속합니다.',
                            color: 'from-purple-400 to-pink-500'
                        }
                    ].map((card, idx) => (
                        <div key={idx} className="group relative p-8 rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-amber-500/50 transition-all duration-300 hover:-translate-y-2 overflow-hidden">
                            {/* Graphic Blob */}
                            <div className={`absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br ${card.color} rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500`} />

                            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white text-2xl mb-6 shadow-lg`}>
                                <FontAwesomeIcon icon={card.icon} />
                            </div>

                            <h3 className="text-2xl font-bold text-white mb-3">{card.title}</h3>
                            <p className="text-slate-400 leading-relaxed mb-6 group-hover:text-slate-300 transition-colors">
                                {card.desc}
                            </p>

                            <div className="flex items-center gap-2 text-sm font-bold text-white/40 group-hover:text-amber-500 transition-colors cursor-pointer uppercase tracking-wider">
                                Learn More <FontAwesomeIcon icon={faArrowRight} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Stats (Moved to Footer area for continuity) */}
            <div className="relative z-10 border-t border-white/10 bg-black/40 backdrop-blur-xl">
                <div className="max-w-[1800px] mx-auto px-8 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
                    {[
                        { label: 'Active Sites', value: '124' },
                        { label: 'Workers Today', value: '3,402' },
                        { label: 'Safety Index', value: '99.9%' },
                        { label: 'AI Detections', value: '24/7' },
                    ].map((stat, idx) => (
                        <div key={idx} className="flex flex-col items-center justify-center text-center p-4">
                            <span className="text-4xl font-bold text-white font-display mb-2">{stat.value}</span>
                            <span className="text-sm text-slate-400 uppercase tracking-widest">{stat.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CheongyeonHome;
