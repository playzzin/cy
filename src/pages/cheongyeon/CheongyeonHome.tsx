import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRight,
    faBuilding,
    faCalendarDays,
    faChartLine,
    faChevronDown,
    faHandshake,
    faHelmetSafety,
    faNetworkWired,
    faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { motion, useReducedMotion } from 'framer-motion';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';
import { companyService } from '../../services/companyService';
import { useSiteMode } from '../../contexts/SiteModeContext';
import logoConstruction from '../../assets/logo_construction.jpg';
import ceoPortrait from '../../assets/ceo_portrait.png';

const dashboard2HeroImageUrl =
    'https://firebasestorage.googleapis.com/v0/b/cyee-9c1e4.firebasestorage.app/o/gallery%2Fai-images%2Flogo%2Flogo_1779750129138.png?alt=media&token=579fa7a2-e3f4-4817-b516-12905bb4b391';
const dashboard2HeroVideoId = 'itZAJ91VXLM';
const dashboard2HeroVideoThumbnailUrl = `https://i.ytimg.com/vi/${dashboard2HeroVideoId}/hqdefault.jpg`;

const getDashboard2HeroVideoUrl = () => {
    const baseUrl = `https://www.youtube.com/embed/${dashboard2HeroVideoId}?autoplay=1&mute=1&loop=1&playlist=${dashboard2HeroVideoId}&playsinline=1&rel=0&controls=0&disablekb=1&fs=0&iv_load_policy=3&modestbranding=1`;

    if (typeof window === 'undefined') return baseUrl;

    const origin = encodeURIComponent(window.location.origin);
    const pageUrl = encodeURIComponent(window.location.href);
    return `${baseUrl}&origin=${origin}&widget_referrer=${pageUrl}`;
};

type DailyStatRow = {
    totalWorkers: number;
    totalManDay: number;
    siteCount: number;
    teamCount: number;
};

type DailyTrendRow = {
    dateKey: string;
    dateLabel: string;
    totalManDay: number;
    siteCount: number;
};

type SiteWorkerHighlight = {
    id: string;
    name: string;
    role: string;
    shifts: number;
};

type SiteHighlight = {
    key: string;
    siteName: string;
    latestDate: string;
    reportCount: number;
    totalWorkers: number;
    teamNames: string[];
    workers: SiteWorkerHighlight[];
};

type CompanyProfile = {
    name: string;
    businessNumber: string;
    phone: string;
    address: string;
};

type DashboardSnapshot = {
    latest: DailyStatRow;
    yearToDate: DailyStatRow;
    latestDateLabel: string;
    trend: DailyTrendRow[];
    highlights: SiteHighlight[];
};

type OperatingChartType = 'bar' | 'pie' | 'balance';

type OperatingMetricPanel = {
    key: string;
    eyebrow: string;
    title: string;
    summary: string;
    chartType: OperatingChartType;
    score: string;
    accent: string;
    barData: { name: string; value: number }[];
    pieData: { name: string; value: number; color: string }[];
    balanceData: {
        name: string;
        leftLabel: string;
        leftValue: number;
        rightLabel: string;
        rightValue: number;
    }[];
};

const emptyStats: DailyStatRow = {
    totalWorkers: 0,
    totalManDay: 0,
    siteCount: 0,
    teamCount: 0,
};

const toDateString = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const toDateNumber = (date: unknown): number => Number(String(date || '').replace(/-/g, '')) || 0;

const toKoreanDate = (date: string): string => {
    const [year, month, day] = String(date || '').split('-');
    if (!year || !month || !day) return '-';
    return `${year}.${month}.${day}`;
};

const formatNumber = (value: number, decimals = 0): string =>
    Number(value || 0).toLocaleString('ko-KR', {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
    });

const formatBusinessNumber = (value: string): string => {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length !== 10) return value || '등록 정보 확인 중';
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
};

const buildDateKeys = (days: number): string[] => {
    const end = new Date();
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(end.getDate() - (days - 1));

    return Array.from({ length: days }, (_, index) => {
        const current = new Date(start);
        current.setDate(start.getDate() + index);
        return toDateString(current);
    });
};

const computeStatRow = (reports: DailyReport[]): DailyStatRow => {
    const workers = new Set<string>();
    const sites = new Set<string>();
    const teams = new Set<string>();
    let totalManDay = 0;

    reports.forEach((report) => {
        const siteKey = String(report.siteId || report.siteName || '').trim();
        const teamKey = String((report as any).teamId || report.teamName || '').trim();
        if (siteKey) sites.add(siteKey);
        if (teamKey) teams.add(teamKey);

        (report.workers || []).forEach((worker) => {
            const workerKey = String(worker.workerId || worker.name || '').trim();
            if (workerKey) workers.add(workerKey);
            totalManDay += typeof worker.manDay === 'number' ? worker.manDay : 0;
        });
    });

    return {
        totalWorkers: workers.size,
        totalManDay: Math.round(totalManDay * 10) / 10,
        siteCount: sites.size,
        teamCount: teams.size,
    };
};

const buildDailyTrend = (reports: DailyReport[], dateKeys: string[]): DailyTrendRow[] => {
    const buckets = new Map<string, { totalManDay: number; siteSet: Set<string> }>();
    dateKeys.forEach((key) => buckets.set(key, { totalManDay: 0, siteSet: new Set<string>() }));

    reports.forEach((report) => {
        const dateKey = String(report.date || '').trim();
        const bucket = buckets.get(dateKey);
        if (!bucket) return;

        const siteKey = String(report.siteId || report.siteName || '').trim();
        if (siteKey) bucket.siteSet.add(siteKey);

        (report.workers || []).forEach((worker) => {
            bucket.totalManDay += typeof worker.manDay === 'number' ? worker.manDay : 0;
        });
    });

    return dateKeys.map((dateKey) => {
        const bucket = buckets.get(dateKey);
        return {
            dateKey,
            dateLabel: dateKey.slice(5).replace('-', '.'),
            totalManDay: Math.round((bucket?.totalManDay || 0) * 10) / 10,
            siteCount: bucket?.siteSet.size || 0,
        };
    });
};

