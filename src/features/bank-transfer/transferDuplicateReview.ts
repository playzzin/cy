import type { TransferDraft, TransferRow } from './types';

const originKey = (row: TransferRow) => row.source !== 'account' && row.period && row.sourceId
    ? JSON.stringify([row.source, row.period, row.sourceId, row.category]) : undefined;
const accountAmountKey = (row: TransferRow) => row.amount > 0 && row.bankCode.trim() && row.accountNumber.trim()
    ? JSON.stringify([row.bankCode.trim(), row.accountNumber.replace(/[\s-]/g, ''), row.amount]) : undefined;
type Reference = { draft: TransferDraft; row: TransferRow };

export function reviewOtherDrafts(rows: TransferRow[], draftId: string, drafts: TransferDraft[]) {
    const origins = new Map<string, Reference[]>(), accounts = new Map<string, Reference[]>();
    const append = (index: Map<string, Reference[]>, key: string | undefined, entry: Reference) => {
        if (!key) return;
        const previous = index.get(key); if (previous) previous.push(entry); else index.set(key, [entry]);
    };
    drafts.filter(draft => draft.id !== draftId).forEach(draft => draft.rows.forEach(row => {
        const ref = { draft, row }; append(origins, originKey(row), ref); append(accounts, accountAmountKey(row), ref);
    }));
    const notes = new Map<string, string[]>();
    rows.forEach(row => {
        const matches = new Map<string, { reference: Reference; reason: string }>();
        (origins.get(originKey(row) ?? '') ?? []).forEach(reference => matches.set(reference.draft.id, {
            reference, reason: reference.row.id === row.id ? '같은 지급 항목' : '같은 원본의 다른 금액 기준',
        }));
        (accounts.get(accountAmountKey(row) ?? '') ?? []).filter(reference => !row.period || !reference.row.period || row.period === reference.row.period).forEach(reference => {
            if (!matches.has(reference.draft.id)) matches.set(reference.draft.id, { reference, reason: '동일 계좌·금액' });
        });
        const values = [...matches.values()];
        const descriptions = values.slice(0, 3).map(({ reference, reason }) => `다른 저장 목록 ‘${reference.draft.title}’에 ${reason} 있음${reference.draft.exportHistory?.length ? ' (해당 목록에 파일 생성 이력 있음)' : ''}`);
        if (values.length > 3) descriptions.push(`그 외 ${values.length - 3}개 저장 목록에도 유사 항목이 있습니다.`);
        notes.set(row.rowId, descriptions);
    });
    return notes;
}

/** Different payroll amount bases can overlap even when the destination account differs. */
export function reviewCurrentOrigins(rows: TransferRow[]): Set<string> {
    const byOrigin = new Map<string, TransferRow[]>();
    rows.forEach(row => { const key = originKey(row); if (key) { const group = byOrigin.get(key); if (group) group.push(row); else byOrigin.set(key, [row]); } });
    return new Set([...byOrigin.values()].filter(group => group.length > 1).flatMap(group => group.map(row => row.rowId)));
}
