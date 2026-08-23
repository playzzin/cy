import { isPostedVehicleBillingStatus, vehicleBillingService } from './vehicleBillingService';
import { normalizeVehicleExpenseType } from '../utils/vehicleExpenseType';
import type {
  VehicleExpenseRecord,
  VehicleExpenseType,
  VehicleFineChargeTarget,
  VehicleFineDriverBillingTarget
} from '../types/vehicle';
import type { VehicleBillingDocument } from '../types/vehicleBilling';

const normalizeKey = (value: unknown): string => String(value ?? '').trim();
const normalizeVehicleIdentityKey = (value: unknown): string => normalizeKey(value).replace(/\s+/g, '').toLowerCase();
const PROTECTED_BILLING_STATUSES = new Set(['CONFIRMED', 'PAID', 'OVERDUE']);
export const isProtectedVehicleMonthlyLedgerBillingStatus = (status: unknown): boolean => (
  isPostedVehicleBillingStatus(status) || PROTECTED_BILLING_STATUSES.has(normalizeKey(status).toUpperCase())
);

export const getProtectedVehicleMonthlyLedgerBillingDocuments = (
  documents: VehicleBillingDocument[]
): VehicleBillingDocument[] => documents.filter((document) => (
  isProtectedVehicleMonthlyLedgerBillingStatus(document.status)
));

export const hasVehicleMonthlyLedgerRowScope = (document: VehicleBillingDocument): boolean => (
  normalizeKey(document.id).includes('__row_') ||
  (document.lineItems ?? []).some((item) => Boolean(
    normalizeKey(item.sourceLedgerRowId) ||
    normalizeKey(item.sourceSegmentId) ||
    normalizeKey(item.sourceStartDate) ||
    normalizeKey(item.sourceEndDate)
  ))
);

export const isManagedVehicleMonthlyLedgerBillingDocument = (
  document: VehicleBillingDocument
): boolean => {
  const lineItems = document.lineItems ?? [];
  if (lineItems.length === 0) return false;

  // A canonical/base id is also used by the manual billing manager, so id shape
  // alone is never proof of ownership. Claim the whole document only when every
  // line has explicit ledger provenance; mixed manual + ledger documents are
  // preserved as a unit to avoid silently dropping a manual adjustment.
  return lineItems.every((item) => Boolean(
    normalizeKey(item.sourceType) === 'vehicle_ledger' ||
    normalizeKey(item.sourceLedgerRowId) ||
    normalizeKey(item.sourceSegmentId) ||
    normalizeKey(item.sourceStartDate) ||
    normalizeKey(item.sourceEndDate)
  ));
};

export const hasMixedVehicleMonthlyLedgerBillingOwnership = (
  document: VehicleBillingDocument
): boolean => {
  const ownership = (document.lineItems ?? []).map((item) => Boolean(
    normalizeKey(item.sourceType) === 'vehicle_ledger' ||
    normalizeKey(item.sourceLedgerRowId) ||
    normalizeKey(item.sourceSegmentId) ||
    normalizeKey(item.sourceStartDate) ||
    normalizeKey(item.sourceEndDate)
  ));
  return ownership.some(Boolean) && ownership.some((owned) => !owned);
};

export const getBlockingUnmanagedVehicleBillingDocuments = (
  existingDocuments: VehicleBillingDocument[],
  _desiredDocuments: VehicleBillingDocument[]
): VehicleBillingDocument[] => {
  // Automatic reconciliation cannot safely decide whether an unowned document
  // is a manual adjustment or a very old source-less generated document. Block
  // this vehicle/month for review instead of creating a second DRAFT or deleting
  // user-entered lines.
  return existingDocuments.filter((document) => (
    !isManagedVehicleMonthlyLedgerBillingDocument(document)
  ));
};

