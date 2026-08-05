import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { recordSupportWriteOperationSafely } from './supportWriteOperationLogService';
import { getErrorMessage, reportSupportWriteError, SUPPORT_WRITE_RETRY_USER_MESSAGE } from '../utils/supportWriteErrorReporting';
import type {
  TeamExpenseClaim,
  TeamExpenseClaimAttachment,
  TeamExpenseClaimInput,
  TeamExpenseClaimStatus
} from '../types/teamExpenseLedger';

export const TEAM_EXPENSE_CLAIMS_COLLECTION = 'team_expense_claims';
export const LEGACY_TEAM_EXPENSE_LEDGERS_COLLECTION = 'team_expense_ledgers';

export interface TeamExpenseClaimSaveOptions {
  operationId?: string;
}

const normalizeIdSegment = (value: unknown, fallback = 'none'): string => {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[\\/#?%*:|"<>[\]]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120);
  return normalized || fallback;
};

const hashStableText = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const buildDeterministicClaimId = (
  input: TeamExpenseClaimInput,
  operationId?: string
): string => {
  if (operationId) {
    return `team-expense-claim__op__${normalizeIdSegment(operationId)}`;
  }

  if (input.sourceType && input.sourceFixedExpenseId && input.generatedForYearMonth) {
    return [
      'team-expense-claim__source',
      normalizeIdSegment(input.sourceType),
      normalizeIdSegment(input.sourceFixedExpenseId),
      normalizeIdSegment(input.generatedForYearMonth)
    ].join('__');
  }

  const fingerprint = [
    input.yearMonth,
    input.date,
    input.claimType ?? 'otherExpense',
    input.payerTeamId,
    input.chargeToTeamId ?? '',
    input.siteId ?? '',
    input.cardLabel ?? '',
    input.category,
    input.description,
    normalizeAmount(input.amount),
    input.memo ?? ''
  ].map((item) => String(item ?? '').trim()).join('|');

  return `team-expense-claim__auto__${hashStableText(fingerprint)}`;
};

const toTimestamp = (value: unknown) => {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value;
  if (typeof value === 'object' && value && typeof (value as any).toDate === 'function') return value as Timestamp;
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return Timestamp.fromDate(date);
  }
  return undefined;
};

const toMillis = (value: unknown): number => {
  const timestamp = toTimestamp(value);
  return timestamp ? timestamp.toMillis() : 0;
};

const normalizeAmount = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const stripUndefined = <T extends Record<string, unknown>>(value: T): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

const normalizeCategory = (value: unknown): TeamExpenseClaim['category'] => {
  const raw = String(value ?? '').trim();
  return raw || 'etc';
};

const normalizeClaimType = (value: unknown, data: Record<string, unknown>): TeamExpenseClaim['claimType'] => {
  const raw = String(value ?? '').trim();
  if (raw === 'teamCharge' || raw === 'otherExpense' || raw === 'officeExpense') return raw;
  return data.chargeToTeamId ? 'teamCharge' : 'otherExpense';
};

const normalizeAttachment = (value: unknown, index: number): TeamExpenseClaimAttachment | null => {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const fullPath = String(data.fullPath ?? data.path ?? '').trim();
  const url = String(data.url ?? data.downloadUrl ?? '').trim();
  if (!fullPath && !url) return null;

  const fallbackName = fullPath.split('/').filter(Boolean).pop() || `attachment-${index + 1}`;
  const size = normalizeAmount(data.size);
  const fallbackId = fullPath || url || `attachment-${index + 1}`;

  const attachment: TeamExpenseClaimAttachment = {
    id: String(data.id ?? fallbackId),
    name: String(data.name ?? data.fileName ?? fallbackName),
    fullPath
  };
  if (url) attachment.url = url;
  if (size > 0) attachment.size = size;
  if (data.contentType) attachment.contentType = String(data.contentType);
  if (data.uploadedAt) attachment.uploadedAt = data.uploadedAt;
  return attachment;
};

