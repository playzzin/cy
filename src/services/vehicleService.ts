import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    query,
    runTransaction,
    serverTimestamp,
    where
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { vehicleFirestoreService } from './vehicleFirestoreService';
import { Vehicle, VehicleAssigneeType, VehicleAssignmentRecord, VehicleBillingTargetRecord, VehicleExpenseRecord } from '../types/vehicle';

const VEHICLE_ASSIGNMENT_COLLECTION = 'vehicleAssignments';
const VEHICLE_EXPENSE_COLLECTION = 'vehicleExpenses';

const makeId = (prefix: string): string => {
    const c = typeof crypto !== 'undefined' ? crypto : undefined;
    if (c && typeof c.randomUUID === 'function') {
        return c.randomUUID();
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const normalizeVehicleStatus = (value?: Vehicle['status']): Vehicle['status'] => {
    if (value === 'AVAILABLE' || value === 'ASSIGNED' || value === 'MAINTENANCE' || value === 'DISPOSED') {
        return value;
    }
    return 'AVAILABLE';
};

export const vehicleService = {
    listAllVehicles: async (status?: string): Promise<Vehicle[]> => {
        return vehicleFirestoreService.listVehicles(status);
    },

    getVehicles: async (status?: string): Promise<Vehicle[]> => {
        return vehicleFirestoreService.listVehicles(status);
    },

    getVehicle: async (id: string): Promise<Vehicle | null> => {
        return vehicleFirestoreService.getVehicle(id);
    },

    addVehicle: async (data: Omit<Vehicle, 'id'>): Promise<Vehicle> => {
        const id = makeId('vehicle');
        const next = {
            ...data,
            id,
            status: normalizeVehicleStatus(data.status)
        } as Vehicle;
        await vehicleFirestoreService.saveVehicle(next);
        return next;
    },

    createVehicle: async (data: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
        const created = await vehicleService.addVehicle(data as Omit<Vehicle, 'id'>);
        return created.id;
    },

    updateVehicle: async (id: string, data: Partial<Vehicle>): Promise<void> => {
        await vehicleFirestoreService.saveVehicle({ ...data, id } as Partial<Vehicle> & { id: string });
    },

    deleteVehicle: async (id: string): Promise<void> => {
        await vehicleFirestoreService.deleteVehicle(id);
    },

    listAllVehicleAssignments: async (vehicleId?: string): Promise<VehicleAssignmentRecord[]> => {
        return vehicleFirestoreService.listVehicleAssignments(vehicleId);
    },

    getAssignmentHistory: async (vehicleId: string): Promise<VehicleAssignmentRecord[]> => {
        return vehicleFirestoreService.listVehicleAssignments(vehicleId);
    },

    updateVehicleAssignment: async (
        data: Partial<VehicleAssignmentRecord> & { id: string; vehicleId: string }
    ): Promise<void> => {
        await vehicleFirestoreService.saveVehicleAssignment(data);
        if (!data.endDate && data.assigneeId && data.assigneeType && data.assigneeName) {
            await vehicleFirestoreService.saveVehicle({
                id: data.vehicleId,
                status: 'ASSIGNED',
                currentAssigneeId: data.assigneeId,
                currentAssigneeType: data.assigneeType,
                currentAssigneeName: data.assigneeName
            } as Partial<Vehicle> & { id: string });
            return;
        }

        if (data.endDate) {
            const activeAssignment = (await vehicleFirestoreService.listVehicleAssignments(data.vehicleId))
                .filter((assignment) => !assignment.endDate)
                .sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')))[0];

            await vehicleFirestoreService.saveVehicle(activeAssignment ? {
                id: data.vehicleId,
                status: 'ASSIGNED',
                currentAssigneeId: activeAssignment.assigneeId,
                currentAssigneeType: activeAssignment.assigneeType,
                currentAssigneeName: activeAssignment.assigneeName
            } as Partial<Vehicle> & { id: string } : {
                id: data.vehicleId,
                status: 'AVAILABLE',
                currentAssigneeId: null,
                currentAssigneeType: null,
                currentAssigneeName: null
            } as Partial<Vehicle> & { id: string });
        }
    },

    deleteVehicleAssignment: async (record: Pick<VehicleAssignmentRecord, 'id' | 'vehicleId' | 'endDate'>): Promise<void> => {
        await vehicleFirestoreService.deleteVehicleAssignment(record.id);

        if (record.endDate) return;

        const remainingAssignments = await vehicleFirestoreService.listVehicleAssignments(record.vehicleId);
        const activeAssignment = remainingAssignments
            .filter((assignment) => !assignment.endDate)
            .sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')))[0];

        if (activeAssignment) {
            await vehicleFirestoreService.saveVehicle({
                id: record.vehicleId,
                status: 'ASSIGNED',
                currentAssigneeId: activeAssignment.assigneeId,
                currentAssigneeType: activeAssignment.assigneeType,
                currentAssigneeName: activeAssignment.assigneeName
            } as Partial<Vehicle> & { id: string });
            return;
        }

        await vehicleFirestoreService.saveVehicle({
            id: record.vehicleId,
            status: 'AVAILABLE',
            currentAssigneeId: null,
            currentAssigneeType: null,
            currentAssigneeName: null
        } as Partial<Vehicle> & { id: string });
    },

    listAllVehicleBillingTargets: async (vehicleId?: string): Promise<VehicleBillingTargetRecord[]> => {
        return vehicleFirestoreService.listVehicleBillingTargets(vehicleId);
    },

    saveVehicleBillingTarget: async (data: Omit<VehicleBillingTargetRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<string> => {
        const id = data.id ? String(data.id) : makeId('vehicle_billing_target');
        await vehicleFirestoreService.saveVehicleBillingTarget({ ...data, id });
        return id;
    },

    deleteVehicleBillingTarget: async (id: string): Promise<void> => {
        await vehicleFirestoreService.deleteVehicleBillingTarget(id);
    },

    applyVehicleBillingTargetChanges: async (params: {
        vehicleId: string;
        upserts?: Array<Omit<VehicleBillingTargetRecord, 'createdAt' | 'updatedAt'>>;
        closeRecords?: Array<{ id: string; endDate: string }>;
        deleteIds?: string[];
        clearSnapshot?: boolean;
    }): Promise<void> => {
        await vehicleFirestoreService.applyVehicleBillingTargetChanges(params);
    },

    assignVehicle: async (
        vehicleId: string,
        assigneeId: string,
        assigneeType: VehicleAssigneeType,
        assigneeName: string,
        startDate: string
    ): Promise<void> => {
        const vehicle = await vehicleFirestoreService.getVehicle(vehicleId);
        if (!vehicle) {
            throw new Error('Vehicle not found');
        }

        const assignmentId = makeId('vehicle_assignment');
        const vehicleRef = doc(db, 'vehicles', vehicleId);
        const assignmentRef = doc(db, VEHICLE_ASSIGNMENT_COLLECTION, assignmentId);

        await runTransaction(db, async (transaction) => {
            transaction.set(assignmentRef, {
                vehicleId,
                vehiclePlate: vehicle.licensePlate,
                assigneeId,
                assigneeType,
                assigneeName,
                startDate,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            transaction.update(vehicleRef, {
                status: 'ASSIGNED',
                currentAssigneeId: assigneeId,
                currentAssigneeType: assigneeType,
                currentAssigneeName: assigneeName,
                updatedAt: serverTimestamp()
            });
        });
    },

    unassignVehicle: async (vehicleId: string, endDate: string): Promise<void> => {
        const snapshot = await getDocs(query(
            collection(db, VEHICLE_ASSIGNMENT_COLLECTION),
            where('vehicleId', '==', vehicleId)
        ));
        const activeAssignment = snapshot.docs.find((entry) => !entry.data().endDate);
        const vehicleRef = doc(db, 'vehicles', vehicleId);

        await runTransaction(db, async (transaction) => {
            if (activeAssignment) {
                transaction.update(activeAssignment.ref, {
                    endDate,
                    updatedAt: serverTimestamp()
                });
            }

            transaction.update(vehicleRef, {
                status: 'AVAILABLE',
                currentAssigneeId: null,
                currentAssigneeType: null,
                currentAssigneeName: null,
                updatedAt: serverTimestamp()
            });
        });
    },

    listAllVehicleExpenses: async (vehicleId?: string, yearMonth?: string): Promise<VehicleExpenseRecord[]> => {
        return vehicleFirestoreService.listVehicleExpenses(vehicleId, yearMonth);
    },

    getExpensesByMonth: async (yearMonth: string): Promise<VehicleExpenseRecord[]> => {
        return vehicleFirestoreService.listVehicleExpenses(undefined, yearMonth);
    },

    getExpensesByVehicle: async (vehicleId: string, yearMonth?: string): Promise<VehicleExpenseRecord[]> => {
        return vehicleFirestoreService.listVehicleExpenses(vehicleId, yearMonth);
    },

    saveVehicleExpense: async (data: Partial<VehicleExpenseRecord> & { id?: string }): Promise<void> => {
        const id = data.id ? String(data.id) : makeId('vehicle_expense');
        await vehicleFirestoreService.saveVehicleExpense({ ...data, id } as Partial<VehicleExpenseRecord> & { id: string });
    },

    addExpense: async (data: Omit<VehicleExpenseRecord, 'id' | 'createdAt'>): Promise<string> => {
        const id = makeId('vehicle_expense');
        await vehicleFirestoreService.saveVehicleExpense({ ...data, id });
        return id;
    },

    deleteExpense: async (id: string): Promise<void> => {
        await deleteDoc(doc(db, VEHICLE_EXPENSE_COLLECTION, id));
    }
};
