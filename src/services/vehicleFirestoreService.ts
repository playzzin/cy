import { db } from '../config/firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    deleteField,
    query,
    where,
    orderBy,
    serverTimestamp,
    writeBatch,
    runTransaction,
    limit as firestoreLimit
} from 'firebase/firestore';
import { createConverter } from '../utils/firestoreConverter';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';
import { vehicleSchema, vehicleAssignmentSchema, vehicleBillingTargetSchema, vehicleExpenseSchema } from '../types/zod/vehicleSchema';
import { Vehicle, VehicleAssignmentRecord, VehicleBillingTargetRecord, VehicleExpenseRecord } from '../types/vehicle';
import type { VehicleBillingDocument } from '../types/vehicleBilling';

const VEHICLE_COLLECTION = 'vehicles';
const ASSIGNMENT_COLLECTION = 'vehicleAssignments';
const BILLING_TARGET_COLLECTION = 'vehicleBillingTargets';
const EXPENSE_COLLECTION = 'vehicleExpenses';
const BILLING_DOCUMENT_COLLECTION = 'vehicle_billing_documents';
const SYSTEM_CONFIGS_COLLECTION = 'system_configs';
const POSTED_BILLING_STATUSES = new Set(['CONFIRMED', 'PAID', 'OVERDUE']);

export interface VehicleBillingSettlementGuardTarget {
    yearMonth: string;
    teamId?: string | null;
}

export interface ReplaceVehicleBillingDraftsParams {
    desiredDocuments: VehicleBillingDocument[];
    existingDocumentIds: string[];
    settlementTargets?: VehicleBillingSettlementGuardTarget[];
}

export interface ReplaceVehicleBillingDraftsResult {
    savedIds: string[];
    deletedDraftIds: string[];
}

export interface ProtectedVehicleBillingWriteParams {
    billing: VehicleBillingDocument;
    settlementTargets?: VehicleBillingSettlementGuardTarget[];
}

const normalizeKey = (value: unknown): string => String(value ?? '').trim();

const toIsoTimestamp = (value: unknown): string | undefined => {
    if (!value) return undefined;
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
    }
    if (value instanceof Date) return value.toISOString();
    const timestamp = value as { toDate?: () => Date };
    if (typeof timestamp?.toDate === 'function') return timestamp.toDate().toISOString();
    return undefined;
};

const getTeamSettlementConfigId = (target: VehicleBillingSettlementGuardTarget): string => {
    const yearMonth = normalizeKey(target.yearMonth);
    const teamId = normalizeKey(target.teamId);
    if (!yearMonth || !teamId || teamId.includes('/')) return '';
    return `team_settlement_${yearMonth}__${teamId}`;
};

const isConfirmedTeamSettlementConfig = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') throw new Error('vehicle-team-settlement-guard-invalid');
    const rawData = (value as { data?: unknown }).data;
    let parsed: Record<string, unknown> | null = null;
    if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
        parsed = rawData as Record<string, unknown>;
    } else if (typeof rawData === 'string' && rawData.trim()) {
        try {
            const candidate = JSON.parse(rawData) as unknown;
            if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
                parsed = candidate as Record<string, unknown>;
            }
        } catch {
            // A malformed guard document must fail closed instead of silently
            // allowing an automatic billing mutation.
            throw new Error('vehicle-team-settlement-guard-invalid');
        }
    }
    if (!parsed) throw new Error('vehicle-team-settlement-guard-invalid');
    return Boolean(normalizeKey(parsed?.confirmedAt));
};

