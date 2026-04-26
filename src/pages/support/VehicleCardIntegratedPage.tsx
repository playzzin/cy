import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
    faCar,
    faCreditCard,
    faCircleExclamation,
    faFileInvoiceDollar,
    faMagnifyingGlass,
    faPlus,
    faRotateRight,
    faTableCellsLarge,
    faTableList,
    faTimes,
    faUsers
} from '@fortawesome/free-solid-svg-icons';
import { Vehicle } from '../../types/vehicle';
import { Card } from '../../types/card';
import { Team, teamService } from '../../services/teamService';
import { Company, companyService } from '../../services/companyService';
import { Worker, manpowerService } from '../../services/manpowerService';
import { vehicleService } from '../../services/vehicleService';
import { cardService } from '../../services/cardService';
import { VehicleForm } from '../../components/vehicle/VehicleForm';
import { VehicleAssignment } from '../../components/vehicle/VehicleAssignment';
import { VehicleExpenseLog } from '../../components/vehicle/VehicleExpenseLog';
import { VehicleBillingManager } from '../../components/vehicle/VehicleBillingManager';
import { VehicleMonthlyLedger } from '../../components/vehicle/VehicleMonthlyLedger';
import { VehicleRegistrySheet } from '../../components/vehicle/VehicleRegistrySheet';
import { CardForm } from '../../components/card/CardForm';
import { CardAssignmentManager } from '../../components/card/CardAssignmentManager';
import { CardBillingManager } from '../../components/card/CardBillingManager';
import { CardMonthlyLedger } from '../../components/card/CardMonthlyLedger';
import { CardRegistrySheet } from '../../components/card/CardRegistrySheet';

type AssetTab = 'vehicle' | 'card';
type VehicleViewTab = 'ledger' | 'sheet' | 'billing';
type CardViewTab = 'monthly' | 'sheet' | 'billing';

const normalizeSearchText = (value: string): string =>
    String(value ?? '').replace(/\s+/g, '').toLowerCase();

const matchesKeyword = (keyword: string, values: Array<string | null | undefined>): boolean => {
    if (!keyword) return true;
    return values.some((value) => normalizeSearchText(value ?? '').includes(keyword));
};

const formatCurrency = (value: number): string => `${Math.round(value).toLocaleString('ko-KR')}원`;

const buildSelectableTeams = (teamList: Team[], companyList: Company[]): Team[] => {
    const cheongyeonCompanies = companyList.filter((company) => String(company.name ?? '').includes('청연'));
    const cheongyeonCompanyIds = new Set(cheongyeonCompanies.map((company) => String(company.id ?? '')).filter(Boolean));
    const cheongyeonCompanyNames = new Set(cheongyeonCompanies.map((company) => String(company.name ?? '')).filter(Boolean));

    return teamList
        .filter((team) => {
            const companyId = String(team.companyId ?? '');
            const companyName = String(team.companyName ?? '');
            return cheongyeonCompanyIds.has(companyId) || cheongyeonCompanyNames.has(companyName);
        })
        .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko'));
};

const isWithinDays = (dateText?: string | null, days = 30): boolean => {
    if (!dateText) return false;
    const target = new Date(dateText);
    if (Number.isNaN(target.getTime())) return false;

    const today = new Date();
    const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= days;
};