const normalizeAttachments = (value: unknown): TeamExpenseClaimAttachment[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => normalizeAttachment(item, index))
    .filter((item): item is TeamExpenseClaimAttachment => Boolean(item));
};

const normalizeStatus = (value: unknown): TeamExpenseClaimStatus => {
  const raw = String(value ?? '').trim();
  if (raw === 'charged' || raw === 'settled') return raw;
  return 'draft';
};

export const isPostedTeamExpenseClaimStatus = (status: unknown): boolean => {
  const normalized = normalizeStatus(status);
  return normalized === 'charged' || normalized === 'settled';
};

export const isLockedTeamExpenseClaimStatus = (status: unknown): boolean => {
  return normalizeStatus(status) === 'settled';
};

const validateClaimInput = (input: TeamExpenseClaimInput): void => {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}$/.test(String(input.yearMonth ?? ''))) errors.push('yearMonth');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.date ?? ''))) errors.push('date');
  if (!String(input.payerTeamId ?? '').trim()) errors.push('payerTeamId');
  if (!String(input.payerTeamName ?? '').trim()) errors.push('payerTeamName');
  if (!String(input.category ?? '').trim()) errors.push('category');
  if (!String(input.description ?? '').trim()) errors.push('description');
  if (!Number.isFinite(normalizeAmount(input.amount)) || normalizeAmount(input.amount) < 0) errors.push('amount');

  const claimType = normalizeClaimType(input.claimType, input as unknown as Record<string, unknown>);
  if (claimType === 'teamCharge' && !String(input.chargeToTeamId ?? '').trim()) {
    errors.push('chargeToTeamId');
  }

  if (errors.length > 0) {
    throw new Error(`team-expense-claim-invalid: ${errors.join(', ')}`);
  }
};

const comparableAttachment = (attachment: TeamExpenseClaimAttachment) => ({
  id: String(attachment.id ?? ''),
  name: String(attachment.name ?? ''),
  fullPath: String(attachment.fullPath ?? ''),
  url: String(attachment.url ?? ''),
  size: normalizeAmount(attachment.size),
  contentType: String(attachment.contentType ?? '')
});

const comparableClaimFields = (
  claim: Partial<TeamExpenseClaimInput & TeamExpenseClaim>
): Record<string, unknown> => {
  const data = claim as Record<string, unknown>;
  return {
    yearMonth: String(claim.yearMonth ?? '').trim(),
    date: String(claim.date ?? '').trim(),
    claimType: normalizeClaimType(claim.claimType, data),
    payerTeamId: String(claim.payerTeamId ?? '').trim(),
    payerTeamName: String(claim.payerTeamName ?? '').trim(),
    chargeToTeamId: String(claim.chargeToTeamId ?? '').trim(),
    chargeToTeamName: String(claim.chargeToTeamName ?? '').trim(),
    siteId: String(claim.siteId ?? '').trim(),
    siteName: String(claim.siteName ?? '').trim(),
    cardLabel: String(claim.cardLabel ?? '').trim(),
    category: normalizeCategory(claim.category),
    description: String(claim.description ?? '').trim(),
    amount: normalizeAmount(claim.amount),
    memo: String(claim.memo ?? '').trim(),
    attachments: normalizeAttachments(claim.attachments).map(comparableAttachment),
    sourceType: String(claim.sourceType ?? '').trim(),
    sourceFixedExpenseId: String(claim.sourceFixedExpenseId ?? '').trim(),
    sourceFixedExpenseName: String(claim.sourceFixedExpenseName ?? '').trim(),
    generatedForYearMonth: String(claim.generatedForYearMonth ?? '').trim()
  };
};

const isSameComparableClaim = (
  left: Partial<TeamExpenseClaimInput & TeamExpenseClaim>,
  right: Partial<TeamExpenseClaimInput & TeamExpenseClaim>
): boolean => JSON.stringify(comparableClaimFields(left)) === JSON.stringify(comparableClaimFields(right));

