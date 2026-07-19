import type {
  BankCandidateFilters,
  BankDateValue,
  BankNotificationSettings,
  BankNotificationHealthState,
  BankNotificationSummary,
  BankTransactionCandidate,
  BankTransactionDirection,
  BankTransactionStatus,
} from './types';
import {
  BANK_TRANSACTION_DIRECTIONS,
  BANK_TRANSACTION_STATUSES,
  DEFAULT_BANK_NOTIFICATION_SETTINGS,
} from './types';

const KOREAN_CURRENCY_FORMATTER = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

const KOREAN_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Seoul',
});

const safeText = (value: unknown): string => String(value ?? '').trim();

export const BANK_HEALTH_STALE_AFTER_MS = 120 * 60 * 1000;

export const toFiniteNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toBankDate = (value: BankDateValue | unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === 'object' && value !== null) {
    const timestampLike = value as { seconds?: unknown; toDate?: unknown };
    if (typeof timestampLike.toDate === 'function') {
      try {
        const date = (timestampLike.toDate as () => Date)();
        return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
      } catch {
        return null;
      }
    }
    if (typeof timestampLike.seconds === 'number') {
      const date = new Date(timestampLike.seconds * 1000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatBankCurrency = (amount: number | null | undefined): string => (
  KOREAN_CURRENCY_FORMATTER.format(Number.isFinite(amount) ? Number(amount) : 0)
);

export const formatBankDateTime = (value: BankDateValue): string => {
  const date = toBankDate(value);
  return date ? KOREAN_DATE_TIME_FORMATTER.format(date).replace('24:', '00:') : '-';
};

/**
 * Account numbers are masked at render time even when the server already sent a masked value.
 * Separators and the last four digits are retained so an accountant can distinguish accounts.
 */
export const maskAccountIdentifier = (value: unknown): string => {
  const text = safeText(value);
  if (!text) return '-';

  const totalDigits = (text.match(/\d/g) || []).length;
  if (totalDigits <= 4) {
    if (/[•*xX]/.test(text)) return text.replace(/[xX*]/g, '•');
    return totalDigits === 4 ? `••••${text}` : text.replace(/\d/g, '•');
  }

  let digitIndex = 0;
  const visibleAfter = totalDigits - 4;
  return text.replace(/\d/g, (digit) => {
    digitIndex += 1;
    return digitIndex <= visibleAfter ? '•' : digit;
  });
};

export const maskSourceIdentifier = (value: unknown): string => {
  const text = safeText(value);
  if (!text) return '-';

  if (text.includes('@')) {
    const [local, domain] = text.split('@');
    const visible = local.slice(0, 1);
    return `${visible}${'•'.repeat(Math.max(2, local.length - 1))}@${domain}`;
  }

  const digitCount = (text.match(/\d/g) || []).length;
  if (digitCount >= 7) return maskAccountIdentifier(text);
  return text;
};

export const maskSensitiveMessage = (value: unknown): string => {
  const text = safeText(value);
  if (!text) return '';

  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (email) => maskSourceIdentifier(email))
    .replace(/(?:\d[\s-]?){7,}/g, (sequence) => maskAccountIdentifier(sequence));
};

export const normalizeCandidateStatus = (value: unknown): BankTransactionStatus => {
  const normalized = safeText(value).toLowerCase().replace(/[-\s]/g, '_');
  if ((BANK_TRANSACTION_STATUSES as readonly string[]).includes(normalized)) {
    return normalized as BankTransactionStatus;
  }
  if (['approved', 'matched', 'complete', 'completed'].includes(normalized)) return 'confirmed';
  if (['dismissed', 'rejected', 'duplicate'].includes(normalized)) return 'ignored';
  if (['failed', 'error', 'invalid'].includes(normalized)) return 'parse_failed';
  return 'pending';
};

export const normalizeCandidateDirection = (value: unknown): BankTransactionDirection => {
  const normalized = safeText(value).toLowerCase().replace(/[-\s]/g, '_');
  if ((BANK_TRANSACTION_DIRECTIONS as readonly string[]).includes(normalized)) {
    return normalized as BankTransactionDirection;
  }
  if (['in', 'credit', 'income', '입금', 'deposit_received'].includes(normalized)) return 'deposit';
  if (['out', 'debit', 'expense', '출금', 'withdraw'].includes(normalized)) return 'withdrawal';
  return 'unknown';
};

export const getCandidateEffectiveDate = (candidate: BankTransactionCandidate): Date | null => (
  toBankDate(candidate.transactionAt)
  || toBankDate(candidate.receivedAt)
  || toBankDate(candidate.createdAt)
);

const getLocalDayBounds = (date: Date): { start: number; end: number } => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
};

const parseLocalDateBoundary = (value: string, endOfDay: boolean): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setDate(date.getDate() + 1);
  return date.getTime();
};

