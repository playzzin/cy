import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../types/card';
import { cardService } from '../../services/cardService';
import { teamService, Team } from '../../services/teamService';
import { companyService } from '../../services/companyService';
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
import { supportCancellationLogService } from '../../services/supportCancellationLogService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCreditCard, faChartPie, faTable, faRotateRight, faCircleExclamation, faHistory, faSearch } from '@fortawesome/free-solid-svg-icons';
import { buildCheongyeonEngTeams } from '../../utils/cheongyeonTeams';
import { appendOfficeAssignmentTeam, isOfficeAssignmentTeam, isOfficeStaffAssignmentReference } from '../../utils/supportAssignmentTargets';

interface CardManagerPageProps {
    embedded?: boolean;
}

export const CardManagerPage: React.FC<CardManagerPageProps> = ({ embedded = false }) => {
    const navigate = useNavigate();
    // Data State
    const [cards, setCards] = useState<Card[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // Team Search State
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectableTeams, setSelectableTeams] = useState<Team[]>([]);
    const [assignableTeams, setAssignableTeams] = useState<Team[]>([]);
    const [officeStaffRows, setOfficeStaffRows] = useState<OfficeStaff[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');

    // Tab State
    const [activeTab, setActiveTab] = useState<'status' | 'ledger' | 'history'>('status');

    // Modal State
    const [isCardFormOpen, setIsCardFormOpen] = useState(false);
    const [editingCard, setEditingCard] = useState<Card | null>(null);
    const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
    const [setupInitialCardId, setSetupInitialCardId] = useState<string | null>(null);
    const [setupInitialSection, setSetupInitialSection] = useState<AssignmentBillingSection>('assignment');
    const [billingTargetInitialSplitMode, setBillingTargetInitialSplitMode] = useState(false);
    const [cancellationTarget, setCancellationTarget] = useState<Card | null>(null);
    const [savingCancellation, setSavingCancellation] = useState(false);

    // 데이터 로드 함수
    const loadData = async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [cardList, teamList, companies, officeStaffList] = await Promise.all([
                cardService.getCards(),
                teamService.getTeams(),
                companyService.getCompanies(),
                officeStaffService.getOfficeStaff().catch(() => [] as OfficeStaff[])
            ]);
            const allowedTeams = buildCheongyeonEngTeams(teamList, companies);
            const sortedTeams = teamList
                .slice()
                .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko-KR'));
            setCards(cardList);
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

    // 카드 필터링
    const filteredCards = React.useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        const selectedTeam = teams.find(t => String(t.id) === String(selectedTeamId));
        const selectedTeamIsOffice = isOfficeAssignmentTeam(selectedTeam);
        return cards.filter(c => {
            const teamMatches = !selectedTeamId
                || (c.currentAssigneeType === 'TEAM' && String(c.currentAssigneeId) === String(selectedTeamId))
                || (c.currentAssigneeType === 'WORKER' && selectedTeam?.leaderId && String(c.currentAssigneeId) === String(selectedTeam.leaderId))
                || (
                    selectedTeamIsOffice &&
                    c.currentAssigneeType === 'WORKER' &&
                    isOfficeStaffAssignmentReference(officeStaffRows, c.currentAssigneeId, c.currentAssigneeName)
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
    }, [cards, selectedTeamId, teams, searchTerm, officeStaffRows]);

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
        setSetupInitialCardId(String(card.id));
        setSetupInitialSection('assignment');
        setBillingTargetInitialSplitMode(false);
        setIsSetupModalOpen(true);
    };

    const openBillingTargetCard = (card: Card, options?: { split?: boolean }) => {
        setSetupInitialCardId(String(card.id));
        setSetupInitialSection('billing');
        setBillingTargetInitialSplitMode(Boolean(options?.split));
        setIsSetupModalOpen(true);
    };

    const openCancellationModal = (card: Card) => {
        setCancellationTarget(card);
    };

    const getCancellationStatusAfter = (reason: SupportCancellationFormValue['reason']): Card['status'] => {
        if (reason === 'CARD_SUSPENDED' || reason === 'CARD_LOST') return 'SUSPENDED';
        return 'CLOSED';
    };

    const handleCancellationSubmit = async (form: SupportCancellationFormValue) => {
        if (!cancellationTarget) return;
        const card = cancellationTarget;
        const statusAfter = getCancellationStatusAfter(form.reason);
        setSavingCancellation(true);

        try {
            const activeBillingTargets = (await cardService.listAllCardBillingTargets(card.id))
                .filter((target) => !String(target.endDate ?? '').trim());

            if (card.currentAssigneeId || card.currentAssigneeName) {
                await cardService.unassignCard(card.id, form.processedDate);
            }

            if (activeBillingTargets.length > 0) {
                await cardService.applyCardBillingTargetChanges({
                    cardId: card.id,
                    closeRecords: activeBillingTargets.map((target) => ({ id: target.id, endDate: form.processedDate })),
                    clearSnapshot: true
                });
            }

            await cardService.updateCard(card.id, {
                status: statusAfter,
                currentAssigneeId: null,
                currentAssigneeType: null,
                currentAssigneeName: null,
                billingTargetId: null,
                billingTargetType: null,
                billingTargetName: null
            } as unknown as Partial<Card>);

            await supportCancellationLogService.createLog({
                resourceType: 'card',
                resourceId: card.id,
                resourceLabel: card.name || card.maskedNumber || '카드',
                reason: form.reason,
                reasonLabel: form.reasonLabel,
                processedDate: form.processedDate,
                statusBefore: card.status,
                statusAfter,
                assigneeName: card.currentAssigneeName,
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
            setActiveTab('history');
            handleRefresh();
        } catch (error) {
            console.error('Failed to process card cancellation', error);
            window.alert('카드 사용취소 처리 중 오류가 발생했습니다.');
        } finally {
            setSavingCancellation(false);
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
        <div className={`${embedded ? 'space-y-5 sm:space-y-6 bg-transparent min-h-full w-full min-w-0 max-w-full overflow-x-hidden' : 'p-3 sm:p-6 space-y-5 sm:space-y-6 bg-slate-50 min-h-full w-full max-w-[calc(100vw-30px)] sm:max-w-full min-w-0 overflow-x-hidden'}`}>
            {/* Header 섹션 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="shrink-0 p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">
                        <FontAwesomeIcon icon={faCreditCard} className="text-white text-xl" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">카드 통합관리</h1>
                        <p className="text-sm text-slate-500 font-medium">카드 배정 현황 및 카드값 내역을 관리합니다.</p>
                    </div>
                </div>

                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <button
                        onClick={() => navigate('/support/cards/logs')}
                        className="flex flex-1 items-center justify-center gap-2 px-4 py-2.5 bg-white text-slate-700 rounded-xl font-bold hover:text-indigo-700 hover:border-indigo-200 transition-all border border-slate-200 shadow-sm sm:flex-none"
                    >
                        <FontAwesomeIcon icon={faHistory} />
                        <span>청구 로그</span>
                    </button>
                    <button
                        onClick={handleRefresh}
                        className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200"
                        aria-label="새로고침"
                        title="새로고침"
                    >
                        <FontAwesomeIcon icon={faRotateRight} className={loading ? 'spin' : ''} />
                    </button>
                    <button
                        onClick={openCreateCard}
                        className="flex flex-1 items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 sm:flex-none"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        <span>카드 신규등록</span>
                    </button>
                </div>
            </div>

            {/* 필터 및 탭 섹션 */}
            <div className="flex max-w-full flex-col gap-2 overflow-hidden bg-white p-2 rounded-2xl border border-slate-200 shadow-sm xl:flex-row xl:items-center">
                <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center">
                    <div className="support-scroll-x w-full lg:w-auto lg:shrink-0">
                        <div className="support-scroll-inner flex p-1 bg-slate-100 rounded-xl">
                            <button
                                onClick={() => setActiveTab('status')}
                                className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold transition-all sm:px-6 ${activeTab === 'status' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <FontAwesomeIcon icon={faChartPie} className="mr-2" />
                                배정 및 청구현황
                            </button>
                            <button
                                onClick={() => setActiveTab('ledger')}
                                className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold transition-all sm:px-6 ${activeTab === 'ledger' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <FontAwesomeIcon icon={faTable} className="mr-2" />
                                카드 통합관리대장
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold transition-all sm:px-6 ${activeTab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <FontAwesomeIcon icon={faHistory} className="mr-2" />
                                처리내역
                            </button>
                        </div>
                    </div>

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
                        <button onClick={handleRefresh} className="mt-4 px-4 py-2 bg-rose-100 text-rose-700 rounded-xl text-sm font-bold hover:bg-rose-200 transition-all">다시 시도</button>
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
                    <SupportCancellationHistory
                        resourceType="card"
                        title="카드 사용취소 처리내역"
                    />
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
