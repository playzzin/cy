import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightFromBracket, faCreditCard, faPen, faTimes, faUser, faUsers } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { useMasterData } from '../../contexts/MasterDataContext';
import { manpowerService, Worker } from '../../services/manpowerService';
import { OfficeStaff, officeStaffService } from '../../services/officeStaffService';
import { cardService } from '../../services/cardService';
import { teamService, Team } from '../../services/teamService';
import { Card, CardAssigneeType, CardAssignmentRecord } from '../../types/card';
import { toast, showConfirmAlert } from '../../utils/swal';
import { hexToRgba, normalizeHexColor } from '../../utils/color';
import { formatTypedDateInput, normalizeTypedDateInput, toShortYearDateInputValue } from '../../utils/typedDateInput';
import { buildOfficeStaffAssignmentOptions, isOfficeAssignmentTeam } from '../../utils/supportAssignmentTargets';
import { getFriendlyErrorMessage, isDeadlineExceededError } from '../../utils/firebaseError';

type AssigneeMode = CardAssigneeType;

interface AssignmentTargetSelection {
    type: CardAssigneeType;
    id: string;
    name: string;
}

interface AssignmentPersonOption {
    id: string;
    name: string;
    teamId?: string | null;
    teamName?: string | null;
    source?: 'worker' | 'office_staff';
    detail?: string;
}

interface CardAssignmentManagerProps {
    cards: Card[];
    loading: boolean;
    initialCardId?: string | null;
    selectableTeams?: Team[]; // Optional: if provided, use this list instead of filtering from context
    onRefresh: () => void;
}

const toDateInputValue = (d: Date): string => {
    return format(d, 'yyyy-MM-dd');
};
const toShortDateInputValue = (d: Date): string => toShortYearDateInputValue(toDateInputValue(d));
const displayDate = (value?: string | null): string => toShortYearDateInputValue(value) || '';

const hasActiveCardAssignment = (card: Card): boolean => (
    Boolean(card.currentAssigneeType && (card.currentAssigneeId || card.currentAssigneeName))
);

const getEffectiveCardStatus = (card: Card): Card['status'] => {
    if (card.status === 'SUSPENDED' || card.status === 'CLOSED') return card.status;
    return hasActiveCardAssignment(card) ? 'ASSIGNED' : 'AVAILABLE';
};

const assignmentLabel = (card: Card): string => {
    if (hasActiveCardAssignment(card)) {
        return `${card.currentAssigneeType === 'TEAM' ? '팀' : '개인'} · ${card.currentAssigneeName || card.currentAssigneeId}`;
    }
    return '미배정';
};

