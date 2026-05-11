import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileInvoiceDollar, faRotateLeft, faUser, faUsers } from '@fortawesome/free-solid-svg-icons';
import { Card, CardAssigneeType } from '../../types/card';
import { manpowerService, Worker } from '../../services/manpowerService';
import { cardService } from '../../services/cardService';
import { Team } from '../../services/teamService';
import { toast, showConfirmAlert } from '../../utils/swal';
import { hexToRgba, normalizeHexColor } from '../../utils/color';

type BillingTargetMode = CardAssigneeType;

interface BillingTargetSelection {
    type: CardAssigneeType;
    id: string;
    name: string;
}

interface CardBillingTargetManagerProps {
    cards: Card[];
    loading: boolean;
    initialCardId?: string | null;
    selectableTeams?: Team[];
    onRefresh: () => void;
}

const targetLabel = (card: Card): string => {
    if (card.billingTargetType && card.billingTargetId && card.billingTargetName) {
        return `${card.billingTargetType === 'TEAM' ? '팀' : '개인'} · ${card.billingTargetName}`;
    }
    if (card.currentAssigneeName) {
        return `배정과 동일 · ${card.currentAssigneeName}`;
    }
    return '청구대상 미지정';
};

export const CardBillingTargetManager: React.FC<CardBillingTargetManagerProps> = ({
    cards,
    loading,
    initialCardId,
    selectableTeams = [],
    onRefresh
}) => {
    const [mode, setMode] = useState<BillingTargetMode>('TEAM');
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [selectedCardId, setSelectedCardId] = useState('');
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadWorkers = async () => {
            try {
                setWorkers(await manpowerService.getWorkers());
            } catch (error) {
                console.error(error);
                toast.error('작업자 목록을 불러오지 못했습니다.');
            }
        };
        loadWorkers();
    }, []);

    useEffect(() => {
        if (selectedTeamId || selectableTeams.length === 0) return;
        setSelectedTeamId(selectableTeams.find((team) => Boolean(team.id))?.id ?? '');
    }, [selectableTeams, selectedTeamId]);

    const cardsById = useMemo(() => {
        const map = new Map<string, Card>();
        cards.forEach((card) => map.set(String(card.id), card));
        return map;
    }, [cards]);

    const selectedCard = useMemo(() => {
        if (!selectedCardId) return null;
        return cardsById.get(String(selectedCardId)) ?? null;
    }, [cardsById, selectedCardId]);
    const selectedCardHasExplicitBillingTarget = Boolean(selectedCard?.billingTargetType && selectedCard?.billingTargetId);

    const selectedTeam = useMemo(
        () => selectableTeams.find((team) => String(team.id) === String(selectedTeamId)) ?? null,
        [selectableTeams, selectedTeamId]
    );
    const selectedTeamColor = selectedTeam ? normalizeHexColor(selectedTeam.color) : '#64748b';

    const filteredWorkers = useMemo(() => {
        if (!selectedTeamId) return workers;
        return workers.filter((worker) => String(worker.teamId ?? '') === String(selectedTeamId));
    }, [selectedTeamId, workers]);

    useEffect(() => {
        if (mode !== 'WORKER') return;
        if (selectedWorkerId && filteredWorkers.some((worker) => worker.id === selectedWorkerId)) return;
        setSelectedWorkerId(filteredWorkers.find((worker) => Boolean(worker.id))?.id ?? '');
    }, [filteredWorkers, mode, selectedWorkerId]);

    const explicitCards = useMemo(
        () => cards.filter((card) => Boolean(card.billingTargetType && card.billingTargetId)),
        [cards]
    );

    const followingCards = useMemo(
        () => cards.filter((card) => !card.billingTargetType || !card.billingTargetId),
        [cards]
    );

    const selectedTarget = useMemo<BillingTargetSelection | null>(() => {
        if (mode === 'TEAM') {
            const team = selectableTeams.find((item) => String(item.id) === String(selectedTeamId));
            return team?.id ? { type: 'TEAM', id: team.id, name: team.name } : null;
        }
        const worker = workers.find((item) => String(item.id) === String(selectedWorkerId));
        return worker?.id ? { type: 'WORKER', id: worker.id, name: worker.name } : null;
    }, [mode, selectableTeams, selectedTeamId, selectedWorkerId, workers]);

    const saveBillingTarget = async (card: Card, target: BillingTargetSelection | null) => {
        setSaving(true);
        try {
            await cardService.updateCard(card.id, {
                billingTargetId: target?.id ?? null,
                billingTargetType: target?.type ?? null,
                billingTargetName: target?.name ?? null
            });
            toast.success(target ? '청구대상을 배정했습니다.' : '청구대상을 배정과 동일로 되돌렸습니다.');
            onRefresh();
        } finally {
            setSaving(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedCard) {
            toast.error('카드를 선택해 주세요.');
            return;
        }
        if (!selectedTarget) {
            toast.error(mode === 'TEAM' ? '팀을 선택해 주세요.' : '작업자를 선택해 주세요.');
            return;
        }

        const result = await showConfirmAlert(
            '청구대상 배정',
            `${selectedCard.name} 카드의 청구대상을 ${selectedTarget.name}${selectedTarget.type === 'TEAM' ? '(팀)' : '(개인)'}으로 배정할까요?`
        );
        if (!result.isConfirmed) return;

        try {
            await saveBillingTarget(selectedCard, selectedTarget);
        } catch (error) {
            console.error(error);
            toast.error('청구대상 배정에 실패했습니다.');
        }
    };

    const handleReset = async (card: Card) => {
        const result = await showConfirmAlert('청구대상 초기화', `${card.name} 카드의 청구대상을 배정과 동일하게 되돌릴까요?`);
        if (!result.isConfirmed) return;

        try {
            await saveBillingTarget(card, null);
        } catch (error) {
            console.error(error);
            toast.error('청구대상 초기화에 실패했습니다.');
        }
    };

    const pickCard = (card: Card) => {
        setSelectedCardId(card.id);
        if (card.billingTargetType === 'TEAM' && card.billingTargetId) {
            setMode('TEAM');
            setSelectedTeamId(card.billingTargetId);
        }
        if (card.billingTargetType === 'WORKER' && card.billingTargetId) {
            setMode('WORKER');
            setSelectedWorkerId(card.billingTargetId);
            const assignedWorker = workers.find((worker) => String(worker.id) === String(card.billingTargetId));
            if (assignedWorker?.teamId) setSelectedTeamId(assignedWorker.teamId);
        }
    };

    const pickCardById = (cardId: string) => {
        const card = cardsById.get(String(cardId));
        if (card) {
            pickCard(card);
            return;
        }
        setSelectedCardId(cardId);
    };

    useEffect(() => {
        if (!initialCardId) return;
        pickCardById(String(initialCardId));
    }, [initialCardId, cardsById, workers]);

    if (loading) {
        return (
            <div className="h-64 flex items-center justify-center text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                            <span className="bg-emerald-600 text-white w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                                <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-sm" />
                            </span>
                            카드 청구대상 배정
                        </h2>
                        <p className="text-slate-500 mt-2 font-medium ml-12 text-sm">
                            카드 배정과 별도로 실제 청구를 받을 팀/개인을 지정합니다. 미지정이면 배정 대상에게 청구됩니다.
                        </p>
                    </div>
                    <button
                        onClick={handleAssign}
                        disabled={saving}
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center gap-2 ${
                            saving ? 'bg-emerald-400 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5'
                        }`}
                    >
                        <FontAwesomeIcon icon={faFileInvoiceDollar} />
                        {saving ? '처리 중...' : selectedCardHasExplicitBillingTarget ? '청구대상 변경' : '청구대상 배정'}
                    </button>
                </div>

                <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-4">
                    <div className="xl:col-span-4 space-y-3">
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button
                                onClick={() => setMode('TEAM')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                                    mode === 'TEAM' ? 'bg-white shadow text-emerald-700' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <FontAwesomeIcon icon={faUsers} className="mr-2" /> 팀
                            </button>
                            <button
                                onClick={() => setMode('WORKER')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                                    mode === 'WORKER' ? 'bg-white shadow text-emerald-700' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <FontAwesomeIcon icon={faUser} className="mr-2" /> 개인
                            </button>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">카드 선택</label>
                                <select
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700"
                                    value={selectedCardId}
                                    onChange={(event) => pickCardById(event.target.value)}
                                >
                                    <option value="">카드를 선택하세요</option>
                                    {cards
                                        .slice()
                                        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko-KR'))
                                        .map((card) => (
                                            <option key={card.id} value={card.id}>
                                                {card.name} ({card.last4}) · {targetLabel(card)}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            {mode === 'TEAM' && (
                                <div className="relative">
                                    <label className="block text-xs font-bold text-slate-600 mb-1">청구 팀 선택</label>
                                    {selectedTeam && (
                                        <span
                                            className="pointer-events-none absolute left-3 top-9 h-3 w-3 rounded-full border border-white shadow-sm"
                                            style={{ backgroundColor: selectedTeamColor }}
                                        />
                                    )}
                                    <select
                                        className={`w-full rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700 ${
                                            selectedTeam ? 'pl-8 pr-3' : 'px-3'
                                        }`}
                                        value={selectedTeamId}
                                        onChange={(event) => setSelectedTeamId(event.target.value)}
                                        style={
                                            selectedTeam
                                                ? {
                                                    borderColor: hexToRgba(selectedTeamColor, 0.35),
                                                    backgroundColor: hexToRgba(selectedTeamColor, 0.05),
                                                    color: selectedTeamColor
                                                }
                                                : undefined
                                        }
                                    >
                                        {selectableTeams
                                            .slice()
                                            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko-KR'))
                                            .map((team) => (
                                                <option key={team.id} value={team.id} style={{ color: normalizeHexColor(team.color) }}>
                                                    {team.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            )}

                            {mode === 'WORKER' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">청구 개인 선택</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700"
                                        value={selectedWorkerId}
                                        onChange={(event) => setSelectedWorkerId(event.target.value)}
                                    >
                                        {filteredWorkers
                                            .slice()
                                            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko-KR'))
                                            .map((worker) => (
                                                <option key={worker.id} value={worker.id}>
                                                    {worker.name}{worker.teamName ? ` (${worker.teamName})` : ''}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {selectedCard && (
                            <div className="bg-white p-4 rounded-2xl border border-slate-200">
                                <div>
                                    <div className="min-w-0">
                                        <div className="text-xs text-slate-500 font-bold">선택 카드</div>
                                        <div className="text-lg font-extrabold text-slate-900 truncate">{selectedCard.name} ({selectedCard.last4})</div>
                                        <div className="text-sm text-slate-500 font-medium mt-1">{targetLabel(selectedCard)}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="xl:col-span-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-200">
                            <h3 className="font-extrabold text-slate-800 mb-3">배정과 동일한 카드</h3>
                            <div className="space-y-2 max-h-[390px] overflow-y-auto">
                                {followingCards.length === 0 ? (
                                    <div className="text-sm text-slate-400">모든 카드에 별도 청구대상이 있습니다.</div>
                                ) : (
                                    followingCards.map((card) => (
                                        <button
                                            key={card.id}
                                            onClick={() => pickCard(card)}
                                            className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="font-extrabold text-slate-800 truncate">{card.name} ({card.last4})</div>
                                                <span className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-sm shadow-emerald-100">배정</span>
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">{targetLabel(card)}</div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-200">
                            <h3 className="font-extrabold text-slate-800 mb-3">별도 청구대상 카드</h3>
                            <div className="space-y-2 max-h-[390px] overflow-y-auto">
                                {explicitCards.length === 0 ? (
                                    <div className="text-sm text-slate-400">별도 청구대상이 지정된 카드가 없습니다.</div>
                                ) : (
                                    explicitCards.map((card) => (
                                        <div
                                            key={card.id}
                                            className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <button onClick={() => pickCard(card)} className="min-w-0 text-left">
                                                    <div className="font-extrabold text-slate-800 truncate">{card.name} ({card.last4})</div>
                                                    <div className="text-xs text-slate-500 mt-1">{targetLabel(card)}</div>
                                                </button>
                                                <button
                                                    onClick={() => handleReset(card)}
                                                    disabled={saving}
                                                    className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 text-slate-700 hover:bg-slate-100 inline-flex items-center gap-2"
                                                >
                                                    <FontAwesomeIcon icon={faRotateLeft} />
                                                    배정과 동일
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                카드 사용자는 그대로 두고 청구만 다른 팀/개인에게 넘길 때 사용합니다. 별도 청구대상이 없으면 월별 청구 생성 시 현재 배정 대상이 자동으로 사용됩니다.
            </div>
        </div>
    );
};
