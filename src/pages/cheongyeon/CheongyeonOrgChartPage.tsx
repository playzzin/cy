import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
    faBoxesStacked,
    faBuilding,
    faCalculator,
    faChartLine,
    faChevronDown,
    faCrown,
    faHardHat,
    faHelmetSafety,
    faLayerGroup,
    faMapMarkerAlt,
    faSitemap,
    faUserTie,
    faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import { Site, siteService } from '../../services/siteService';
import { OrgNode, useOrganizationTree } from './hooks/useOrganizationTree';

type DepartmentKey = 'construction' | 'sales' | 'finance' | 'materials';

type TeamSlot = {
    slot: number;
    displayName: string;
    originalName: string;
    leaderName: string;
    leaderImageUrl: string;
    memberCount: number;
    siteNames: string[];
    statusLabel: string;
    members: OrgNode[];
    isPlaceholder: boolean;
    source?: OrgNode;
};

type DepartmentCardConfig = {
    key: DepartmentKey;
    title: string;
    english: string;
    description: string;
    icon: IconDefinition;
    accent: string;
    iconGradient: string;
    highlights: string[];
    members: Array<{ name: string; role: string }>;
    value: string;
};

const PYRAMID_ROW_SIZES = [1, 2, 3, 4];
const TEAM_SLOT_LEADERS: Array<string | undefined> = [
    '이재욱',
    '김봉수',
    '김세흔',
    '김덕기',
    '김군회',
    '박상국',
    undefined,
    '김동혁',
    '임효재',
    '유재훈',
];

const isCheongyeonName = (value?: string) => {
    const normalized = String(value ?? '').replace(/\s+/g, '').toLowerCase();
    return normalized.includes('청연') || normalized.includes('cheongyeon');
};

const getTeamWorkers = (team: OrgNode) => team.children.filter((child) => child.type === 'worker');

const findWorkerByName = (team: OrgNode, targetName?: string) => {
    if (!targetName) {
        return undefined;
    }

    return getTeamWorkers(team).find((worker) => worker.name === targetName);
};

const getTeamLeader = (team: OrgNode) => {
    const leaderId = String(team.data?.leaderId ?? '');
    const leaderName = String(team.data?.leaderName ?? '');

    return getTeamWorkers(team).find((worker) => {
        const rank = String(worker.data?.rank ?? '');
        const role = String(worker.data?.role ?? '');
        const profile = `${rank} ${role}`;

        return (
            (leaderId && worker.id === leaderId) ||
            (leaderName && worker.name === leaderName) ||
            /(팀장|소장|반장|부장|이사)/.test(profile)
        );
    });
};

const getSiteNames = (team: OrgNode) => {
    const rawValues = [
        ...(Array.isArray(team.data?.siteNames) ? team.data.siteNames : []),
        team.data?.assignedSiteName,
    ];

    return Array.from(
        new Set(
            rawValues
                .map((value) => String(value ?? '').trim())
                .filter(Boolean)
        )
    );
};

const getTeamSiteNames = (team: OrgNode, sites: Site[]) => {
    const teamId = String(team.id ?? '').trim();
    const teamName = String(team.name ?? '').trim();
    const baseSiteNames = getSiteNames(team);
    const responsibleSiteNames = sites
        .filter((site) => {
            const responsibleTeamId = String(site.responsibleTeamId ?? '').trim();
            const responsibleTeamName = String(site.responsibleTeamName ?? '').trim();

            return (
                (teamId && responsibleTeamId === teamId) ||
                (teamName && responsibleTeamName === teamName)
            );
        })
        .map((site) => String(site.name ?? '').trim())
        .filter(Boolean);

    return Array.from(new Set([...baseSiteNames, ...responsibleSiteNames]));
};

const getStatusLabel = (status?: string) => {
    switch (String(status ?? 'active')) {
        case 'active':
            return '운영 중';
        case 'waiting':
            return '세팅 중';
        case 'closed':
            return '종료';
        default:
            return String(status ?? '운영 중');
    }
};

const getTeamSortOrder = (team: OrgNode) => {
    const matchedNumber = team.name.match(/(\d+)\s*팀/);
    if (matchedNumber) {
        return Number(matchedNumber[1]);
    }
    return Number.MAX_SAFE_INTEGER;
};

const formatNumber = (value: number) => new Intl.NumberFormat('ko-KR').format(value);

