import type { CreateSupportWriteOperationLogInput } from '../types/supportWriteOperation';

export const SUPPORT_WRITE_RETRY_USER_MESSAGE =
  '저장에 실패했습니다. 같은 화면에서 잠시 후 다시 시도해 주세요. 문제가 반복되면 작업 시간과 화면명을 관리자에게 전달해 주세요.';

// Business callers inspect these messages. Never use this legacy extractor for diagnostics.
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const maybeError = error as { message?: unknown; code?: unknown; name?: unknown };
    return [maybeError.code, maybeError.name, maybeError.message]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' ');
  }
  return 'unknown-error';
};

export const supportOwnValue = (input: unknown, key: string): unknown => {
  if (!input || typeof input !== 'object') return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch { return undefined; }
};
const member = (value: unknown, allowed: readonly string[]): value is string =>
  typeof value === 'string' && allowed.includes(value);

// Local observation only. Not a durable receipt, retry token, or financial lock.
const recordingFailures = new Set<string>();
const recordingObservers = new Set<() => void>();
export const hasSupportWriteRecordFailure = (operationId?: string): boolean => !!operationId && recordingFailures.has(operationId);
export const subscribeSupportWriteRecordFailure = (observer: () => void): (() => void) => {
  recordingObservers.add(observer);
  return () => { recordingObservers.delete(observer); };
};
export const noteSupportWriteRecordFailure = (operationId: unknown): void => {
  if (typeof operationId !== 'string' || !operationId) return;
  recordingFailures.add(operationId);
  if (recordingFailures.size > 200) recordingFailures.delete(recordingFailures.values().next().value as string);
  recordingObservers.forEach(observer => { try { observer(); } catch { /* UI observation only. */ } });
};

export const sanitizeSupportWriteMetadata = (input: unknown): Record<string, unknown> => {
  const output: Record<string, unknown> = {};
  const enums: Record<string, readonly string[]> = {
    stage: ['selection', 'request-check', 'protection-read', 'preflight', 'ledger-save', 'stored-read', 'billing', 'capture', 'prepare', 'execute', 'recover', 'readback', 'completed', 'record'],
    status: ['success', 'failed', 'completed', 'partial', 'blocked', 'unknown', 'refresh-failed', 'record-failed'],
    transactionStatus: ['completed', 'unknown', 'blocked'],
    billingStatus: ['completed', 'partial', 'unknown', 'not-started'],
    recordStatus: ['completed', 'failed']
  };
  for (const key of Object.keys(enums)) {
    const value = supportOwnValue(input, key);
    if (member(value, enums[key])) output[key] = value;
  }
  for (const key of ['completedCount', 'failedCount', 'protectedCount', 'attemptedCount', 'upsertedExpenseCount', 'cancelledExpenseCount', 'upsertedTransactionCount', 'cancelledTransactionCount', 'savedBillingCount', 'cancelledBillingCount', 'skippedBillingCount']) {
    const value = supportOwnValue(input, key);
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) output[key] = value;
  }
  for (const key of ['retryAllowed', 'replayed', 'ledgerSaved', 'resultUnknown']) {
    const value = supportOwnValue(input, key);
    if (typeof value === 'boolean') output[key] = value;
  }
  return output;
};

export const reportSupportWriteError = (
  _error: unknown,
  context: Partial<Omit<CreateSupportWriteOperationLogInput, 'status'>> & { status?: string }
): void => {
  // No remote SDK, raw exception, arbitrary context, identifier, or monetary value.
  // Diagnostics are observation only, including when the console itself throws.
  try {
    const domain = supportOwnValue(context, 'domain');
    console.error('[support-write-operation]', {
      domain: member(domain, ['vehicle', 'card', 'accommodation', 'teamExpense']) ? domain : 'unknown',
      errorCode: 'SUPPORT_WRITE_UNKNOWN'
    });
  } catch { /* Do not change the financial return/throw. */ }
};
