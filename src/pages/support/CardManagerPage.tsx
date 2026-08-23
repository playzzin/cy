import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../types/card';
import { cardService } from '../../services/cardService';
import { teamService, Team } from '../../services/teamService';
import { companyService } from '../../services/companyService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { OfficeStaff, officeStaffService } from '../../services/officeStaffService';
import { CardForm } from '../../components/card/CardForm';
import { CardAssignmentManager } from '../../components/card/CardAssignmentManager';
import { CardBillingTargetManager } from '../../components/card/CardBillingTargetManager';
import { CardStatusBoard } from '../../components/card/CardStatusBoard';
import { CardMonthlyLedger } from '../../components/card/CardMonthlyLedger';
import { AssignmentBillingSetupModal, type AssignmentBillingSection } from '../../components/support/AssignmentBillingSetupModal';
import { SupportTeamFilterTabs } from '../../components/support/SupportTeamFilterTabs';
import { SupportCancellationHistory } from '../../components/support/SupportCancellationHistory';
import { SupportCancellationModal, type SupportCancellationFormValue } from '../../components/support/SupportCancellationModal';
import { SupportPageHeader } from '../../components/support/SupportPageHeader';
import { SupportSegmentedTabs, type SupportSegmentedTabOption } from '../../components/support/SupportSegmentedTabs';
import {
    createCardLifecycleOperationId,
    formatKoreanBusinessDate,
    isInactiveCardStatus,
} from '../../services/cardLifecyclePolicy';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCreditCard, faChartPie, faTable, faRotateLeft, faRotateRight, faCircleExclamation, faHistory, faSearch } from '@fortawesome/free-solid-svg-icons';
import { buildCheongyeonEngTeams } from '../../utils/cheongyeonTeams';
import { appendOfficeAssignmentTeam, isOfficeAssignmentReference, isOfficeAssignmentTeam, isOfficeStaffAssignmentReference } from '../../utils/supportAssignmentTargets';

interface CardManagerPageProps {
    embedded?: boolean;
    initialTab?: CardTabId;
    onTabChange?: (tab: CardTabId) => void;
}

type CardTabId = 'status' | 'ledger' | 'history';

const cardTabs: SupportSegmentedTabOption<CardTabId>[] = [
    { id: 'status', label: '배정·경비현황', icon: faChartPie },
    { id: 'ledger', label: '통합관리대장', icon: faTable },
    { id: 'history', label: '처리내역', icon: faHistory }
];

const normalizeKey = (value: unknown): string => String(value ?? '').trim();