const buildVehicleBillingPayload = (
    billing: VehicleBillingDocument,
    createdAt: unknown,
    updatedAtIso: string
): Record<string, unknown> => stripUndefinedFields({
    yearMonth: billing.yearMonth,
    vehicleId: billing.vehicleId,
    vehiclePlate: billing.vehiclePlate,
    assignedTeamId: billing.assignedTeamId ?? null,
    assignedTeamName: billing.assignedTeamName ?? null,
    teamId: billing.teamId ?? null,
    teamName: billing.teamName ?? null,
    issuedToType: billing.issuedToType ?? null,
    issuedToWorkerId: billing.issuedToWorkerId ?? null,
    issuedToWorkerName: billing.issuedToWorkerName ?? null,
    fixedCost: Number(billing.fixedCost ?? 0),
    variableCost: Number(billing.variableCost ?? 0),
    totalAmount: Number(billing.totalAmount ?? 0),
    status: billing.status,
    lineItems: JSON.stringify(billing.lineItems ?? []),
    memo: billing.memo ?? null,
    confirmationCancelReason: billing.confirmationCancelReason ?? null,
    confirmationCancelledAt: toIsoTimestamp(billing.confirmationCancelledAt) ?? null,
    confirmationCancelledById: billing.confirmationCancelledById ?? null,
    confirmationCancelledByName: billing.confirmationCancelledByName ?? null,
    createdAt: toIsoTimestamp(createdAt) ?? toIsoTimestamp(billing.createdAt) ?? updatedAtIso,
    updatedAt: updatedAtIso,
    confirmedAt: toIsoTimestamp(billing.confirmedAt) ?? null
}) as Record<string, unknown>;

const buildVehicleBillingDraftPayload = (
    billing: VehicleBillingDocument,
    createdAt: unknown,
    updatedAtIso: string
): Record<string, unknown> => buildVehicleBillingPayload({
    ...billing,
    status: 'DRAFT',
    confirmedAt: undefined
}, createdAt, updatedAtIso);

