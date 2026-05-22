import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Vehicle, VehicleFineChargeTarget } from '../../types/vehicle';
import { vehicleService } from '../../services/vehicleService';
import { teamService, Team } from '../../services/teamService';
import { companyService } from '../../services/companyService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { OfficeStaff, officeStaffService } from '../../services/officeStaffService';
import { VehicleForm } from '../../components/vehicle/VehicleForm';
import { VehicleAssignmentManager } from '../../components/vehicle/VehicleAssignmentManager';
import { VehicleBillingTargetManager } from '../../components/vehicle/VehicleBillingTargetManager';
import { VehicleStatusBoard } from '../../components/vehicle/VehicleStatusBoard';
import { AssignmentBillingSetupModal, type AssignmentBillingSection } from '../../components/support/AssignmentBillingSetupModal';
import { SupportTeamFilterTabs } from '../../components/support/SupportTeamFilterTabs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCar, faChartPie, faTableCellsLarge, faRotateRight, faCircleExclamation, faHistory, faSearch } from '@fortawesome/free-solid-svg-icons';
import { VehicleMonthlyLedger } from '../../components/vehicle/VehicleMonthlyLedger';
import { buildCheongyeonEngTeams } from '../../utils/cheongyeonTeams';
import { appendOfficeAssignmentTeam, isOfficeAssignmentTeam, isOfficeStaffAssignmentReference } from '../../utils/supportAssignmentTargets';

interface VehicleManagerPageProps {
    embedded?: boolean;
}

