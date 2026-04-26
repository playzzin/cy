import { db } from '../config/firebase';
import { userFirestoreService } from './userFirestoreService';
import { User } from 'firebase/auth';
import { UserRole } from '../types/roles';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';

// In-memory cache for user data
const userCache = new Map<string, { data: UserData; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes cache

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
    additionalPositions?: string[]; // 추가 직책 (메뉴 권한 확장용)
    updatedAt?: Timestamp;
}

const parseLinkedWorkerIds = (raw?: any): string[] => {
    if (Array.isArray(raw)) return raw.map(String);
    const value = raw ? String(raw) : '';
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((v) => String(v)).filter(Boolean);
    } catch {
        return [];
    }
};

const serializeLinkedWorkerIds = (ids: string[]): string[] => {
    return Array.from(new Set(ids.map((v) => String(v)).filter(Boolean)));
};

/**
 * UserService (Facade)
 * Completely migrated to Firestore-only operations.
 */
export const userService = {
    // Save or update user on login
    saveUser: async (user: User): Promise<void> => {
        try {
            const existing = await userFirestoreService.getUser(user.uid);
            const now = new Date();

            const userData: Partial<UserData> = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                lastLogin: Timestamp.fromDate(now),
            };

            if (!existing) {
                userData.role = 'user';
                userData.linkedWorkerIds = [];
            }

            await userFirestoreService.saveUser(user.uid, userData);
            userCache.delete(user.uid); // Invalidate cache
        } catch (error) {
            console.error("Error saving user:", error);
            throw error;
        }
    },

    // Get a single user by UID
    getUser: async (uid: string): Promise<UserData | null> => {
        const now = Date.now();
        const cached = userCache.get(uid);
        if (cached && (now - cached.timestamp < CACHE_TTL)) {
            return cached.data;
        }

        const user = await userFirestoreService.getUser(uid);
        if (user) {
            userCache.set(uid, { data: user, timestamp: now });
        }
        return user;
    },

    // Get all users
    getAllUsers: async (): Promise<UserData[]> => {
        return userFirestoreService.getAllUsers();
    },

    // Link a user to a worker
    linkUserToWorker: async (uid: string, workerId: string, actorEmail: string = 'system'): Promise<void> => {
        try {
            const users = await userFirestoreService.getAllUsers();
            const workerKey = String(workerId);

            const alreadyLinked = users.find((u: any) => {
                const ids = parseLinkedWorkerIds(u?.linkedWorkerIds);
                return ids.includes(workerKey);
            });

            if (alreadyLinked) {
                if (alreadyLinked.uid === uid) {
                    throw new Error('already-linked-to-same-user');
                }
                throw new Error('worker-already-managed');
            }

            const existing = await userFirestoreService.getUser(uid);
            const existingLinked = parseLinkedWorkerIds(existing?.linkedWorkerIds);
            const nextLinked = serializeLinkedWorkerIds([...existingLinked, workerKey]);

            await userFirestoreService.updateUser(uid, { linkedWorkerIds: nextLinked });
            userCache.delete(uid); // Invalidate cache

            // Audit Log (Fire and Forget)
            try {
                const { auditService } = await import('./auditService');
                const { manpowerService } = await import('./manpowerService');
                const workerName = (await manpowerService.getWorker(workerId))?.name;
                await auditService.log({
                    action: 'LINK_USER_WORKER',
                    category: 'USER',
                    actorId: 'manager',
                    actorEmail: actorEmail,
                    targetId: uid,
                    details: { workerId, workerName }
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
            const existing = await userFirestoreService.getUser(uid);
            if (!existing) return;

            const current = parseLinkedWorkerIds(existing.linkedWorkerIds);
            const next = current.filter((id) => String(id) !== String(workerId));

            await userFirestoreService.updateUser(uid, { linkedWorkerIds: next });
            userCache.delete(uid); // Invalidate cache
        } catch (error) {
            console.error("Error unlinking user from worker:", error);
            throw error;
        }
    },

    // Cleanup invalid links
    cleanupInvalidLinks: async (users: UserData[], allWorkerIds: string[]): Promise<void> => {
        try {
            const workerIdSet = new Set(allWorkerIds);
            for (const user of users) {
                const currentLinks = parseLinkedWorkerIds(user.linkedWorkerIds);
                const validLinks = currentLinks.filter(id => workerIdSet.has(id));

                if (validLinks.length !== currentLinks.length) {
                    await userFirestoreService.updateUser(user.uid, { linkedWorkerIds: validLinks });
                }
            }
        } catch (error) {
            console.error("Error cleaning up invalid links:", error);
        }
    },

    // Update user role
    updateUserRole: async (uid: string, role: string): Promise<void> => {
        await userFirestoreService.updateUser(uid, { role } as any);
        userCache.delete(uid); // Invalidate cache
    },

    // Update user profile
    updateUserProfile: async (uid: string, updates: Partial<UserData>): Promise<void> => {
        await userFirestoreService.updateUser(uid, updates);
        userCache.delete(uid); // Invalidate cache
    }
};
