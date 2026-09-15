import { AccommodationBillingDocument } from '../types/accommodationBilling';
import { VehicleBillingDocument } from '../types/vehicleBilling';
import { LedgerReviewBill } from './supportLedgerReview';
import { isOfficeAssignmentReference, OFFICE_ASSIGNMENT_TEAM_ID } from './supportAssignmentTargets';

export const ledgerRecipientKey = (type: string, teamId: string, workerId?: string) => JSON.stringify([type === 'team_leader' ? 'team' : type, teamId, type === 'worker' ? workerId || '' : '']);

export function accommodationReviewBill(doc: AccommodationBillingDocument, sourceForLine: (line: AccommodationBillingDocument['lineItems'][number]) => string | undefined): LedgerReviewBill {
    const teamId = isOfficeAssignmentReference(doc.teamId, doc.teamName) ? OFFICE_ASSIGNMENT_TEAM_ID : doc.teamId;
    const charges = doc.lineItems.filter(line => line.status !== 'cancelled' && !line.cancelledAt).map(line => ({ sourceId: sourceForLine(line), recipient: ledgerRecipientKey(doc.issuedToType, teamId, doc.issuedToWorkerId), recipientLabel: doc.issuedToWorkerName || doc.teamName, category: line.targetField, amount: line.amount, lineId: line.id }));
    return { id: doc.id, label: doc.issuedToWorkerName || doc.teamName || '숙소 청구', status: doc.status, teamId, workerId: doc.issuedToWorkerId, recipientType: doc.issuedToType, postedAdvancePaymentId: doc.postedAdvancePaymentId, charges, total: charges.reduce((sum, c) => sum + c.amount, 0) };
}
export function vehicleReviewBill(doc: VehicleBillingDocument, sourceForLine: (line: VehicleBillingDocument['lineItems'][number]) => string | undefined): LedgerReviewBill {
    const teamId = doc.teamId || doc.assignedTeamId || '';
    return { id: doc.id, label: `${doc.vehiclePlate} · ${doc.issuedToWorkerName || doc.teamName || '부담 대상 미지정'}`, status: doc.status, teamId, workerId: doc.issuedToWorkerId, recipientType: doc.issuedToType || '', total: doc.totalAmount, charges: doc.lineItems.map(line => ({ sourceId: sourceForLine(line), recipient: ledgerRecipientKey(doc.issuedToType || '', teamId, doc.issuedToWorkerId), recipientLabel: doc.issuedToWorkerName || doc.teamName, category: line.category || line.type, amount: line.amount, lineId: line.id })) };
}
