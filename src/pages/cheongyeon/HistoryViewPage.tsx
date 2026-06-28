import React from 'react';
import {
    motion,
    useScroll,
    useSpring,
    useTransform,
    type Variants
} from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faAward,
    faBuilding,
    faChartLine,
    faCity,
    faGlobe,
    faHelmetSafety,
    faNetworkWired,
    faRocket,
    faSeedling,
    faTrophy,
    faUsers
} from '@fortawesome/free-solid-svg-icons';
import { useSiteMode } from '../../contexts/SiteModeContext';

type HistoryItem = {
    year: number;
    title: string;
    summary: string;
    details: string[];
    icon: any;
    accent: string;
};

const HISTORY_ITEMS: HistoryItem[] = [
    {
        year: 2016,
        title: '법인 설립 및 기반 구축',
        summary: '청연ENG 설립과 함께 시스템 비계·동바리 시공 체계를 정비하며 사업의 첫 기반을 다졌습니다.',
        details: ['법인 출범', '핵심 시공 인력 조직 구성', '안전 및 품질 기준 초안 수립'],
        icon: faBuilding,
        accent: 'from-amber-400 to-orange-500'
    },
    {
        year: 2017,
        title: '초기 프로젝트 수행 기반 확장',
        summary: '중소형 현장 수행 경험을 축적하며 현장 공정과 운영 매뉴얼을 본격적으로 다듬기 시작했습니다.',
        details: ['공정 수행 범위 확대', '협력사 네트워크 확장', '현장 커뮤니케이션 프로토콜 수립'],
        icon: faCity,
        accent: 'from-cyan-400 to-sky-500'
    },
    {
        year: 2018,
        title: '안전 중심 운영 고도화',
        summary: '시공 안전관리 체계를 강화하고 현장 리스크 대응 속도를 끌어올렸습니다.',
        details: ['안전 점검 루틴 고도화', '현장 교육 강화', '사고 예방 체크리스트 운영'],
        icon: faHelmetSafety,
        accent: 'from-emerald-400 to-green-500'
    },
    {
        year: 2019,
        title: '주요 프로젝트 수주 확대',
        summary: '대형 프로젝트 참여 비중이 높아지며 시공 수행 역량을 검증했습니다.',
        details: ['중대형 현장 다수 수행', '공정 안정성 개선', '납기 준수율 향상'],
        icon: faTrophy,
        accent: 'from-fuchsia-400 to-pink-500'
    },
    {
        year: 2020,
        title: '현장 운영 디지털 전환 시작',
        summary: '현장 데이터 기반 관리체계를 도입해 의사결정 속도와 정확도를 높였습니다.',
        details: ['현장 데이터 수집 자동화', '보고 체계 표준화', '인력 배치 정확도 향상'],
        icon: faUsers,
        accent: 'from-violet-400 to-purple-500'
    },
    {
        year: 2021,
        title: '성과 지표 중심 경영 정착',
        summary: '원가·생산성·품질 지표를 통합 관리하며 운영 효율을 개선했습니다.',
        details: ['KPI 대시보드 정착', '공정 생산성 개선', '품질 기준 체계화'],
        icon: faChartLine,
        accent: 'from-blue-400 to-indigo-500'
    },
    {
        year: 2022,
        title: '품질·신뢰 경영 강화',
        summary: '재시공 최소화와 현장 대응 고도화로 고객 신뢰도를 높였습니다.',
        details: ['품질검수 프로세스 강화', '현장 대응 리드타임 단축', '고객 만족도 향상'],
        icon: faAward,
        accent: 'from-teal-400 to-cyan-500'
    },
    {
        year: 2023,
        title: '광역 단위 작업 네트워크 확장',
        summary: '권역별 협력 체계를 구축해 기동성과 대응 범위를 넓혔습니다.',
        details: ['권역별 협력사 체계화', '긴급 공정 대응력 강화', '자재·인력 연계 최적화'],
        icon: faNetworkWired,
        accent: 'from-lime-400 to-emerald-500'
    },
    {
        year: 2024,
        title: '지속가능 운영 체계 정비',
        summary: '중장기 성장 기반을 위한 인재·안전·품질 밸런스를 강화했습니다.',
        details: ['인재 육성 체계 정비', '안전·품질 통합 점검', '운영 표준 고도화'],
        icon: faSeedling,
        accent: 'from-green-400 to-teal-500'
    },
    {
        year: 2025,
        title: '브랜드 신뢰 자산 확장',
        summary: '퍼포먼스 고도화와 서비스 안정화를 통해 브랜드 가치를 끌어올렸습니다.',
        details: ['대외 퍼포먼스 강화', '프로세스 안정성 향상', '대내 커뮤니케이션 체계화'],
        icon: faGlobe,
        accent: 'from-sky-400 to-blue-500'
    },
    {
        year: 2026,
        title: '스마트 현장 운영 가속',
        summary: '데이터 기반 운영과 자동화 프로세스를 결합해 다음 도약을 준비하고 있습니다.',
        details: ['데이터 기반 운영 고도화', '자동화 워크플로 정착', '차세대 성장 전략 실행'],
        icon: faRocket,
        accent: 'from-orange-400 to-rose-500'
    }
];

const heroVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.12,
            delayChildren: 0.04
        }
    }
};

const heroChildVariants: Variants = {
    hidden: { opacity: 0, y: 36, filter: 'blur(14px)' },
    visible: {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: {
            duration: 0.8,
            ease: [0.22, 1, 0.36, 1]
        }
    }
};

const TIMELINE_PREVIEW_POINTS = [
    { x: 18, y: 118 },
    { x: 86, y: 92 },
    { x: 152, y: 104 },
    { x: 218, y: 56 },
    { x: 286, y: 34 }
];

const FLOATING_PARTICLES = [
    { top: '12%', left: '8%', size: 10, duration: 11 },
    { top: '24%', left: '78%', size: 14, duration: 16 },
    { top: '42%', left: '12%', size: 8, duration: 13 },
    { top: '58%', left: '84%', size: 12, duration: 18 },
    { top: '74%', left: '28%', size: 10, duration: 12 },
    { top: '86%', left: '68%', size: 7, duration: 15 }
];

const CheongyeonHistoryPage: React.FC = () => {
    const { isDarkMode } = useSiteMode();
    const timelineRef = React.useRef<HTMLDivElement | null>(null);

    const { scrollYProgress } = useScroll();
    const pageProgress = useSpring(scrollYProgress, {
        stiffness: 120,
        damping: 28,
        mass: 0.32
    });

    const { scrollYProgress: timelineScrollProgress } = useScroll({
        target: timelineRef,
        offset: ['start 80%', 'end end']
    });
    const timelineProgress = useSpring(timelineScrollProgress, {
        stiffness: 90,
        damping: 24,
        mass: 0.4
    });

    const heroParallaxY = useTransform(pageProgress, [0, 1], [0, -120]);
    const heroGlowScale = useTransform(pageProgress, [0, 0.35], [1, 1.22]);
    const meshY = useTransform(pageProgress, [0, 1], [0, 160]);
    const topBarOpacity = useTransform(pageProgress, [0, 0.05], [0.45, 1]);

    const firstYear = HISTORY_ITEMS[0]?.year ?? 0;
    const lastYear = HISTORY_ITEMS[HISTORY_ITEMS.length - 1]?.year ?? 0;
    const statCards = [
        { label: '기록 연도', value: `${firstYear} - ${lastYear}` },
        { label: '핵심 이정표', value: `${HISTORY_ITEMS.length} milestones` },
        { label: '성장 축', value: '시공 · 안전 · 운영' }
    ];

    const [activeTimelineYear, setActiveTimelineYear] = React.useState(firstYear);

    React.useEffect(() => {
        const root = timelineRef.current;
        if (!root || typeof window === 'undefined') return;

        const items = Array.from(root.querySelectorAll<HTMLElement>('[data-history-year]'));
        if (!items.length) return;

        let frameId = 0;
        const updateActiveYear = () => {
            frameId = 0;
            const viewportCenter = window.innerHeight * 0.5;
            const visibleItems = items.filter((item) => {
                const rect = item.getBoundingClientRect();
                return rect.bottom >= window.innerHeight * 0.18 && rect.top <= window.innerHeight * 0.82;
            });
            const candidates = visibleItems.length ? visibleItems : items;
            const activeItem = candidates.reduce<HTMLElement | null>((closest, item) => {
                if (!closest) return item;
                const rect = item.getBoundingClientRect();
                const closestRect = closest.getBoundingClientRect();
                const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
                const closestDistance = Math.abs(closestRect.top + closestRect.height / 2 - viewportCenter);
                return distance < closestDistance ? item : closest;
            }, null);
            const nextYear = Number(activeItem?.dataset.historyYear);
            if (Number.isFinite(nextYear)) {
                setActiveTimelineYear(nextYear);
            }
        };
        const requestUpdate = () => {
            if (frameId) return;
            frameId = window.requestAnimationFrame(updateActiveYear);
        };

        requestUpdate();
        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate);

        return () => {
            if (frameId) window.cancelAnimationFrame(frameId);
            window.removeEventListener('scroll', requestUpdate);
            window.removeEventListener('resize', requestUpdate);
        };
    }, [firstYear]);

    return (
        <div
            className={`relative min-h-screen overflow-hidden ${
                isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
            }`}
            style={{ fontFamily: "'Pretendard Variable','Pretendard','SUIT Variable','Noto Sans KR',sans-serif" }}
        >
            <motion.div
                className="fixed left-0 top-0 z-40 h-1 w-full origin-left bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400"
                style={{ scaleX: pageProgress, opacity: topBarOpacity }}
            />

            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <motion.div
                    className={`absolute -top-44 -left-28 h-[32rem] w-[32rem] rounded-full blur-3xl ${
                        isDarkMode ? 'bg-cyan-500/15' : 'bg-cyan-500/10'
                    }`}
                    style={{ y: heroParallaxY, scale: heroGlowScale }}
                />
                <motion.div
                    className={`absolute top-[18%] right-[8%] h-72 w-72 rounded-full blur-3xl ${
                        isDarkMode ? 'bg-violet-500/12' : 'bg-violet-500/10'
                    }`}
                    animate={{
                        x: [0, 36, -18, 0],
                        y: [0, -24, 18, 0],
                        scale: [1, 1.08, 0.96, 1]
                    }}
                    transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className={`absolute -bottom-28 -right-16 h-[30rem] w-[30rem] rounded-full blur-3xl ${
                        isDarkMode ? 'bg-fuchsia-500/10' : 'bg-indigo-500/10'
                    }`}
                    animate={{
                        x: [0, -42, 18, 0],
                        y: [0, 22, -14, 0],
                        scale: [1, 1.12, 0.95, 1]
                    }}
                    transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className={`absolute inset-0 ${isDarkMode ? 'opacity-[0.14]' : 'opacity-[0.08]'}`}
                    style={{ y: meshY }}
                >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.32),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.24),transparent_28%)]" />
                </motion.div>

                {FLOATING_PARTICLES.map((particle) => (
                    <motion.span
                        key={`${particle.top}-${particle.left}`}
                        className={`absolute rounded-full ${
                            isDarkMode ? 'bg-white/20' : 'bg-slate-400/20'
                        }`}
                        style={{
                            top: particle.top,
                            left: particle.left,
                            width: particle.size,
                            height: particle.size
                        }}
                        animate={{
                            y: [0, -28, 0],
                            x: [0, 16, 0],
                            opacity: [0.12, 0.52, 0.12],
                            scale: [1, 1.24, 1]
                        }}
                        transition={{
                            duration: particle.duration,
                            repeat: Infinity,
                            ease: 'easeInOut'
                        }}
                    />
                ))}
            </div>

            <main className="relative z-10 mx-auto max-w-6xl px-6 py-12 md:px-8 md:py-16">
                <motion.header
                    variants={heroVariants}
                    initial="hidden"
                    animate="visible"
                    className="mb-14 md:mb-20"
                >
                    <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
                        <div>
                            <motion.div
                                variants={heroChildVariants}
                                whileHover={{ y: -3, scale: 1.01 }}
                                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] ${
                                    isDarkMode
                                        ? 'border border-white/20 bg-white/10 text-cyan-100'
                                        : 'border border-slate-200 bg-white text-cyan-700'
                                }`}
                            >
                                <FontAwesomeIcon icon={faBuilding} />
                                Company History
                            </motion.div>

                            <motion.h1
                                variants={heroChildVariants}
                                className={`mt-5 text-4xl font-black md:text-6xl ${
                                    isDarkMode ? 'text-white' : 'text-slate-900'
                                }`}
                            >
                                청연ENG 회사연혁
                            </motion.h1>

                            <motion.p
                                variants={heroChildVariants}
                                className={`mt-4 max-w-3xl text-base leading-relaxed md:text-lg ${
                                    isDarkMode ? 'text-slate-300' : 'text-slate-600'
                                }`}
                            >
                                2016년부터 현재까지, 청연ENG가 쌓아온 성장의 흐름을 연도별로 정리했습니다.
                                시공 역량, 안전 운영, 디지털 전환, 그리고 조직 확장까지 이어진 시간을 한눈에 볼 수 있도록 구성했습니다.
                            </motion.p>

                            <motion.div
                                variants={heroChildVariants}
                                className="mt-8 flex flex-wrap gap-3"
                            >
                                {statCards.map((card, index) => (
                                    <motion.div
                                        key={card.label}
                                        whileHover={{ y: -6, scale: 1.02 }}
                                        animate={{ y: [0, -4, 0] }}
                                        transition={{
                                            y: {
                                                duration: 4.8 + index,
                                                repeat: Infinity,
                                                ease: 'easeInOut',
                                                delay: index * 0.3
                                            },
                                            default: { duration: 0.22 }
                                        }}
                                        className={`rounded-2xl border px-4 py-3 backdrop-blur-sm ${
                                            isDarkMode
                                                ? 'border-white/[0.12] bg-white/[0.04] text-white'
                                                : 'border-slate-200 bg-white/85 text-slate-900'
                                        }`}
                                    >
                                        <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                            {card.label}
                                        </p>
                                        <p className="mt-1 text-sm font-bold md:text-base">{card.value}</p>
                                    </motion.div>
                                ))}
                            </motion.div>
                        </div>

                        <motion.div
                            variants={heroChildVariants}
                            whileHover={{ y: -6, scale: 1.01 }}
                            className={`relative overflow-hidden rounded-[32px] border p-6 ${
                                isDarkMode
                                    ? 'border-white/[0.12] bg-white/[0.05] shadow-[0_20px_80px_rgba(8,15,28,0.45)]'
                                    : 'border-slate-200 bg-white/90 shadow-[0_20px_60px_rgba(148,163,184,0.18)]'
                            }`}
                        >
                            <motion.div
                                className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-cyan-400/20 blur-3xl"
                                animate={{ scale: [1, 1.22, 1], opacity: [0.18, 0.34, 0.18] }}
                                transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
                            />
                            <motion.div
                                className="absolute -bottom-10 left-10 h-28 w-28 rounded-full bg-fuchsia-400/15 blur-3xl"
                                animate={{ scale: [1, 1.16, 0.96, 1], opacity: [0.16, 0.26, 0.16] }}
                                transition={{ duration: 8.5, repeat: Infinity, ease: 'easeInOut' }}
                            />

                            <div className="relative">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${isDarkMode ? 'text-cyan-200/80' : 'text-cyan-700'}`}>
                                            Timeline Pulse
                                        </p>
                                        <h2 className={`mt-2 text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                            성장 흐름 미리보기
                                        </h2>
                                    </div>
                                    <div className={`rounded-full px-3 py-1 text-xs font-bold ${isDarkMode ? 'bg-white/10 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
                                        {HISTORY_ITEMS.length} stages
                                    </div>
                                </div>

                                <div className={`mt-6 rounded-[28px] border p-4 ${isDarkMode ? 'border-white/10 bg-slate-950/65' : 'border-slate-200 bg-slate-50/90'}`}>
                                    <svg viewBox="0 0 304 152" className="h-44 w-full">
                                        <defs>
                                            <linearGradient id="historyPreviewStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="#22d3ee" />
                                                <stop offset="52%" stopColor="#a855f7" />
                                                <stop offset="100%" stopColor="#fb7185" />
                                            </linearGradient>
                                        </defs>
                                        <motion.path
                                            d="M 18 118 C 48 110, 54 86, 86 92 S 126 110, 152 104 S 190 72, 218 56 S 258 44, 286 34"
                                            fill="none"
                                            stroke="url(#historyPreviewStroke)"
                                            strokeWidth="4"
                                            strokeLinecap="round"
                                            initial={{ pathLength: 0, opacity: 0.45 }}
                                            animate={{ pathLength: 1, opacity: 1 }}
                                            transition={{ duration: 1.9, ease: 'easeInOut' }}
                                        />
                                        {TIMELINE_PREVIEW_POINTS.map((point, index) => (
                                            <g key={`${point.x}-${point.y}`}>
                                                <motion.circle
                                                    cx={point.x}
                                                    cy={point.y}
                                                    r="11"
                                                    fill={isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(14,165,233,0.14)'}
                                                    animate={{ scale: [1, 1.35, 1], opacity: [0.25, 0.65, 0.25] }}
                                                    transition={{
                                                        duration: 2.8,
                                                        repeat: Infinity,
                                                        ease: 'easeInOut',
                                                        delay: index * 0.28
                                                    }}
                                                    style={{ transformOrigin: `${point.x}px ${point.y}px` }}
                                                />
                                                <circle
                                                    cx={point.x}
                                                    cy={point.y}
                                                    r="5.5"
                                                    fill={isDarkMode ? '#fff' : '#0f172a'}
                                                    stroke={isDarkMode ? 'transparent' : '#fff'}
                                                    strokeWidth={isDarkMode ? 0 : 3}
                                                />
                                            </g>
                                        ))}
                                    </svg>

                                    <div className="mt-3 grid grid-cols-5 gap-2 text-center text-[11px] font-semibold">
                                        {[2016, 2018, 2020, 2023, 2026].map((year, index) => (
                                            <motion.div
                                                key={year}
                                                animate={{ y: [0, -3, 0] }}
                                                transition={{
                                                    duration: 4.2,
                                                    repeat: Infinity,
                                                    ease: 'easeInOut',
                                                    delay: index * 0.24
                                                }}
                                                className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}
                                            >
                                                {year}
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </motion.header>

                <div ref={timelineRef} className="relative">
                    <div className={`absolute left-4 top-0 h-full w-px md:left-1/2 md:-translate-x-1/2 ${isDarkMode ? 'bg-white/10' : 'bg-slate-300/90'}`} />
                    <motion.div
                        className="absolute left-4 top-0 h-full w-[3px] origin-top rounded-full bg-gradient-to-b from-cyan-400 via-violet-400 to-orange-400 md:left-1/2 md:-translate-x-1/2"
                        style={{ scaleY: timelineProgress }}
                    />

                    <div className="space-y-8 md:space-y-12">
                        {HISTORY_ITEMS.map((item, index) => {
                            const isLeft = index % 2 === 0;
                            const yearGhostClass = isDarkMode ? 'text-white/[0.05]' : 'text-[#d8e2ee]';
                            const isActive = activeTimelineYear === item.year;

                            return (
                                <motion.article
                                    key={item.year}
                                    data-history-year={item.year}
                                    initial={{
                                        opacity: 0,
                                        x: isLeft ? -84 : 84,
                                        y: 44,
                                        rotate: isLeft ? -2.5 : 2.5,
                                        scale: 0.94,
                                        filter: 'blur(10px)'
                                    }}
                                    whileInView={{
                                        opacity: 1,
                                        x: 0,
                                        y: 0,
                                        rotate: 0,
                                        scale: 1,
                                        filter: 'blur(0px)'
                                    }}
                                    viewport={{ once: true, amount: 0.24 }}
                                    transition={{
                                        duration: 0.8,
                                        ease: [0.22, 1, 0.36, 1],
                                        delay: Math.min(index * 0.06, 0.28)
                                    }}
                                    className="relative"
                                >
                                    <motion.div
                                        className={`absolute left-4 top-10 z-20 h-6 w-6 -translate-y-1/2 overflow-visible rounded-full border-4 md:left-1/2 md:-translate-x-1/2 ${
                                            isDarkMode ? 'border-white/20 bg-slate-950' : 'border-slate-300 bg-white'
                                        }`}
                                        initial={false}
                                        animate={
                                            isActive
                                                ? {
                                                    scale: [1, 1.16, 1],
                                                    borderColor: '#ffffff',
                                                    boxShadow: [
                                                        '0 0 0 0 rgba(34,211,238,0.16)',
                                                        '0 0 0 16px rgba(34,211,238,0.07)',
                                                        '0 0 30px rgba(34,211,238,0.52)'
                                                    ]
                                                }
                                                : {
                                                    scale: 1,
                                                    borderColor: isDarkMode ? 'rgba(255,255,255,0.20)' : 'rgb(203,213,225)',
                                                    boxShadow: '0 0 0 0 rgba(34,211,238,0)'
                                                }
                                        }
                                        transition={
                                            isActive
                                                ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: index * 0.04 }
                                                : { duration: 0.24, ease: 'easeOut' }
                                        }
                                    >
                                        <motion.span
                                            className={`absolute inset-[-4px] rounded-full bg-gradient-to-br ${item.accent}`}
                                            initial={false}
                                            animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.72 }}
                                            transition={{ duration: 0.42, ease: 'easeOut' }}
                                        />
                                        <motion.span
                                            className={`absolute inset-[-6px] rounded-full bg-gradient-to-br ${item.accent}`}
                                            initial={false}
                                            animate={
                                                isActive
                                                    ? {
                                                        opacity: [0.42, 0, 0.42],
                                                        scale: [0.9, 1.9, 0.9]
                                                    }
                                                    : { opacity: 0, scale: 0.9 }
                                            }
                                            transition={
                                                isActive
                                                    ? { duration: 2, repeat: Infinity, ease: 'easeInOut', delay: index * 0.05 }
                                                    : { duration: 0.2, ease: 'easeOut' }
                                            }
                                        />
                                        <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.75)]" />
                                    </motion.div>

                                    <div className={`grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-10 ${isLeft ? '' : 'md:[&>div:first-child]:order-2'}`}>
                                        <div className={isLeft ? 'md:pr-14' : 'md:pl-14'}>
                                            <motion.div
                                                whileHover={{ y: -10, scale: 1.015 }}
                                                transition={{ duration: 0.24 }}
                                                className={`group relative overflow-hidden rounded-[30px] border p-6 shadow-xl backdrop-blur-sm md:p-7 ${
                                                    isDarkMode
                                                        ? 'border-white/[0.12] bg-white/[0.045] shadow-black/40'
                                                        : 'border-slate-200 bg-white/92 shadow-slate-200/80'
                                                }`}
                                            >
                                                <motion.div
                                                    className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.accent}`}
                                                    initial={{ scaleX: 0, opacity: 0.4 }}
                                                    whileInView={{ scaleX: 1, opacity: 1 }}
                                                    viewport={{ once: true }}
                                                    transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
                                                    style={{ transformOrigin: isLeft ? 'left' : 'right' }}
                                                />
                                                <motion.div
                                                    className={`absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${item.accent} opacity-20 blur-3xl`}
                                                    animate={{
                                                        scale: [1, 1.22, 0.94, 1],
                                                        opacity: [0.12, 0.24, 0.12]
                                                    }}
                                                    transition={{
                                                        duration: 6.4 + index * 0.18,
                                                        repeat: Infinity,
                                                        ease: 'easeInOut'
                                                    }}
                                                />

                                                <div className="relative">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div>
                                                            <div className={`text-xs font-bold tracking-[0.22em] ${
                                                                isActive
                                                                    ? isDarkMode ? 'text-cyan-200' : 'text-cyan-700'
                                                                    : isDarkMode ? 'text-slate-400' : 'text-slate-500'
                                                            }`}>
                                                                YEAR
                                                            </div>
                                                            <motion.div
                                                                animate={{ y: [0, -4, 0] }}
                                                                transition={{
                                                                    duration: 4.6,
                                                                    repeat: Infinity,
                                                                    ease: 'easeInOut',
                                                                    delay: index * 0.12
                                                                }}
                                                                className={`relative inline-block text-3xl font-black md:text-4xl ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                                                            >
                                                                <span>{item.year}</span>
                                                                <motion.span
                                                                    className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${item.accent} bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(34,211,238,0.34)]`}
                                                                    initial={false}
                                                                    animate={{ opacity: isActive ? 1 : 0 }}
                                                                    transition={{ duration: 0.45, ease: 'easeOut' }}
                                                                >
                                                                    {item.year}
                                                                </motion.span>
                                                            </motion.div>
                                                        </div>

                                                        <motion.div
                                                            animate={{
                                                                y: [0, -5, 0],
                                                                rotate: [0, 4, -4, 0]
                                                            }}
                                                            transition={{
                                                                duration: 5.2,
                                                                repeat: Infinity,
                                                                ease: 'easeInOut',
                                                                delay: index * 0.16
                                                            }}
                                                            className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accent} text-[#ffffff] shadow-lg`}
                                                        >
                                                            <FontAwesomeIcon icon={item.icon} />
                                                        </motion.div>
                                                    </div>

                                                    <h2 className={`mt-6 text-xl font-extrabold md:text-2xl ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                                        {item.title}
                                                    </h2>

                                                    <p className={`mt-3 text-sm leading-relaxed md:text-base ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                                        {item.summary}
                                                    </p>

                                                    <motion.div
                                                        initial={{ width: 0, opacity: 0.35 }}
                                                        whileInView={{ width: '100%', opacity: 1 }}
                                                        viewport={{ once: true }}
                                                        transition={{ duration: 0.75, ease: 'easeOut', delay: 0.18 }}
                                                        className={`mt-5 h-px bg-gradient-to-r ${item.accent}`}
                                                    />

                                                    <ul className="mt-5 space-y-3">
                                                        {item.details.map((detail, detailIndex) => (
                                                            <motion.li
                                                                key={detail}
                                                                initial={{ opacity: 0, x: isLeft ? -24 : 24 }}
                                                                whileInView={{ opacity: 1, x: 0 }}
                                                                viewport={{ once: true }}
                                                                transition={{
                                                                    duration: 0.5,
                                                                    ease: 'easeOut',
                                                                    delay: 0.14 + detailIndex * 0.08
                                                                }}
                                                                className="flex items-start gap-2.5"
                                                            >
                                                                <span className={`mt-1.5 inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-r ${item.accent}`} />
                                                                <span className={`text-sm md:text-[15px] ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                                                                    {detail}
                                                                </span>
                                                            </motion.li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </motion.div>
                                        </div>

                                        <div className="relative hidden md:block">
                                            <motion.div
                                                initial={{ opacity: 0, x: isLeft ? 24 : -24 }}
                                                whileInView={{ opacity: 1, x: 0 }}
                                                viewport={{ once: true, amount: 0.4 }}
                                                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.12 }}
                                                className={`absolute top-1/2 -translate-y-1/2 text-[7rem] font-black tracking-normal ${yearGhostClass} ${
                                                    isLeft ? 'left-10' : 'right-10'
                                                }`}
                                            >
                                                <span>{item.year}</span>
                                                <motion.span
                                                    className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${item.accent} bg-clip-text text-transparent opacity-0 drop-shadow-[0_0_30px_rgba(34,211,238,0.22)]`}
                                                    initial={false}
                                                    animate={{ opacity: isActive ? isDarkMode ? 0.34 : 0.46 : 0 }}
                                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                                >
                                                    {item.year}
                                                </motion.span>
                                            </motion.div>
                                            <motion.div
                                                initial={{ opacity: 0, scaleX: 0 }}
                                                whileInView={{ opacity: 1, scaleX: 1 }}
                                                viewport={{ once: true, amount: 0.4 }}
                                                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.16 }}
                                                className={`absolute top-10 h-px w-24 bg-gradient-to-r ${
                                                    isLeft ? `${item.accent} left-0 origin-left` : `${item.accent} right-0 origin-right`
                                                }`}
                                            />
                                        </div>
                                    </div>
                                </motion.article>
                            );
                        })}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CheongyeonHistoryPage;