const canTransitionStatus = (
  currentStatus: TeamExpenseClaimStatus,
  nextStatus: TeamExpenseClaimStatus
): boolean => {
  const order: Record<TeamExpenseClaimStatus, number> = {
    draft: 0,
    charged: 1,
    settled: 2
  };
  return order[nextStatus] >= order[currentStatus];
};

const assertCanSaveClaim = (
  existing: TeamExpenseClaim | undefined,
  input: TeamExpenseClaimInput
): TeamExpenseClaimStatus => {
  const existingStatus = existing?.status ? normalizeStatus(existing.status) : undefined;
  const nextStatus = normalizeStatus(input.status ?? existingStatus ?? 'draft');

  if (!existing) return nextStatus;

  if (!isLockedTeamExpenseClaimStatus(existingStatus)) {
    if (!canTransitionStatus(existingStatus ?? 'draft', nextStatus)) {
      throw new Error('team-expense-claim-status-transition-blocked');
    }
    return nextStatus;
  }

  if (nextStatus !== existingStatus) {
    throw new Error('team-expense-claim-posted-status-change-blocked');
  }

  if (!isSameComparableClaim(existing, input)) {
    throw new Error('team-expense-claim-posted-modification-blocked');
  }

  return existingStatus;
};

const mapClaim = (id: string, data: Record<string, unknown>): TeamExpenseClaim => ({
  id,
  yearMonth: String(data.yearMonth ?? ''),
  date: String(data.date ?? ''),
  claimType: normalizeClaimType(data.claimType, data),
  payerTeamId: String(data.payerTeamId ?? ''),
  payerTeamName: String(data.payerTeamName ?? ''),
  chargeToTeamId: String(data.chargeToTeamId ?? ''),
  chargeToTeamName: String(data.chargeToTeamName ?? ''),
  siteId: data.siteId ? String(data.siteId) : undefined,
  siteName: String(data.siteName ?? ''),
  cardLabel: data.cardLabel ? String(data.cardLabel) : undefined,
  category: normalizeCategory(data.category),
  description: String(data.description ?? ''),
  amount: normalizeAmount(data.amount),
  status: (data.status ? String(data.status) : 'draft') as TeamExpenseClaim['status'],
  memo: data.memo ? String(data.memo) : undefined,
  attachments: normalizeAttachments(data.attachments),
  sourceType: data.sourceType ? String(data.sourceType) as TeamExpenseClaim['sourceType'] : undefined,
  sourceFixedExpenseId: data.sourceFixedExpenseId ? String(data.sourceFixedExpenseId) : undefined,
  sourceFixedExpenseName: data.sourceFixedExpenseName ? String(data.sourceFixedExpenseName) : undefined,
  generatedForYearMonth: data.generatedForYearMonth ? String(data.generatedForYearMonth) : undefined,
  operationId: data.operationId ? String(data.operationId) : undefined,
  lastOperationId: data.lastOperationId ? String(data.lastOperationId) : undefined,
  lastOperationAt: toTimestamp(data.lastOperationAt),
  handledById: data.handledById ? String(data.handledById) : undefined,
  handledByName: data.handledByName ? String(data.handledByName) : undefined,
  handleMemo: data.handleMemo ? String(data.handleMemo) : undefined,
  handledAt: toTimestamp(data.handledAt),
  createdAt: toTimestamp(data.createdAt),
  updatedAt: toTimestamp(data.updatedAt)
});