const buildSiteHighlights = (reports: DailyReport[]): SiteHighlight[] => {
    const grouped = new Map<string, {
        key: string;
        siteName: string;
        latestDate: string;
        reportCount: number;
        teamNames: Set<string>;
        workerMap: Map<string, SiteWorkerHighlight>;
    }>();

    [...reports]
        .sort((a, b) => toDateNumber(b.date) - toDateNumber(a.date))
        .forEach((report) => {
            const siteName = String(report.siteName || '').trim() || '현장명 미등록';
            const siteId = String(report.siteId || '').trim();
            const key = siteId || `site:${siteName}`;

            if (!grouped.has(key)) {
                grouped.set(key, {
                    key,
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
                const name = String(worker.name || '').trim() || `작업자 ${index + 1}`;
                const workerId = String(worker.workerId || '').trim();
                const workerKey = workerId || `${name}:${index}`;
                const role = String(worker.role || '').trim() || '작업';
                const shifts = Number(worker.manDay) > 0 ? Number(worker.manDay) : 1;
                const existing = bucket.workerMap.get(workerKey);

                if (existing) {
                    existing.shifts += shifts;
                    if (existing.role === '작업' && role !== '작업') existing.role = role;
                    return;
                }

                bucket.workerMap.set(workerKey, { id: workerKey, name, role, shifts });
            });
        });

    return Array.from(grouped.values())
        .map((bucket) => ({
            key: bucket.key,
            siteName: bucket.siteName,
            latestDate: bucket.latestDate,
            reportCount: bucket.reportCount,
            totalWorkers: bucket.workerMap.size,
            teamNames: Array.from(bucket.teamNames).slice(0, 3),
            workers: Array.from(bucket.workerMap.values())
                .sort((a, b) => b.shifts - a.shifts)
                .slice(0, 5),
        }))
        .sort((a, b) => toDateNumber(b.latestDate) - toDateNumber(a.latestDate))
        .slice(0, 6);
};

const buildSnapshot = (recentReports: DailyReport[], yearReports: DailyReport[]): DashboardSnapshot => {
    const dateKeys = buildDateKeys(14);
    const latestDate = recentReports.reduce((latest, report) => {
        const reportDate = String(report.date || '');
        return toDateNumber(reportDate) > toDateNumber(latest) ? reportDate : latest;
    }, '');
    const latestReports = latestDate
        ? recentReports.filter((report) => String(report.date || '') === latestDate)
        : [];

    return {
        latest: computeStatRow(latestReports),
        yearToDate: computeStatRow(yearReports),
        latestDateLabel: latestDate ? toKoreanDate(latestDate) : '최근 일보 없음',
        trend: buildDailyTrend(recentReports, dateKeys),
        highlights: buildSiteHighlights(recentReports),
    };
};

const defaultSnapshot: DashboardSnapshot = {
    latest: emptyStats,
    yearToDate: emptyStats,
    latestDateLabel: '최근 일보 없음',
    trend: buildDailyTrend([], buildDateKeys(14)),
    highlights: [],
};

const introStats = [
    { label: '현장 중심', value: 'FIELD', caption: '실행 단위에서 출발하는 운영' },
    { label: '데이터 기반', value: 'DATA', caption: '일보와 공수를 한 흐름으로 연결' },
    { label: '지속 성장', value: 'IMPACT', caption: '사람과 지역이 함께 커지는 구조' },
];

const visionPillars = [
    {
        title: '현장의 리듬을 읽는 회사',
        desc: '공정, 인력, 장비, 협력사의 움직임을 매일 기록하고 다음 실행으로 이어갑니다.',
        tone: '#4f7cff',
    },
    {
        title: '숫자로 판단하는 운영',
        desc: '추측보다 기록을, 회의보다 공유된 지표를 우선해 빠르게 의사결정합니다.',
        tone: '#00b894',
    },
    {
        title: '신뢰를 남기는 시공',
        desc: '안전과 품질, 정산 투명성을 함께 관리해 오래 지속되는 협업 기반을 만듭니다.',
        tone: '#ff8a00',
    },
];

const systemSteps = [
    {
        icon: faCalendarDays,
        title: '기록',
        desc: '일보와 현장 정보를 지정 주기로 정리합니다.',
        accent: '#4f7cff',
    },
    {
        icon: faUsers,
        title: '배치',
        desc: '팀, 현장, 작업자 단위로 투입 흐름을 확인합니다.',
        accent: '#7c3aed',
    },
    {
        icon: faChartLine,
        title: '분석',
        desc: '공수와 현장별 변화를 데이터로 비교합니다.',
        accent: '#00b894',
    },
    {
        icon: faHandshake,
        title: '공유',
        desc: '운영자가 같은 숫자를 보고 빠르게 결정합니다.',
        accent: '#ff8a00',
    },
];

const architectureSteps = [
    { label: '현장 입력', desc: '작업자, 팀, 공정 기록 수집' },
    { label: '운영 검토', desc: '일보 누락과 공수 흐름 점검' },
    { label: '의사결정', desc: '현장별 배치와 협력사 대응' },
    { label: '성과 축적', desc: '누적 공수와 포트폴리오 기록' },
];

const businessCards = [
    {
        icon: faHelmetSafety,
        title: '건설 시공 운영',
        desc: '현장 공정, 인력 투입, 안전과 품질을 실행 단위로 연결합니다.',
        detail: '현장별 작업 흐름과 투입 데이터를 함께 보며 운영 병목을 줄입니다.',
        color: '#4f7cff',
    },
    {
        icon: faUsers,
        title: '인력 및 팀 운영',
        desc: '팀별 리더와 구성원을 기준으로 배치와 출역 흐름을 관리합니다.',
        detail: '작업자 이력과 팀 단위 실적을 함께 살펴 안정적인 인력 운영을 돕습니다.',
        color: '#7c3aed',
    },
    {
        icon: faNetworkWired,
        title: 'ERP 시스템 구축',
        desc: '일보, 현장, 정산, 작업자 정보를 하나의 운영 화면으로 묶습니다.',
        detail: '반복 입력을 줄이고 운영자가 필요한 판단 근거를 빠르게 찾도록 설계합니다.',
        color: '#00b894',
    },
    {
        icon: faBuilding,
        title: '협력사 네트워크',
        desc: '협력사와 현장을 투명하게 연결해 안정적인 수행 구조를 만듭니다.',
        detail: '시공사, 파트너, 현장 관계자가 같은 기준으로 진행 상황을 공유합니다.',
        color: '#ff8a00',
    },
];

const businessPipelines = [
    '현장 개설',
    '팀 편성',
    '일보 수집',
    '공수 분석',
    '정산 연결',
    '성과 기록',
];

const businessAccordionItems = [
    {
        title: '청연 시스템은 어떤 흐름으로 현장에 적용되나요?',
        summary: '현장 개설, 팀 편성, 일보 수집, 공수 분석, 정산 연결까지 한 흐름으로 설계합니다.',
        detail: '처음에는 현장과 팀 기준을 정리하고, 이후 매일의 작업 기록을 축적합니다. 누적된 기록은 인력 운영, 공정 확인, 협력사 소통, 정산 근거로 다시 연결됩니다.',
    },
    {
        title: '관리자가 매일 확인해야 하는 핵심 정보는 무엇인가요?',
        summary: '오늘 투입 인원, 누적 공수, 활성 현장, 최근 일보 상태를 우선 확인합니다.',
        detail: '반복 확인이 필요한 숫자는 상단 지표로 끌어올리고, 상세 흐름은 그래프와 현장 카드에서 확인하도록 구성했습니다. 운영자는 화면을 훑는 것만으로도 이상 징후를 빠르게 찾을 수 있습니다.',
    },
    {
        title: '상용 서비스 화면으로 확장할 때 중요한 기준은 무엇인가요?',
        summary: '소개, 운영, 증빙, 문의 전환이 한 화면에서 자연스럽게 이어져야 합니다.',
        detail: '방문자는 회사의 방향을 이해하고, 내부 사용자는 실제 운영 지표를 확인하며, 의사결정자는 시스템 도입 가치를 판단할 수 있어야 합니다. 그래서 단순 홍보형 화면보다 운영 데이터 중심으로 구성했습니다.',
    },
    {
        title: '협력사와 현장 팀은 어떤 방식으로 연결되나요?',
        summary: '현장별 팀, 작업자, 일보 기록을 같은 기준으로 묶어 신뢰할 수 있는 운영 이력을 만듭니다.',
        detail: '협력사는 작업 근거를 명확히 남기고, 현장 관리자는 투입과 공정 흐름을 확인합니다. 같은 기록을 기반으로 소통하므로 보고, 정산, 의사결정의 기준이 흔들리지 않습니다.',
    },
];

const impactCards = [
    {
        title: '안전한 현장 문화',
        desc: '기록과 공유를 통해 위험 요소를 미리 발견하고 현장 안전 기준을 높입니다.',
    },
    {
        title: '공정한 근로 환경',
        desc: '출역과 공수 데이터를 투명하게 관리해 근로자와 협력사의 신뢰를 높입니다.',
    },
    {
        title: '지역과 함께 성장',
        desc: '현장 중심의 일자리와 협력 네트워크를 안정적으로 이어갑니다.',
    },
];

const impactMetrics = [
    { label: '안전 기준', value: 'PREVENT', desc: '위험을 먼저 보는 기록 체계' },
    { label: '정산 신뢰', value: 'CLEAR', desc: '근거가 남는 공수 관리' },
    { label: '협력 성장', value: 'TOGETHER', desc: '파트너와 함께 확장하는 현장' },
];

const operatingHighlights = [
    {
        eyebrow: '현장 통합',
        title: '매일의 현장을 한 화면으로',
        desc: '현장, 팀, 작업자, 일보를 분리하지 않고 같은 흐름에서 확인합니다.',
        metric: 'ONE',
        helper: '통합 운영 화면',
    },
    {
        eyebrow: '의사결정',
        title: '숫자가 먼저 보이는 구조',
        desc: '공수와 현장 수, 최근 일보 기준을 상단에서 바로 확인해 운영 판단을 빠르게 만듭니다.',
        metric: 'LIVE',
        helper: '실시간 집계 기준',
    },
    {
        eyebrow: '확장성',
        title: '조직 성장에 맞춰 확장',
        desc: '현장 수와 협력사, 팀 구조가 늘어나도 같은 기준으로 관리할 수 있게 설계합니다.',
        metric: 'SCALE',
        helper: '사업 확장 대응',
    },
];

const operatingMetricPanels: OperatingMetricPanel[] = [
    {
        key: 'field-unified',
        eyebrow: '통합 운영 지표',
        title: '가로 막대그래프',
        summary: '현장, 팀, 작업자, 일보가 한 화면에서 연결되는 수준을 좌에서 우로 읽는 막대그래프로 보여줍니다.',
        chartType: 'bar',
        score: '92%',
        accent: '#4f7cff',
        barData: [
            { name: '현장', value: 88 },
            { name: '팀', value: 92 },
            { name: '일보', value: 96 },
        ],
        pieData: [],
        balanceData: [],
    },
    {
        key: 'decision-live',
        eyebrow: '통합 운영 지표',
        title: '원그래프',
        summary: '핵심 운영 항목의 비중을 원그래프로 보여줘 어떤 지표가 큰 비중을 차지하는지 바로 확인합니다.',
        chartType: 'pie',
        score: '88%',
        accent: '#00b894',
        barData: [],
        pieData: [
            { name: '공수', value: 38, color: '#00b894' },
            { name: '현장', value: 28, color: '#4f7cff' },
            { name: '팀', value: 34, color: '#ff8a00' },
        ],
        balanceData: [],
    },
    {
        key: 'scale-ready',
        eyebrow: '통합 운영 지표',
        title: '발란스 그래프',
        summary: '현장과 본사, 실행과 보고, 단기와 장기 운영 균형을 좌우 비교 그래프로 보여줍니다.',
        chartType: 'balance',
        score: '84%',
        accent: '#7c3aed',
        barData: [],
        pieData: [],
        balanceData: [
            { name: '운영 집중도', leftLabel: '현장', leftValue: 58, rightLabel: '본사', rightValue: 42 },
            { name: '처리 흐름', leftLabel: '실행', leftValue: 54, rightLabel: '보고', rightValue: 46 },
            { name: '성장 기준', leftLabel: '단기', leftValue: 47, rightLabel: '장기', rightValue: 53 },
        ],
    },
];

const enterpriseProofs = [
    {
        title: '운영자 관점의 정보 밀도',
        body: '상단은 핵심 숫자, 중단은 흐름, 하단은 실행 카드로 구성해 반복 사용에도 피로하지 않게 정리합니다.',
    },
    {
        title: '데이터 기반의 신뢰 확보',
        body: '최근 일보, 누적 공수, 현장별 신호를 함께 보여 보고와 정산의 근거가 남도록 만듭니다.',
    },
    {
        title: '브랜드형 랜딩 품질',
        body: '회사 소개 페이지이면서 실제 시스템의 운영 가치를 보여주는 상용 서비스형 화면으로 구성합니다.',
    },
];

const fallbackHighlights: SiteHighlight[] = [
    {
        key: 'fallback-field',
        siteName: '현장 데이터 준비 중',
        latestDate: '',
        reportCount: 0,
        totalWorkers: 0,
        teamNames: ['운영팀'],
        workers: [],
    },
    {
        key: 'fallback-system',
        siteName: '일보 흐름 점검 중',
        latestDate: '',
        reportCount: 0,
        totalWorkers: 0,
        teamNames: ['관리팀'],
        workers: [],
    },
    {
        key: 'fallback-impact',
        siteName: '성과 기록 축적 중',
        latestDate: '',
        reportCount: 0,
        totalWorkers: 0,
        teamNames: ['전략팀'],
        workers: [],
    },
];

type AnimatedNumberProps = {
    value: number;
    decimals?: number;
    suffix?: string;
    className?: string;
};

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, decimals = 0, suffix = '', className }) => {
    const shouldReduceMotion = useReducedMotion();
    const numberRef = useRef<HTMLSpanElement | null>(null);
    const frameRef = useRef(0);
    const [display, setDisplay] = useState(() => (shouldReduceMotion ? value : 0));

    useEffect(() => {
        if (shouldReduceMotion) {
            setDisplay(value);
            return;
        }

        const element = numberRef.current;
        if (!element) return;

        const startAnimation = () => {
            cancelAnimationFrame(frameRef.current);
            setDisplay(0);

            const start = performance.now();
            const duration = 950;

            const tick = (now: number) => {
                const progress = Math.min(1, (now - start) / duration);
                const eased = 1 - Math.pow(1 - progress, 3);
                setDisplay(value * eased);
                if (progress < 1) frameRef.current = requestAnimationFrame(tick);
            };

            frameRef.current = requestAnimationFrame(tick);
        };

        let wasInView = false;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !wasInView) {
                wasInView = true;
                startAnimation();
                return;
            }

            if (!entry.isIntersecting) {
                wasInView = false;
                cancelAnimationFrame(frameRef.current);
                setDisplay(0);
            }
        }, {
            rootMargin: '-8% 0px -8% 0px',
            threshold: 0.35,
        });

        observer.observe(element);

        return () => {
            observer.disconnect();
            cancelAnimationFrame(frameRef.current);
        };
    }, [decimals, shouldReduceMotion, value]);

    return <span ref={numberRef} className={className}>{formatNumber(display, decimals)}{suffix}</span>;
};

