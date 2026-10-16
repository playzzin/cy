import { isMessageReadOnlyProfile } from './messageAccess';

it('restricts every supported team position field and persisted position identifier', () => {
    for (const role of ['팀장', '반장', 'team_leader', 'TEAM_LEAD', 'foreman', 'MhoUDnsuTNUnOpeNvfoL', 'pos_MhoUDnsuTNUnOpeNvfoL']) {
        for (const field of ['role', 'position', 'systemRole', 'accountType']) expect(isMessageReadOnlyProfile({ [field]: role })).toBe(true);
        for (const field of ['roles', 'additionalPositions']) expect(isMessageReadOnlyProfile({ [field]: [role] })).toBe(true);
    }
});
it('preserves explicit administrator access while defaulting missing profiles to read only', () => {
    expect(isMessageReadOnlyProfile({ role: 'admin', position: '팀장' })).toBe(false);
    expect(isMessageReadOnlyProfile({ role: 'user' })).toBe(false);
    expect(isMessageReadOnlyProfile(null)).toBe(true);
});
