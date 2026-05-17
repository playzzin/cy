import { db } from '../config/firebase';
import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    query,
    orderBy,
    Timestamp as FirestoreTimestamp,
} from 'firebase/firestore';
import { UserRole } from '../types/roles';
import { Timestamp } from '../types/timestamp';

export interface Position {
    id?: string;
    legacyId?: string;
    name: string;
    rank: number;
    color: string;
    icon?: string;
    iconKey?: string;
    description?: string;
    isDefault?: boolean;
    systemRole: UserRole;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

// In-memory cache for positions
let cachedPositions: Position[] | null = null;
let lastPositionFetchTime: number = 0;
const POSITION_CACHE_TTL = 1000 * 60 * 10; // 10 minutes cache

const toTimestamp = (value?: any): Timestamp | undefined => {
    if (!value) return undefined;
    if (value instanceof FirestoreTimestamp) {
        return Timestamp.fromDate(value.toDate());
    }
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
        return Timestamp.fromDate(d);
    }
    return undefined;
};

const toSystemRole = (value: unknown): UserRole => {
    const raw = typeof value === 'string' ? value : '';
    if (Object.values(UserRole).includes(raw as UserRole)) {
        return raw as UserRole;
    }
    return UserRole.GENERAL;
};

const DEFAULT_POSITIONS: Omit<Position, 'id'>[] = [
    { name: '사장', rank: 1, color: 'purple', icon: 'faCrown', iconKey: 'fa-crown', description: '업체 대표', isDefault: true, systemRole: UserRole.GENERAL },
    { name: '매니저1', rank: 2, color: 'orange', icon: 'faUserTie', iconKey: 'fa-user-tie', description: '총괄 매니저', isDefault: true, systemRole: UserRole.MANAGER },
    { name: '매니저2', rank: 2.1, color: 'orange', icon: 'faUserTie', iconKey: 'fa-user-tie', description: '구역 매니저', isDefault: true, systemRole: UserRole.MANAGER },
    { name: '매니저3', rank: 2.2, color: 'yellow', icon: 'faUserTie', iconKey: 'fa-user-tie', description: '지원 매니저', isDefault: true, systemRole: UserRole.MANAGER },
    { name: '팀장', rank: 3, color: 'blue', icon: 'faUserShield', iconKey: 'fa-user-shield', description: '시공 팀장', isDefault: true, systemRole: UserRole.GENERAL },
    { name: '반장', rank: 4, color: 'green', icon: 'faHardHat', iconKey: 'fa-hard-hat', description: '현장 반장', isDefault: true, systemRole: UserRole.GENERAL },
    { name: '일반', rank: 5, color: 'gray', icon: 'faUser', iconKey: 'fa-user', description: '일반 작업자', isDefault: true, systemRole: UserRole.GENERAL },
    { name: '신규자', rank: 99, color: 'slate', icon: 'faUserPlus', iconKey: 'fa-user-plus', description: '신규 가입자', isDefault: true, systemRole: UserRole.GENERAL },
];

const normalizeIconKey = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.includes('-')) return trimmed;
    if (!trimmed.startsWith('fa')) return trimmed;
    const withoutFa = trimmed.slice(2);
    if (!withoutFa) return '';
    const kebab = withoutFa.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    return `fa${kebab}`;
};

