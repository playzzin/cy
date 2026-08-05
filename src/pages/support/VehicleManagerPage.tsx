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
import { SupportCancellationHistory } from '../../components/support/SupportCancellationHistory';
import { SupportCancellationModal, type SupportCancellationFormValue } from '../../components/support/SupportCancellationModal';
import { SupportPageHeader } from '../../components/support/SupportPageHeader';
import { SupportSegmentedTabs, type SupportSegmentedTabOption } from '../../components/support/SupportSegmentedTabs';
import { supportCancellationLogService } from '../../services/supportCancellationLogService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCar, faChartPie, faTableCellsLarge, faRotateRight, faCircleExclamation, faHistory, faSearch, faOilCan, faScrewdriverWrench } from '@fortawesome/free-solid-svg-icons';
import { VehicleMonthlyLedger } from '../../components/vehicle/VehicleMonthlyLedger';
import { buildCheongyeonEngTeams } from '../../utils/cheongyeonTeams';
import { appendOfficeAssignmentTeam, isOfficeAssignmentReference, isOfficeAssignmentTeam, isOfficeStaffAssignmentReference } from '../../utils/supportAssignmentTargets';

interface VehicleManagerPageProps {
    embedded?: boolean;
}

type VehicleTabId = 'status' | 'ledger' | 'history';

const vehicleTabs: SupportSegmentedTabOption<VehicleTabId>[] = [
    { id: 'status', label: '배정 및 청구현황', icon: faChartPie },
    { id: 'ledger', label: '차량 통합관리대장', icon: faTableCellsLarge },
    { id: 'history', label: '처리내역', icon: faHistory }
];

