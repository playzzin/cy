const normalizeMenuPositionKey = (value: unknown): string =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^pos[\s_-]*/i, '')
        .replace(/[\s_-]/g, '');

const POSITION_ALIASES: Record<string, string[]> = {
    ceo: ['ceo', '대표', '대표이사', '사장', 'chiefexecutiveofficer'],
    manager: ['manager', 'manager1', 'manager2', 'manager3', '매니저', '매니저1', '매니저2', '매니저3', '메니저', '메니저1', '메니저2', '메니저3'],
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

    const aliasKey = normalizeMenuPositionKey(positionName) === '매니저' ? 'manager' : idKey;
    return (POSITION_ALIASES[aliasKey] || []).includes(profileKey);
};
