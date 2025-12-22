import { db } from '../config/firebase';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    query,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    writeBatch,
    Timestamp
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { UserRole } from '../types/roles';

export interface UserData {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    lastLogin: Timestamp;
    linkedWorkerIds?: string[]; // Array of linked worker IDs
    role?: UserRole | string; // Allow string for legacy roles (e.g. '사장') or new UserRole enum
    department?: string;
    position?: string;
    phoneNumber?: string;
}

const COLLECTION_NAME = 'users';

export const userService = {
    // Save or update user on login
    saveUser: async (user: User): Promise<void> => {
        try {
            const userRef = doc(db, COLLECTION_NAME, user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                await updateDoc(userRef, {
                    lastLogin: serverTimestamp(),
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL
                    // Note: We do NOT overwrite 'role' here, preserving existing role
                });
            } else {
                await setDoc(userRef, {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    lastLogin: serverTimestamp(),
                    linkedWorkerIds: [],
                    role: 'user' // Default role
                });
            }
        } catch (error) {
            console.error("Error saving user:", error);
            throw error;
        }
    },

    // Get a single user by UID
    getUser: async (uid: string): Promise<UserData | null> => {
        try {
            const userRef = doc(db, COLLECTION_NAME, uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                return userSnap.data() as UserData;
            }
            return null;
        } catch (error) {
            console.error("Error fetching user:", error);
            throw error;
        }
    },

    // Get all users who don't have any linked workers (or all users for management)
    getAllUsers: async (): Promise<UserData[]> => {
        try {
            const q = query(collection(db, COLLECTION_NAME));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => doc.data() as UserData);
        } catch (error) {
            console.error("Error fetching users:", error);
            throw error;
        }
    },

    // Link a user to a worker
    linkUserToWorker: async (uid: string, workerId: string, actorEmail: string = 'system'): Promise<void> => {
        try {
            // 1. Check if worker is already linked
            const workerRef = doc(db, 'workers', workerId);
            const workerSnap = await getDoc(workerRef);

            if (!workerSnap.exists()) {
                throw new Error('worker-not-found');
            }

            const workerData = workerSnap.data();
            if (workerData.uid) {
                if (workerData.uid === uid) {
                    throw new Error('already-linked-to-same-user');
                }
                throw new Error('worker-already-managed');
            }

            // 2. Link
            const userRef = doc(db, COLLECTION_NAME, uid);

            // Update User: Add to linkedWorkerIds
            await updateDoc(userRef, {
                linkedWorkerIds: arrayUnion(workerId)
            });

            // Update Worker: Set uid
            await updateDoc(workerRef, {
                uid: uid
            });

            // 3. Audit Log
            try {
                const { auditService } = await import('./auditService');
                await auditService.log({
                    action: 'LINK_USER_WORKER',
                    category: 'USER',
                    actorId: 'manager', // In a real app, pass the actual manager's ID
                    actorEmail: actorEmail,
                    targetId: uid,
                    details: { workerId, workerName: workerData.name }
                });
            } catch (e) {
                console.warn("Audit log failed", e);
            }

        } catch (error) {
            console.error("Error linking user to worker:", error);
            throw error;
        }
    },

    // Unlink a user from a worker
    unlinkUserFromWorker: async (uid: string, workerId: string): Promise<void> => {
        try {
            const batch = writeBatch(db);

            // 1. Remove from User
            const userRef = doc(db, COLLECTION_NAME, uid);
            batch.update(userRef, {
                linkedWorkerIds: arrayRemove(workerId)
            });

            // 2. Remove from Worker
            const workerRef = doc(db, 'workers', workerId);
            batch.update(workerRef, {
                uid: null, // Or delete the field
                updatedAt: serverTimestamp()
            });

            await batch.commit();
        } catch (error) {
            console.error("Error unlinking user from worker:", error);
            throw error;
        }
    },

    // Cleanup invalid links (remove worker IDs that don't exist in the workers collection)
    cleanupInvalidLinks: async (users: UserData[], allWorkerIds: string[]): Promise<void> => {
        try {
            const workerIdSet = new Set(allWorkerIds);
            const batch = writeBatch(db);
            let hasUpdates = false;

            users.forEach(user => {
                if (!user.linkedWorkerIds || user.linkedWorkerIds.length === 0) return;

                const validLinks = user.linkedWorkerIds.filter(id => workerIdSet.has(id));

                if (validLinks.length !== user.linkedWorkerIds.length) {
                    const userRef = doc(db, COLLECTION_NAME, user.uid);
                    batch.update(userRef, {
                        linkedWorkerIds: validLinks
                    });
                    hasUpdates = true;
                }
            });

            if (hasUpdates) {
                await batch.commit();
                console.log("Cleaned up invalid worker links.");
            }
        } catch (error) {
            console.error("Error cleaning up invalid links:", error);
            // Don't throw, just log
        }
    },

    // Update user role
    updateUserRole: async (uid: string, role: string): Promise<void> => {
        try {
            const userRef = doc(db, COLLECTION_NAME, uid);
            await updateDoc(userRef, {
                role: role
            });
        } catch (error) {
            console.error("Error updating user role:", error);
            throw error;
        }
    }
};
