import {
    Timestamp,
    deleteField,
    doc,
    onSnapshot,
    setDoc,
    type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const USERS_COLLECTION = 'users';
const DEFAULT_POSITION_KEY = 'default';
const FIELD_PATH_RESERVED_CHARS = new Set(['.', '[', ']', '*', '/']);

export interface DashboardQuickMenuPreference {
    selectedKeys: string[];
    updatedAt?: string;
}

export type DashboardQuickMenuPreferenceMap = Record<string, DashboardQuickMenuPreference>;

const normalizePositionKey = (positionId?: string | null): string => {
    const value = String(positionId || '').trim();
    if (!value) return DEFAULT_POSITION_KEY;
    return Array.from(value)
        .map((char) => (FIELD_PATH_RESERVED_CHARS.has(char) ? '_' : char))
        .join('') || DEFAULT_POSITION_KEY;
};

const normalizeSelectedKeys = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map((key) => String(key || '').trim()).filter(Boolean)));
};

const normalizePreferences = (value: unknown): DashboardQuickMenuPreferenceMap => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    return Object.entries(value as Record<string, unknown>).reduce<DashboardQuickMenuPreferenceMap>((acc, [positionKey, raw]) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return acc;

        const selectedKeys = normalizeSelectedKeys((raw as { selectedKeys?: unknown }).selectedKeys);
        if (selectedKeys.length === 0) return acc;

        acc[positionKey] = {
            selectedKeys,
            updatedAt: typeof (raw as { updatedAt?: unknown }).updatedAt === 'string'
                ? String((raw as { updatedAt?: unknown }).updatedAt)
                : undefined,
        };
        return acc;
    }, {});
};

const getUserRef = (uid: string) => doc(db, USERS_COLLECTION, uid);

export const dashboardQuickMenuService = {
    getPositionKey: normalizePositionKey,

    subscribe(uid: string, callback: (preferences: DashboardQuickMenuPreferenceMap) => void): Unsubscribe {
        if (!uid) {
            callback({});
            return () => undefined;
        }

        return onSnapshot(
            getUserRef(uid),
            (snapshot) => {
                const data = snapshot.data() as { dashboardQuickMenus?: unknown } | undefined;
                callback(normalizePreferences(data?.dashboardQuickMenus));
            },
            (error) => {
                console.error('[dashboardQuickMenuService] Subscribe error:', error);
                callback({});
            }
        );
    },

    async savePositionSelection(uid: string, positionId: string | null | undefined, selectedKeys: string[]): Promise<void> {
        if (!uid) throw new Error('missing-user');

        const positionKey = normalizePositionKey(positionId);
        const cleanedKeys = normalizeSelectedKeys(selectedKeys);
        if (cleanedKeys.length === 0) throw new Error('empty-selection');

        await setDoc(
            getUserRef(uid),
            {
                dashboardQuickMenus: {
                    [positionKey]: {
                        selectedKeys: cleanedKeys,
                        updatedAt: new Date().toISOString(),
                    },
                },
                updatedAt: Timestamp.now(),
            },
            { merge: true }
        );
    },

    async resetPositionSelection(uid: string, positionId: string | null | undefined): Promise<void> {
        if (!uid) throw new Error('missing-user');

        const positionKey = normalizePositionKey(positionId);
        await setDoc(
            getUserRef(uid),
            {
                dashboardQuickMenus: {
                    [positionKey]: deleteField(),
                },
                updatedAt: Timestamp.now(),
            },
            { merge: true }
        );
    },
};
