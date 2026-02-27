import app, { db } from '../config/firebase';
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createAppUser, listAppUsers, updateAppUser } from '../dataconnect-generated';
import { Timestamp } from '../types/timestamp';
import { User } from 'firebase/auth';
import { UserRole } from '../types/roles';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

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
}

const dc = getDataConnect(app, connectorConfig);

const parseLinkedWorkerIds = (raw?: string | null): string[] => {
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

const serializeLinkedWorkerIds = (ids: string[]): string => {
    const uniq = Array.from(new Set(ids.map((v) => String(v)).filter(Boolean)));
    return JSON.stringify(uniq);
};

const toFirestoreTimestamp = (value: any, fallback?: any): Timestamp => {
    const raw = value ?? fallback;
    const s = raw ? String(raw) : '';
    const d = s ? new Date(s) : new Date();
    return Timestamp.fromDate(Number.isNaN(d.getTime()) ? new Date() : d);
};

const findAppUserRow = async (params: { uid?: string; email?: string }): Promise<any | null> => {
    const uid = params.uid ? String(params.uid) : '';
    const email = params.email ? String(params.email) : '';
    if (!uid && !email) return null;
    try {
        const res = await listAppUsers(dc);
        const rows = (res as any)?.data?.appUsers ?? [];
        return (
            rows.find((r: any) => uid && (String(r?.uid ?? '') === uid || String(r?.id ?? '') === uid))
            ?? rows.find((r: any) => email && String(r?.email ?? '') === email)
            ?? null
        );
    } catch (error) {
        console.error("DataConnect: listAppUsers failed in findAppUserRow", error);
        return null;
    }
};

const mapUserFromDc = (row: any): UserData => {
    const uid = row?.uid ? String(row.uid) : (row?.id ? String(row.id) : '');
    const email = row?.email ?? null;
    const displayName = row?.displayName ?? null;
    const photoURL = row?.photoUrl ?? null;
    const linkedWorkerIds = parseLinkedWorkerIds(row?.linkedWorkerIds);
    const role = row?.role ?? 'user';
    const phoneNumber = row?.phoneNumber ?? undefined;
    const department = row?.department ?? undefined;
    const position = row?.position ?? undefined;
    const lastLogin = toFirestoreTimestamp(row?.lastLogin, row?.updatedAt ?? row?.createdAt);

    return {
        uid,
        email,
        displayName,
        photoURL,
        lastLogin,
        linkedWorkerIds,
        role,
        phoneNumber,
        department,
        position
    } as UserData;
};


// Firestore Sync Helper
const syncToFirestore = async (uid: string, data: Partial<UserData> & { lastLogin?: string }) => {
    if (!uid) return;
    try {
        const userRef = doc(db, 'users', uid);
        const payload: any = { ...data };

        // Ensure lastLogin is a Firestore Timestamp or Date if it's an ISO string
        if (typeof payload.lastLogin === 'string') {
            payload.lastLogin = new Date(payload.lastLogin);
        }

        // We use setDoc with merge: true to handle both create and update
        await setDoc(userRef, payload, { merge: true });
    } catch (error) {
        console.error(`[UserService] Failed to sync user ${uid} to Firestore:`, error);
    }
};

export const userService = {
    // Save or update user on login
    saveUser: async (user: User): Promise<void> => {
        try {
            const existing = await findAppUserRow({ uid: user.uid, email: user.email ?? undefined });
            const nowIso = new Date().toISOString();

            // Firestore Sync
            const firestoreData: any = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                lastLogin: nowIso,
            };
            if (existing?.role) {
                firestoreData.role = existing.role;
            } else if (!existing) {
                firestoreData.role = 'user';
            }
            await syncToFirestore(user.uid, firestoreData);

            if (existing?.id) {
                await updateAppUser(dc, {
                    id: String(existing.id),
                    uid: user.uid,
                    email: user.email ?? null,
                    displayName: user.displayName ?? null,
                    photoUrl: user.photoURL ?? null,
                    lastLogin: nowIso
                } as any);
                return;
            }

            await createAppUser(dc, {
                id: user.uid,
                uid: user.uid,
                email: user.email ?? null,
                displayName: user.displayName ?? null,
                photoUrl: user.photoURL ?? null,
                linkedWorkerIds: '[]',
                role: 'user',
                lastLogin: nowIso
            } as any);
        } catch (error) {
            console.error("Error saving user:", error);
            throw error;
        }
    },

    // Get a single user by UID
    getUser: async (uid: string): Promise<UserData | null> => {
        try {
            const row = await findAppUserRow({ uid });
            if (!row) return null;
            return mapUserFromDc(row);
        } catch (error) {
            console.error("Error fetching user:", error);
            throw error;
        }
    },

    // Get all users who don't have any linked workers (or all users for management)
    getAllUsers: async (): Promise<UserData[]> => {
        try {
            const res = await listAppUsers(dc);
            const rows = (res as any)?.data?.appUsers ?? [];
            return rows.map((r: any) => mapUserFromDc(r));
        } catch (error) {
            console.error("DataConnect: listAppUsers failed in getAllUsers", error);
            return []; // Return empty array on error
        }
    },

    // Link a user to a worker
    linkUserToWorker: async (uid: string, workerId: string, actorEmail: string = 'system'): Promise<void> => {
        try {
            let users = [];
            try {
                const res = await listAppUsers(dc);
                users = (res as any)?.data?.appUsers ?? [];
            } catch (error) {
                console.error("DataConnect: listAppUsers failed in linkUserToWorker", error);
                throw new Error("Failed to retrieve user list to check for existing links.");
            }

            const workerKey = String(workerId);
            const alreadyLinked = users.find((u: any) => {
                const ids = parseLinkedWorkerIds(u?.linkedWorkerIds);
                return ids.includes(workerKey);
            });

            if (alreadyLinked) {
                const linkedUid = alreadyLinked?.uid ? String(alreadyLinked.uid) : String(alreadyLinked?.id ?? '');
                if (linkedUid === String(uid)) {
                    throw new Error('already-linked-to-same-user');
                }
                throw new Error('worker-already-managed');
            }

            const existing = await findAppUserRow({ uid });
            const existingLinked = parseLinkedWorkerIds(existing?.linkedWorkerIds);
            const nextLinked = serializeLinkedWorkerIds([...existingLinked, workerKey]);

            if (existing?.id) {
                await updateAppUser(dc, { id: String(existing.id), linkedWorkerIds: nextLinked } as any);
            } else {
                await createAppUser(dc, {
                    id: uid,
                    uid,
                    linkedWorkerIds: nextLinked,
                    role: 'user',
                    lastLogin: new Date().toISOString()
                } as any);
            }

            // 3. Audit Log
            try {
                const { auditService } = await import('./auditService');
                const { manpowerService } = await import('./manpowerService');
                const workerName = (await manpowerService.getWorker(workerId))?.name;
                await auditService.log({
                    action: 'LINK_USER_WORKER',
                    category: 'USER',
                    actorId: 'manager', // In a real app, pass the actual manager's ID
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
            const existing = await findAppUserRow({ uid });
            if (!existing?.id) return;

            const current = parseLinkedWorkerIds(existing?.linkedWorkerIds);
            const next = current.filter((id) => String(id) !== String(workerId));
            await updateAppUser(dc, { id: String(existing.id), linkedWorkerIds: serializeLinkedWorkerIds(next) } as any);
        } catch (error) {
            console.error("Error unlinking user from worker:", error);
            throw error;
        }
    },

    // Cleanup invalid links (remove worker IDs that don't exist in the workers collection)
    cleanupInvalidLinks: async (users: UserData[], allWorkerIds: string[]): Promise<void> => {
        try {
            const workerIdSet = new Set(allWorkerIds);
            let hasUpdates = false;

            users.forEach(user => {
                if (!user.linkedWorkerIds || user.linkedWorkerIds.length === 0) return;

                const validLinks = user.linkedWorkerIds.filter(id => workerIdSet.has(id));

                if (validLinks.length !== user.linkedWorkerIds.length) {
                    hasUpdates = true;
                }
            });

            if (!hasUpdates) return;

            for (const user of users) {
                if (!user.linkedWorkerIds || user.linkedWorkerIds.length === 0) continue;
                const validLinks = user.linkedWorkerIds.filter(id => workerIdSet.has(id));
                if (validLinks.length === user.linkedWorkerIds.length) continue;
                const row = await findAppUserRow({ uid: user.uid, email: user.email ?? undefined });
                const id = row?.id ? String(row.id) : String(user.uid);
                await updateAppUser(dc, { id, linkedWorkerIds: serializeLinkedWorkerIds(validLinks) } as any);
            }
        } catch (error) {
            console.error("Error cleaning up invalid links:", error);
            // Don't throw, just log
        }
    },

    // Update user role
    updateUserRole: async (uid: string, role: string): Promise<void> => {
        try {
            // Update Firestore First
            await syncToFirestore(uid, { role } as any);

            const existing = await findAppUserRow({ uid });
            if (existing?.id) {
                await updateAppUser(dc, { id: String(existing.id), role } as any);
                return;
            }

            await createAppUser(dc, {
                id: uid,
                uid,
                role,
                linkedWorkerIds: '[]',
                lastLogin: new Date().toISOString()
            } as any);
        } catch (error) {
            console.error("Error updating user role:", error);
            throw error;
        }
    },

    updateUserProfile: async (uid: string, updates: Partial<Pick<UserData, 'displayName' | 'photoURL' | 'phoneNumber' | 'department' | 'position'>>): Promise<void> => {
        try {
            // Update Firestore
            await syncToFirestore(uid, updates);

            const existing = await findAppUserRow({ uid });
            const id = existing?.id ? String(existing.id) : String(uid);

            const vars: any = { id };
            if (updates.displayName !== undefined) vars.displayName = updates.displayName;
            if (updates.photoURL !== undefined) vars.photoUrl = updates.photoURL;
            if (updates.phoneNumber !== undefined) vars.phoneNumber = updates.phoneNumber;
            if (updates.department !== undefined) vars.department = updates.department;
            if (updates.position !== undefined) vars.position = updates.position;

            const hasMutationFields = Object.keys(vars).some((k) => k !== 'id');
            if (!hasMutationFields) return;

            if (existing?.id) {
                await updateAppUser(dc, vars as any);
                return;
            }

            await createAppUser(dc, {
                id,
                uid,
                displayName: updates.displayName ?? null,
                photoUrl: updates.photoURL ?? null,
                phoneNumber: updates.phoneNumber ?? null,
                department: updates.department ?? null,
                position: updates.position ?? null,
                role: 'user',
                linkedWorkerIds: '[]',
                lastLogin: new Date().toISOString()
            } as any);
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw error;
        }
    }
};
