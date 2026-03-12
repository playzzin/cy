import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCreditCard, faPlus, faRotateRight, faTimes } from '@fortawesome/free-solid-svg-icons';
import { CardAssignmentManager } from '../../components/card/CardAssignmentManager';
import { CardBillingManager } from '../../components/card/CardBillingManager';
import { CardForm } from '../../components/card/CardForm';
import { CardMonthlyLedger } from '../../components/card/CardMonthlyLedger';
import { CardStatusBoard } from '../../components/card/CardStatusBoard';
import { cardService } from '../../services/cardService';
import { teamService, Team } from '../../services/teamService';
import { companyService } from '../../services/companyService';
import { Card } from '../../types/card';
import { toast } from '../../utils/swal';

type CardManagerTab = 'status' | 'monthly';

export const CardManagerPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<CardManagerTab>('status');
    const [showBillingPanel, setShowBillingPanel] = useState(false);
    const [cards, setCards] = useState<Card[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectableTeams, setSelectableTeams] = useState<Team[]>([]); // Filtered for assignment
    const [loadingCards, setLoadingCards] = useState<boolean>(false);

    const [editingCard, setEditingCard] = useState<Card | null>(null);
    const [isCardFormOpen, setIsCardFormOpen] = useState<boolean>(false);
    const [assignmentInitialCardId, setAssignmentInitialCardId] = useState<string | null>(null);

    const loadCards = useCallback(async () => {
        setLoadingCards(true);
        try {
            const [list, teamList, companies] = await Promise.all([
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

            setCards(list);
            setTeams(teamList.sort((a, b) => a.name.localeCompare(b.name)));
            setSelectableTeams(allowedTeams);
        } catch (e) {
            console.error(e);
            toast.error('카드 목록을 불러오지 못했습니다. Firestore 설정을 확인해주세요.');
            setCards([]);
        } finally {
            setLoadingCards(false);
        }
    }, []);

    useEffect(() => {
        loadCards();
    }, [loadCards]);

    const refreshCards = useCallback(() => {
        void loadCards();
    }, [loadCards]);

    const tabs = useMemo(
        () =>
            [
                { id: 'status' as const, label: '현황' },
                { id: 'monthly' as const, label: '월별 대장' }
            ],
        []
    );

    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);

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
        void loadCards();
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 xl:p-10">
            <div className="max-w-[1800px] mx-auto space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                            <span className="bg-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                <FontAwesomeIcon icon={faCreditCard} className="text-lg" />
                            </span>
                            법인카드 통합 관리
                        </h1>
                        <p className="text-slate-500 mt-2 font-medium ml-14">카드 현황, 배정, 월별 사용 내역, 청구 문서를 통합 관리합니다.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={refreshCards}
                            disabled={loadingCards}
                            className={`px-4 py-2.5 rounded-xl font-bold text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-2 ${loadingCards ? 'opacity-60 cursor-wait' : ''
                                }`}
                        >
                            <FontAwesomeIcon icon={faRotateRight} />
                            새로고침
                        </button>
                        <button
                            onClick={openCreateCard}
                            className="px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            카드 등록
                        </button>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-2 flex flex-wrap gap-2">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition ${activeTab === t.id ? 'bg-indigo-600 text-white shadow shadow-indigo-200' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <div>
                    {activeTab === 'status' && (
                        <div className="space-y-6">
                            <CardStatusBoard
                                cards={cards}
                                teams={teams}
                                loading={loadingCards}
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
                                            현황판에서 배정 상태를 확인하고 청구 문서를 생성/수정하세요.
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
                                        <CardBillingManager cards={cards} loadingCards={loadingCards} onRefreshCards={refreshCards} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {activeTab === 'monthly' && <CardMonthlyLedger cards={cards} loadingCards={loadingCards} />}
                </div>
            </div>

            {/* Assignment Modal */}
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
                                loading={loadingCards}
                                initialCardId={assignmentInitialCardId}
                                selectableTeams={selectableTeams}
                                onRefresh={refreshCards}
                                onEditCard={(card) => {
                                    setIsAssignmentModalOpen(false);
                                    openEditCard(card);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
            {isCardFormOpen && <CardForm initialData={editingCard} onClose={closeCardForm} onSuccess={handleCardFormSuccess} />}
        </div>
    );
};
