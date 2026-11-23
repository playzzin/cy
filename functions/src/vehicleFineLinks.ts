import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

export type FineExpense = Record<string, any> & { id: string };
const active = (row: FineExpense) => row.status !== 'CANCELLED' && !row.cancelledAt;
const safe = (value: string) => value.trim().replace(/[/#[\]?]/g, '_').replace(/\s+/g, '_').replace(/[^0-9A-Za-z가-힣_.:-]/g, '_') || 'blank';
export function fineLedgerPeriod(row: FineExpense): { start: string; end: string } | null {
    const parts = row.id.split('__');
    if (parts.length !== 7 || parts[0] !== 'vehicle-ledger' || parts[2] !== safe(String(row.vehicleId || ''))
        || parts[5] !== 'FINE' || parts[6] !== (row.fineChargeTarget || 'BILLING_TARGET')
        || !/^\d{4}-\d{2}$/.test(parts[1]) || !/^\d{4}-\d{2}-\d{2}$/.test(parts[3])
        || !/^\d{4}-\d{2}-\d{2}$/.test(parts[4]) || !parts[3].startsWith(parts[1] + '-')
        || !parts[4].startsWith(parts[1] + '-') || parts[3] > parts[4] || row.date !== parts[3]) return null;
    return { start: parts[3], end: parts[4] };
}

export function sourceBelongsToFine(anchor: FineExpense, source: FineExpense, explicit: boolean): boolean {
    const period = fineLedgerPeriod(anchor);
    if (!period || source.type !== 'FINE' || !source.fineNotice || source.vehicleId !== anchor.vehicleId
        || source.date < period.start || source.date > period.end) return false;
    // Explicit links are persisted by the ledger writer. Legacy recovery requires
    // the exact monthly replacement operation, never an arbitrary cancelled row.
    if (explicit) return true;
    return !active(source) && source.lastOperationId === anchor.lastOperationId
        && source.lastOperationId === `vehicle-monthly-ledger:${anchor.date.slice(0, 7)}`;
}

/** Read provenance only. Archived source rows never become payable expenses again. */
export async function loadFineNoticeLinks(ids: string[]) {
    const db = admin.firestore();
    const anchors = await db.getAll(...ids.map(id => db.collection('vehicleExpenses').doc(id)));
    const operationCache = new Map<string, FineExpense[]>();
    const items: Array<{ expenseId: string; anchor: FineExpense; notices: FineExpense[] }> = [];
    for (const snapshot of anchors) {
        const anchor: FineExpense = { ...snapshot.data(), id: snapshot.id };
        if (!snapshot.exists || anchor.type !== 'FINE' || !active(anchor)) {
            throw new functions.https.HttpsError('not-found', '과태료 내역이 변경되었습니다. 대장을 새로고침해 주세요.');
        }
        let notices: FineExpense[] = [];
        if (anchor.fineNotice) notices = [anchor];
        else if (fineLedgerPeriod(anchor)) {
            const explicit = Object.prototype.hasOwnProperty.call(anchor, 'fineSourceExpenseIds');
            if (explicit) {
                const refs = anchor.fineSourceExpenseIds;
                if (!Array.isArray(refs) || refs.length > 200 || refs.some(id => typeof id !== 'string' || !id || id.includes('/') || id.length > 200)) {
                    throw new functions.https.HttpsError('failed-precondition', '고지서 연결 정보를 확인해 주세요.');
                }
                const unique = Array.from(new Set<string>(refs));
                if (unique.length) notices = (await db.getAll(...unique.map(id => db.collection('vehicleExpenses').doc(id))))
                    .filter(doc => doc.exists).map(doc => ({ ...doc.data(), id: doc.id }))
                    .filter(source => sourceBelongsToFine(anchor, source, true));
            } else if (anchor.lastOperationId === `vehicle-monthly-ledger:${anchor.date.slice(0, 7)}`) {
                const op = anchor.lastOperationId as string;
                if (!operationCache.has(op)) {
                    const result = await db.collection('vehicleExpenses').where('lastOperationId', '==', op).limit(2000).get();
                    if (result.size === 2000) throw new functions.https.HttpsError('resource-exhausted', '연결할 고지서 내역을 확인해 주세요.');
                    operationCache.set(op, result.docs.map(doc => ({ ...doc.data(), id: doc.id })));
                }
                const candidates = operationCache.get(op)!;
                notices = candidates.filter(source => sourceBelongsToFine(anchor, source, false)
                    && candidates.filter(other => active(other) && other.type === 'FINE' && sourceBelongsToFine(other, source, false)).length === 1);
            }
        }
        items.push({ expenseId: anchor.id, anchor, notices: notices.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id.localeCompare(b.id)) });
    }
    return items;
}

const noticeKeys = ['attachmentRemoved', 'sourceFileName', 'sourceSha256', 'issuer', 'noticeType', 'extractedLicensePlate', 'violationDateTime',
    'violationLocation', 'violationDescription', 'dueDate', 'noticeNumber', 'electronicPaymentNumber', 'originalAmount', 'reductionAmount',
    'payableAmount', 'driverPenaltyAmount', 'ownerFineAmount', 'confidence', 'warnings', 'dedupeKey', 'manualMatch'];
export function publicFineNotice(source: FineExpense, anchorId: string) {
    return { id: source.id, vehicleId: source.vehicleId, vehiclePlate: source.vehiclePlate || '', date: source.date,
        type: 'FINE', amount: Number(source.amount) || 0, payer: source.payer || 'COMPANY',
        ...(anchorId !== source.id ? { attachmentExpenseId: anchorId } : {}),
        fineNotice: Object.fromEntries(noticeKeys.filter(key => source.fineNotice[key] !== undefined).map(key => [key, source.fineNotice[key]])) };
}
