import {
  filterBankCandidates,
  formatBankCurrency,
  isWithinQuietHours,
  BANK_HEALTH_STALE_AFTER_MS,
  maskAccountIdentifier,
  maskSensitiveMessage,
  maskSourceIdentifier,
  normalizeBankNotificationSettings,
  resolveBankNotificationHealthState,
  summarizeBankCandidates,
} from './bankNotificationUtils';
import {
  DEFAULT_BANK_CANDIDATE_FILTERS,
  type BankTransactionCandidate,
} from './types';

const createCandidate = (
  overrides: Partial<BankTransactionCandidate> = {},
): BankTransactionCandidate => ({
  id: 'candidate-1',
  status: 'pending',
  direction: 'deposit',
  amount: 1200000,
  balance: 5000000,
  bankName: 'KB국민은행',
  accountMasked: '••••1234',
  sourceMasked: '1588-9999',
  counterpartyMasked: '김•수',
  memo: '공사대금',
  messagePreview: '',
  transactionAt: new Date(2026, 6, 14, 9, 30),
  receivedAt: null,
  createdAt: new Date(2026, 6, 14, 9, 31),
  updatedAt: null,
  parseError: '',
  parserVersion: '1',
  confidence: 0.98,
  reviewedById: '',
  reviewedByName: '',
  reviewedAt: null,
  ...overrides,
});

describe('bankNotificationUtils', () => {
  it('masks account, phone, email, and long digit sequences', () => {
    expect(maskAccountIdentifier('123-456-789012')).toBe('•••-•••-••9012');
    expect(maskAccountIdentifier('••••1234')).toBe('••••1234');
    expect(maskSourceIdentifier('010-1234-5678')).toBe('•••-••••-5678');
    expect(maskSourceIdentifier('accounting@example.com')).toBe('a•••••••••@example.com');
    expect(maskSensitiveMessage('계좌 123456789012에서 처리')).toContain('••••••••9012');
  });

  it('formats KRW amounts without decimals', () => {
    expect(formatBankCurrency(1234567)).toMatch(/1,234,567/);
    expect(formatBankCurrency(Number.NaN)).toMatch(/0/);
  });

  it('filters by status, direction, amount, date and masked searchable text', () => {
    const rows = [
      createCandidate(),
      createCandidate({
        id: 'candidate-2',
        status: 'confirmed',
        direction: 'withdrawal',
        amount: 90000,
        memo: '보험료',
        transactionAt: new Date(2026, 6, 13, 15, 0),
      }),
    ];

    expect(filterBankCandidates(rows, {
      ...DEFAULT_BANK_CANDIDATE_FILTERS,
      status: 'pending',
      direction: 'deposit',
      minimumAmount: 1000000,
      startDate: '2026-07-14',
      endDate: '2026-07-14',
      query: '공사대금',
    }).map((row) => row.id)).toEqual(['candidate-1']);

    expect(filterBankCandidates(rows, {
      ...DEFAULT_BANK_CANDIDATE_FILTERS,
      query: '없는 검색어',
    })).toEqual([]);
  });

  it('summarizes actionable transactions for the current local day', () => {
    const rows = [
      createCandidate({ id: 'deposit', amount: 1000000 }),
      createCandidate({ id: 'withdrawal', direction: 'withdrawal', amount: 250000 }),
      createCandidate({ id: 'ignored', status: 'ignored', amount: 999999 }),
      createCandidate({ id: 'failed', status: 'parse_failed', amount: 400000 }),
      createCandidate({ id: 'yesterday', amount: 200000, transactionAt: new Date(2026, 6, 13, 23, 59) }),
    ];

    expect(summarizeBankCandidates(rows, new Date(2026, 6, 14, 12, 0))).toEqual({
      pendingCount: 3,
      parseFailedCount: 1,
      todayDepositTotal: 1000000,
      todayWithdrawalTotal: 250000,
    });
  });

  it('normalizes settings and handles overnight quiet hours', () => {
    const settings = normalizeBankNotificationSettings({
      enabled: true,
      recipientIds: ['user-1', 'user-1', ''],
      minAmount: '50,000',
      directions: ['입금'],
      quietHours: { enabled: true, start: '22:00', end: '07:00' },
    });

    expect(settings.recipientIds).toEqual(['user-1']);
    expect(settings.minimumAmount).toBe(50000);
    expect(settings.directions).toEqual(['deposit']);
    expect(isWithinQuietHours('23:30', '22:00', '07:00')).toBe(true);
    expect(isWithinQuietHours('06:59', '22:00', '07:00')).toBe(true);
    expect(isWithinQuietHours('12:00', '22:00', '07:00')).toBe(false);
  });

  it('uses a two-hour heartbeat tolerance for bridge health', () => {
    const now = new Date('2026-07-14T12:00:00.000Z').getTime();
    expect(BANK_HEALTH_STALE_AFTER_MS).toBe(120 * 60 * 1000);
    expect(resolveBankNotificationHealthState({
      documentExists: true,
      lastSuccessfulIngestionAt: now - BANK_HEALTH_STALE_AFTER_MS + 1000,
      lastConnectionTestAt: null,
      lastParserStatus: 'success',
      now,
    })).toBe('healthy');
    expect(resolveBankNotificationHealthState({
      documentExists: true,
      lastSuccessfulIngestionAt: now - BANK_HEALTH_STALE_AFTER_MS - 1,
      lastConnectionTestAt: null,
      lastParserStatus: 'success',
      now,
    })).toBe('stale');
    expect(resolveBankNotificationHealthState({
      documentExists: true,
      lastSuccessfulIngestionAt: now,
      lastConnectionTestAt: null,
      lastParserStatus: 'failed',
      now,
    })).toBe('healthy');
    expect(resolveBankNotificationHealthState({
      documentExists: false,
      lastSuccessfulIngestionAt: null,
      lastConnectionTestAt: null,
      lastParserStatus: '',
      now,
    })).toBe('unconfigured');
  });
});
