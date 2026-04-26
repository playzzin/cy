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

    // 데이터 로드 함수
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

    useEffect(() => {
        loadData();
    }, [refreshKey]);

    // 차량 필터링
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

    // 핸들러 함수들
    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
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
        setEditingVehicle(null);
        handleRefresh();
    };

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-full">
            {/* Header 섹션 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">
                        <FontAwesomeIcon icon={faCar} className="text-white text-xl" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">차량 통합관리</h1>
                        <p className="text-sm text-slate-500 font-medium">실시간 배정 현황 및 유류비/청구 내역을 관리합니다.</p>
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
                        onClick={() => {
                            setEditingVehicle(null);
                            setIsFormOpen(true);
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        <span>차량 신규등록</span>
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
                        <FontAwesomeIcon icon={faGasPump} className="mr-2" />
                        차량 통합관리대장
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
                ) : (
                    <VehicleMonthlyLedger
                        vehicles={filteredVehicles}
                        loadingVehicles={loading}
                        onOpenExpenseLog={handleManageExpenses}
                    />
                )}
            </div>

            {/* Modals */}
            {isFormOpen && (
                <VehicleForm
                    initialData={editingVehicle}
                    onClose={() => {
                        setIsFormOpen(false);
                        setEditingVehicle(null);
                    }}
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
