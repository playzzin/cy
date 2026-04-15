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
import { useSiteMode } from '../../contexts/SiteModeContext';
import './CheongyeonOrgChartPage.css';

type DepartmentKey = 'construction' | 'hrPeople' | 'accounting' | 'management' | 'sales' | 'development';

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

type TeamTone = {
    selectedCard: string;
    normalCard: string;
    statusBadge: string;
    iconText: string;
};

const TEAM_GRID_COLUMNS = 5;
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

const DEPARTMENT_TEAM_PRESETS: Record<Exclude<DepartmentKey, 'construction'>, Array<{
    displayName: string;
    originalName: string;
    leaderName: string;
    memberCount: number;
    statusLabel: string;
    siteNames: string[];
}>> = {
    hrPeople: [
        {
            displayName: '인사팀 1팀',
            originalName: '인사 운영본부',
            leaderName: '김팀장',
            memberCount: 5,
            statusLabel: '운영 중',
            siteNames: ['본사 인사 라인'],
        },
        {
            displayName: '인사팀 2팀',
            originalName: '채용·교육 파트',
            leaderName: '박팀장',
            memberCount: 4,
            statusLabel: '운영 중',
            siteNames: ['채용·교육'],
        },
    ],
    accounting: [
        {
            displayName: '회계팀 1팀',
            originalName: '회계·정산 파트',
            leaderName: '이과장',
            memberCount: 3,
            statusLabel: '운영 중',
            siteNames: ['회계·정산'],
        },
    ],
    management: [
        {
            displayName: '관리팀',
            originalName: '운영·총무 관리 파트',
            leaderName: '고대리',
            memberCount: 4,
            statusLabel: '운영 중',
            siteNames: ['운영·총무'],
        },
    ],
    sales: [
        {
            displayName: '영업팀 1팀',
            originalName: '수주 영업 라인',
            leaderName: '이차장',
            memberCount: 6,
            statusLabel: '운영 중',
            siteNames: ['입찰·영업'],
        },
        {
            displayName: '영업팀 2팀',
            originalName: '파트너 영업 라인',
            leaderName: '이차장',
            memberCount: 5,
            statusLabel: '운영 중',
            siteNames: ['협력사·파트너'],
        },
    ],
    development: [
        {
            displayName: '개발팀 1팀',
            originalName: '플랫폼 개발 라인',
            leaderName: '최실장',
            memberCount: 5,
            statusLabel: '운영 중',
            siteNames: ['내부 시스템 개발'],
        },
        {
            displayName: '개발팀 2팀',
            originalName: 'AI 자동화 라인',
            leaderName: '최실장',
            memberCount: 4,
            statusLabel: '세팅 중',
            siteNames: ['AI 이미지·자동화'],
        },
    ],
};

