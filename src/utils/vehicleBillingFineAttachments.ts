import type { VehicleExpenseRecord } from '../types/vehicle';
import type { VehicleBillingDocument } from '../types/vehicleBilling';
import { normalizeVehicleExpenseType } from './vehicleExpenseType';

/** Match only the expenses referenced by this bill, never every fine for a vehicle. */
export function getVehicleBillingFineExpenses(doc: VehicleBillingDocument, expenses: VehicleExpenseRecord[]): VehicleExpenseRecord[] {
  const expenseIds = new Set(expenses.map(expense => expense.id));
  const lines = (doc.lineItems || []).filter(line => line.sourceType !== 'manual' && normalizeVehicleExpenseType(line.category, line.label, line.id) === 'FINE');
  return expenses.filter(expense => {
    if (!expense.fineNotice?.sourceSha256?.trim() || expense.fineNotice.attachmentRemoved || expense.status === 'CANCELLED' || expense.cancelledAt || expense.date.slice(0, 7) !== doc.yearMonth) return false;
    if (doc.vehicleId ? expense.vehicleId !== doc.vehicleId : !doc.vehiclePlate || expense.vehiclePlate !== doc.vehiclePlate) return false;
    if (normalizeVehicleExpenseType(expense.type, expense.note, expense.id) !== 'FINE') return false;
    return lines.some(line => {
      const directIds = [line.id, line.sourceLedgerRowId].filter((id): id is string => !!id && expenseIds.has(id));
      if (directIds.length) return directIds.includes(expense.id);
      if (!line.sourceSegmentId || !line.sourceStartDate || !line.sourceEndDate) return false;
      if (expense.fineChargeTarget === 'DRIVER') {
        if (doc.issuedToType !== 'worker') return false;
        const target = expense.fineDriverBillingTarget;
        if (target?.workerId && target.workerId !== doc.issuedToWorkerId) return false;
      }
      return expense.date >= line.sourceStartDate && expense.date <= line.sourceEndDate;
    });
  }).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
