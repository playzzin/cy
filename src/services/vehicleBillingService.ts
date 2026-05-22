import {
    createVehicleBillingDocument,
    deleteVehicleBillingDocument,
    listAllVehicleBillingDocuments,
    listTeams,
    listAllVehicles,
    listWorkers,
    updateVehicleBillingDocument
} from './firestoreCrudCompat';
import { Vehicle, VehicleAssignmentRecord, VehicleBillingTargetRecord, VehicleBillingTargetType, VehicleExpenseRecord } from '../types/vehicle';
import { VehicleBillingDocument, VehicleBillingCostItem, VehicleBillingIssuedToType } from '../types/vehicleBilling';
import { vehicleService } from './vehicleService';
import { Timestamp } from 'firebase/firestore';

const normalizeKey = (value: unknown): string => String(value ?? '').trim();

const isUuidString = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

let dcTeamsLoaded = false;
let dcWorkersLoaded = false;

const dcTeamLegacyIdToUuid = new Map<string, string>();
const dcWorkerLegacyIdToUuid = new Map<string, string>();

const loadDcTeams = async (): Promise<void> => {
    if (dcTeamsLoaded) return;
    const res = await listTeams();
    const rows = (res as any)?.data?.teams ?? [];
    dcTeamLegacyIdToUuid.clear();
    for (const row of rows) {
        const uuid = row?.id ? String(row.id) : '';
        const legacyId = row?.legacyId ? String(row.legacyId) : '';
        if (uuid) dcTeamLegacyIdToUuid.set(uuid, uuid);
        if (legacyId && uuid) dcTeamLegacyIdToUuid.set(legacyId, uuid);
    }
    dcTeamsLoaded = true;
};

const loadDcWorkers = async (): Promise<void> => {
    if (dcWorkersLoaded) return;
    const res = await listWorkers();
    const rows = (res as any)?.data?.workers ?? [];
    dcWorkerLegacyIdToUuid.clear();
    for (const row of rows) {
        const uuid = row?.id ? String(row.id) : '';
        const legacyId = row?.legacyId ? String(row.legacyId) : '';
        if (uuid) dcWorkerLegacyIdToUuid.set(uuid, uuid);
        if (legacyId && uuid) dcWorkerLegacyIdToUuid.set(legacyId, uuid);
    }
    dcWorkersLoaded = true;
};

const resolveTeamUuid = async (id: string | undefined): Promise<string | null> => {
    const raw = id ? String(id) : '';
    if (!raw) return null;
    if (isUuidString(raw)) return raw;
    await loadDcTeams();
    const found = dcTeamLegacyIdToUuid.get(raw);
    if (found) return found;
    dcTeamsLoaded = false;
    await loadDcTeams();
    return dcTeamLegacyIdToUuid.get(raw) ?? null;
};

const resolveWorkerUuid = async (id: string | undefined): Promise<string | null> => {
    const raw = id ? String(id) : '';
    if (!raw) return null;
    if (isUuidString(raw)) return raw;
    await loadDcWorkers();
    const found = dcWorkerLegacyIdToUuid.get(raw);
    if (found) return found;
    dcWorkersLoaded = false;
    await loadDcWorkers();
    return dcWorkerLegacyIdToUuid.get(raw) ?? null;
};

const resolveVehicleUuid = async (id: string): Promise<string | null> => {
    if (!id) return null;
    if (isUuidString(id)) return id;
    const res = await listAllVehicles();
    const rows = (res as any)?.data?.vehicles ?? [];
    const hit = Array.isArray(rows)
        ? rows.find((r: any) => String(r?.id ?? '') === String(id) || String(r?.legacyId ?? '') === String(id))
        : null;
    return hit?.id ? String(hit.id) : null;
};

const findWorkerRow = async (id: string | undefined | null): Promise<any | null> => {
    const raw = id ? String(id) : '';
    if (!raw) return null;
    const res = await listWorkers();
    const rows = (res as any)?.data?.workers ?? [];
    if (!Array.isArray(rows)) return null;
    return rows.find((row: any) => (
        String(row?.id ?? '') === raw ||
        String(row?.legacyId ?? '') === raw
    )) ?? null;
};