export const teamExpenseLedgerService = {
  async listAllClaims(): Promise<TeamExpenseClaim[]> {
    const snap = await getDocs(collection(db, TEAM_EXPENSE_CLAIMS_COLLECTION));
    return snap.docs
      .map((row) => mapClaim(row.id, row.data() as Record<string, unknown>))
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  },

  async getClaimsByMonth(yearMonth: string): Promise<TeamExpenseClaim[]> {
    const q = query(
      collection(db, TEAM_EXPENSE_CLAIMS_COLLECTION),
      where('yearMonth', '==', yearMonth)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((row) => mapClaim(row.id, row.data() as Record<string, unknown>))
      .sort((a, b) => String(a.date).localeCompare(String(b.date), 'ko-KR'));
  },

  async saveClaim(
    input: TeamExpenseClaimInput & { id?: string },
    options: TeamExpenseClaimSaveOptions = {}
  ): Promise<string> {
    const explicitOperationId = String(input.operationId ?? options.operationId ?? '').trim();
    const id = input.id || buildDeterministicClaimId(input, explicitOperationId);
    const operationId = explicitOperationId || `team-expense-claim:${id}`;

    try {
      validateClaimInput(input);
      const now = Timestamp.now();
      const ref = doc(db, TEAM_EXPENSE_CLAIMS_COLLECTION, id);
      const existing = await getDoc(ref);
      const existingClaim = existing.exists()
        ? mapClaim(id, existing.data() as Record<string, unknown>)
        : undefined;
      const nextStatus = assertCanSaveClaim(existingClaim, input);

      await setDoc(
        ref,
        stripUndefined({
          ...input,
          id,
          status: nextStatus,
          amount: normalizeAmount(input.amount),
          operationId,
          lastOperationId: operationId,
          lastOperationAt: now,
          updatedAt: now,
          createdAt: existing.exists() ? existing.data().createdAt ?? now : now
        }),
        { merge: true }
      );

      await recordSupportWriteOperationSafely({
        domain: 'teamExpense',
        yearMonth: input.yearMonth,
        operationId,
        status: 'success',
        affectedDocumentIds: [id],
        metadata: {
          claimType: input.claimType,
          status: nextStatus,
          amount: normalizeAmount(input.amount)
        }
      });

      return id;
    } catch (error) {
      const failedContext = {
        domain: 'teamExpense' as const,
        yearMonth: input.yearMonth,
        operationId,
        affectedDocumentIds: [id],
        errorMessage: getErrorMessage(error),
        userMessage: SUPPORT_WRITE_RETRY_USER_MESSAGE
      };
      await recordSupportWriteOperationSafely({
        ...failedContext,
        status: 'failed'
      });
      reportSupportWriteError(error, {
        ...failedContext,
        status: 'failed'
      });
      throw error;
    }
  },

  async deleteClaim(id: string): Promise<void> {
    const ref = doc(db, TEAM_EXPENSE_CLAIMS_COLLECTION, id);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      const existingClaim = mapClaim(id, existing.data() as Record<string, unknown>);
      if (isLockedTeamExpenseClaimStatus(existingClaim.status)) {
        throw new Error('team-expense-claim-posted-delete-blocked');
      }
    }
    await deleteDoc(ref);
  },

  async updateClaimStatus(
    id: string,
    status: TeamExpenseClaim['status'],
    audit: { actorId?: string; actorName?: string; memo?: string } = {}
  ): Promise<void> {
    const now = Timestamp.now();
    const ref = doc(db, TEAM_EXPENSE_CLAIMS_COLLECTION, id);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      throw new Error('team-expense-claim-not-found');
    }

    const existingClaim = mapClaim(id, existing.data() as Record<string, unknown>);
    const currentStatus = normalizeStatus(existingClaim.status);
    const nextStatus = normalizeStatus(status);
    if (!canTransitionStatus(currentStatus, nextStatus)) {
      throw new Error('team-expense-claim-status-transition-blocked');
    }

    await setDoc(
      ref,
      stripUndefined({
        status: nextStatus,
        handledById: audit.actorId,
        handledByName: audit.actorName,
        handleMemo: audit.memo,
        handledAt: now,
        updatedAt: now
      }),
      { merge: true }
    );
  }
};
