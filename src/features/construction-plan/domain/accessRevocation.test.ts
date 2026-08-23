import { isConstructionPlanEditingAccessRevoked } from './accessRevocation';

describe('isConstructionPlanEditingAccessRevoked', () => {
  it.each([
    [{ code: 'permission-denied' }],
    [{ code: 'functions/unauthenticated' }],
    [new Error('construction-plan-conflict:edit-lock-held-by-other')],
    [new Error('construction-plan-conflict:content-locked-in-approved')],
  ])('treats an authorization or competing-lock error as terminal', (error) => {
    expect(isConstructionPlanEditingAccessRevoked(error)).toBe(true);
  });

  it.each([
    [{ code: 'unavailable' }],
    [{ code: 'deadline-exceeded' }],
    [new TypeError('network request failed')],
    [new Error('construction-plan-conflict:stale-lock-version')],
  ])('keeps editing ownership on a transient or retryable failure', (error) => {
    expect(isConstructionPlanEditingAccessRevoked(error)).toBe(false);
  });
});
