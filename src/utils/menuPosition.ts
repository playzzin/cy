const normalizeMenuPositionKey = (value: unknown): string =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^pos[\s_-]*/i, '')
        .replace(/[\s_-]/g, '');

const POSITION_ALIASES: Record<string, string[]> = {
    ceo: ['ceo', '대표', '대표이사', '사장', 'chiefexecutiveofficer'],
};

/**
 * Returns whether a profile value identifies the configured menu position.
 *
 * Position IDs are implementation details (for example `ceo`), while older
 * user profiles commonly store the Korean job title (`사장`).  Keeping that
 * translation here prevents those users from silently falling back to the
 * full/admin menu.
 */
export const matchesMenuPosition = (
    positionId: unknown,
    positionName: unknown,
    profileValue: unknown
): boolean => {
    const profileKey = normalizeMenuPositionKey(profileValue);
    if (!profileKey) return false;

    const idKey = normalizeMenuPositionKey(positionId);
    const directKeys = [idKey, normalizeMenuPositionKey(positionName)].filter(Boolean);
    if (directKeys.includes(profileKey)) return true;

    return (POSITION_ALIASES[idKey] || []).includes(profileKey);
};
