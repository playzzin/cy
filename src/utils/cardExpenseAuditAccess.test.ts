import { canAccessCardExpenseAudit } from './cardExpenseAuditAccess';

describe('cardExpenseAuditAccess', () => {
  it('allows CEO and DEV roles including additional positions', () => {
    expect(canAccessCardExpenseAudit({ role: 'user', position: '대표' })).toBe(true);
    expect(canAccessCardExpenseAudit({ role: 'user', position: '일반', additionalPositions: ['DEV'] })).toBe(true);
  });

  it('does not inherit generic administrator or finance access', () => {
    expect(canAccessCardExpenseAudit({ role: 'admin', position: '관리자' })).toBe(false);
    expect(canAccessCardExpenseAudit({ role: 'finance', position: '회계' })).toBe(false);
  });
});
