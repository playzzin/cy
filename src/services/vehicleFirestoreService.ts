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
    limit as firestoreLimit
} from 'firebase/firestore';
import { createConverter } from '../utils/firestoreConverter';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';
import { vehicleSchema, vehicleAssignmentSchema, vehicleBillingTargetSchema, vehicleExpenseSchema } from '../types/zod/vehicleSchema';
import { Vehicle, VehicleAssignmentRecord, VehicleBillingTargetRecord, VehicleExpenseRecord } from '../types/vehicle';

const VEHICLE_COLLECTION = 'vehicles';
const ASSIGNMENT_COLLECTION = 'vehicleAssignments';
const BILLING_TARGET_COLLECTION = 'vehicleBillingTargets';
const EXPENSE_COLLECTION = 'vehicleExpenses';

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
