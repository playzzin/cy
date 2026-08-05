import { db } from '../config/firebase';
import {
    collection,
    doc,
    getDocs,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    query,
    orderBy,
    Timestamp as FirestoreTimestamp,
} from 'firebase/firestore';
import { UserRole } from '../types/roles';
import { Timestamp } from '../types/timestamp';
import { BUSINESS_PARTNER_DEFAULT_POSITION_ROWS } from '../constants/businessPartnerPositions';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import {
    addDevPosition,
    deleteDevPosition,
    devPositions,
    restoreDevPositions,
    updateDevPosition,
    updateDevPositionRanks,
} from '../utils/devAdminFixtures';

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
    ...BUSINESS_PARTNER_DEFAULT_POSITION_ROWS,
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

const normalizePositionIdentity = (value: unknown): string =>
    String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const getPositionIdentityKeys = (position: Pick<Position, 'name' | 'legacyId'>): string[] =>
    [position.name, position.legacyId]
        .map(normalizePositionIdentity)
        .filter(Boolean);

const getPositionPrimaryKey = (position: Pick<Position, 'name' | 'legacyId' | 'id'>): string =>
    normalizePositionIdentity(position.name)
    || normalizePositionIdentity(position.legacyId)
    || normalizePositionIdentity(position.id);

const getDefaultPositionDocId = (position: Pick<Position, 'name' | 'legacyId'>): string => {
    const source = normalizePositionIdentity(position.legacyId) || normalizePositionIdentity(position.name);
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
        hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
    }
    return `default_${Math.abs(hash).toString(36) || 'position'}`;
};

const getRank = (position: Pick<Position, 'rank'>): number =>
    Number.isFinite(Number(position.rank)) ? Number(position.rank) : Number.MAX_SAFE_INTEGER;

const preferPosition = (current: Position, candidate: Position): Position => {
    const currentStable = String(current.id || '').startsWith('default_');
    const candidateStable = String(candidate.id || '').startsWith('default_');
    if (currentStable !== candidateStable) return candidateStable ? candidate : current;

    if (Boolean(current.legacyId) !== Boolean(candidate.legacyId)) {
        return candidate.legacyId ? candidate : current;
    }

    if (getRank(candidate) !== getRank(current)) {
        return getRank(candidate) < getRank(current) ? candidate : current;
    }

    return current;
};

const dedupePositions = (positions: Position[]): Position[] => {
    const byKey = new Map<string, Position>();

    positions.forEach((position) => {
        const key = getPositionPrimaryKey(position);
        if (!key) return;

        const existing = byKey.get(key);
        byKey.set(key, existing ? preferPosition(existing, position) : position);
    });

    return Array.from(byKey.values()).sort((a, b) => getRank(a) - getRank(b));
};

const mapPositionDoc = (docSnap: any): Position => {
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
};