const getTeamTone = (departmentKey: DepartmentKey, displayName: string, isDarkMode: boolean): TeamTone => {
    const isManagementTeam = displayName.includes('관리팀');
    const isAccountingTeam = displayName.includes('회계팀');

    if (isManagementTeam) {
        return isDarkMode
            ? {
                selectedCard: 'border-cyan-300/70 bg-gradient-to-br from-cyan-400/18 via-slate-900 to-slate-950',
                normalCard: 'border-cyan-300/35 bg-slate-950/72 hover:border-cyan-300/55',
                statusBadge: 'border-cyan-300/20 bg-cyan-400/12 text-cyan-100',
                iconText: 'text-cyan-300/90'
            }
            : {
                selectedCard: 'border-cyan-400 bg-gradient-to-br from-cyan-100 via-white to-sky-50',
                normalCard: 'border-cyan-200 bg-white hover:border-cyan-300',
                statusBadge: 'border-cyan-300/60 bg-cyan-50 text-cyan-700',
                iconText: 'text-cyan-600'
            };
    }

    if (isAccountingTeam || departmentKey === 'accounting') {
        return isDarkMode
            ? {
                selectedCard: 'border-amber-300/70 bg-gradient-to-br from-amber-400/18 via-slate-900 to-slate-950',
                normalCard: 'border-amber-300/25 bg-slate-950/72 hover:border-amber-300/45',
                statusBadge: 'border-amber-300/20 bg-amber-400/12 text-amber-100',
                iconText: 'text-amber-300/90'
            }
            : {
                selectedCard: 'border-amber-400 bg-gradient-to-br from-amber-100 via-white to-orange-50',
                normalCard: 'border-amber-200 bg-white hover:border-amber-300',
                statusBadge: 'border-amber-300/60 bg-amber-50 text-amber-700',
                iconText: 'text-amber-600'
            };
    }

    if (departmentKey === 'management') {
        return isDarkMode
            ? {
                selectedCard: 'border-cyan-300/70 bg-gradient-to-br from-cyan-400/18 via-slate-900 to-slate-950',
                normalCard: 'border-cyan-300/35 bg-slate-950/72 hover:border-cyan-300/55',
                statusBadge: 'border-cyan-300/20 bg-cyan-400/12 text-cyan-100',
                iconText: 'text-cyan-300/90'
            }
            : {
                selectedCard: 'border-cyan-400 bg-gradient-to-br from-cyan-100 via-white to-sky-50',
                normalCard: 'border-cyan-200 bg-white hover:border-cyan-300',
                statusBadge: 'border-cyan-300/60 bg-cyan-50 text-cyan-700',
                iconText: 'text-cyan-600'
            };
    }

    if (departmentKey === 'hrPeople') {
        return isDarkMode
            ? {
                selectedCard: 'border-emerald-300/70 bg-gradient-to-br from-emerald-400/18 via-slate-900 to-slate-950',
                normalCard: 'border-emerald-300/25 bg-slate-950/72 hover:border-emerald-300/45',
                statusBadge: 'border-emerald-300/20 bg-emerald-400/12 text-emerald-100',
                iconText: 'text-emerald-300/90'
            }
            : {
                selectedCard: 'border-emerald-400 bg-gradient-to-br from-emerald-100 via-white to-teal-50',
                normalCard: 'border-emerald-200 bg-white hover:border-emerald-300',
                statusBadge: 'border-emerald-300/60 bg-emerald-50 text-emerald-700',
                iconText: 'text-emerald-600'
            };
    }

    if (departmentKey === 'sales') {
        return isDarkMode
            ? {
                selectedCard: 'border-fuchsia-300/70 bg-gradient-to-br from-fuchsia-400/18 via-slate-900 to-slate-950',
                normalCard: 'border-fuchsia-300/25 bg-slate-950/72 hover:border-fuchsia-300/45',
                statusBadge: 'border-fuchsia-300/20 bg-fuchsia-400/12 text-fuchsia-100',
                iconText: 'text-fuchsia-300/90'
            }
            : {
                selectedCard: 'border-fuchsia-400 bg-gradient-to-br from-fuchsia-100 via-white to-violet-50',
                normalCard: 'border-fuchsia-200 bg-white hover:border-fuchsia-300',
                statusBadge: 'border-fuchsia-300/60 bg-fuchsia-50 text-fuchsia-700',
                iconText: 'text-fuchsia-600'
            };
    }

    return isDarkMode
        ? {
            selectedCard: 'border-sky-300/70 bg-gradient-to-br from-sky-400/18 via-slate-900 to-slate-950',
            normalCard: 'border-sky-300/25 bg-slate-950/72 hover:border-sky-300/45',
            statusBadge: 'border-sky-300/20 bg-sky-400/12 text-sky-100',
            iconText: 'text-sky-300/90'
        }
        : {
            selectedCard: 'border-sky-400 bg-gradient-to-br from-sky-100 via-white to-blue-50',
            normalCard: 'border-sky-200 bg-white hover:border-sky-300',
            statusBadge: 'border-sky-300/60 bg-sky-50 text-sky-700',
            iconText: 'text-sky-600'
        };
};

