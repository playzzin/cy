import { db } from '../config/firebase';
import { createSystemConfig, listSystemConfigs, listAllSystemConfigs, updateSystemConfig } from './firestoreCrudCompat';
import { UserRole, PermissionConfig, DEFAULT_PERMISSIONS } from '../types/roles';
import { Position, positionService } from './positionService';
import { menuServiceV11 } from './menuServiceV11';

const PERMISSION_DOC_ID = 'permissions';

class RolePermissionService {
    private permissions: PermissionConfig = {};
    private listeners: ((permissions: PermissionConfig) => void)[] = [];
    private menuUnsubscribe: (() => void) | null = null;

    constructor() {
        void this.initialize();
    }

    private async initialize() {
        await this.refreshPermissions();

        if (typeof window !== 'undefined' && this.menuUnsubscribe == null) {
            // Follow the active menu document instead of the legacy hardcoded menus_v11 doc.
            this.menuUnsubscribe = menuServiceV11.subscribe(() => {
                console.log("[rolePermissionService] Menu settings updated, refreshing permissions...");
                void this.refreshPermissions();
            });
        }
    }

    private async refreshPermissions(): Promise<void> {
        try {
            const mergeWithPositionKeys = (loaded: PermissionConfig, positions: Position[]): PermissionConfig => {
                const merged: PermissionConfig = {};

                const loadedByRole = (role: UserRole): Record<string, boolean> => {
                    const legacy =
                        role === UserRole.ADMIN
                            ? (loaded as any)?.ADMIN
                            : role === UserRole.MANAGER
                                ? (loaded as any)?.MANAGER
                                : (loaded as any)?.GENERAL;
                    const legacyEng =
                        role === UserRole.ADMIN
                            ? (loaded as any)?.admin
                            : role === UserRole.MANAGER
                                ? (loaded as any)?.manager
                                : (loaded as any)?.user;
                    return {
                        ...(legacyEng && typeof legacyEng === 'object' ? legacyEng : {}),
                        ...(legacy && typeof legacy === 'object' ? legacy : {}),
                        ...(loaded?.[role] || {})
                    };
                };

                const baseBySystemRole: Record<UserRole, Record<string, boolean>> = {
                    [UserRole.ADMIN]: {
                        ...(DEFAULT_PERMISSIONS[UserRole.ADMIN] || {}),
                        ...loadedByRole(UserRole.ADMIN)
                    },
                    [UserRole.MANAGER]: {
                        ...(DEFAULT_PERMISSIONS[UserRole.MANAGER] || {}),
                        ...loadedByRole(UserRole.MANAGER)
                    },
                    [UserRole.GENERAL]: {
                        ...(DEFAULT_PERMISSIONS[UserRole.GENERAL] || {}),
                        ...loadedByRole(UserRole.GENERAL)
                    }
                };

                const normalizeKey = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

                const positionNames = positions
                    .map((p) => normalizeKey(p?.name))
                    .filter((v): v is string => Boolean(v));

                // Seed per-position permissions
                positionNames.forEach((positionName) => {
                    const pos = positions.find((p) => normalizeKey(p?.name) === positionName);
                    const systemRole = (pos?.systemRole as UserRole) || UserRole.GENERAL;
                    const direct = loaded?.[positionName];
                    merged[positionName] = {
                        ...(baseBySystemRole[systemRole] || baseBySystemRole[UserRole.GENERAL]),
                        ...(direct || {})
                    };
                });

                // Always ensure a safe fallback key
                if (!merged['?쇰컲']) {
                    merged['?쇰컲'] = {
                        ...(baseBySystemRole[UserRole.GENERAL] || {})
                    };
                }

                // Preserve unknown/custom keys (including legacy values) as-is
                if (loaded && typeof loaded === 'object') {
                    Object.keys(loaded).forEach((key) => {
                        const normalizedKey = normalizeKey(key);
                        if (!normalizedKey) return;
                        if (!merged[normalizedKey]) {
                            merged[normalizedKey] = loaded[normalizedKey] || {};
                        }
                    });
                }

                return merged;
            };

            const findRowInList = (rows: any[]): any | null => {
                if (!Array.isArray(rows)) return null;
                return rows.find((r: any) => String(r?.id ?? '') === String(PERMISSION_DOC_ID)) ?? null;
            };

            let row: any | null = null;
            try {
                const response = await listSystemConfigs();
                const rows = (response as any)?.data?.systemConfigs ?? [];
                row = findRowInList(rows);
            } catch {
                row = null;
            }

            if (!row) {
                const limit = 1000;
                let offset = 0;
                let safety = 0;
                while (safety < 50) {
                    safety += 1;
                    const response = await listAllSystemConfigs({ limit, offset } as any);
                    const rows = (response as any)?.data?.systemConfigs ?? [];
                    const page = Array.isArray(rows) ? rows : [];
                    if (page.length === 0) break;

                    row = findRowInList(page);
                    if (row) break;

                    if (page.length < limit) break;
                    offset += limit;
                }
            }

            const positions = await positionService.getPositions();

            if (row?.data) {
                const parsed = JSON.parse(String(row.data));
                this.permissions = mergeWithPositionKeys(parsed as PermissionConfig, positions);
                this.notifyListeners();
                return;
            }

            // Initialize with position keys derived from defaults
            const initial = mergeWithPositionKeys(DEFAULT_PERMISSIONS, positions);
            await this.savePermissions(initial);
            this.permissions = initial;
            this.notifyListeners();
        } catch (error) {
            console.error('Failed to refresh permissions:', error);
        }
    }

    public async updatePermission(positionName: string, menuId: string, allowed: boolean): Promise<void> {
        const newPermissions = { ...this.permissions };
        const key = typeof positionName === 'string' ? positionName.trim() : '';
        if (!key) return;
        if (!newPermissions[key]) {
            newPermissions[key] = {};
        }
        newPermissions[key][menuId] = allowed;

        await this.savePermissions(newPermissions);
    }

    private async savePermissions(permissions: PermissionConfig): Promise<void> {
        const payload = JSON.stringify(permissions);

        try {
            const updated = await updateSystemConfig({ id: PERMISSION_DOC_ID, data: payload } as any);
            const didUpdate = (updated as any)?.data?.systemConfig_update != null;
            if (!didUpdate) {
                try {
                    await createSystemConfig({ id: PERMISSION_DOC_ID, data: payload } as any);
                } catch {
                    await updateSystemConfig({ id: PERMISSION_DOC_ID, data: payload } as any);
                }
            }
        } catch (error) {
            try {
                await createSystemConfig({ id: PERMISSION_DOC_ID, data: payload } as any);
            } catch {
                await updateSystemConfig({ id: PERMISSION_DOC_ID, data: payload } as any);
            }
        }

        this.permissions = permissions;
    }

    public hasAccess(userJobTitle: string | undefined, menuId: string): boolean {
        const positionName = typeof userJobTitle === 'string' ? userJobTitle.trim() : '';
        const key = positionName || '?쇰컲';

        const roleConfig = this.permissions[key] || this.permissions['?쇰컲'];
        if (roleConfig) return !!roleConfig[menuId];

        const fallback = DEFAULT_PERMISSIONS[UserRole.GENERAL];
        return fallback ? !!fallback[menuId] : false;
    }

    public async getPermissions(): Promise<PermissionConfig> {
        return this.permissions;
    }

    public subscribe(listener: (permissions: PermissionConfig) => void): () => void {
        this.listeners.push(listener);
        listener(this.permissions); // Initial call

        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener(this.permissions));
    }
}

export const rolePermissionService = new RolePermissionService();