export const matchesVehicleMonthlyLedgerBillingIdentity = (
  document: Pick<VehicleBillingDocument, 'vehicleId' | 'vehiclePlate'>,
  vehicle: { id: string; licensePlate: string }
): boolean => {
  const documentVehicleId = normalizeKey(document.vehicleId);
  const vehicleId = normalizeKey(vehicle.id);
  if (documentVehicleId && vehicleId && documentVehicleId === vehicleId) return true;

  const documentPlate = normalizeVehicleIdentityKey(document.vehiclePlate);
  const vehiclePlate = normalizeVehicleIdentityKey(vehicle.licensePlate);
  return Boolean(documentPlate && vehiclePlate && documentPlate === vehiclePlate);
};

const parseYmdDate = (value?: string | null): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizeKey(value));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

export interface StoredVehicleLedgerBillingRow {
  vehicle: { id: string };
  segment: { startDate: string; endDate: string };
  rentFee: number;
  leaseFee: number;
  amounts: Partial<Record<VehicleExpenseType, number>>;
  fineChargeTarget: VehicleFineChargeTarget;
  fineDriverBillingTarget?: VehicleFineDriverBillingTarget;
  variableTotal: number;
  total: number;
  note: string;
}

export interface IndexedVehicleLedgerRow<TRow> {
  row: TRow;
  index: number;
}

export const selectVehicleMonthlyLedgerRowsForSave = <TRow extends { id: string }>(params: {
  allRows: Array<IndexedVehicleLedgerRow<TRow>>;
  visibleRows: Array<IndexedVehicleLedgerRow<TRow>>;
  dirtyRowIds: Iterable<string>;
  retryRowIds: Iterable<string>;
}): Array<IndexedVehicleLedgerRow<TRow>> => {
  const targetedIds = new Set([...params.dirtyRowIds, ...params.retryRowIds]);
  // A retry marker is only an in-memory convenience. After refresh it is
  // gone, so an explicit clean save must reconcile the whole loaded month,
  // not merely the currently filtered rows.
  if (targetedIds.size === 0) return params.allRows;
  return params.allRows.filter(({ row }) => targetedIds.has(row.id));
};

export const buildVehicleLedgerBillingRowFromStoredExpenses = <TRow extends StoredVehicleLedgerBillingRow>(
  screenRow: TRow,
  storedExpenses: VehicleExpenseRecord[],
  expenseTypes: VehicleExpenseType[]
): TRow => {
  const start = parseYmdDate(screenRow.segment.startDate);
  const end = parseYmdDate(screenRow.segment.endDate);
  if (!start || !end || end.getTime() < start.getTime()) {
    throw new Error('invalid-stored-ledger-period');
  }

  const amounts = expenseTypes.reduce<Partial<Record<VehicleExpenseType, number>>>((next, type) => {
    next[type] = 0;
    return next;
  }, {});
  let fineChargeTarget = screenRow.fineChargeTarget;
  let fineDriverBillingTarget = screenRow.fineDriverBillingTarget;
  let note = '';

  storedExpenses
    .filter((expense) => expense.status !== 'CANCELLED' && !expense.cancelledAt)
    .filter((expense) => normalizeKey(expense.vehicleId) === normalizeKey(screenRow.vehicle.id))
    .filter((expense) => {
      const date = parseYmdDate(expense.date);
      return Boolean(date && date.getTime() >= start.getTime() && date.getTime() <= end.getTime());
    })
    .sort((left, right) => (
      `${normalizeKey(left.date)}:${normalizeKey(left.id)}`.localeCompare(`${normalizeKey(right.date)}:${normalizeKey(right.id)}`)
    ))
    .forEach((expense) => {
      const type = normalizeVehicleExpenseType(expense.type, expense.note, expense.id);
      if (!expenseTypes.includes(type)) return;
      const amount = Number(expense.amount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) return;
      amounts[type] = (amounts[type] ?? 0) + amount;
      if (expense.note) note = expense.note;
      if (type === 'FINE' && expense.fineChargeTarget === 'DRIVER') {
        fineChargeTarget = 'DRIVER';
        fineDriverBillingTarget = expense.fineDriverBillingTarget ?? fineDriverBillingTarget;
      }
    });

  const variableTotal = expenseTypes.reduce((sum, type) => sum + (amounts[type] ?? 0), 0);
  return {
    ...screenRow,
    amounts,
    fineChargeTarget,
    fineDriverBillingTarget,
    variableTotal,
    total: screenRow.rentFee + screenRow.leaseFee + variableTotal,
    note
  };
};