const fetchRawPositions = async (): Promise<Position[]> => {
    const q = query(collection(db, 'positions'), orderBy('rank', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(mapPositionDoc).sort((a, b) => getRank(a) - getRank(b));
};

const writeDefaultPosition = async (position: Omit<Position, 'id'>): Promise<void> => {
    const now = FirestoreTimestamp.now();
    await setDoc(doc(db, 'positions', getDefaultPositionDocId(position)), {
        ...position,
        iconKey: normalizeIconKey(position.iconKey || position.icon),
        createdAt: now,
        updatedAt: now,
    }, { merge: true });
};

const ensureDefaultPositionsPresent = async (positions: Position[]): Promise<boolean> => {
    const existingKeys = new Set(positions.flatMap(getPositionIdentityKeys));
    const missingDefaults = DEFAULT_POSITIONS.filter((position) =>
        !getPositionIdentityKeys(position).some((key) => existingKeys.has(key))
    );

    if (missingDefaults.length === 0) return false;

    try {
        await Promise.all(missingDefaults.map(writeDefaultPosition));
        cachedPositions = null;
        return true;
    } catch (error) {
        console.error('Error ensuring default positions:', error);
        return false;
    }
};

export const positionService = {
    getPositions: async (forceRefresh: boolean = false): Promise<Position[]> => {
        if (isDevAdminSessionEnabled()) {
            return dedupePositions([...devPositions]);
        }

        const now = Date.now();
        if (!forceRefresh && cachedPositions && (now - lastPositionFetchTime < POSITION_CACHE_TTL)) {
            return cachedPositions;
        }

        try {
            const mapped = await fetchRawPositions();

            if (mapped.length === 0) {
                await positionService.initializeDefaults();
                return await positionService.getPositions(true); // Retry after initialization
            }

            const addedMissingDefaults = await ensureDefaultPositionsPresent(mapped);
            if (addedMissingDefaults) {
                return await positionService.getPositions(true);
            }

            const uniquePositions = dedupePositions(mapped);
            cachedPositions = uniquePositions;
            lastPositionFetchTime = now;

            return uniquePositions;
        } catch (error) {
            console.error("Error fetching positions:", error);
            // Fallback to local default if offline or failed
            return dedupePositions(DEFAULT_POSITIONS as Position[]);
        }
    },

    addPosition: async (position: Omit<Position, 'id'>): Promise<string> => {
        if (isDevAdminSessionEnabled()) {
            const normalizedPosition = { ...position };
            const derivedIconKey = normalizeIconKey(normalizedPosition.iconKey) || normalizeIconKey(normalizedPosition.icon);
            normalizedPosition.iconKey = derivedIconKey;
            const nextName = normalizePositionIdentity(normalizedPosition.name);
            if (devPositions.some((item) => normalizePositionIdentity(item.name) === nextName)) {
                throw new Error(`Position already exists: ${normalizedPosition.name}`);
            }
            return addDevPosition(normalizedPosition);
        }

        try {
            const normalizedPosition = { ...position };
            const derivedIconKey = normalizeIconKey(normalizedPosition.iconKey) || normalizeIconKey(normalizedPosition.icon);
            normalizedPosition.iconKey = derivedIconKey;
            const nextName = normalizePositionIdentity(normalizedPosition.name);
            const existingPositions = await fetchRawPositions();
            if (existingPositions.some((item) => normalizePositionIdentity(item.name) === nextName)) {
                throw new Error(`Position already exists: ${normalizedPosition.name}`);
            }

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
        if (isDevAdminSessionEnabled()) {
            updateDevPosition(id, updates);
            return;
        }

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

            const { menuServiceV11 } = await import('./menuServiceV11');
            const menuSync = await menuServiceV11.renamePositionReferences(oldName, newName);

            const { rolePermissionService } = await import('./rolePermissionService');
            const permissionSync = await rolePermissionService.renamePositionKey(oldName, newName);

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

            console.log(
                `Updated position name "${oldName}" -> "${newName}", synced ${synced} workers, ` +
                `${menuSync.roleReferences} menu role references, ${menuSync.positionConfigs} menu position configs, ` +
                `and ${permissionSync.renamed ? 1 : 0} legacy permission keys.`
            );

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
        if (isDevAdminSessionEnabled()) {
            updateDevPositionRanks(rankUpdates);
            return;
        }

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
        if (isDevAdminSessionEnabled()) {
            deleteDevPosition(id);
            return;
        }

        try {
            await deleteDoc(doc(db, 'positions', id));
            cachedPositions = null;
        } catch (error) {
            console.error("Error deleting position:", error);
            throw error;
        }
    },

    initializeDefaults: async (): Promise<void> => {
        if (isDevAdminSessionEnabled()) {
            restoreDevPositions();
            return;
        }

        try {
            // Check existing first
            const q = query(collection(db, 'positions'));
            const snap = await getDocs(q);
            const existingNames = new Set(
                snap.docs.flatMap((docSnap) => getPositionIdentityKeys(docSnap.data() as Pick<Position, 'name' | 'legacyId'>))
            );

            const toCreate = DEFAULT_POSITIONS.filter((pos) =>
                !getPositionIdentityKeys(pos).some((key) => existingNames.has(key))
            );

            const promises = toCreate.map(writeDefaultPosition);

            await Promise.all(promises);
            cachedPositions = null;
            console.log("Default positions initialized in Firestore");
        } catch (error) {
            console.error("Error initializing default positions:", error);
        }
    },

    removeDuplicates: async (): Promise<{ removed: number; kept: string[] }> => {
        try {
            const positions = isDevAdminSessionEnabled()
                ? [...devPositions].sort((a, b) => getRank(a) - getRank(b))
                : await fetchRawPositions();

            const grouped: Record<string, Position[]> = {};
            positions.forEach(pos => {
                const key = getPositionPrimaryKey(pos);
                if (!key) return;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(pos);
            });

            let removedCount = 0;
            const keptNames: string[] = [];

            for (const positionsGroup of Object.values(grouped)) {
                if (positionsGroup.length > 1) {
                    const keep = positionsGroup.reduce(preferPosition);
                    keptNames.push(keep.name);
                    const toDelete = positionsGroup.filter((pos) => pos.id && pos.id !== keep.id);
                    for (const pos of toDelete) {
                        if (pos.id) {
                            await positionService.deletePosition(pos.id);
                            removedCount++;
                        }
                    }
                } else if (positionsGroup[0]?.name) {
                    keptNames.push(positionsGroup[0].name);
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
