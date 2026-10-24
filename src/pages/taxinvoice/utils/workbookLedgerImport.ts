import type { WorkbookLedgerEntry } from '../../../services/workbookLedgerService';
import { createWorkbookImportDuplicateFingerprint, normalizePartnerMatchKey, normalizeText, WorkbookImportEntry } from '../WorkbookLedgerModel';

const contentKey = (entry: WorkbookImportEntry) => JSON.stringify([
    entry.transactionType, entry.date, entry.partnerName, entry.siteName, entry.description,
    entry.supplyAmount, entry.taxAmount, entry.totalAmount, entry.paymentAmount,
    entry.manDays ?? null, entry.appliedYear ?? null, entry.appliedMonth ?? null,
    entry.note ?? '', entry.teamName ?? '', entry.sourceType ?? '', entry.sourceMonth ?? '',
]);

// Backup IDs identify records; newly allocated IDs keep uploads from overwriting live records.
// importedFromId makes a partially completed upload recognizable on the next attempt.
export const prepareWorkbookImportEntries = (
    imported: WorkbookImportEntry[], existing: WorkbookLedgerEntry[], createId: () => string,
) => {
    const byId = new Map<string, WorkbookLedgerEntry>();
    const idMap = new Map<string, string>();
    const byFingerprint = new Map<string, WorkbookLedgerEntry[]>();
    existing.forEach((entry) => {
        if (!entry.id) return;
        byId.set(entry.id, entry);
        idMap.set(entry.id, entry.id);
        if (entry.importedFromId) idMap.set(entry.importedFromId, entry.id);
        const key = createWorkbookImportDuplicateFingerprint(entry);
        if (key) byFingerprint.set(key, [...(byFingerprint.get(key) ?? []), entry]);
    });
    const newEntries: WorkbookImportEntry[] = [];
    const duplicateEntries: WorkbookImportEntry[] = [];
    const duplicatePairs: Array<[WorkbookImportEntry, WorkbookLedgerEntry]> = [];
    imported.forEach((entry) => {
        const originalId = normalizeText(entry.id);
        const previous = originalId ? byId.get(idMap.get(originalId) ?? '') : undefined;
        if (previous) {
            if (contentKey(previous) !== contentKey(entry)) {
                throw new Error('같은 거래ID의 내용이 기존 장부 또는 파일 내 다른 행과 다릅니다. 원본을 확인해 주세요.');
            }
            duplicateEntries.push(entry);
            duplicatePairs.push([entry, previous]);
            return;
        }
        const fingerprint = createWorkbookImportDuplicateFingerprint(entry);
        // Legacy files have no record IDs. Keep their existing duplicate-review policy.
        const legacyMatches = !originalId && fingerprint ? byFingerprint.get(fingerprint) ?? [] : [];
        if (legacyMatches.length) {
            duplicateEntries.push(entry);
            return;
        }
        const staged = { ...entry, id: createId(), importedFromId: originalId || undefined };
        if (byId.has(staged.id)) throw new Error('새 거래ID가 중복되었습니다. 다시 시도해 주세요.');
        newEntries.push(staged);
        byId.set(staged.id, staged);
        if (originalId) idMap.set(originalId, staged.id);
        idMap.set(staged.id, staged.id);
        if (fingerprint) byFingerprint.set(fingerprint, [...(byFingerprint.get(fingerprint) ?? []), staged]);
    });
    const resolveInvoice = (reference: string, entry: WorkbookImportEntry) => {
        const targetId = idMap.get(reference);
        const target = targetId ? byId.get(targetId) : undefined;
        if (!target || target.totalAmount <= 0 || target.transactionType !== entry.transactionType
            || normalizePartnerMatchKey(target.partnerName) !== normalizePartnerMatchKey(entry.partnerName)) {
            throw new Error('입금·취소·선수금의 연결 원본을 확인할 수 없습니다. 거래ID가 포함된 전체 DB 파일을 사용해 주세요.');
        }
        return target.id!;
    };
    newEntries.forEach((entry) => {
        if (entry.matchedEntryId) entry.matchedEntryId = resolveInvoice(entry.matchedEntryId, entry);
        if (entry.sourceType === 'advanceUsage') {
            if (!entry.sourceId || !entry.matchedEntryId) throw new Error('선수금 사용 행에 연결 정보가 없습니다.');
            entry.sourceId = resolveInvoice(entry.sourceId, entry);
            if (entry.sourceId === entry.matchedEntryId) throw new Error('선수금을 같은 거래에 사용할 수 없습니다.');
        }
    });
    duplicatePairs.forEach(([incoming, previous]) => {
        const matchedId = incoming.matchedEntryId ? resolveInvoice(incoming.matchedEntryId, incoming) : '';
        const sourceId = incoming.sourceType === 'advanceUsage' && incoming.sourceId
            ? resolveInvoice(incoming.sourceId, incoming) : incoming.sourceId ?? '';
        if (matchedId !== (previous.matchedEntryId ?? '') || sourceId !== (previous.sourceId ?? '')) {
            throw new Error('같은 거래ID의 연결 정보가 기존 장부와 다릅니다. 연결 원본을 확인해 주세요.');
        }
    });
    return { newEntries, duplicateEntries };
};
