import React, { useState, useEffect } from 'react';
import { Vehicle } from '../../types/vehicle';
import { vehicleService } from '../../services/vehicleService';
import { teamService, Team } from '../../services/teamService';
import { companyService } from '../../services/companyService';
import { VehicleForm } from '../../components/vehicle/VehicleForm';
import { VehicleAssignment } from '../../components/vehicle/VehicleAssignment';
import { VehicleExpenseLog } from '../../components/vehicle/VehicleExpenseLog';
import { VehicleBillingManager } from '../../components/vehicle/VehicleBillingManager';
import { VehicleStatusBoard } from '../../components/vehicle/VehicleStatusBoard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCar, faChartPie, faGasPump, faRotateRight, faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { VehicleMonthlyLedger } from '../../components/vehicle/VehicleMonthlyLedger';

export const VehicleManagerPage = () => {
    // Data State
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // Team Search State
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectableTeams, setSelectableTeams] = useState<Team[]>([]); // Filtered for dropdown
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');

    // Tab State
    const [activeTab, setActiveTab] = useState<'status' | 'ledger'>('status');
    const [showBillingPanel, setShowBillingPanel] = useState(false);

    // Modal State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [assigningVehicle, setAssigningVehicle] = useState<Vehicle | null>(null);
    const [expenseVehicle, setExpenseVehicle] = useState<Vehicle | null>(null);

    // Load Data
    useEffect(() => {
        loadData();
    }, [refreshKey]);

    const loadData = async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [vehicleList, teamList, companies] = await Promise.all([
                vehicleService.getVehicles(),
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

            setVehicles(vehicleList);
            setTeams(teamList.sort((a, b) => a.name.localeCompare(b.name)));
            setSelectableTeams(allowedTeams);
        } catch (error) {
            console.error("Failed to load data", error);
            setLoadError(error instanceof Error ? error.message : "차량 목록을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    };

    // Use state for selectable teams instead of derived
    // const selectableTeams is now state


    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
    };

    // Actions
    const handleCreate = () => {
        setEditingVehicle(null);
        setIsFormOpen(true);
    };

    const handleEdit = (vehicle: Vehicle) => {
        setEditingVehicle(vehicle);
        setIsFormOpen(true);
    };

    const handleManageExpenses = (vehicle: Vehicle) => {
        setExpenseVehicle(vehicle);
    };

    const handleFormSuccess = () => {
        setIsFormOpen(false);
        handleRefresh();
    };

    const filteredVehicles = React.useMemo(() => {
        if (!selectedTeamId) return vehicles;
        const selectedTeam = teams.find(t => String(t.id) === String(selectedTeamId));
        return vehicles.filter(v => {
            // 1. Directly assigned to Team
            if (v.currentAssigneeType === 'TEAM' && String(v.currentAssigneeId) === String(selectedTeamId)) return true;
            // 2. Assigned to Team Leader (Heuristic)
            if (v.currentAssigneeType === 'WORKER' && selectedTeam?.leaderId && String(v.currentAssigneeId) === String(selectedTeam.leaderId)) return true;
            return false;
        });
    }, [vehicles, selectedTeamId, teams]);

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 xl:p-10">
            <div className="max-w-[1800px] mx-auto space-y-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                            <span className="bg-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                <FontAwesomeIcon icon={faCar} className="text-lg" />
                            </span>
                            법인차량 통합 관리
                        </h1>
                        <p className="text-slate-500 mt-2 font-medium ml-14">
                            차량 조회 · 계약, 배정 현황, 월별 고정비 및 변동비(주유/하이패스)를 통합 관리합니다.
                        </p>
                        {loadError && (
                            <div className="mt-3 ml-14 flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                                <FontAwesomeIcon icon={faCircleExclamation} className="text-amber-500 flex-shrink-0" />
                                <span className="text-sm font-medium">{loadError}</span>
                                <button
                                    type="button"
                                    onClick={handleRefresh}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-sm"
                                >
                                    <FontAwesomeIcon icon={faRotateRight} />
                                    다시 시도
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Team Filter Dropdown */}
                        <div className="relative">
                            <select
                                value={selectedTeamId}
                                onChange={(e) => setSelectedTeamId(e.target.value)}
                                className="pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 min-w-[180px] bg-white shadow-sm"
                            >
                                <option value="">전체 팀 보기</option>
                                {selectableTeams.map((team) => (
                                    <option key={team.id} value={team.id}>
                                        {team.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={loading}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2"
                            title="차량 목록 다시 조회"
                        >
                            <FontAwesomeIcon icon={faRotateRight} className={loading ? 'animate-spin' : ''} />
                            새로고침
                        </button>
                        <button
                            onClick={handleCreate}
                            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 hover:-translate-y-0.5 flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            신규 차량 등록
                        </button>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 inline-flex">
                    {[
                        { id: 'status', label: '차량 현황판', icon: faChartPie },
                        { id: 'ledger', label: '월별 공과금 대장', icon: faGasPump },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2.5
                                ${activeTab === tab.id
                                    ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }
                            `}
                        >
                            <FontAwesomeIcon icon={tab.icon} className={activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div>
                    {activeTab === 'status' && (
                        <div className="space-y-6">
                            <VehicleStatusBoard
                                vehicles={filteredVehicles}
                                teams={teams}
                                loading={loading}
                                onEdit={handleEdit}
                                onManageExpenses={handleManageExpenses}
                                onAssign={(vehicle) => {
                                    setAssigningVehicle(vehicle);
                                }}
                                onOpenBilling={() => {
                                    setShowBillingPanel(true);
                                }}
                            />
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-extrabold text-slate-900">차량 청구관리</h2>
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
                                        <VehicleBillingManager />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'ledger' && (
                        <VehicleMonthlyLedger
                            vehicles={filteredVehicles}
                            loadingVehicles={loading}
                            onOpenExpenseLog={handleManageExpenses}
                        />
                    )}
                </div>
            </div>

            {/* Modals */}
            {isFormOpen && (
                <VehicleForm
                    initialData={editingVehicle}
                    onClose={() => setIsFormOpen(false)}
                    onSuccess={handleFormSuccess}
                />
            )}

            {assigningVehicle && (
                <VehicleAssignment
                    vehicle={assigningVehicle}
                    selectableTeams={selectableTeams}
                    onClose={() => {
                        setAssigningVehicle(null);
                        handleRefresh();
                    }}
                    onUpdate={handleRefresh}
                />
            )}

            {expenseVehicle && (
                <VehicleExpenseLog
                    vehicle={expenseVehicle}
                    onClose={() => setExpenseVehicle(null)}
                />
            )}
        </div>
    );
};
