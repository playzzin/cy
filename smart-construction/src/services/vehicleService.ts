import { db } from '../config/firebase';
import { collection, addDoc, deleteDoc, doc, getDocs, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';

export interface Vehicle {
    id?: string;
    number: string; // 차량 번호 (e.g., 12가 3456)
    type: string; // 차종 (e.g., 스타렉스, 포터)
    driverId?: string; // 운전자 (Worker ID)
    status: 'active' | 'inactive';
    createdAt?: Timestamp;
}

const COLLECTION_NAME = 'vehicles';

export const vehicleService = {
    // Get all vehicles
    getVehicles: async (): Promise<Vehicle[]> => {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy('number', 'asc'));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Vehicle));
        } catch (error) {
            console.error("Error fetching vehicles:", error);
            throw error;
        }
    },

    // Add vehicle
    addVehicle: async (vehicle: Omit<Vehicle, 'id'>): Promise<string> => {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...vehicle,
                createdAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error("Error adding vehicle:", error);
            throw error;
        }
    },

    // Delete vehicle
    deleteVehicle: async (id: string): Promise<void> => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.error("Error deleting vehicle:", error);
            throw error;
        }
    }
};
