import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding,
    faBan, faCheckCircle, faClock, faCreditCard, faUser, faUsers,
    faList, faTh, faPlus, faBoxArchive, faPenToSquare, faRotateLeft
} from '@fortawesome/free-solid-svg-icons';
import { Worker, manpowerService } from '../../services/manpowerService';
import { OfficeStaff, officeStaffService } from '../../services/officeStaffService';

import { Card, CardBillingTargetRecord, CardBillingTargetType } from '../../types/card';
import { Team } from '../../services/teamService';
import { iconMap } from '../../constants/iconMap';
import { cardService } from '../../services/cardService';
import { OFFICE_ASSIGNMENT_TEAM_NAME, isOfficeStaffAssignmentReference } from '../../utils/supportAssignmentTargets';
import { getContrastingTextColor } from '../../utils/color';

interface TeamInfo {
    color: string;
    icon?: string;
}

interface CardStatusBoardProps {
    cards: Card[];
    teams?: Team[];
    loading: boolean;
    onEdit: (card: Card) => void;
    onAssign: (card: Card) => void;
    onBillingTargetAssign?: (card: Card) => void;
    onCancelUse: (card: Card) => void;
    onRestoreUse: (card: Card) => void;
    restoringCardId?: string | null;
}

type CardStatusFilter = 'work' | 'active' | 'all' | 'ASSIGNED' | 'AVAILABLE' | 'inactive';

const getTeamFaIcon = (iconName?: string) => {
    if (!iconName) return faUsers;
    return iconMap[iconName] || faUsers;
};

const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
};

const hasActiveCardAssignment = (card: Card) => (
    Boolean(card.currentAssigneeType && (card.currentAssigneeId || card.currentAssigneeName))
);

const getInitialViewMode = (): 'list' | 'card' => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches) {
        return 'card';
    }
    return 'list';
};

const getEffectiveCardStatus = (card: Card): Card['status'] => {
    if (card.status === 'SUSPENDED' || card.status === 'CLOSED') return card.status;
    return hasActiveCardAssignment(card) ? 'ASSIGNED' : 'AVAILABLE';
};

const normalizeKey = (value: unknown): string => String(value ?? '').trim();

const compareTeamThenCard = (leftTeam: string, rightTeam: string, leftName: string, rightName: string): number => {
    const normalizedLeftTeam = normalizeKey(leftTeam);
    const normalizedRightTeam = normalizeKey(rightTeam);
    if (normalizedLeftTeam && !normalizedRightTeam) return -1;
    if (!normalizedLeftTeam && normalizedRightTeam) return 1;
    const teamCompare = normalizedLeftTeam.localeCompare(normalizedRightTeam, 'ko-KR');
    if (teamCompare !== 0) return teamCompare;
    return normalizeKey(leftName).localeCompare(normalizeKey(rightName), 'ko-KR');
};

