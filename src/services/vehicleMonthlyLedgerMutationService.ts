import { isPostedVehicleBillingStatus, vehicleBillingService } from './vehicleBillingService';
import { vehicleService } from './vehicleService';
import { supportWriteOperationLogService } from './supportWriteOperationLogService';
import { getErrorMessage, reportSupportWriteError, SUPPORT_WRITE_RETRY_USER_MESSAGE } from '../utils/supportWriteErrorReporting';
import type { Vehicle, VehicleExpenseRecord, VehicleExpenseType, VehicleFineChargeTarget } from '../types/vehicle';
import type { VehicleBillingDocument } from '../types/vehicleBilling';
import type { CreateSupportWriteOperationLogInput } from '../types/supportWriteOperation';

const normalizeKey = (value: unknown): string => String(value ?? '').trim();
const POSTED_BILLING_STATUSES = new Set(['CONFIRMED', 'PAID', 'OVERDUE']);

const isPostedBillingDocument = (billing: VehicleBillingDocument): boolean => (
  isPostedVehicleBillingStatus(billing.status) ||
  POSTED_BILLING_STATUSES.has(String(billing.status ?? '').trim().toUpperCase())
);

const parseYmdDate = (value?: string | null): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

export interface VehicleMonthlyLedgerMutationSegment {
  startDate: string;
  endDate: string;
}

export interface VehicleMonthlyLedgerMutationRow {
  id: string;
  vehicle: Pick<Vehicle, 'id' | 'licensePlate'>;
  segment: VehicleMonthlyLedgerMutationSegment;
  amounts: Partial<Record<VehicleExpenseType, number>>;
  fineChargeTarget: VehicleFineChargeTarget;
  note?: string;
}

export interface VehicleMonthlyLedgerVisibleRow<TRow extends VehicleMonthlyLedgerMutationRow> {
  row: TRow;
}

export interface VehicleMonthlyLedgerMutationDependencies {
  applyExpenseChanges: (params: {
    upserts: Array<Partial<VehicleExpenseRecord> & { id: string }>;
    cancelIds: string[];
    operationId?: string;
  }) => Promise<void>;
  saveBilling: (billing: VehicleBillingDocument) => Promise<void>;
  recordOperation: (input: CreateSupportWriteOperationLogInput) => Promise<unknown>;
}

export interface VehicleMonthlyLedgerSaveInput<TRow extends VehicleMonthlyLedgerMutationRow> {
  yearMonth: string;
  visibleRows: Array<VehicleMonthlyLedgerVisibleRow<TRow>>;
  originalExpenses: VehicleExpenseRecord[];
  expenseTypes: VehicleExpenseType[];
  getBillingDocumentsForRow: (row: TRow) => VehicleBillingDocument[];
  buildBillingDocumentsForRow: (
    row: TRow,
    documents: VehicleBillingDocument[]
  ) => VehicleBillingDocument[];
  operationId?: string;
  dependencies?: Partial<VehicleMonthlyLedgerMutationDependencies>;
}

export interface VehicleMonthlyLedgerSaveResult {
  operationId: string;
  upsertedExpenseCount: number;
  cancelledExpenseCount: number;
  savedBillingCount: number;
  cancelledBillingCount: number;
  skippedBillingCount: number;
  expenseUpsertIds: string[];
  expenseCancelIds: string[];
  billingSaveIds: string[];
  billingCancelIds: string[];
  skippedBillingRows: VehicleMonthlyLedgerSkippedBillingRow[];
}

export interface VehicleMonthlyLedgerSkippedBillingRow {
  rowId: string;
  vehicleId: string;
  vehiclePlate: string;
  reason: 'posted-billing-protected';
  billingIds: string[];
  statuses: string[];
}

const defaultDependencies: VehicleMonthlyLedgerMutationDependencies = {
  applyExpenseChanges: (params) => vehicleService.applyVehicleExpenseChanges(params),
  saveBilling: (billing) => vehicleBillingService.saveBilling(billing),
  recordOperation: (input) => supportWriteOperationLogService.recordOperation(input)
};

const buildDependencies = (
  dependencies: Partial<VehicleMonthlyLedgerMutationDependencies> | undefined
): VehicleMonthlyLedgerMutationDependencies => ({
  ...defaultDependencies,
  ...(dependencies ?? {})
});

