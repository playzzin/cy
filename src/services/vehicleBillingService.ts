import {
    createVehicleBillingDocument,
    listAllVehicleBillingDocuments,
    listTeams,
    listAllVehicles,
    listWorkers,
    updateVehicleBillingDocument
} from './firestoreCrudCompat';
import { Vehicle } from '../types/vehicle';
import { VehicleBillingDocument, VehicleBillingCostItem } from '../types/vehicleBilling';
import { vehicleService } from './vehicleService';
import { Timestamp } from 'firebase/firestore';

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
        const expenses = await vehicleService.getExpensesByVehicle(vehicle.id, yearMonth);

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

        const hasExplicitBillingTarget = Boolean(vehicle.billingTargetType && vehicle.billingTargetId);
        const targetType = hasExplicitBillingTarget ? vehicle.billingTargetType : vehicle.currentAssigneeType;
        const targetId = hasExplicitBillingTarget ? vehicle.billingTargetId : vehicle.currentAssigneeId;
        const targetName = hasExplicitBillingTarget ? vehicle.billingTargetName : vehicle.currentAssigneeName;
        const targetWorker = targetType === 'WORKER'
            ? (targetId && String(targetId) === String(vehicle.currentAssigneeId) ? assignedWorker : await findWorkerRow(targetId))
            : null;

        const issuedToType =
            targetType === 'TEAM'
                ? 'team'
                : targetType === 'WORKER'
                    ? 'worker'
                    : undefined;

        const billingTeamId = targetType === 'TEAM'
            ? (targetId ?? undefined)
            : (targetWorker?.teamId ? String(targetWorker.teamId) : assignedTeamId);
        const billingTeamName = targetType === 'TEAM'
            ? (targetName ?? undefined)
            : (targetWorker?.teamName ? String(targetWorker.teamName) : assignedTeamName);

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
            issuedToWorkerName: issuedToType === 'team'
                ? (targetName ?? undefined)
                : issuedToType === 'worker'
                    ? (targetName ?? undefined)
                    : undefined,

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

            const canonicalId =
                teamUuid && issuedToType && (issuedToType === 'team' || issuedToWorkerUuid)
                    ? vehicleBillingService.buildBillingDocumentId({
                        vehicleId,
                        teamId: teamUuid,
                        issuedToType: issuedToType as any,
                        workerId: issuedToWorkerUuid ?? undefined,
                        yearMonth: billing.yearMonth
                    })
                    : billing.id;

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
                .map((d: any) => {
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
                        issuedToType,
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
                });
        } catch (error) {
            console.error("Error fetching billings:", error);
            return [];
        }
    },

    // Generate for ALL vehicles
    generateMonthlyBillings: async (yearMonth: string) => {
        try {
            const vehicles = await vehicleService.getVehicles();
            const promises = vehicles.map(v => vehicleBillingService.generateBilling(v, yearMonth));
            return await Promise.all(promises);
        } catch (error) {
            console.error("Error batch generating billings:", error);
            throw error;
        }
    }
};