export const VehicleManagerPage: React.FC<VehicleManagerPageProps> = ({ embedded = false }) => {
    const navigate = useNavigate();
    // Data State
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // Team Search State
    const [teams, setTeams] = useState<Team[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [selectableTeams, setSelectableTeams] = useState<Team[]>([]); // Filtered for dropdown
    const [assignableTeams, setAssignableTeams] = useState<Team[]>([]);
    const [officeStaffRows, setOfficeStaffRows] = useState<OfficeStaff[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');

    // Tab State
    const [activeTab, setActiveTab] = useState<'status' | 'ledger'>('status');

    // Modal State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
    const [setupInitialVehicleId, setSetupInitialVehicleId] = useState<string | null>(null);
    const [setupInitialSection, setSetupInitialSection] = useState<AssignmentBillingSection>('assignment');
    const [billingTargetInitialSplitMode, setBillingTargetInitialSplitMode] = useState(false);

    // 데이터 로드 함수
    const loadData = async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [vehicleList, teamList, companies, officeStaffList] = await Promise.all([
                vehicleService.getVehicles(),
                teamService.getTeams(),
                companyService.getCompanies(),
                officeStaffService.getOfficeStaff().catch(() => [] as OfficeStaff[])
            ]);
            const workerList = await manpowerService.getWorkers();
            const allowedTeams = buildCheongyeonEngTeams(teamList, companies);
            const sortedTeams = teamList
                .slice()
                .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ko-KR'));
            setVehicles(vehicleList);
            setWorkers(workerList);
            setTeams(appendOfficeAssignmentTeam(sortedTeams, sortedTeams));
            setSelectableTeams(allowedTeams);
            setAssignableTeams(appendOfficeAssignmentTeam(allowedTeams, sortedTeams));
            setOfficeStaffRows(officeStaffList);
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
        const query = searchTerm.trim().toLowerCase();
        const selectedTeam = teams.find(t => String(t.id) === String(selectedTeamId));
        const selectedTeamIsOffice = isOfficeAssignmentTeam(selectedTeam);
        return vehicles.filter(v => {
            const teamMatches = !selectedTeamId
                || (v.currentAssigneeType === 'TEAM' && String(v.currentAssigneeId) === String(selectedTeamId))
                || (v.currentAssigneeType === 'WORKER' && selectedTeam?.leaderId && String(v.currentAssigneeId) === String(selectedTeam.leaderId))
                || (
                    selectedTeamIsOffice &&
                    v.currentAssigneeType === 'WORKER' &&
                    isOfficeStaffAssignmentReference(officeStaffRows, v.currentAssigneeId, v.currentAssigneeName)
                );

            const searchMatches = !query || [
                v.licensePlate,
                v.model,
                v.type,
                v.status,
                v.currentAssigneeName,
                v.billingTargetName,
                v.memo,
                v.contract?.financeCompany?.name,
                v.contract?.startDate,
                v.contract?.endDate,
                v.contract?.paymentDay,
                v.insurance?.company,
                v.insurance?.policyNumber,
                v.insurance?.expiryDate
            ].some(value => String(value ?? '').toLowerCase().includes(query));

            return teamMatches && searchMatches;
        });
    }, [vehicles, selectedTeamId, teams, searchTerm, officeStaffRows]);

    // 핸들러 함수들
    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
    };
    const handleEdit = (vehicle: Vehicle) => {
        setEditingVehicle(vehicle);
        setIsFormOpen(true);
    };
    const openAssignmentVehicle = (vehicle: Vehicle) => {
        setSetupInitialVehicleId(String(vehicle.id));
        setSetupInitialSection('assignment');
        setBillingTargetInitialSplitMode(false);
        setIsSetupModalOpen(true);
    };
    const openBillingTargetVehicle = (vehicle: Vehicle, options?: { split?: boolean }) => {
        setSetupInitialVehicleId(String(vehicle.id));
        setSetupInitialSection('billing');
        setBillingTargetInitialSplitMode(Boolean(options?.split));
        setIsSetupModalOpen(true);
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
            if (setupInitialVehicleId === String(vehicle.id)) {
                setSetupInitialVehicleId(null);
                setBillingTargetInitialSplitMode(false);
                setIsSetupModalOpen(false);
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
    const handleFineChargeTargetChange = async (vehicleId: string, target: VehicleFineChargeTarget) => {
        await vehicleService.updateVehicle(vehicleId, { fineChargeTarget: target });
        setVehicles(prev => prev.map(vehicle => (
            String(vehicle.id) === String(vehicleId)
                ? { ...vehicle, fineChargeTarget: target }
                : vehicle
        )));
    };

    const setupVehicle = React.useMemo(
        () => vehicles.find((vehicle) => String(vehicle.id) === String(setupInitialVehicleId)) ?? null,
        [setupInitialVehicleId, vehicles]
    );

    return (
        <div className={`${embedded ? 'space-y-5 sm:space-y-6 bg-transparent min-h-full w-full min-w-0 max-w-full overflow-x-hidden' : 'p-3 sm:p-6 space-y-5 sm:space-y-6 bg-slate-50 min-h-full w-full max-w-[calc(100vw-30px)] sm:max-w-full min-w-0 overflow-x-hidden'}`}>
            {/* Header 섹션 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="shrink-0 p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">
                        <FontAwesomeIcon icon={faCar} className="text-white text-xl" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">차량 통합관리</h1>
                        <p className="text-sm text-slate-500 font-medium">실시간 운전자 현황과 차량 통합관리대장을 관리합니다.</p>
                    </div>
                </div>

                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <button
                        onClick={() => navigate('/support/vehicles/logs')}
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
                        onClick={() => {
                            setEditingVehicle(null);
                            setIsFormOpen(true);
                        }}
                        className="flex flex-1 items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 sm:flex-none"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        <span>차량 신규등록</span>
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
                                운전자 및 청구현황
                            </button>
                            <button
                                onClick={() => setActiveTab('ledger')}
                                className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold transition-all sm:px-6 ${activeTab === 'ledger' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <FontAwesomeIcon icon={faTableCellsLarge} className="mr-2" />
                                차량 통합관리대장
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
                        조회 {filteredVehicles.length} / {vehicles.length}
                    </span>

                    <label className="relative block w-full sm:min-w-[240px] xl:w-72">
                        <FontAwesomeIcon icon={faSearch} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="차량번호, 모델, 운전자 검색"
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
                    <VehicleStatusBoard
                        vehicles={filteredVehicles}
                        teams={assignableTeams}
                        workers={workers}
                        loading={loading}
                        onEdit={handleEdit}
                        onAssign={openAssignmentVehicle}
                        onBillingTargetAssign={openBillingTargetVehicle}
                        onFineChargeTargetChange={handleFineChargeTargetChange}
                        onDelete={handleDelete}
                    />
                ) : (
                    <VehicleMonthlyLedger
                        vehicles={filteredVehicles}
                        teams={teams}
                        teamFilterId={selectedTeamId}
                        loadingVehicles={loading}
                        onOpenSetup={openAssignmentVehicle}
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

            <AssignmentBillingSetupModal
                isOpen={isSetupModalOpen}
                title={setupVehicle?.licensePlate ? `${setupVehicle.licensePlate} 차량` : '차량'}
                subtitle={setupVehicle ? `${setupVehicle.model || '모델 미입력'} · ${setupVehicle.type || '유형 미입력'}` : '차량 운전자와 청구대상을 한 화면에서 설정합니다.'}
                resourceLabel="차량"
                initialSection={setupInitialSection}
                onClose={() => {
                    setIsSetupModalOpen(false);
                    setBillingTargetInitialSplitMode(false);
                }}
                assignmentContent={(
                    <VehicleAssignmentManager
                        vehicles={vehicles}
                        workers={workers}
                        loading={loading}
                        initialVehicleId={setupInitialVehicleId}
                        selectableTeams={assignableTeams}
                        onRefresh={handleRefresh}
                    />
                )}
                billingContent={(
                    <VehicleBillingTargetManager
                        vehicles={vehicles}
                        workers={workers}
                        loading={loading}
                        initialVehicleId={setupInitialVehicleId}
                        initialSplitMode={billingTargetInitialSplitMode}
                        selectableTeams={selectableTeams}
                        onRefresh={handleRefresh}
                    />
                )}
            />

        </div>
    );
};
