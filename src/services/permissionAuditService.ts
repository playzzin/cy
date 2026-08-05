import { auth } from '../config/firebase';
import { MenuItem, SiteDataType } from '../types/menu';
import { auditService } from './auditService';

export type PermissionAuditAction =
    | 'USER_ACCESS_UPDATED'
    | 'MENU_ACCESS_UPDATED';

export interface PermissionAuditInput {
    action: PermissionAuditAction;
    targetId: string;
    targetName: string;
    details: Record<string, unknown>;
}

export interface MenuPermissionChange {
    siteKey: string;
    siteName: string;
    menuId: string;
    menuText: string;
    beforeRoles: string[];
    afterRoles: string[];
}

type MenuPermissionEntry = Omit<MenuPermissionChange, 'beforeRoles' | 'afterRoles' | 'siteKey'> & {
    roles: string[];
};

const normalizeRoles = (value: unknown): string[] => Array.from(new Set(
    (Array.isArray(value) ? value : [])
        .map((role) => typeof role === 'string' ? role.trim() : '')
        .filter(Boolean)
)).sort();

const rolesEqual = (left: string[], right: string[]): boolean => (
    left.length === right.length && left.every((role, index) => role === right[index])
);

const collectRoleEntries = (config: SiteDataType | null | undefined): Map<string, MenuPermissionEntry> => {
    const entries = new Map<string, MenuPermissionEntry>();
    if (!config) return entries;

    const visit = (siteKey: string, siteName: string, items: Array<MenuItem | string> | undefined, parentKey = '') => {
        (items || []).forEach((item, index) => {
            if (typeof item === 'string') return;
            const identity = item.id || item.path || `${parentKey}/${index}:${item.text}`;
            const key = `${siteKey}:${identity}`;
            entries.set(key, {
                siteName,
                menuId: identity,
                menuText: item.text || identity,
                roles: normalizeRoles(item.roles),
            });
            visit(siteKey, siteName, item.sub, identity);
        });
    };

    Object.entries(config).forEach(([siteKey, site]) => {
        visit(siteKey, String(site?.name || siteKey), site?.menu);
    });
    return entries;
};

export const collectMenuPermissionChanges = (
    beforeConfig: SiteDataType | null | undefined,
    afterConfig: SiteDataType | null | undefined
): MenuPermissionChange[] => {
    const before = collectRoleEntries(beforeConfig);
    const after = collectRoleEntries(afterConfig);
    const keys = new Set([...before.keys(), ...after.keys()]);
    const changes: MenuPermissionChange[] = [];

    keys.forEach((key) => {
        const beforeItem = before.get(key);
        const afterItem = after.get(key);
        const beforeRoles = beforeItem?.roles || [];
        const afterRoles = afterItem?.roles || [];
        if (rolesEqual(beforeRoles, afterRoles)) return;

        const item = afterItem || beforeItem;
        if (!item) return;
        changes.push({
            siteKey: key.split(':', 1)[0],
            siteName: item.siteName,
            menuId: item.menuId,
            menuText: item.menuText,
            beforeRoles,
            afterRoles,
        });
    });

    return changes.sort((left, right) => (
        `${left.siteName}:${left.menuText}`.localeCompare(`${right.siteName}:${right.menuText}`, 'ko')
    ));
};

const resolveActor = () => {
    const user = auth.currentUser;
    return {
        actorId: user?.uid || 'system',
        actorEmail: user?.email || 'system',
        actorName: user?.displayName || undefined,
    };
};

/**
 * Keeps security-sensitive access changes in a single, queryable audit category.
 * Audit logging is deliberately non-blocking: an access update must not fail just
 * because its history record cannot be written.
 */
export const permissionAuditService = {
    async log(input: PermissionAuditInput): Promise<void> {
        await auditService.log({
            action: input.action,
            category: 'PERMISSION',
            ...resolveActor(),
            targetId: input.targetId,
            targetName: input.targetName,
            details: input.details,
        });
    },

    async logMenuAccessChanges(beforeConfig: SiteDataType | null | undefined, afterConfig: SiteDataType): Promise<void> {
        const changes = collectMenuPermissionChanges(beforeConfig, afterConfig);
        if (changes.length === 0) return;

        const savedChanges = changes.slice(0, 100);
        await this.log({
            action: 'MENU_ACCESS_UPDATED',
            targetId: 'menu-config',
            targetName: 'Menu access configuration',
            details: {
                scope: 'menu_access',
                changeCount: changes.length,
                truncated: changes.length > savedChanges.length,
                changes: savedChanges,
            },
        });
    },
};
