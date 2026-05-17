import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBan, faCheckCircle, faClock, faCreditCard, faUser, faUsers,
    faList, faTh, faPlus, faTrash, faPenToSquare, faFileInvoiceDollar
} from '@fortawesome/free-solid-svg-icons';
import { Worker, manpowerService } from '../../services/manpowerService';

import { Card, CardAssigneeType } from '../../types/card';
import { Team } from '../../services/teamService';
import { iconMap } from '../../constants/iconMap';

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
    onDelete: (card: Card) => void;
}

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

export const CardStatusBoard: React.FC<CardStatusBoardProps> = ({ cards, teams = [], loading, onEdit, onAssign, onBillingTargetAssign, onDelete }) => {
    const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
    const [workers, setWorkers] = useState<Worker[]>([]);

    // Worker 데이터 로드 (개인 배정 시 팀 색상 확인용)
    React.useEffect(() => {
        const loadWorkers = async () => {
            try {
                const data = await manpowerService.getWorkers();
                setWorkers(data);
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
            if (w.name && w.teamName) {
                const tInfo = teamInfoMap.get(w.teamName);
                if (tInfo) map.set(w.name, tInfo);
            }
        });
        return map;
    }, [workers, teamInfoMap]);

    const stats = useMemo(() => {
        // ... (existing stats logic)
        const total = cards.length;
        const assigned = cards.filter((c) => c.status === 'ASSIGNED').length;
        const available = cards.filter((c) => c.status === 'AVAILABLE').length;
        const suspended = cards.filter((c) => c.status === 'SUSPENDED').length;
        const closed = cards.filter((c) => c.status === 'CLOSED').length;
        return { total, assigned, available, suspended, closed };
    }, [cards]);

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

    const hasActiveAssignment = (card: Card) => {
        return Boolean(card.currentAssigneeId && card.currentAssigneeType && card.currentAssigneeName);
    };

    const getResolvedBillingTargetName = (card: Card) => {
        if (!hasActiveAssignment(card)) return '';
        return card.billingTargetType && card.billingTargetId
            ? (card.billingTargetName ?? '')
            : (card.currentAssigneeName ?? '');
    };

    const getResolvedBillingTargetType = (card: Card) => {
        if (!hasActiveAssignment(card)) return undefined;
        return card.billingTargetType && card.billingTargetId
            ? card.billingTargetType
            : card.currentAssigneeType;
    };

    const getResolvedBillingTargetTypeLabel = (card: Card) => {
        const name = getResolvedBillingTargetName(card);
        if (!name) return null;
        return getResolvedBillingTargetType(card) === 'TEAM' ? '팀' : '개인';
    };

    const getTargetTeamInfo = (type?: CardAssigneeType | null, name?: string | null) => {
        if (!type || !name) return undefined;
        return type === 'TEAM' ? teamInfoMap.get(name) : workerTeamMap.get(name);
    };

    const getTargetBadgeStyle = (type?: CardAssigneeType | null, teamInfo?: TeamInfo) => {
        const color = teamInfo?.color;
        if (color) {
            return {
                backgroundColor: hexToRgba(color, 0.1),
                color,
                border: `1px solid ${hexToRgba(color, 0.2)}`
            };
        }

        return type === 'WORKER'
            ? { backgroundColor: '#eef2ff', color: '#4338ca', border: '1px solid #e0e7ff' }
            : { backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' };
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
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-lg transition-shadow relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-slate-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">총 보유 카드</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-3xl font-extrabold text-slate-800">{stats.total}</h3>
                            <span className="text-sm font-bold text-slate-400">장</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 w-fit px-2 py-1 rounded-lg">
                            <FontAwesomeIcon icon={faCreditCard} className="text-slate-400" /> 전체 지원카드
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group">
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
                </div>

                <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-[0_4px_20px_-4px_rgba(99,102,241,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group">
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
                </div>

                <div className="bg-white p-6 rounded-2xl border border-orange-100 shadow-[0_4px_20px_-4px_rgba(249,115,22,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group">
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
                </div>
            </div>

            <div className="flex justify-end">
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                    <button
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
            {viewMode === 'list' ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="support-compact-table support-compact-status w-full table-fixed text-xs">
                            <colgroup>
                                <col style={{ width: '3%' }} />
                                <col style={{ width: '13%' }} />
                                <col style={{ width: '9%' }} />
                                <col style={{ width: '6%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '7%' }} />
                                <col style={{ width: '7%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '13%' }} />
                                <col style={{ width: '12%' }} />
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
                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">메모</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider w-32"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {cards.map((card, rowIdx) => {
                                    // 팀 배정 or 개인 배정(workerTeamMap) 확인
                                    const teamInfo = card.currentAssigneeType === 'TEAM' && card.currentAssigneeName
                                        ? teamInfoMap.get(card.currentAssigneeName)
                                        : (card.currentAssigneeType !== 'TEAM' && card.currentAssigneeName
                                            ? workerTeamMap.get(card.currentAssigneeName)
                                            : undefined);

                                    const tc = teamInfo?.color;
                                    const billingTargetTypeLabel = getResolvedBillingTargetTypeLabel(card);
                                    const billingTargetName = getResolvedBillingTargetName(card);
                                    const billingTargetType = getResolvedBillingTargetType(card);
                                    const billingTargetTeamInfo = getTargetTeamInfo(billingTargetType, billingTargetName);
                                    const isAssigned = hasActiveAssignment(card);
                                    const hasExplicitBillingTarget = isAssigned && Boolean(card.billingTargetType && card.billingTargetId);

                                    return (
                                        <tr
                                            key={card.id}
                                            className="hover:bg-indigo-50/40 transition-colors group"
                                            style={tc ? { borderLeft: `3px solid ${tc}` } : undefined}
                                        >
                                            {/* ... (existing td cells except Assignee) */}
                                            <td className="px-4 py-3 text-xs text-slate-400 font-mono">{rowIdx + 1}</td>
                                            <td className="px-4 py-3">
                                                <span className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                                                    {card.name}
                                                </span>
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
                                                {getStatusBadge(card.status)}
                                            </td>

                                            <td className="px-4 py-3">
                                                {card.currentAssigneeName ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); onAssign(card); }}
                                                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold transition-transform hover:-translate-y-0.5"
                                                        style={tc ? {
                                                            backgroundColor: hexToRgba(tc, 0.1),
                                                            color: tc,
                                                            border: `1px solid ${hexToRgba(tc, 0.2)}`,
                                                        } : {
                                                            backgroundColor: card.currentAssigneeType === 'TEAM' ? '#f1f5f9' : '#e0e7ff',
                                                            color: card.currentAssigneeType === 'TEAM' ? '#475569' : '#4338ca',
                                                            border: card.currentAssigneeType === 'TEAM' ? '1px solid #e2e8f0' : '1px solid #e0e7ff',
                                                        }}
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={card.currentAssigneeType === 'TEAM'
                                                                ? getTeamFaIcon(teamInfo?.icon)
                                                                : faUser}
                                                            className="text-[10px]"
                                                        />
                                                        {card.currentAssigneeName}
                                                        {/* 개인이지만 소속팀이 있다면 툴팁 등으로 표시 가능 */}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onAssign(card); }}
                                                        className="px-2 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 transition-colors flex items-center gap-1"
                                                    >
                                                        <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                                                        배정하기
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {billingTargetName && billingTargetTypeLabel ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onBillingTargetAssign?.(card);
                                                            }}
                                                            disabled={!onBillingTargetAssign}
                                                            className="inline-flex max-w-[180px] items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                                                            style={getTargetBadgeStyle(billingTargetType, billingTargetTeamInfo)}
                                                            title={`${hasExplicitBillingTarget ? '별도 청구대상' : '배정과 동일'} · ${billingTargetName}`}
                                                        >
                                                            <FontAwesomeIcon
                                                                icon={billingTargetType === 'TEAM'
                                                                    ? getTeamFaIcon(billingTargetTeamInfo?.icon)
                                                                    : faUser}
                                                                className="text-[10px]"
                                                            />
                                                            <span className="truncate">
                                                                {hasExplicitBillingTarget ? '' : '동일 · '}{billingTargetTypeLabel} · {billingTargetName}
                                                            </span>
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs font-bold text-slate-300">미지정</span>
                                                    )}
                                                    {isAssigned && !hasExplicitBillingTarget && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onBillingTargetAssign?.(card);
                                                        }}
                                                        className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                        disabled={!onBillingTargetAssign}
                                                    >
                                                        배정
                                                    </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-400 max-w-[150px] truncate" title={card.memo}>
                                                {card.memo || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onEdit(card); }}
                                                        className="w-7 h-7 rounded-md bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
                                                        title="카드 정보 수정"
                                                    >
                                                        <FontAwesomeIcon icon={faPenToSquare} className="text-xs" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onAssign(card); }}
                                                        className="w-7 h-7 rounded-md bg-slate-50 hover:bg-green-50 flex items-center justify-center text-slate-400 hover:text-green-500 transition-colors"
                                                        title="배정 관리"
                                                    >
                                                        <FontAwesomeIcon icon={card.currentAssigneeType === 'TEAM' ? faUsers : faUser} className="text-xs" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onDelete(card); }}
                                                        className="w-7 h-7 rounded-md bg-slate-50 hover:bg-rose-50 flex items-center justify-center text-slate-400 hover:text-rose-600 transition-colors"
                                                        title="삭제"
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} className="text-xs" />
                                                    </button>
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
                            총 {cards.length}장
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
                    {cards.map((card) => {
                        // 팀 배정 or 개인 배정(workerTeamMap) 확인
                        const teamInfo = card.currentAssigneeType === 'TEAM' && card.currentAssigneeName
                            ? teamInfoMap.get(card.currentAssigneeName)
                            : (card.currentAssigneeType !== 'TEAM' && card.currentAssigneeName
                                ? workerTeamMap.get(card.currentAssigneeName)
                                : undefined);

                        const tc = teamInfo?.color;
                        const billingTargetTypeLabel = getResolvedBillingTargetTypeLabel(card);
                        const billingTargetName = getResolvedBillingTargetName(card);
                        const billingTargetType = getResolvedBillingTargetType(card);
                        const billingTargetTeamInfo = getTargetTeamInfo(billingTargetType, billingTargetName);
                        const isAssigned = hasActiveAssignment(card);
                        const hasExplicitBillingTarget = isAssigned && Boolean(card.billingTargetType && card.billingTargetId);

                        return (
                            <div
                                key={card.id}
                                className="group bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:-translate-y-1 transition-all relative overflow-hidden"
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
                                        {getStatusBadge(card.status)}
                                        <div className="flex gap-2 opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEdit(card);
                                                }}
                                                className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
                                                title="카드 정보 수정"
                                            >
                                                <FontAwesomeIcon icon={faPenToSquare} className="text-xs" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onAssign(card);
                                                }}
                                                className="w-8 h-8 rounded-full bg-slate-50 hover:bg-green-100 flex items-center justify-center text-slate-400 hover:text-green-700 transition-colors"
                                                title="배정 관리"
                                            >
                                                <FontAwesomeIcon icon={card.currentAssigneeType === 'TEAM' ? faUsers : faUser} className="text-xs" />
                                            </button>
                                            {isAssigned && !hasExplicitBillingTarget && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onBillingTargetAssign?.(card);
                                                }}
                                                disabled={!onBillingTargetAssign}
                                                className="w-8 h-8 rounded-full bg-slate-50 hover:bg-emerald-100 flex items-center justify-center text-slate-400 hover:text-emerald-700 transition-colors disabled:opacity-50"
                                                title="청구대상 배정"
                                            >
                                                <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-xs" />
                                            </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDelete(card);
                                                }}
                                                className="w-8 h-8 rounded-full bg-slate-50 hover:bg-rose-100 flex items-center justify-center text-slate-400 hover:text-rose-700 transition-colors"
                                                title="삭제"
                                            >
                                                <FontAwesomeIcon icon={faTrash} className="text-xs" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* 배정 뱃지 (통합) */}
                                    {card.currentAssigneeName && (
                                        <div className="mb-3">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); onAssign(card); }}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-transform hover:-translate-y-0.5"
                                                style={tc ? {
                                                    backgroundColor: hexToRgba(tc, 0.1),
                                                    color: tc,
                                                    border: `1px solid ${hexToRgba(tc, 0.2)}`,
                                                } : {
                                                    backgroundColor: card.currentAssigneeType === 'TEAM' ? '#f1f5f9' : '#e0e7ff',
                                                    color: card.currentAssigneeType === 'TEAM' ? '#475569' : '#4338ca',
                                                    border: card.currentAssigneeType === 'TEAM' ? '1px solid #e2e8f0' : '1px solid #e0e7ff',
                                                }}
                                            >
                                                <FontAwesomeIcon
                                                    icon={card.currentAssigneeType === 'TEAM'
                                                        ? getTeamFaIcon(teamInfo?.icon)
                                                        : faUser}
                                                    className="text-xs"
                                                />
                                                {card.currentAssigneeName}
                                            </button>
                                        </div>
                                    )}

                                    <h3 className="text-xl font-black text-slate-800 mb-1 group-hover:text-indigo-700 transition-colors">
                                        {card.name}
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
                                                        onBillingTargetAssign?.(card);
                                                    }}
                                                    disabled={!onBillingTargetAssign}
                                                    className="inline-flex min-w-0 items-center gap-1.5 rounded px-2 py-0.5 text-xs font-bold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                                                    style={getTargetBadgeStyle(billingTargetType, billingTargetTeamInfo)}
                                                    title={`${hasExplicitBillingTarget ? '별도 청구대상' : '배정과 동일'} · ${billingTargetName}`}
                                                >
                                                    <FontAwesomeIcon
                                                        icon={billingTargetType === 'TEAM'
                                                            ? getTeamFaIcon(billingTargetTeamInfo?.icon)
                                                            : faUser}
                                                        className="text-[10px]"
                                                    />
                                                    <span className="truncate">{hasExplicitBillingTarget ? '' : '동일 · '}{billingTargetTypeLabel} · {billingTargetName}</span>
                                                </button>
                                            ) : (
                                                <span className="text-xs text-slate-300">미지정</span>
                                            )}
                                        </div>

                                        {isAssigned && !hasExplicitBillingTarget && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onBillingTargetAssign?.(card);
                                            }}
                                            disabled={!onBillingTargetAssign}
                                            className="w-full rounded-lg border border-emerald-100 bg-emerald-50 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            청구대상 배정
                                        </button>
                                        )}

                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-400 font-medium text-xs">번호</span>
                                            <span className="font-bold text-slate-700 font-mono">{card.maskedNumber || '-'}</span>
                                        </div>
                                    </div>

                                    {/* Unassigned indicator */}
                                    {!card.currentAssigneeName && (
                                        <div className="mt-3 pt-3 border-t border-dashed border-slate-100 flex justify-center">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onAssign(card); }}
                                                className="w-full py-2 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1.5"
                                            >
                                                <FontAwesomeIcon icon={faPlus} />
                                                지금 배정하기
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