const SummaryPill: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone = 'slate' }) => (
    <div className={`rounded-xl border px-4 py-3 ${tone === 'indigo' ? 'border-indigo-200 bg-indigo-50' : tone === 'emerald' ? 'border-emerald-200 bg-emerald-50' : tone === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{label}</div>
        <div className="mt-2 text-lg font-extrabold text-slate-900">{value}</div>
    </div>
);

const VehicleCardIntegratedPageComponent: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const activeAssetTab: AssetTab = location.pathname.includes('/support/cards') ? 'card' : 'vehicle';

    const [vehicleViewTab, setVehicleViewTab] = useState<VehicleViewTab>('ledger');
    const [cardViewTab, setCardViewTab] = useState<CardViewTab>('monthly');

    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [cards, setCards] = useState<Card[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [selectableTeams, setSelectableTeams] = useState<Team[]>([]);

    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [vehicleSearchText, setVehicleSearchText] = useState<string>('');
    const [cardSearchText, setCardSearchText] = useState<string>('');

    const [loadingMaster, setLoadingMaster] = useState<boolean>(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<number>(0);

    const [isVehicleFormOpen, setIsVehicleFormOpen] = useState<boolean>(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [assigningVehicle, setAssigningVehicle] = useState<Vehicle | null>(null);
    const [expenseVehicle, setExpenseVehicle] = useState<Vehicle | null>(null);

    const [isCardFormOpen, setIsCardFormOpen] = useState<boolean>(false);
    const [editingCard, setEditingCard] = useState<Card | null>(null);
    const [assignmentInitialCardId, setAssignmentInitialCardId] = useState<string | null>(null);
    const [isCardAssignmentModalOpen, setIsCardAssignmentModalOpen] = useState<boolean>(false);

    const loadMasterData = useCallback(async () => {
        setLoadingMaster(true);
        setLoadError(null);

        try {
            const [vehicleList, cardList, teamList, companyList, workerList] = await Promise.all([
                vehicleService.getVehicles(),
                cardService.getCards(),
                teamService.getTeams(),
                companyService.getCompanies(),
                manpowerService.getWorkers()
            ]);

            const sortedTeams = [...teamList].sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko'));
            setVehicles(vehicleList);
            setCards(cardList);
            setTeams(sortedTeams);
            setWorkers(workerList);
            setSelectableTeams(buildSelectableTeams(sortedTeams, companyList));
        } catch (error) {
            console.error(error);
            setLoadError(error instanceof Error ? error.message : '차량/카드 데이터를 불러오지 못했습니다.');
            setVehicles([]);
            setCards([]);
            setTeams([]);
            setWorkers([]);
            setSelectableTeams([]);
        } finally {
            setLoadingMaster(false);
        }
    }, []);

    useEffect(() => {
        void loadMasterData();
    }, [loadMasterData, refreshToken]);

    useEffect(() => {
        if (!selectedTeamId) return;
        const exists = selectableTeams.some((team) => String(team.id) === String(selectedTeamId));
        if (!exists) {
            setSelectedTeamId('');
        }
    }, [selectedTeamId, selectableTeams]);

    const selectedTeamLabel = useMemo(
        () => selectableTeams.find((team) => String(team.id) === String(selectedTeamId))?.name ?? '전체 팀',
        [selectedTeamId, selectableTeams]
    );

    const workerById = useMemo(() => {
        const map = new Map<string, Worker>();
        workers.forEach((worker) => {
            if (worker.id) {
                map.set(String(worker.id), worker);
            }
        });
        return map;
    }, [workers]);

    const workerByName = useMemo(() => {
        const map = new Map<string, Worker>();
        workers.forEach((worker) => {
            const name = String(worker.name ?? '').trim();
            if (name && !map.has(name)) {
                map.set(name, worker);
            }
        });
        return map;
    }, [workers]);

    const teamFilteredVehicles = useMemo(() => {
        if (!selectedTeamId) return vehicles;

        const selectedTeam = teams.find((team) => String(team.id) === String(selectedTeamId));
        return vehicles.filter((vehicle) => {
            if (vehicle.currentAssigneeType === 'TEAM' && String(vehicle.currentAssigneeId ?? '') === String(selectedTeamId)) {
                return true;
            }

            if (
                vehicle.currentAssigneeType === 'WORKER' &&
                selectedTeam?.leaderId &&
                String(vehicle.currentAssigneeId ?? '') === String(selectedTeam.leaderId)
            ) {
                return true;
            }

            return false;
        });
    }, [vehicles, teams, selectedTeamId]);

    const teamFilteredCards = useMemo(() => {
        if (!selectedTeamId) return cards;

        return cards.filter((card) => {
            if (card.currentAssigneeType === 'TEAM' && String(card.currentAssigneeId ?? '') === String(selectedTeamId)) {
                return true;
            }

            if (card.currentAssigneeType === 'WORKER') {
                const worker =
                    workerById.get(String(card.currentAssigneeId ?? '')) ??
                    workerByName.get(String(card.currentAssigneeName ?? '').trim());
                return String(worker?.teamId ?? '') === String(selectedTeamId);
            }

            return false;
        });
    }, [cards, selectedTeamId, workerById, workerByName]);

    const visibleVehicles = useMemo(() => {
        const keyword = normalizeSearchText(vehicleSearchText);
        return teamFilteredVehicles.filter((vehicle) =>
            matchesKeyword(keyword, [
                vehicle.licensePlate,
                vehicle.model,
                vehicle.currentAssigneeName,
                vehicle.contract?.financeCompany?.name,
                vehicle.insurance?.company,
                vehicle.memo
            ])
        );
    }, [teamFilteredVehicles, vehicleSearchText]);

    const visibleCards = useMemo(() => {
        const keyword = normalizeSearchText(cardSearchText);
        return teamFilteredCards.filter((card) =>
            matchesKeyword(keyword, [
                card.name,
                card.issuer,
                card.currentAssigneeName,
                card.last4,
                card.maskedNumber,
                card.memo,
                card.expiry
            ])
        );
    }, [teamFilteredCards, cardSearchText]);

    const vehicleSummary = useMemo(() => {
        return {
            count: visibleVehicles.length,
            assigned: visibleVehicles.filter((vehicle) => vehicle.status === 'ASSIGNED').length,
            monthlyFee: visibleVehicles.reduce((sum, vehicle) => sum + Number(vehicle.contract?.monthlyFee ?? 0), 0),
            expiring: visibleVehicles.filter((vehicle) => isWithinDays(vehicle.contract?.endDate)).length
        };
    }, [visibleVehicles]);

    const cardSummary = useMemo(() => {
        return {
            count: visibleCards.length,
            assigned: visibleCards.filter((card) => card.status === 'ASSIGNED').length,
            available: visibleCards.filter((card) => card.status === 'AVAILABLE').length,
            expiring: visibleCards.filter((card) => isWithinDays(card.expiry)).length
        };
    }, [visibleCards]);

    const refreshAll = () => setRefreshToken((prev) => prev + 1);

    const openVehicleCreate = () => {
        setEditingVehicle(null);
        setIsVehicleFormOpen(true);
    };

    const openVehicleEdit = (vehicle: Vehicle) => {
        setEditingVehicle(vehicle);
        setIsVehicleFormOpen(true);
    };

    const openCardCreate = () => {
        setEditingCard(null);
        setIsCardFormOpen(true);
    };

    const openCardEdit = (card: Card) => {
        setEditingCard(card);
        setIsCardFormOpen(true);
    };

    const activeSearchText = activeAssetTab === 'vehicle' ? vehicleSearchText : cardSearchText;
    const setActiveSearchText = activeAssetTab === 'vehicle' ? setVehicleSearchText : setCardSearchText;

    const actionButton = activeAssetTab === 'vehicle'
        ? { label: '차량 등록', onClick: openVehicleCreate }
        : { label: '카드 등록', onClick: openCardCreate };

    const assetTabs: Array<{
        id: AssetTab;
        label: string;
        icon: IconDefinition;
        description: string;
        path: string;
        count: number;
    }> = [
        {
            id: 'vehicle',
            label: '차량',
            icon: faCar,
            description: '사용료·수리비·주유비',
            path: '/support/vehicles',
            count: vehicles.length
        },
        {
            id: 'card',
            label: '카드',
            icon: faCreditCard,
            description: '카드값·사용자·유효기간',
            path: '/support/cards',
            count: cards.length
        }
    ];

    const vehicleViewTabs: Array<{ id: VehicleViewTab; label: string; icon: IconDefinition }> = [
        { id: 'ledger', label: '월별 비용대장', icon: faTableCellsLarge },
        { id: 'sheet', label: '차량 대장', icon: faTableList },
        { id: 'billing', label: '청구관리', icon: faFileInvoiceDollar }
    ];

    const cardViewTabs: Array<{ id: CardViewTab; label: string; icon: IconDefinition }> = [
        { id: 'monthly', label: '월별 카드대장', icon: faTableCellsLarge },
        { id: 'sheet', label: '카드 대장', icon: faTableList },
        { id: 'billing', label: '청구관리', icon: faFileInvoiceDollar }
    ];

    return (
        <div className="min-h-screen bg-slate-50 p-6 xl:p-8">
            <div className="mx-auto max-w-[1800px] space-y-5">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                        <div>
                            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Excel Style Asset Manager</div>
                            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">차량 / 카드 간편 관리</h1>
                            <p className="mt-2 text-sm font-medium text-slate-500">
                                화려한 현황판보다 대장과 월별표를 우선 배치했습니다. 바로 검색하고, 바로 수정하고, 바로 저장하는 흐름에 맞췄습니다.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={refreshAll}
                                disabled={loadingMaster}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                            >
                                <FontAwesomeIcon icon={faRotateRight} className={loadingMaster ? 'animate-spin' : ''} />
                                새로고침
                            </button>
                            <button
                                type="button"
                                onClick={actionButton.onClick}
                                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
                            >
                                <FontAwesomeIcon icon={faPlus} />
                                {actionButton.label}
                            </button>
                        </div>
                    </div>

                    {loadError && (
                        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                            <FontAwesomeIcon icon={faCircleExclamation} className="mt-0.5 text-amber-500" />
                            <span>{loadError}</span>
                        </div>
                    )}

                    <div className="mt-5 grid gap-3 xl:grid-cols-[420px_minmax(0,1fr)]">
                        <div className="grid gap-2">
                            {assetTabs.map((tab) => {
                                const isActive = activeAssetTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => navigate(tab.path)}
                                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                                            isActive
                                                ? 'border-slate-900 bg-slate-900 text-white'
                                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <FontAwesomeIcon icon={tab.icon} />
                                                    <span className="font-extrabold">{tab.label}</span>
                                                </div>
                                                <div className={`mt-1 text-sm font-medium ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                                                    {tab.description}
                                                </div>
                                            </div>
                                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${isActive ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                                {tab.count.toLocaleString('ko-KR')}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_180px]">
                            <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">검색</div>
                                <div className="mt-2 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faMagnifyingGlass} className="text-slate-400" />
                                    <input
                                        type="text"
                                        value={activeSearchText}
                                        onChange={(event) => setActiveSearchText(event.target.value)}
                                        placeholder={activeAssetTab === 'vehicle' ? '차량번호, 차종, 운전자, 캐피탈 검색' : '카드명, 사용자, 카드번호 검색'}
                                        className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
                                    />
                                </div>
                            </label>

                            <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">팀 필터</div>
                                <select
                                    value={selectedTeamId}
                                    onChange={(event) => setSelectedTeamId(event.target.value)}
                                    className="mt-2 w-full bg-transparent text-sm font-bold text-slate-700 outline-none"
                                >
                                    <option value="">전체 팀</option>
                                    {selectableTeams.map((team) => (
                                        <option key={team.id} value={team.id}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">현재 범위</div>
                                <div className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                                    <FontAwesomeIcon icon={faUsers} className="text-slate-400" />
                                    <span>{selectedTeamLabel}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {activeAssetTab === 'vehicle' && (
                    <>
                        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <SummaryPill label="조회 차량" value={`${vehicleSummary.count}대`} />
                            <SummaryPill label="운행중" value={`${vehicleSummary.assigned}대`} tone="emerald" />
                            <SummaryPill label="월 사용료" value={formatCurrency(vehicleSummary.monthlyFee)} tone="indigo" />
                            <SummaryPill label="만료 예정" value={`${vehicleSummary.expiring}대`} tone="amber" />
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                            <div className="flex flex-wrap gap-2">
                                {vehicleViewTabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setVehicleViewTab(tab.id)}
                                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${
                                            vehicleViewTab === tab.id
                                                ? 'bg-slate-900 text-white'
                                                : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        <FontAwesomeIcon icon={tab.icon} />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </section>
                    </>
                )}

                {activeAssetTab === 'card' && (
                    <>
                        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <SummaryPill label="조회 카드" value={`${cardSummary.count}장`} />
                            <SummaryPill label="사용중" value={`${cardSummary.assigned}장`} tone="emerald" />
                            <SummaryPill label="대기 카드" value={`${cardSummary.available}장`} tone="indigo" />
                            <SummaryPill label="만료 예정" value={`${cardSummary.expiring}장`} tone="amber" />
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                            <div className="flex flex-wrap gap-2">
                                {cardViewTabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setCardViewTab(tab.id)}
                                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${
                                            cardViewTab === tab.id
                                                ? 'bg-slate-900 text-white'
                                                : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        <FontAwesomeIcon icon={tab.icon} />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </section>
                    </>
                )}

                {activeAssetTab === 'vehicle' && vehicleViewTab === 'ledger' && (
                    <VehicleMonthlyLedger
                        vehicles={visibleVehicles}
                        loadingVehicles={loadingMaster}
                        onOpenExpenseLog={(vehicle) => setExpenseVehicle(vehicle)}
                    />
                )}

                {activeAssetTab === 'vehicle' && vehicleViewTab === 'sheet' && (
                    <VehicleRegistrySheet
                        vehicles={visibleVehicles}
                        loading={loadingMaster}
                        onEdit={openVehicleEdit}
                        onAssign={(vehicle) => setAssigningVehicle(vehicle)}
                        onManageExpenses={(vehicle) => setExpenseVehicle(vehicle)}
                    />
                )}

                {activeAssetTab === 'vehicle' && vehicleViewTab === 'billing' && (
                    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div>
                            <h2 className="text-lg font-extrabold text-slate-900">차량 청구관리</h2>
                            <p className="mt-1 text-sm font-medium text-slate-500">
                                청구 문서 생성은 전체 차량 기준으로 동작합니다. 팀/검색 필터는 대장 화면에 우선 반영됩니다.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                            <VehicleBillingManager />
                        </div>
                    </section>
                )}

                {activeAssetTab === 'card' && cardViewTab === 'monthly' && (
                    <CardMonthlyLedger
                        cards={visibleCards}
                        teams={teams}
                        loadingCards={loadingMaster}
                    />
                )}

                {activeAssetTab === 'card' && cardViewTab === 'sheet' && (
                    <CardRegistrySheet
                        cards={visibleCards}
                        loading={loadingMaster}
                        onEdit={openCardEdit}
                        onAssign={(card) => {
                            setAssignmentInitialCardId(String(card.id));
                            setIsCardAssignmentModalOpen(true);
                        }}
                    />
                )}

                {activeAssetTab === 'card' && cardViewTab === 'billing' && (
                    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div>
                            <h2 className="text-lg font-extrabold text-slate-900">카드 청구관리</h2>
                            <p className="mt-1 text-sm font-medium text-slate-500">
                                카드 청구 문서는 팀 필터 기준으로 관리하고, 검색어는 대장 화면에 우선 반영됩니다.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                            <CardBillingManager
                                cards={teamFilteredCards}
                                loadingCards={loadingMaster}
                                onRefreshCards={refreshAll}
                            />
                        </div>
                    </section>
                )}
            </div>

            {isVehicleFormOpen && (
                <VehicleForm
                    initialData={editingVehicle}
                    onClose={() => {
                        setIsVehicleFormOpen(false);
                        setEditingVehicle(null);
                    }}
                    onSuccess={() => {
                        setIsVehicleFormOpen(false);
                        setEditingVehicle(null);
                        refreshAll();
                    }}
                />
            )}

            {assigningVehicle && (
                <VehicleAssignment
                    vehicle={assigningVehicle}
                    selectableTeams={selectableTeams}
                    onClose={() => setAssigningVehicle(null)}
                    onUpdate={refreshAll}
                />
            )}

            {expenseVehicle && (
                <VehicleExpenseLog
                    vehicle={expenseVehicle}
                    onClose={() => {
                        setExpenseVehicle(null);
                        refreshAll();
                    }}
                />
            )}

            {isCardAssignmentModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="relative max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
                            <h2 className="text-xl font-bold text-slate-800">카드 배정 관리</h2>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCardAssignmentModalOpen(false);
                                    setAssignmentInitialCardId(null);
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>
                        <div className="p-6">
                            <CardAssignmentManager
                                cards={cards}
                                loading={loadingMaster}
                                initialCardId={assignmentInitialCardId}
                                selectableTeams={selectableTeams}
                                onRefresh={refreshAll}
                                onEditCard={(card) => {
                                    setIsCardAssignmentModalOpen(false);
                                    setAssignmentInitialCardId(null);
                                    openCardEdit(card);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {isCardFormOpen && (
                <CardForm
                    initialData={editingCard}
                    onClose={() => {
                        setIsCardFormOpen(false);
                        setEditingCard(null);
                    }}
                    onSuccess={() => {
                        setIsCardFormOpen(false);
                        setEditingCard(null);
                        refreshAll();
                    }}
                />
            )}
        </div>
    );
};

export default VehicleCardIntegratedPageComponent;
export const VehicleCardIntegratedPage = VehicleCardIntegratedPageComponent;
