import React, { useState, useEffect } from 'react';
import { Vehicle } from '../../types/vehicle';
import { vehicleService } from '../../services/vehicleService';
import { teamService, Team } from '../../services/teamService';
import { companyService } from '../../services/companyService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { VehicleForm } from '../../components/vehicle/VehicleForm';
import { VehicleAssignmentManager } from '../../components/vehicle/VehicleAssignmentManager';
import { VehicleBillingTargetManager } from '../../components/vehicle/VehicleBillingTargetManager';
import { VehicleBillingManager } from '../../components/vehicle/VehicleBillingManager';
import { VehicleStatusBoard } from '../../components/vehicle/VehicleStatusBoard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCar, faChartPie, faTableCellsLarge, faRotateRight, faCircleExclamation, faFileInvoiceDollar, faTimes } from '@fortawesome/free-solid-svg-icons';
import { VehicleMonthlyLedger } from '../../components/vehicle/VehicleMonthlyLedger';
import { hexToRgba, normalizeHexColor } from '../../utils/color';
import { buildCheongyeonEngTeams } from '../../utils/cheongyeonTeams';

interface VehicleManagerPageProps {
    embedded?: boolean;
}

export const VehicleManagerPage: React.FC<VehicleManagerPageProps> = ({ embedded = false }) => {
    // Data State
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // Team Search State
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [selectableTeams, setSelectableTeams] = useState<Team[]>([]); // Filtered for dropdown
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');

    // Tab State
    const [activeTab, setActiveTab] = useState<'status' | 'ledger'>('status');
    const [showBillingPanel, setShowBillingPanel] = useState(false);

    // Modal State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [assignmentInitialVehicleId, setAssignmentInitialVehicleId] = useState<string | null>(null);
    const [isBillingTargetModalOpen, setIsBillingTargetModalOpen] = useState(false);
    const [billingTargetInitialVehicleId, setBillingTargetInitialVehicleId] = useState<string | null>(null);

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
            const workerList = await manpowerService.getWorkers();
            const allowedTeams = buildCheongyeonEngTeams(teamList, companies);
            setVehicles(vehicleList);
            setWorkers(workerList);
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

    const selectedTeam = React.useMemo(
        () => teams.find(t => String(t.id) === String(selectedTeamId)) ?? null,
        [selectedTeamId, teams]
    );
    const selectedTeamColor = selectedTeam ? normalizeHexColor(selectedTeam.color) : '#64748b';

    // 핸들러 함수들
    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
    };
    const handleEdit = (vehicle: Vehicle) => {
        setEditingVehicle(vehicle);
        setIsFormOpen(true);
    };
    const openAssignmentVehicle = (vehicle: Vehicle) => {
        setAssignmentInitialVehicleId(String(vehicle.id));
        setIsAssignmentModalOpen(true);
    };
    const openBillingTargetVehicle = (vehicle: Vehicle) => {
        setBillingTargetInitialVehicleId(String(vehicle.id));
        setIsBillingTargetModalOpen(true);
    };
    const handleDelete = async (vehicle: Vehicle) => {
        const label = vehicle.licensePlate || vehicle.model || '선택한 차량';
        const ok = window.confirm(`${label} 차량을 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.`);
        if (!ok) return;

        try {
            await vehicleService.deleteVehicle(vehicle.id);
            if (editingVehicle?.id === vehicle.id) {
                setEditingVehicle(null);
                setIsFormOpen(false);
            }
            if (assignmentInitialVehicleId === String(vehicle.id)) {
                setAssignmentInitialVehicleId(null);
                setIsAssignmentModalOpen(false);
            }
            if (billingTargetInitialVehicleId === String(vehicle.id)) {
                setBillingTargetInitialVehicleId(null);
                setIsBillingTargetModalOpen(false);
            }
            handleRefresh();
        } catch (error) {
            console.error('Failed to delete vehicle', error);
            window.alert('차량 삭제 중 오류가 발생했습니다.');
        }
    };
    const handleFormSuccess = () => {
        setIsFormOpen(false);
        setEditingVehicle(null);
        handleRefresh();
    };

    return (
        <div className={`${embedded ? 'space-y-6 bg-transparent min-h-full' : 'p-6 space-y-6 bg-slate-50 min-h-full'}`}>
            {/* Header 섹션 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">
                        <FontAwesomeIcon icon={faCar} className="text-white text-xl" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">차량 통합관리</h1>
                        <p className="text-sm text-slate-500 font-medium">실시간 배정 현황과 차량 통합관리대장을 관리합니다.</p>
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
                        type="button"
                        onClick={() => {
                            setActiveTab('status');
                            setShowBillingPanel((prev) => !prev);
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all border ${
                            showBillingPanel
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        <FontAwesomeIcon icon={faFileInvoiceDollar} />
                        <span>{showBillingPanel ? '청구관리 닫기' : '청구관리'}</span>
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
                        <FontAwesomeIcon icon={faTableCellsLarge} className="mr-2" />
                        차량 통합관리대장
                    </button>
                </div>

                <div
                    className="flex items-center gap-3 rounded-xl px-2 py-1"
                    style={selectedTeam ? {
                        backgroundColor: hexToRgba(selectedTeamColor, 0.07),
                        boxShadow: `inset 4px 0 0 ${selectedTeamColor}`
                    } : undefined}
                >
                    <span className="text-sm font-bold text-slate-500">팀별 필터:</span>
                    {selectedTeam && (
                        <span
                            className="h-3 w-3 rounded-full border border-white shadow-sm"
                            style={{ backgroundColor: selectedTeamColor }}
                        />
                    )}
                    <select
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block w-48 p-2 outline-none"
                        style={selectedTeam ? {
                            borderColor: hexToRgba(selectedTeamColor, 0.35),
                            backgroundColor: hexToRgba(selectedTeamColor, 0.05),
                            color: selectedTeamColor
                        } : undefined}
                    >
                        <option value="">전체 팀 보기</option>
                        {selectableTeams.map(team => (
                            <option key={team.id} value={team.id} style={{ color: normalizeHexColor(team.color) }}>{team.name}</option>
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
                            teams={selectableTeams}
                            workers={workers}
                            loading={loading}
                            onEdit={handleEdit}
                            onAssign={openAssignmentVehicle}
                            onBillingTargetAssign={openBillingTargetVehicle}
                            onDelete={handleDelete}
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
                        teams={teams}
                        teamFilterId={selectedTeamId}
                        loadingVehicles={loading}
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

            {isAssignmentModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto relative animate-fade-in-up">
                        <div className="sticky top-0 z-10 bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">차량 배정</h2>
                            <button
                                onClick={() => setIsAssignmentModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>
                        <div className="p-6">
                            <VehicleAssignmentManager
                                vehicles={vehicles}
                                workers={workers}
                                loading={loading}
                                initialVehicleId={assignmentInitialVehicleId}
                                selectableTeams={selectableTeams}
                                onRefresh={handleRefresh}
                            />
                        </div>
                    </div>
                </div>
            )}

            {isBillingTargetModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto relative animate-fade-in-up">
                        <div className="sticky top-0 z-10 bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">차량 청구대상 배정</h2>
                            <button
                                onClick={() => setIsBillingTargetModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>
                        <div className="p-6">
                            <VehicleBillingTargetManager
                                vehicles={vehicles}
                                workers={workers}
                                loading={loading}
                                initialVehicleId={billingTargetInitialVehicleId}
                                selectableTeams={selectableTeams}
                                onRefresh={handleRefresh}
                            />
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