const pyramidRevealVariants: Variants = {
    hidden: { opacity: 0, y: 28, filter: 'blur(16px)' },
    visible: {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: {
            duration: 0.5,
            ease: 'easeOut',
            when: 'beforeChildren',
            staggerChildren: 0.06,
            delayChildren: 0.08,
        },
    },
    exit: {
        opacity: 0,
        y: -18,
        filter: 'blur(12px)',
        transition: { duration: 0.28, ease: 'easeInOut' },
    },
};

const pyramidItemVariants: Variants = {
    hidden: { opacity: 0, y: 22, scale: 0.97, filter: 'blur(10px)' },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        transition: { duration: 0.42, ease: 'easeOut' },
    },
    exit: { opacity: 0, y: -10, scale: 0.98, filter: 'blur(8px)', transition: { duration: 0.2 } },
};

const CheongyeonOrgChartPage: React.FC = () => {
    const { treeData, loading } = useOrganizationTree();
    const [selectedSlot, setSelectedSlot] = useState<number>(1);
    const [isConstructionOpen, setIsConstructionOpen] = useState(false);
    const [sites, setSites] = useState<Site[]>([]);
    const [sitesLoading, setSitesLoading] = useState(true);
    const pyramidSectionRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        let mounted = true;

        const loadSites = async () => {
            try {
                const siteList = await siteService.getSites();
                if (mounted) {
                    setSites(siteList);
                }
            } catch (error) {
                console.error('Failed to load sites for organization chart', error);
            } finally {
                if (mounted) {
                    setSitesLoading(false);
                }
            }
        };

        void loadSites();

        return () => {
            mounted = false;
        };
    }, []);

    const companyNodes = useMemo(
        () => treeData.filter((node) => node.type === 'company'),
        [treeData]
    );

    const cheongyeonCompanies = useMemo(
        () => companyNodes.filter((node) => isCheongyeonName(node.name)),
        [companyNodes]
    );

    const primaryCompany = useMemo(
        () =>
            cheongyeonCompanies[0] ??
            companyNodes.find((node) => node.data?.type === '시공사') ??
            null,
        [cheongyeonCompanies, companyNodes]
    );

    const constructionTeams = useMemo(() => {
        const sourceCompanies =
            cheongyeonCompanies.length > 0
                ? cheongyeonCompanies
                : primaryCompany
                    ? [primaryCompany]
                    : [];

        return sourceCompanies
            .flatMap((company) => company.children.filter((child) => child.type === 'team'))
            .sort((left, right) => {
                const orderGap = getTeamSortOrder(left) - getTeamSortOrder(right);
                if (orderGap !== 0) {
                    return orderGap;
                }
                return left.name.localeCompare(right.name, 'ko');
            });
    }, [cheongyeonCompanies, primaryCompany]);

    const uniqueSiteCount = useMemo(
        () => new Set(constructionTeams.flatMap((team) => getTeamSiteNames(team, sites))).size,
        [constructionTeams, sites]
    );

    const totalMembers = useMemo(
        () => constructionTeams.reduce((sum, team) => sum + getTeamWorkers(team).length, 0),
        [constructionTeams]
    );

    const slottedConstructionTeams = useMemo(() => {
        const remainingTeams = [...constructionTeams];

        return Array.from({ length: 10 }, (_, index) => {
            const preferredLeaderName = TEAM_SLOT_LEADERS[index];

            if (preferredLeaderName) {
                const matchedIndex = remainingTeams.findIndex((team) => {
                    const directLeaderName = String(team.data?.leaderName ?? '').trim();
                    return (
                        directLeaderName === preferredLeaderName ||
                        Boolean(findWorkerByName(team, preferredLeaderName))
                    );
                });

                if (matchedIndex >= 0) {
                    return remainingTeams.splice(matchedIndex, 1)[0];
                }
            }

            return remainingTeams.shift();
        });
    }, [constructionTeams]);

    const teamSlots = useMemo<TeamSlot[]>(
        () =>
            Array.from({ length: 10 }, (_, index) => {
                const source = slottedConstructionTeams[index];
                const members = source ? getTeamWorkers(source) : [];
                const preferredLeaderName = TEAM_SLOT_LEADERS[index];
                const preferredLeader = source ? findWorkerByName(source, preferredLeaderName) : undefined;
                const leader = preferredLeader ?? (source ? getTeamLeader(source) : undefined);

                return {
                    slot: index + 1,
                    displayName: `청연 ${index + 1}팀`,
                    originalName: source?.name ?? '확장 예정 라인',
                    leaderName:
                        preferredLeaderName ??
                        leader?.name ??
                        source?.data?.leaderName ??
                        (source ? '현장 리더 확인 필요' : '배치 예정'),
                    leaderImageUrl: String(
                        preferredLeader?.data?.profileImageUrl ??
                        leader?.data?.profileImageUrl ??
                        ''
                    ),
                    memberCount: members.length,
                    siteNames: source ? getTeamSiteNames(source, sites) : [],
                    statusLabel: source ? getStatusLabel(source.data?.status) : '확장 예정',
                    members,
                    isPlaceholder: !source,
                    source,
                };
            }),
        [sites, slottedConstructionTeams]
    );

    const pyramidRows = useMemo(() => {
        let cursor = 0;
        return PYRAMID_ROW_SIZES.map((size) => {
            const row = teamSlots.slice(cursor, cursor + size);
            cursor += size;
            return row;
        });
    }, [teamSlots]);

    const selectedTeam = teamSlots.find((slot) => slot.slot === selectedSlot) ?? teamSlots[0];
    const extraTeamCount = Math.max(0, constructionTeams.length - 10);
    const selectedTeamMembers = useMemo(() => {
        const selectedLeaderName = selectedTeam.leaderName;

        return [...selectedTeam.members].sort((left, right) => {
            const leftLabel = `${String(left.data?.rank ?? '')} ${String(left.data?.role ?? '')}`;
            const rightLabel = `${String(right.data?.rank ?? '')} ${String(right.data?.role ?? '')}`;
            const leftPriority =
                left.name === selectedLeaderName || /(팀장|소장|반장|부장|이사)/.test(leftLabel) ? 0 : 1;
            const rightPriority =
                right.name === selectedLeaderName || /(팀장|소장|반장|부장|이사)/.test(rightLabel) ? 0 : 1;

            if (leftPriority !== rightPriority) {
                return leftPriority - rightPriority;
            }

            return left.name.localeCompare(right.name, 'ko');
        });
    }, [selectedTeam]);

    const departmentCards = useMemo<DepartmentCardConfig[]>(
        () => [
            {
                key: 'construction',
                title: '시공팀',
                english: 'Construction Operations',
                description: '현장 공정, 인력 운영, 품질과 안전을 실시간으로 총괄합니다.',
                icon: faHelmetSafety,
                accent: 'from-cyan-500/25 via-sky-500/15 to-white/5',
                iconGradient: 'from-cyan-400 to-blue-500',
                value: `${Math.min(constructionTeams.length, 10)}/10`,
                highlights: [
                    `${formatNumber(totalMembers)}명 투입`,
                    `${formatNumber(uniqueSiteCount)}개 현장`,
                    '1~10팀 피라미드 운영',
                ],
                members: [
                    { name: '청연 1팀~10팀', role: `전체 ${formatNumber(totalMembers)}명 운영` },
                ],
            },
            {
                key: 'sales',
                title: '영업팀',
                english: 'Sales & Bidding',
                description: '입찰, 견적, 수주 파이프라인과 대외 커뮤니케이션을 담당합니다.',
                icon: faChartLine,
                accent: 'from-emerald-500/25 via-teal-500/15 to-white/5',
                iconGradient: 'from-emerald-400 to-teal-500',
                value: 'Bid Flow',
                highlights: ['입찰 전략', '수주 관리', '고객 대응'],
                members: [{ name: '김팀장', role: '수주/입찰 리드' }],
            },
            {
                key: 'finance',
                title: '경리팀',
                english: 'Finance & Accounting',
                description: '원가, 정산, 회계 마감과 자금 흐름을 안정적으로 관리합니다.',
                icon: faCalculator,
                accent: 'from-amber-500/25 via-orange-500/15 to-white/5',
                iconGradient: 'from-amber-400 to-orange-500',
                value: 'Cost Control',
                highlights: ['정산 관리', '회계 마감', '세금 자료'],
                members: [
                    { name: '이대리', role: '정산/회계 운영' },
                    { name: '고과장', role: '원가/마감 총괄' },
                ],
            },
            {
                key: 'materials',
                title: '자재팀',
                english: 'Materials & Logistics',
                description: '자재 발주, 재고 운영, 납기 대응을 연결해 현장 공급을 책임집니다.',
                icon: faBoxesStacked,
                accent: 'from-fuchsia-500/20 via-violet-500/10 to-white/5',
                iconGradient: 'from-fuchsia-400 to-violet-500',
                value: 'Supply Chain',
                highlights: ['발주/조달', '재고 추적', '납기 대응'],
                members: [{ name: '이차장', role: '자재/물류 총괄' }],
            },
        ],
        [constructionTeams.length, totalMembers, uniqueSiteCount]
    );

    const ceoName = String(primaryCompany?.data?.ceoName ?? '').trim() || '대표이사';
    const companyName = primaryCompany?.name ?? '청연ENG';

    useEffect(() => {
        if (!isConstructionOpen) {
            return;
        }

        window.setTimeout(() => {
            pyramidSectionRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        }, 90);
    }, [isConstructionOpen]);

    if (loading || sitesLoading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-300">
                <div className="relative mb-8 h-20 w-20">
                    <div className="absolute inset-0 rounded-full border border-cyan-400/30" />
                    <div className="absolute inset-2 rounded-full border-2 border-t-cyan-300 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-cyan-300">
                        <FontAwesomeIcon icon={faSitemap} className="text-2xl" />
                    </div>
                </div>
                <p className="text-lg font-semibold tracking-[0.3em] text-cyan-100/80">ORGANIZATION LOADING</p>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen bg-[#08111f] text-slate-100"
            style={{ fontFamily: "'Pretendard Variable','Pretendard','SUIT Variable','Noto Sans KR',sans-serif" }}
        >
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute left-[-10%] top-[-18%] h-[32rem] w-[32rem] rounded-full bg-cyan-500/12 blur-[160px]" />
                <div className="absolute bottom-[-20%] right-[-6%] h-[30rem] w-[30rem] rounded-full bg-fuchsia-500/10 blur-[180px]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.08),transparent_32%),linear-gradient(to_bottom,rgba(8,17,31,0.18),rgba(8,17,31,0.94))]" />
            </div>

            <main className="relative z-10 mx-auto flex w-full max-w-[1520px] flex-col gap-8 px-4 py-6 md:px-8 md:py-8 xl:px-10">
                <motion.section
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45 }}
                    className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] shadow-[0_32px_120px_rgba(2,6,23,0.55)] backdrop-blur-xl"
                >
                    <div className="grid gap-8 px-6 py-8 md:px-8 lg:grid-cols-[minmax(0,1.2fr)_420px] lg:items-center lg:px-10">
                        <div className="space-y-5">
                            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100/85">
                                <FontAwesomeIcon icon={faLayerGroup} />
                                Cheongyeon Organization Blueprint
                            </div>
                            <div className="space-y-3">
                                <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
                                    CEO 중심의 피라미드 조직도로
                                    <br className="hidden md:block" /> 청연 운영 라인을 재정렬했습니다.
                                </h1>
                                <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                                    최상단은 CEO, 그 아래는 시공팀 · 영업팀 · 경리팀 · 자재팀으로 분기하고,
                                    시공팀은 현장 운영 흐름이 한눈에 보이도록 1팀부터 10팀까지 피라미드 구조로 배치했습니다.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 md:gap-4">
                            <OverviewCard label="표준 팀 슬롯" value="10" accent="from-cyan-400 to-blue-500" />
                            <OverviewCard
                                label="실운영 팀"
                                value={formatNumber(Math.min(constructionTeams.length, 10))}
                                accent="from-emerald-400 to-teal-500"
                            />
                            <OverviewCard
                                label="투입 인원"
                                value={formatNumber(totalMembers)}
                                accent="from-amber-400 to-orange-500"
                            />
                            <OverviewCard
                                label="운영 현장"
                                value={formatNumber(uniqueSiteCount)}
                                accent="from-fuchsia-400 to-violet-500"
                            />
                        </div>
                    </div>
                </motion.section>

                <motion.section
                    initial={{ opacity: 0, y: 22 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.05 }}
                    className="rounded-[36px] border border-white/10 bg-slate-950/55 px-4 py-6 shadow-[0_32px_110px_rgba(2,6,23,0.55)] backdrop-blur-2xl md:px-6 md:py-8 xl:px-8"
                >
                    <div className="flex justify-center">
                        <motion.div
                            whileHover={{ y: -4, scale: 1.01 }}
                            className="relative w-full max-w-[420px] overflow-hidden rounded-[28px] border border-cyan-300/25 bg-gradient-to-br from-slate-900 via-slate-950 to-cyan-950/60 px-6 py-6 text-center shadow-[0_24px_60px_rgba(34,211,238,0.18)]"
                        >
                            <div className="absolute inset-x-[18%] top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-[0_16px_32px_rgba(59,130,246,0.35)]">
                                <FontAwesomeIcon icon={faCrown} className="text-xl" />
                            </div>
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-200/80">
                                Chief Executive Officer
                            </div>
                            <div className="text-3xl font-black tracking-tight text-white">{ceoName}</div>
                            <div className="mt-2 text-sm text-slate-300">{companyName}</div>
                            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-300">
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                                    최고 의사결정
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                                    조직 운영 총괄
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                                    현장 전략 컨트롤타워
                                </span>
                            </div>
                        </motion.div>
                    </div>

                    <div className="relative mt-10">
                        <div className="absolute left-1/2 top-[-38px] hidden h-10 w-px -translate-x-1/2 bg-gradient-to-b from-cyan-300/80 to-transparent xl:block" />
                        <div className="absolute left-[12.5%] right-[12.5%] top-0 hidden h-px bg-gradient-to-r from-transparent via-cyan-300/65 to-transparent xl:block" />

                        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                            {departmentCards.map((card) => (
                                <DepartmentCard
                                    key={card.key}
                                    card={card}
                                    isActive={card.key === 'construction' && isConstructionOpen}
                                    onClick={
                                        card.key === 'construction'
                                            ? () => setIsConstructionOpen(true)
                                            : undefined
                                    }
                                />
                            ))}
                        </div>
                    </div>
                </motion.section>

                <section
                    ref={pyramidSectionRef}
                    className={isConstructionOpen ? 'grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_380px]' : 'grid gap-6'}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="overflow-hidden rounded-[34px] border border-white/10 bg-white/[0.045] px-5 py-6 shadow-[0_30px_100px_rgba(2,6,23,0.5)] backdrop-blur-xl md:px-6 md:py-7 xl:px-8"
                    >
                        <AnimatePresence mode="wait" initial={false}>
                            {isConstructionOpen ? (
                                <motion.div
                                    key="construction-open-panel"
                                    variants={pyramidRevealVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                >
                                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                                        <div className="space-y-2">
                                            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-100/80">
                                                <FontAwesomeIcon icon={faHardHat} />
                                                Construction Pyramid
                                            </div>
                                            <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">
                                                시공팀 1~10 운영 피라미드
                                            </h2>
                                            <p className="max-w-3xl text-sm leading-7 text-slate-300">
                                                상단에서 하단으로 갈수록 현장 운영 라인이 넓어지도록 배치했습니다.
                                                팀 카드를 누르면 현재 연결된 실제 팀 정보와 인원 구성을 오른쪽에서 확인할 수 있습니다.
                                            </p>
                                        </div>

                                        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/8 px-4 py-3 text-sm text-cyan-50">
                                            <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Current Coverage</div>
                                            <div className="mt-1 text-xl font-black">
                                                {formatNumber(Math.min(constructionTeams.length, 10))} / 10 팀 연결
                                            </div>
                                        </div>
                                    </div>

                                    <div className="relative mt-10 space-y-4">
                                        <div className="pointer-events-none absolute left-1/2 top-[-12px] hidden h-[calc(100%-4rem)] w-px -translate-x-1/2 bg-gradient-to-b from-cyan-300/25 via-white/0 to-white/0 xl:block" />
                                        {pyramidRows.map((row, rowIndex) => (
                                            <motion.div
                                                key={`row-${rowIndex}`}
                                                variants={pyramidItemVariants}
                                                className="flex flex-wrap justify-center gap-4"
                                            >
                                                {row.map((slot) => (
                                                    <motion.button
                                                        key={slot.slot}
                                                        type="button"
                                                        onClick={() => setSelectedSlot(slot.slot)}
                                                        className="w-full max-w-[220px] text-left focus:outline-none"
                                                        variants={pyramidItemVariants}
                                                    >
                                                        <motion.div
                                                            whileHover={{ y: -6, scale: 1.02 }}
                                                            animate={{
                                                                y: selectedSlot === slot.slot ? -4 : 0,
                                                                scale: selectedSlot === slot.slot ? 1.02 : 1,
                                                            }}
                                                            transition={{ duration: 0.28, ease: 'easeOut' }}
                                                            className={`relative overflow-hidden rounded-[26px] border px-5 py-5 shadow-[0_18px_46px_rgba(2,6,23,0.35)] transition-all duration-300 ${
                                                                selectedSlot === slot.slot
                                                                    ? 'border-cyan-300/70 bg-gradient-to-br from-cyan-400/18 via-slate-900 to-slate-950'
                                                                    : slot.isPlaceholder
                                                                        ? 'border-white/10 bg-white/[0.035] hover:border-white/20'
                                                                        : 'border-white/12 bg-slate-950/72 hover:border-cyan-300/35'
                                                            }`}
                                                        >
                                                            <div className="absolute inset-x-[18%] top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-60" />
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div>
                                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                                                                        Team {slot.slot}
                                                                    </div>
                                                                    <div className="mt-2 text-xl font-black tracking-tight text-white">
                                                                        {slot.displayName}
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-2">
                                                                    <LeaderAvatar
                                                                        imageUrl={slot.leaderImageUrl}
                                                                        name={slot.leaderName}
                                                                        size="sm"
                                                                    />
                                                                    <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
                                                                        {slot.statusLabel}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="mt-4 text-sm text-slate-300">
                                                                {slot.originalName}
                                                            </div>

                                                            <div className="mt-5 grid grid-cols-2 gap-2 text-xs text-slate-300">
                                                                <SmallStat label="리더" value={slot.leaderName} />
                                                                <SmallStat label="인원" value={`${formatNumber(slot.memberCount)}명`} />
                                                            </div>

                                                            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                                                                <FontAwesomeIcon icon={faMapMarkerAlt} className="text-cyan-300/80" />
                                                                {slot.siteNames.length > 0 ? `${slot.siteNames.length}개 현장 연결·담당` : '현장 연결 대기'}
                                                            </div>
                                                        </motion.div>
                                                    </motion.button>
                                                ))}
                                            </motion.div>
                                        ))}
                                    </div>

                                    {extraTeamCount > 0 && (
                                        <div className="mt-8 rounded-2xl border border-amber-300/15 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
                                            10팀 이후 추가로 연결된 시공팀이 {formatNumber(extraTeamCount)}개 있습니다. 현재 화면은 요청 기준에 맞춰 1팀부터 10팀까지만 피라미드에 노출합니다.
                                        </div>
                                    )}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="construction-closed-panel"
                                    initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
                                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                    exit={{ opacity: 0, y: -12, filter: 'blur(10px)' }}
                                    transition={{ duration: 0.32, ease: 'easeOut' }}
                                    className="flex flex-col gap-5"
                                >
                                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100/80">
                                        <FontAwesomeIcon icon={faHelmetSafety} />
                                        Team Reveal
                                    </div>
                                    <div className="space-y-3">
                                        <h2 className="text-2xl font-black tracking-tight text-white">
                                            시공팀 카드를 누르면 팀 피라미드가 펼쳐집니다.
                                        </h2>
                                        <p className="max-w-3xl text-sm leading-7 text-slate-300">
                                            시공팀을 클릭하면 청연 1팀부터 10팀까지가 순차적으로 나타나고,
                                            선택한 팀의 전체 인원과 현장 연결 정보도 함께 전환됩니다.
                                        </p>
                                    </div>
                                    <motion.button
                                        type="button"
                                        whileHover={{ y: -4, scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setIsConstructionOpen(true)}
                                        className="inline-flex w-fit items-center gap-3 rounded-2xl border border-cyan-300/25 bg-gradient-to-r from-cyan-400/15 to-blue-500/15 px-5 py-3 text-sm font-semibold text-cyan-50 shadow-[0_16px_36px_rgba(34,211,238,0.12)]"
                                    >
                                        <span>시공팀 펼치기</span>
                                        <motion.span
                                            animate={{ y: [0, 4, 0] }}
                                            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                                        >
                                            <FontAwesomeIcon icon={faChevronDown} />
                                        </motion.span>
                                    </motion.button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    <AnimatePresence initial={false}>
                        {isConstructionOpen && (
                            <motion.aside
                                variants={pyramidItemVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="rounded-[34px] border border-white/10 bg-slate-950/65 px-5 py-6 shadow-[0_28px_90px_rgba(2,6,23,0.52)] backdrop-blur-2xl md:px-6 xl:sticky xl:top-6 xl:self-start"
                            >
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={selectedTeam.slot}
                                        initial={{ opacity: 0, y: 18, scale: 0.985 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -14, scale: 0.985 }}
                                        transition={{ duration: 0.32, ease: 'easeOut' }}
                                    >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-100/70">
                                            Focus Team
                                        </div>
                                        <h3 className="mt-2 text-2xl font-black tracking-tight text-white">
                                            {selectedTeam.displayName}
                                        </h3>
                                        <p className="mt-2 text-sm text-slate-300">{selectedTeam.originalName}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-3">
                                        <LeaderAvatar
                                            imageUrl={selectedTeam.leaderImageUrl}
                                            name={selectedTeam.leaderName}
                                            size="lg"
                                        />
                                        <div className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-50">
                                            {selectedTeam.statusLabel}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 grid grid-cols-2 gap-3">
                                    <DetailMetric icon={faUserTie} label="리더" value={selectedTeam.leaderName} />
                                    <DetailMetric icon={faUsers} label="인원" value={`${formatNumber(selectedTeam.memberCount)}명`} />
                                    <DetailMetric icon={faBuilding} label="현장 수" value={`${formatNumber(selectedTeam.siteNames.length)}개`} />
                                    <DetailMetric icon={faSitemap} label="조직 단계" value={`시공팀 > ${selectedTeam.slot}팀`} />
                                </div>

                                <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                                        운영 메모
                                    </div>
                                    <p className="mt-3 text-sm leading-7 text-slate-300">
                                        {selectedTeam.isPlaceholder
                                            ? '이 슬롯은 아직 실제 팀 데이터가 연결되지 않았습니다. 향후 팀 확장 시 해당 위치에 즉시 반영되도록 준비된 자리입니다.'
                                            : '실제 청연 팀 데이터를 연결한 슬롯입니다. 원본 팀명과 현장 인원 정보를 유지하면서 조직도 표시는 1팀부터 10팀까지 통일했습니다.'}
                                    </p>
                                </div>

                                        <div className="mt-6">
                                            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                                                연결 현장 / 담당팀 현장
                                            </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {selectedTeam.siteNames.length > 0 ? (
                                            selectedTeam.siteNames.map((siteName, index) => (
                                                <motion.span
                                                    key={`${selectedTeam.slot}-${siteName}`}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.24, delay: index * 0.03 }}
                                                    className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-slate-200"
                                                >
                                                    {siteName}
                                                </motion.span>
                                            ))
                                        ) : (
                                            <span className="rounded-full border border-dashed border-white/15 px-3 py-1.5 text-xs text-slate-400">
                                                연결된 현장이 없습니다.
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                                            팀 인원
                                        </div>
                                        <motion.div
                                            key={`member-count-${selectedTeam.slot}`}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-50"
                                        >
                                            전체 {formatNumber(selectedTeam.memberCount)}명
                                        </motion.div>
                                    </div>
                                    <div className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                                        {selectedTeamMembers.length > 0 ? (
                                            selectedTeamMembers.map((member, index) => (
                                                <motion.div
                                                    key={`${selectedTeam.slot}-${member.id ?? member.name}`}
                                                    initial={{ opacity: 0, x: 18 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ duration: 0.26, delay: Math.min(index * 0.025, 0.28) }}
                                                    className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-2.5"
                                                >
                                                    <div>
                                                        <div className="text-sm font-semibold text-white">{member.name}</div>
                                                        <div className="text-xs text-slate-400">
                                                            {String(member.data?.rank ?? member.data?.role ?? '직책 미등록')}
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {String(member.data?.status ?? '재직')}
                                                    </div>
                                                </motion.div>
                                            ))
                                        ) : (
                                            <div className="rounded-2xl border border-dashed border-white/12 px-4 py-4 text-sm text-slate-400">
                                                연결된 팀원이 없습니다.
                                            </div>
                                        )}
                                    </div>
                                </div>
                                    </motion.div>
                                </AnimatePresence>
                            </motion.aside>
                        )}
                    </AnimatePresence>
                </section>
            </main>
        </div>
    );
};

const OverviewCard = ({
    label,
    value,
    accent,
}: {
    label: string;
    value: string;
    accent: string;
}) => (
    <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/55 p-4 shadow-[0_18px_40px_rgba(2,6,23,0.42)]">
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
        <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">{label}</div>
        <div className="mt-4 text-2xl font-black text-white md:text-3xl">{value}</div>
    </div>
);

const DepartmentCard = ({
    card,
    isActive = false,
    onClick,
}: {
    card: DepartmentCardConfig;
    isActive?: boolean;
    onClick?: () => void;
}) => {
    const body = (
        <>
            <div className={`absolute inset-0 bg-gradient-to-br ${card.accent}`} />
            <div className="absolute left-1/2 top-[-24px] hidden h-6 w-px -translate-x-1/2 bg-gradient-to-b from-cyan-300/70 to-transparent xl:block" />
            <div className="relative z-10">
                <div className="flex items-start justify-between gap-3">
                    <div
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.iconGradient} text-white shadow-[0_16px_28px_rgba(15,23,42,0.38)]`}
                    >
                        <FontAwesomeIcon icon={card.icon} className="text-lg" />
                    </div>
                    <div className="flex items-center gap-2">
                        {onClick && (
                            <motion.span
                                animate={{ rotate: isActive ? 180 : 0 }}
                                transition={{ duration: 0.28, ease: 'easeOut' }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/15 bg-cyan-400/10 text-cyan-50"
                            >
                                <FontAwesomeIcon icon={faChevronDown} className="text-xs" />
                            </motion.span>
                        )}
                        <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/90">
                            {card.value}
                        </div>
                    </div>
                </div>

                <div className="mt-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                        {card.english}
                    </div>
                    <div className="mt-2 text-2xl font-black tracking-tight text-white">{card.title}</div>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{card.description}</p>
                </div>

                {onClick && (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-50">
                        {isActive ? '팀 접기' : '팀 펼치기'}
                    </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                    {card.highlights.map((highlight) => (
                        <span
                            key={highlight}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200"
                        >
                            {highlight}
                        </span>
                    ))}
                </div>

                <div className="mt-5 space-y-2">
                    {card.members.map((member, index) => (
                        <motion.div
                            key={`${card.key}-${member.name}`}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.5 }}
                            transition={{ duration: 0.24, delay: index * 0.06 }}
                            className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5"
                        >
                            <div className="text-sm font-semibold text-white">{member.name}</div>
                            <div className="text-xs text-slate-300">{member.role}</div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </>
    );

    if (onClick) {
        return (
            <motion.button
                type="button"
                whileHover={{ y: -6, scale: 1.01 }}
                whileTap={{ scale: 0.985 }}
                transition={{ duration: 0.2 }}
                onClick={onClick}
                className={`relative overflow-hidden rounded-[28px] border bg-white/[0.04] p-5 text-left shadow-[0_18px_48px_rgba(2,6,23,0.36)] ${
                    isActive ? 'border-cyan-300/40' : 'border-white/10'
                }`}
            >
                {body}
            </motion.button>
        );
    }

    return (
        <motion.div
            whileHover={{ y: -6, scale: 1.01 }}
            transition={{ duration: 0.2 }}
            className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_48px_rgba(2,6,23,0.36)]"
        >
            {body}
        </motion.div>
    );
};

const SmallStat = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</div>
        <div className="mt-1 truncate text-sm font-semibold text-white">{value}</div>
    </div>
);

const DetailMetric = ({
    icon,
    label,
    value,
}: {
    icon: IconDefinition;
    label: string;
    value: string;
}) => (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            <FontAwesomeIcon icon={icon} />
            {label}
        </div>
        <div className="mt-3 text-sm font-semibold text-white">{value}</div>
    </div>
);

const LeaderAvatar = ({
    imageUrl,
    name,
    size,
}: {
    imageUrl?: string;
    name: string;
    size: 'sm' | 'lg';
}) => {
    const dimensions = size === 'lg' ? 'h-16 w-16 rounded-2xl' : 'h-11 w-11 rounded-xl';
    const labelSize = size === 'lg' ? 'text-lg' : 'text-sm';
    const resolvedImageUrl = String(imageUrl ?? '').trim();

    return (
        <div className={`overflow-hidden border border-white/10 bg-slate-900/80 ${dimensions}`}>
            {resolvedImageUrl ? (
                <img
                    src={resolvedImageUrl}
                    alt={name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                />
            ) : (
                <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-400/30 to-blue-500/20 font-black text-white ${labelSize}`}>
                    {name ? name.charAt(0) : '팀'}
                </div>
            )}
        </div>
    );
};

export default CheongyeonOrgChartPage;
