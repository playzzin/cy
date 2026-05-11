import { db } from '../config/firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    limit as firestoreLimit
} from 'firebase/firestore';
import { createConverter } from '../utils/firestoreConverter';
import { vehicleSchema, vehicleAssignmentSchema, vehicleExpenseSchema } from '../types/zod/vehicleSchema';
import { Vehicle, VehicleAssignmentRecord, VehicleExpenseRecord } from '../types/vehicle';

const VEHICLE_COLLECTION = 'vehicles';
const ASSIGNMENT_COLLECTION = 'vehicleAssignments';
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
        await setDoc(ref, {
            ...vehicleData,
            updatedAt: serverTimestamp()
        }, { merge: true });
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
        }
        q = query(q, orderBy('startDate', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as VehicleAssignmentRecord);
    },

    /**
     * 차량 비용 기록 조회
     */
    listVehicleExpenses: async (vehicleId?: string, yearMonth?: string) => {
        let q = query(collection(db, EXPENSE_COLLECTION).withConverter(createConverter(vehicleExpenseSchema)));
        if (vehicleId) {
            q = query(q, where('vehicleId', '==', vehicleId));
        }
        if (yearMonth) {
            // date matches YYYY-MM
            q = query(q, where('date', '>=', `${yearMonth}-01`), where('date', '<=', `${yearMonth}-31`));
        }
        q = query(q, orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as VehicleExpenseRecord);
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
