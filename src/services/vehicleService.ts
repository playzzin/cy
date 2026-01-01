import {
    collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
    query, where, orderBy, addDoc, Timestamp,
    runTransaction,
    deleteField
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
    Vehicle, VehicleAssignmentRecord, VehicleExpenseRecord,
    VehicleType, VehicleStatus, VehicleAssigneeType
} from '../types/vehicle';

const COLLECTION_NAME = 'vehicles';
const ASSIGNMENT_COLLECTION = 'vehicle_assignments';
const EXPENSE_COLLECTION = 'vehicle_expenses';

export const vehicleService = {
    // --- Vehicle CRUD ---

    // Create new vehicle
    createVehicle: async (vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>) => {
        try {
            const docRef = doc(collection(db, COLLECTION_NAME));
            // Use doc ID as ID
            const newVehicle: Vehicle = {
                ...vehicle,
                id: docRef.id,
                status: 'AVAILABLE', // Default
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };
            await setDoc(docRef, newVehicle);
            return docRef.id;
        } catch (error) {
            console.error("Error creating vehicle:", error);
            throw error;
        }
    },

    // Update vehicle
    updateVehicle: async (id: string, updates: Partial<Vehicle>) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, {
                ...updates,
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error("Error updating vehicle:", error);
            throw error;
        }
    },

    // Delete vehicle (Soft delete recommended, but hard delete for now)
    deleteVehicle: async (id: string) => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.error("Error deleting vehicle:", error);
            throw error;
        }
    },

    // List all cars
    getVehicles: async () => {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy('licensePlate', 'asc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => doc.data() as Vehicle);
        } catch (error) {
            console.error("Error fetching vehicles:", error);
            return [];
        }
    },

    // --- Assignment Logic ---

    assignVehicle: async (
        vehicleId: string,
        assigneeId: string,
        assigneeType: VehicleAssigneeType,
        assigneeName: string,
        startDate: string
    ) => {
        // Transaction to ensure atomicity
        try {
            await runTransaction(db, async (transaction) => {
                const vehicleRef = doc(db, COLLECTION_NAME, vehicleId);
                const vehicleSnap = await transaction.get(vehicleRef);

                if (!vehicleSnap.exists()) throw new Error("Vehicle not found");

                const vehicleData = vehicleSnap.data() as Vehicle;
                if (vehicleData.status === 'ASSIGNED') {
                    throw new Error("Vehicle is already assigned");
                }

                // 1. Create Assignment Record
                const assignmentRef = doc(collection(db, ASSIGNMENT_COLLECTION));
                const assignment: VehicleAssignmentRecord = {
                    id: assignmentRef.id,
                    vehicleId,
                    vehiclePlate: vehicleData.licensePlate,
                    assigneeId,
                    assigneeType,
                    assigneeName,
                    startDate,
                    createdAt: Timestamp.now()
                };
                transaction.set(assignmentRef, assignment);

                // 2. Update Vehicle Status
                transaction.update(vehicleRef, {
                    status: 'ASSIGNED',
                    currentAssigneeId: assigneeId,
                    currentAssigneeType: assigneeType,
                    currentAssigneeName: assigneeName,
                    updatedAt: Timestamp.now()
                });
            });
        } catch (error) {
            console.error("Assignment Transaction Failed:", error);
            throw error;
        }
    },

    unassignVehicle: async (vehicleId: string, endDate: string) => {
        try {
            // Find active assignment to close it
            const q = query(
                collection(db, ASSIGNMENT_COLLECTION),
                where('vehicleId', '==', vehicleId),
                // We assume one active assignment logic in app, but here we query all and filter in memory if needed
                // Or if we can assume existing data is correct.
            );

            // Firestore composite index might be needed if we sort.
            // For now, let's just get the "active" vehicle first.
            const vehicleRef = doc(db, COLLECTION_NAME, vehicleId);

            // We do a simplified approach: 
            // 1. Get all assignments for this vehicle
            // 2. Filter for !endDate
            const snapshot = await getDocs(q);
            const activeDoc = snapshot.docs.find(d => !d.data().endDate);

            if (activeDoc) {
                await updateDoc(doc(db, ASSIGNMENT_COLLECTION, activeDoc.id), {
                    endDate,
                    updatedAt: Timestamp.now()
                });
            }

            await updateDoc(vehicleRef, {
                status: 'AVAILABLE',
                currentAssigneeId: deleteField(),
                currentAssigneeType: deleteField(),
                currentAssigneeName: deleteField(),
                updatedAt: Timestamp.now()
            });

        } catch (error) {
            console.error("Unassign Failed:", error);
            throw error;
        }
    },

    // --- Expense Logic ---

    addExpense: async (expense: Omit<VehicleExpenseRecord, 'id' | 'createdAt'>) => {
        try {
            const docRef = doc(collection(db, EXPENSE_COLLECTION));
            const newExpense: VehicleExpenseRecord = {
                ...expense,
                id: docRef.id,
                createdAt: Timestamp.now()
            };
            await setDoc(docRef, newExpense);
            return docRef.id;
        } catch (error) {
            console.error("Error adding expense:", error);
            throw error;
        }
    },

    getExpensesByVehicle: async (vehicleId: string, yearMonth: string) => {
        // Need to filter by date range string YYYY-MM
        try {
            // Simple string comparison for 'date' field YYYY-MM-DD
            const start = `${yearMonth}-01`;
            const end = `${yearMonth}-31`;

            const q = query(
                collection(db, EXPENSE_COLLECTION),
                where('vehicleId', '==', vehicleId),
                where('date', '>=', start),
                where('date', '<=', end),
                orderBy('date', 'desc')
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => d.data() as VehicleExpenseRecord);
        } catch (error) {
            console.error("Error getting expenses:", error);
            return [];
        }
    },

    // --- History ---
    getAssignmentHistory: async (vehicleId: string) => {
        try {
            const q = query(
                collection(db, ASSIGNMENT_COLLECTION),
                where('vehicleId', '==', vehicleId),
                orderBy('startDate', 'desc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => d.data() as VehicleAssignmentRecord);
        } catch (error) {
            console.error("Error getting assignment history:", error);
            return [];
        }
    },

    deleteExpense: async (id: string) => {
        try {
            await deleteDoc(doc(db, EXPENSE_COLLECTION, id));
        } catch (error) {
            console.error("Error deleting expense:", error);
            throw error;
        }
    }
};
