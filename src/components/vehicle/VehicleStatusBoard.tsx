import React, { useMemo, useState } from 'react';
import { Vehicle, VehicleBillingTargetRecord, VehicleBillingTargetType, VehicleFineChargeTarget } from '../../types/vehicle';
import { Team } from '../../services/teamService';
import { Worker } from '../../services/manpowerService';
import { OfficeStaff, officeStaffService } from '../../services/officeStaffService';
import { vehicleService } from '../../services/vehicleService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCar, faCheckCircle, faClock,
    faWonSign, faExclamationTriangle, faBuilding, faUser, faUsers,
    faList, faTh, faPlus, faPenToSquare, faBoxArchive, faRotateLeft
} from '@fortawesome/free-solid-svg-icons';
import { iconMap } from '../../constants/iconMap';
import { OFFICE_ASSIGNMENT_TEAM_NAME, isOfficeStaffAssignmentReference } from '../../utils/supportAssignmentTargets';
import { getContrastingTextColor } from '../../utils/color';

interface TeamInfo {
    color: string;
    icon?: string;
}

interface VehicleStatusBoardProps {
    vehicles: Vehicle[];
    teams?: Team[];
    workers?: Worker[];
    loading: boolean;
    onEdit: (vehicle: Vehicle) => void;
    onAssign: (vehicle: Vehicle) => void;
    onBillingTargetAssign?: (vehicle: Vehicle) => void;
    onFineChargeTargetChange?: (vehicleId: string, target: VehicleFineChargeTarget) => Promise<void> | void;
    onCancelUse: (vehicle: Vehicle) => void;
    onRestoreUse: (vehicle: Vehicle) => void;
}

type VehicleStatusFilter = 'work' | 'active' | 'all' | 'ASSIGNED' | 'AVAILABLE' | 'MAINTENANCE' | 'DISPOSED';

const getTeamFaIcon = (iconName?: string) => {
    if (!iconName) return faUsers;
    return iconMap[iconName] || faUsers;
};

/** HEX → rgba 변환 유틸 */
const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
};

const getInitialViewMode = (): 'list' | 'card' => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches) {
        return 'card';
    }
    return 'list';
};

const normalizeKey = (value: unknown): string => String(value ?? '').trim();

const compareTeamThenVehicle = (leftTeam: string, rightTeam: string, leftName: string, rightName: string): number => {
    const normalizedLeftTeam = normalizeKey(leftTeam);
    const normalizedRightTeam = normalizeKey(rightTeam);
    if (normalizedLeftTeam && !normalizedRightTeam) return -1;
    if (!normalizedLeftTeam && normalizedRightTeam) return 1;
    const teamCompare = normalizedLeftTeam.localeCompare(normalizedRightTeam, 'ko-KR');
    if (teamCompare !== 0) return teamCompare;
    return normalizeKey(leftName).localeCompare(normalizeKey(rightName), 'ko-KR');
};

