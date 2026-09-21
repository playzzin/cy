import { PositionItem } from '../types/menu';
import { findBusinessPartnerPositionDefinition } from '../constants/businessPartnerPositions';
import { matchesMenuPosition } from './menuPosition';

const normalizePositionKey = (value: unknown): string =>
    String(value || '').trim().toLowerCase().replace(/[\s_-]/g, '');

const findMatchingPosition = (positions: PositionItem[], value: unknown): PositionItem | undefined => {
    const key = normalizePositionKey(value);
    if (!key) return undefined;

    const partnerDefinition = findBusinessPartnerPositionDefinition(String(value || ''), String(value || ''));
    if (partnerDefinition) {
        const matchedPartnerPosition = positions.find(
            (position) => normalizePositionKey(position.id) === normalizePositionKey(partnerDefinition.id)
        );
        if (matchedPartnerPosition) return matchedPartnerPosition;
    }

    return positions.find((position) => {
        return matchesMenuPosition(position.id, position.name, value);
    });
};

const findFirstPositionById = (positions: PositionItem[], ids: string[]): PositionItem | undefined => {
    const wanted = ids.map(normalizePositionKey);
    return positions.find((position) => wanted.includes(normalizePositionKey(position.id)));
};

export const resolveUserMenuPositionId = (
    positions: PositionItem[],
    userProfile: { position?: unknown; role?: unknown; accountType?: unknown; systemRole?: unknown } | null | undefined,
    linkedEntityRoles?: unknown | unknown[]
): string | undefined => {
    const linkedRoles = Array.isArray(linkedEntityRoles) ? linkedEntityRoles : [linkedEntityRoles];
    const candidates = [...linkedRoles, userProfile?.position, userProfile?.role, userProfile?.systemRole, userProfile?.accountType];

    for (const candidate of candidates) {
        const matched = findMatchingPosition(positions, candidate);
        if (matched?.id) return matched.id;
    }

    const roleKey = normalizePositionKey(userProfile?.role);
    if (['admin', 'administrator', 'superadmin', 'owner', '\uad00\ub9ac\uc790', '\uc0ac\uc7a5', '\uc2e4\uc7a5'].includes(roleKey)) {
        return findFirstPositionById(positions, ['full'])?.id || 'full';
    }
    if (roleKey.startsWith('manager') || roleKey.startsWith('\ub9e4\ub2c8\uc800') || roleKey.startsWith('\uba54\ub2c8\uc800')) {
        return findFirstPositionById(positions, ['manager1', 'manager', 'teamLead'])?.id;
    }
    if (['user', 'general', '\uc77c\ubc18'].includes(roleKey)) {
        return findFirstPositionById(positions, ['general'])?.id;
    }

    return undefined;
};