export const CardStatusBoard: React.FC<CardStatusBoardProps> = ({ cards, teams = [], loading, onEdit, onAssign, onBillingTargetAssign, onCancelUse, onRestoreUse, restoringCardId = null }) => {
    const [viewMode, setViewMode] = useState<'list' | 'card'>(getInitialViewMode);
    const [statusFilter, setStatusFilter] = useState<CardStatusFilter>('active');
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [officeStaffRows, setOfficeStaffRows] = useState<OfficeStaff[]>([]);
    const [billingTargets, setBillingTargets] = useState<CardBillingTargetRecord[]>([]);

    React.useEffect(() => {
        let mounted = true;
        cardService.listAllCardBillingTargets()
            .then((records) => {
                if (mounted) setBillingTargets(records);
            })
            .catch((error) => {
                console.error('Failed to load card billing targets:', error);
            });
        return () => {
            mounted = false;
        };
    }, [cards]);

    const latestBillingTargetByCardId = useMemo(() => {
        const map = new Map<string, CardBillingTargetRecord>();
        billingTargets.forEach((target) => {
            const key = String(target.cardId ?? '').trim();
            if (!key) return;
            const current = map.get(key);
            if (!current || String(target.startDate ?? '').localeCompare(String(current.startDate ?? '')) > 0) {
                map.set(key, target);
            }
        });
        return map;
    }, [billingTargets]);

    const getLatestBillingTarget = (card: Card) => (
        latestBillingTargetByCardId.get(String(card.id ?? '').trim())
    );

    // Worker 데이터 로드 (개인 배정 시 팀 색상 확인용)
    React.useEffect(() => {
        const loadWorkers = async () => {
            try {
                const [data, officeStaffList] = await Promise.all([
                    manpowerService.getWorkers(),
                    officeStaffService.getOfficeStaff().catch(() => [] as OfficeStaff[])
                ]);
                setWorkers(data);
                setOfficeStaffRows(officeStaffList);
            } catch (e) {
                console.error('Failed to load workers:', e);
            }
        };
        loadWorkers();
    }, []);

    // Build team info map: teamName -> {color, icon}
    const teamInfoMap = useMemo(() => {
        const map = new Map<string, TeamInfo>();
        teams.forEach(t => {
            if (t.color && t.name) map.set(t.name, { color: t.color, icon: t.icon || t.iconKey });
        });
        return map;
    }, [teams]);

    // Worker -> Team 정보 매핑
    const workerTeamMap = useMemo(() => {
        const map = new Map<string, TeamInfo>();
        workers.forEach(w => {
            const teamName = normalizeKey(w.teamName);
            const tInfo = teamName ? teamInfoMap.get(teamName) : undefined;
            if (!tInfo) return;
            [w.id, w.legacyId, w.uid, w.name].forEach((key) => {
                const normalized = normalizeKey(key);
                if (normalized) map.set(normalized, tInfo);
            });
        });
        return map;
    }, [workers, teamInfoMap]);

    const teamNameById = useMemo(() => {
        const map = new Map<string, string>();
        teams.forEach((team) => {
            const id = normalizeKey(team.id);
            const legacyId = normalizeKey(team.legacyId);
            const name = normalizeKey(team.name);
            if (!name) return;
            if (id) map.set(id, name);
            if (legacyId) map.set(legacyId, name);
        });
        return map;
    }, [teams]);

    const workerTeamNameMap = useMemo(() => {
        const map = new Map<string, string>();
        workers.forEach((worker) => {
            const teamName = normalizeKey(worker.teamName) || teamNameById.get(normalizeKey(worker.teamId)) || '';
            if (!teamName) return;
            [worker.id, worker.legacyId, worker.uid, worker.name].forEach((key) => {
                const normalized = normalizeKey(key);
                if (normalized) map.set(normalized, teamName);
            });
        });
        return map;
    }, [workers, teamNameById]);

    const officeTeamInfo = useMemo<TeamInfo>(() => (
        teamInfoMap.get(OFFICE_ASSIGNMENT_TEAM_NAME) ?? { color: '#64748b', icon: 'fa-building' }
    ), [teamInfoMap]);

    const isOfficeStaffAssignee = React.useCallback((assigneeId?: unknown, assigneeName?: unknown) => (
        isOfficeStaffAssignmentReference(officeStaffRows, assigneeId, assigneeName)
    ), [officeStaffRows]);

    const getCardAssigneeTeamInfo = (card: Card): TeamInfo | undefined => {
        if (card.currentAssigneeType === 'TEAM' && card.currentAssigneeName) {
            return teamInfoMap.get(card.currentAssigneeName);
        }
        if (card.currentAssigneeType === 'WORKER') {
            if (isOfficeStaffAssignee(card.currentAssigneeId, card.currentAssigneeName)) {
                return officeTeamInfo;
            }
            return workerTeamMap.get(normalizeKey(card.currentAssigneeId)) || workerTeamMap.get(normalizeKey(card.currentAssigneeName));
        }
        return undefined;
    };

    const getCardBillingTeamName = (card: Card): string => {
        const target = getLatestBillingTarget(card);
        const targetType = target
            ? target.targetType
            : card.billingTargetType && card.billingTargetId
                ? card.billingTargetType
                : card.currentAssigneeType;
        const targetId = target
            ? target.targetId
            : card.billingTargetType && card.billingTargetId
                ? card.billingTargetId
                : card.currentAssigneeId;
        const targetName = target
            ? target.targetName
            : card.billingTargetType && card.billingTargetId
                ? card.billingTargetName
                : card.currentAssigneeName;

        if (targetType === 'TEAM') return normalizeKey(targetName);
        if (targetType === 'WORKER') {
            if (isOfficeStaffAssignee(targetId, targetName)) return OFFICE_ASSIGNMENT_TEAM_NAME;
            return workerTeamNameMap.get(normalizeKey(targetId)) || workerTeamNameMap.get(normalizeKey(targetName)) || '';
        }
        if (targetType === 'OFFICE' || targetType === 'OFFICE_STAFF') return OFFICE_ASSIGNMENT_TEAM_NAME;
        return '';
    };

    const hasCardWorkItem = React.useCallback((card: Card): boolean => {
        const effectiveStatus = getEffectiveCardStatus(card);
        if (effectiveStatus === 'CLOSED' || effectiveStatus === 'SUSPENDED') return false;
        if (effectiveStatus === 'AVAILABLE') return true;

        const hasAssignment = Boolean(card.currentAssigneeType && (card.currentAssigneeId || card.currentAssigneeName));
        const hasBillingSource = Boolean(
            getLatestBillingTarget(card) ||
            (card.billingTargetType && card.billingTargetId) ||
            hasAssignment
        );

        return !hasBillingSource;
    }, [latestBillingTargetByCardId]);

    const statusFilteredCards = useMemo(() => {
        if (statusFilter === 'work') return cards.filter(hasCardWorkItem);
        if (statusFilter === 'active') {
            return cards.filter((card) => card.status !== 'SUSPENDED' && card.status !== 'CLOSED');
        }
        if (statusFilter === 'all') return cards;
        if (statusFilter === 'inactive') {
            return cards.filter((card) => card.status === 'SUSPENDED' || card.status === 'CLOSED');
        }
        return cards.filter((card) => getEffectiveCardStatus(card) === statusFilter);
    }, [cards, hasCardWorkItem, statusFilter]);

    const getSummaryCardClassName = (filter: CardStatusFilter, baseClassName: string) =>
        `${baseClassName} ${statusFilter === filter ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`;

    const sortedCards = useMemo(() => (
        [...statusFilteredCards].sort((left, right) => {
            const teamCompare = compareTeamThenCard(
                getCardBillingTeamName(left),
                getCardBillingTeamName(right),
                normalizeKey(left.name) || normalizeKey(left.last4),
                normalizeKey(right.name) || normalizeKey(right.last4)
            );
            if (teamCompare !== 0) return teamCompare;
            return normalizeKey(left.last4).localeCompare(normalizeKey(right.last4), 'ko-KR');
        })
    ), [statusFilteredCards, latestBillingTargetByCardId, workerTeamNameMap, officeStaffRows]);

    const stats = useMemo(() => {
        // ... (existing stats logic)
        const total = cards.length;
        const assigned = cards.filter((c) => getEffectiveCardStatus(c) === 'ASSIGNED').length;
        const available = cards.filter((c) => getEffectiveCardStatus(c) === 'AVAILABLE').length;
        const suspended = cards.filter((c) => c.status === 'SUSPENDED').length;
        const closed = cards.filter((c) => c.status === 'CLOSED').length;
        const work = cards.filter(hasCardWorkItem).length;
        const active = assigned + available;
        return { total, assigned, available, suspended, closed, active, work };
    }, [cards, hasCardWorkItem]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ASSIGNED':
                return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">배정됨</span>;
            case 'AVAILABLE':
                return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">보관중</span>;
            case 'SUSPENDED':
                return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">분실/정지</span>;
            case 'CLOSED':
                return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">해지됨</span>;
            default:
                return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">-</span>;
        }
    };



    const getCardTypeLabel = (type: string) => {
        if (type === 'CREDIT') return <span className="text-purple-600 font-bold text-xs">신용</span>;
        if (type === 'CHECK') return <span className="text-indigo-600 font-bold text-xs">체크</span>;
        return <span className="text-slate-500 text-xs">-</span>;
    };

    const getResolvedBillingTargetName = (card: Card) => {
        const target = getLatestBillingTarget(card);
        if (target) return target.targetName ?? '';
        return card.billingTargetType && card.billingTargetId
            ? (card.billingTargetName ?? '')
            : (card.currentAssigneeName ?? '');
    };

    const getResolvedBillingTargetType = (card: Card) => {
        const target = getLatestBillingTarget(card);
        if (target) return target.targetType;
        return card.billingTargetType && card.billingTargetId
            ? card.billingTargetType
            : card.currentAssigneeType;
    };

    const getResolvedBillingTargetTypeLabel = (card: Card) => {
        const name = getResolvedBillingTargetName(card);
        if (!name) return null;
        const type = getResolvedBillingTargetType(card);
        if (type === 'TEAM') return '팀';
        if (type === 'WORKER') return '작업자';
        if (type === 'OFFICE') return '사무실';
        if (type === 'OFFICE_STAFF') return '사무실직원';
        return null;
    };

    const getTargetTeamInfo = (type?: CardBillingTargetType | null, name?: string | null) => {
        if (!type || !name) return undefined;
        if (type === 'OFFICE' || type === 'OFFICE_STAFF') return officeTeamInfo;
        if (type === 'WORKER' && isOfficeStaffAssignee(undefined, name)) return officeTeamInfo;
        return type === 'TEAM' ? teamInfoMap.get(name) : workerTeamMap.get(name);
    };

    const getTargetBadgeStyle = (type?: CardBillingTargetType | null, teamInfo?: TeamInfo) => {
        const color = teamInfo?.color;
        if (color) {
            return {
                backgroundColor: color,
                color: getContrastingTextColor(color),
                border: `1px solid ${color}`
            };
        }

        if (type === 'OFFICE') {
            return { backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' };
        }
        if (type === 'OFFICE_STAFF') {
            return { backgroundColor: '#ecfeff', color: '#0e7490', border: '1px solid #cffafe' };
        }
        return type === 'WORKER'
            ? { backgroundColor: '#eef2ff', color: '#4338ca', border: '1px solid #e0e7ff' }
            : { backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' };
    };

    const getBillingModeBadge = (card: Card, hasExplicitBillingTarget: boolean, billingTargetName: string) => {
        if (!billingTargetName) {
            return { label: '미지정', className: 'bg-slate-50 text-slate-400 border-slate-100' };
        }

        const targetRows = billingTargets.filter((target) => normalizeKey(target.cardId) === normalizeKey(card.id));
        const isSplit = targetRows.length > 1 || targetRows.some((target) => Boolean(normalizeKey(target.endDate)));
        if (isSplit) {
            return { label: '월중 변경', className: 'bg-amber-50 text-amber-700 border-amber-100' };
        }

        if (hasExplicitBillingTarget) {
            return { label: '배정자와 다름', className: 'bg-blue-50 text-blue-700 border-blue-100' };
        }

        return { label: '배정자와 동일', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    };

    if (loading) {
        return (
            <div className="h-64 flex items-center justify-center text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (cards.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-20 text-center">
                <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                    <FontAwesomeIcon icon={faCreditCard} className="text-4xl" />
                </div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">등록된 지원 카드가 없습니다</h3>
                <p className="text-slate-400 mb-6">새로운 카드를 등록하여 관리를 시작해보세요.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                {stats.work > 0 && (
                <button
                    type="button"
                    onClick={() => setStatusFilter('work')}
                    aria-pressed={statusFilter === 'work'}
                    className={getSummaryCardClassName('work', 'w-full text-left bg-white p-6 rounded-2xl border border-amber-100 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.12)] hover:shadow-lg transition-shadow relative overflow-hidden group')}
                >
                    <div className="absolute right-0 top-0 w-32 h-32 bg-amber-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-amber-600/80 uppercase tracking-wider mb-2">현재 업무</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-3xl font-extrabold text-slate-800">{stats.work}</h3>
                            <span className="text-sm font-bold text-slate-400">장</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-amber-700 bg-amber-50 w-fit px-2 py-1 rounded-lg">
                            <FontAwesomeIcon icon={faClock} /> 미배정·청구확인
                        </div>
                    </div>
                </button>
                )}

                <button
                    type="button"
                    onClick={() => setStatusFilter('ASSIGNED')}
                    aria-pressed={statusFilter === 'ASSIGNED'}
                    className={getSummaryCardClassName('ASSIGNED', 'w-full text-left bg-white p-6 rounded-2xl border border-emerald-100 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group')}
                >
                    <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-emerald-600/70 uppercase tracking-wider mb-2">사용 중</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-3xl font-extrabold text-slate-800">{stats.assigned}</h3>
                            <span className="text-sm font-bold text-slate-400">장</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 w-fit px-2 py-1 rounded-lg">
                            <FontAwesomeIcon icon={faCheckCircle} /> 사용률 {stats.total > 0 ? Math.round((stats.assigned / stats.total) * 100) : 0}%
                        </div>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => setStatusFilter('AVAILABLE')}
                    aria-pressed={statusFilter === 'AVAILABLE'}
                    className={getSummaryCardClassName('AVAILABLE', 'w-full text-left bg-white p-6 rounded-2xl border border-indigo-100 shadow-[0_4px_20px_-4px_rgba(99,102,241,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group')}
                >
                    <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-indigo-600/70 uppercase tracking-wider mb-2">보관 중</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-3xl font-extrabold text-slate-800">{stats.available}</h3>
                            <span className="text-sm font-bold text-slate-400">장</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-indigo-700 bg-indigo-50 w-fit px-2 py-1 rounded-lg">
                            <FontAwesomeIcon icon={faClock} /> 즉시 배정 가능
                        </div>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => setStatusFilter('inactive')}
                    aria-pressed={statusFilter === 'inactive'}
                    className={getSummaryCardClassName('inactive', 'w-full text-left bg-white p-6 rounded-2xl border border-orange-100 shadow-[0_4px_20px_-4px_rgba(249,115,22,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group')}
                >
                    <div className="absolute right-0 top-0 w-32 h-32 bg-orange-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-orange-600/70 uppercase tracking-wider mb-2">정지/해지</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-3xl font-extrabold text-slate-800">{stats.suspended + stats.closed}</h3>
                            <span className="text-sm font-bold text-slate-400">장</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-orange-700 bg-orange-50 w-fit px-2 py-1 rounded-lg">
                            <FontAwesomeIcon icon={faBan} /> 정지 {stats.suspended} · 해지 {stats.closed}
                        </div>
                    </div>
                </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-0.5">
                    {([
                        ['active', `현재 관리 ${stats.active}`],
                        ['inactive', `보관/정지 ${stats.suspended + stats.closed}`],
                        ['all', `전체 ${stats.total}`]
                    ] as Array<[CardStatusFilter, string]>).map(([filter, label]) => (
                        <button
                            key={filter}
                            type="button"
                            onClick={() => setStatusFilter(filter)}
                            className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                                statusFilter === filter
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                    {stats.work > 0 && (
                        <button
                            type="button"
                            onClick={() => setStatusFilter('work')}
                            className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                                statusFilter === 'work'
                                    ? 'bg-amber-500 text-white shadow-sm'
                                    : 'text-amber-700 hover:bg-amber-50'
                            }`}
                        >
                            확인 필요 {stats.work}
                        </button>
                    )}
                </div>
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                    <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5
                            ${viewMode === 'list'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'}`}
                        title="목록형"
                    >
                        <FontAwesomeIcon icon={faList} />
                        목록
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('card')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5
                            ${viewMode === 'card'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'}`}
                        title="카드형"
                    >
                        <FontAwesomeIcon icon={faTh} />
                        카드
                    </button>
                </div>
            </div>

            {/* ── 목록형 (Table) ── */}
            {sortedCards.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        <FontAwesomeIcon icon={faCheckCircle} />
                    </div>
                    <h3 className="text-base font-black text-slate-800">
                        {statusFilter === 'active'
                            ? '현재 관리 중인 카드가 없습니다'
                            : statusFilter === 'inactive'
                                ? '보관/정지 카드가 없습니다'
                                : statusFilter === 'work'
                                    ? '확인할 카드 업무가 없습니다'
                                    : '조건에 맞는 카드가 없습니다'}
                    </h3>
                    <p className="mt-1 text-sm font-medium text-slate-500">다른 보기를 선택하면 보관·정지·해지 카드까지 함께 확인할 수 있습니다.</p>
                    <button
                        type="button"
                        onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
                        className="mt-5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                    >
                        {statusFilter === 'active' ? '전체 보기' : '현재 관리 보기'}
                    </button>
                </div>
            ) : viewMode === 'list' ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="support-compact-table support-compact-status w-full table-fixed text-xs">
                            <colgroup>
                                <col style={{ width: '3%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '6%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '7%' }} />
                                <col style={{ width: '7%' }} />
                                <col style={{ width: '11%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '7%' }} />
                                <col style={{ width: '9%' }} />
                                <col style={{ width: '8%' }} />
                            </colgroup>
                            {/* ... (thead) */}
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider w-8">#</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">카드명</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">발급사</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">유형</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">카드번호</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">유효기간</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">상태</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">배정</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">청구대상</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">청구방식</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">메모</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider w-32"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sortedCards.map((card, rowIdx) => {
                                    const teamInfo = getCardAssigneeTeamInfo(card);
                                    const isOfficeAssignee = isOfficeStaffAssignee(card.currentAssigneeId, card.currentAssigneeName);

                                    const tc = teamInfo?.color;
                                    const billingTargetTypeLabel = getResolvedBillingTargetTypeLabel(card);
                                    const billingTargetName = getResolvedBillingTargetName(card);
                                    const billingTargetType = getResolvedBillingTargetType(card);
                                    const billingTargetTeamInfo = getTargetTeamInfo(billingTargetType, billingTargetName);
                                    const hasExplicitBillingTarget = Boolean(getLatestBillingTarget(card) || (card.billingTargetType && card.billingTargetId));
                                    const billingModeBadge = getBillingModeBadge(card, hasExplicitBillingTarget, billingTargetName);
                                    const tcText = tc ? getContrastingTextColor(tc) : undefined;

                                    const needsWork = hasCardWorkItem(card);
                                    const isInactiveCard = card.status === 'SUSPENDED' || card.status === 'CLOSED';

                                    return (
                                        <tr
                                            key={card.id}
                                            className={`hover:bg-indigo-50/40 transition-colors group ${needsWork ? 'bg-amber-50/35' : ''}`}
                                            style={tc ? { borderLeft: `3px solid ${tc}` } : needsWork ? { borderLeft: '3px solid #f59e0b' } : undefined}
                                        >
                                            {/* ... (existing td cells except Assignee) */}
                                            <td className="px-4 py-3 text-xs text-slate-400 font-mono">{rowIdx + 1}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <span
                                                         className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-xs text-slate-400"
                                                         style={tc ? {
                                                             backgroundColor: tc,
                                                             color: tcText,
                                                             borderColor: tc,
                                                         } : undefined}
                                                    >
                                                        <FontAwesomeIcon icon={faCreditCard} />
                                                    </span>
                                                     <span
                                                          className="truncate font-bold text-slate-800 transition-colors group-hover:text-indigo-600"
                                                      >
                                                        {card.name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500 font-medium">
                                                {card.issuer}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${card.cardType === 'CREDIT'
                                                    ? 'bg-violet-50 text-violet-600 border border-violet-100'
                                                    : 'bg-sky-50 text-sky-600 border border-sky-100'
                                                    }`}>
                                                    {getCardTypeLabel(card.cardType)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="font-mono text-xs text-slate-600">{card.maskedNumber || '-'}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center text-xs text-slate-500">
                                                {card.expiry || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {getStatusBadge(getEffectiveCardStatus(card))}
                                            </td>

                                            <td className="px-4 py-3">
                                                {card.currentAssigneeName ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); if (!isInactiveCard) onAssign(card); }}
                                                        disabled={isInactiveCard}
                                                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                                                          style={tc ? {
                                                              backgroundColor: tc,
                                                              color: tcText,
                                                              border: `1px solid ${tc}`,
                                                          } : {
                                                            backgroundColor: card.currentAssigneeType === 'TEAM' ? '#f1f5f9' : '#e0e7ff',
                                                            color: card.currentAssigneeType === 'TEAM' ? '#475569' : '#4338ca',
                                                            border: card.currentAssigneeType === 'TEAM' ? '1px solid #e2e8f0' : '1px solid #e0e7ff',
                                                        }}
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={card.currentAssigneeType === 'TEAM'
                                                                ? getTeamFaIcon(teamInfo?.icon)
                                                                : isOfficeAssignee
                                                                    ? faBuilding
                                                                : faUser}
                                                            className="text-[10px]"
                                                        />
                                                        {card.currentAssigneeName}
                                                        {/* 개인이지만 소속팀이 있다면 툴팁 등으로 표시 가능 */}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); if (!isInactiveCard) onAssign(card); }}
                                                        disabled={isInactiveCard}
                                                        className="px-2 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 transition-colors flex items-center gap-1 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                                    >
                                                        <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                                                        배정/청구
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {billingTargetName && billingTargetTypeLabel ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!isInactiveCard) onBillingTargetAssign?.(card);
                                                        }}
                                                        disabled={isInactiveCard || !onBillingTargetAssign}
                                                        className="inline-flex max-w-[180px] items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                                                        style={getTargetBadgeStyle(billingTargetType, billingTargetTeamInfo)}
                                                        title={`${hasExplicitBillingTarget ? '배정자와 다른 청구대상' : billingTargetTypeLabel} · ${billingTargetName} · 청구대상 설정에서 이력 확인`}
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={billingTargetType === 'TEAM'
                                                                ? getTeamFaIcon(billingTargetTeamInfo?.icon)
                                                                : billingTargetType === 'OFFICE'
                                                                    ? faBuilding
                                                                    : faUser}
                                                            className="text-[10px]"
                                                        />
                                                        <span className="truncate">
                                                            {billingTargetTypeLabel} · {billingTargetName}
                                                        </span>
                                                    </button>
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-300">미지정</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex min-w-[88px] items-center justify-center rounded-md border px-2 py-1 text-[11px] font-extrabold ${billingModeBadge.className}`}>
                                                    {billingModeBadge.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-400 max-w-[150px] truncate" title={card.memo}>
                                                {card.memo || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onEdit(card); }}
                                                        className="w-7 h-7 rounded-md bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
                                                        aria-label={`카드 정보 수정: ${card.name}`}
                                                        title="카드 정보 수정"
                                                    >
                                                        <FontAwesomeIcon icon={faPenToSquare} className="text-xs" />
                                                    </button>
                                                    {!isInactiveCard && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onAssign(card); }}
                                                            className="inline-flex h-7 items-center justify-center gap-1 rounded-md bg-indigo-50 px-2 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100"
                                                            aria-label={`배정/청구 설정: ${card.name}`}
                                                            title="배정/청구 설정"
                                                        >
                                                            <FontAwesomeIcon icon={card.currentAssigneeType === 'TEAM' ? faUsers : faUser} className="text-xs" />
                                                            <span>배정/청구</span>
                                                        </button>
                                                    )}
                                                    {card.status === 'SUSPENDED' ? (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onRestoreUse(card); }}
                                                            disabled={Boolean(restoringCardId)}
                                                            className="w-7 h-7 rounded-md bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-emerald-600 hover:text-emerald-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                                            aria-label={`카드 정지 해제: ${card.name}`}
                                                            title="카드 정지 해제"
                                                        >
                                                            <FontAwesomeIcon icon={faRotateLeft} spin={restoringCardId === card.id} className="text-xs" />
                                                        </button>
                                                    ) : card.status === 'CLOSED' ? null : (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onCancelUse(card); }}
                                                            className="w-7 h-7 rounded-md bg-slate-50 hover:bg-amber-50 flex items-center justify-center text-slate-400 hover:text-amber-600 transition-colors"
                                                            aria-label={`카드 사용취소 처리: ${card.name}`}
                                                            title="사용취소 처리"
                                                        >
                                                            <FontAwesomeIcon icon={faBoxArchive} className="text-xs" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {/* ... (Table Footer Summary) */}
                    <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">
                            총 {statusFilteredCards.length} / {cards.length}장
                        </span>
                        <div className="flex items-center gap-4">
                            <span className="text-emerald-600 font-bold">사용중 {stats.assigned}</span>
                            <span className="text-slate-500 font-bold">대기 {stats.available}</span>
                            <span className="text-orange-600 font-bold">정지 {stats.suspended}</span>
                            <span className="text-slate-400 font-bold">해지 {stats.closed}</span>
                        </div>
                    </div>
                </div>
            ) : (
                /* ── 카드형 (Grid) ── */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {sortedCards.map((card) => {
                        const teamInfo = getCardAssigneeTeamInfo(card);
                        const isOfficeAssignee = isOfficeStaffAssignee(card.currentAssigneeId, card.currentAssigneeName);

                        const tc = teamInfo?.color;
                        const billingTargetTypeLabel = getResolvedBillingTargetTypeLabel(card);
                        const billingTargetName = getResolvedBillingTargetName(card);
                        const billingTargetType = getResolvedBillingTargetType(card);
                        const billingTargetTeamInfo = getTargetTeamInfo(billingTargetType, billingTargetName);
                        const hasExplicitBillingTarget = Boolean(getLatestBillingTarget(card) || (card.billingTargetType && card.billingTargetId));
                        const billingModeBadge = getBillingModeBadge(card, hasExplicitBillingTarget, billingTargetName);
                        const tcText = tc ? getContrastingTextColor(tc) : undefined;

                        const needsWork = hasCardWorkItem(card);
                        const isInactiveCard = card.status === 'SUSPENDED' || card.status === 'CLOSED';

                        return (
                            <div
                                key={card.id}
                                className={`group rounded-2xl border bg-white transition-all relative overflow-hidden ${needsWork ? 'border-amber-200 shadow-[0_8px_24px_-16px_rgba(245,158,11,0.65)]' : 'border-slate-200 hover:border-slate-300 hover:-translate-y-1'}`}
                                style={{
                                    borderLeftWidth: tc ? '4px' : undefined,
                                    borderLeftColor: tc || undefined,
                                    boxShadow: tc ? `0 4px 20px -4px ${hexToRgba(tc, 0.12)}` : undefined,
                                }}
                            >
                                {/* Team Color Gradient Top Bar */}
                                {tc && (
                                    <div className="h-1" style={{ background: `linear-gradient(to right, ${tc}, ${hexToRgba(tc, 0.1)}, transparent)` }} />
                                )}

                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-3">
                                        {getStatusBadge(getEffectiveCardStatus(card))}
                                        <div className="flex gap-2 opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEdit(card);
                                                }}
                                                 className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
                                                 aria-label={`카드 정보 수정: ${card.name}`}
                                                 title="카드 정보 수정"
                                             >
                                                <FontAwesomeIcon icon={faPenToSquare} className="text-xs" />
                                            </button>
                                            {!isInactiveCard && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onAssign(card);
                                                    }}
                                                     className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-indigo-50 px-3 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100"
                                                     aria-label={`배정/청구 설정: ${card.name}`}
                                                     title="배정/청구 설정"
                                                 >
                                                    <FontAwesomeIcon icon={card.currentAssigneeType === 'TEAM' ? faUsers : faUser} className="text-xs" />
                                                    <span>설정</span>
                                                </button>
                                            )}
                                            {card.status === 'SUSPENDED' ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onRestoreUse(card);
                                                    }}
                                                    disabled={Boolean(restoringCardId)}
                                                    className="w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-emerald-600 hover:text-emerald-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                                    aria-label={`카드 정지 해제: ${card.name}`}
                                                    title="카드 정지 해제"
                                                >
                                                    <FontAwesomeIcon icon={faRotateLeft} spin={restoringCardId === card.id} className="text-xs" />
                                                </button>
                                            ) : card.status === 'CLOSED' ? null : (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onCancelUse(card);
                                                    }}
                                                     className="w-8 h-8 rounded-full bg-slate-50 hover:bg-amber-100 flex items-center justify-center text-slate-400 hover:text-amber-700 transition-colors"
                                                     aria-label={`카드 사용취소 처리: ${card.name}`}
                                                     title="사용취소 처리"
                                                 >
                                                    <FontAwesomeIcon icon={faBoxArchive} className="text-xs" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* 배정 뱃지 (통합) */}
                                    {card.currentAssigneeName && (
                                        <div className="mb-3">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); if (!isInactiveCard) onAssign(card); }}
                                                disabled={isInactiveCard}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                                                  style={tc ? {
                                                      backgroundColor: tc,
                                                      color: tcText,
                                                      border: `1px solid ${tc}`,
                                                  } : {
                                                    backgroundColor: card.currentAssigneeType === 'TEAM' ? '#f1f5f9' : '#e0e7ff',
                                                    color: card.currentAssigneeType === 'TEAM' ? '#475569' : '#4338ca',
                                                    border: card.currentAssigneeType === 'TEAM' ? '1px solid #e2e8f0' : '1px solid #e0e7ff',
                                                }}
                                            >
                                                <FontAwesomeIcon
                                                    icon={card.currentAssigneeType === 'TEAM'
                                                        ? getTeamFaIcon(teamInfo?.icon)
                                                        : isOfficeAssignee
                                                            ? faBuilding
                                                        : faUser}
                                                    className="text-xs"
                                                />
                                                {card.currentAssigneeName}
                                            </button>
                                        </div>
                                    )}

                                    <h3 className="mb-1 flex min-w-0 items-center gap-2 text-xl font-black text-slate-800 transition-colors group-hover:text-indigo-700">
                                        <span
                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-sm text-slate-400"
                                              style={tc ? {
                                                  backgroundColor: tc,
                                                  color: tcText,
                                                  borderColor: tc,
                                              } : undefined}
                                        >
                                            <FontAwesomeIcon icon={faCreditCard} />
                                        </span>
                                         <span
                                              className="truncate transition-colors group-hover:text-indigo-700"
                                          >
                                            {card.name}
                                        </span>
                                    </h3>
                                    <p className="text-sm text-slate-500 font-medium mb-4">
                                        <span className="bg-slate-100 px-2 py-0.5 rounded text-xs mr-2">{getCardTypeLabel(card.cardType)}</span>
                                        {card.issuer}
                                    </p>

                                    <div className="space-y-3 pt-4 border-t border-slate-100">
                                        <div className="flex items-center justify-between gap-2 text-sm">
                                            <span className="text-slate-400 font-medium text-xs">청구 대상</span>
                                            {billingTargetName && billingTargetTypeLabel ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!isInactiveCard) onBillingTargetAssign?.(card);
                                                    }}
                                                    disabled={isInactiveCard || !onBillingTargetAssign}
                                                    className="inline-flex min-w-0 items-center gap-1.5 rounded px-2 py-0.5 text-xs font-bold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                                                    style={getTargetBadgeStyle(billingTargetType, billingTargetTeamInfo)}
                                                    title={`${hasExplicitBillingTarget ? '배정자와 다른 청구대상' : billingTargetTypeLabel} · ${billingTargetName} · 청구대상 설정에서 이력 확인`}
                                                >
                                                    <FontAwesomeIcon
                                                        icon={billingTargetType === 'TEAM'
                                                            ? getTeamFaIcon(billingTargetTeamInfo?.icon)
                                                            : billingTargetType === 'OFFICE'
                                                                ? faBuilding
                                                                : faUser}
                                                        className="text-[10px]"
                                                    />
                                                    <span className="truncate">{billingTargetTypeLabel} · {billingTargetName}</span>
                                                </button>
                                            ) : (
                                                <span className="text-xs text-slate-300">미지정</span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between gap-2 text-sm">
                                            <span className="text-slate-400 font-medium text-xs">청구 방식</span>
                                            <span className={`inline-flex min-w-[88px] items-center justify-center rounded-md border px-2 py-0.5 text-[11px] font-extrabold ${billingModeBadge.className}`}>
                                                {billingModeBadge.label}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-400 font-medium text-xs">번호</span>
                                            <span className="font-bold text-slate-700 font-mono">{card.maskedNumber || '-'}</span>
                                        </div>
                                    </div>

                                    {/* Unassigned indicator */}
                                    {!card.currentAssigneeName && (
                                        <div className="mt-3 pt-3 border-t border-dashed border-slate-100 flex justify-center">
                                            <button
                                            onClick={(e) => { e.stopPropagation(); if (!isInactiveCard) onAssign(card); }}
                                            disabled={isInactiveCard}
                                            className="w-full py-2 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                            >
                                                <FontAwesomeIcon icon={faPlus} />
                                                배정/청구 설정
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