export interface VehicleMonthlyLedgerBillingDependencies {
  replaceDrafts: (input: {
    existingDocuments: VehicleBillingDocument[];
    desiredDocuments: VehicleBillingDocument[];
  }) => Promise<{
    savedIds: string[];
    deletedDraftIds: string[];
  }>;
}

export interface UpsertVehicleMonthlyLedgerDraftsInput {
  existingDocuments: VehicleBillingDocument[];
  desiredDocuments: VehicleBillingDocument[];
  dependencies?: Partial<VehicleMonthlyLedgerBillingDependencies>;
}

export interface UpsertVehicleMonthlyLedgerDraftsResult {
  status: 'saved' | 'skipped-posted';
  savedIds: string[];
  deletedDraftIds: string[];
  protectedIds: string[];
  protectedStatuses: string[];
}

const defaultDependencies: VehicleMonthlyLedgerBillingDependencies = {
  replaceDrafts: (input) => vehicleBillingService.replaceMonthlyLedgerDrafts(input)
};

export const upsertVehicleMonthlyLedgerDrafts = async ({
  existingDocuments,
  desiredDocuments,
  dependencies
}: UpsertVehicleMonthlyLedgerDraftsInput): Promise<UpsertVehicleMonthlyLedgerDraftsResult> => {
  const deps = { ...defaultDependencies, ...(dependencies ?? {}) };
  const protectedDocuments = getProtectedVehicleMonthlyLedgerBillingDocuments(existingDocuments);
  if (protectedDocuments.length > 0) {
    return {
      status: 'skipped-posted',
      savedIds: [],
      deletedDraftIds: [],
      protectedIds: Array.from(new Set(protectedDocuments.map((document) => normalizeKey(document.id)).filter(Boolean))),
      protectedStatuses: Array.from(new Set(protectedDocuments.map((document) => normalizeKey(document.status)).filter(Boolean)))
    };
  }

  const desiredIds = desiredDocuments.map((document) => normalizeKey(document.id));
  if (desiredIds.some((id) => !id) || new Set(desiredIds).size !== desiredIds.length) {
    throw new Error('vehicle-billing-deterministic-id-required');
  }

  const desiredDrafts = desiredDocuments.map((document): VehicleBillingDocument => ({
    ...document,
    status: 'DRAFT',
    confirmedAt: undefined
  }));

  // The persistence layer saves every split DRAFT and removes stale DRAFTs in
  // one Firestore transaction. No partial state (new + legacy) is observable.
  const replacement = await deps.replaceDrafts({
    existingDocuments,
    desiredDocuments: desiredDrafts
  });
  const savedIds = replacement.savedIds.map(normalizeKey);
  if (savedIds.length !== desiredDrafts.length || savedIds.some((id) => !id)) {
    throw new Error('vehicle-billing-atomic-replacement-result-invalid');
  }

  return {
    status: 'saved',
    savedIds,
    deletedDraftIds: replacement.deletedDraftIds.map(normalizeKey).filter(Boolean),
    protectedIds: [],
    protectedStatuses: []
  };
};

export const vehicleMonthlyLedgerBillingService = {
  buildRowFromStoredExpenses: buildVehicleLedgerBillingRowFromStoredExpenses,
  getProtectedDocuments: getProtectedVehicleMonthlyLedgerBillingDocuments,
  hasRowScope: hasVehicleMonthlyLedgerRowScope,
  hasMixedOwnership: hasMixedVehicleMonthlyLedgerBillingOwnership,
  getBlockingUnmanagedDocuments: getBlockingUnmanagedVehicleBillingDocuments,
  isManagedDocument: isManagedVehicleMonthlyLedgerBillingDocument,
  matchesBillingIdentity: matchesVehicleMonthlyLedgerBillingIdentity,
  selectRowsForSave: selectVehicleMonthlyLedgerRowsForSave,
  upsertDrafts: upsertVehicleMonthlyLedgerDrafts
};
