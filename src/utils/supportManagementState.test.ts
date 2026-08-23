import {
  getSupportManagementMonthDate,
  getSupportManagementYearMonth,
  parseSupportManagementView,
  rememberSupportManagementYearMonth,
  subscribeSupportManagementYearMonth,
} from './supportManagementState';

describe('supportManagementState', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('keeps the selected month while moving between support ledgers', () => {
    rememberSupportManagementYearMonth('2026-07');

    expect(getSupportManagementYearMonth()).toBe('2026-07');
    expect(getSupportManagementMonthDate()).toEqual(new Date(2026, 6, 1));
  });

  it('ignores invalid stored months', () => {
    window.sessionStorage.setItem('cy.support-management.year-month', '2026-19');
    expect(getSupportManagementYearMonth()).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });

  it('normalizes the shared management view', () => {
    expect(parseSupportManagementView('ledger')).toBe('ledger');
    expect(parseSupportManagementView('history')).toBe('history');
    expect(parseSupportManagementView('unknown')).toBe('status');
  });

  it('notifies mounted ledgers when the common month changes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSupportManagementYearMonth(listener);

    rememberSupportManagementYearMonth('2026-06');
    rememberSupportManagementYearMonth('2026-06');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('2026-06');
    unsubscribe();
  });
});
