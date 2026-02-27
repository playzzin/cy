import app from '../config/firebase';
import { getDataConnect } from 'firebase/data-connect';
import {
    connectorConfig,
    createPosition as createPositionDc,
    deletePosition as deletePositionDc,
    listAllPositions as listPositionsDc
} from '../dataconnect-generated';
import { updatePosition as updatePositionDc } from './dataconnectCompat';
import { UserRole } from '../types/roles';
import { Timestamp } from '../types/timestamp';

export interface Position {
    id?: string;
    legacyId?: string;
    name: string;       // 직책명 (예: 안전관리자)
    rank: number;       // 서열 (낮을수록 높음, 예: 1=사장, 99=신규자)
    color: string;      // UI 표시 색상 (red, blue, green, etc.)
    icon?: string;      // 아이콘 이름 (FontAwesome 아이콘명)
    iconKey?: string;
    description?: string; // 설명
    isDefault?: boolean; // 시스템 기본 직책 여부 (삭제 불가)
    systemRole: UserRole; // 시스템 권한 매핑 (관리자/매니저/일반)
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

const dc = getDataConnect(app, connectorConfig);

const isUuidString = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const dcPositionLegacyIdToUuid = new Map<string, string>();
let dcPositionsLoaded = false;

const loadDcPositions = async (): Promise<void> => {
    if (dcPositionsLoaded) return;
    const response = await listPositionsDc(dc);
    const rows = (response as any)?.data?.positions ?? [];
    dcPositionLegacyIdToUuid.clear();
    for (const row of rows) {
        const legacyId = row?.legacyId ? String(row.legacyId) : '';
        const id = row?.id ? String(row.id) : '';
        if (legacyId && id) dcPositionLegacyIdToUuid.set(legacyId, id);
        if (id) dcPositionLegacyIdToUuid.set(id, id);
    }
    dcPositionsLoaded = true;
};

const resolvePositionUuid = async (id: string): Promise<string | null> => {
    const raw = id ? String(id) : '';
    if (!raw) return null;
    if (isUuidString(raw)) return raw;
    await loadDcPositions();
    const existing = dcPositionLegacyIdToUuid.get(raw);
    if (existing) return existing;

    dcPositionsLoaded = false;
    await loadDcPositions();
    return dcPositionLegacyIdToUuid.get(raw) ?? null;
};

const toTimestamp = (value?: string | null): Timestamp | undefined => {
    if (!value) return undefined;
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return undefined;
    return Timestamp.fromDate(d);
};

const toSystemRole = (value: unknown): UserRole => {
    const raw = typeof value === 'string' ? value : '';
    if (Object.values(UserRole).includes(raw as UserRole)) {
        return raw as UserRole;
    }
    return UserRole.GENERAL;
};

const mapDcPosition = (row: any): Position => {
    const uuid = row?.id ? String(row.id) : '';
    const legacyId = row?.legacyId ? String(row.legacyId) : undefined;
    const id = legacyId || uuid;
    return {
        id,
        legacyId,
        name: row?.name ? String(row.name) : '',
        rank: typeof row?.rank === 'number' ? row.rank : (row?.rank != null ? Number(row.rank) : 0),
        color: row?.color ? String(row.color) : 'gray',
        icon: row?.icon ? String(row.icon) : undefined,
        iconKey: row?.iconKey ? String(row.iconKey) : undefined,
        description: row?.description ? String(row.description) : undefined,
        isDefault: row?.isDefault != null ? Boolean(row.isDefault) : false,
        systemRole: toSystemRole(row?.systemRole),
        createdAt: toTimestamp(row?.createdAt),
        updatedAt: toTimestamp(row?.updatedAt)
    };
};

// 기본 직책 데이터
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
    // 모든 직책 조회 (서열순 정렬)
    getPositions: async (): Promise<Position[]> => {
        try {
            const response = await listPositionsDc(dc);
            const rows = (response as any)?.data?.positions ?? [];

            if (!Array.isArray(rows) || rows.length === 0) {
                await positionService.initializeDefaults();
                return await positionService.getPositions();
            }

            const mapped = rows.map(mapDcPosition);
            mapped.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
            return mapped;
        } catch (error) {
            console.error("Error fetching positions:", error);
            return [];
        }
    },

    // 직책 추가
    addPosition: async (position: Omit<Position, 'id'>): Promise<string> => {
        try {
            const normalizedPosition: Omit<Position, 'id'> = { ...position };
            const derivedIconKey = normalizeIconKey(normalizedPosition.iconKey) || normalizeIconKey(normalizedPosition.icon);
            normalizedPosition.iconKey = derivedIconKey;

            const response = await createPositionDc(dc, {
                name: normalizedPosition.name,
                legacyId: normalizedPosition.legacyId ? String(normalizedPosition.legacyId) : null,
                rank: normalizedPosition.rank,
                color: normalizedPosition.color,
                icon: normalizedPosition.icon ?? null,
                iconKey: normalizedPosition.iconKey ?? null,
                description: normalizedPosition.description ?? null,
                systemRole: normalizedPosition.systemRole ?? UserRole.GENERAL,
                isDefault: normalizedPosition.isDefault ?? false
            } as any);

            dcPositionsLoaded = false;
            const inserted = (response as any)?.data?.position_insert;
            return inserted?.id ? String(inserted.id) : '';
        } catch (error) {
            console.error("Error adding position:", error);
            throw error;
        }
    },