export const VehicleStatusBoard: React.FC<VehicleStatusBoardProps> = ({
    vehicles,
    teams = [],
    workers = [],
    loading,
    onEdit,
    onAssign,
    onBillingTargetAssign,
    onFineChargeTargetChange,
    onCancelUse,
    onRestoreUse
}) => {
    const [viewMode, setViewMode] = useState<'list' | 'card'>(getInitialViewMode);
    const [statusFilter, setStatusFilter] = useState<VehicleStatusFilter>('active');
    const [billingTargets, setBillingTargets] = useState<VehicleBillingTargetRecord[]>([]);
    const [officeStaffRows, setOfficeStaffRows] = useState<OfficeStaff[]>([]);
    const [fineTargetOverrides, setFineTargetOverrides] = useState<Record<string, VehicleFineChargeTarget>>({});
    const [savingFineTargetVehicleId, setSavingFineTargetVehicleId] = useState('');

    React.useEffect(() => {
        let mounted = true;
        Promise.all([
            vehicleService.listAllVehicleBillingTargets(),
            officeStaffService.getOfficeStaff().catch(() => [] as OfficeStaff[])
        ])
            .then(([records, officeStaffList]) => {
                if (!mounted) return;
                setBillingTargets(records);
                setOfficeStaffRows(officeStaffList);
            })
            .catch((error) => {
                console.error('Failed to load vehicle billing targets:', error);
            });
        return () => {
            mounted = false;
        };
    }, [vehicles]);

    const latestBillingTargetByVehicleId = useMemo(() => {
        const map = new Map<string, VehicleBillingTargetRecord>();
        billingTargets.forEach((target) => {
            const key = String(target.vehicleId ?? '').trim();
            if (!key) return;
            const current = map.get(key);
            if (!current || String(target.startDate ?? '').localeCompare(String(current.startDate ?? '')) > 0) {
                map.set(key, target);
            }
        });
        return map;
    }, [billingTargets]);

    const getLatestBillingTarget = (vehicle: Vehicle) => (
        latestBillingTargetByVehicleId.get(String(vehicle.id ?? '').trim())
    );

    // Build team info map: assigneeName -> {color, icon}
    const teamInfoMap = useMemo(() => {
        const map = new Map<string, TeamInfo>();
        teams.forEach(t => {
            if (t.color && t.name) map.set(t.name, { color: t.color, icon: t.icon || t.iconKey });
        });
        return map;
    }, [teams]);

    const teamNameById = useMemo(() => {
        const map = new Map<string, string>();
        teams.forEach((team) => {
            const id = normalizeKey(team.id);
            const legacyId = normalizeKey(team.legacyId);
            const name = normalizeKey(team.name);
            if (!name) return;
            if (id) map.set(id, name);
            if (legacyId) map.set(legacyId, name);
        });
        return map;
    }, [teams]);

    const workerTeamInfoMap = useMemo(() => {
        const map = new Map<string, TeamInfo>();
        workers.forEach((worker) => {
            const teamName = normalizeKey(worker.teamName) || teamNameById.get(normalizeKey(worker.teamId)) || '';
            const teamInfo = teamName ? teamInfoMap.get(teamName) : undefined;
            if (!teamInfo) return;
            [worker.id, worker.legacyId, worker.uid, worker.name].forEach((key) => {
                const normalized = normalizeKey(key);
                if (normalized) map.set(normalized, teamInfo);
            });
        });
        return map;
    }, [workers, teamInfoMap, teamNameById]);

    const workerTeamNameMap = useMemo(() => {
        const map = new Map<string, string>();
        workers.forEach((worker) => {
            const teamName = normalizeKey(worker.teamName) || teamNameById.get(normalizeKey(worker.teamId)) || '';
            if (!teamName) return;
            [worker.id, worker.legacyId, worker.uid, worker.name].forEach((key) => {
                const normalized = normalizeKey(key);
                if (normalized) map.set(normalized, teamName);
            });
        });
        return map;
    }, [workers, teamNameById]);

    const officeTeamInfo = useMemo<TeamInfo>(() => (
        teamInfoMap.get(OFFICE_ASSIGNMENT_TEAM_NAME) ?? { color: '#64748b', icon: 'fa-building' }
    ), [teamInfoMap]);

    const isOfficeStaffAssignee = React.useCallback((assigneeId?: unknown, assigneeName?: unknown) => (
        isOfficeStaffAssignmentReference(officeStaffRows, assigneeId, assigneeName)
    ), [officeStaffRows]);

    const hasVehicleWorkItem = React.useCallback((vehicle: Vehicle): boolean => {
        const status = vehicle.status || 'AVAILABLE';
        if (status === 'DISPOSED') return false;
        if (status === 'AVAILABLE' || status === 'MAINTENANCE') return true;

        const hasAssignment = Boolean(vehicle.currentAssigneeType && (vehicle.currentAssigneeId || vehicle.currentAssigneeName));
        const hasBillingSource = Boolean(
            getLatestBillingTarget(vehicle) ||
            (vehicle.billingTargetType && vehicle.billingTargetId) ||
            hasAssignment
        );

        return !hasBillingSource;
    }, [latestBillingTargetByVehicleId]);

    // 1. Statistics Calculation
    const stats = useMemo(() => {
        const total = vehicles.length;
        const operating = vehicles.filter(v => v.status === 'ASSIGNED').length;
        const available = vehicles.filter(v => v.status === 'AVAILABLE').length;
        const maintenance = vehicles.filter(v => v.status === 'MAINTENANCE').length;
        const active = vehicles.filter(v => (v.status || 'AVAILABLE') !== 'DISPOSED').length;
        const work = vehicles.filter(hasVehicleWorkItem).length;

        const totalMonthlyCost = vehicles.reduce((sum, v) => sum + (v.contract?.monthlyFee || 0), 0);

        return { total, operating, available, maintenance, active, work, totalMonthlyCost };
    }, [vehicles, hasVehicleWorkItem]);

    const statusFilteredVehicles = useMemo(() => {
        if (statusFilter === 'work') return vehicles.filter(hasVehicleWorkItem);
        if (statusFilter === 'active') return vehicles.filter((vehicle) => (vehicle.status || 'AVAILABLE') !== 'DISPOSED');
        if (statusFilter === 'all') return vehicles;
        return vehicles.filter((vehicle) => (vehicle.status || 'AVAILABLE') === statusFilter);
    }, [hasVehicleWorkItem, statusFilter, vehicles]);

    const getSummaryCardClassName = (filter: VehicleStatusFilter, baseClassName: string) =>
        `${baseClassName} ${statusFilter === filter ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`;

    // 2. Alert Logic (Contracts expiring soon, etc.)
    const expiringVehicles = useMemo(() => {
        const today = new Date();
        return vehicles.filter(v => {
            if (!v.contract?.endDate) return false;
            const endDate = new Date(v.contract.endDate);
            const diffTime = endDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= 30; // Expiring in 30 days
        });
    }, [vehicles]);

    // 3. Sorting Logic: billing team ㄱㄴㄷ > vehicle
    const sortedVehicles = useMemo(() => {
        return [...statusFilteredVehicles].sort((a, b) => {
            const getBillingTeamName = (vehicle: Vehicle): string => {
                const target = getLatestBillingTarget(vehicle);
                const targetType = target
                    ? target.targetType
                    : vehicle.billingTargetType && vehicle.billingTargetId
                        ? vehicle.billingTargetType
                        : vehicle.currentAssigneeType;
                const targetId = target
                    ? target.targetId
                    : vehicle.billingTargetType && vehicle.billingTargetId
                        ? vehicle.billingTargetId
                        : vehicle.currentAssigneeId;
                const targetName = target
                    ? target.targetName
                    : vehicle.billingTargetType && vehicle.billingTargetId
                        ? vehicle.billingTargetName
                        : vehicle.currentAssigneeName;

                if (targetType === 'TEAM') return normalizeKey(targetName);
                if (targetType === 'WORKER') {
                    if (isOfficeStaffAssignee(targetId, targetName)) return OFFICE_ASSIGNMENT_TEAM_NAME;
                    return workerTeamNameMap.get(normalizeKey(targetId)) || workerTeamNameMap.get(normalizeKey(targetName)) || '';
                }
                if (targetType === 'OFFICE' || targetType === 'OFFICE_STAFF') return OFFICE_ASSIGNMENT_TEAM_NAME;
                return '';
            };

            const teamCompare = compareTeamThenVehicle(
                getBillingTeamName(a),
                getBillingTeamName(b),
                normalizeKey(a.licensePlate) || normalizeKey(a.model),
                normalizeKey(b.licensePlate) || normalizeKey(b.model)
            );
            if (teamCompare !== 0) return teamCompare;
            return normalizeKey(a.model).localeCompare(normalizeKey(b.model), 'ko-KR');
        });
    }, [statusFilteredVehicles, latestBillingTargetByVehicleId, workerTeamNameMap, officeStaffRows]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ASSIGNED':
                return (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        운행중
                    </span>
                );
            case 'AVAILABLE':
                return (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                        대기중
                    </span>
                );
            case 'MAINTENANCE':
                return (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-50 text-orange-600 border border-orange-100 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>
                        정비중
                    </span>
                );
            case 'DISPOSED':
                return (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                        처리완료
                    </span>
                );
            default:
                return null;
        }
    };

    /** 테이블용 상태 배지 (inline) */
    const getStatusBadgeInline = (status: string) => {
        switch (status) {
            case 'ASSIGNED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        운행중
                    </span>
                );
            case 'AVAILABLE':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                        대기중
                    </span>
                );
            case 'MAINTENANCE':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-orange-50 text-orange-600 border border-orange-100">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>
                        정비중
                    </span>
                );
            case 'DISPOSED':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                        처리완료
                    </span>
                );
            default:
                return <span className="text-xs text-slate-300">-</span>;
        }
    };

    /** 차량 타입 라벨 */
    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'RENT': return '렌트';
            case 'LEASE': return '리스';
            case 'OWNED': return '자가';
            default: return type;
        }
    };

    const getBillingTargetTypeLabel = (vehicle: Vehicle) => {
        const type = getBillingTargetType(vehicle);
        const name = getBillingTargetName(vehicle);
        if (!name) return null;
        if (type === 'TEAM') return '팀';
        if (type === 'WORKER') {
            const target = getLatestBillingTarget(vehicle);
            const targetId = target
                ? target.targetId
                : vehicle.billingTargetType && vehicle.billingTargetId
                ? vehicle.billingTargetId
                : vehicle.currentAssigneeId;
            const targetName = getBillingTargetName(vehicle);
            return isOfficeStaffAssignee(targetId, targetName) ? '사무실직원' : '작업자';
        }
        if (type === 'OFFICE') return '사무실';
        if (type === 'OFFICE_STAFF') return '사무실직원';
        return '청구대상';
    };

    const hasActiveAssignment = (vehicle: Vehicle) => {
        return Boolean(vehicle.currentAssigneeId && vehicle.currentAssigneeType && vehicle.currentAssigneeName);
    };

    const getBillingTargetName = (vehicle: Vehicle) => {
        const target = getLatestBillingTarget(vehicle);
        if (target) return target.targetName ?? '';
        if (vehicle.billingTargetType && vehicle.billingTargetId) return vehicle.billingTargetName ?? '';
        if (!hasActiveAssignment(vehicle)) return '';
        return vehicle.currentAssigneeName ?? '';
    };

    const getBillingTargetType = (vehicle: Vehicle) => {
        const target = getLatestBillingTarget(vehicle);
        if (target) return target.targetType;
        if (vehicle.billingTargetType && vehicle.billingTargetId) return vehicle.billingTargetType;
        if (!hasActiveAssignment(vehicle)) return undefined;
        return vehicle.currentAssigneeType;
    };

    const getBillingTargetTeamInfo = (vehicle: Vehicle) => {
        const target = getLatestBillingTarget(vehicle);
        const type = getBillingTargetType(vehicle);
        const id = target
            ? target.targetId
            : vehicle.billingTargetType && vehicle.billingTargetId
            ? vehicle.billingTargetId
            : vehicle.currentAssigneeId;
        const name = getBillingTargetName(vehicle);
        if (type === 'TEAM') return teamInfoMap.get(name);
        if (type === 'WORKER') {
            if (isOfficeStaffAssignee(id, name)) return officeTeamInfo;
            return workerTeamInfoMap.get(normalizeKey(id)) || workerTeamInfoMap.get(normalizeKey(name));
        }
        if (type === 'OFFICE' || type === 'OFFICE_STAFF') return officeTeamInfo;
        return undefined;
    };

    const getAssigneeTeamInfo = (vehicle: Vehicle) => {
        if (vehicle.currentAssigneeType === 'TEAM' && vehicle.currentAssigneeName) {
            return teamInfoMap.get(vehicle.currentAssigneeName);
        }
        if (vehicle.currentAssigneeType === 'WORKER') {
            if (isOfficeStaffAssignee(vehicle.currentAssigneeId, vehicle.currentAssigneeName)) return officeTeamInfo;
            return workerTeamInfoMap.get(normalizeKey(vehicle.currentAssigneeId)) || workerTeamInfoMap.get(normalizeKey(vehicle.currentAssigneeName));
        }
        return undefined;
    };

    const getFineChargeTarget = (vehicle: Vehicle): VehicleFineChargeTarget => (
        fineTargetOverrides[String(vehicle.id)] ?? vehicle.fineChargeTarget ?? 'BILLING_TARGET'
    );

    const canChargeFineToDriver = (vehicle: Vehicle): boolean => (
        vehicle.currentAssigneeType === 'WORKER' &&
        Boolean(String(vehicle.currentAssigneeId ?? '').trim() || String(vehicle.currentAssigneeName ?? '').trim())
    );

    const handleFineChargeTargetChange = async (vehicle: Vehicle, target: VehicleFineChargeTarget) => {
        const vehicleId = String(vehicle.id ?? '').trim();
        if (!vehicleId) return;
        if (target === 'DRIVER' && !canChargeFineToDriver(vehicle)) return;

        const previous = getFineChargeTarget(vehicle);
        if (previous === target) return;

        setFineTargetOverrides(prev => ({ ...prev, [vehicleId]: target }));
        setSavingFineTargetVehicleId(vehicleId);
        try {
            if (onFineChargeTargetChange) {
                await onFineChargeTargetChange(vehicleId, target);
            } else {
                await vehicleService.updateVehicle(vehicleId, {
                    fineChargeTarget: target,
                    fineChargeTargetEffectiveDate: new Date().toISOString().slice(0, 10)
                });
            }
        } catch (error) {
            console.error('Failed to update vehicle fine charge target:', error);
            setFineTargetOverrides(prev => ({ ...prev, [vehicleId]: previous }));
            window.alert('과태료 부과대상 저장에 실패했습니다.');
        } finally {
            setSavingFineTargetVehicleId('');
        }
    };

    const renderFineChargeTargetToggle = (vehicle: Vehicle, compact = false) => {
        const selectedTarget = getFineChargeTarget(vehicle);
        const saving = savingFineTargetVehicleId === String(vehicle.id);
        return (
            <div className={`grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-0.5 ${compact ? 'min-w-[118px]' : 'w-full max-w-[160px]'}`}>
                {([
                    ['BILLING_TARGET', '청구대상'],
                    ['DRIVER', '운전자']
                ] as Array<[VehicleFineChargeTarget, string]>).map(([target, label]) => {
                    const driverDisabled = target === 'DRIVER' && !canChargeFineToDriver(vehicle);
                    const selected = selectedTarget === target;
                    return (
                        <button
                            key={target}
                            type="button"
                            disabled={saving || driverDisabled}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleFineChargeTargetChange(vehicle, target);
                            }}
                            className={`min-w-0 rounded-md px-1.5 py-1 text-[10px] font-extrabold leading-none transition-colors ${
                                selected
                                    ? target === 'DRIVER'
                                        ? 'bg-rose-600 text-white shadow-sm'
                                        : 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-500 hover:bg-white'
                            } ${saving || driverDisabled ? 'cursor-not-allowed opacity-45 hover:bg-transparent' : ''}`}
                            title={driverDisabled ? '현재 운전자가 없습니다' : `과태료 ${label} 부과`}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        );
    };

    const getTargetBadgeStyle = (type?: VehicleBillingTargetType | null, teamInfo?: TeamInfo) => {
        const color = teamInfo?.color;
        if (color) {
            return {
                backgroundColor: color,
                color: getContrastingTextColor(color),
                border: `1px solid ${color}`
            };
        }

        if (type === 'WORKER') return { backgroundColor: '#eef2ff', color: '#4338ca', border: '1px solid #e0e7ff' };
        if (type === 'OFFICE_STAFF') return { backgroundColor: '#ecfeff', color: '#0e7490', border: '1px solid #cffafe' };
        if (type === 'OFFICE') return { backgroundColor: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0' };
        return { backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' };
    };

    const getBillingModeBadge = (vehicle: Vehicle) => {
        const billingTargetName = getBillingTargetName(vehicle);
        if (!billingTargetName) {
            return { label: '미지정', className: 'bg-slate-50 text-slate-400 border-slate-100' };
        }

        const targetRows = billingTargets.filter((target) => normalizeKey(target.vehicleId) === normalizeKey(vehicle.id));
        const isSplit = targetRows.length > 1 || targetRows.some((target) => Boolean(normalizeKey(target.endDate)));
        if (isSplit) {
            return { label: '월중 변경', className: 'bg-amber-50 text-amber-700 border-amber-100' };
        }

        const hasAssignment = Boolean(vehicle.currentAssigneeType && (vehicle.currentAssigneeId || vehicle.currentAssigneeName));
        if (!hasAssignment) {
            return { label: '별도 청구', className: 'bg-violet-50 text-violet-700 border-violet-100' };
        }

        const latestTarget = getLatestBillingTarget(vehicle);
        const billingTargetType = latestTarget?.targetType ?? vehicle.billingTargetType ?? vehicle.currentAssigneeType;
        const billingTargetId = latestTarget?.targetId ?? vehicle.billingTargetId ?? vehicle.currentAssigneeId;
        const sameType = billingTargetType === vehicle.currentAssigneeType;
        const sameId = Boolean(
            billingTargetId
            && vehicle.currentAssigneeId
            && normalizeKey(billingTargetId) === normalizeKey(vehicle.currentAssigneeId)
        );
        const sameName = Boolean(
            billingTargetName
            && vehicle.currentAssigneeName
            && normalizeKey(billingTargetName) === normalizeKey(vehicle.currentAssigneeName)
        );

        if (!sameType || (!sameId && !sameName)) {
            return { label: '배정자와 다름', className: 'bg-blue-50 text-blue-700 border-blue-100' };
        }

        return { label: '배정자와 동일', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    };

    if (loading) {
        return (
            <div className="h-64 flex items-center justify-center text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (vehicles.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-20 text-center">
                <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                    <FontAwesomeIcon icon={faCar} className="text-4xl" />
                </div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">등록된 법인차량이 없습니다</h3>
                <p className="text-slate-400 mb-6">새로운 차량을 등록하여 관리를 시작해보세요.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Alerts Section */}
            {expiringVehicles.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-4 shadow-sm">
                    <div className="bg-amber-100 p-2 rounded-full text-amber-600">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="animate-swing" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-amber-800 text-sm mb-1">계약 만료 예정 차량이 {expiringVehicles.length}대 있습니다</h3>
                        <div className="flex flex-wrap gap-2">
                            {expiringVehicles.map(v => (
                                <span key={v.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-xs font-bold text-amber-700 shadow-sm">
                                    <FontAwesomeIcon icon={faCar} className="text-amber-400" />
                                    {v.licensePlate} ({v.contract?.endDate})
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                {/* Current Work */}
                {stats.work > 0 && (
                <button
                    type="button"
                    onClick={() => setStatusFilter('work')}
                    aria-pressed={statusFilter === 'work'}
                    className={getSummaryCardClassName('work', 'w-full text-left bg-white p-6 rounded-2xl border border-amber-100 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.12)] hover:shadow-lg transition-shadow relative overflow-hidden group')}
                >
                    <div className="absolute right-0 top-0 w-32 h-32 bg-amber-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-amber-600/80 uppercase tracking-wider mb-2">현재 업무</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-3xl font-extrabold text-slate-800">{stats.work}</h3>
                            <span className="text-sm font-bold text-slate-400">대</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-amber-700 bg-amber-50 w-fit px-2 py-1 rounded-lg">
                            <FontAwesomeIcon icon={faExclamationTriangle} /> 미배정·정비·청구확인
                        </div>
                    </div>
                </button>
                )}

                {/* Operating Stats */}
                <button
                    type="button"
                    onClick={() => setStatusFilter('ASSIGNED')}
                    aria-pressed={statusFilter === 'ASSIGNED'}
                    className={getSummaryCardClassName('ASSIGNED', 'w-full text-left bg-white p-6 rounded-2xl border border-emerald-100 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group')}
                >
                    <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-emerald-600/70 uppercase tracking-wider mb-2">운행 중</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-3xl font-extrabold text-slate-800">{stats.operating}</h3>
                            <span className="text-sm font-bold text-slate-400">대</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 w-fit px-2 py-1 rounded-lg">
                            <FontAwesomeIcon icon={faCheckCircle} /> 가동률 {stats.total > 0 ? Math.round((stats.operating / stats.total) * 100) : 0}%
                        </div>
                    </div>
                </button>

                {/* Cost Stats */}
                <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-[0_4px_20px_-4px_rgba(99,102,241,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-indigo-600/70 uppercase tracking-wider mb-2">총 월 고정비용</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-3xl font-extrabold text-slate-800">{stats.totalMonthlyCost.toLocaleString()}</h3>
                            <span className="text-sm font-bold text-slate-400">원</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-indigo-700 bg-indigo-50 w-fit px-2 py-1 rounded-lg">
                            <FontAwesomeIcon icon={faWonSign} /> 매월 렌트/리스료 합계
                        </div>
                    </div>
                </div>

                {/* Available Stats */}
                <button
                    type="button"
                    onClick={() => setStatusFilter('AVAILABLE')}
                    aria-pressed={statusFilter === 'AVAILABLE'}
                    className={getSummaryCardClassName('AVAILABLE', 'w-full text-left bg-white p-6 rounded-2xl border border-orange-100 shadow-[0_4px_20px_-4px_rgba(249,115,22,0.1)] hover:shadow-lg transition-shadow relative overflow-hidden group')}
                >
                    <div className="absolute right-0 top-0 w-32 h-32 bg-orange-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-orange-600/70 uppercase tracking-wider mb-2">운전자 지정 가능 (대기)</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-3xl font-extrabold text-slate-800">{stats.available}</h3>
                            <span className="text-sm font-bold text-slate-400">대</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-orange-700 bg-orange-50 w-fit px-2 py-1 rounded-lg">
                            <FontAwesomeIcon icon={faClock} /> 즉시 운전자 지정 가능
                        </div>
                    </div>
                </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-0.5">
                    {([
                        ['active', `현재 관리 ${stats.active}`],
                        ['DISPOSED', `보관/완료 ${stats.total - stats.active}`],
                        ['all', `전체 ${stats.total}`]
                    ] as Array<[VehicleStatusFilter, string]>).map(([filter, label]) => (
                        <button
                            key={filter}
                            type="button"
                            onClick={() => setStatusFilter(filter)}
                            className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                                statusFilter === filter
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                    {stats.work > 0 && (
                        <button
                            type="button"
                            onClick={() => setStatusFilter('work')}
                            className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                                statusFilter === 'work'
                                    ? 'bg-amber-500 text-white shadow-sm'
                                    : 'text-amber-700 hover:bg-amber-50'
                            }`}
                        >
                            확인 필요 {stats.work}
                        </button>
                    )}
                </div>
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5
                            ${viewMode === 'list'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'}`}
                        title="목록형"
                    >
                        <FontAwesomeIcon icon={faList} />
                        목록
                    </button>
                    <button
                        onClick={() => setViewMode('card')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5
                            ${viewMode === 'card'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'}`}
                        title="카드형"
                    >
                        <FontAwesomeIcon icon={faTh} />
                        카드
                    </button>
                </div>
            </div>

            {/* ── 목록형 (Table) ── */}
            {sortedVehicles.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        <FontAwesomeIcon icon={faCheckCircle} />
                    </div>
                    <h3 className="text-base font-black text-slate-800">
                        {statusFilter === 'active'
                            ? '현재 관리 중인 차량이 없습니다'
                            : statusFilter === 'DISPOSED'
                                ? '보관/완료 차량이 없습니다'
                                : statusFilter === 'work'
                                    ? '확인할 차량 업무가 없습니다'
                                    : '조건에 맞는 차량이 없습니다'}
                    </h3>
                    <p className="mt-1 text-sm font-medium text-slate-500">다른 보기를 선택하면 보관/완료 차량까지 함께 확인할 수 있습니다.</p>
                    <button
                        type="button"
                        onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
                        className="mt-5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                    >
                        {statusFilter === 'active' ? '전체 보기' : '현재 관리 보기'}
                    </button>
                </div>
            ) : viewMode === 'list' ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="support-compact-table support-compact-status w-full table-fixed text-xs">
                            <colgroup>
                                <col style={{ width: '3%' }} />
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '6%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '7%' }} />
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '5%' }} />
                                <col style={{ width: '9%' }} />
                                <col style={{ width: '7%' }} />
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '9%' }} />
                            </colgroup>
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider w-8">#</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">차량번호</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">차종 / 모델</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">상태</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">운전자</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">청구대상</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">청구방식</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">과태료</th>
                                    <th className="text-right px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">월 고정비용</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">결제일</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">계약기간</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider">렌트사(금융사)</th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wider w-40"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sortedVehicles.map((vehicle, rowIdx) => {
                                    const teamInfo = getAssigneeTeamInfo(vehicle);
                                    const isOfficeAssignee = isOfficeStaffAssignee(vehicle.currentAssigneeId, vehicle.currentAssigneeName);
                                    const tc = teamInfo?.color;
                                    const isContractExpired = vehicle.contract?.endDate && new Date(vehicle.contract.endDate) < new Date();
                                    const paymentDay = vehicle.contract?.paymentDay;
                                    const billingTargetTypeLabel = getBillingTargetTypeLabel(vehicle);
                                    const billingTargetType = getBillingTargetType(vehicle);
                                    const billingTargetName = getBillingTargetName(vehicle);
                                    const billingTargetTeamInfo = getBillingTargetTeamInfo(vehicle);
                                    const billingModeBadge = getBillingModeBadge(vehicle);
                                    const tcText = tc ? getContrastingTextColor(tc) : undefined;

                                    const needsWork = hasVehicleWorkItem(vehicle);
                                    const isDisposedVehicle = vehicle.status === 'DISPOSED';

                                    return (
                                        <tr
                                            key={vehicle.id}
                                            className={`hover:bg-indigo-50/40 transition-colors group ${needsWork ? 'bg-amber-50/35' : ''}`}
                                            style={tc ? { borderLeft: `3px solid ${tc}` } : needsWork ? { borderLeft: '3px solid #f59e0b' } : undefined}
                                        >
                                            <td className="px-4 py-3 text-xs text-slate-400 font-mono">{rowIdx + 1}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <span
                                                         className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-xs text-slate-400"
                                                         style={tc ? {
                                                             backgroundColor: tc,
                                                             color: tcText,
                                                             borderColor: tc,
                                                         } : undefined}
                                                    >
                                                        <FontAwesomeIcon icon={faCar} />
                                                    </span>
                                                     <span
                                                          className="truncate font-bold text-slate-800 transition-colors group-hover:text-indigo-600"
                                                      >
                                                        {vehicle.licensePlate}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500">
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-400">{getTypeLabel(vehicle.type)}</span>
                                                    <span className="font-medium text-slate-600">{vehicle.model}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {getStatusBadgeInline(vehicle.status || 'AVAILABLE')}
                                            </td>
                                            <td className="px-4 py-3">
                                                {vehicle.currentAssigneeName ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); onAssign(vehicle); }}
                                                        className="inline-flex max-w-[180px] items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold transition-transform hover:-translate-y-0.5"
                                                        style={getTargetBadgeStyle(vehicle.currentAssigneeType, teamInfo)}
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={vehicle.currentAssigneeType === 'TEAM'
                                                                ? getTeamFaIcon(teamInfo?.icon)
                                                                : isOfficeAssignee
                                                                    ? faBuilding
                                                                    : faUser}
                                                            className="text-[10px]"
                                                        />
                                                        <span className="truncate">{vehicle.currentAssigneeName}</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onAssign(vehicle); }}
                                                        className="inline-flex items-center gap-1 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100"
                                                    >
                                                        <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                                                        배정/청구
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {billingTargetName && billingTargetTypeLabel ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onBillingTargetAssign?.(vehicle);
                                                        }}
                                                        disabled={!onBillingTargetAssign}
                                                        className="inline-flex max-w-[190px] items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                                                        style={getTargetBadgeStyle(billingTargetType, billingTargetTeamInfo)}
                                                        title={`${billingTargetTypeLabel} · ${billingTargetName} · 청구대상 설정에서 이력 확인`}
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={billingTargetType === 'TEAM'
                                                                ? getTeamFaIcon(billingTargetTeamInfo?.icon)
                                                                : billingTargetType === 'OFFICE'
                                                                    ? faBuilding
                                                                    : faUser}
                                                            className="text-[10px]"
                                                        />
                                                        <span className="truncate">
                                                            {billingTargetTypeLabel} · {billingTargetName}
                                                        </span>
                                                    </button>
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-300">미지정</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex min-w-[88px] items-center justify-center rounded-md border px-2 py-1 text-[11px] font-extrabold ${billingModeBadge.className}`}>
                                                    {billingModeBadge.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-center">
                                                    {renderFineChargeTargetToggle(vehicle, true)}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-700">
                                                {vehicle.contract?.monthlyFee
                                                    ? <>{vehicle.contract.monthlyFee.toLocaleString()}<span className="text-slate-400 font-normal">원</span></>
                                                    : <span className="text-xs text-slate-300">-</span>}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {paymentDay ? (
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${Math.abs(paymentDay - new Date().getDate()) <= 3 ? 'bg-amber-100 text-amber-700' : 'text-slate-500'}`}>
                                                        {paymentDay}일
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {vehicle.contract?.startDate || vehicle.contract?.endDate ? (
                                                    <span className={`text-xs font-medium ${isContractExpired ? 'text-rose-500 font-bold' : 'text-slate-500'}`}>
                                                        {vehicle.contract?.startDate || '시작일 미입력'} ~ {vehicle.contract?.endDate || '무기한'}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center text-xs text-slate-500">
                                                {vehicle.contract?.financeCompany?.name || vehicle.insurance?.company || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onAssign(vehicle); }}
                                                        className="inline-flex h-7 items-center justify-center gap-1 rounded-md bg-indigo-50 px-2 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100"
                                                        aria-label={`배정/청구 설정: ${vehicle.licensePlate}`}
                                                        title="배정/청구 설정"
                                                    >
                                                        <FontAwesomeIcon icon={faUser} className="text-xs" />
                                                        <span>배정/청구</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onEdit(vehicle); }}
                                                        className="w-7 h-7 rounded-md bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
                                                        aria-label={`차량 정보 수정: ${vehicle.licensePlate}`}
                                                        title="차량 정보 수정"
                                                    >
                                                        <FontAwesomeIcon icon={faPenToSquare} className="text-xs" />
                                                    </button>
                                                    {isDisposedVehicle ? (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onRestoreUse(vehicle); }}
                                                            className="w-7 h-7 rounded-md bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-emerald-600 hover:text-emerald-700 transition-colors"
                                                            aria-label={`차량 처리취소: ${vehicle.licensePlate}`}
                                                            title="처리취소"
                                                        >
                                                            <FontAwesomeIcon icon={faRotateLeft} className="text-xs" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onCancelUse(vehicle); }}
                                                            className="w-7 h-7 rounded-md bg-slate-50 hover:bg-amber-50 flex items-center justify-center text-slate-400 hover:text-amber-600 transition-colors"
                                                            aria-label={`차량 사용취소 처리: ${vehicle.licensePlate}`}
                                                            title="사용취소 처리"
                                                        >
                                                            <FontAwesomeIcon icon={faBoxArchive} className="text-xs" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {/* Table Footer Summary */}
                    <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">
                            총 {statusFilteredVehicles.length} / {vehicles.length}대
                        </span>
                        <span className="text-slate-500 font-bold">
                            월 고정비용 합계: {vehicles
                                .reduce((sum, v) => sum + (v.contract?.monthlyFee || 0), 0)
                                .toLocaleString()}원
                        </span>
                    </div>
                </div>
            ) : (
                /* ── 카드형 (Grid) ── */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {sortedVehicles.map(vehicle => {
                        const teamInfo = getAssigneeTeamInfo(vehicle);
                        const isOfficeAssignee = isOfficeStaffAssignee(vehicle.currentAssigneeId, vehicle.currentAssigneeName);
                        const tc = teamInfo?.color;
                        const billingTargetTypeLabel = getBillingTargetTypeLabel(vehicle);
                        const billingTargetType = getBillingTargetType(vehicle);
                        const billingTargetName = getBillingTargetName(vehicle);
                        const billingTargetTeamInfo = getBillingTargetTeamInfo(vehicle);
                        const billingModeBadge = getBillingModeBadge(vehicle);
                        const tcText = tc ? getContrastingTextColor(tc) : undefined;

                        const needsWork = hasVehicleWorkItem(vehicle);
                        const isDisposedVehicle = vehicle.status === 'DISPOSED';

                        return (
                            <div
                                key={vehicle.id}
                                className={`group rounded-2xl border bg-white transition-all relative overflow-hidden ${needsWork ? 'border-amber-200 shadow-[0_8px_24px_-16px_rgba(245,158,11,0.65)]' : 'border-slate-200 hover:border-slate-300 hover:-translate-y-1'}`}
                                style={{
                                    borderLeftWidth: tc ? '4px' : undefined,
                                    borderLeftColor: tc || undefined,
                                    boxShadow: tc ? `0 4px 20px -4px ${hexToRgba(tc, 0.12)}` : undefined,
                                }}
                            >
                                {/* Team Color Gradient Top Bar */}
                                {tc && (
                                    <div className="h-1" style={{ background: `linear-gradient(to right, ${tc}, ${hexToRgba(tc, 0.1)}, transparent)` }} />
                                )}

                                <div className="p-6">
                                    {/* Status Line */}
                                    <div className="flex justify-between items-start mb-3">
                                        {getStatusBadge(vehicle.status || 'AVAILABLE')}
                                        <div className={`flex gap-2 transition-opacity ${needsWork ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onAssign(vehicle); }}
                                                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-indigo-50 px-3 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100"
                                                title="배정/청구 설정"
                                            >
                                                <FontAwesomeIcon icon={faUser} className="text-xs" />
                                                <span>설정</span>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onEdit(vehicle); }}
                                                className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
                                                title="차량 정보 수정"
                                            >
                                                <FontAwesomeIcon icon={faPenToSquare} className="text-xs" />
                                            </button>
                                            {isDisposedVehicle ? (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onRestoreUse(vehicle); }}
                                                    className="w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-emerald-600 hover:text-emerald-700 transition-colors"
                                                    title="처리취소"
                                                >
                                                    <FontAwesomeIcon icon={faRotateLeft} className="text-xs" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onCancelUse(vehicle); }}
                                                    className="w-8 h-8 rounded-full bg-slate-50 hover:bg-amber-100 flex items-center justify-center text-slate-400 hover:text-amber-700 transition-colors"
                                                    title="사용취소 처리"
                                                >
                                                    <FontAwesomeIcon icon={faBoxArchive} className="text-xs" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Team Badge (if assigned to team) */}
                                    {vehicle.currentAssigneeName && vehicle.currentAssigneeType === 'TEAM' && (
                                        <div className="mb-3">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); onAssign(vehicle); }}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-transform hover:-translate-y-0.5"
                                                  style={tc ? {
                                                      backgroundColor: tc,
                                                      color: tcText,
                                                      border: `1px solid ${tc}`,
                                                  } : {
                                                    backgroundColor: '#f1f5f9',
                                                    color: '#475569',
                                                    border: '1px solid #e2e8f0',
                                                }}
                                            >
                                                <FontAwesomeIcon icon={getTeamFaIcon(teamInfo?.icon)} className="text-xs" />
                                                {vehicle.currentAssigneeName}
                                            </button>
                                        </div>
                                    )}

                                    {/* Worker Badge (if assigned to individual) */}
                                    {vehicle.currentAssigneeName && vehicle.currentAssigneeType !== 'TEAM' && (
                                        <div className="mb-3">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); onAssign(vehicle); }}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-transform hover:-translate-y-0.5"
                                                style={getTargetBadgeStyle(vehicle.currentAssigneeType, teamInfo)}
                                            >
                                                <FontAwesomeIcon icon={isOfficeAssignee ? faBuilding : faUser} className="text-xs" />
                                                {vehicle.currentAssigneeName}
                                            </button>
                                        </div>
                                    )}

                                    {/* Title Info */}
                                    <h3 className="mb-1 flex min-w-0 items-center gap-2 text-xl font-black text-slate-800 transition-colors group-hover:text-indigo-700">
                                        <span
                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-sm text-slate-400"
                                              style={tc ? {
                                                  backgroundColor: tc,
                                                  color: tcText,
                                                  borderColor: tc,
                                              } : undefined}
                                        >
                                            <FontAwesomeIcon icon={faCar} />
                                        </span>
                                         <span
                                              className="truncate transition-colors group-hover:text-indigo-700"
                                          >
                                            {vehicle.licensePlate}
                                        </span>
                                    </h3>
                                    <p className="text-sm text-slate-500 font-medium mb-4 flex items-center gap-2">
                                        <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">{vehicle.type}</span>
                                        {vehicle.model}
                                    </p>

                                    {/* Detail Info */}
                                    <div className="space-y-3 pt-4 border-t border-slate-100">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-400 font-medium text-xs">청구 대상</span>
                                            {billingTargetName && billingTargetTypeLabel ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onBillingTargetAssign?.(vehicle);
                                                    }}
                                                    disabled={!onBillingTargetAssign}
                                                    className="inline-flex min-w-0 items-center gap-1.5 rounded px-2 py-0.5 text-xs font-bold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                                                    style={getTargetBadgeStyle(billingTargetType, billingTargetTeamInfo)}
                                                    title={`${billingTargetTypeLabel} · ${billingTargetName} · 청구대상 설정에서 이력 확인`}
                                                >
                                                    <FontAwesomeIcon
                                                        icon={billingTargetType === 'TEAM'
                                                            ? getTeamFaIcon(billingTargetTeamInfo?.icon)
                                                            : billingTargetType === 'OFFICE'
                                                                ? faBuilding
                                                                : faUser}
                                                        className="text-[10px]"
                                                    />
                                                    <span className="truncate">{billingTargetTypeLabel} · {billingTargetName}</span>
                                                </button>
                                            ) : (
                                                <span className="text-xs text-slate-300">미지정</span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between gap-2 text-sm">
                                            <span className="text-slate-400 font-medium text-xs">청구 방식</span>
                                            <span className={`inline-flex min-w-[88px] items-center justify-center rounded-md border px-2 py-0.5 text-[11px] font-extrabold ${billingModeBadge.className}`}>
                                                {billingModeBadge.label}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <span className="text-slate-400 font-medium text-xs">과태료</span>
                                            {renderFineChargeTargetToggle(vehicle, true)}
                                        </div>

                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-400 font-medium text-xs">월 고정비용</span>
                                            <span className="font-bold text-slate-700">
                                                {vehicle.contract?.monthlyFee ? `${vehicle.contract.monthlyFee.toLocaleString()}원` : '-'}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-400 font-medium text-xs">계약 기간</span>
                                            <span className={`font-bold text-xs px-2 py-0.5 rounded ${vehicle.contract?.endDate ? 'bg-slate-50 text-slate-600' : 'text-slate-300'
                                                }`}>
                                                {vehicle.contract?.startDate || '시작일 미입력'} ~ {vehicle.contract?.endDate || '무기한'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Unassigned indicator */}
                                    {!vehicle.currentAssigneeName && (
                                        <div className="mt-3 pt-3 border-t border-dashed border-slate-100 flex justify-center">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onAssign(vehicle); }}
                                                className="w-full py-2 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1.5"
                                            >
                                                <FontAwesomeIcon icon={faPlus} />
                                                배정/청구 설정
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