const CheongyeonHome: React.FC = () => {
    const { isDarkMode } = useSiteMode();
    const shouldReduceMotion = useReducedMotion();
    const [snapshot, setSnapshot] = useState<DashboardSnapshot>(defaultSnapshot);
    const [companyProfile, setCompanyProfile] = useState<CompanyProfile>({
        name: '청연이엔지',
        businessNumber: '',
        phone: '',
        address: '',
    });
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [openAccordionIndex, setOpenAccordionIndex] = useState(0);
    const [selectedOperatingIndex, setSelectedOperatingIndex] = useState(0);
    const operatingBarChartRef = useRef<HTMLDivElement | null>(null);
    const operatingBarChartWasInViewRef = useRef(false);
    const chartRef = useRef<HTMLDivElement | null>(null);
    const chartWasInViewRef = useRef(false);
    const [operatingBarChartInView, setOperatingBarChartInView] = useState(false);
    const [operatingBarChartAnimationKey, setOperatingBarChartAnimationKey] = useState(0);
    const [chartWidth, setChartWidth] = useState(0);
    const [chartAnimationKey, setChartAnimationKey] = useState(0);
    const [chartVisibleDays, setChartVisibleDays] = useState(0);
    const dashboard2HeroVideoUrl = useMemo(getDashboard2HeroVideoUrl, []);
    const [isDashboard2HeroVideoVisible, setIsDashboard2HeroVideoVisible] = useState(false);

    const revealVariant = useMemo(() => ({
        hidden: { opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 34 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: shouldReduceMotion ? 0 : 0.72,
            },
        },
    }), [shouldReduceMotion]);

    const staggerVariant = useMemo(() => ({
        hidden: {},
        visible: {
            transition: {
                staggerChildren: shouldReduceMotion ? 0 : 0.09,
                delayChildren: shouldReduceMotion ? 0 : 0.08,
            },
        },
    }), [shouldReduceMotion]);

    useEffect(() => {
        document.body.classList.add('dashboard2-codeit-theme');
        return () => document.body.classList.remove('dashboard2-codeit-theme');
    }, []);

    useEffect(() => {
        const revealTimer = window.setTimeout(() => {
            setIsDashboard2HeroVideoVisible(true);
        }, 5000);

        return () => window.clearTimeout(revealTimer);
    }, []);

    useEffect(() => {
        const element = chartRef.current;
        if (!element) return;

        const updateChartWidth = () => {
            setChartWidth(Math.max(0, Math.floor(element.getBoundingClientRect().width)));
        };

        updateChartWidth();

        const observer = new ResizeObserver(updateChartWidth);
        observer.observe(element);
        window.addEventListener('resize', updateChartWidth);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateChartWidth);
        };
    }, []);

    useEffect(() => {
        const element = chartRef.current;
        if (!element || shouldReduceMotion) return;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !chartWasInViewRef.current) {
                chartWasInViewRef.current = true;
                setChartVisibleDays(0);
                setChartAnimationKey((key) => key + 1);
                return;
            }

            if (!entry.isIntersecting) {
                chartWasInViewRef.current = false;
                setChartVisibleDays(0);
            }
        }, {
            rootMargin: '-12% 0px -12% 0px',
            threshold: 0.32,
        });

        observer.observe(element);
        return () => observer.disconnect();
    }, [shouldReduceMotion]);

    useEffect(() => {
        const totalDays = snapshot.trend.length;

        if (shouldReduceMotion) {
            setChartVisibleDays(totalDays);
            return;
        }

        if (chartAnimationKey <= 0 || totalDays === 0) {
            setChartVisibleDays(0);
            return;
        }

        let nextDay = 0;
        setChartVisibleDays(0);

        const timer = window.setInterval(() => {
            nextDay += 1;
            setChartVisibleDays(Math.min(nextDay, totalDays));

            if (nextDay >= totalDays) {
                window.clearInterval(timer);
            }
        }, 130);

        return () => window.clearInterval(timer);
    }, [chartAnimationKey, shouldReduceMotion, snapshot.trend.length]);

    useEffect(() => {
        let cancelled = false;

        const loadDashboard = async () => {
            setLoading(true);
            setLoadError('');

            try {
                const today = new Date();
                const recentStart = new Date(today);
                recentStart.setDate(today.getDate() - 30);
                const yearStart = new Date(today.getFullYear(), 0, 1);

                const [recentReports, yearReports, company] = await Promise.all([
                    dailyReportService.getReports({
                        startDate: toDateString(recentStart),
                        endDate: toDateString(today),
                    }),
                    dailyReportService.getReports({
                        startDate: toDateString(yearStart),
                        endDate: toDateString(today),
                    }),
                    companyService.getMyCompanyInfo().catch(() => null),
                ]);

                if (cancelled) return;

                setSnapshot(buildSnapshot(recentReports, yearReports));
                if (company) {
                    setCompanyProfile({
                        name: company.name || '청연이엔지',
                        businessNumber: String((company as any).businessNumber || ''),
                        phone: String((company as any).phone || (company as any).tel || ''),
                        address: String((company as any).address || ''),
                    });
                }
            } catch (error) {
                console.error('Failed to load dashboard2 data:', error);
                if (!cancelled) {
                    setSnapshot(defaultSnapshot);
                    setLoadError('대시보드 데이터를 불러오지 못했습니다.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadDashboard();

        return () => {
            cancelled = true;
        };
    }, []);

    const heroStats = useMemo(() => [
        {
            label: '최근 투입 인원',
            value: snapshot.latest.totalWorkers,
            unit: '명',
            decimals: 0,
        },
        {
            label: '올해 누적 공수',
            value: snapshot.yearToDate.totalManDay,
            unit: '공수',
            decimals: 1,
        },
        {
            label: '최근 활성 현장',
            value: snapshot.latest.siteCount,
            unit: '곳',
            decimals: 0,
        },
    ], [snapshot]);

    const summaryCards = useMemo(() => [
        {
            label: '최근 일보 기준',
            value: snapshot.latestDateLabel,
            helper: loading ? '집계 중' : '가장 최근 등록된 일보',
            icon: faCalendarDays,
            color: '#4f7cff',
        },
        {
            label: '최근 현장',
            value: `${formatNumber(snapshot.latest.siteCount)}곳`,
            helper: `${formatNumber(snapshot.latest.teamCount)}개 팀 연결`,
            icon: faBuilding,
            color: '#00b894',
        },
        {
            label: '올해 누적 인원',
            value: `${formatNumber(snapshot.yearToDate.totalWorkers)}명`,
            helper: `${formatNumber(snapshot.yearToDate.totalManDay, 1)} 공수 기록`,
            icon: faUsers,
            color: '#7c3aed',
        },
    ], [loading, snapshot]);

    const displayHighlights = useMemo(
        () => (snapshot.highlights.length > 0 ? snapshot.highlights : fallbackHighlights),
        [snapshot.highlights],
    );

    const animatedTrend = useMemo(() => (
        snapshot.trend.map((row, index) => (
            index < chartVisibleDays
                ? row
                : { ...row, totalManDay: 0, siteCount: 0 }
        ))
    ), [chartVisibleDays, snapshot.trend]);

    const selectedOperatingMetric = operatingMetricPanels[selectedOperatingIndex] || operatingMetricPanels[0];
    const animatedOperatingBarData = useMemo(
        () => selectedOperatingMetric.barData.map((row) => ({
            ...row,
            value: shouldReduceMotion || operatingBarChartInView ? row.value : 0,
        })),
        [operatingBarChartInView, selectedOperatingMetric, shouldReduceMotion],
    );

    useEffect(() => {
        if (selectedOperatingMetric.chartType !== 'bar') {
            setOperatingBarChartInView(true);
            return;
        }

        if (shouldReduceMotion || typeof IntersectionObserver === 'undefined') {
            setOperatingBarChartInView(true);
            return;
        }

        const element = operatingBarChartRef.current;
        setOperatingBarChartInView(false);
        operatingBarChartWasInViewRef.current = false;
        if (!element) return;

        let frameId = 0;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !operatingBarChartWasInViewRef.current) {
                operatingBarChartWasInViewRef.current = true;
                setOperatingBarChartInView(false);
                frameId = window.requestAnimationFrame(() => {
                    setOperatingBarChartAnimationKey((key) => key + 1);
                    setOperatingBarChartInView(true);
                });
                return;
            }

            if (!entry.isIntersecting) {
                operatingBarChartWasInViewRef.current = false;
                setOperatingBarChartInView(false);
            }
        }, {
            rootMargin: '-16% 0px -16% 0px',
            threshold: 0.28,
        });

        observer.observe(element);

        return () => {
            observer.disconnect();
            if (frameId) window.cancelAnimationFrame(frameId);
        };
    }, [selectedOperatingMetric.chartType, selectedOperatingMetric.key, shouldReduceMotion]);

    const handleMenuClick = (targetId: string) => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className={`codeit-dashboard2 min-h-screen bg-[#ffffff] text-[#333236] ${isDarkMode ? 'dashboard2-dark' : 'dashboard2-light'}`} style={{ fontFamily: 'Pretendard, SpoqaHanSansNeo, Apple SD Gothic Neo, Noto Sans KR, sans-serif' }}>
            <div className="bg-[#080c16] px-4 py-3 text-center text-sm font-semibold text-[#f7f8fb]">
                청연이엔지는 기술, 현장, 사람, 사회의 가치를 한 화면에서 연결합니다.
            </div>

            <section id="cheongyeon-intro" className="scroll-mt-[132px] overflow-hidden">
                <div className="relative overflow-hidden bg-[#f8fafc] px-5 py-16 text-[#111827] md:px-8 md:py-20">
                    <div
                        className="absolute inset-0 opacity-80"
                        style={{
                            backgroundImage: 'linear-gradient(rgba(15,23,42,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.055) 1px, transparent 1px)',
                            backgroundSize: '64px 64px',
                        }}
                    />
                    <div className="absolute inset-y-0 left-0 w-[48%] bg-gradient-to-r from-[#dff8f2] via-[#eef6ff] to-transparent" />
                    <div className="relative mx-auto max-w-[1180px]">
                        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.55fr)] lg:items-center">
                            <motion.div
                                initial={shouldReduceMotion ? false : { opacity: 0, x: -40, scale: 0.96 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                transition={{ duration: shouldReduceMotion ? 0 : 0.8, delay: 0.1 }}
                                className="flex justify-center lg:justify-start"
                            >
                                <div className="relative w-full max-w-[360px] md:max-w-[420px]">
                                    <div className="absolute -inset-5 rounded-[8px] bg-gradient-to-br from-[#00b894]/18 via-[#4f7cff]/14 to-transparent blur-3xl" />
                                    <img
                                        src={dashboard2HeroImageUrl}
                                        alt="청연이엔지 대표 캐릭터"
                                        className="relative aspect-square w-full rounded-[8px] border border-[#e2e8f0] bg-white object-contain shadow-[0_32px_90px_rgba(15,23,42,0.18)]"
                                    />
                                </div>
                            </motion.div>

                            <motion.div
                                initial={shouldReduceMotion ? false : { opacity: 0, x: 40, scale: 0.98 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                transition={{ duration: shouldReduceMotion ? 0 : 0.8, delay: 0.18 }}
                                className="relative aspect-video w-full overflow-hidden rounded-[8px] bg-[#080c16]"
                            >
                                <img
                                    src={dashboard2HeroVideoThumbnailUrl}
                                    alt=""
                                    aria-hidden="true"
                                    className="absolute inset-0 h-full w-full object-cover"
                                />
                                <iframe
                                    src={dashboard2HeroVideoUrl}
                                    title=""
                                    className={`pointer-events-none absolute left-1/2 top-1/2 h-[130%] w-[130%] max-w-none -translate-x-1/2 -translate-y-1/2 border-0 transition-opacity duration-500 ${
                                        isDashboard2HeroVideoVisible ? 'opacity-100' : 'opacity-0'
                                    }`}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    referrerPolicy="strict-origin-when-cross-origin"
                                    tabIndex={-1}
                                    aria-hidden="true"
                                />
                            </motion.div>
                        </div>

                        <motion.div
                            initial={shouldReduceMotion ? false : 'hidden'}
                            animate="visible"
                            variants={staggerVariant}
                            className="mt-12"
                        >
                            <motion.div variants={revealVariant} className="inline-flex items-center gap-2 rounded-[8px] border border-[#a7f3d0] bg-[#dcfce7] px-4 py-2 text-sm font-bold text-[#047857]">
                                <span className="h-2 w-2 rounded-[8px] bg-[#10b981]" />
                                청연이엔지 회사소개
                            </motion.div>

                            <motion.h1 variants={revealVariant} className="mt-7 text-4xl font-black leading-[1.05] text-[#111827] md:text-6xl lg:text-7xl" style={{ wordBreak: 'keep-all' }}>
                                <span className="bg-gradient-to-r from-[#059669] via-[#0891b2] to-[#2563eb] bg-clip-text text-transparent">신뢰와 기술</span>로
                                <br />
                                현장의 미래를 운영합니다
                            </motion.h1>
                            <motion.p variants={revealVariant} className="mt-6 max-w-[720px] text-lg font-semibold leading-8 text-[#334155] md:text-xl" style={{ wordBreak: 'keep-all' }}>
                                청연이엔지는 시공 실행력과 데이터 운영 시스템을 함께 설계해 현장 기록, 인력 배치, 협력사 흐름을 하나의 기준으로 연결합니다.
                            </motion.p>

                            <motion.div variants={revealVariant} className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                                {heroStats.map((stat) => (
                                    <div key={stat.label} className="rounded-[8px] border border-[#dbe3ef] bg-white px-5 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                                        <div className="text-xs font-bold text-[#334155]">{stat.label}</div>
                                        <div className="mt-2 flex items-end gap-1">
                                            <AnimatedNumber value={stat.value} decimals={stat.decimals} className="text-3xl font-black text-[#111827]" />
                                            <span className="pb-1 text-sm font-extrabold text-[#0891b2]">{stat.unit}</span>
                                        </div>
                                    </div>
                                ))}
                            </motion.div>
                        </motion.div>
                    </div>
                </div>

                <motion.div
                    initial={shouldReduceMotion ? false : 'hidden'}
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.22 }}
                    variants={staggerVariant}
                    className="border-y border-[#e8eaf1] bg-[#f7f8fb] px-5 py-16 md:px-8"
                >
                    <div className="mx-auto grid max-w-[1180px] min-w-0 grid-cols-1 gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-stretch">
                        <motion.div variants={revealVariant} className="min-w-0 rounded-[8px] border border-[#e2e5ee] bg-white p-7 shadow-[0_18px_45px_rgba(21,27,45,0.05)] md:p-8">
                            <p className="text-sm font-extrabold text-[#1d4ed8]">상용 운영 패키지</p>
                            <h2 className="mt-3 text-3xl font-black leading-tight text-[#24242a] md:text-4xl" style={{ wordBreak: 'keep-all' }}>
                                도입 즉시 운영 기준이 보이는 랜딩 화면
                            </h2>
                            <p className="mt-5 text-base leading-8 text-[#475569]" style={{ wordBreak: 'keep-all' }}>
                                단순 소개 페이지가 아니라, 청연이엔지가 어떤 방식으로 현장을 운영하고 데이터를 축적하는지 바로 이해할 수 있는
                                서비스형 랜딩 구조로 확장했습니다.
                            </p>
                            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
                                {operatingHighlights.map((item, index) => {
                                    const isSelected = selectedOperatingIndex === index;

                                    return (
                                    <motion.button
                                        key={item.title}
                                        type="button"
                                        variants={revealVariant}
                                        whileHover={shouldReduceMotion ? undefined : { x: 4 }}
                                        whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                                        aria-pressed={isSelected}
                                        onClick={() => setSelectedOperatingIndex(index)}
                                        className={`w-full rounded-[8px] border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[#4f7cff] focus:ring-offset-2 ${
                                            isSelected
                                                ? 'border-[#4f7cff] bg-[#f0f4ff] shadow-[0_16px_36px_rgba(79,124,255,0.14)]'
                                                : 'border-[#eef0f6] bg-[#fbfcff] hover:border-[#cbd7ff] hover:bg-white'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <div className="text-xs font-black text-[#7c3aed]">{item.eyebrow}</div>
                                                <h3 className="mt-2 text-lg font-black text-[#24242a]">{item.title}</h3>
                                            </div>
                                                <div className={`rounded-[8px] px-3 py-2 text-sm font-black ${isSelected ? 'bg-[#1d4ed8] text-white' : 'bg-[#111827] text-white'}`}>{item.metric}</div>
                                        </div>
                                        <p className="mt-3 text-sm font-semibold leading-6 text-[#475569]">{item.desc}</p>
                                        <div className="mt-3 text-xs font-extrabold text-[#1d4ed8]">{item.helper}</div>
                                    </motion.button>
                                    );
                                })}
                            </div>
                        </motion.div>

                        <motion.div
                            initial={shouldReduceMotion ? false : { opacity: 0, y: 34 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: false, amount: 0.24 }}
                            transition={{ duration: shouldReduceMotion ? 0 : 0.72 }}
                            className="min-w-0 rounded-[8px] border border-[#273244] bg-[#111827] p-7 text-white shadow-[0_24px_70px_rgba(17,24,39,0.18)] md:p-8"
                        >
                            <motion.div
                                key={selectedOperatingMetric.key}
                                initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: shouldReduceMotion ? 0 : 0.32 }}
                            >
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <p className="text-sm font-extrabold text-[#9bbcff]">{selectedOperatingMetric.eyebrow}</p>
                                        <h3 className="mt-3 text-3xl font-black">{selectedOperatingMetric.title}</h3>
                                        <p className="mt-3 max-w-[560px] text-sm font-semibold leading-7 text-[#c7d0df]" style={{ wordBreak: 'keep-all' }}>
                                            {selectedOperatingMetric.summary}
                                        </p>
                                    </div>
                                    <div className="rounded-[8px] border border-white/10 bg-white/[0.06] px-4 py-3 text-right">
                                        <div className="text-xs font-bold text-[#c7d0df]">현재 수준</div>
                                        <div className="mt-1 text-3xl font-black text-[#9bbcff]">{selectedOperatingMetric.score}</div>
                                    </div>
                                </div>

                                <div className="mt-7 min-w-0">
                                    {selectedOperatingMetric.chartType === 'bar' && (
                                        <div ref={operatingBarChartRef} className="min-w-0 overflow-hidden rounded-[8px] border border-[#273244] bg-[#182133] p-4">
                                            <div className="mb-4 flex items-center justify-between gap-3">
                                                <div className="text-sm font-black text-white">좌에서 우로 보는 막대그래프</div>
                                                <div className="text-xs font-bold text-[#9bbcff]">0 → 100</div>
                                            </div>
                                            <div className="h-[340px] min-w-0">
                                                <ResponsiveContainer
                                                    width="100%"
                                                    height="100%"
                                                    initialDimension={{ width: 640, height: 340 }}
                                                >
                                                    <BarChart
                                                        key={`operating-bar-${selectedOperatingMetric.key}-${operatingBarChartAnimationKey}`}
                                                        data={animatedOperatingBarData}
                                                        layout="vertical"
                                                        margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                                                    >
                                                        <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#aab6c8', fontSize: 12 }} />
                                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#dbeafe', fontSize: 13, fontWeight: 800 }} width={58} />
                                                        <Tooltip
                                                            cursor={{ fill: 'rgba(255,255,255,0.08)' }}
                                                            formatter={(value: unknown) => [`${formatNumber(Number(value || 0))}%`, '지표']}
                                                            contentStyle={{
                                                                backgroundColor: '#ffffff',
                                                                border: '1px solid #e2e5ee',
                                                                borderRadius: '8px',
                                                                color: '#24242a',
                                                                boxShadow: '0 18px 45px rgba(0,0,0,0.12)',
                                                            }}
                                                        />
                                                        <Bar
                                                            dataKey="value"
                                                            fill={selectedOperatingMetric.accent}
                                                            maxBarSize={42}
                                                            radius={[0, 8, 8, 0]}
                                                            isAnimationActive={!shouldReduceMotion}
                                                            animationBegin={80}
                                                            animationDuration={720}
                                                        />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    )}

                                    {selectedOperatingMetric.chartType === 'pie' && (
                                        <div className="min-w-0 overflow-hidden rounded-[8px] border border-[#273244] bg-[#182133] p-4">
                                            <div className="mb-4 text-sm font-black text-white">원그래프</div>
                                            <div className="grid min-w-0 grid-cols-1 items-center gap-4 md:grid-cols-[1.05fr_0.95fr]">
                                                <div className="h-[330px] min-w-0">
                                                    <ResponsiveContainer
                                                        width="100%"
                                                        height="100%"
                                                        initialDimension={{ width: 520, height: 330 }}
                                                    >
                                                        <PieChart>
                                                            <Pie
                                                                data={selectedOperatingMetric.pieData}
                                                                dataKey="value"
                                                                nameKey="name"
                                                                startAngle={90}
                                                                endAngle={450}
                                                                innerRadius={54}
                                                                outerRadius={92}
                                                                stroke="none"
                                                                isAnimationActive={!shouldReduceMotion}
                                                                animationDuration={500}
                                                            >
                                                                {selectedOperatingMetric.pieData.map((entry) => (
                                                                    <Cell key={entry.name} fill={entry.color} />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip
                                                                formatter={(value: unknown) => [`${formatNumber(Number(value || 0))}%`, '비중']}
                                                                contentStyle={{
                                                                    backgroundColor: '#ffffff',
                                                                    border: '1px solid #e2e5ee',
                                                                    borderRadius: '8px',
                                                                    color: '#24242a',
                                                                    boxShadow: '0 18px 45px rgba(0,0,0,0.12)',
                                                                }}
                                                            />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                <div className="space-y-3">
                                                    {selectedOperatingMetric.pieData.map((entry) => (
                                                        <div key={entry.name} className="flex items-center justify-between gap-3 rounded-[8px] bg-[#111827] px-4 py-3">
                                                            <div className="flex min-w-0 items-center gap-3">
                                                                <span className="h-3 w-3 rounded-[8px]" style={{ backgroundColor: entry.color }} />
                                                                <span className="truncate text-sm font-bold text-[#c7d0df]">{entry.name}</span>
                                                            </div>
                                                            <span className="text-sm font-black text-white">{entry.value}%</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {selectedOperatingMetric.chartType === 'balance' && (
                                        <div className="min-w-0 overflow-hidden rounded-[8px] border border-[#273244] bg-[#182133] p-4">
                                            <div className="mb-5 flex items-center justify-between gap-3">
                                                <div className="text-sm font-black text-white">발란스 그래프</div>
                                                <div className="text-xs font-bold text-[#c4b5fd]">좌우 균형 비교</div>
                                            </div>
                                            <div className="space-y-5">
                                                {selectedOperatingMetric.balanceData.map((item) => {
                                                    const total = item.leftValue + item.rightValue || 1;
                                                    const leftPercent = Math.round((item.leftValue / total) * 100);
                                                    const rightPercent = 100 - leftPercent;

                                                    return (
                                                        <div key={item.name} className="rounded-[8px] bg-[#111827] p-4">
                                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                                <div className="text-sm font-black text-white">{item.name}</div>
                                                                <div className="text-xs font-bold text-[#c7d0df]">{leftPercent}:{rightPercent}</div>
                                                            </div>
                                                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                                                                <div className="text-right text-xs font-bold text-[#aab6c8]">{item.leftLabel}</div>
                                                                <div className="h-11 w-full min-w-[180px] overflow-hidden rounded-[8px] bg-[#243049]">
                                                                    <div className="flex h-full">
                                                                        <motion.div
                                                                            initial={{ width: shouldReduceMotion ? `${leftPercent}%` : '0%' }}
                                                                            whileInView={{ width: `${leftPercent}%` }}
                                                                            viewport={{ once: true, amount: 0.6 }}
                                                                            transition={{ duration: shouldReduceMotion ? 0 : 0.6 }}
                                                                            className="flex items-center justify-start bg-[#7c3aed] px-3 text-xs font-black text-white"
                                                                        >
                                                                            {leftPercent}%
                                                                        </motion.div>
                                                                        <motion.div
                                                                            initial={{ width: shouldReduceMotion ? `${rightPercent}%` : '0%' }}
                                                                            whileInView={{ width: `${rightPercent}%` }}
                                                                            viewport={{ once: true, amount: 0.6 }}
                                                                            transition={{ duration: shouldReduceMotion ? 0 : 0.6, delay: shouldReduceMotion ? 0 : 0.12 }}
                                                                            className="flex items-center justify-end bg-[#4f7cff] px-3 text-xs font-black text-white"
                                                                        >
                                                                            {rightPercent}%
                                                                        </motion.div>
                                                                    </div>
                                                                </div>
                                                                <div className="text-xs font-bold text-[#aab6c8]">{item.rightLabel}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    </div>
                </motion.div>

                <motion.div
                    initial={shouldReduceMotion ? false : 'hidden'}
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                    variants={staggerVariant}
                    className="mx-auto grid max-w-[1180px] grid-cols-1 gap-4 px-5 py-16 md:grid-cols-3 md:px-8"
                >
                    {introStats.map((stat) => (
                        <motion.div key={stat.label} variants={revealVariant} whileHover={shouldReduceMotion ? undefined : { y: -6 }} className="rounded-[8px] border border-[#e8eaf1] bg-[#ffffff] px-6 py-7 text-center shadow-[0_12px_28px_rgba(21,27,45,0.04)]">
                            <div className="text-sm font-black text-[#475569]">{stat.label}</div>
                            <div className="mt-3 text-3xl font-black text-[#1d4ed8]">{stat.value}</div>
                            <div className="mt-3 text-sm font-bold leading-6 text-[#475569]">{stat.caption}</div>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            <section className="bg-[#080c16] px-5 py-20 text-white md:px-8">
                <motion.div
                    initial={shouldReduceMotion ? false : 'hidden'}
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.22 }}
                    variants={staggerVariant}
                    className="mx-auto max-w-[1180px]"
                >
                    <motion.p variants={revealVariant} className="text-base font-extrabold text-[#73a4ff]">청연 비전</motion.p>
                    <motion.h2 variants={revealVariant} className="mt-4 max-w-[900px] text-3xl font-black leading-tight md:text-5xl" style={{ wordBreak: 'keep-all' }}>
                        현장에 남는 기록, 사람에게 남는 신뢰, 사회에 남는 기준
                    </motion.h2>
                    <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
                        {visionPillars.map((pillar) => (
                            <motion.article key={pillar.title} variants={revealVariant} whileHover={shouldReduceMotion ? undefined : { y: -7 }} className="rounded-[8px] border border-[#273244] bg-[#131d2e] p-7">
                                <div className="mb-7 h-1.5 w-16 rounded-[8px]" style={{ backgroundColor: pillar.tone }} />
                                <h3 className="text-2xl font-black">{pillar.title}</h3>
                                <p className="mt-4 text-base leading-8 text-[#c7d0df]" style={{ wordBreak: 'keep-all' }}>{pillar.desc}</p>
                            </motion.article>
                        ))}
                    </div>
                </motion.div>
            </section>

            <section id="cheongyeon-system" className="scroll-mt-[132px] bg-[#f7f8fb] px-5 py-20 md:px-8">
                <motion.div
                    initial={shouldReduceMotion ? false : 'hidden'}
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.18 }}
                    variants={staggerVariant}
                    className="mx-auto max-w-[1180px]"
                >
                    <div className="text-center">
                        <motion.p variants={revealVariant} className="text-base font-extrabold text-[#1d4ed8]">청연시스템</motion.p>
                        <motion.h2 variants={revealVariant} className="mt-4 text-3xl font-black leading-tight text-[#24242a] md:text-5xl" style={{ wordBreak: 'keep-all' }}>
                            기록에서 실행까지 끊기지 않는 운영 구조
                        </motion.h2>
                        <motion.p variants={revealVariant} className="mx-auto mt-5 max-w-[720px] text-base leading-8 text-[#475569]" style={{ wordBreak: 'keep-all' }}>
                            일보, 공수, 현장, 팀 정보를 한 화면에서 확인할 수 있게 묶어 보고 대기 없이 다음 작업으로 넘어갑니다.
                        </motion.p>
                    </div>

                    <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-4">
                        {systemSteps.map((step) => (
                            <motion.div key={step.title} variants={revealVariant} whileHover={shouldReduceMotion ? undefined : { y: -8 }} className="rounded-[8px] border border-[#e2e5ee] bg-[#ffffff] p-7 shadow-[0_18px_45px_rgba(21,27,45,0.05)]">
                                <div className="mb-7 inline-flex h-14 w-14 items-center justify-center rounded-[8px] text-2xl text-[#ffffff]" style={{ backgroundColor: step.accent }}>
                                    <FontAwesomeIcon icon={step.icon} />
                                </div>
                                <h3 className="text-2xl font-black text-[#24242a]">{step.title}</h3>
                                <p className="mt-4 text-base leading-7 text-[#475569]">{step.desc}</p>
                            </motion.div>
                        ))}
                    </div>

                    <motion.div variants={revealVariant} className="mt-14 rounded-[8px] border border-[#dce2ef] bg-white p-6 shadow-[0_22px_60px_rgba(21,27,45,0.06)]">
                        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                            <div>
                                <p className="text-sm font-extrabold text-[#7c3aed]">운영 아키텍처</p>
                                <h3 className="mt-2 text-2xl font-black text-[#24242a] md:text-3xl">현장 데이터가 의사결정으로 흐르는 방식</h3>
                            </div>
                            <div className="text-sm font-bold leading-6 text-[#475569]">입력부터 성과 축적까지 하나의 진행선으로 연결합니다.</div>
                        </div>
                        <div className="relative mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">
                            <div className="cy-flow-line absolute left-0 right-0 top-[30px] hidden h-[2px] bg-[#dbe3f3] md:block" />
                            {architectureSteps.map((step, index) => (
                                <motion.div
                                    key={step.label}
                                    variants={revealVariant}
                                    className="relative bg-white"
                                >
                                    <div className="relative z-[1] flex h-16 w-16 items-center justify-center rounded-[8px] bg-[#111827] text-xl font-black text-white">
                                        {String(index + 1).padStart(2, '0')}
                                    </div>
                                    <h4 className="mt-5 text-xl font-black text-[#24242a]">{step.label}</h4>
                                    <p className="mt-2 text-sm font-semibold leading-6 text-[#475569]">{step.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
                        {heroStats.map((stat) => (
                            <motion.div key={stat.label} variants={revealVariant} whileHover={shouldReduceMotion ? undefined : { y: -6 }} className="rounded-[8px] border border-[#e8eaf1] bg-[#ffffff] px-6 py-5 text-left shadow-[0_18px_45px_rgba(21,27,45,0.06)]">
                                <div className="text-sm font-bold text-[#475569]">{stat.label}</div>
                                <div className="mt-2 flex items-end gap-1">
                                    <AnimatedNumber value={stat.value} decimals={stat.decimals} className="text-4xl font-black text-[#24242a]" />
                                    <span className="pb-1 text-base font-extrabold text-[#1d4ed8]">{stat.unit}</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <motion.div variants={revealVariant} className="mt-8 rounded-[8px] border border-[#273244] bg-[#182133] p-6 text-white">
                        <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
                            <div>
                                <p className="text-sm font-extrabold text-[#73a4ff]">최근 14일 공수</p>
                                <h3 className="mt-2 text-2xl font-black">현장 기록 추이</h3>
                            </div>
                            <div className="text-sm font-semibold text-[#c7d0df]">
                                {loading ? '데이터 집계 중' : `${formatNumber(snapshot.yearToDate.totalManDay, 1)} 공수 누적`}
                            </div>
                        </div>
                        <div ref={chartRef} className="h-[280px] min-w-0 overflow-hidden">
                            {chartWidth > 0 ? (
                                <BarChart key={`daily-trend-${chartAnimationKey}`} width={chartWidth} height={280} data={animatedTrend}>
                                    <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} tick={{ fill: '#aab6c8', fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#aab6c8', fontSize: 12 }} width={40} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(79,124,255,0.12)' }}
                                        formatter={(value: unknown, name: unknown) => [
                                            name === 'siteCount'
                                                ? `${formatNumber(Number(value || 0))}곳`
                                                : `${formatNumber(Number(value || 0), 1)}공수`,
                                            name === 'siteCount' ? '현장 수' : '투입 공수',
                                        ]}
                                        labelFormatter={(label) => `${label}`}
                                        contentStyle={{
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #e2e5ee',
                                            borderRadius: '8px',
                                            color: '#24242a',
                                            boxShadow: '0 18px 45px rgba(0,0,0,0.12)',
                                        }}
                                    />
                                    <Bar
                                        dataKey="totalManDay"
                                        fill="#4f7cff"
                                        radius={[8, 8, 0, 0]}
                                        isAnimationActive={!shouldReduceMotion}
                                        animationBegin={0}
                                        animationDuration={280}
                                    />
                                    <Bar
                                        dataKey="siteCount"
                                        fill="#9d2cff"
                                        radius={[8, 8, 0, 0]}
                                        isAnimationActive={!shouldReduceMotion}
                                        animationBegin={40}
                                        animationDuration={280}
                                    />
                                </BarChart>
                            ) : (
                                <div className="h-full rounded-[8px] bg-[#111827]" />
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            </section>

            <section id="cheongyeon-business" className="scroll-mt-[132px] px-5 py-20 md:px-8">
                <motion.div
                    initial="visible"
                    animate="visible"
                    variants={staggerVariant}
                    className="mx-auto max-w-[1180px]"
                >
                    <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                        <div>
                            <motion.p variants={revealVariant} className="text-base font-extrabold text-[#7c3aed]">청연사업영역</motion.p>
                            <motion.h2 variants={revealVariant} className="mt-4 text-3xl font-black text-[#24242a] md:text-5xl" style={{ wordBreak: 'keep-all' }}>
                                현장 실행부터 시스템 운영까지 확장되는 사업
                            </motion.h2>
                            <motion.p variants={revealVariant} className="mt-5 max-w-[720px] text-base leading-8 text-[#475569]" style={{ wordBreak: 'keep-all' }}>
                                청연은 시공 실행력, 인력 운영, ERP 시스템, 협력사 네트워크를 함께 설계합니다.
                                현장의 오늘을 데이터로 정리하고, 조직의 다음 성장을 위한 기반으로 축적합니다.
                            </motion.p>
                        </div>
                    </div>

                    <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                        {businessCards.map((card) => (
                            <motion.article key={card.title} variants={revealVariant} whileHover={shouldReduceMotion ? undefined : { y: -8 }} className="rounded-[8px] border border-[#e2e5ee] bg-white p-7 shadow-[0_18px_45px_rgba(21,27,45,0.05)]">
                                <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-[8px] text-2xl text-white" style={{ backgroundColor: card.color }}>
                                    <FontAwesomeIcon icon={card.icon} />
                                </div>
                                <h3 className="text-2xl font-black text-[#24242a]">{card.title}</h3>
                                <p className="mt-4 text-base leading-8 text-[#475569]">{card.desc}</p>
                                <p className="mt-4 border-t border-[#eef0f6] pt-4 text-sm font-semibold leading-7 text-[#334155]">{card.detail}</p>
                            </motion.article>
                        ))}
                    </div>

                    <motion.div variants={revealVariant} className="mt-12 rounded-[8px] border border-[#e2e5ee] bg-[#f7f8fb] p-5 shadow-[0_18px_45px_rgba(21,27,45,0.05)] md:p-7">
                        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                            <div>
                                <p className="text-sm font-extrabold text-[#1d4ed8]">운영 FAQ</p>
                                <h3 className="mt-2 text-2xl font-black text-[#24242a] md:text-3xl" style={{ wordBreak: 'keep-all' }}>
                                    청연 시스템을 도입할 때 자주 확인하는 기준
                                </h3>
                            </div>
                            <p className="max-w-[420px] text-sm font-semibold leading-7 text-[#475569]" style={{ wordBreak: 'keep-all' }}>
                                현장 운영, 데이터 관리, 협력사 연결까지 필요한 내용을 펼쳐서 확인할 수 있습니다.
                            </p>
                        </div>

                        <div className="space-y-3">
                            {businessAccordionItems.map((item, index) => {
                                const isOpen = openAccordionIndex === index;
                                const panelId = `business-accordion-${index}`;

                                return (
                                    <div key={item.title} className="overflow-hidden rounded-[8px] border border-[#e2e5ee] bg-white">
                                        <button
                                            type="button"
                                            aria-expanded={isOpen}
                                            aria-controls={panelId}
                                            onClick={() => setOpenAccordionIndex(isOpen ? -1 : index)}
                                            className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left md:px-6"
                                        >
                                            <span className="min-w-0">
                                                <span className="block text-base font-black text-[#24242a] md:text-lg" style={{ wordBreak: 'keep-all' }}>{item.title}</span>
                                                <span className="mt-2 block text-sm font-semibold leading-6 text-[#475569]" style={{ wordBreak: 'keep-all' }}>{item.summary}</span>
                                            </span>
                                            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[8px] bg-[#f0f4ff] text-[#1d4ed8]">
                                                <FontAwesomeIcon icon={faChevronDown} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                            </span>
                                        </button>
                                        <motion.div
                                            id={panelId}
                                            initial={false}
                                            animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                                            transition={{ duration: shouldReduceMotion ? 0 : 0.24 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="border-t border-[#eef0f6] px-5 py-5 text-sm font-semibold leading-7 text-[#334155] md:px-6" style={{ wordBreak: 'keep-all' }}>
                                                {item.detail}
                                            </div>
                                        </motion.div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>

                    <motion.div variants={revealVariant} className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                        <div className="rounded-[8px] bg-[#111827] p-7 text-white md:p-8">
                            <p className="text-sm font-extrabold text-[#9bbcff]">상용화 운영 기준</p>
                            <h3 className="mt-3 text-3xl font-black leading-tight md:text-4xl" style={{ wordBreak: 'keep-all' }}>
                                소개 페이지를 넘어 실제 영업과 운영에 쓰이는 화면
                            </h3>
                            <p className="mt-5 text-base font-semibold leading-8 text-[#c7d0df]" style={{ wordBreak: 'keep-all' }}>
                                방문자는 회사의 방향을 이해하고, 운영자는 현재 지표를 확인하며, 의사결정자는 청연 시스템의 확장 가능성을 바로 볼 수 있습니다.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            {enterpriseProofs.map((proof, index) => (
                                <motion.article
                                    key={proof.title}
                                    initial={shouldReduceMotion ? false : { opacity: 0, rotateX: -8, y: 24 }}
                                    whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
                                    viewport={{ once: true, amount: 0.45 }}
                                    transition={{ duration: shouldReduceMotion ? 0 : 0.55, delay: index * 0.1 }}
                                    whileHover={shouldReduceMotion ? undefined : { y: -6 }}
                                    className="rounded-[8px] border border-[#e2e5ee] bg-[#ffffff] p-6 shadow-[0_18px_45px_rgba(21,27,45,0.05)]"
                                >
                                    <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#f0f4ff] text-sm font-black text-[#1d4ed8]">{index + 1}</div>
                                    <h4 className="mt-5 text-xl font-black text-[#24242a]">{proof.title}</h4>
                                    <p className="mt-4 text-sm font-semibold leading-7 text-[#475569]">{proof.body}</p>
                                </motion.article>
                            ))}
                        </div>
                    </motion.div>

                    <motion.div variants={revealVariant} className="mt-12 rounded-[8px] border border-[#e2e5ee] bg-[#f7f8fb] p-6">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="text-sm font-extrabold text-[#c2410c]">사업 수행 흐름</p>
                                <h3 className="mt-2 text-2xl font-black text-[#24242a]">한 현장이 완성되는 운영 단계</h3>
                            </div>
                            <div className="text-sm font-bold text-[#475569]">업무가 누락되지 않도록 단계별 데이터를 남깁니다.</div>
                        </div>
                        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6">
                            {businessPipelines.map((item, index) => (
                                <motion.div
                                    key={item}
                                    variants={revealVariant}
                                    whileHover={shouldReduceMotion ? undefined : { y: -4 }}
                                    className="rounded-[8px] border border-[#e4e8f2] bg-white p-4 text-center"
                                >
                                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#111827] text-sm font-black text-white">{index + 1}</div>
                                    <div className="mt-3 text-sm font-black text-[#333236]">{item}</div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    <motion.div variants={revealVariant} className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
                        {summaryCards.map((card) => (
                            <motion.div key={card.label} whileHover={shouldReduceMotion ? undefined : { y: -6 }} className="flex items-center gap-4 rounded-[8px] border border-[#eef0f6] bg-white p-5 shadow-[0_14px_36px_rgba(21,27,45,0.05)]">
                                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[8px] text-xl text-white" style={{ backgroundColor: card.color }}>
                                    <FontAwesomeIcon icon={card.icon} />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm font-bold text-[#475569]">{card.label}</div>
                                    <div className="mt-1 text-xl font-black text-[#24242a]" style={{ wordBreak: 'keep-all' }}>{card.value}</div>
                                    <div className="mt-1 text-sm font-semibold text-[#475569]">{card.helper}</div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>

                    <motion.div variants={revealVariant} className="mt-12">
                        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                            <div>
                                <p className="text-sm font-extrabold text-[#047857]">현장 포트폴리오</p>
                                <h3 className="mt-2 text-2xl font-black text-[#24242a] md:text-3xl">최근 현장 신호</h3>
                            </div>
                            <div className="text-sm font-bold text-[#475569]">최근 등록된 일보를 기준으로 구성됩니다.</div>
                        </div>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                            {displayHighlights.slice(0, 3).map((site) => (
                                <motion.article key={site.key} whileHover={shouldReduceMotion ? undefined : { y: -7 }} className="rounded-[8px] border border-[#e2e5ee] bg-white p-6 shadow-[0_18px_45px_rgba(21,27,45,0.05)]">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-extrabold text-[#1d4ed8]">{site.latestDate ? toKoreanDate(site.latestDate) : '기록 준비'}</div>
                                            <h4 className="mt-2 text-xl font-black text-[#24242a]" style={{ wordBreak: 'keep-all' }}>{site.siteName}</h4>
                                        </div>
                                        <div className="rounded-[8px] bg-[#f0f4ff] px-3 py-2 text-sm font-black text-[#1d4ed8]">{formatNumber(site.reportCount)}건</div>
                                    </div>
                                    <div className="mt-6 grid grid-cols-2 gap-3">
                                        <div className="rounded-[8px] bg-[#f7f8fb] p-4">
                                            <div className="text-xs font-bold text-[#475569]">참여 인원</div>
                                            <div className="mt-1 text-2xl font-black text-[#24242a]">{formatNumber(site.totalWorkers)}명</div>
                                        </div>
                                        <div className="rounded-[8px] bg-[#f7f8fb] p-4">
                                            <div className="text-xs font-bold text-[#475569]">연결 팀</div>
                                            <div className="mt-1 text-2xl font-black text-[#24242a]">{formatNumber(site.teamNames.length)}팀</div>
                                        </div>
                                    </div>
                                    <div className="mt-5 flex flex-wrap gap-2">
                                        {(site.teamNames.length > 0 ? site.teamNames : ['현장팀']).map((team) => (
                                            <span key={team} className="rounded-[8px] border border-[#e2e5ee] px-3 py-1.5 text-xs font-extrabold text-[#334155]">{team}</span>
                                        ))}
                                    </div>
                                </motion.article>
                            ))}
                        </div>
                    </motion.div>

                    {loadError && (
                        <motion.div variants={revealVariant} className="mt-6 rounded-[8px] bg-[#fff4f0] px-4 py-3 text-sm font-bold text-[#d3542f]">
                            {loadError}
                        </motion.div>
                    )}
                </motion.div>
            </section>

            <section id="cheongyeon-impact" className="scroll-mt-[132px] bg-[#111827] px-5 py-20 text-white md:px-8">
                <motion.div
                    initial={shouldReduceMotion ? false : 'hidden'}
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.18 }}
                    variants={staggerVariant}
                    className="mx-auto max-w-[1180px]"
                >
                    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                        <div>
                            <motion.p variants={revealVariant} className="text-base font-extrabold text-[#73a4ff]">청연사회공헌</motion.p>
                            <motion.h2 variants={revealVariant} className="mt-4 text-3xl font-black leading-tight md:text-5xl" style={{ wordBreak: 'keep-all' }}>
                                현장의 신뢰가 지역의 가치로 이어집니다
                            </motion.h2>
                            <motion.p variants={revealVariant} className="mt-6 text-lg leading-8 text-[#c7d0df]" style={{ wordBreak: 'keep-all' }}>
                                안전, 공정, 상생을 운영 기준으로 삼아 현장과 구성원, 협력사가 함께 성장하는 구조를 만듭니다.
                            </motion.p>
                        </div>

                        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                            {impactCards.map((card) => (
                                <motion.article key={card.title} variants={revealVariant} whileHover={shouldReduceMotion ? undefined : { y: -8 }} className="rounded-[8px] border border-[#273244] bg-[#182133] p-6">
                                    <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-[8px] bg-[#4f7cff] text-xl">
                                        <FontAwesomeIcon icon={faHandshake} />
                                    </div>
                                    <h3 className="text-xl font-black">{card.title}</h3>
                                    <p className="mt-4 text-sm leading-7 text-[#c7d0df]">{card.desc}</p>
                                </motion.article>
                            ))}
                        </div>
                    </div>

                    <motion.div variants={revealVariant} className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
                        {impactMetrics.map((metric) => (
                            <motion.div key={metric.label} whileHover={shouldReduceMotion ? undefined : { y: -6 }} className="rounded-[8px] border border-[#273244] bg-[#182133] p-6">
                                <div className="text-sm font-extrabold text-[#9bbcff]">{metric.label}</div>
                                <div className="mt-3 text-3xl font-black">{metric.value}</div>
                                <div className="mt-3 text-sm font-semibold leading-6 text-[#c7d0df]">{metric.desc}</div>
                            </motion.div>
                        ))}
                    </motion.div>

                    <motion.div variants={revealVariant} className="mt-12 rounded-[8px] border border-[#273244] bg-[#182133] p-7">
                        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-4">
                                <img src={ceoPortrait} alt="청연 대표 이미지" className="h-16 w-16 rounded-[8px] object-cover object-top" />
                                <div>
                                    <div className="text-2xl font-black">{companyProfile.name || '청연이엔지'}</div>
                                    <div className="mt-1 text-sm font-semibold text-[#c7d0df]">현장 운영 데이터를 하나로 연결합니다.</div>
                                </div>
                            </div>
                            <motion.button
                                type="button"
                                onClick={() => handleMenuClick('cheongyeon-intro')}
                                whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                                className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-white px-5 text-sm font-extrabold text-[#24242a]"
                            >
                                처음으로
                                <FontAwesomeIcon icon={faArrowRight} />
                            </motion.button>
                        </div>
                    </motion.div>
                </motion.div>
            </section>

            <footer className="border-t border-[#e8eaf1] bg-[#f7f8fb] px-5 py-10 md:px-8">
                <div className="mx-auto flex max-w-[1180px] flex-col gap-8 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                        <img src={logoConstruction} alt="청연이엔지 로고" className="h-14 w-14 rounded-[8px] object-cover" />
                        <div>
                            <div className="text-2xl font-black text-[#24242a]">{companyProfile.name || '청연이엔지'}</div>
                            <div className="mt-1 text-sm font-semibold text-[#475569]">기술과 현장을 연결하는 운영 파트너</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 text-sm font-semibold text-[#475569] md:grid-cols-3">
                        <span>{formatBusinessNumber(companyProfile.businessNumber)}</span>
                        <span>{companyProfile.phone || '연락처 확인 중'}</span>
                        <span className="md:text-right">{companyProfile.address || '주소 확인 중'}</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default CheongyeonHome;
