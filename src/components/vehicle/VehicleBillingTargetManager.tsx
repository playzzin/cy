import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteField } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faFileInvoiceDollar, faPen, faRotateLeft, faTimes, faTrash } from '@fortawesome/free-solid-svg-icons';
import { Vehicle, VehicleBillingTargetRecord, VehicleBillingTargetType } from '../../types/vehicle';
import { Worker } from '../../services/manpowerService';
import { vehicleService } from '../../services/vehicleService';
import { Team } from '../../services/teamService';
import { OfficeStaff, officeStaffService } from '../../services/officeStaffService';
import { toast, showConfirmAlert } from '../../utils/swal';
import { hexToRgba, normalizeHexColor } from '../../utils/color';
import { formatTypedDateInput, normalizeTypedDateInput, toShortYearDateInputValue } from '../../utils/typedDateInput';
import { BillingStatusSummary } from '../support/BillingModeSelector';
import BillingPeriodTimeline, { BillingPeriodTimelineItem } from '../support/BillingPeriodTimeline';

type VehicleBillingMode = 'custom' | 'split';

interface BillingTargetSelection {
    type: VehicleBillingTargetType;
    id: string;
    name: string;
    group: string;
    detail?: string;
    color?: string;
}

interface VehicleBillingTargetManagerProps {
    vehicles: Vehicle[];
    workers?: Worker[];
    loading: boolean;
    initialVehicleId?: string | null;
    initialSplitMode?: boolean;
    selectableTeams?: Team[];
    onRefresh: () => void;
}

const getLatestTargetRecord = (records: VehicleBillingTargetRecord[]): VehicleBillingTargetRecord | undefined => (
    records
        .slice()
        .sort((a, b) => {
            const startDiff = String(b.startDate ?? '').localeCompare(String(a.startDate ?? ''));
            if (startDiff !== 0) return startDiff;
            return String(b.id ?? '').localeCompare(String(a.id ?? ''));
        })[0]
);

const displayDate = (value?: string | null): string => toShortYearDateInputValue(value) || '';
const toDateText = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const getTodayDateText = (): string => toDateText(new Date());

const getCurrentTargetRecord = (records: VehicleBillingTargetRecord[]): VehicleBillingTargetRecord | undefined => {
    const today = getTodayDateText();
    return records
        .slice()
        .sort((a, b) => {
            const startDiff = String(b.startDate ?? '').localeCompare(String(a.startDate ?? ''));
            if (startDiff !== 0) return startDiff;
            return String(b.id ?? '').localeCompare(String(a.id ?? ''));
        })
        .find((record) => {
            const startDate = normalizeKey(record.startDate);
            const endDate = normalizeKey(record.endDate);
            return (!startDate || startDate <= today) && (!endDate || endDate >= today);
        });
};

const buildEndDateAsDayBefore = (startDate: string): string => {
    const parsed = normalizeTypedDateInput(startDate);
    if (!parsed) return '';
    const [year, month, day] = parsed.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 1);
    return toDateText(date);
};

const makeBillingTargetId = (vehicleId: string, targetId: string, startDate: string): string => (
    `${vehicleId}_${targetId}_${startDate}_${Date.now()}`
);

const targetLabel = (vehicle: Vehicle, records: VehicleBillingTargetRecord[] = []): string => {
    const record = getCurrentTargetRecord(records);
    if (record) {
        const period = records.length > 1
            ? ` · ${displayDate(record.startDate) || '?'}~${displayDate(record.endDate) || '계속'}`
            : '';
        return `${getBillingTargetTypeLabel(record.targetType)} · ${record.targetName}${period}`;
    }
    if (vehicle.billingTargetType && vehicle.billingTargetId && vehicle.billingTargetName) {
        return `${getBillingTargetTypeLabel(vehicle.billingTargetType)} · ${vehicle.billingTargetName}`;
    }
    if (vehicle.currentAssigneeName) {
        return `${getBillingTargetTypeLabel(vehicle.currentAssigneeType as VehicleBillingTargetType)} · ${vehicle.currentAssigneeName}`;
    }
    return '청구대상 미지정';
};

const DEFAULT_BILLING_START_DATE = '2026-01-01';
const getDefaultBillingStartDate = () => toShortYearDateInputValue(DEFAULT_BILLING_START_DATE) || '26-01-01';
const OFFICE_TARGET_ID = '__office__';
const OFFICE_TARGET_NAME = '사무실';

const normalizeKey = (value: unknown): string => String(value ?? '').trim();

const includesCheongyeonKeyword = (...values: unknown[]): boolean => {
    const text = values.map((value) => String(value ?? '').toLowerCase()).join(' ');
    return ['청연이엔지', '청연엔지', '청연', 'cheongyeon'].some((keyword) => text.includes(keyword));
};

const getBillingTargetTypeLabel = (type?: VehicleBillingTargetType | null) => {
    if (type === 'TEAM') return '팀';
    if (type === 'WORKER') return '작업자';
    if (type === 'OFFICE') return '사무실';
    if (type === 'OFFICE_STAFF') return '사무실직원';
    return '청구대상';
};

