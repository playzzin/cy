let mutationRequestSequence = 0;

/**
 * Creates an idempotency key for one explicit user mutation attempt.
 *
 * Retain this key after a transport failure and reuse it for the retry. Once
 * the mutation succeeds, a later identical comment/reply must receive a new
 * key so it remains a distinct audit record.
 */
export const createConstructionPlanReviewMutationRequestId = (
  operation: 'create' | 'reply',
): string => {
  mutationRequestSequence += 1;
  const randomId = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${mutationRequestSequence.toString(36)}`;
  return `cp-review-${operation}-${randomId}`.slice(0, 128);
};

export default createConstructionPlanReviewMutationRequestId;
