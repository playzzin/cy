export type SupportManagementView = 'status' | 'ledger' | 'history';

const YEAR_MONTH_STORAGE_KEY = 'cy.support-management.year-month';
const YEAR_MONTH_CHANGE_EVENT = 'cy:support-management-year-month-change';

const isYearMonth = (value: unknown): value is string => (
  typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
);

export const getDefaultSupportManagementYearMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const getSupportManagementYearMonth = (): string => {
  if (typeof window === 'undefined') return getDefaultSupportManagementYearMonth();
  try {
    const saved = window.sessionStorage.getItem(YEAR_MONTH_STORAGE_KEY);
    return isYearMonth(saved) ? saved : getDefaultSupportManagementYearMonth();
  } catch {
    return getDefaultSupportManagementYearMonth();
  }
};

export const getSupportManagementMonthDate = (): Date => {
  const [year, month] = getSupportManagementYearMonth().split('-').map(Number);
  return new Date(year, month - 1, 1);
};

export const rememberSupportManagementYearMonth = (yearMonth: string): void => {
  if (typeof window === 'undefined' || !isYearMonth(yearMonth)) return;
  let changed = true;
  try {
    changed = window.sessionStorage.getItem(YEAR_MONTH_STORAGE_KEY) !== yearMonth;
    window.sessionStorage.setItem(YEAR_MONTH_STORAGE_KEY, yearMonth);
  } catch {
    // 저장 공간을 사용할 수 없어도 월 이동 자체는 유지한다.
  }
  if (changed) {
    window.dispatchEvent(new CustomEvent(YEAR_MONTH_CHANGE_EVENT, { detail: yearMonth }));
  }
};

export const subscribeSupportManagementYearMonth = (
  listener: (yearMonth: string) => void
): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;
  const handleChange = (event: Event) => {
    const yearMonth = (event as CustomEvent<unknown>).detail;
    if (isYearMonth(yearMonth)) listener(yearMonth);
  };
  window.addEventListener(YEAR_MONTH_CHANGE_EVENT, handleChange);
  return () => window.removeEventListener(YEAR_MONTH_CHANGE_EVENT, handleChange);
};

export const parseSupportManagementView = (value: unknown): SupportManagementView => {
  if (value === 'ledger' || value === 'history') return value;
  return 'status';
};
