type ErrorLike = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
};

const errorDescriptor = (error: unknown): string => {
  if (typeof error === 'string') return error.toLowerCase();
  if (!error || typeof error !== 'object') return String(error).toLowerCase();
  const value = error as ErrorLike;
  return [value.code, value.name, value.message]
    .filter((item): item is string => typeof item === 'string')
    .join(' ')
    .toLowerCase();
};

/** Authentication/authorization loss and an explicit competing edit lock are
 * terminal for the current editing session. Transport failures are not. */
export const isConstructionPlanEditingAccessRevoked = (error: unknown): boolean => {
  const descriptor = errorDescriptor(error);
  return descriptor.includes('permission-denied')
    || descriptor.includes('permission_denied')
    || descriptor.includes('unauthenticated')
    || descriptor.includes('edit-lock-held-by-other')
    || descriptor.includes('content-locked-in-');
};
