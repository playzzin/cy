import type {
  VehicleMonthlyLedgerMutationRow,
  VehicleMonthlyLedgerSaveInput,
  VehicleMonthlyLedgerSaveResult
} from './vehicleMonthlyLedgerMutationService';
import type {
  StoredVehicleLedgerBillingRow,
  UpsertVehicleMonthlyLedgerDraftsResult
} from './vehicleMonthlyLedgerBillingService';
import type { ConfirmedTeamSettlementKeys } from './teamSettlementProtectionService';
import type { VehicleExpenseRecord } from '../types/vehicle';
import type { VehicleBillingDocument } from '../types/vehicleBilling';

type LedgerRow = VehicleMonthlyLedgerMutationRow & StoredVehicleLedgerBillingRow;
type LedgerInput<Row extends LedgerRow> = Pick<VehicleMonthlyLedgerSaveInput<Row>,
  'yearMonth' | 'visibleRows' | 'originalExpenses' | 'expenseTypes'>;

type Dependencies<Row extends LedgerRow> = {
  saveMonthlyLedger: (input: LedgerInput<Row>) => Promise<VehicleMonthlyLedgerSaveResult>;
  getExpensesByMonth: (month: string) => Promise<VehicleExpenseRecord[]>;
  getBillingsByMonth: (month: string, options: { throwOnError: true }) => Promise<VehicleBillingDocument[]>;
  getConfirmedTeamSettlementKeys: (month: string) => Promise<ConfirmedTeamSettlementKeys>;
  loadStoredBillingRow: (row: Row, expenses: VehicleExpenseRecord[]) => Promise<Row>;
  getAutoBillingValidationMessage: (row: Row) => string | null;
  getAllBillingDocumentsForRow: (row: Row, documents: VehicleBillingDocument[]) => VehicleBillingDocument[];
  getBlockingUnmanagedDocumentsForRow: (row: Row, documents: VehicleBillingDocument[]) => VehicleBillingDocument[];
  isRowTeamSettlementConfirmed: (row: Row, documents: VehicleBillingDocument[], keys: ConfirmedTeamSettlementKeys) => boolean;
  applyDraftBillingForStoredRow: (row: Row, documents: VehicleBillingDocument[]) => Promise<
    UpsertVehicleMonthlyLedgerDraftsResult & { desiredDocuments: VehicleBillingDocument[] }
  >;
};

// Coordinates only the preflight-approved subset. Acknowledgement is not proof of commit.
// No default services, SDK initialization, retry, or screen integration.
export async function saveVehicleMonthlyLedgerWithBilling<Row extends LedgerRow>(
  input: LedgerInput<Row>, dependencies: Dependencies<Row>
) {
  const attemptedRowIds = input.visibleRows.map(({ row }) => row.id);
  const ledgerResult = await dependencies.saveMonthlyLedger(input);
  let snapshot: [VehicleExpenseRecord[], VehicleBillingDocument[], ConfirmedTeamSettlementKeys];
  try {
    snapshot = await Promise.all([
      dependencies.getExpensesByMonth(input.yearMonth),
      dependencies.getBillingsByMonth(input.yearMonth, { throwOnError: true }),
      dependencies.getConfirmedTeamSettlementKeys(input.yearMonth)
    ]);
  } catch (error) {
    return {
      status: 'partial' as const,
      ledgerStatus: 'acknowledged' as const,
      billingStatus: 'snapshot-failed' as const,
      ledgerResult,
      attemptedRowIds,
      syncedCount: 0,
      zeroAmountCount: 0,
      failedRowIds: [] as string[],
      newlyProtectedRowIds: [] as string[],
      error
    };
  }
  const [storedExpenses, storedBillingDocuments, refreshedSettlementKeys] = snapshot;
  let workingDocuments = storedBillingDocuments;
  let syncedCount = 0;
  let zeroAmountCount = 0;
  const failedRowIds: string[] = [];
  const newlyProtectedRowIds: string[] = [];

  for (const { row } of input.visibleRows) {
    try {
      const storedRow = await dependencies.loadStoredBillingRow(row, storedExpenses);
      const validationMessage = dependencies.getAutoBillingValidationMessage(storedRow);
      if (validationMessage) throw new Error(validationMessage);
      const existingDocuments = dependencies.getAllBillingDocumentsForRow(storedRow, workingDocuments);
      if (dependencies.getBlockingUnmanagedDocumentsForRow(storedRow, workingDocuments).length > 0) {
        newlyProtectedRowIds.push(row.id);
        continue;
      }
      if (dependencies.isRowTeamSettlementConfirmed(storedRow, existingDocuments, refreshedSettlementKeys)) {
        newlyProtectedRowIds.push(row.id);
        continue;
      }
      const syncResult = await dependencies.applyDraftBillingForStoredRow(storedRow, existingDocuments);
      if (syncResult.status === 'skipped-posted') {
        newlyProtectedRowIds.push(row.id);
        continue;
      }
      syncedCount += 1;
      if (storedRow.total <= 0) zeroAmountCount += 1;
      const removedIds = new Set(syncResult.deletedDraftIds);
      const savedDocuments = syncResult.desiredDocuments.map((document, index) => ({
        ...document,
        id: syncResult.savedIds[index] || document.id,
        status: 'DRAFT' as const,
        confirmedAt: undefined
      }));
      const savedIds = new Set(savedDocuments.map((document) => document.id));
      workingDocuments = [
        ...workingDocuments.filter((document) => !removedIds.has(document.id) && !savedIds.has(document.id)),
        ...savedDocuments
      ];
    } catch (error) {
      failedRowIds.push(row.id);
      try {
        console.error('[VehicleMonthlyLedger] automatic billing sync failed', {
          yearMonth: input.yearMonth, rowId: row.id, vehicleId: row.vehicle.id
        }, error);
      } catch { /* Diagnostics must not replace row outcomes or stop the next row. */ }
    }
  }
  const partial = failedRowIds.length > 0 || newlyProtectedRowIds.length > 0;
  return {
    status: partial ? 'partial' as const : 'completed' as const,
    ledgerStatus: 'acknowledged' as const,
    billingStatus: partial ? 'rows-partial' as const : 'rows-completed' as const,
    ledgerResult, attemptedRowIds, syncedCount, zeroAmountCount,
    failedRowIds, newlyProtectedRowIds
  };
}
