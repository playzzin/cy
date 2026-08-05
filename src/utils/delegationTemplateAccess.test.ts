import { canEditDelegationTemplate } from './delegationTemplateAccess';

describe('canEditDelegationTemplate', () => {
    it.each([
        [{ role: '관리자' }],
        [{ role: 'admin' }],
        [{ position: '매니저1' }],
        [{ systemRole: 'manager' }],
        [{ additionalPositions: ['메니저2'] }],
    ])('allows an administrator or manager profile: %p', (profile) => {
        expect(canEditDelegationTemplate(profile)).toBe(true);
    });

    it.each([
        [null],
        [{ role: '작업자', accountType: 'worker' }],
        [{ role: '일반' }],
        [{ position: '팀장' }],
    ])('does not allow a worker or unrelated profile: %p', (profile) => {
        expect(canEditDelegationTemplate(profile)).toBe(false);
    });
});
