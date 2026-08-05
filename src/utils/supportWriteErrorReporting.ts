import type { CreateSupportWriteOperationLogInput } from '../types/supportWriteOperation';

export const SUPPORT_WRITE_RETRY_USER_MESSAGE =
  '저장에 실패했습니다. 같은 화면에서 잠시 후 다시 시도해 주세요. 문제가 반복되면 작업 시간과 화면명을 관리자에게 전달해 주세요.';

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

export const reportSupportWriteError = (
  error: unknown,
  context: Omit<CreateSupportWriteOperationLogInput, 'status'> & { status?: string }
): void => {
  const errorMessage = getErrorMessage(error);
  console.error('[support-write-operation] save failed', {
    ...context,
    errorMessage
  }, error);

  if (process.env.NODE_ENV !== 'production') return;

  void import('@sentry/react')
    .then((Sentry) => {
      Sentry.captureException(error, {
        tags: {
          supportWriteDomain: context.domain,
          supportWriteStatus: context.status ?? 'failed'
        },
        extra: {
          ...context,
          errorMessage
        }
      });
    })
    .catch(() => undefined);
};