export const CardAssignmentManager: React.FC<CardAssignmentManagerProps> = ({
    cards,
    loading,
    initialCardId,
    selectableTeams,
    onRefresh
}) => {
    const { teams: allTeams } = useMasterData();

    // Strict Filter or Use Prop
    const teams = useMemo(() => {
        if (selectableTeams) return selectableTeams;

        // Fallback (e.g. if not passed, use Cheongyeon logic if possible, or old logic)
        // Since the parent is updated to pass the correct list, we can keep the old one as fallback
        // or just return allTeams if no filter needed.
        // For safety, let's just return allTeams or strict filter if prop missing.
        const targetTeamTypes = new Set(['시공팀', '시공사팀', '건설사', '시공사']);
        return allTeams.filter(t => {
            const rawType = String(t.type ?? '').trim();
            return targetTeamTypes.has(rawType);
        });
    }, [allTeams, selectableTeams]);

    const today = useMemo(() => toShortDateInputValue(new Date()), []);

    const [mode, setMode] = useState<AssigneeMode>('TEAM');
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [officeStaffRows, setOfficeStaffRows] = useState<OfficeStaff[]>([]);

    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
    const [selectedCardId, setSelectedCardId] = useState<string>('');
    const [startDate, setStartDate] = useState<string>(today);
    const [autoUnassignExisting, setAutoUnassignExisting] = useState<boolean>(true);

    const [saving, setSaving] = useState<boolean>(false);
    const [assignmentRecords, setAssignmentRecords] = useState<CardAssignmentRecord[]>([]);
    const [assignmentRecordsLoading, setAssignmentRecordsLoading] = useState(false);
    const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);

    const handleStartDateChange = (value: string) => {
        setStartDate(formatTypedDateInput(value, { yearDigits: 2 }));
    };

    const normalizeStartDate = () => {
        setStartDate((prev) => toShortYearDateInputValue(normalizeTypedDateInput(prev) ?? prev) || prev);
    };

    useEffect(() => {
        const loadWorkers = async () => {
            try {
                const [list, officeStaffList] = await Promise.all([
                    manpowerService.getWorkers(),
                    officeStaffService.getOfficeStaff().catch(() => [] as OfficeStaff[])
                ]);
                setWorkers(list);
                setOfficeStaffRows(officeStaffList);
            } catch (e) {
                console.error(e);
                toast.error('작업자 목록을 불러오지 못했습니다.');
            }
        };
        loadWorkers();
    }, []);

    useEffect(() => {
        if (selectedTeamId) return;
        const first = teams.find((t) => Boolean(t.id));
        setSelectedTeamId(first?.id ?? '');
    }, [teams, selectedTeamId]);

    const loadAssignmentRecords = async () => {
        setAssignmentRecordsLoading(true);
        try {
            setAssignmentRecords(await cardService.listAllCardAssignments());
        } catch (error) {
            console.error(error);
            toast.error('카드 배정 이력을 불러오지 못했습니다.');
        } finally {
            setAssignmentRecordsLoading(false);
        }
    };

    useEffect(() => {
        loadAssignmentRecords();
    }, []);

    const cardsById = useMemo(() => {
        const map = new Map<string, Card>();
        cards.forEach((c) => map.set(String(c.id), c));
        return map;
    }, [cards]);

    const availableCards = useMemo(() => {
        return cards.filter((c) => !hasActiveCardAssignment(c) && !['SUSPENDED', 'CLOSED'].includes(c.status ?? 'AVAILABLE'));
    }, [cards]);

    const assignedCards = useMemo(() => {
        return cards.filter(hasActiveCardAssignment);
    }, [cards]);

    const selectedCard = useMemo(() => {
        if (!selectedCardId) return null;
        return cardsById.get(String(selectedCardId)) ?? null;
    }, [cardsById, selectedCardId]);

    const selectedCardAssignments = useMemo(
        () => assignmentRecords
            .filter((record) => String(record.cardId) === String(selectedCardId))
            .slice()
            .sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? ''))),
        [assignmentRecords, selectedCardId]
    );

    const editingAssignment = useMemo(
        () => assignmentRecords.find((record) => String(record.id) === String(editingAssignmentId)) ?? null,
        [assignmentRecords, editingAssignmentId]
    );

    const selectedTeam = useMemo(() => {
        return teams.find((t) => t.id === selectedTeamId) ?? null;
    }, [teams, selectedTeamId]);
    const selectedTeamColor = selectedTeam ? normalizeHexColor(selectedTeam.color) : '#64748b';
    const selectedTeamIsOffice = isOfficeAssignmentTeam(selectedTeam);

    const officeStaffOptions = useMemo(
        () => buildOfficeStaffAssignmentOptions(officeStaffRows),
        [officeStaffRows]
    );

    const filteredWorkers = useMemo<AssignmentPersonOption[]>(() => {
        if (selectedTeamIsOffice) return officeStaffOptions;
        const workerOptions = workers
            .map((worker) => ({
                id: String(worker.id ?? ''),
                name: String(worker.name ?? ''),
                teamId: worker.teamId,
                teamName: worker.teamName,
                source: 'worker' as const
            }))
            .filter((worker) => Boolean(worker.id && worker.name));
        if (!selectedTeamId) return workerOptions;
        return workerOptions.filter((worker) => String(worker.teamId ?? '') === String(selectedTeamId));
    }, [officeStaffOptions, selectedTeamId, selectedTeamIsOffice, workers]);

    useEffect(() => {
        if (mode !== 'WORKER') return;
        if (selectedWorkerId && filteredWorkers.some((w) => w.id === selectedWorkerId)) return;
        const first = filteredWorkers.find((w) => Boolean(w.id));
        setSelectedWorkerId(first?.id ?? '');
    }, [mode, selectedWorkerId, filteredWorkers]);

    const selectedWorker = useMemo<AssignmentPersonOption | null>(() => {
        if (!selectedWorkerId) return null;
        return filteredWorkers.find((w) => w.id === selectedWorkerId) ?? null;
    }, [filteredWorkers, selectedWorkerId]);

    const selectedTarget = useMemo<AssignmentTargetSelection | null>(() => {
        if (mode === 'TEAM') {
            return selectedTeam?.id ? { type: 'TEAM', id: selectedTeam.id, name: selectedTeam.name } : null;
        }
        return selectedWorker?.id ? { type: 'WORKER', id: selectedWorker.id, name: selectedWorker.name } : null;
    }, [mode, selectedTeam, selectedWorker]);

    const selectTargetFromAssignment = (assignment: CardAssignmentRecord) => {
        if (assignment.assigneeType === 'TEAM') {
            setMode('TEAM');
            setSelectedTeamId(assignment.assigneeId);
            return;
        }

        setMode('WORKER');
        setSelectedWorkerId(assignment.assigneeId);
        const assignedWorker = workers.find((worker) => String(worker.id) === String(assignment.assigneeId));
        if (assignedWorker?.teamId) setSelectedTeamId(assignedWorker.teamId);
        if (!assignedWorker && officeStaffOptions.some((staff) => String(staff.id) === String(assignment.assigneeId))) {
            setSelectedTeamId(officeStaffOptions[0]?.teamId ?? '');
        }
    };

    const getStatusBadge = (status: Card['status']) => {
        if (status === 'ASSIGNED') {
            return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">사용중</span>;
        }
        if (status === 'AVAILABLE') {
            return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">대기</span>;
        }
        if (status === 'SUSPENDED') {
            return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-50 text-orange-700 border border-orange-100">정지</span>;
        }
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 text-white border border-slate-800">해지</span>;
    };

    const handleAssign = async () => {
        if (!selectedCard || !selectedCard.id) {
            toast.error('카드를 선택해주세요.');
            return;
        }

        if (!startDate) {
            toast.error('배정 시작일을 입력해주세요.');
            return;
        }
        const normalizedStartDate = normalizeTypedDateInput(startDate);
        if (!normalizedStartDate) {
            toast.error('배정 시작일을 올바른 날짜로 입력해주세요.');
            return;
        }
        setStartDate(toShortYearDateInputValue(normalizedStartDate));

        const isAssigned = hasActiveCardAssignment(selectedCard);
        if (!editingAssignment && isAssigned && !autoUnassignExisting) {
            toast.error('이미 배정된 카드입니다. 기존 배정 자동 해제를 선택해주세요.');
            return;
        }

        if (!selectedTarget) {
            toast.error(mode === 'TEAM' ? '팀을 선택해주세요.' : '작업자를 선택해주세요.');
            return;
        }

        const confirmMessage = `${selectedCard.name} 카드를 ${selectedTarget.name}${selectedTarget.type === 'TEAM' ? '(팀)' : '(개인)'}에 ${displayDate(normalizedStartDate)}부터 배정할까요?`;
        const result = await showConfirmAlert('카드 배정', confirmMessage);
        if (!result.isConfirmed) return;

        setSaving(true);
        try {
            if (editingAssignment) {
                await cardService.updateCardAssignment({
                    ...editingAssignment,
                    cardId: selectedCard.id,
                    cardLabel: `${selectedCard.name} (${selectedCard.last4})`,
                    assigneeId: selectedTarget.id,
                    assigneeType: selectedTarget.type,
                    assigneeName: selectedTarget.name,
                    startDate: normalizedStartDate
                });
                toast.success('카드 배정일이 수정되었습니다.');
                setEditingAssignmentId(null);
            } else {
                await cardService.assignCard(selectedCard.id, selectedTarget.id, selectedTarget.type, selectedTarget.name, normalizedStartDate);
                toast.success('카드 배정이 완료되었습니다.');
            }
            await loadAssignmentRecords();
            onRefresh();
        } catch (e: unknown) {
            console.error(e);
            if (isDeadlineExceededError(e)) {
                toast.delayed(editingAssignment ? '카드 배정 수정' : '카드 배정');
                await loadAssignmentRecords().catch((reloadError) => console.error(reloadError));
                onRefresh();
                return;
            }
            const message = getFriendlyErrorMessage(e, '카드 배정에 실패했습니다.');
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    const handleUnassign = async (card: Card) => {
        const result = await showConfirmAlert('카드 배정 해제', `${card.name} 카드 배정을 해제할까요?`);
        if (!result.isConfirmed) return;

        setSaving(true);
        try {
            const endDate = toDateInputValue(new Date());
            await cardService.unassignCard(card.id, endDate);
            toast.success('배정 해제되었습니다.');
            await loadAssignmentRecords();
            onRefresh();
        } catch (e: unknown) {
            console.error(e);
            if (isDeadlineExceededError(e)) {
                toast.delayed('카드 배정 해제');
                await loadAssignmentRecords().catch((reloadError) => console.error(reloadError));
                onRefresh();
                return;
            }
            const message = getFriendlyErrorMessage(e, '배정 해제에 실패했습니다.');
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    const handleQuickPick = (card: Card) => {
        setSelectedCardId(card.id);
        setEditingAssignmentId(null);
        const latestAssignment = assignmentRecords
            .filter((record) => String(record.cardId) === String(card.id))
            .sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')))[0];

        if (latestAssignment) {
            selectTargetFromAssignment(latestAssignment);
            setStartDate(displayDate(latestAssignment.startDate) || today);
            return;
        }

        if (card.currentAssigneeType && card.currentAssigneeId && card.currentAssigneeName) {
            selectTargetFromAssignment({
                id: '',
                cardId: card.id,
                cardLabel: `${card.name} (${card.last4})`,
                assigneeId: card.currentAssigneeId,
                assigneeType: card.currentAssigneeType,
                assigneeName: card.currentAssigneeName,
                startDate: toDateInputValue(new Date())
            });
        }
    };

    const handleCardSelect = (cardId: string) => {
        const card = cardsById.get(String(cardId));
        if (card) {
            handleQuickPick(card);
            return;
        }
        setSelectedCardId(cardId);
    };

    useEffect(() => {
        if (!initialCardId) return;
        const initialCard = cardsById.get(String(initialCardId));
        if (initialCard) {
            handleQuickPick(initialCard);
            return;
        }
        setSelectedCardId(String(initialCardId));
    }, [initialCardId, cardsById, workers, assignmentRecords]);

    const handleEditAssignment = (assignment: CardAssignmentRecord) => {
        setSelectedCardId(assignment.cardId);
        setEditingAssignmentId(assignment.id);
        selectTargetFromAssignment(assignment);
        setStartDate(displayDate(assignment.startDate) || today);
    };

    const handleCancelEditAssignment = () => {
        setEditingAssignmentId(null);
        if (selectedCard) {
            const latestAssignment = selectedCardAssignments[0];
            if (latestAssignment) {
                selectTargetFromAssignment(latestAssignment);
                setStartDate(displayDate(latestAssignment.startDate) || today);
            } else {
                setStartDate(today);
            }
        }
    };

    if (loading) {
        return (
            <div className="h-64 flex items-center justify-center text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                            <span className="bg-indigo-600 text-white w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                <FontAwesomeIcon icon={faUsers} className="text-sm" />
                            </span>
                            카드 배정
                        </h2>
                        <p className="text-slate-500 mt-2 font-medium ml-12 text-sm">팀/개인 단위로 카드를 배정하거나, 배정을 해제할 수 있습니다.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={handleAssign}
                            disabled={saving}
                            className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2 ${saving ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5'
                                }`}
                        >
                            <FontAwesomeIcon icon={faCreditCard} />
                            {saving ? '처리 중...' : editingAssignmentId ? '배정일 수정' : selectedCard && hasActiveCardAssignment(selectedCard) ? '배정 변경' : '카드 배정'}
                        </button>
                        {editingAssignmentId && (
                            <button
                                type="button"
                                onClick={handleCancelEditAssignment}
                                disabled={saving}
                                className="px-5 py-2.5 rounded-xl font-bold text-sm bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 disabled:text-slate-400 transition-all flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                                수정 취소
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-4">
                    <div className="xl:col-span-12 space-y-3">
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button
                                onClick={() => setMode('TEAM')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'TEAM' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <FontAwesomeIcon icon={faUsers} className="mr-2" /> 팀
                            </button>
                            <button
                                onClick={() => setMode('WORKER')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'WORKER' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'
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
                                    onChange={(e) => handleCardSelect(e.target.value)}
                                >
                                    <option value="">카드를 선택하세요</option>
                                    {cards
                                        .slice()
                                        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko-KR'))
                                        .map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} ({c.last4}) · {assignmentLabel(c)}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            {mode === 'TEAM' && (
                                <div className="relative">
                                    <label className="block text-xs font-bold text-slate-600 mb-1">팀 선택</label>
                                    {selectedTeam && (
                                        <span
                                            className="pointer-events-none absolute left-3 top-9 h-3 w-3 rounded-full border border-white shadow-sm"
                                            style={{ backgroundColor: selectedTeamColor }}
                                        />
                                    )}
                                    <select
                                        className={`w-full rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700 ${selectedTeam ? 'pl-8 pr-3' : 'px-3'}`}
                                        value={selectedTeamId}
                                        onChange={(e) => setSelectedTeamId(e.target.value)}
                                        style={selectedTeam ? {
                                            borderColor: hexToRgba(selectedTeamColor, 0.35),
                                            backgroundColor: hexToRgba(selectedTeamColor, 0.05),
                                            color: selectedTeamColor
                                        } : undefined}
                                    >
                                        {teams
                                            .slice()
                                            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko-KR'))
                                            .map((t) => (
                                                <option key={t.id} value={t.id} style={{ color: normalizeHexColor(t.color) }}>
                                                    {t.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            )}

                            {mode === 'WORKER' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">작업자 선택</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700"
                                        value={selectedWorkerId}
                                        onChange={(e) => setSelectedWorkerId(e.target.value)}
                                    >
                                        {filteredWorkers
                                            .slice()
                                            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko-KR'))
                                            .map((w) => (
                                                <option key={w.id} value={w.id}>
                                                    {w.name}{w.detail ? ` (${w.detail})` : w.teamName ? ` (${w.teamName})` : ''}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">배정 시작일</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={10}
                                        placeholder="YY-MM-DD"
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700"
                                        value={startDate}
                                        onChange={(e) => handleStartDateChange(e.target.value)}
                                        onBlur={normalizeStartDate}
                                    />
                                </div>
                                <div className="flex items-end">
                                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={autoUnassignExisting}
                                            onChange={(e) => setAutoUnassignExisting(e.target.checked)}
                                        />
                                        기존 배정 자동 해제
                                    </label>
                                </div>
                            </div>
                        </div>

                        {selectedCard && (
                            <div className="bg-white p-4 rounded-2xl border border-slate-200">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-xs text-slate-500 font-bold">선택 카드</div>
                                        <div className="text-lg font-extrabold text-slate-900">{selectedCard.name} ({selectedCard.last4})</div>
                                        <div className="text-sm text-slate-500 font-medium mt-1">{selectedCard.issuer} · {selectedCard.maskedNumber} · {assignmentLabel(selectedCard)}</div>
                                    </div>
                                    {hasActiveCardAssignment(selectedCard) && (
                                        <button
                                            type="button"
                                            onClick={() => handleUnassign(selectedCard)}
                                            disabled={saving}
                                            className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:bg-slate-100 disabled:text-slate-400 inline-flex items-center gap-2"
                                        >
                                            <FontAwesomeIcon icon={faArrowRightFromBracket} />
                                            배정 해제
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {selectedCard && (
                            <details open={Boolean(editingAssignmentId)} className="group bg-white rounded-2xl border border-slate-200">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                                    <span className="font-extrabold text-slate-800">배정 이력</span>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-500">
                                        {selectedCardAssignments.length}건
                                    </span>
                                </summary>
                                <div className="border-t border-slate-100 p-4">
                                {assignmentRecordsLoading ? (
                                    <div className="text-sm text-slate-400">불러오는 중...</div>
                                ) : selectedCardAssignments.length === 0 ? (
                                    <div className="text-sm text-slate-400">등록된 배정 이력이 없습니다.</div>
                                ) : (
                                    <div className="space-y-2 max-h-[220px] overflow-y-auto">
                                        {selectedCardAssignments.map((record) => (
                                            <div key={record.id} className="rounded-xl border border-slate-100 p-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="font-extrabold text-slate-800 truncate">{record.assigneeName}</div>
                                                        <div className="text-xs text-slate-500 mt-1">
                                                            {record.assigneeType === 'TEAM' ? '팀' : '개인'} · {displayDate(record.startDate)} ~ {displayDate(record.endDate) || '계속'}
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditAssignment(record)}
                                                        disabled={saving}
                                                        className="shrink-0 w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:text-slate-300"
                                                        title="배정일 수정"
                                                    >
                                                        <FontAwesomeIcon icon={faPen} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                </div>
                            </details>
                        )}
                    </div>

                    <div className="hidden">
                        <div className="bg-white p-4 rounded-2xl border border-slate-200">
                            <h3 className="font-extrabold text-slate-800 mb-3">배정 가능 카드</h3>
                            <div className="space-y-2 max-h-[360px] overflow-y-auto">
                                {availableCards.length === 0 ? (
                                    <div className="text-sm text-slate-400">배정 가능한 카드가 없습니다.</div>
                                ) : (
                                    availableCards.map((c) => (
                                        <button
                                            key={c.id}
                                            onClick={() => handleQuickPick(c)}
                                            className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="font-extrabold text-slate-800">{c.name} ({c.last4})</div>
                                                {getStatusBadge(getEffectiveCardStatus(c))}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1 font-mono">{c.maskedNumber}</div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-200">
                            <h3 className="font-extrabold text-slate-800 mb-3">배정된 카드</h3>
                            <div className="space-y-2 max-h-[360px] overflow-y-auto">
                                {assignedCards.length === 0 ? (
                                    <div className="text-sm text-slate-400">배정된 카드가 없습니다.</div>
                                ) : (
                                    assignedCards.map((c) => (
                                        <div
                                            key={c.id}
                                            className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition"
                                        >
                                            <div className="flex items-center justify-between">
                                                <button onClick={() => handleQuickPick(c)} className="text-left">
                                                    <div className="font-extrabold text-slate-800">{c.name} ({c.last4})</div>
                                                    <div className="text-xs text-slate-500 mt-1">{c.currentAssigneeName || '-'}</div>
                                                </button>
                                                <div className="flex items-center gap-2">
                                                    {getStatusBadge(getEffectiveCardStatus(c))}
                                                    <button
                                                        onClick={() => handleUnassign(c)}
                                                        disabled={saving}
                                                        className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 inline-flex items-center gap-2"
                                                    >
                                                        <FontAwesomeIcon icon={faArrowRightFromBracket} />
                                                        배정 해제
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
