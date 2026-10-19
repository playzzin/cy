import type { VehicleExpenseRecord } from '../../types/vehicle';
import { isValidRepairAmount, isValidRepairDate, matchRepairVehicles, RepairRecord, repairTotal } from './model';

const PREFIX = 'repair-ledger-source:';
export const isRepairLedgerExpense = (expense: Pick<VehicleExpenseRecord, 'id'>) => expense.id.startsWith(PREFIX);

// Read through to the original repair records: no duplicate financial documents.
export function repairLedgerExpenses(records: RepairRecord[], vehicles: Array<{ id: string; licensePlate: string }>, month: string): VehicleExpenseRecord[] {
  return matchRepairVehicles(records, vehicles).flatMap(row => {
    // Historical workbook rows already have separately entered monthly expenses.
    // Only directly registered repairs are new expense sources; never double-charge imports.
    if (row.source) return [];
    if (row.archived || !row.vehicleId || !isValidRepairDate(row.date) || row.date.slice(0, 7) !== month) return [];
    if (Object.values(row.costs).some(amount => amount !== null && !isValidRepairAmount(amount))) return [];
    const amount = repairTotal(row);
    if (amount <= 0) return [];
    return [{ id: `${PREFIX}${row.id}`, vehicleId: row.vehicleId, vehiclePlate: row.vehiclePlate,
      date: row.date, type: 'REPAIR' as const, amount, payer: 'COMPANY' as const, status: 'ACTIVE' as const }];
  });
}