export const positionService = {
    getPositions: async (forceRefresh: boolean = false): Promise<Position[]> => {
        const now = Date.now();
        if (!forceRefresh && cachedPositions && (now - lastPositionFetchTime < POSITION_CACHE_TTL)) {
            return cachedPositions;
        }

        try {
            const q = query(collection(db, 'positions'), orderBy('rank', 'asc'));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                await positionService.initializeDefaults();
                return await positionService.getPositions(true); // Retry after initialization
            }

            const mapped: Position[] = querySnapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    legacyId: data.legacyId,
                    name: data.name,
                    rank: data.rank,
                    color: data.color || 'gray',
                    icon: data.icon,
                    iconKey: data.iconKey,
                    description: data.description,
                    isDefault: data.isDefault || false,
                    systemRole: toSystemRole(data.systemRole),
                    createdAt: toTimestamp(data.createdAt),
                    updatedAt: toTimestamp(data.updatedAt)
                };
            });

            mapped.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
            cachedPositions = mapped;
            lastPositionFetchTime = now;

            return mapped;
        } catch (error) {
            console.error("Error fetching positions:", error);
            // Fallback to local default if offline or failed
            return DEFAULT_POSITIONS as Position[];
        }
    },

    addPosition: async (position: Omit<Position, 'id'>): Promise<string> => {
        try {
            const normalizedPosition = { ...position };
            const derivedIconKey = normalizeIconKey(normalizedPosition.iconKey) || normalizeIconKey(normalizedPosition.icon);
            normalizedPosition.iconKey = derivedIconKey;

            const docRef = await addDoc(collection(db, 'positions'), {
                ...normalizedPosition,
                createdAt: FirestoreTimestamp.now(),
                updatedAt: FirestoreTimestamp.now(),
            });

            cachedPositions = null;
            return docRef.id;
        } catch (error) {
            console.error("Error adding position:", error);
            throw error;
        }
    },

    updatePosition: async (id: string, updates: Partial<Position>): Promise<void> => {
        try {
            const normalizedUpdates = { ...updates };

            if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'iconKey')) {
                normalizedUpdates.iconKey = normalizeIconKey(normalizedUpdates.iconKey);
            }
            if (!normalizedUpdates.iconKey && normalizedUpdates.icon) {
                const derived = normalizeIconKey(normalizedUpdates.icon);
                if (derived) normalizedUpdates.iconKey = derived;
            }

            const docRef = doc(db, 'positions', id);
            await updateDoc(docRef, {
                ...normalizedUpdates,
                updatedAt: FirestoreTimestamp.now(),
            });

            cachedPositions = null;
        } catch (error) {
            console.error("Error updating position:", error);
            throw error;
        }
    },

    updatePositionNameWithSync: async (id: string, oldName: string, newName: string): Promise<void> => {
        try {
            await positionService.updatePosition(id, { name: newName });

            const { manpowerService } = await import('./manpowerService');
            const workers = await manpowerService.getWorkers();
            const targetIds = workers
                .filter(w => (w.id && String(w.role ?? '') === String(oldName)))
                .map(w => String(w.id));

            const CHUNK_SIZE = 25;
            let synced = 0;
            for (let i = 0; i < targetIds.length; i += CHUNK_SIZE) {
                const chunk = targetIds.slice(i, i + CHUNK_SIZE);
                await Promise.all(chunk.map(workerId => manpowerService.updateWorker(workerId, { role: newName })));
                synced += chunk.length;
            }

            console.log(`Updated position name "${oldName}" -> "${newName}" and synced ${synced} workers.`);

        } catch (error) {
            console.error("Error updating position name with sync:", error);
            throw error;
        }
    },

    updatePositionColor: async (id: string, newColor: string): Promise<void> => {
        try {
            await positionService.updatePosition(id, { color: newColor });
        } catch (error) {
            console.error("Error updating position color:", error);
            throw error;
        }
    },

    updatePositionRanks: async (rankUpdates: Array<{ id: string; rank: number }>): Promise<void> => {
        try {
            const batch = writeBatch(db);
            const updatedAt = FirestoreTimestamp.now();

            rankUpdates.forEach(({ id, rank }) => {
                batch.update(doc(db, 'positions', id), {
                    rank,
                    updatedAt,
                });
            });

            await batch.commit();
            cachedPositions = null;
        } catch (error) {
            console.error("Error updating position ranks:", error);
            throw error;
        }
    },

    deletePosition: async (id: string): Promise<void> => {
        try {
            await deleteDoc(doc(db, 'positions', id));
            cachedPositions = null;
        } catch (error) {
            console.error("Error deleting position:", error);
            throw error;
        }
    },

    initializeDefaults: async (): Promise<void> => {
        try {
            // Check existing first
            const q = query(collection(db, 'positions'));
            const snap = await getDocs(q);
            const existingNames = new Set(
                snap.docs.map(doc => doc.data().name).filter(Boolean)
            );

            const toCreate = DEFAULT_POSITIONS.filter((pos) => !existingNames.has(pos.name));

            const promises = toCreate.map(pos =>
                addDoc(collection(db, 'positions'), {
                    ...pos,
                    iconKey: normalizeIconKey(pos.iconKey || pos.icon),
                    createdAt: FirestoreTimestamp.now(),
                    updatedAt: FirestoreTimestamp.now()
                })
            );

            await Promise.all(promises);
            cachedPositions = null;
            console.log("Default positions initialized in Firestore");
        } catch (error) {
            console.error("Error initializing default positions:", error);
        }
    },

    removeDuplicates: async (): Promise<{ removed: number; kept: string[] }> => {
        try {
            const positions = await positionService.getPositions(true);

            const grouped: Record<string, Position[]> = {};
            positions.forEach(pos => {
                const key = pos.name;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(pos);
            });

            let removedCount = 0;
            const keptNames: string[] = [];

            for (const [name, positionsGroup] of Object.entries(grouped)) {
                keptNames.push(name);
                if (positionsGroup.length > 1) {
                    const toDelete = positionsGroup.slice(1);
                    for (const pos of toDelete) {
                        if (pos.id) {
                            await positionService.deletePosition(pos.id);
                            removedCount++;
                        }
                    }
                }
            }

            console.log(`Removed ${removedCount} duplicate positions`);
            return { removed: removedCount, kept: keptNames };
        } catch (error) {
            console.error("Error removing duplicates:", error);
            throw error;
        }
    },

    deleteSkilledWorker: async (): Promise<void> => {
        try {
            const positions = await positionService.getPositions();
            const targets = positions.filter((p) => p.name === '기능공' && p.id);
            for (const pos of targets) {
                await positionService.deletePosition(pos.id!);
                console.log(`Deleted legacy position: ${pos.id}`);
            }
        } catch (error) {
            console.error("Error deleting Skilled Worker:", error);
        }
    },

    resetToDefaults: async (): Promise<void> => {
        try {
            const positions = await positionService.getPositions(true);
            const deletePromises = positions
                .filter((p) => p.id)
                .map((p) => positionService.deletePosition(p.id!));
            await Promise.all(deletePromises);
            console.log("All existing positions cleared.");
            await positionService.initializeDefaults();
        } catch (error) {
            console.error("Error resetting to defaults:", error);
            throw error;
        }
    }
};