export const CardManagerPage: React.FC<CardManagerPageProps> = ({
    embedded = false,
    initialTab = 'status',
    onTabChange,
}) => {
    const navigate = useNavigate();
    // Data State
    const [cards, setCards] = useState<Card[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // Team Search State
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [selectableTeams, setSelectableTeams] = useState<Team[]>([]);
    const [assignableTeams, setAssignableTeams] = useState<Team[]>([]);
    const [officeStaffRows, setOfficeStaffRows] = useState<OfficeStaff[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');

    // Tab State
    const [activeTab, setActiveTab] = useState<CardTabId>(initialTab);

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    const handleTabChange = (tab: CardTabId) => {
        setActiveTab(tab);
        onTabChange?.(tab);
    };

    // Modal State
    const [isCardFormOpen, setIsCardFormOpen] = useState(false);
    const [editingCard, setEditingCard] = useState<Card | null>(null);
    const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
    const [restoringCardId, setRestoringCardId] = useState<string | null>(null);
    const [setupInitialCardId, setSetupInitialCardId] = useState<string | null>(null);
    const [setupInitialSection, setSetupInitialSection] = useState<AssignmentBillingSection>('assignment');
    const [billingTargetInitialSplitMode, setBillingTargetInitialSplitMode] = useState(false);
    const [cancellationTarget, setCancellationTarget] = useState<Card | null>(null);
    const [savingCancellation, setSavingCancellation] = useState(false);
    const lifecycleInFlightRef = useRef<Set<string>>(new Set());

    // 데이터 로드 함수
    const loadData = async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [cardList, teamList, companies, officeStaffList, workerList] = await Promise.all([
                cardService.getCards(),
                teamService.getTeams(),
                companyService.getCompanies(),
                officeStaffService.getOfficeStaff().catch(() => [] as OfficeStaff[]),
                manpowerService.getWorkers().catch(() => [] as Worker[])
            ]);
            const allowedTeams = buildCheongyeonEngTeams(teamList, companies);
            const sortedTeams = teamList
                .slice()
                .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko-KR'));
            setCards(cardList);
            setWorkers(workerList);
            setTeams(appendOfficeAssignmentTeam(sortedTeams, sortedTeams));
            setSelectableTeams(allowedTeams);
            setAssignableTeams(appendOfficeAssignmentTeam(allowedTeams, sortedTeams));
            setOfficeStaffRows(officeStaffList);
        } catch (error) {
            console.error("Failed to load data", error);
            setLoadError(error instanceof Error ? error.message : "카드 목록을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [refreshKey]);

    const teamByAnyId = React.useMemo(() => {
        const map = new Map<string, Team>();
        teams.forEach((team) => {
            const id = normalizeKey(team.id);
            const legacyId = normalizeKey(team.legacyId);
            if (id) map.set(id, team);
            if (legacyId) map.set(legacyId, team);
        });
        return map;
    }, [teams]);

    const teamByName = React.useMemo(() => {
        const map = new Map<string, Team>();
        teams.forEach((team) => {
            const name = normalizeKey(team.name);
            if (name && !map.has(name)) map.set(name, team);
        });
        return map;
    }, [teams]);

    const workerByAnyId = React.useMemo(() => {
        const map = new Map<string, Worker>();
        workers.forEach((worker) => {
            [worker.id, worker.legacyId, worker.uid].forEach((key) => {
                const normalized = normalizeKey(key);
                if (normalized) map.set(normalized, worker);
            });
        });
        return map;
    }, [workers]);

    const workerByName = React.useMemo(() => {
        const map = new Map<string, Worker>();
        workers.forEach((worker) => {
            const name = normalizeKey(worker.name);
            if (name && !map.has(name)) map.set(name, worker);
        });
        return map;
    }, [workers]);

    const selectedTeamIdentity = React.useMemo(() => {
        const selectedId = normalizeKey(selectedTeamId);
        const selectedTeam = teamByAnyId.get(selectedId) ?? teamByName.get(selectedId) ?? null;
        const ids = new Set(
            [selectedId, selectedTeam?.id, selectedTeam?.legacyId]
                .map((value) => normalizeKey(value))
                .filter(Boolean)
        );
        const names = new Set(
            [selectedTeam?.name]
                .map((value) => normalizeKey(value))
                .filter(Boolean)
        );
        const memberIds = new Set(
            [selectedTeam?.leaderId, ...(selectedTeam?.memberIds ?? [])]
                .map((value) => normalizeKey(value))
                .filter(Boolean)
        );
        const memberNames = new Set(
            [selectedTeam?.leaderName, ...(selectedTeam?.memberNames ?? [])]
                .map((value) => normalizeKey(value))
                .filter(Boolean)
        );

        return {
            team: selectedTeam,
            ids,
            names,
            memberIds,
            memberNames
        };
    }, [selectedTeamId, teamByAnyId, teamByName]);

    // 카드 필터링
    const filteredCards = React.useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        const selectedTeam = selectedTeamIdentity.team;
        const selectedTeamIsOffice = isOfficeAssignmentTeam(selectedTeam);
        return cards.filter(c => {
            const assigneeId = normalizeKey(c.currentAssigneeId);
            const assigneeName = normalizeKey(c.currentAssigneeName);
            const assigneeTeam = c.currentAssigneeType === 'TEAM'
                ? (teamByAnyId.get(assigneeId) ?? teamByName.get(assigneeName))
                : null;
            const isOfficeTeamAssignee = (
                c.currentAssigneeType === 'TEAM' &&
                (
                    isOfficeAssignmentReference(c.currentAssigneeId, c.currentAssigneeName) ||
                    isOfficeAssignmentTeam(assigneeTeam)
                )
            );
            const isOfficeStaffAssignee = (
                c.currentAssigneeType === 'WORKER' &&
                isOfficeStaffAssignmentReference(officeStaffRows, c.currentAssigneeId, c.currentAssigneeName)
            );
            const worker = c.currentAssigneeType === 'WORKER' && !isOfficeStaffAssignee
                ? (workerByAnyId.get(assigneeId) ?? workerByName.get(assigneeName))
                : null;
            const teamMatches = !selectedTeamId
                || (
                    c.currentAssigneeType === 'TEAM' &&
                    !isOfficeTeamAssignee &&
                    (
                        selectedTeamIdentity.ids.has(assigneeId) ||
                        selectedTeamIdentity.names.has(assigneeName) ||
                        selectedTeamIdentity.ids.has(normalizeKey(assigneeTeam?.id)) ||
                        selectedTeamIdentity.ids.has(normalizeKey(assigneeTeam?.legacyId)) ||
                        selectedTeamIdentity.names.has(normalizeKey(assigneeTeam?.name))
                    )
                )
                || (
                    c.currentAssigneeType === 'WORKER' &&
                    !isOfficeStaffAssignee &&
                    (
                        selectedTeamIdentity.memberIds.has(assigneeId) ||
                        selectedTeamIdentity.memberNames.has(assigneeName) ||
                        selectedTeamIdentity.ids.has(normalizeKey(worker?.teamId)) ||
                        selectedTeamIdentity.names.has(normalizeKey(worker?.teamName))
                    )
                )
                || (
                    selectedTeamIsOffice &&
                    (isOfficeTeamAssignee || isOfficeStaffAssignee)
                );

            const searchMatches = !query || [
                c.name,
                c.issuer,
                c.cardType,
                c.maskedNumber,
                c.last4,
                c.expiry,
                c.status,
                c.currentAssigneeName,
                c.billingTargetName,
                c.memo
            ].some(value => String(value ?? '').toLowerCase().includes(query));

            return teamMatches && searchMatches;
        });
    }, [cards, selectedTeamId, selectedTeamIdentity, teamByAnyId, teamByName, workerByAnyId, workerByName, searchTerm, officeStaffRows]);

    const inactiveCards = React.useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        return cards.filter((card) => {
            if (card.status !== 'SUSPENDED' && card.status !== 'CLOSED') return false;
            if (!query) return true;
            return [
                card.name,
                card.issuer,
                card.maskedNumber,
                card.last4,
                card.currentAssigneeName,
                card.memo,
            ].some((value) => String(value ?? '').toLowerCase().includes(query));
        });
    }, [cards, searchTerm]);

    // 핸들러 함수들
    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
    };

    const openCreateCard = () => {
        setEditingCard(null);
        setIsCardFormOpen(true);
    };

    const openEditCard = (card: Card) => {
        setEditingCard(card);
        setIsCardFormOpen(true);
    };

    const openAssignCard = (card: Card) => {
        if (isInactiveCardStatus(card.status)) {
            window.alert('정지·해지 카드는 배정할 수 없습니다. 정지 카드라면 먼저 카드 정지를 해제해주세요.');
            return;
        }
        setSetupInitialCardId(String(card.id));
        setSetupInitialSection('assignment');
        setBillingTargetInitialSplitMode(false);
        setIsSetupModalOpen(true);
    };

    const openBillingTargetCard = (card: Card, options?: { split?: boolean }) => {
        if (isInactiveCardStatus(card.status)) {
            window.alert('정지·해지 카드는 청구대상을 변경할 수 없습니다.');
            return;
        }
        setSetupInitialCardId(String(card.id));
        setSetupInitialSection('billing');
        setBillingTargetInitialSplitMode(Boolean(options?.split));
        setIsSetupModalOpen(true);
    };

    const openCancellationModal = (card: Card) => {
        if (isInactiveCardStatus(card.status)) return;
        setCancellationTarget(card);
    };

    const getCancellationStatusAfter = (
        reason: SupportCancellationFormValue['reason']
    ): Extract<Card['status'], 'SUSPENDED' | 'CLOSED'> => {
        if (reason === 'CARD_SUSPENDED' || reason === 'CARD_LOST') return 'SUSPENDED';
        return 'CLOSED';
    };

    const handleCancellationSubmit = async (form: SupportCancellationFormValue) => {
        if (!cancellationTarget) return;
        const card = cancellationTarget;
        if (isInactiveCardStatus(card.status)) return;
        const inFlightKey = `cancel:${card.id}`;
        if (lifecycleInFlightRef.current.has(inFlightKey)) return;
        const statusAfter = getCancellationStatusAfter(form.reason);
        const operationId = createCardLifecycleOperationId('cancel', card.id);
        lifecycleInFlightRef.current.add(inFlightKey);
        setSavingCancellation(true);

        try {
            await cardService.cancelCardUse({
                cardId: card.id,
                effectiveDate: form.processedDate,
                targetStatus: statusAfter,
                operationId,
                auditLog: {
                    resourceType: 'card',
                    resourceId: card.id,
                    resourceLabel: card.name || card.maskedNumber || '카드',
                    reason: form.reason,
                    reasonLabel: form.reasonLabel,
                    processedDate: form.processedDate,
                    statusBefore: card.status,
                    statusAfter,
                    assigneeName: card.currentAssigneeName ?? undefined,
                    billingTargetName: card.billingTargetName || undefined,
                    settlementAmount: form.settlementAmount,
                    note: form.note,
                    snapshot: {
                        name: card.name,
                        issuer: card.issuer,
                        cardType: card.cardType,
                        maskedNumber: card.maskedNumber,
                        last4: card.last4,
                        expiry: card.expiry,
                        status: card.status,
                        assigneeName: card.currentAssigneeName,
                        billingTargetName: card.billingTargetName
                    }
                },
            });

            if (editingCard?.id === card.id) {
                setIsCardFormOpen(false);
                setEditingCard(null);
            }
            if (setupInitialCardId === String(card.id)) {
                setSetupInitialCardId(null);
                setBillingTargetInitialSplitMode(false);
                setIsSetupModalOpen(false);
            }
            setCancellationTarget(null);
            handleTabChange('history');
            handleRefresh();
        } catch (error) {
            console.error('Failed to process card cancellation', error);
            window.alert('카드 사용취소 처리 중 오류가 발생했습니다.');
        } finally {
            lifecycleInFlightRef.current.delete(inFlightKey);
            setSavingCancellation(false);
        }
    };

    const handleRestoreUse = async (card: Card) => {
        if (card.status !== 'SUSPENDED') return;
        const inFlightKey = `restore:${card.id}`;
        if (lifecycleInFlightRef.current.has(inFlightKey)) return;
        const ok = window.confirm(`${card.name || card.maskedNumber || '카드'}의 카드 정지를 해제하고 다시 사용 가능으로 변경할까요?`);
        if (!ok) return;

        const operationId = createCardLifecycleOperationId('restore', card.id);
        lifecycleInFlightRef.current.add(inFlightKey);
        setRestoringCardId(card.id);
        try {
            const processedDate = formatKoreanBusinessDate();
            await cardService.restoreSuspendedCard({
                cardId: card.id,
                effectiveDate: processedDate,
                operationId,
                auditLog: {
                    resourceType: 'card',
                    resourceId: card.id,
                    resourceLabel: card.name || card.maskedNumber || '카드',
                    reason: 'OTHER',
                    reasonLabel: '카드 정지 해제',
                    processedDate,
                    statusBefore: card.status,
                    statusAfter: 'AVAILABLE',
                    assigneeName: card.currentAssigneeName ?? undefined,
                    billingTargetName: card.billingTargetName || undefined,
                    note: '분실·정지 카드를 다시 사용 가능 상태로 전환',
                    snapshot: {
                        name: card.name,
                        issuer: card.issuer,
                        maskedNumber: card.maskedNumber,
                        last4: card.last4,
                        status: card.status
                    }
                },
            });
            handleRefresh();
        } catch (error) {
            console.error('Failed to restore card status', error);
            window.alert('카드 정지 해제 중 오류가 발생했습니다.');
        } finally {
            lifecycleInFlightRef.current.delete(inFlightKey);
            setRestoringCardId(null);
        }
    };

    const closeCardForm = () => {
        setIsCardFormOpen(false);
        setEditingCard(null);
    };

    const handleCardFormSuccess = () => {
        closeCardForm();
        handleRefresh();
    };

    const closeSetupModal = () => {
        setIsSetupModalOpen(false);
        setBillingTargetInitialSplitMode(false);
    };

    const setupCard = React.useMemo(
        () => cards.find((card) => String(card.id) === String(setupInitialCardId)) ?? null,
        [cards, setupInitialCardId]
    );
    const setupCardAssigneeLabel = React.useMemo(() => {
        if (!setupCard?.currentAssigneeName) return '미배정';
        return `${setupCard.currentAssigneeType === 'TEAM' ? '팀' : '개인'} · ${setupCard.currentAssigneeName}`;
    }, [setupCard]);
    const setupCardBillingLabel = React.useMemo(() => {
        if (!setupCard) return '미설정';
        if (setupCard.billingTargetName) {
            const targetType = setupCard.billingTargetType === 'TEAM'
                ? '팀'
                : setupCard.billingTargetType === 'WORKER'
                    ? '작업자'
                    : setupCard.billingTargetType === 'OFFICE'
                        ? '사무실'
                        : setupCard.billingTargetType === 'OFFICE_STAFF'
                            ? '사무실직원'
                            : '청구대상';
            return `${targetType} · ${setupCard.billingTargetName}`;
        }
        if (setupCard.currentAssigneeName) return '청구 탭에서 확인';
        return '미설정';
    }, [setupCard]);

    return (
        <div className={`${embedded ? 'space-y-3 bg-transparent min-h-full w-full min-w-0 max-w-full overflow-x-hidden' : 'p-3 sm:p-6 space-y-5 sm:space-y-6 bg-slate-50 min-h-full w-full max-w-[calc(100vw-30px)] sm:max-w-full min-w-0 overflow-x-hidden'}`}>
            <SupportPageHeader
                icon={faCreditCard}
                title="카드 통합관리"
                description="카드 배정 현황 및 카드값 내역을 관리합니다."
                tone="violet"
                compact={embedded}
                actions={(
                    <>
                    <button
                        type="button"
                        onClick={() => navigate('/support/cards/logs')}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 font-bold text-slate-700 shadow-sm transition-all hover:border-indigo-200 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:flex-none"
                    >
                        <FontAwesomeIcon icon={faHistory} />
                        <span>청구 로그</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="rounded-lg border border-transparent p-2.5 text-slate-400 transition-all hover:border-slate-200 hover:bg-white hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                        aria-label="새로고침"
                        title="새로고침"
                    >
                        <FontAwesomeIcon icon={faRotateRight} className={loading ? 'spin' : ''} />
                    </button>
                    <button
                        type="button"
                        onClick={openCreateCard}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:scale-95 sm:flex-none"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        <span>카드 신규등록</span>
                    </button>
                    </>
                )}
            />

            {/* 필터 및 탭 섹션 */}
            <div className="flex max-w-full flex-col gap-2 overflow-hidden bg-white p-2 rounded-2xl border border-slate-200 shadow-sm xl:flex-row xl:items-center">
                <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center">
                    <SupportSegmentedTabs
                        options={cardTabs}
                        activeId={activeTab}
                        onChange={handleTabChange}
                        ariaLabel="카드 관리 보기"
                    />

                    <SupportTeamFilterTabs
                        teams={assignableTeams}
                        selectedTeamId={selectedTeamId}
                        onChange={setSelectedTeamId}
                        className="flex-1"
                    />
                </div>

                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end xl:w-auto">
                    <span className="whitespace-nowrap px-1 text-xs font-bold text-slate-400">
                        조회 {filteredCards.length} / {cards.length}
                    </span>

                    <label className="relative block w-full sm:min-w-[240px] xl:w-72">
                        <FontAwesomeIcon icon={faSearch} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            aria-label="카드 검색"
                            placeholder="카드명, 번호, 배정자 검색"
                            className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-indigo-500"
                        />
                    </label>
                </div>
            </div>

            {/* 메인 콘텐츠 영역 */}
            <div className="min-h-0 flex-1 w-full min-w-0">
                {loadError ? (
                    <div className="bg-rose-50 border border-rose-100 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                        <FontAwesomeIcon icon={faCircleExclamation} className="text-rose-500 text-3xl mb-3" />
                        <h3 className="text-rose-900 font-bold mb-1">데이터 로드 에러</h3>
                        <p className="text-rose-600 text-sm">{loadError}</p>
                        <button type="button" onClick={handleRefresh} className="mt-4 rounded-lg bg-rose-100 px-4 py-2 text-sm font-bold text-rose-700 transition-all hover:bg-rose-200">다시 시도</button>
                    </div>
                ) : activeTab === 'status' ? (
                    <CardStatusBoard
                        cards={filteredCards}
                        teams={teams}
                        loading={loading}
                        onEdit={openEditCard}
                        onAssign={openAssignCard}
                        onBillingTargetAssign={openBillingTargetCard}
                        onCancelUse={openCancellationModal}
                        onRestoreUse={handleRestoreUse}
                        restoringCardId={restoringCardId}
                    />
                ) : activeTab === 'ledger' ? (
                    <CardMonthlyLedger
                        cards={filteredCards}
                        teams={teams}
                        loadingCards={loading}
                        onOpenSetup={openAssignCard}
                        onOpenBillingTarget={(card) => openBillingTargetCard(card, { split: true })}
                    />
                ) : (
                    <div className="space-y-5">
                        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-base font-black text-amber-950">정지·해지 카드</h2>
                                    <p className="mt-1 text-sm font-semibold text-amber-800">
                                        분실 카드를 다시 찾은 경우 정지 카드만 해제할 수 있습니다. 해지 카드는 복구할 수 없습니다.
                                    </p>
                                </div>
                                <span className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-xs font-black text-amber-800 shadow-sm">
                                    {inactiveCards.length.toLocaleString('ko-KR')}장
                                </span>
                            </div>

                            {inactiveCards.length > 0 ? (
                                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                    {inactiveCards.map((card) => {
                                        const isRestoring = restoringCardId === card.id;
                                        return (
                                            <div key={card.id} className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="min-w-0">
                                                    <div className="truncate font-black text-slate-900">{card.name || '카드명 미입력'}</div>
                                                    <div className="mt-1 text-xs font-semibold text-slate-500">
                                                        {card.issuer || '발급사 미지정'} · {card.maskedNumber || card.last4 || '카드번호 미입력'} · {card.status === 'SUSPENDED' ? '정지' : '해지'}
                                                    </div>
                                                </div>
                                                {card.status === 'SUSPENDED' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRestoreUse(card)}
                                                        disabled={Boolean(restoringCardId)}
                                                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        <FontAwesomeIcon icon={faRotateLeft} spin={isRestoring} />
                                                        {isRestoring ? '해제 중...' : '카드 정지 해제'}
                                                    </button>
                                                ) : (
                                                    <span className="inline-flex shrink-0 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-500">
                                                        해지 카드 · 복구 불가
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="mt-4 rounded-xl border border-dashed border-amber-200 bg-white/70 px-4 py-6 text-center text-sm font-bold text-amber-700">
                                    현재 정지·해지된 카드가 없습니다.
                                </div>
                            )}
                        </section>

                        <SupportCancellationHistory
                            resourceType="card"
                            title="카드 사용취소 처리내역"
                        />
                    </div>
                )}
            </div>

            {/* Modals */}
            <AssignmentBillingSetupModal
                isOpen={isSetupModalOpen}
                title={setupCard?.name ? `${setupCard.name} 카드` : '카드'}
                subtitle={setupCard ? `${setupCard.issuer || '발급사 미지정'} · ${setupCard.maskedNumber || setupCard.last4 || '카드번호 미입력'}` : '카드 배정과 청구대상을 한 화면에서 설정합니다.'}
                resourceLabel="카드"
                initialSection={setupInitialSection}
                summaryItems={[
                    { label: '현재 배정', value: setupCardAssigneeLabel, tone: setupCard?.currentAssigneeName ? 'indigo' : 'amber' },
                    { label: '현재 청구', value: setupCardBillingLabel, tone: setupCard?.billingTargetName ? 'indigo' : setupCard?.currentAssigneeName ? 'emerald' : 'amber' },
                    { label: '대장 반영', value: '저장 즉시 업데이트', tone: 'emerald' }
                ]}
                ledgerHint="저장하면 카드 현황, 카드 통합관리대장, 월별 청구대장에 바로 반영됩니다."
                onClose={closeSetupModal}
                assignmentContent={(
                    <CardAssignmentManager
                        cards={cards}
                        loading={loading}
                        initialCardId={setupInitialCardId}
                        selectableTeams={assignableTeams}
                        onRefresh={handleRefresh}
                    />
                )}
                billingContent={(
                    <CardBillingTargetManager
                        cards={cards}
                        loading={loading}
                        initialCardId={setupInitialCardId}
                        initialSplitMode={billingTargetInitialSplitMode}
                        selectableTeams={selectableTeams}
                        onRefresh={handleRefresh}
                    />
                )}
            />

            {isCardFormOpen && (
                <CardForm
                    initialData={editingCard}
                    onClose={closeCardForm}
                    onSuccess={handleCardFormSuccess}
                />
            )}

            <SupportCancellationModal
                isOpen={!!cancellationTarget}
                resourceType="card"
                resourceLabel={cancellationTarget?.name || cancellationTarget?.maskedNumber || '카드'}
                resourceDescription={cancellationTarget ? `${cancellationTarget.issuer || '발급사 미지정'} · ${cancellationTarget.maskedNumber || cancellationTarget.last4 || '번호 미입력'} · ${cancellationTarget.currentAssigneeName || '배정자 없음'}` : undefined}
                submitting={savingCancellation}
                onClose={() => setCancellationTarget(null)}
                onSubmit={handleCancellationSubmit}
            />
        </div>
    );
};