const getTargetOptionKey = (type?: VehicleBillingTargetType | null, id?: string | null) => {
    const normalizedType = normalizeKey(type);
    const normalizedId = normalizeKey(id);
    return normalizedType && normalizedId ? `${normalizedType}:${normalizedId}` : '';
};

const getWorkerTargetId = (worker: Worker): string => (
    normalizeKey(worker.id) || normalizeKey(worker.legacyId) || normalizeKey(worker.name)
);

const getOfficeStaffTargetId = (staff: OfficeStaff): string => (
    normalizeKey(staff.id) || normalizeKey(staff.legacyId) || normalizeKey(staff.uid) || normalizeKey(staff.name)
);

export const VehicleBillingTargetManager: React.FC<VehicleBillingTargetManagerProps> = ({
    vehicles,
    workers = [],
    loading,
    initialVehicleId,
    initialSplitMode = false,
    selectableTeams = [],
    onRefresh
}) => {
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [selectedTargetKey, setSelectedTargetKey] = useState('');
    const [targetStartDate, setTargetStartDate] = useState(getDefaultBillingStartDate());
    const [targetEndDate, setTargetEndDate] = useState('');
    const [targetRecords, setTargetRecords] = useState<VehicleBillingTargetRecord[]>([]);
    const [officeStaffRows, setOfficeStaffRows] = useState<OfficeStaff[]>([]);
    const [targetRecordsLoading, setTargetRecordsLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingTargetRecordId, setEditingTargetRecordId] = useState<string | null>(null);
    const [billingMode, setBillingMode] = useState<VehicleBillingMode>(initialSplitMode ? 'split' : 'custom');

    const handleTargetStartDateChange = (value: string) => {
        setTargetStartDate(formatTypedDateInput(value, { yearDigits: 2 }));
    };

    const handleTargetEndDateChange = (value: string) => {
        setTargetEndDate(formatTypedDateInput(value, { yearDigits: 2 }));
    };

    const normalizeTargetStartDate = () => {
        setTargetStartDate((prev) => toShortYearDateInputValue(normalizeTypedDateInput(prev) ?? prev) || prev);
    };

    const normalizeTargetEndDate = () => {
        setTargetEndDate((prev) => prev ? (toShortYearDateInputValue(normalizeTypedDateInput(prev) ?? prev) || prev) : '');
    };

    useEffect(() => {
        let mounted = true;
        officeStaffService.getOfficeStaff()
            .then((rows) => {
                if (mounted) setOfficeStaffRows(rows);
            })
            .catch((error) => {
                console.error('Failed to load office staff:', error);
            });
        return () => {
            mounted = false;
        };
    }, []);

    const vehiclesById = useMemo(() => {
        const map = new Map<string, Vehicle>();
        vehicles.forEach((vehicle) => map.set(String(vehicle.id), vehicle));
        return map;
    }, [vehicles]);

    const selectedVehicle = useMemo(() => {
        if (!selectedVehicleId) return null;
        return vehiclesById.get(String(selectedVehicleId)) ?? null;
    }, [vehiclesById, selectedVehicleId]);
    const selectedTargetRecords = useMemo(
        () => targetRecords.filter((record) => String(record.vehicleId) === String(selectedVehicleId)),
        [targetRecords, selectedVehicleId]
    );
    const latestSelectedTargetRecord = useMemo(
        () => getLatestTargetRecord(selectedTargetRecords),
        [selectedTargetRecords]
    );
    const targetRecordsByVehicleId = useMemo(() => {
        const map = new Map<string, VehicleBillingTargetRecord[]>();
        targetRecords.forEach((record) => {
            const key = normalizeKey(record.vehicleId);
            if (!key) return;
            const list = map.get(key) ?? [];
            list.push(record);
            map.set(key, list);
        });
        map.forEach((list) => {
            list.sort((a, b) => {
                const startDiff = String(b.startDate ?? '').localeCompare(String(a.startDate ?? ''));
                if (startDiff !== 0) return startDiff;
                return String(b.id ?? '').localeCompare(String(a.id ?? ''));
            });
        });
        return map;
    }, [targetRecords]);
    const getVehicleTargetLabel = useCallback(
        (vehicle: Vehicle) => targetLabel(vehicle, targetRecordsByVehicleId.get(normalizeKey(vehicle.id)) ?? []),
        [targetRecordsByVehicleId]
    );
    const selectedVehicleHasExplicitBillingTarget = Boolean(
        (selectedVehicle?.billingTargetType && selectedVehicle?.billingTargetId) ||
        selectedTargetRecords.some((record) => !record.endDate || record.endDate >= getTodayDateText())
    );

    const explicitVehicleIds = useMemo(() => new Set(
        targetRecords
            .filter((record) => !record.endDate || record.endDate >= getTodayDateText())
            .map((record) => normalizeKey(record.vehicleId))
            .filter(Boolean)
    ), [targetRecords]);

    const explicitVehicles = useMemo(
        () => vehicles.filter((vehicle) => explicitVehicleIds.has(normalizeKey(vehicle.id)) || Boolean(vehicle.billingTargetType && vehicle.billingTargetId)),
        [vehicles, explicitVehicleIds]
    );

    const followingVehicles = useMemo(
        () => vehicles.filter((vehicle) => !explicitVehicleIds.has(normalizeKey(vehicle.id)) && (!vehicle.billingTargetType || !vehicle.billingTargetId)),
        [vehicles, explicitVehicleIds]
    );

    const selectableTeamIds = useMemo(() => new Set(
        selectableTeams
            .flatMap((team) => [team.id, team.legacyId])
            .map((value) => normalizeKey(value))
            .filter(Boolean)
    ), [selectableTeams]);

    const selectableTeamNames = useMemo(() => new Set(
        selectableTeams
            .map((team) => normalizeKey(team.name))
            .filter(Boolean)
    ), [selectableTeams]);

    const targetOptions = useMemo<BillingTargetSelection[]>(() => {
        const teamOptions: BillingTargetSelection[] = selectableTeams
            .filter((team) => Boolean(team.id && team.name))
            .slice()
            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko-KR'))
            .map((team) => ({
                type: 'TEAM',
                id: String(team.id),
                name: String(team.name),
                group: '청연이엔지 소속팀',
                detail: normalizeKey(team.companyName),
                color: normalizeHexColor(team.color)
            }));

        const workerOptions: BillingTargetSelection[] = workers
            .filter((worker) => {
                const teamId = normalizeKey(worker.teamId);
                const teamName = normalizeKey(worker.teamName);
                return (
                    selectableTeamIds.has(teamId) ||
                    selectableTeamNames.has(teamName) ||
                    includesCheongyeonKeyword(worker.companyName, worker.teamType, worker.teamName)
                );
            })
            .filter((worker) => Boolean(getWorkerTargetId(worker) && worker.name))
            .slice()
            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko-KR'))
            .map((worker) => ({
                type: 'WORKER',
                id: getWorkerTargetId(worker),
                name: String(worker.name),
                group: '작업자',
                detail: normalizeKey(worker.teamName) || normalizeKey(worker.companyName)
            }));

        const officeStaffOptions: BillingTargetSelection[] = officeStaffRows
            .filter((staff) => staff.isActive !== false)
            .filter((staff) => Boolean(getOfficeStaffTargetId(staff) && staff.name))
            .slice()
            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko-KR'))
            .map((staff) => ({
                type: 'OFFICE_STAFF',
                id: getOfficeStaffTargetId(staff),
                name: String(staff.name),
                group: '사무실직원',
                detail: normalizeKey(staff.department) || normalizeKey(staff.role)
            }));

        return [
            ...teamOptions,
            ...workerOptions,
            {
                type: 'OFFICE',
                id: OFFICE_TARGET_ID,
                name: OFFICE_TARGET_NAME,
                group: '사무실',
                detail: '사무실 공통 청구'
            },
            ...officeStaffOptions
        ];
    }, [officeStaffRows, selectableTeamIds, selectableTeamNames, selectableTeams, workers]);

    const targetOptionsByKey = useMemo(() => {
        const map = new Map<string, BillingTargetSelection>();
        targetOptions.forEach((target) => map.set(getTargetOptionKey(target.type, target.id), target));
        return map;
    }, [targetOptions]);

    useEffect(() => {
        if (selectedTargetKey || targetOptions.length === 0) return;
        setSelectedTargetKey(getTargetOptionKey(targetOptions[0].type, targetOptions[0].id));
    }, [selectedTargetKey, targetOptions]);

    const selectedTarget = useMemo<BillingTargetSelection | null>(
        () => targetOptionsByKey.get(selectedTargetKey) ?? null,
        [selectedTargetKey, targetOptionsByKey]
    );
    const selectedTargetTimelineItems = useMemo<BillingPeriodTimelineItem[]>(() => (
        selectedTargetRecords
            .slice()
            .sort((a, b) => {
                const startDiff = String(a.startDate ?? '').localeCompare(String(b.startDate ?? ''));
                if (startDiff !== 0) return startDiff;
                return String(a.id ?? '').localeCompare(String(b.id ?? ''));
            })
            .map((record) => {
                const option = targetOptionsByKey.get(getTargetOptionKey(record.targetType, record.targetId));
                return {
                    id: normalizeKey(record.id) || `${normalizeKey(record.vehicleId)}:${normalizeKey(record.startDate)}`,
                    label: normalizeKey(record.targetName) || '청구대상',
                    typeLabel: getBillingTargetTypeLabel(record.targetType),
                    startDate: record.startDate,
                    endDate: record.endDate,
                    color: option?.color
                };
            })
    ), [selectedTargetRecords, targetOptionsByKey]);
    const selectedTargetColor = selectedTarget?.color ? normalizeHexColor(selectedTarget.color) : '#64748b';
    const showTargetSelector = Boolean(selectedVehicle);
    const showTargetDateFields = Boolean(selectedVehicle && (billingMode === 'split' || editingTargetRecordId));
    const canSaveBilling = Boolean(selectedVehicle && selectedTarget);
    const saveButtonLabel = saving
        ? '처리 중...'
        : editingTargetRecordId
            ? '청구기간 수정'
            : billingMode === 'split' && selectedTargetRecords.length > 0
                ? '기간 나눠 저장'
                : '청구대상 저장';

    const clearVehicleBillingTargetSnapshot = async (vehicleId: string) => {
        await vehicleService.updateVehicle(vehicleId, {
            billingTargetId: deleteField(),
            billingTargetType: deleteField(),
            billingTargetName: deleteField(),
            billingTargetStartDate: deleteField(),
            billingTargetEndDate: deleteField()
        } as unknown as Partial<Vehicle>);
    };

    const setVehicleBillingTargetSnapshot = async (vehicleId: string, record: Pick<VehicleBillingTargetRecord, 'targetId' | 'targetType' | 'targetName' | 'startDate' | 'endDate'>) => {
        await vehicleService.updateVehicle(vehicleId, {
            billingTargetId: record.targetId,
            billingTargetType: record.targetType,
            billingTargetName: record.targetName,
            billingTargetStartDate: record.startDate,
            billingTargetEndDate: record.endDate || null
        } as unknown as Partial<Vehicle>);
    };

    const buildTargetRecord = (
        vehicle: Vehicle,
        target: BillingTargetSelection,
        startDate: string,
        endDate: string,
        id?: string
    ): Omit<VehicleBillingTargetRecord, 'createdAt' | 'updatedAt'> => ({
        id: id || makeBillingTargetId(vehicle.id, target.id, startDate),
        vehicleId: vehicle.id,
        vehiclePlate: vehicle.licensePlate,
        targetId: target.id,
        targetType: target.type,
        targetName: target.name,
        startDate,
        endDate: endDate || undefined
    });

    const buildCurrentAssigneeTargetRecord = (
        vehicle: Vehicle,
        startDate: string,
        endDate: string
    ): Omit<VehicleBillingTargetRecord, 'createdAt' | 'updatedAt'> | null => {
        const targetId = normalizeKey(vehicle.currentAssigneeId) || normalizeKey(vehicle.currentAssigneeName);
        if (!targetId || !vehicle.currentAssigneeName || !vehicle.currentAssigneeType) return null;

        return {
            id: makeBillingTargetId(vehicle.id, targetId, startDate),
            vehicleId: vehicle.id,
            vehiclePlate: vehicle.licensePlate,
            targetId,
            targetType: vehicle.currentAssigneeType as VehicleBillingTargetType,
            targetName: vehicle.currentAssigneeName,
            startDate,
            endDate,
            note: '분할 전 운전자'
        };
    };

    const clearExplicitBillingTarget = async (vehicle: Vehicle, effectiveDate: string = DEFAULT_BILLING_START_DATE) => {
        const records = await vehicleService.listAllVehicleBillingTargets(vehicle.id);
        const previousEndDate = buildEndDateAsDayBefore(effectiveDate);
        const deleteIds = records
            .filter((record) => normalizeKey(record.startDate) >= effectiveDate)
            .map((record) => record.id)
            .filter(Boolean);
        const closeRecords = records
            .filter((record) => {
                const startDate = normalizeKey(record.startDate);
                if (!startDate || startDate >= effectiveDate) return false;
                const endDate = normalizeKey(record.endDate);
                return !endDate || endDate >= effectiveDate;
            })
            .map((record) => ({ id: record.id, endDate: previousEndDate }))
            .filter((record) => Boolean(record.id && record.endDate));

        await vehicleService.applyVehicleBillingTargetChanges({
            vehicleId: vehicle.id,
            closeRecords,
            deleteIds,
            clearSnapshot: true
        });
    };

    const loadTargetRecords = async () => {
        setTargetRecordsLoading(true);
        try {
            const records = await vehicleService.listAllVehicleBillingTargets();
            setTargetRecords(records);
        } catch (error) {
            console.error(error);
            toast.error('청구대상 기간을 불러오지 못했습니다.');
        } finally {
            setTargetRecordsLoading(false);
        }
    };

    useEffect(() => {
        loadTargetRecords();
    }, []);

    const saveBillingTarget = async (
        vehicle: Vehicle,
        target: BillingTargetSelection | null,
        startDate: string = targetStartDate,
        endDate: string = targetEndDate
    ) => {
        setSaving(true);
        try {
            if (!target) {
                await clearExplicitBillingTarget(vehicle);
                setEditingTargetRecordId(null);
                toast.success('기준일 이후 별도 청구대상 설정을 해제했습니다.');
            } else {
                const latestRecord = latestSelectedTargetRecord;
                const shouldCreateSplitRecord = Boolean(billingMode === 'split' && !editingTargetRecordId && latestRecord);
                const targetRecordId = editingTargetRecordId ?? (billingMode !== 'split' ? latestRecord?.id : undefined);
                const upserts: Array<Omit<VehicleBillingTargetRecord, 'createdAt' | 'updatedAt'>> = [];
                const closeRecords: Array<{ id: string; endDate: string }> = [];

                if (shouldCreateSplitRecord && latestRecord) {
                    const previousEndDate = buildEndDateAsDayBefore(startDate);
                    if (previousEndDate && (!latestRecord.endDate || latestRecord.endDate >= startDate)) {
                        closeRecords.push({ id: latestRecord.id, endDate: previousEndDate });
                    }
                } else if (billingMode === 'split' && !editingTargetRecordId && !latestRecord) {
                    const previousEndDate = buildEndDateAsDayBefore(startDate);
                    const defaultRecord = buildCurrentAssigneeTargetRecord(vehicle, DEFAULT_BILLING_START_DATE, previousEndDate);
                    if (!defaultRecord) {
                        throw new Error('분할 전 운전자가 없어 분할청구를 만들 수 없습니다.');
                    }
                    upserts.push(defaultRecord);
                }

                const nextTargetRecord = buildTargetRecord(vehicle, target, startDate, endDate, targetRecordId);
                upserts.push(nextTargetRecord);
                await vehicleService.applyVehicleBillingTargetChanges({
                    vehicleId: vehicle.id,
                    closeRecords,
                    upserts,
                    clearSnapshot: true
                });
                await setVehicleBillingTargetSnapshot(vehicle.id, nextTargetRecord);
                toast.success(editingTargetRecordId ? '차량 청구대상 기간이 수정되었습니다.' : '차량 청구대상 기간이 추가되었습니다.');
                setEditingTargetRecordId(null);
            }
            await loadTargetRecords();
            onRefresh();
        } finally {
            setSaving(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedVehicle) {
            toast.error('차량을 선택해주세요.');
            return;
        }
        if (!selectedTarget) {
            toast.error('청구대상을 선택해주세요.');
            return;
        }
        if (showTargetDateFields && !targetStartDate) {
            toast.error('기간 시작일을 입력해주세요.');
            return;
        }
        const normalizedStartDate = normalizeTypedDateInput(targetStartDate) ?? DEFAULT_BILLING_START_DATE;
        if (!normalizedStartDate) {
            toast.error('기간 시작일을 YYYY-MM-DD 형식으로 입력해주세요.');
            return;
        }
        let normalizedEndDate = '';
        if (targetEndDate) {
            const parsedEndDate = normalizeTypedDateInput(targetEndDate);
            if (!parsedEndDate) {
                toast.error('기간 종료일을 YYYY-MM-DD 형식으로 입력해주세요.');
                return;
            }
            normalizedEndDate = parsedEndDate;
        }
        setTargetStartDate(toShortYearDateInputValue(normalizedStartDate));
        setTargetEndDate(toShortYearDateInputValue(normalizedEndDate));

        if (normalizedEndDate && normalizedEndDate < normalizedStartDate) {
            toast.error('청구 종료일은 시작일보다 빠를 수 없습니다.');
            return;
        }
        const latestRecord = latestSelectedTargetRecord;
        if (billingMode === 'split' && latestRecord && !editingTargetRecordId && normalizedStartDate <= latestRecord.startDate) {
            toast.error(`기간 시작일은 기존 최신 청구 시작일(${displayDate(latestRecord.startDate)})보다 뒤여야 합니다.`);
            return;
        }
        if (billingMode === 'split' && !latestRecord && !editingTargetRecordId && normalizedStartDate <= DEFAULT_BILLING_START_DATE) {
            toast.error('기간 시작일은 청구 시작일(26-01-01)보다 뒤여야 합니다.');
            return;
        }

        const result = await showConfirmAlert(
            '차량 청구',
            showTargetDateFields
                ? `${selectedVehicle.licensePlate} 차량을 ${displayDate(normalizedStartDate)}~${displayDate(normalizedEndDate) || '계속'} 기간 동안 ${getBillingTargetTypeLabel(selectedTarget.type)} · ${selectedTarget.name}에 청구할까요?`
                : `${selectedVehicle.licensePlate} 차량의 청구대상을 ${getBillingTargetTypeLabel(selectedTarget.type)} · ${selectedTarget.name}(으)로 저장할까요?`
        );
        if (!result.isConfirmed) return;

        try {
            await saveBillingTarget(selectedVehicle, selectedTarget, normalizedStartDate, normalizedEndDate);
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : '차량 청구 처리에 실패했습니다.');
        }
    };

    const handleReset = async (vehicle: Vehicle) => {
        const result = await showConfirmAlert(
            '별도청구 해제',
            `${vehicle.licensePlate} 차량의 별도 청구대상 설정을 삭제할까요?`
        );
        if (!result.isConfirmed) return;

        try {
            await saveBillingTarget(vehicle, null);
        } catch (error) {
            console.error(error);
            toast.error('별도청구 해제에 실패했습니다.');
        }
    };

    const handleDeleteTargetRecord = async (record: VehicleBillingTargetRecord) => {
        const result = await showConfirmAlert(
            '청구대상 삭제',
            `${record.vehiclePlate} ${getBillingTargetTypeLabel(record.targetType)} · ${record.targetName} 청구대상을 삭제할까요?`
        );
        if (!result.isConfirmed) return;

        setSaving(true);
        try {
            await vehicleService.deleteVehicleBillingTarget(record.id);
            if (selectedVehicle) {
                await clearVehicleBillingTargetSnapshot(selectedVehicle.id);
            }
            await loadTargetRecords();
            onRefresh();
            if (editingTargetRecordId === record.id) {
                setEditingTargetRecordId(null);
            }
            toast.success('청구대상이 삭제되었습니다.');
        } catch (error) {
            console.error(error);
            toast.error('청구대상 삭제에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const pickVehicle = (vehicle: Vehicle) => {
        setSelectedVehicleId(vehicle.id);
        const latestRecord = getLatestTargetRecord(targetRecordsByVehicleId.get(normalizeKey(vehicle.id)) ?? []);
        const nextBillingMode: VehicleBillingMode = initialSplitMode ? 'split' : 'custom';
        setBillingMode(nextBillingMode);
        setTargetStartDate(nextBillingMode === 'custom' && latestRecord ? (displayDate(latestRecord.startDate) || getDefaultBillingStartDate()) : getDefaultBillingStartDate());
        setTargetEndDate('');
        setEditingTargetRecordId(null);
        const targetKey = latestRecord
            ? getTargetOptionKey(latestRecord.targetType, latestRecord.targetId)
            : getTargetOptionKey(vehicle.billingTargetType, vehicle.billingTargetId);
        if (targetKey) setSelectedTargetKey(targetKey);
    };

    const handleEditTargetRecord = (record: VehicleBillingTargetRecord) => {
        setSelectedVehicleId(record.vehicleId);
        setBillingMode('custom');
        setEditingTargetRecordId(record.id);
        setSelectedTargetKey(getTargetOptionKey(record.targetType, record.targetId));
        setTargetStartDate(displayDate(record.startDate) || getDefaultBillingStartDate());
        setTargetEndDate(displayDate(record.endDate));
    };

    const handleCancelEditTargetRecord = () => {
        setEditingTargetRecordId(null);
        if (selectedVehicle) {
            const latestRecord = getLatestTargetRecord(targetRecordsByVehicleId.get(normalizeKey(selectedVehicle.id)) ?? []);
            setTargetStartDate(!initialSplitMode && latestRecord ? (displayDate(latestRecord.startDate) || getDefaultBillingStartDate()) : getDefaultBillingStartDate());
            setTargetEndDate('');
            const targetKey = latestRecord
                ? getTargetOptionKey(latestRecord.targetType, latestRecord.targetId)
                : getTargetOptionKey(selectedVehicle.billingTargetType, selectedVehicle.billingTargetId);
            if (targetKey) setSelectedTargetKey(targetKey);
        }
    };

    const handleBillingModeChange = (mode: VehicleBillingMode) => {
        setBillingMode(mode);
        setEditingTargetRecordId(null);
        setTargetEndDate('');

        if (mode === 'split') {
            setTargetStartDate(getDefaultBillingStartDate());
            return;
        }

        if (mode === 'custom' && selectedVehicle) {
            const latestRecord = getLatestTargetRecord(targetRecordsByVehicleId.get(normalizeKey(selectedVehicle.id)) ?? []);
            setTargetStartDate(latestRecord ? (displayDate(latestRecord.startDate) || getDefaultBillingStartDate()) : getDefaultBillingStartDate());
            setTargetEndDate(displayDate(latestRecord?.endDate));
            const targetKey = latestRecord
                ? getTargetOptionKey(latestRecord.targetType, latestRecord.targetId)
                : getTargetOptionKey(selectedVehicle.billingTargetType, selectedVehicle.billingTargetId);
            if (targetKey) setSelectedTargetKey(targetKey);
            return;
        }

        setTargetStartDate(getDefaultBillingStartDate());
    };

    const pickVehicleById = (vehicleId: string) => {
        const vehicle = vehiclesById.get(String(vehicleId));
        if (vehicle) {
            pickVehicle(vehicle);
            return;
        }
        setSelectedVehicleId(vehicleId);
    };

    useEffect(() => {
        if (!initialVehicleId) return;
        pickVehicleById(String(initialVehicleId));
    }, [initialVehicleId, initialSplitMode, targetRecordsByVehicleId, vehiclesById]);

    if (loading) {
        return (
            <div className="h-64 flex items-center justify-center text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                            <span className="bg-emerald-600 text-white w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                                <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-sm" />
                            </span>
                            차량 전체 청구
                        </h2>
                        <p className="text-slate-500 mt-2 font-medium ml-12 text-sm">
                            청연이엔지 소속팀, 작업자, 사무실, 사무실직원 중 하나를 청구대상으로 지정합니다.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleAssign}
                            disabled={saving || !canSaveBilling}
                            className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center gap-2 ${
                                saving || !canSaveBilling
                                    ? 'bg-emerald-400 cursor-not-allowed'
                                    : 'bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5'
                            }`}
                        >
                            <FontAwesomeIcon icon={faFileInvoiceDollar} />
                            {saveButtonLabel}
                        </button>
                        {editingTargetRecordId && (
                            <button
                                type="button"
                                onClick={handleCancelEditTargetRecord}
                                disabled={saving}
                                className="px-5 py-2.5 rounded-xl font-bold text-sm bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 disabled:text-slate-400 transition-all flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                                수정 취소
                            </button>
                        )}
                        <button
                            onClick={() => selectedVehicle && handleReset(selectedVehicle)}
                            disabled={saving || !selectedVehicleHasExplicitBillingTarget || !selectedVehicle}
                            className="px-5 py-2.5 rounded-xl font-bold text-sm bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-100 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faBan} />
                            별도청구 해제
                        </button>
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-4">
                    <div className="xl:col-span-12 space-y-3">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">차량 선택</label>
                                <select
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700"
                                    value={selectedVehicleId}
                                    onChange={(event) => pickVehicleById(event.target.value)}
                                >
                                    <option value="">차량을 선택하세요</option>
                                    {vehicles
                                        .slice()
                                        .sort((a, b) => String(a.licensePlate).localeCompare(String(b.licensePlate), 'ko-KR'))
                                        .map((vehicle) => (
                                            <option key={vehicle.id} value={vehicle.id}>
                                                {vehicle.licensePlate} · {vehicle.model} · {getVehicleTargetLabel(vehicle)}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            {selectedVehicle && (
                                <BillingStatusSummary
                                    items={[
                                        {
                                            label: '현재 운전자',
                                            value: selectedVehicle.currentAssigneeName || '미배정',
                                            tone: 'slate'
                                        },
                                        {
                                            label: '현재 청구대상',
                                            value: getVehicleTargetLabel(selectedVehicle),
                                            tone: selectedVehicleHasExplicitBillingTarget ? 'indigo' : 'emerald'
                                        },
                                        {
                                            label: '청구 시작일',
                                            value: displayDate(latestSelectedTargetRecord?.startDate) || '26-01-01',
                                            tone: 'amber'
                                        }
                                    ]}
                                />
                            )}

                            {showTargetSelector && (
                                <div className="relative">
                                    <label className="block text-xs font-bold text-slate-600 mb-1">청구대상 선택</label>
                                    {selectedTarget?.color && (
                                        <span
                                            className="pointer-events-none absolute left-3 top-9 h-3 w-3 rounded-full border border-white shadow-sm"
                                            style={{ backgroundColor: selectedTargetColor }}
                                        />
                                    )}
                                    <select
                                        className={`w-full rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700 ${
                                            selectedTarget?.color ? 'pl-8 pr-3' : 'px-3'
                                        }`}
                                        value={selectedTargetKey}
                                        onChange={(event) => setSelectedTargetKey(event.target.value)}
                                        style={
                                            selectedTarget?.color
                                                ? {
                                                    borderColor: hexToRgba(selectedTargetColor, 0.35),
                                                    backgroundColor: hexToRgba(selectedTargetColor, 0.05),
                                                    color: selectedTargetColor
                                                }
                                                : undefined
                                        }
                                    >
                                        <option value="">청구대상을 선택하세요</option>
                                        {['청연이엔지 소속팀', '작업자', '사무실', '사무실직원'].map((group) => {
                                            const groupOptions = targetOptions.filter((target) => target.group === group);
                                            if (groupOptions.length === 0) return null;
                                            return (
                                                <optgroup key={group} label={group}>
                                                    {groupOptions.map((target) => (
                                                        <option
                                                            key={getTargetOptionKey(target.type, target.id)}
                                                            value={getTargetOptionKey(target.type, target.id)}
                                                            style={target.color ? { color: normalizeHexColor(target.color) } : undefined}
                                                        >
                                                            {target.name}{target.detail ? ` · ${target.detail}` : ''}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            );
                                        })}
                                    </select>
                                    {selectedTarget && (
                                        <div className="mt-1 text-[11px] font-semibold text-slate-500">
                                            {selectedTarget.group} · {getBillingTargetTypeLabel(selectedTarget.type)}
                                            {selectedTarget.detail ? ` · ${selectedTarget.detail}` : ''}
                                        </div>
                                    )}
                                </div>
                            )}

                            {showTargetSelector && !editingTargetRecordId && (
                                <button
                                    type="button"
                                    onClick={() => handleBillingModeChange(billingMode === 'split' ? 'custom' : 'split')}
                                    disabled={!selectedVehicle}
                                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${
                                        billingMode === 'split'
                                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50/60'
                                    } ${!selectedVehicle ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                    <span className="min-w-0">
                                        <span className="block text-sm font-extrabold">기간 지정</span>
                                        <span className="mt-0.5 block text-xs font-semibold text-slate-500">
                                            월 중간에 청구대상이 바뀔 때만 켭니다.
                                        </span>
                                    </span>
                                    <span className={`ml-3 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                                        billingMode === 'split' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {billingMode === 'split' ? '분할청구' : '일반청구'}
                                    </span>
                                </button>
                            )}

                            {showTargetDateFields && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">
                                            {billingMode === 'split' ? '기간 시작일' : '청구 시작일'}
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={10}
                                            placeholder="YY-MM-DD"
                                            value={targetStartDate}
                                            onChange={(event) => handleTargetStartDateChange(event.target.value)}
                                            onBlur={normalizeTargetStartDate}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">
                                            {billingMode === 'split' ? '기간 종료일' : '청구 종료일'}
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={10}
                                            placeholder="선택"
                                            value={targetEndDate}
                                            onChange={(event) => handleTargetEndDateChange(event.target.value)}
                                            onBlur={normalizeTargetEndDate}
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700"
                                        />
                                    </div>
                                    <div className="sm:col-span-2 text-[11px] font-semibold text-slate-400">
                                        청구 시작일은 26-01-01입니다. 기간 지정은 월 중간 변경분을 나눌 때만 사용합니다.
                                    </div>
                                </div>
                            )}
                        </div>

                        {selectedVehicle && (
                            <div className="bg-white p-4 rounded-2xl border border-slate-200">
                                <div className="min-w-0">
                                    <div className="text-xs text-slate-500 font-bold">선택 차량</div>
                                    <div className="text-lg font-extrabold text-slate-900 truncate">{selectedVehicle.licensePlate}</div>
                                    <div className="text-sm text-slate-500 font-medium mt-1">{selectedVehicle.model} · {getVehicleTargetLabel(selectedVehicle)}</div>
                                </div>
                            </div>
                        )}

                        {selectedVehicle && (
                            <details open={Boolean(editingTargetRecordId)} className="group bg-white rounded-2xl border border-slate-200">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                                    <span className="min-w-0">
                                        <span className="block font-extrabold text-slate-800">청구기간 타임라인</span>
                                        <span className="mt-0.5 block truncate text-xs font-semibold text-slate-400">
                                            변경일 기준으로 이전 대상이 닫히고 다음 대상이 이어집니다.
                                        </span>
                                    </span>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-500">
                                        {selectedTargetRecords.length}건
                                    </span>
                                </summary>
                                <div className="border-t border-slate-100 p-4">
                                {targetRecordsLoading ? (
                                    <div className="text-sm text-slate-400">불러오는 중...</div>
                                ) : selectedTargetRecords.length === 0 ? (
                                    <div className="text-sm text-slate-400">등록된 청구대상이 없습니다.</div>
                                ) : (
                                    <div className="space-y-3">
                                        <BillingPeriodTimeline items={selectedTargetTimelineItems} />
                                        <div className="space-y-2 max-h-[220px] overflow-y-auto">
                                        {selectedTargetRecords
                                            .slice()
                                            .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))
                                            .map((record) => (
                                                <div key={record.id} className="rounded-xl border border-slate-100 p-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="font-extrabold text-slate-800 truncate">{record.targetName}</div>
                                                            <div className="text-xs text-slate-500 mt-1">
                                                                {getBillingTargetTypeLabel(record.targetType)}
                                                                {selectedTargetRecords.length > 1
                                                                    ? ` · ${displayDate(record.startDate)} ~ ${displayDate(record.endDate) || '계속'}`
                                                                    : ''}
                                                            </div>
                                                        </div>
                                                        <div className="flex shrink-0 gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEditTargetRecord(record)}
                                                                disabled={saving}
                                                                className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:text-slate-300"
                                                                title="청구기간 수정"
                                                            >
                                                                <FontAwesomeIcon icon={faPen} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteTargetRecord(record)}
                                                                disabled={saving}
                                                                className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:text-slate-300"
                                                                title="청구기간 삭제"
                                                            >
                                                                <FontAwesomeIcon icon={faTrash} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                </div>
                            </details>
                        )}
                    </div>

                    <div className="hidden">
                        <div className="bg-white p-4 rounded-2xl border border-slate-200">
                            <h3 className="font-extrabold text-slate-800 mb-3">미청구 차량</h3>
                            <div className="space-y-2 max-h-[390px] overflow-y-auto">
                                {followingVehicles.length === 0 ? (
                                    <div className="text-sm text-slate-400">미청구 차량이 없습니다.</div>
                                ) : (
                                    followingVehicles.map((vehicle) => (
                                        <button
                                            key={vehicle.id}
                                            onClick={() => pickVehicle(vehicle)}
                                            className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="font-extrabold text-slate-800 truncate">{vehicle.licensePlate}</div>
                                                <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">미청구</span>
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">{vehicle.model} · {getVehicleTargetLabel(vehicle)}</div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-200">
                            <h3 className="font-extrabold text-slate-800 mb-3">청구 차량</h3>
                            <div className="space-y-2 max-h-[390px] overflow-y-auto">
                                {explicitVehicles.length === 0 ? (
                                    <div className="text-sm text-slate-400">청구 설정된 차량이 없습니다.</div>
                                ) : (
                                    explicitVehicles.map((vehicle) => (
                                        <div
                                            key={vehicle.id}
                                            className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <button onClick={() => pickVehicle(vehicle)} className="min-w-0 text-left">
                                                    <div className="font-extrabold text-slate-800 truncate">{vehicle.licensePlate}</div>
                                                    <div className="text-xs text-slate-500 mt-1">{vehicle.model} · {getVehicleTargetLabel(vehicle)}</div>
                                                </button>
                                                <button
                                                    onClick={() => handleReset(vehicle)}
                                                    disabled={saving}
                                                    className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 text-slate-700 hover:bg-slate-100 inline-flex items-center gap-2"
                                                >
                                                    <FontAwesomeIcon icon={faRotateLeft} />
                                                    별도청구 해제
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                차량 사용자는 그대로 두고 비용 전체를 선택한 청구대상에 청구할 때 사용합니다. 한 달 안에 청구대상을 둘 이상 등록한 달만 고정비가 일수 기준으로 나뉘고, 다른 달은 최신 청구대상 1곳에 청구됩니다.
            </div>
        </div>
    );
};
