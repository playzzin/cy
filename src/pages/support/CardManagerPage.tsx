import React, { useState, useEffect } from 'react';
import { Card } from '../../types/card';
import { cardService } from '../../services/cardService';
import { teamService, Team } from '../../services/teamService';
import { companyService } from '../../services/companyService';
import { CardForm } from '../../components/card/CardForm';
import { CardAssignmentManager } from '../../components/card/CardAssignmentManager';
import { CardBillingManager } from '../../components/card/CardBillingManager';
import { CardStatusBoard } from '../../components/card/CardStatusBoard';
import { CardMonthlyLedger } from '../../components/card/CardMonthlyLedger';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCreditCard, faChartPie, faTable, faRotateRight, faCircleExclamation, faTimes } from '@fortawesome/free-solid-svg-icons';

export const CardManagerPage: React.FC = () => {
    // Data State
    const [cards, setCards] = useState<Card[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // Team Search State
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectableTeams, setSelectableTeams] = useState<Team[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');

    // Tab State
    const [activeTab, setActiveTab] = useState<'status' | 'ledger'>('status');
    const [showBillingPanel, setShowBillingPanel] = useState(false);

    // Modal State
    const [isCardFormOpen, setIsCardFormOpen] = useState(false);
    const [editingCard, setEditingCard] = useState<Card | null>(null);
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [assignmentInitialCardId, setAssignmentInitialCardId] = useState<string | null>(null);

    // 데이터 로드 함수
    const loadData = async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [cardList, teamList, companies] = await Promise.all([
                cardService.getCards(),
                teamService.getTeams(),
                companyService.getCompanies()
            ]);
            // Filter teams (Cheongyeon Only)
            const cheongyeonCompanies = companies.filter(c => c.name.includes('청연'));
            const cheongyeonIdSet = new Set(cheongyeonCompanies.map(c => c.id).filter(id => !!id));
            const cheongyeonNameSet = new Set(cheongyeonCompanies.map(c => c.name));
            const allowedTeams = teamList.filter(t => {
                if (t.companyId && cheongyeonIdSet.has(t.companyId)) return true;
                if (t.companyName && cheongyeonNameSet.has(t.companyName)) return true;
                return false;
            }).sort((a, b) => a.name.localeCompare(b.name));
            setCards(cardList);
            setTeams(teamList.sort((a, b) => a.name.localeCompare(b.name)));
            setSelectableTeams(allowedTeams);
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
        if (!selectedTeamId) return cards;
        const selectedTeam = teams.find(t => String(t.id) === String(selectedTeamId));
        return cards.filter(c => {
            // 1. Directly assigned to Team
            if (c.currentAssigneeType === 'TEAM' && String(c.currentAssigneeId) === String(selectedTeamId)) return true;
            // 2. Assigned to Team Leader (Heuristic)
            if (c.currentAssigneeType === 'WORKER' && selectedTeam?.leaderId && String(c.currentAssigneeId) === String(selectedTeam.leaderId)) return true;
            return false;
        });
    }, [cards, selectedTeamId, teams]);

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
        setAssignmentInitialCardId(String(card.id));
        setIsAssignmentModalOpen(true);
    };

    const closeCardForm = () => {
        setIsCardFormOpen(false);
        setEditingCard(null);
    };

    const handleCardFormSuccess = () => {
        closeCardForm();
        handleRefresh();
    };

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-full">
            {/* Header 섹션 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">
                        <FontAwesomeIcon icon={faCreditCard} className="text-white text-xl" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">카드 통합관리</h1>
                        <p className="text-sm text-slate-500 font-medium">카드 배정 현황 및 카드값 내역을 관리합니다.</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRefresh}
                        className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200"
                        title="새로고침"
                    >
                        <FontAwesomeIcon icon={faRotateRight} className={loading ? 'spin' : ''} />
                    </button>
                    <button
                        onClick={openCreateCard}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        <span>카드 신규등록</span>
                    </button>
                </div>
            </div>

            {/* 필터 및 탭 섹션 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('status')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'status' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <FontAwesomeIcon icon={faChartPie} className="mr-2" />
                        배정 및 청구현황
                    </button>
                    <button
                        onClick={() => setActiveTab('ledger')}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'ledger' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <FontAwesomeIcon icon={faTable} className="mr-2" />
                        카드 통합관리대장
                    </button>
                </div>

                <div className="flex items-center gap-3 px-2">
                    <span className="text-sm font-bold text-slate-500">팀별 필터:</span>
                    <select
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block w-48 p-2 outline-none"
                    >
                        <option value="">전체 팀 보기</option>
                        {teams.map(team => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 메인 콘텐츠 영역 */}
            <div className="min-h-0 flex-1">
                {loadError ? (
                    <div className="bg-rose-50 border border-rose-100 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                        <FontAwesomeIcon icon={faCircleExclamation} className="text-rose-500 text-3xl mb-3" />
                        <h3 className="text-rose-900 font-bold mb-1">데이터 로드 에러</h3>
                        <p className="text-rose-600 text-sm">{loadError}</p>
                        <button onClick={handleRefresh} className="mt-4 px-4 py-2 bg-rose-100 text-rose-700 rounded-xl text-sm font-bold hover:bg-rose-200 transition-all">다시 시도</button>
                    </div>
                ) : activeTab === 'status' ? (
                    <div className="space-y-6">
                        <CardStatusBoard
                            cards={filteredCards}
                            teams={teams}
                            loading={loading}
                            onEdit={openEditCard}
                            onAssign={openAssignCard}
                            onOpenBilling={() => {
                                setShowBillingPanel(true);
                            }}
                        />

                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-extrabold text-slate-900">카드 청구관리</h2>
                                    <p className="text-sm text-slate-500 font-medium mt-1">
                                        현황판에서 배정 상태를 확인한 뒤 청구서를 생성/수정하세요.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowBillingPanel((prev) => !prev)}
                                    className="px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                                >
                                    {showBillingPanel ? '청구관리 접기' : '청구관리 열기'}
                                </button>
                            </div>
                            {showBillingPanel && (
                                <div className="mt-4 pt-4 border-t border-slate-200">
                                    <CardBillingManager cards={filteredCards} loadingCards={loading} onRefreshCards={handleRefresh} />
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <CardMonthlyLedger cards={filteredCards} loadingCards={loading} />
                )}
            </div>

            {/* Modals */}
            {isAssignmentModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto relative animate-fade-in-up">
                        <div className="sticky top-0 z-10 bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">카드 배정 관리</h2>
                            <button
                                onClick={() => setIsAssignmentModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>
                        <div className="p-6">
                            <CardAssignmentManager
                                cards={cards}
                                loading={loading}
                                initialCardId={assignmentInitialCardId}
                                selectableTeams={selectableTeams}
                                onRefresh={handleRefresh}
                                onEditCard={(card) => {
                                    setIsAssignmentModalOpen(false);
                                    openEditCard(card);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {isCardFormOpen && (
                <CardForm
                    initialData={editingCard}
                    onClose={closeCardForm}
                    onSuccess={handleCardFormSuccess}
                />
            )}
        </div>
    );
};