const isCheongyeonName = (value?: string) => {
    const normalized = String(value ?? '').replace(/\s+/g, '').toLowerCase();
    return normalized.includes('청연') || normalized.includes('cheongyeon');
};

const normalizeName = (value?: string) => String(value ?? '').replace(/\s+/g, '').trim().toLowerCase();

const getTeamWorkers = (team: OrgNode) => team.children.filter((child) => child.type === 'worker');

const findWorkerByName = (team: OrgNode, targetName?: string) => {
    if (!targetName) {
        return undefined;
    }

    const normalizedTarget = normalizeName(targetName);
    return getTeamWorkers(team).find((worker) => normalizeName(worker.name) === normalizedTarget);
};

const getWorkerProfileImageUrl = (worker?: OrgNode) => {
    if (!worker) return '';

    return String(
        worker.data?.profileImageUrl ??
        worker.data?.ProfileImageUrl ??
        worker.data?.photoURL ??
        worker.data?.photoUrl ??
        worker.data?.imageUrl ??
        worker.data?.ImageUrl ??
        ''
    ).trim();
};

const getTeamLeader = (team: OrgNode) => {
    const leaderId = String(team.data?.leaderId ?? '');
    const leaderName = String(team.data?.leaderName ?? '');
    const normalizedLeaderName = normalizeName(leaderName);

    return getTeamWorkers(team).find((worker) => {
        const rank = String(worker.data?.rank ?? '');
        const role = String(worker.data?.role ?? '');
        const profile = `${rank} ${role}`;

        return (
            (leaderId && worker.id === leaderId) ||
            (normalizedLeaderName && normalizeName(worker.name) === normalizedLeaderName) ||
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
    const { isDarkMode } = useSiteMode();
    const { treeData, loading } = useOrganizationTree();
    const [selectedSlot, setSelectedSlot] = useState<number>(1);
    const [activeDepartmentKey, setActiveDepartmentKey] = useState<DepartmentKey>('construction');
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

    const workerProfileImageByName = useMemo(() => {
        const map: Record<string, string> = {};
        const walk = (node: OrgNode) => {
            if (node.type === 'worker') {
                const normalizedWorkerName = normalizeName(node.name);
                const profileImageUrl = getWorkerProfileImageUrl(node);
                if (normalizedWorkerName && profileImageUrl && !map[normalizedWorkerName]) {
                    map[normalizedWorkerName] = profileImageUrl;
                }
            }
            node.children.forEach(walk);
        };

        treeData.forEach(walk);
        return map;
    }, [treeData]);

    const resolveLeaderImageFromWorker = (leaderName: string, fallback = '') => {
        return workerProfileImageByName[normalizeName(leaderName)] ?? fallback;
    };

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
                    const directLeaderName = normalizeName(team.data?.leaderName);
                    return (
                        directLeaderName === normalizeName(preferredLeaderName) ||
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
                    leaderImageUrl:
                        getWorkerProfileImageUrl(preferredLeader) ||
                        getWorkerProfileImageUrl(leader) ||
                        resolveLeaderImageFromWorker(
                            preferredLeaderName ?? leader?.name ?? source?.data?.leaderName ?? ''
                        ) ||
                        '',
                    memberCount: members.length,
                    siteNames: source ? getTeamSiteNames(source, sites) : [],
                    statusLabel: source ? getStatusLabel(source.data?.status) : '확장 예정',
                    members,
                    isPlaceholder: !source,
                    source,
                };
            }),
        [sites, slottedConstructionTeams, workerProfileImageByName]
    );

    const nonConstructionTeamSlots = useMemo<Record<Exclude<DepartmentKey, 'construction'>, TeamSlot[]>>(
        () => ({
            hrPeople: DEPARTMENT_TEAM_PRESETS.hrPeople.map((team, index) => ({
                slot: index + 1,
                displayName: team.displayName,
                originalName: team.originalName,
                leaderName: team.leaderName,
                leaderImageUrl: resolveLeaderImageFromWorker(team.leaderName),
                memberCount: team.memberCount,
                siteNames: team.siteNames,
                statusLabel: team.statusLabel,
                members: [],
                isPlaceholder: true,
            })),
            accounting: DEPARTMENT_TEAM_PRESETS.accounting.map((team, index) => ({
                slot: index + 1,
                displayName: team.displayName,
                originalName: team.originalName,
                leaderName: team.leaderName,
                leaderImageUrl: resolveLeaderImageFromWorker(team.leaderName),
                memberCount: team.memberCount,
                siteNames: team.siteNames,
                statusLabel: team.statusLabel,
                members: [],
                isPlaceholder: true,
            })),
            management: DEPARTMENT_TEAM_PRESETS.management.map((team, index) => ({
                slot: index + 1,
                displayName: team.displayName,
                originalName: team.originalName,
                leaderName: team.leaderName,
                leaderImageUrl: resolveLeaderImageFromWorker(team.leaderName),
                memberCount: team.memberCount,
                siteNames: team.siteNames,
                statusLabel: team.statusLabel,
                members: [],
                isPlaceholder: true,
            })),
            sales: DEPARTMENT_TEAM_PRESETS.sales.map((team, index) => ({
                slot: index + 1,
                displayName: team.displayName,
                originalName: team.originalName,
                leaderName: team.leaderName,
                leaderImageUrl: resolveLeaderImageFromWorker(team.leaderName),
                memberCount: team.memberCount,
                siteNames: team.siteNames,
                statusLabel: team.statusLabel,
                members: [],
                isPlaceholder: true,
            })),
            development: DEPARTMENT_TEAM_PRESETS.development.map((team, index) => ({
                slot: index + 1,
                displayName: team.displayName,
                originalName: team.originalName,
                leaderName: team.leaderName,
                leaderImageUrl: resolveLeaderImageFromWorker(team.leaderName),
                memberCount: team.memberCount,
                siteNames: team.siteNames,
                statusLabel: team.statusLabel,
                members: [],
                isPlaceholder: true,
            })),
        }),
        [workerProfileImageByName]
    );

    const activeTeamSlots = useMemo(
        () =>
            activeDepartmentKey === 'construction'
                ? teamSlots
                : nonConstructionTeamSlots[activeDepartmentKey],
        [activeDepartmentKey, nonConstructionTeamSlots, teamSlots]
    );

    const teamGridRows = useMemo(() => {
        let cursor = 0;
        const rows: TeamSlot[][] = [];
        while (cursor < activeTeamSlots.length) {
            const row = activeTeamSlots.slice(cursor, cursor + TEAM_GRID_COLUMNS);
            rows.push(row);
            cursor += TEAM_GRID_COLUMNS;
        }
        return rows;
    }, [activeTeamSlots]);

    const selectedTeam = activeTeamSlots.find((slot) => slot.slot === selectedSlot) ?? activeTeamSlots[0];
    const extraTeamCount = Math.max(0, constructionTeams.length - 10);
    const selectedTeamMembers = useMemo(() => {
        if (!selectedTeam) {
            return [];
        }
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
                    '1~10팀 5열 배열 운영',
                ],
                members: [
                    { name: '청연 1팀~10팀', role: `전체 ${formatNumber(totalMembers)}명 운영` },
                ],
            },
            {
                key: 'hrPeople',
                title: '인사팀',
                english: 'HR Operations',
                description: '채용, 배치, 인사 운영 정책을 관리하는 핵심 운영 라인입니다.',
                icon: faChartLine,
                accent: 'from-emerald-500/25 via-teal-500/15 to-white/5',
                iconGradient: 'from-emerald-400 to-teal-500',
                value: 'HR Core',
                highlights: ['채용 운영', '인력 배치', '교육 관리'],
                members: [{ name: '김팀장', role: '인사 운영 리드' }],
            },
            {
                key: 'accounting',
                title: '회계팀',
                english: 'Accounting Team',
                description: '회계·정산과 원가 데이터 관리를 담당하는 재무 운영 라인입니다.',
                icon: faCalculator,
                accent: 'from-amber-500/25 via-orange-500/15 to-white/5',
                iconGradient: 'from-amber-400 to-orange-500',
                value: 'Accounting Core',
                highlights: ['회계 정산', '원가 관리', '세무 대응'],
                members: [
                    { name: '이과장', role: '회계/정산 운영' },
                ],
            },
            {
                key: 'management',
                title: '관리팀',
                english: 'Management Team',
                description: '운영·총무와 관리 지원을 전담하는 조직 운영 라인입니다.',
                icon: faLayerGroup,
                accent: 'from-cyan-500/25 via-sky-500/15 to-white/5',
                iconGradient: 'from-cyan-400 to-sky-500',
                value: 'Management Core',
                highlights: ['운영 총무', '관리 지원', '내부 운영'],
                members: [
                    { name: '고대리', role: '관리팀 운영 담당' },
                ],
            },
            {
                key: 'sales',
                title: '영업팀',
                english: 'Sales & Bidding',
                description: '입찰, 견적, 수주 파이프라인과 대외 커뮤니케이션을 담당합니다.',
                icon: faBoxesStacked,
                accent: 'from-fuchsia-500/20 via-violet-500/10 to-white/5',
                iconGradient: 'from-fuchsia-400 to-violet-500',
                value: 'Bid Flow',
                highlights: ['입찰 전략', '수주 관리', '고객 대응'],
                members: [{ name: '이차장', role: '영업 리드' }],
            },
            {
                key: 'development',
                title: '개발팀',
                english: 'Development Team',
                description: '업무 자동화와 내부 플랫폼 개발을 담당하는 기술 조직입니다.',
                icon: faSitemap,
                accent: 'from-sky-500/20 via-indigo-500/12 to-white/5',
                iconGradient: 'from-sky-400 to-indigo-500',
                value: 'Build Ops',
                highlights: ['사내 시스템', '자동화', 'AI 이미지 연동'],
                members: [{ name: '최실장', role: '개발팀 리드' }],
            },
        ],
        [constructionTeams.length, totalMembers, uniqueSiteCount]
    );

    const activeDepartmentCard =
        departmentCards.find((card) => card.key === activeDepartmentKey) ?? departmentCards[0];

    const handleDepartmentSelect = (departmentKey: DepartmentKey) => {
        setActiveDepartmentKey(departmentKey);
        setSelectedSlot(1);
        window.setTimeout(() => {
            pyramidSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
    };

    const ceoName = String(primaryCompany?.data?.ceoName ?? '').trim() || '대표이사';
    const companyName = primaryCompany?.name ?? '청연ENG';

    if (loading || sitesLoading) {
        return (
            <div className={`flex min-h-screen flex-col items-center justify-center ${isDarkMode ? 'bg-slate-950 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
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
            className={`org-chart-page min-h-screen ${isDarkMode ? 'is-dark bg-[#08111f] text-slate-100' : 'is-light bg-slate-50 text-slate-900'}`}
            style={{ fontFamily: "'Pretendard Variable','Pretendard','SUIT Variable','Noto Sans KR',sans-serif" }}
        >
            {isDarkMode && (
                <div className="pointer-events-none fixed inset-0 overflow-hidden">
                    <div className="absolute left-[-10%] top-[-18%] h-[32rem] w-[32rem] rounded-full bg-cyan-500/12 blur-[160px]" />
                    <div className="absolute bottom-[-20%] right-[-6%] h-[30rem] w-[30rem] rounded-full bg-fuchsia-500/10 blur-[180px]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.08),transparent_32%),linear-gradient(to_bottom,rgba(8,17,31,0.18),rgba(8,17,31,0.94))]" />
                </div>
            )}

            <main className="relative z-10 mx-auto flex w-full max-w-none flex-col gap-8 px-4 py-6 md:px-8 md:py-8 xl:px-10">
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

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                            {departmentCards.map((card) => (
                                <DepartmentCard
                                    key={card.key}
                                    card={card}
                                    isActive={card.key === activeDepartmentKey}
                                    onClick={() => handleDepartmentSelect(card.key)}
                                    isDarkMode={isDarkMode}
                                />
                            ))}
                        </div>
                    </div>
                </motion.section>

                <section
                    ref={pyramidSectionRef}
                    className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_380px]"
                >
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="overflow-hidden rounded-[34px] border border-white/10 bg-white/[0.045] px-5 py-6 shadow-[0_30px_100px_rgba(2,6,23,0.5)] backdrop-blur-xl md:px-6 md:py-7 xl:px-8"
                    >
                        <AnimatePresence mode="wait" initial={false}>
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
                                                {activeDepartmentCard?.english ?? 'Department Grid'}
                                            </div>
                                            <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">
                                                {activeDepartmentCard?.title ?? '부서'} 팀 운영 그리드
                                            </h2>
                                            <p className="max-w-3xl text-sm leading-7 text-slate-300">
                                                선택된 부서의 팀 카드를 5개씩 정렬해 한 번에 비교하기 쉽게 구성했습니다.
                                                팀 카드를 누르면 현재 연결된 팀 리더 이미지와 구성 정보를 오른쪽에서 확인할 수 있습니다.
                                            </p>
                                        </div>

                                        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/8 px-4 py-3 text-sm text-cyan-50">
                                            <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Current Coverage</div>
                                            <div className="mt-1 text-xl font-black">
                                                {activeDepartmentKey === 'construction'
                                                    ? `${formatNumber(Math.min(constructionTeams.length, 10))} / 10 팀 연결`
                                                    : `${formatNumber(activeTeamSlots.length)}개 팀 구성`}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="relative mt-10 space-y-4">
                                        <div className="pointer-events-none absolute left-1/2 top-[-12px] hidden h-[calc(100%-4rem)] w-px -translate-x-1/2 bg-gradient-to-b from-cyan-300/25 via-white/0 to-white/0 xl:block" />
                                        {teamGridRows.map((row, rowIndex) => (
                                            <motion.div
                                                key={`row-${rowIndex}`}
                                                variants={pyramidItemVariants}
                                                className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5"
                                            >
                                                {row.map((slot) => {
                                                    const teamTone = getTeamTone(activeDepartmentKey, slot.displayName, isDarkMode);
                                                    return (
                                                    <motion.button
                                                        key={slot.slot}
                                                        type="button"
                                                        onClick={() => setSelectedSlot(slot.slot)}
                                                        className="w-full text-left focus:outline-none"
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
                                                                    ? teamTone.selectedCard
                                                                    : slot.isPlaceholder
                                                                        ? (isDarkMode ? 'border-white/10 bg-white/[0.035] hover:border-white/20' : 'border-slate-200 bg-white hover:border-slate-300')
                                                                        : teamTone.normalCard
                                                            }`}
                                                        >
                                                            <div className="absolute inset-x-[18%] top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-60" />
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div>
                                                                    <div className={`text-[11px] font-semibold uppercase tracking-[0.28em] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                                                        Team {slot.slot}
                                                                    </div>
                                                                    <div className={`mt-2 text-xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                                                        {slot.displayName}
                                                                    </div>
                                                                </div>
                                                                <div className="flex w-36 flex-col items-end gap-2">
                                                                    <LeaderAvatar
                                                                        imageUrl={slot.leaderImageUrl}
                                                                        name={slot.leaderName}
                                                                        size="tile"
                                                                        isDarkMode={isDarkMode}
                                                                    />
                                                                    <div className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${teamTone.statusBadge}`}>
                                                                        {slot.statusLabel}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className={`mt-4 text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                                                {slot.originalName}
                                                            </div>

                                                            <div className={`mt-5 grid grid-cols-2 gap-2 text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                                                <SmallStat label="현장" value={`${formatNumber(slot.siteNames.length)}개`} isDarkMode={isDarkMode} />
                                                                <SmallStat label="인원" value={`${formatNumber(slot.memberCount)}명`} isDarkMode={isDarkMode} />
                                                            </div>

                                                            <div className={`mt-4 flex items-center gap-2 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                                                <FontAwesomeIcon icon={faMapMarkerAlt} className={teamTone.iconText} />
                                                                {slot.siteNames.length > 0 ? `${slot.siteNames.length}개 현장 연결·담당` : '현장 연결 대기'}
                                                            </div>
                                                        </motion.div>
                                                    </motion.button>
                                                );})}
                                            </motion.div>
                                        ))}
                                    </div>

                                    {activeDepartmentKey === 'construction' && extraTeamCount > 0 && (
                                        <div className="mt-8 rounded-2xl border border-amber-300/15 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
                                            10팀 이후 추가로 연결된 시공팀이 {formatNumber(extraTeamCount)}개 있습니다. 현재 화면은 요청 기준에 맞춰 1팀부터 10팀까지만 4열 구조로 노출합니다.
                                        </div>
                                    )}
                                </motion.div>
                        </AnimatePresence>
                    </motion.div>

                    <AnimatePresence initial={false}>
                        {selectedTeam && (
                            <motion.aside
                                variants={pyramidItemVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="rounded-[34px] border border-white/10 bg-slate-950/65 px-5 py-6 shadow-[0_28px_90px_rgba(2,6,23,0.52)] backdrop-blur-2xl md:px-6 xl:sticky xl:top-6 xl:self-start"
                            >
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={`${activeDepartmentKey}-${selectedTeam.slot}`}
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
                                            size="feature"
                                            isDarkMode={isDarkMode}
                                        />
                                        <div className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-50">
                                            {selectedTeam.statusLabel}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 grid grid-cols-2 gap-3">
                                    <DetailMetric icon={faMapMarkerAlt} label="현장 수" value={`${formatNumber(selectedTeam.siteNames.length)}개`} isDarkMode={isDarkMode} />
                                    <DetailMetric icon={faUsers} label="인원" value={`${formatNumber(selectedTeam.memberCount)}명`} isDarkMode={isDarkMode} />
                                    <DetailMetric icon={faBuilding} label="상태" value={selectedTeam.statusLabel} isDarkMode={isDarkMode} />
                                    <DetailMetric icon={faSitemap} label="조직 단계" value={`${activeDepartmentCard?.title ?? '부서'} > ${selectedTeam.slot}팀`} isDarkMode={isDarkMode} />
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
    isDarkMode = true,
}: {
    card: DepartmentCardConfig;
    isActive?: boolean;
    onClick?: () => void;
    isDarkMode?: boolean;
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
                        <div className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${isDarkMode ? 'border-white/10 bg-white/10 text-white/90' : 'border-slate-200 bg-white text-slate-700'}`}>
                            {card.value}
                        </div>
                    </div>
                </div>

                <div className="mt-5">
                    <div className={`text-[11px] font-semibold uppercase tracking-[0.28em] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {card.english}
                    </div>
                    <div className={`mt-2 text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{card.title}</div>
                    <p className={`mt-3 text-sm leading-7 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{card.description}</p>
                </div>

                {onClick && (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-50">
                        {isActive ? '팀 열람중' : '팀 펼치기'}
                    </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                    {card.highlights.map((highlight) => (
                        <span
                            key={highlight}
                            className={`rounded-full border px-3 py-1.5 text-xs ${isDarkMode ? 'border-white/10 bg-white/5 text-slate-200' : 'border-slate-200 bg-white text-slate-600'}`}
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
                            className={`flex items-center justify-between rounded-2xl border px-3 py-2.5 ${isDarkMode ? 'border-white/10 bg-black/10' : 'border-slate-200 bg-white'}`}
                        >
                            <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{member.name}</div>
                            <div className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>{member.role}</div>
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
                className={`relative overflow-hidden rounded-[28px] border p-5 text-left shadow-[0_18px_48px_rgba(2,6,23,0.36)] ${
                    isActive
                        ? (isDarkMode ? 'border-cyan-300/40 bg-white/[0.04]' : 'border-cyan-400 bg-white')
                        : (isDarkMode ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-white')
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
            className={`relative overflow-hidden rounded-[28px] border p-5 shadow-[0_18px_48px_rgba(2,6,23,0.36)] ${isDarkMode ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-white'}`}
        >
            {body}
        </motion.div>
    );
};

const SmallStat = ({ label, value, isDarkMode = true }: { label: string; value: string; isDarkMode?: boolean }) => (
    <div className={`rounded-2xl border px-3 py-2 ${isDarkMode ? 'border-white/8 bg-white/[0.04]' : 'border-slate-200 bg-slate-50'}`}>
        <div className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{label}</div>
        <div className={`mt-1 truncate text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{value}</div>
    </div>
);

const DetailMetric = ({
    icon,
    label,
    value,
    isDarkMode = true,
}: {
    icon: IconDefinition;
    label: string;
    value: string;
    isDarkMode?: boolean;
}) => (
    <div className={`rounded-[22px] border p-3 ${isDarkMode ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-white'}`}>
        <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
            <FontAwesomeIcon icon={icon} />
            {label}
        </div>
        <div className={`mt-3 text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{value}</div>
    </div>
);

const LeaderAvatar = ({
    imageUrl,
    name,
    size,
    isDarkMode = true,
}: {
    imageUrl?: string;
    name: string;
    size: 'sm' | 'lg' | 'tile' | 'feature';
    isDarkMode?: boolean;
}) => {
    const [hasImageError, setHasImageError] = useState(false);
    const dimensions =
        size === 'feature'
            ? 'h-[13rem] w-[9.4rem] rounded-[1.4rem]'
            : size === 'tile'
                ? 'h-[8.8rem] w-full rounded-[1rem]'
            : size === 'lg'
                ? 'h-16 w-16 rounded-2xl'
                : 'h-11 w-11 rounded-xl';
    const labelSize = size === 'feature' ? 'text-3xl' : size === 'lg' ? 'text-lg' : 'text-sm';
    const resolvedImageUrl = String(imageUrl ?? '').trim();
    const shouldRenderImage = Boolean(resolvedImageUrl) && !hasImageError;
    const wrapperClass =
        size === 'feature'
            ? `relative overflow-hidden border ${isDarkMode ? 'border-cyan-300/30 bg-slate-900/90 shadow-[0_28px_60px_rgba(8,145,178,0.28)]' : 'border-cyan-300/60 bg-white shadow-[0_18px_40px_rgba(6,182,212,0.2)]'} ${dimensions}`
            : size === 'tile'
                ? `relative overflow-hidden border ${isDarkMode ? 'border-cyan-300/25 bg-slate-900/90 shadow-[0_18px_42px_rgba(14,116,144,0.28)]' : 'border-cyan-300/50 bg-white shadow-[0_12px_28px_rgba(14,116,144,0.18)]'} ${dimensions}`
                : `overflow-hidden border ${isDarkMode ? 'border-white/10 bg-slate-900/80' : 'border-slate-200 bg-white'} ${dimensions}`;
    const imageClass = size === 'feature' || size === 'tile' ? 'h-full w-full object-cover object-top' : 'h-full w-full object-cover';

    return (
        <div className={wrapperClass}>
            {shouldRenderImage ? (
                <img
                    src={resolvedImageUrl}
                    alt={name}
                    className={imageClass}
                    loading="lazy"
                    onError={() => setHasImageError(true)}
                />
            ) : (
                <div className={`flex h-full w-full items-center justify-center ${isDarkMode ? 'bg-gradient-to-br from-cyan-400/30 to-blue-500/20' : 'bg-gradient-to-br from-cyan-100 to-sky-100'} ${labelSize}`}>
                    <FontAwesomeIcon icon={faUserTie} className={`${isDarkMode ? 'text-white/75' : 'text-cyan-700'}`} />
                </div>
            )}
        </div>
    );
};

export default CheongyeonOrgChartPage;