const sanitizeIdPart = (value: unknown): string => {
  const text = normalizeKey(value);
  const safe = text
    .replace(/[/#[\]?]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^0-9A-Za-z가-힣_.:-]/g, '_');
  return safe || 'blank';
};

const buildExpenseId = (
  yearMonth: string,
  row: VehicleMonthlyLedgerMutationRow,
  type: VehicleExpenseType
): string => [
  'vehicle-ledger',
  yearMonth,
  row.vehicle.id,
  row.segment.startDate || `${yearMonth}-01`,
  row.segment.endDate || row.segment.startDate || `${yearMonth}-01`,
  type,
  type === 'FINE' ? row.fineChargeTarget : 'default'
].map(sanitizeIdPart).join('__');

const buildDefaultOperationId = (yearMonth: string): string => `vehicle-monthly-ledger:${yearMonth}`;

const uniqueIds = (ids: unknown[]): string[] => Array.from(new Set(
  ids.map((id) => String(id ?? '').trim()).filter(Boolean)
));

const recordOperationSafely = async (
  recordOperation: VehicleMonthlyLedgerMutationDependencies['recordOperation'],
  input: CreateSupportWriteOperationLogInput
): Promise<void> => {
  try {
    await recordOperation(input);
  } catch (error) {
    console.error('[vehicleMonthlyLedgerMutationService] operation log failed', {
      operationId: input.operationId,
      status: input.status
    }, error);
  }
};

const validateSaveInput = <TRow extends VehicleMonthlyLedgerMutationRow>(
  input: Pick<VehicleMonthlyLedgerSaveInput<TRow>, 'yearMonth' | 'visibleRows' | 'expenseTypes'>
): void => {
  if (!/^\d{4}-\d{2}$/.test(String(input.yearMonth ?? '').trim())) {
    throw new Error('invalid-year-month');
  }

  if (input.expenseTypes.length === 0) {
    throw new Error('expense-types-required');
  }

  input.visibleRows.forEach(({ row }) => {
    if (!normalizeKey(row.vehicle.id)) throw new Error('vehicle-id-required');
    if (!normalizeKey(row.vehicle.licensePlate)) throw new Error('vehicle-plate-required');

    const start = parseYmdDate(row.segment.startDate);
    const end = parseYmdDate(row.segment.endDate);
    if (!start || !end || end.getTime() < start.getTime()) {
      throw new Error(`invalid-ledger-period:${row.id}`);
    }

    input.expenseTypes.forEach((type) => {
      const amount = row.amounts[type] ?? 0;
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(`invalid-expense-amount:${row.id}:${type}`);
      }
    });
  });
};

const buildCancelledBillingDocument = (billing: VehicleBillingDocument): VehicleBillingDocument => ({
  ...billing,
  status: 'CANCELLED',
  fixedCost: 0,
  variableCost: 0,
  totalAmount: 0,
  lineItems: [],
  memo: billing.memo ? `${billing.memo}\n취소 처리됨` : '취소 처리됨'
});

export const saveVehicleMonthlyLedgerMutation = async <TRow extends VehicleMonthlyLedgerMutationRow>({
  yearMonth,
  visibleRows,
  originalExpenses,
  expenseTypes,
  getBillingDocumentsForRow,
  buildBillingDocumentsForRow,
  operationId,
  dependencies
}: VehicleMonthlyLedgerSaveInput<TRow>): Promise<VehicleMonthlyLedgerSaveResult> => {
  const deps = buildDependencies(dependencies);
  const resolvedOperationId = operationId || buildDefaultOperationId(yearMonth);
  let attemptedAffectedDocumentIds: string[] = [];

  try {
  validateSaveInput({ yearMonth, visibleRows, expenseTypes });

  const preparedRows = visibleRows.map(({ row }) => {
    const documents = getBillingDocumentsForRow(row);
    const postedDocuments = documents.filter(isPostedBillingDocument);
    return { row, documents, postedDocuments };
  });

  const skippedBillingRows = preparedRows
    .filter((item) => item.postedDocuments.length > 0)
    .map((item): VehicleMonthlyLedgerSkippedBillingRow => ({
      rowId: item.row.id,
      vehicleId: item.row.vehicle.id,
      vehiclePlate: item.row.vehicle.licensePlate,
      reason: 'posted-billing-protected',
      billingIds: item.postedDocuments.map((doc) => doc.id).filter(Boolean),
      statuses: Array.from(new Set(item.postedDocuments.map((doc) => String(doc.status ?? '')).filter(Boolean)))
    }));

  const rowsToProcess = preparedRows.filter((item) => item.postedDocuments.length === 0);

  const visibleScopes = rowsToProcess.map(({ row }) => ({
    vehicleId: normalizeKey(row.vehicle.id),
    start: parseYmdDate(row.segment.startDate),
    end: parseYmdDate(row.segment.endDate)
  }));

  const isVisibleExpense = (expense: VehicleExpenseRecord) => {
    const expenseVehicleId = normalizeKey(expense.vehicleId);
    const expenseDate = parseYmdDate(expense.date);
    return visibleScopes.some((scope) => {
      if (!scope.vehicleId || scope.vehicleId !== expenseVehicleId) return false;
      if (!expenseDate || !scope.start || !scope.end) return true;
      return expenseDate.getTime() >= scope.start.getTime() && expenseDate.getTime() <= scope.end.getTime();
    });
  };

  const expenseUpserts: Array<Partial<VehicleExpenseRecord> & { id: string }> = [];
  const expenseUpsertIds = new Set<string>();
  rowsToProcess.forEach(({ row }) => {
    expenseTypes.forEach((type) => {
      const amount = row.amounts[type] ?? 0;
      if (amount <= 0) return;
      const id = buildExpenseId(yearMonth, row, type);
      expenseUpsertIds.add(id);
      expenseUpserts.push({
        id,
        vehicleId: row.vehicle.id,
        vehiclePlate: row.vehicle.licensePlate,
        date: row.segment.startDate || `${yearMonth}-01`,
        type,
        amount,
        payer: 'COMPANY',
        fineChargeTarget: type === 'FINE' ? row.fineChargeTarget : undefined,
        note: row.note || undefined,
        status: 'ACTIVE',
        operationId: resolvedOperationId,
        lastOperationId: resolvedOperationId
      });
    });
  });

  const expenseCancelIds = Array.from(new Set(
    originalExpenses
      .filter((expense) => expense.status !== 'CANCELLED')
      .filter(isVisibleExpense)
      .map((expense) => expense.id)
      .filter((id) => id && !expenseUpsertIds.has(id))
  ));
  attemptedAffectedDocumentIds = uniqueIds([
    ...expenseUpsertIds,
    ...expenseCancelIds
  ]);

  await deps.applyExpenseChanges({
    upserts: expenseUpserts,
    cancelIds: expenseCancelIds,
    operationId: resolvedOperationId
  });

  const billingSaveTasks: Array<Promise<void>> = [];
  const billingCancelDocuments = new Map<string, VehicleBillingDocument>();
  const billingSaveIds = new Set<string>();

  rowsToProcess.forEach(({ row, documents }) => {
    if (documents.length === 0) return;

    const nextDocuments = buildBillingDocumentsForRow(row, documents);
    if (nextDocuments.length === 0) {
      const documentIds = Array.from(new Set(documents.map((doc) => doc.id).filter(Boolean)));
      documents.forEach((doc) => {
        if (documentIds.includes(doc.id)) billingCancelDocuments.set(doc.id, buildCancelledBillingDocument(doc));
      });
      return;
    }

    const nextIds = new Set(nextDocuments.map((doc) => doc.id).filter(Boolean));
    nextIds.forEach((id) => billingSaveIds.add(id));
    billingSaveTasks.push(...nextDocuments.map((doc) => deps.saveBilling(doc)));
    documents.forEach((doc) => {
      if (doc.id && !nextIds.has(doc.id)) {
        billingCancelDocuments.set(doc.id, buildCancelledBillingDocument(doc));
      }
    });
  });

  billingSaveIds.forEach((id) => billingCancelDocuments.delete(id));
  const billingCancelDocs = Array.from(billingCancelDocuments.values());
  attemptedAffectedDocumentIds = uniqueIds([
    ...attemptedAffectedDocumentIds,
    ...billingSaveIds,
    ...billingCancelDocs.map((doc) => doc.id)
  ]);

  await Promise.all(billingSaveTasks);
  await Promise.all(billingCancelDocs.map((doc) => deps.saveBilling(doc)));

  const result = {
    operationId: resolvedOperationId,
    upsertedExpenseCount: expenseUpserts.length,
    cancelledExpenseCount: expenseCancelIds.length,
    savedBillingCount: billingSaveIds.size,
    cancelledBillingCount: billingCancelDocs.length,
    skippedBillingCount: skippedBillingRows.length,
    expenseUpsertIds: Array.from(expenseUpsertIds),
    expenseCancelIds,
    billingSaveIds: Array.from(billingSaveIds),
    billingCancelIds: billingCancelDocs.map((doc) => doc.id),
    skippedBillingRows
  };

  await recordOperationSafely(deps.recordOperation, {
    domain: 'vehicle',
    yearMonth,
    operationId: resolvedOperationId,
    status: 'success',
    affectedDocumentIds: uniqueIds([
      ...result.expenseUpsertIds,
      ...result.expenseCancelIds,
      ...result.billingSaveIds,
      ...result.billingCancelIds
    ]),
    metadata: {
      upsertedExpenseCount: result.upsertedExpenseCount,
      cancelledExpenseCount: result.cancelledExpenseCount,
      savedBillingCount: result.savedBillingCount,
      cancelledBillingCount: result.cancelledBillingCount,
      skippedBillingCount: result.skippedBillingCount,
      skippedBillingRows: result.skippedBillingRows
    }
  });

  return result;
  } catch (error) {
    const failedContext = {
      domain: 'vehicle' as const,
      yearMonth,
      operationId: resolvedOperationId,
      affectedDocumentIds: attemptedAffectedDocumentIds,
      errorMessage: getErrorMessage(error),
      userMessage: SUPPORT_WRITE_RETRY_USER_MESSAGE
    };
    await recordOperationSafely(deps.recordOperation, {
      ...failedContext,
      status: 'failed'
    });
    reportSupportWriteError(error, {
      ...failedContext,
      status: 'failed'
    });
    throw error;
  }
};

export const vehicleMonthlyLedgerMutationService = {
  saveMonthlyLedger: saveVehicleMonthlyLedgerMutation
};