const safeJsonParse = <T>(value: unknown, fallback: T): T => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
        return JSON.parse(trimmed) as T;
    } catch {
        return fallback;
    }
};

const toTimestamp = (value?: string | null): Timestamp | undefined => {
    if (!value) return undefined;
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return undefined;
    return Timestamp.fromDate(d);
};

const getLedgerRowIdSuffix = (id?: string | null): string => {
    const match = String(id ?? '').match(/(__row_.+)$/);
    return match ? match[1] : '';
};

const parseYmdDate = (value?: string | null): Date | null => {
    const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
    if (!matched) return null;
    const year = Number(matched[1]);
    const month = Number(matched[2]);
    const day = Number(matched[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
};

const formatYmdDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number): Date => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

const maxDate = (a: Date, b: Date): Date => (a.getTime() >= b.getTime() ? a : b);
const minDate = (a: Date, b: Date): Date => (a.getTime() <= b.getTime() ? a : b);

const inclusiveDays = (start: Date, end: Date): number => {
    if (end.getTime() < start.getTime()) return 0;
    return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
};

const getMonthRange = (yearMonth: string): { start: Date; end: Date; days: number } | null => {
    const matched = /^(\d{4})-(\d{2})$/.exec(String(yearMonth ?? '').trim());
    if (!matched) return null;
    const year = Number(matched[1]);
    const month = Number(matched[2]);
    if (!Number.isInteger(year) || month < 1 || month > 12) return null;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return { start, end, days: inclusiveDays(start, end) };
};

const isBillingTargetActiveOnDate = (target: VehicleBillingTargetRecord, date: Date): boolean => {
    const start = parseYmdDate(target.startDate);
    if (!start || start.getTime() > date.getTime()) return false;

    const end = target.endDate ? parseYmdDate(target.endDate) : null;
    if (end && end.getTime() < date.getTime()) return false;
    return true;
};

const findBillingTargetForDate = (targets: VehicleBillingTargetRecord[], date: Date): VehicleBillingTargetRecord | null => {
    return targets
        .filter((target) => isBillingTargetActiveOnDate(target, date))
        .sort((a, b) => {
            const startDiff = String(b.startDate ?? '').localeCompare(String(a.startDate ?? ''));
            if (startDiff !== 0) return startDiff;
            return String(b.id ?? '').localeCompare(String(a.id ?? ''));
        })[0] ?? null;
};

const resolveVehicleBillingTargetForDate = (
    vehicle: Vehicle,
    date: Date,
    targets: VehicleBillingTargetRecord[],
    assignment?: VehicleAssignmentRecord | null
): { targetType?: VehicleBillingTargetType | VehicleAssignmentRecord['assigneeType']; targetId?: string; targetName?: string } => {
    const target = findBillingTargetForDate(targets, date);
    if (target) {
        return {
            targetType: target.targetType,
            targetId: normalizeKey(target.targetId),
            targetName: normalizeKey(target.targetName)
        };
    }

    if (vehicle.billingTargetType && (vehicle.billingTargetId || vehicle.billingTargetName)) {
        return {
            targetType: vehicle.billingTargetType,
            targetId: normalizeKey(vehicle.billingTargetId) || normalizeKey(vehicle.billingTargetName),
            targetName: normalizeKey(vehicle.billingTargetName)
        };
    }

    if (assignment) {
        return {
            targetType: assignment.assigneeType,
            targetId: normalizeKey(assignment.assigneeId),
            targetName: normalizeKey(assignment.assigneeName)
        };
    }

    return {
        targetType: vehicle.currentAssigneeType,
        targetId: normalizeKey(vehicle.currentAssigneeId),
        targetName: normalizeKey(vehicle.currentAssigneeName)
    };
};

const findWorkerInRows = (workers: any[], id?: string | null, name?: string | null): any | null => {
    const rawId = id ? String(id) : '';
    const rawName = name ? String(name) : '';
    if (!rawId && !rawName) return null;
    return workers.find((row: any) => {
        const rowId = row?.id ? String(row.id) : '';
        const legacyId = row?.legacyId ? String(row.legacyId) : '';
        const rowName = row?.name ? String(row.name) : '';
        if (rawId && (rowId === rawId || legacyId === rawId)) return true;
        return Boolean(rawName && rowName === rawName);
    }) ?? null;
};

const getWorkerTeamId = (worker: any | null): string | undefined => {
    if (!worker) return undefined;
    return worker.teamId ? String(worker.teamId) : (worker.team?.id ? String(worker.team.id) : undefined);
};

const getWorkerTeamName = (worker: any | null): string | undefined => {
    if (!worker) return undefined;
    return worker.teamName ? String(worker.teamName) : (worker.team?.name ? String(worker.team.name) : undefined);
};

const getWorkerName = (worker: any | null): string | undefined => {
    if (!worker) return undefined;
    return worker.name ? String(worker.name) : undefined;
};

const normalizeVehicleBillingDocument = (d: any): VehicleBillingDocument => {
    const vehicle = d?.vehicle;
    const team = d?.team;
    const issuedToWorker = d?.issuedToWorker;

    const fallbackTeamId = d?.teamId
        ? String(d.teamId)
        : (d?.assignedTeamId ? String(d.assignedTeamId) : undefined);
    const fallbackTeamName = d?.teamName
        ? String(d.teamName)
        : (d?.assignedTeamName ? String(d.assignedTeamName) : undefined);

    const rawIssuedToType = d?.issuedToType ? String(d.issuedToType) : undefined;
    const issuedToType = rawIssuedToType === 'team_leader' ? 'team' : rawIssuedToType;
    const issuedToWorkerId = issuedToWorker?.id
        ? String(issuedToWorker.id)
        : (d?.issuedToWorkerId ? String(d.issuedToWorkerId) : undefined);

    return {
        id: String(d?.id ?? ''),
        yearMonth: String(d?.yearMonth ?? ''),
        vehicleId: vehicle?.id ? String(vehicle.id) : (d?.vehicleId ? String(d.vehicleId) : ''),
        vehiclePlate: d?.vehiclePlate ? String(d.vehiclePlate) : (vehicle?.licensePlate ? String(vehicle.licensePlate) : ''),
        assignedTeamId: d?.assignedTeamId ? String(d.assignedTeamId) : undefined,
        assignedTeamName: d?.assignedTeamName ? String(d.assignedTeamName) : undefined,
        teamId: team?.id ? String(team.id) : fallbackTeamId,
        teamName: d?.teamName ? String(d.teamName) : (team?.name ? String(team.name) : fallbackTeamName),
        issuedToType: issuedToType as VehicleBillingIssuedToType | undefined,
        issuedToWorkerId,
        issuedToWorkerName: issuedToType === 'team'
            ? (d?.teamName ? String(d.teamName) : (team?.name ? String(team.name) : fallbackTeamName))
            : (d?.issuedToWorkerName ? String(d.issuedToWorkerName) : (issuedToWorker?.name ? String(issuedToWorker.name) : undefined)),
        fixedCost: Number(d?.fixedCost ?? 0),
        variableCost: Number(d?.variableCost ?? 0),
        totalAmount: Number(d?.totalAmount ?? 0),
        status: (d?.status ? String(d.status) : 'DRAFT') as any,
        lineItems: safeJsonParse<VehicleBillingCostItem[]>(d?.lineItems, []),
        memo: d?.memo ? String(d.memo) : undefined,
        createdAt: toTimestamp(d?.createdAt),
        updatedAt: toTimestamp(d?.updatedAt),
        confirmedAt: toTimestamp(d?.confirmedAt)
    } as VehicleBillingDocument;
};

const findBillingDocumentById = async (id: string): Promise<VehicleBillingDocument | null> => {
    if (!id) return null;
    const res = await listAllVehicleBillingDocuments();
    const rows = (res as any)?.data?.vehicleBillingDocuments ?? [];
    const docs = Array.isArray(rows) ? rows : [];
    const row = docs.find((d: any) => String(d?.id ?? '') === String(id));
    return row ? normalizeVehicleBillingDocument(row) : null;
};

export const vehicleBillingService = {
    buildBillingDocumentId: (params: {
        vehicleId: string;
        teamId: string;
        issuedToType: 'team' | 'team_leader' | 'worker';
        workerId?: string;
        yearMonth: string;
    }): string => {
        const workerPart = params.workerId ? params.workerId : 'none';
        return `${params.vehicleId}_${params.teamId}_${params.issuedToType}_${workerPart}_${params.yearMonth}`;
    },

    // Generate Billing for a specific vehicle and month
    generateBilling: async (vehicle: Vehicle, yearMonth: string): Promise<VehicleBillingDocument> => {
        // 1. Get Expenses for the month
        const [expenses, billingTargets] = await Promise.all([
            vehicleService.getExpensesByVehicle(vehicle.id, yearMonth),
            vehicleService.listAllVehicleBillingTargets(vehicle.id).catch(() => [] as VehicleBillingTargetRecord[])
        ]);

        // 2. Calculate Costs
        const lineItems: VehicleBillingCostItem[] = [];

        // Fixed Cost (if valid contract)
        let fixedCost = 0;
        if (vehicle.type !== 'OWNED' && vehicle.contract) {
            // Check if contract covers this month? (Simplified Logic: if active, charge full)
            // TODO: Pro-rating logic can be added here
            fixedCost = vehicle.contract.monthlyFee;
            lineItems.push({
                id: 'fixed-rent',
                label: `Monthly Fee (${vehicle.type})`,
                amount: fixedCost,
                type: 'FIXED',
                category: 'RENT'
            });
        }

        // Variable Costs
        let variableCost = 0;
        expenses.forEach(exp => {
            variableCost += exp.amount;
            lineItems.push({
                id: exp.id,
                label: `${exp.type} - ${exp.date}`,
                amount: exp.amount,
                type: 'VARIABLE',
                category: exp.type
            });
        });

        const totalAmount = fixedCost + variableCost;
        const billingId = `${yearMonth}_${vehicle.id}`;

        const assignedWorker = vehicle.currentAssigneeType === 'WORKER'
            ? await findWorkerRow(vehicle.currentAssigneeId)
            : null;
        const assignedTeamId = vehicle.currentAssigneeType === 'TEAM'
            ? vehicle.currentAssigneeId
            : (assignedWorker?.teamId ? String(assignedWorker.teamId) : undefined);
        const assignedTeamName = vehicle.currentAssigneeType === 'TEAM'
            ? vehicle.currentAssigneeName
            : (assignedWorker?.teamName ? String(assignedWorker.teamName) : undefined);

        const monthStart = parseYmdDate(`${yearMonth}-01`) ?? new Date();
        const resolvedTarget = resolveVehicleBillingTargetForDate(vehicle, monthStart, billingTargets);
        const targetType = resolvedTarget.targetType;
        const targetId = resolvedTarget.targetId;
        const targetName = resolvedTarget.targetName;
        const targetWorker = targetType === 'WORKER'
            ? (targetId && String(targetId) === String(vehicle.currentAssigneeId) ? assignedWorker : await findWorkerRow(targetId))
            : null;

        const billingTeamId = targetType === 'TEAM' || targetType === 'OFFICE'
            ? (targetId ?? undefined)
            : (targetWorker?.teamId ? String(targetWorker.teamId) : assignedTeamId);
        const billingTeamName = targetType === 'TEAM' || targetType === 'OFFICE'
            ? (targetName ?? undefined)
            : (targetWorker?.teamName ? String(targetWorker.teamName) : assignedTeamName);
        const issuedToType: VehicleBillingIssuedToType | undefined =
            targetType === 'WORKER' || targetType === 'OFFICE_STAFF'
                ? 'worker'
                : billingTeamId
                    ? 'team'
                    : undefined;

        const billingDoc: VehicleBillingDocument = {
            id: billingId,
            yearMonth,
            vehicleId: vehicle.id,
            vehiclePlate: vehicle.licensePlate,
            assignedTeamId,
            assignedTeamName,
            teamId: billingTeamId,
            teamName: billingTeamName,
            issuedToType,
            issuedToWorkerId: issuedToType === 'worker' ? (targetId ?? undefined) : undefined,
            issuedToWorkerName: issuedToType === 'worker'
                ? (targetName ?? undefined)
                : billingTeamName,

            fixedCost,
            variableCost,
            totalAmount,
            status: 'DRAFT',
            lineItems,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        return billingDoc;
    },

    generateAssignmentBillings: async (vehicle: Vehicle, yearMonth: string): Promise<VehicleBillingDocument[]> => {
        const month = getMonthRange(yearMonth);
        if (!month) return [];

        const [expenses, assignments, billingTargets, workerRes] = await Promise.all([
            vehicleService.getExpensesByVehicle(vehicle.id, yearMonth),
            vehicleService.getAssignmentHistory(vehicle.id).catch(() => [] as VehicleAssignmentRecord[]),
            vehicleService.listAllVehicleBillingTargets(vehicle.id).catch(() => [] as VehicleBillingTargetRecord[]),
            listWorkers().catch(() => ({ data: { workers: [] } }))
        ]);
        const workers = (workerRes as any)?.data?.workers ?? [];

        const assignmentRanges = assignments
            .map((assignment) => {
                const start = parseYmdDate(assignment.startDate);
                if (!start) return null;
                const end = assignment.endDate ? parseYmdDate(assignment.endDate) : null;
                if ((end ?? month.end).getTime() < month.start.getTime()) return null;
                if (start.getTime() > month.end.getTime()) return null;
                return { assignment, start, end };
            })
            .filter((entry): entry is { assignment: VehicleAssignmentRecord; start: Date; end: Date | null } => Boolean(entry))
            .sort((a, b) => a.start.getTime() - b.start.getTime());

        const segments = assignmentRanges
            .map((entry, index) => {
                const nextStart = assignmentRanges[index + 1]?.start ?? null;
                const rawEnd = minDate(entry.end ?? month.end, month.end);
                const truncatedEnd = nextStart ? minDate(rawEnd, addDays(nextStart, -1)) : rawEnd;
                const start = maxDate(entry.start, month.start);
                const end = minDate(truncatedEnd, month.end);
                const dayCount = inclusiveDays(start, end);
                if (dayCount <= 0) return null;

                const assignedWorker = entry.assignment.assigneeType === 'WORKER'
                    ? findWorkerInRows(workers, entry.assignment.assigneeId, entry.assignment.assigneeName)
                    : null;
                const assignedTeamId = entry.assignment.assigneeType === 'TEAM'
                    ? entry.assignment.assigneeId
                    : getWorkerTeamId(assignedWorker);
                const assignedTeamName = entry.assignment.assigneeType === 'TEAM'
                    ? entry.assignment.assigneeName
                    : getWorkerTeamName(assignedWorker);

                return {
                    assignment: entry.assignment,
                    start,
                    end,
                    startDate: formatYmdDate(start),
                    endDate: formatYmdDate(end),
                    dayCount,
                    assignedTeamId,
                    assignedTeamName
                };
            })
            .filter((entry): entry is {
                assignment: VehicleAssignmentRecord;
                start: Date;
                end: Date;
                startDate: string;
                endDate: string;
                dayCount: number;
                assignedTeamId: string | undefined;
                assignedTeamName: string | undefined;
            } => Boolean(entry));

        if (segments.length === 0) return [];

        const grouped = new Map<string, VehicleBillingDocument>();

        const addLineItemToGroup = (segment: typeof segments[number], lineItem: VehicleBillingCostItem, billingDate: Date) => {
            const resolvedTarget = resolveVehicleBillingTargetForDate(vehicle, billingDate, billingTargets, segment.assignment);
            const targetType = resolvedTarget.targetType;
            const targetId = resolvedTarget.targetId;
            const targetName = resolvedTarget.targetName;
            const targetWorker = targetType === 'WORKER'
                ? findWorkerInRows(workers, targetId, targetName)
                : null;

            const billingTeamId = targetType === 'TEAM' || targetType === 'OFFICE'
                ? targetId
                : (getWorkerTeamId(targetWorker) || segment.assignedTeamId);
            const billingTeamName = targetType === 'TEAM' || targetType === 'OFFICE'
                ? targetName
                : (getWorkerTeamName(targetWorker) || segment.assignedTeamName);
            const issuedToType: VehicleBillingIssuedToType | undefined =
                targetType === 'WORKER' || targetType === 'OFFICE_STAFF'
                    ? 'worker'
                    : billingTeamId
                        ? 'team'
                        : undefined;
            const issuedToWorkerId = issuedToType === 'worker'
                ? ((targetWorker?.id ? String(targetWorker.id) : undefined) ?? targetId)
                : undefined;

            if (!issuedToType || !billingTeamId) return;

            const billingId = vehicleBillingService.buildBillingDocumentId({
                vehicleId: vehicle.id,
                teamId: billingTeamId,
                issuedToType,
                workerId: issuedToWorkerId,
                yearMonth
            });

            const existing = grouped.get(billingId);
            if (existing) {
                existing.lineItems.push(lineItem);
                if (lineItem.type === 'FIXED') {
                    existing.fixedCost += lineItem.amount;
                } else {
                    existing.variableCost += lineItem.amount;
                }
                existing.totalAmount += lineItem.amount;
                return;
            }

            const fixedCost = lineItem.type === 'FIXED' ? lineItem.amount : 0;
            const variableCost = lineItem.type === 'VARIABLE' ? lineItem.amount : 0;

            grouped.set(billingId, {
                id: billingId,
                yearMonth,
                vehicleId: vehicle.id,
                vehiclePlate: vehicle.licensePlate,
                assignedTeamId: segment.assignedTeamId,
                assignedTeamName: segment.assignedTeamName,
                teamId: billingTeamId,
                teamName: billingTeamName,
                issuedToType,
                issuedToWorkerId,
                issuedToWorkerName: issuedToType === 'worker'
                    ? (targetName ?? getWorkerName(targetWorker))
                    : billingTeamName,
                fixedCost,
                variableCost,
                totalAmount: fixedCost + variableCost,
                status: 'DRAFT',
                lineItems: [lineItem],
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
        };

        const monthlyFee = vehicle.type !== 'OWNED' ? Number(vehicle.contract?.monthlyFee ?? 0) : 0;
        if (Number.isFinite(monthlyFee) && monthlyFee > 0) {
            const contractStart = parseYmdDate(vehicle.contract?.startDate) ?? month.start;
            const contractEnd = parseYmdDate(vehicle.contract?.endDate) ?? month.end;
            const fixedSegments = segments
                .map((segment) => {
                    const start = maxDate(segment.start, contractStart);
                    const end = minDate(segment.end, contractEnd);
                    const dayCount = inclusiveDays(start, end);
                    if (dayCount <= 0) return null;
                    return { segment, startDate: formatYmdDate(start), endDate: formatYmdDate(end), dayCount };
                })
                .filter((entry): entry is {
                    segment: typeof segments[number];
                    startDate: string;
                    endDate: string;
                    dayCount: number;
                } => Boolean(entry));
            const totalFixedDays = fixedSegments.reduce((sum, entry) => sum + entry.dayCount, 0);
            const totalFixedAmount = Math.round((monthlyFee * totalFixedDays) / month.days);
            let allocatedFixedAmount = 0;

            fixedSegments.forEach((entry, index) => {
                const amount = index === fixedSegments.length - 1
                    ? totalFixedAmount - allocatedFixedAmount
                    : Math.round((totalFixedAmount * entry.dayCount) / totalFixedDays);
                allocatedFixedAmount += amount;
                if (amount <= 0) return;
                addLineItemToGroup(entry.segment, {
                    id: `fixed-${entry.segment.assignment.id}-${entry.startDate}-${entry.endDate}`,
                    label: `Monthly Fee (${vehicle.type}) ${entry.startDate}~${entry.endDate}`,
                    amount,
                    type: 'FIXED',
                    category: 'RENT'
                }, parseYmdDate(entry.startDate) ?? entry.segment.start);
            });
        }

        const findSegmentForDate = (date: Date) => {
            return segments.find((segment) => (
                segment.start.getTime() <= date.getTime() &&
                segment.end.getTime() >= date.getTime()
            )) ?? null;
        };

        expenses.forEach((expense: VehicleExpenseRecord) => {
            const expenseDate = parseYmdDate(expense.date);
            if (!expenseDate) return;
            const segment = findSegmentForDate(expenseDate);
            if (!segment) return;
            const amount = Number(expense.amount ?? 0);
            if (!Number.isFinite(amount)) return;
            addLineItemToGroup(segment, {
                id: expense.id,
                label: `${expense.type} - ${expense.date}`,
                amount,
                type: 'VARIABLE',
                category: expense.type
            }, expenseDate);
        });

        return Array.from(grouped.values());
    },

    // Save Billing Document
    saveBilling: async (billing: VehicleBillingDocument) => {
        try {
            const vehicleId = await resolveVehicleUuid(billing.vehicleId);
            if (!vehicleId) throw new Error('Vehicle not found');

            const teamUuid = await resolveTeamUuid(billing.teamId);
            const issuedToTypeRaw = billing.issuedToType ? String(billing.issuedToType) : '';
            const issuedToType = issuedToTypeRaw === 'team_leader' ? 'team' : issuedToTypeRaw;
            const shouldRequireWorker = issuedToType === 'worker';
            const issuedToWorkerUuid = shouldRequireWorker ? await resolveWorkerUuid(billing.issuedToWorkerId) : null;

            const ledgerRowIdSuffix = getLedgerRowIdSuffix(billing.id);
            const canonicalId =
                teamUuid && issuedToType && (issuedToType === 'team' || issuedToWorkerUuid)
                    ? `${vehicleBillingService.buildBillingDocumentId({
                        vehicleId,
                        teamId: teamUuid,
                        issuedToType: issuedToType as any,
                        workerId: issuedToWorkerUuid ?? undefined,
                        yearMonth: billing.yearMonth
                    })}${ledgerRowIdSuffix}`
                    : billing.id;

            const beforeBilling = await findBillingDocumentById(canonicalId).catch(() => null);

            const payloadV2 = {
                id: canonicalId,
                yearMonth: billing.yearMonth,
                vehicleId,
                vehiclePlate: billing.vehiclePlate,
                assignedTeamId: billing.assignedTeamId ?? null,
                assignedTeamName: billing.assignedTeamName ?? null,
                teamId: teamUuid,
                teamName: billing.teamName ?? null,
                issuedToType: issuedToType || null,
                issuedToWorkerId: issuedToWorkerUuid,
                issuedToWorkerName: issuedToType === 'team' ? (billing.teamName ?? null) : (billing.issuedToWorkerName ?? null),
                fixedCost: billing.fixedCost,
                variableCost: billing.variableCost,
                totalAmount: billing.totalAmount,
                status: billing.status,
                lineItems: JSON.stringify(billing.lineItems ?? []),
                memo: billing.memo ?? null,
                confirmedAt: billing.confirmedAt ? billing.confirmedAt.toDate().toISOString() : null
            };

            const payloadV1 = {
                id: canonicalId,
                yearMonth: billing.yearMonth,
                vehicleId,
                vehiclePlate: billing.vehiclePlate,
                assignedTeamId: billing.assignedTeamId ?? null,
                assignedTeamName: billing.assignedTeamName ?? null,
                fixedCost: billing.fixedCost,
                variableCost: billing.variableCost,
                totalAmount: billing.totalAmount,
                status: billing.status,
                lineItems: JSON.stringify(billing.lineItems ?? []),
                memo: billing.memo ?? null
            };

            try {
                try {
                    await createVehicleBillingDocument(payloadV2 as any);
                } catch {
                    await createVehicleBillingDocument(payloadV1 as any);
                }

                if (billing.confirmedAt) {
                    try {
                        await updateVehicleBillingDocument({
                            id: canonicalId,
                            status: billing.status,
                            confirmedAt: billing.confirmedAt.toDate().toISOString()
                        } as any);
                    } catch {
                        await updateVehicleBillingDocument({
                            id: canonicalId,
                            yearMonth: billing.yearMonth,
                            vehiclePlate: billing.vehiclePlate,
                            assignedTeamId: billing.assignedTeamId ?? null,
                            assignedTeamName: billing.assignedTeamName ?? null,
                            fixedCost: billing.fixedCost,
                            variableCost: billing.variableCost,
                            totalAmount: billing.totalAmount,
                            status: billing.status,
                            lineItems: JSON.stringify(billing.lineItems ?? []),
                            memo: billing.memo ?? null,
                            confirmedAt: billing.confirmedAt.toDate().toISOString()
                        } as any);
                    }
                }
            } catch {
                try {
                    await updateVehicleBillingDocument(payloadV2 as any);
                } catch {
                    await updateVehicleBillingDocument({
                        ...payloadV1,
                        confirmedAt: billing.confirmedAt ? billing.confirmedAt.toDate().toISOString() : null
                    } as any);
                }
            }

            const savedBilling: VehicleBillingDocument = {
                ...billing,
                id: canonicalId,
                vehicleId,
                teamId: teamUuid ?? undefined,
                issuedToType: issuedToType ? issuedToType as VehicleBillingIssuedToType : undefined,
                issuedToWorkerId: issuedToWorkerUuid ?? undefined,
                issuedToWorkerName: issuedToType === 'team' ? (billing.teamName ?? undefined) : billing.issuedToWorkerName,
                lineItems: billing.lineItems ?? [],
                updatedAt: Timestamp.now()
            };

            try {
                const { vehicleBillingLogService } = await import('./vehicleBillingLogService');
                await vehicleBillingLogService.createLog({
                    action: beforeBilling ? 'updated' : 'created',
                    before: beforeBilling,
                    after: savedBilling,
                    source: 'vehicleBillingService.saveBilling'
                });
            } catch (logError) {
                console.warn('[vehicleBillingService] vehicle billing log failed:', logError);
            }
        } catch (error) {
            console.error("Error saving billing:", error);
            throw error;
        }
    },

    // Get Billings for a Month
    getBillingsByMonth: async (yearMonth: string) => {
        try {
            const res = await listAllVehicleBillingDocuments();
            const rows = (res as any)?.data?.vehicleBillingDocuments ?? [];
            const docs = Array.isArray(rows) ? rows : [];

            return docs
                .filter((d: any) => String(d?.yearMonth ?? '') === String(yearMonth))
                .map(normalizeVehicleBillingDocument);
        } catch (error) {
            console.error("Error fetching billings:", error);
            return [];
        }
    },

    getBillingById: async (id: string): Promise<VehicleBillingDocument | null> => {
        try {
            return await findBillingDocumentById(id);
        } catch (error) {
            console.error("Error fetching billing:", error);
            return null;
        }
    },

    deleteBilling: async (id: string): Promise<void> => {
        const beforeBilling = await findBillingDocumentById(id).catch(() => null);
        await deleteVehicleBillingDocument({ id } as any);
        if (beforeBilling) {
            try {
                const { vehicleBillingLogService } = await import('./vehicleBillingLogService');
                await vehicleBillingLogService.createLog({
                    action: 'deleted',
                    before: beforeBilling,
                    after: null,
                    source: 'vehicleBillingService.deleteBilling'
                });
            } catch (logError) {
                console.warn('[vehicleBillingService] vehicle billing delete log failed:', logError);
            }
        }
    },

    // Generate for ALL vehicles
    generateMonthlyBillings: async (yearMonth: string) => {
        try {
            const vehicles = await vehicleService.getVehicles();
            const groups = await Promise.all(vehicles.map(v => vehicleBillingService.generateAssignmentBillings(v, yearMonth)));
            return groups.reduce<VehicleBillingDocument[]>((acc, list) => acc.concat(list), []);
        } catch (error) {
            console.error("Error batch generating billings:", error);
            throw error;
        }
    }
};