export const vehicleFirestoreService = {
    /**
     * 차량 목록 조회
     */
    listVehicles: async (status?: string) => {
        let q = query(collection(db, VEHICLE_COLLECTION).withConverter(createConverter(vehicleSchema)));
        if (status) {
            q = query(q, where('status', '==', status));
        }
        q = query(q, orderBy('licensePlate', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as Vehicle);
    },

    /**
     * 단일 차량 상세 조회
     */
    getVehicle: async (id: string) => {
        const ref = doc(db, VEHICLE_COLLECTION, id).withConverter(createConverter(vehicleSchema));
        const snapshot = await getDoc(ref);
        return snapshot.exists() ? (snapshot.data() as Vehicle) : null;
    },

    /**
     * 차량 저장 (생성/수정)
     */
    saveVehicle: async (data: Partial<Vehicle> & { id: string }) => {
        const { id, ...vehicleData } = data;
        const ref = doc(db, VEHICLE_COLLECTION, id);
        await setDoc(ref, stripUndefinedFields({
            ...vehicleData,
            updatedAt: serverTimestamp()
        }), { merge: true });
    },

    /**
     * 차량 삭제
     */
    deleteVehicle: async (id: string) => {
        const ref = doc(db, VEHICLE_COLLECTION, id);
        await deleteDoc(ref);
    },

    /**
     * 차량 할당 기록 조회
     */
    listVehicleAssignments: async (vehicleId?: string) => {
        let q = query(collection(db, ASSIGNMENT_COLLECTION).withConverter(createConverter(vehicleAssignmentSchema)));
        if (vehicleId) {
            q = query(q, where('vehicleId', '==', vehicleId));
        } else {
            q = query(q, orderBy('startDate', 'desc'));
        }
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(doc => doc.data() as VehicleAssignmentRecord)
            .sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')));
    },

    saveVehicleAssignment: async (data: Partial<VehicleAssignmentRecord> & { id: string }) => {
        const ref = doc(db, ASSIGNMENT_COLLECTION, data.id).withConverter(createConverter(vehicleAssignmentSchema));
        await setDoc(ref, stripUndefinedFields({
            ...data,
            updatedAt: serverTimestamp()
        }), { merge: true });
    },

    deleteVehicleAssignment: async (id: string) => {
        const ref = doc(db, ASSIGNMENT_COLLECTION, id);
        await deleteDoc(ref);
    },

    /**
     * 차량 청구대상 이력 조회
     */
    listVehicleBillingTargets: async (vehicleId?: string) => {
        let q = query(collection(db, BILLING_TARGET_COLLECTION).withConverter(createConverter(vehicleBillingTargetSchema)));
        if (vehicleId) {
            q = query(q, where('vehicleId', '==', vehicleId));
        } else {
            q = query(q, orderBy('startDate', 'desc'));
        }
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(doc => doc.data() as VehicleBillingTargetRecord)
            .sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')));
    },

    /**
     * 차량 청구대상 이력 저장
     */
    saveVehicleBillingTarget: async (data: Partial<VehicleBillingTargetRecord> & { id: string }) => {
        const ref = doc(db, BILLING_TARGET_COLLECTION, data.id).withConverter(createConverter(vehicleBillingTargetSchema));
        await setDoc(ref, stripUndefinedFields({
            ...data,
            updatedAt: serverTimestamp()
        }), { merge: true });
    },

    /**
     * 차량 청구대상 이력 삭제
     */
    deleteVehicleBillingTarget: async (id: string) => {
        const ref = doc(db, BILLING_TARGET_COLLECTION, id);
        await deleteDoc(ref);
    },

    applyVehicleBillingTargetChanges: async (params: {
        vehicleId: string;
        upserts?: Array<Partial<VehicleBillingTargetRecord> & { id: string }>;
        closeRecords?: Array<{ id: string; endDate: string }>;
        deleteIds?: string[];
        clearSnapshot?: boolean;
    }): Promise<void> => {
        const batch = writeBatch(db);

        (params.closeRecords ?? []).forEach((record) => {
            if (!record.id) return;
            batch.update(doc(db, BILLING_TARGET_COLLECTION, record.id), {
                endDate: record.endDate,
                updatedAt: serverTimestamp()
            });
        });

        (params.upserts ?? []).forEach((record) => {
            const parsed = vehicleBillingTargetSchema.parse(record);
            batch.set(doc(db, BILLING_TARGET_COLLECTION, record.id), stripUndefinedFields({
                ...parsed,
                createdAt: parsed.createdAt ?? serverTimestamp(),
                updatedAt: serverTimestamp()
            }), { merge: true });
        });

        (params.deleteIds ?? []).forEach((id) => {
            if (!id) return;
            batch.delete(doc(db, BILLING_TARGET_COLLECTION, id));
        });

        if (params.clearSnapshot) {
            batch.update(doc(db, VEHICLE_COLLECTION, params.vehicleId), {
                billingTargetId: deleteField(),
                billingTargetType: deleteField(),
                billingTargetName: deleteField(),
                billingTargetStartDate: deleteField(),
                billingTargetEndDate: deleteField(),
                updatedAt: serverTimestamp()
            });
        }

        await batch.commit();
    },

    applyVehicleExpenseChanges: async (params: {
        upserts?: Array<Partial<VehicleExpenseRecord> & { id: string }>;
        cancelIds?: string[];
        operationId?: string;
    }): Promise<void> => {
        const batch = writeBatch(db);
        const now = serverTimestamp();

        (params.upserts ?? []).forEach((expense) => {
            if (!expense.id) return;
            batch.set(doc(db, EXPENSE_COLLECTION, expense.id), stripUndefinedFields({
                ...expense,
                status: expense.status ?? 'ACTIVE',
                cancelledAt: null,
                lastOperationId: params.operationId,
                updatedAt: now
            }), { merge: true });
        });

        (params.cancelIds ?? []).forEach((id) => {
            if (!id) return;
            batch.set(doc(db, EXPENSE_COLLECTION, id), stripUndefinedFields({
                status: 'CANCELLED',
                cancelledAt: now,
                lastOperationId: params.operationId,
                updatedAt: now
            }), { merge: true });
        });

        await batch.commit();
    },

    /**
     * Replaces every DRAFT owned by one monthly-ledger row in a single commit.
     * Billing statuses and both the old/new settlement targets are read inside
     * the transaction, so a concurrent confirmation causes Firestore to retry
     * and then fail closed before any new DRAFT can become visible.
     */
    replaceVehicleBillingDrafts: async (
        params: ReplaceVehicleBillingDraftsParams
    ): Promise<ReplaceVehicleBillingDraftsResult> => {
        const desiredDocuments = params.desiredDocuments.map((billing) => ({
            ...billing,
            id: normalizeKey(billing.id),
            status: 'DRAFT' as const,
            confirmedAt: undefined
        }));
        const desiredIds = desiredDocuments.map((billing) => billing.id);
        if (desiredIds.some((id) => !id) || new Set(desiredIds).size !== desiredIds.length) {
            throw new Error('vehicle-billing-deterministic-id-required');
        }

        const existingIds = Array.from(new Set(
            params.existingDocumentIds.map(normalizeKey).filter(Boolean)
        ));
        const allIds = Array.from(new Set([...desiredIds, ...existingIds]));
        if (allIds.length === 0) return { savedIds: [], deletedDraftIds: [] };

        const billingRefs = allIds.map((id) => doc(db, BILLING_DOCUMENT_COLLECTION, id));
        const desiredIdSet = new Set(desiredIds);
        const ownedExistingIdSet = new Set(existingIds);
        const updatedAtIso = new Date().toISOString();

        return runTransaction(db, async (transaction) => {
            const billingSnapshots = await Promise.all(
                billingRefs.map((billingRef) => transaction.get(billingRef))
            );
            const snapshotById = new Map(
                billingSnapshots.map((snapshot) => [snapshot.id, snapshot] as const)
            );

            const unmanagedCollision = billingSnapshots.find((snapshot) => (
                snapshot.exists() &&
                desiredIdSet.has(snapshot.id) &&
                !ownedExistingIdSet.has(snapshot.id)
            ));
            if (unmanagedCollision) {
                throw new Error('vehicle-billing-unmanaged-collision-blocked');
            }

            billingSnapshots.forEach((snapshot) => {
                if (!snapshot.exists()) return;
                const status = normalizeKey(snapshot.data()?.status).toUpperCase() || 'DRAFT';
                if (status === 'DRAFT') return;
                if (POSTED_BILLING_STATUSES.has(status)) {
                    throw new Error('vehicle-billing-posted-replace-blocked');
                }
                throw new Error('vehicle-billing-non-draft-replace-blocked');
            });

            const settlementTargets: VehicleBillingSettlementGuardTarget[] = [
                ...(params.settlementTargets ?? []),
                ...desiredDocuments.map((billing) => ({
                    yearMonth: billing.yearMonth,
                    teamId: billing.teamId
                })),
                ...billingSnapshots
                    .filter((snapshot) => snapshot.exists())
                    .map((snapshot) => ({
                        yearMonth: normalizeKey(snapshot.data()?.yearMonth),
                        teamId: normalizeKey(snapshot.data()?.teamId) || normalizeKey(snapshot.data()?.assignedTeamId)
                    }))
            ];
            const settlementConfigIds = Array.from(new Set(
                settlementTargets.map(getTeamSettlementConfigId).filter(Boolean)
            ));
            const settlementSnapshots = await Promise.all(
                settlementConfigIds.map((id) => transaction.get(doc(db, SYSTEM_CONFIGS_COLLECTION, id)))
            );
            if (settlementSnapshots.some((snapshot) => (
                snapshot.exists() && isConfirmedTeamSettlementConfig(snapshot.data())
            ))) {
                throw new Error('team-settlement-confirmed-vehicle-billing-blocked');
            }

            desiredDocuments.forEach((billing) => {
                const current = snapshotById.get(billing.id);
                transaction.set(
                    doc(db, BILLING_DOCUMENT_COLLECTION, billing.id),
                    buildVehicleBillingDraftPayload(
                        billing,
                        current?.exists() ? current.data()?.createdAt : undefined,
                        updatedAtIso
                    )
                );
            });

            const deletedDraftIds: string[] = [];
            billingSnapshots.forEach((snapshot) => {
                if (!snapshot.exists() || desiredIdSet.has(snapshot.id)) return;
                // The status was validated above from this same snapshot.
                transaction.delete(snapshot.ref);
                deletedDraftIds.push(snapshot.id);
            });

            return { savedIds: desiredIds, deletedDraftIds };
        });
    },

    saveVehicleBillingDocumentProtected: async (
        params: ProtectedVehicleBillingWriteParams
    ): Promise<void> => {
        const billingId = normalizeKey(params.billing.id);
        if (!billingId) throw new Error('vehicle-billing-id-required');
        const billingRef = doc(db, BILLING_DOCUMENT_COLLECTION, billingId);
        const updatedAtIso = new Date().toISOString();

        await runTransaction(db, async (transaction) => {
            const beforeSnapshot = await transaction.get(billingRef);
            if (beforeSnapshot.exists()) {
                const status = normalizeKey(beforeSnapshot.data()?.status).toUpperCase() || 'DRAFT';
                if (POSTED_BILLING_STATUSES.has(status)) {
                    throw new Error('vehicle-billing-posted-modification-blocked');
                }
            }

            const settlementTargets: VehicleBillingSettlementGuardTarget[] = [
                ...(params.settlementTargets ?? []),
                { yearMonth: params.billing.yearMonth, teamId: params.billing.teamId }
            ];
            if (beforeSnapshot.exists()) {
                settlementTargets.push({
                    yearMonth: normalizeKey(beforeSnapshot.data()?.yearMonth),
                    teamId: normalizeKey(beforeSnapshot.data()?.teamId) || normalizeKey(beforeSnapshot.data()?.assignedTeamId)
                });
            }
            const settlementConfigIds = Array.from(new Set(
                settlementTargets.map(getTeamSettlementConfigId).filter(Boolean)
            ));
            const settlementSnapshots = await Promise.all(
                settlementConfigIds.map((id) => transaction.get(doc(db, SYSTEM_CONFIGS_COLLECTION, id)))
            );
            if (settlementSnapshots.some((snapshot) => (
                snapshot.exists() && isConfirmedTeamSettlementConfig(snapshot.data())
            ))) {
                throw new Error('team-settlement-confirmed-vehicle-billing-blocked');
            }

            transaction.set(
                billingRef,
                buildVehicleBillingPayload(
                    { ...params.billing, id: billingId },
                    beforeSnapshot.exists() ? beforeSnapshot.data()?.createdAt : undefined,
                    updatedAtIso
                )
            );
        });
    },

    deleteVehicleBillingDocumentProtected: async (
        billingIdInput: string,
        settlementTargets: VehicleBillingSettlementGuardTarget[] = []
    ): Promise<void> => {
        const billingId = normalizeKey(billingIdInput);
        if (!billingId) throw new Error('vehicle-billing-id-required');
        const billingRef = doc(db, BILLING_DOCUMENT_COLLECTION, billingId);

        await runTransaction(db, async (transaction) => {
            const beforeSnapshot = await transaction.get(billingRef);
            if (!beforeSnapshot.exists()) return;
            const status = normalizeKey(beforeSnapshot.data()?.status).toUpperCase() || 'DRAFT';
            if (POSTED_BILLING_STATUSES.has(status)) {
                throw new Error('vehicle-billing-posted-delete-blocked');
            }
            if (status !== 'DRAFT') {
                throw new Error('vehicle-billing-non-draft-delete-blocked');
            }

            const targets: VehicleBillingSettlementGuardTarget[] = [
                ...settlementTargets,
                {
                    yearMonth: normalizeKey(beforeSnapshot.data()?.yearMonth),
                    teamId: normalizeKey(beforeSnapshot.data()?.teamId) || normalizeKey(beforeSnapshot.data()?.assignedTeamId)
                }
            ];
            const settlementConfigIds = Array.from(new Set(
                targets.map(getTeamSettlementConfigId).filter(Boolean)
            ));
            const settlementSnapshots = await Promise.all(
                settlementConfigIds.map((id) => transaction.get(doc(db, SYSTEM_CONFIGS_COLLECTION, id)))
            );
            if (settlementSnapshots.some((snapshot) => (
                snapshot.exists() && isConfirmedTeamSettlementConfig(snapshot.data())
            ))) {
                throw new Error('team-settlement-confirmed-vehicle-billing-blocked');
            }
            transaction.delete(billingRef);
        });
    },

    /**
     * 차량 비용 기록 조회
     */
    listVehicleExpenses: async (vehicleId?: string, yearMonth?: string) => {
        let q = query(collection(db, EXPENSE_COLLECTION).withConverter(createConverter(vehicleExpenseSchema)));
        if (vehicleId) {
            q = query(q, where('vehicleId', '==', vehicleId));
        } else if (yearMonth) {
            // date matches YYYY-MM
            q = query(q, where('date', '>=', `${yearMonth}-01`), where('date', '<=', `${yearMonth}-31`));
        }
        if (!vehicleId) {
            q = query(q, orderBy('date', 'desc'));
        }
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(doc => doc.data() as VehicleExpenseRecord)
            .filter((expense) => expense.status !== 'CANCELLED' && !expense.cancelledAt)
            .filter((expense) => !yearMonth || String(expense.date ?? '').startsWith(yearMonth))
            .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
    },

    /**
     * 비용 기록 저장
     */
    saveVehicleExpense: async (data: Partial<VehicleExpenseRecord> & { id: string }) => {
        const ref = doc(db, EXPENSE_COLLECTION, data.id).withConverter(createConverter(vehicleExpenseSchema));
        await setDoc(ref, {
            ...data,
            // createdAt is handled by schema.optional or manual
        }, { merge: true });
    }
};