const normalizeKey = (value: unknown): string => String(value ?? '').trim();

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
    const [activeTab, setActiveTab] = useState<VehicleTabId>('status');

    // Modal State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
    const [setupInitialVehicleId, setSetupInitialVehicleId] = useState<string | null>(null);
    const [setupInitialSection, setSetupInitialSection] = useState<AssignmentBillingSection>('assignment');
    const [billingTargetInitialSplitMode, setBillingTargetInitialSplitMode] = useState(false);
    const [cancellationTarget, setCancellationTarget] = useState<Vehicle | null>(null);
    const [savingCancellation, setSavingCancellation] = useState(false);

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

    // 차량 필터링
    const filteredVehicles = React.useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        const selectedTeam = selectedTeamIdentity.team;
        const selectedTeamIsOffice = isOfficeAssignmentTeam(selectedTeam);
        return vehicles.filter(v => {
            const assigneeId = normalizeKey(v.currentAssigneeId);
            const assigneeName = normalizeKey(v.currentAssigneeName);
            const isOfficeStaffAssignee = (
                v.currentAssigneeType === 'WORKER' &&
                isOfficeStaffAssignmentReference(officeStaffRows, v.currentAssigneeId, v.currentAssigneeName)
            );
            const assigneeTeam = v.currentAssigneeType === 'TEAM'
                ? (teamByAnyId.get(assigneeId) ?? teamByName.get(assigneeName))
                : null;
            const isOfficeTeamAssignee = (
                v.currentAssigneeType === 'TEAM' &&
                (
                    isOfficeAssignmentReference(v.currentAssigneeId, v.currentAssigneeName) ||
                    isOfficeAssignmentTeam(assigneeTeam)
                )
            );
            const worker = v.currentAssigneeType === 'WORKER' && !isOfficeStaffAssignee
                ? (workerByAnyId.get(assigneeId) ?? workerByName.get(assigneeName))
                : null;
            const teamMatches = !selectedTeamId
                || (
                    v.currentAssigneeType === 'TEAM' &&
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
                    v.currentAssigneeType === 'WORKER' &&
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
    }, [vehicles, selectedTeamId, selectedTeamIdentity, teamByAnyId, teamByName, workerByAnyId, workerByName, searchTerm, officeStaffRows]);

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
    const openCancellationModal = (vehicle: Vehicle) => {
        setCancellationTarget(vehicle);
    };
    const handleCancellationSubmit = async (form: SupportCancellationFormValue) => {
        if (!cancellationTarget) return;
        const vehicle = cancellationTarget;
        setSavingCancellation(true);

        try {
            const activeBillingTargets = (await vehicleService.listAllVehicleBillingTargets(vehicle.id))
                .filter((target) => !String(target.endDate ?? '').trim());

            if (vehicle.currentAssigneeId || vehicle.currentAssigneeName) {
                await vehicleService.unassignVehicle(vehicle.id, form.processedDate);
            }

            if (activeBillingTargets.length > 0) {
                await vehicleService.applyVehicleBillingTargetChanges({
                    vehicleId: vehicle.id,
                    closeRecords: activeBillingTargets.map((target) => ({ id: target.id, endDate: form.processedDate })),
                    clearSnapshot: true
                });
            }

            await vehicleService.updateVehicle(vehicle.id, {
                status: 'DISPOSED',
                currentAssigneeId: null,
                currentAssigneeType: null,
                currentAssigneeName: null,
                billingTargetId: null,
                billingTargetType: null,
                billingTargetName: null
            } as unknown as Partial<Vehicle>);

            await supportCancellationLogService.createLog({
                resourceType: 'vehicle',
                resourceId: vehicle.id,
                resourceLabel: vehicle.licensePlate || vehicle.model || '차량',
                reason: form.reason,
                reasonLabel: form.reasonLabel,
                processedDate: form.processedDate,
                statusBefore: vehicle.status,
                statusAfter: 'DISPOSED',
                assigneeName: vehicle.currentAssigneeName || undefined,
                billingTargetName: vehicle.billingTargetName || undefined,
                settlementAmount: form.settlementAmount,
                note: form.note,
                snapshot: {
                    licensePlate: vehicle.licensePlate,
                    model: vehicle.model,
                    type: vehicle.type,
                    status: vehicle.status,
                    assigneeName: vehicle.currentAssigneeName,
                    billingTargetName: vehicle.billingTargetName,
                    contractStartDate: vehicle.contract?.startDate,
                    contractEndDate: vehicle.contract?.endDate,
                    monthlyFee: vehicle.contract?.monthlyFee,
                    financeCompany: vehicle.contract?.financeCompany?.name
                }
            });

            if (editingVehicle?.id === vehicle.id) {
                setEditingVehicle(null);
                setIsFormOpen(false);
            }
            if (setupInitialVehicleId === String(vehicle.id)) {
                setSetupInitialVehicleId(null);
                setBillingTargetInitialSplitMode(false);
                setIsSetupModalOpen(false);
            }
            setCancellationTarget(null);
            setActiveTab('history');
            handleRefresh();
        } catch (error) {
            console.error('Failed to process vehicle cancellation', error);
            window.alert('차량 사용취소 처리 중 오류가 발생했습니다.');
        } finally {
            setSavingCancellation(false);
        }
    };
    const handleRestoreUse = async (vehicle: Vehicle) => {
        if (vehicle.status !== 'DISPOSED') return;
        const ok = window.confirm(`${vehicle.licensePlate || vehicle.model || '차량'} 처리 상태를 취소하고 다시 사용 가능으로 변경할까요?`);
        if (!ok) return;

        try {
            await vehicleService.updateVehicle(vehicle.id, { status: 'AVAILABLE' } as Partial<Vehicle>);
            await supportCancellationLogService.createLog({
                resourceType: 'vehicle',
                resourceId: vehicle.id,
                resourceLabel: vehicle.licensePlate || vehicle.model || '차량',
                reason: 'OTHER',
                reasonLabel: '처리취소',
                processedDate: new Date().toISOString().slice(0, 10),
                statusBefore: vehicle.status,
                statusAfter: 'AVAILABLE',
                assigneeName: vehicle.currentAssigneeName || undefined,
                billingTargetName: vehicle.billingTargetName || undefined,
                note: '사용취소/만료 처리 번복',
                snapshot: {
                    licensePlate: vehicle.licensePlate,
                    model: vehicle.model,
                    type: vehicle.type,
                    status: vehicle.status,
                    contractEndDate: vehicle.contract?.endDate
                }
            });
            handleRefresh();
        } catch (error) {
            console.error('Failed to restore vehicle status', error);
            window.alert('차량 처리취소 중 오류가 발생했습니다.');
        }
    };
    const handleFormSuccess = () => {
        setIsFormOpen(false);
        setEditingVehicle(null);
        handleRefresh();
    };
    const handleFineChargeTargetChange = async (vehicleId: string, target: VehicleFineChargeTarget) => {
        const effectiveDate = new Date().toISOString().slice(0, 10);
        await vehicleService.updateVehicle(vehicleId, {
            fineChargeTarget: target,
            fineChargeTargetEffectiveDate: effectiveDate
        });
        setVehicles(prev => prev.map(vehicle => (
            String(vehicle.id) === String(vehicleId)
                ? { ...vehicle, fineChargeTarget: target, fineChargeTargetEffectiveDate: effectiveDate }
                : vehicle
        )));
    };

    const setupVehicle = React.useMemo(
        () => vehicles.find((vehicle) => String(vehicle.id) === String(setupInitialVehicleId)) ?? null,
        [setupInitialVehicleId, vehicles]
    );
    const setupVehicleAssigneeLabel = React.useMemo(() => {
        if (!setupVehicle?.currentAssigneeName) return '미배정';
        return `${setupVehicle.currentAssigneeType === 'TEAM' ? '팀' : '운전자'} · ${setupVehicle.currentAssigneeName}`;
    }, [setupVehicle]);
    const setupVehicleBillingLabel = React.useMemo(() => {
        if (!setupVehicle) return '미설정';
        if (setupVehicle.billingTargetName) {
            const targetType = setupVehicle.billingTargetType === 'TEAM'
                ? '팀'
                : setupVehicle.billingTargetType === 'WORKER'
                    ? '작업자'
                    : setupVehicle.billingTargetType === 'OFFICE'
                        ? '사무실'
                        : setupVehicle.billingTargetType === 'OFFICE_STAFF'
                            ? '사무실직원'
                            : '청구대상';
            return `${targetType} · ${setupVehicle.billingTargetName}`;
        }
        if (setupVehicle.currentAssigneeName) return '청구 탭에서 확인';
        return '미설정';
    }, [setupVehicle]);

    return (
        <div className={`${embedded ? 'space-y-5 sm:space-y-6 bg-transparent min-h-full w-full min-w-0 max-w-full overflow-x-hidden' : 'p-3 sm:p-6 space-y-5 sm:space-y-6 bg-slate-50 min-h-full w-full max-w-[calc(100vw-30px)] sm:max-w-full min-w-0 overflow-x-hidden'}`}>
            <SupportPageHeader
                icon={faCar}
                title="차량 통합관리"
                description="실시간 운전자 현황과 차량 통합관리대장을 관리합니다."
                tone="blue"
                actions={(
                    <>
                    <button
                        type="button"
                        onClick={() => navigate('/support/vehicles/oil-cycle')}
                        className="flex basis-[calc(50%-0.25rem)] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 font-bold text-white shadow-sm transition-all hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 sm:basis-auto sm:px-4"
                    >
                        <FontAwesomeIcon icon={faOilCan} />
                        <span>엔진오일 주기</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/support/vehicles/team-equipment')}
                        className="flex basis-[calc(50%-0.25rem)] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-bold text-slate-700 shadow-sm transition-all hover:border-blue-200 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:basis-auto sm:px-4"
                    >
                        <FontAwesomeIcon icon={faScrewdriverWrench} />
                        <span>팀 장비여부</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/support/vehicles/logs')}
                        className="flex basis-[calc(50%-0.25rem)] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-bold text-slate-700 shadow-sm transition-all hover:border-indigo-200 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:basis-auto sm:px-4"
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
                        onClick={() => {
                            setEditingVehicle(null);
                            setIsFormOpen(true);
                        }}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:scale-95 sm:flex-none"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        <span>차량 신규등록</span>
                    </button>
                    </>
                )}
            />

            {/* 필터 및 탭 섹션 */}
            <div className="flex max-w-full flex-col gap-2 overflow-hidden bg-white p-2 rounded-2xl border border-slate-200 shadow-sm xl:flex-row xl:items-center">
                <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center">
                    <SupportSegmentedTabs
                        options={vehicleTabs}
                        activeId={activeTab}
                        onChange={setActiveTab}
                        ariaLabel="차량 관리 보기"
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
                        조회 {filteredVehicles.length} / {vehicles.length}
                    </span>

                    <label className="relative block w-full sm:min-w-[240px] xl:w-72">
                        <FontAwesomeIcon icon={faSearch} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            aria-label="차량 검색"
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
                        <button type="button" onClick={handleRefresh} className="mt-4 rounded-lg bg-rose-100 px-4 py-2 text-sm font-bold text-rose-700 transition-all hover:bg-rose-200">다시 시도</button>
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
                        onCancelUse={openCancellationModal}
                        onRestoreUse={handleRestoreUse}
                    />
                ) : activeTab === 'ledger' ? (
                    <VehicleMonthlyLedger
                        key={refreshKey}
                        vehicles={filteredVehicles}
                        fineImportVehicles={vehicles}
                        teams={teams}
                        teamFilterId={selectedTeamId}
                        searchText={searchTerm}
                        loadingVehicles={loading}
                        onOpenSetup={openAssignmentVehicle}
                    />
                ) : (
                    <SupportCancellationHistory
                        resourceType="vehicle"
                        title="차량 사용취소 처리내역"
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
                summaryItems={[
                    { label: '현재 배정', value: setupVehicleAssigneeLabel, tone: setupVehicle?.currentAssigneeName ? 'indigo' : 'amber' },
                    { label: '현재 청구', value: setupVehicleBillingLabel, tone: setupVehicle?.billingTargetName ? 'indigo' : setupVehicle?.currentAssigneeName ? 'emerald' : 'amber' },
                    { label: '대장 반영', value: '저장 즉시 업데이트', tone: 'emerald' }
                ]}
                ledgerHint="저장하면 차량 현황, 차량 통합관리대장, 월별 청구대장에 바로 반영됩니다."
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

            <SupportCancellationModal
                isOpen={!!cancellationTarget}
                resourceType="vehicle"
                resourceLabel={cancellationTarget?.licensePlate || cancellationTarget?.model || '차량'}
                resourceDescription={cancellationTarget ? `${cancellationTarget.model || '모델 미입력'} · ${cancellationTarget.currentAssigneeName || '배정자 없음'}` : undefined}
                submitting={savingCancellation}
                onClose={() => setCancellationTarget(null)}
                onSubmit={handleCancellationSubmit}
            />

        </div>
    );
};