export const filterBankCandidates = (
  candidates: BankTransactionCandidate[],
  filters: BankCandidateFilters,
): BankTransactionCandidate[] => {
  const query = filters.query.trim().toLocaleLowerCase('ko-KR');
  const startAt = parseLocalDateBoundary(filters.startDate, false);
  const endAt = parseLocalDateBoundary(filters.endDate, true);

  return candidates.filter((candidate) => {
    if (filters.status !== 'all' && candidate.status !== filters.status) return false;
    if (filters.direction !== 'all' && candidate.direction !== filters.direction) return false;
    if (filters.minimumAmount !== null && candidate.amount < filters.minimumAmount) return false;

    const candidateDate = getCandidateEffectiveDate(candidate)?.getTime() ?? null;
    if (startAt !== null && (candidateDate === null || candidateDate < startAt)) return false;
    if (endAt !== null && (candidateDate === null || candidateDate >= endAt)) return false;

    if (query) {
      const searchable = [
        candidate.bankName,
        candidate.accountMasked,
        candidate.sourceMasked,
        candidate.counterpartyMasked,
        candidate.memo,
        candidate.amount,
      ].join(' ').toLocaleLowerCase('ko-KR');
      if (!searchable.includes(query)) return false;
    }

    return true;
  });
};

export const summarizeBankCandidates = (
  candidates: BankTransactionCandidate[],
  now = new Date(),
): BankNotificationSummary => {
  const { start, end } = getLocalDayBounds(now);
  const summary: BankNotificationSummary = {
    pendingCount: 0,
    parseFailedCount: 0,
    todayDepositTotal: 0,
    todayWithdrawalTotal: 0,
  };

  candidates.forEach((candidate) => {
    if (candidate.status === 'pending') summary.pendingCount += 1;
    if (candidate.status === 'parse_failed') summary.parseFailedCount += 1;

    const transactionAt = getCandidateEffectiveDate(candidate)?.getTime();
    if (transactionAt === undefined || transactionAt < start || transactionAt >= end) return;
    if (candidate.status === 'ignored' || candidate.status === 'parse_failed') return;

    if (candidate.direction === 'deposit') summary.todayDepositTotal += candidate.amount;
    if (candidate.direction === 'withdrawal') summary.todayWithdrawalTotal += candidate.amount;
  });

  return summary;
};

const isValidClockTime = (value: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export const normalizeBankNotificationSettings = (value: unknown): BankNotificationSettings => {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawQuietHours = input.quietHours && typeof input.quietHours === 'object'
    ? input.quietHours as Record<string, unknown>
    : {};
  const rawDirections = Array.isArray(input.directions) ? input.directions : [];
  const directions = rawDirections
    .map(normalizeCandidateDirection)
    .filter((direction): direction is 'deposit' | 'withdrawal' => direction !== 'unknown');

  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_BANK_NOTIFICATION_SETTINGS.enabled,
    recipientIds: Array.isArray(input.recipientIds)
      ? Array.from(new Set(input.recipientIds.map(safeText).filter(Boolean)))
      : [],
    minimumAmount: Math.max(0, toFiniteNumber(input.minimumAmount ?? input.minAmount, 0)),
    directions: directions.length > 0
      ? Array.from(new Set(directions))
      : [...DEFAULT_BANK_NOTIFICATION_SETTINGS.directions],
    notifyOnParseFailure: typeof input.notifyOnParseFailure === 'boolean'
      ? input.notifyOnParseFailure
      : DEFAULT_BANK_NOTIFICATION_SETTINGS.notifyOnParseFailure,
    quietHours: {
      enabled: Boolean(rawQuietHours.enabled),
      start: isValidClockTime(safeText(rawQuietHours.start))
        ? safeText(rawQuietHours.start)
        : DEFAULT_BANK_NOTIFICATION_SETTINGS.quietHours.start,
      end: isValidClockTime(safeText(rawQuietHours.end))
        ? safeText(rawQuietHours.end)
        : DEFAULT_BANK_NOTIFICATION_SETTINGS.quietHours.end,
      timezone: 'Asia/Seoul',
    },
    updatedAt: input.updatedAt as BankDateValue,
    updatedById: safeText(input.updatedById),
    updatedByName: safeText(input.updatedByName),
  };
};

export const isWithinQuietHours = (clockTime: string, start: string, end: string): boolean => {
  if (!isValidClockTime(clockTime) || !isValidClockTime(start) || !isValidClockTime(end)) return false;
  if (start === end) return true;
  if (start < end) return clockTime >= start && clockTime < end;
  return clockTime >= start || clockTime < end;
};

export const resolveBankNotificationHealthState = ({
  documentExists,
  lastSuccessfulIngestionAt,
  lastConnectionTestAt,
  lastParserStatus: _lastParserStatus,
  now = Date.now(),
}: {
  documentExists: boolean;
  lastSuccessfulIngestionAt: unknown;
  lastConnectionTestAt: unknown;
  lastParserStatus: unknown;
  now?: number;
}): BankNotificationHealthState => {
  if (!documentExists) return 'unconfigured';
  const successfulAt = toBankDate(lastSuccessfulIngestionAt)?.getTime() ?? 0;
  const connectionTestAt = toBankDate(lastConnectionTestAt)?.getTime() ?? 0;
  const latestHealthySignalAt = Math.max(successfulAt, connectionTestAt);
  return latestHealthySignalAt > 0 && now - latestHealthySignalAt <= BANK_HEALTH_STALE_AFTER_MS
    ? 'healthy'
    : 'stale';
};