    // 직책 수정 (기본)
    updatePosition: async (id: string, updates: Partial<Position>): Promise<void> => {
        try {
            const uuid = await resolvePositionUuid(id);
            if (!uuid) throw new Error(`Position not found: ${id}`);

            const normalizedUpdates: Partial<Position> = { ...updates };
            const hasIconKeyUpdate = Object.prototype.hasOwnProperty.call(normalizedUpdates, 'iconKey');
            if (hasIconKeyUpdate) {
                normalizedUpdates.iconKey = normalizeIconKey(normalizedUpdates.iconKey);
            }
            if (!normalizedUpdates.iconKey) {
                const derived = normalizeIconKey(normalizedUpdates.icon);
                if (derived) normalizedUpdates.iconKey = derived;
            }

            await updatePositionDc(dc, {
                id: uuid,
                ...(Object.prototype.hasOwnProperty.call(normalizedUpdates, 'name') ? { name: normalizedUpdates.name ?? null } : {}),
                ...(Object.prototype.hasOwnProperty.call(normalizedUpdates, 'rank') ? { rank: normalizedUpdates.rank ?? null } : {}),
                ...(Object.prototype.hasOwnProperty.call(normalizedUpdates, 'color') ? { color: normalizedUpdates.color ?? null } : {}),
                ...(Object.prototype.hasOwnProperty.call(normalizedUpdates, 'icon') ? { icon: normalizedUpdates.icon ?? null } : {}),
                ...(Object.prototype.hasOwnProperty.call(normalizedUpdates, 'iconKey') ? { iconKey: normalizedUpdates.iconKey ?? null } : {}),
                ...(Object.prototype.hasOwnProperty.call(normalizedUpdates, 'description') ? { description: normalizedUpdates.description ?? null } : {}),
                ...(Object.prototype.hasOwnProperty.call(normalizedUpdates, 'systemRole') ? { systemRole: normalizedUpdates.systemRole ?? null } : {}),
                ...(Object.prototype.hasOwnProperty.call(normalizedUpdates, 'isDefault') ? { isDefault: normalizedUpdates.isDefault ?? null } : {})
            } as any);

            dcPositionsLoaded = false;
        } catch (error) {
            console.error("Error updating position:", error);
            throw error;
        }
    },

    // [New] 직책명 변경 및 작업자 동기화 (Batch Update)
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

    // [New] 직책 색상 변경
    updatePositionColor: async (id: string, newColor: string): Promise<void> => {
        try {
            await positionService.updatePosition(id, { color: newColor });
        } catch (error) {
            console.error("Error updating position color:", error);
            throw error;
        }
    },

    // 직책 삭제
    deletePosition: async (id: string): Promise<void> => {
        try {
            const uuid = await resolvePositionUuid(id);
            if (!uuid) throw new Error(`Position not found: ${id}`);
            await deletePositionDc(dc, { id: uuid } as any);
            dcPositionsLoaded = false;
        } catch (error) {
            console.error("Error deleting position:", error);
            throw error;
        }
    },

    // 기본 직책 초기화
    initializeDefaults: async (): Promise<void> => {
        try {
            const response = await listPositionsDc(dc);
            const rows = (response as any)?.data?.positions ?? [];
            const existingNames = new Set(
                Array.isArray(rows)
                    ? rows.map((r: any) => (r?.name ? String(r.name) : '')).filter(Boolean)
                    : []
            );

            const toCreate = DEFAULT_POSITIONS.filter((pos) => !existingNames.has(pos.name));
            const batchPromises = toCreate.map((pos) =>
                createPositionDc(dc, {
                    name: pos.name,
                    legacyId: null,
                    rank: pos.rank,
                    color: pos.color,
                    icon: pos.icon ?? null,
                    iconKey: pos.iconKey ?? null,
                    description: pos.description ?? null,
                    systemRole: pos.systemRole ?? UserRole.GENERAL,
                    isDefault: pos.isDefault ?? false
                } as any)
            );

            await Promise.all(batchPromises);
            dcPositionsLoaded = false;
            console.log("Default positions initialized");
        } catch (error) {
            console.error("Error initializing default positions:", error);
        }
    },

    // 중복 직책 제거 (이름 기준으로 가장 오래된 것만 유지)
    removeDuplicates: async (): Promise<{ removed: number; kept: string[] }> => {
        try {
            const positions = await positionService.getPositions();

            // 이름별로 그룹화
            const grouped: Record<string, Position[]> = {};
            positions.forEach(pos => {
                const key = pos.name;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(pos);
            });

            let removedCount = 0;
            const keptNames: string[] = [];

            // 각 그룹에서 첫 번째(가장 오래된 것)만 유지하고 나머지 삭제
            for (const [name, positionsGroup] of Object.entries(grouped)) {
                keptNames.push(name);
                if (positionsGroup.length > 1) {
                    // 첫 번째 제외하고 삭제
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

    // Specific deletion for 'Skilled Worker' request
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

    // Force Reset to Defaults (Clear all and re-initialize)
    resetToDefaults: async (): Promise<void> => {
        try {
            const positions = await positionService.getPositions();
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
