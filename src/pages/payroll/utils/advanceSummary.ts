import type { AdvancePayment } from '../../../services/advancePaymentService';
import type { Worker } from '../../../services/manpowerService';
import { normalizeAdvancePaymentDepositAccount, type AdvancePaymentDepositAccount } from '../../../types/advancePaymentDepositAccount';
import { ADVANCE_ITEM_LABEL_KEYS, type AdvanceItemLabelKey } from '../../../services/payrollConfigService';

export type AdvanceSummaryFilter = 'all' | 'corporate' | 'labor' | AdvanceItemLabelKey;
export type AdvanceSummaryWorker = Pick<Worker, 'id' | 'legacyId' | 'bankName' | 'accountNumber' | 'accountHolder'>;
export interface AdvanceSummaryTeam {
    id: string;
    legacyId?: string | null;
    name: string;
    color?: string | null;
}
export interface AdvanceSummaryRow {
    key: string;
    workerId: string;
    workerName: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    amount: number;
    corporate: number;
    labor: number;
    items: Partial<Record<AdvanceItemLabelKey, number>>;
    memos: string[];
    memoSources: { id: string; memo: string; salaryModel: string }[];
    depositAccountSources: { id: string; depositAccount: AdvancePaymentDepositAccount }[];
}
export interface AdvanceSummaryGroup {
    team: AdvanceSummaryTeam;
    rows: AdvanceSummaryRow[];
    total: number;
}

export const isAdvanceSummaryMonth = (value: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
export const isAdvanceSummaryFilter = (value: string): value is AdvanceSummaryFilter =>
    ['all', 'corporate', 'labor', ...ADVANCE_ITEM_LABEL_KEYS].includes(value);

/** Only explicit advance items belong to this report; totalDeduction includes unrelated charges. */
export function buildAdvanceSummary(
    payments: AdvancePayment[],
    teams: AdvanceSummaryTeam[],
    filters: { yearMonth: string; teamId: string; item: AdvanceSummaryFilter; query: string },
    workers: AdvanceSummaryWorker[] = [],
) {
    const workerById = new Map(workers.filter(worker => worker.id).map(worker => [worker.id!, worker]));
    const workerByLegacyId = new Map<string, AdvanceSummaryWorker | null>();
    workers.forEach(worker => {
        if (!worker.legacyId) return;
        // Ambiguous legacy IDs must not attach another worker's bank account.
        workerByLegacyId.set(worker.legacyId, workerByLegacyId.has(worker.legacyId) ? null : worker);
    });
    const teamById = new Map<string, AdvanceSummaryTeam>();
    teams.forEach(team => {
        teamById.set(team.id, team);
        if (team.legacyId) teamById.set(team.legacyId, team);
    });
    const selectedTeam = teamById.get(filters.teamId);
    const keys = ADVANCE_ITEM_LABEL_KEYS.filter(key => filters.item === 'all'
        || key === filters.item || key.startsWith(`${filters.item}Advance`));
    const query = filters.query.trim().toLocaleLowerCase('ko-KR');
    const grouped = new Map<string, { team: AdvanceSummaryTeam; rows: Map<string, AdvanceSummaryRow> }>();

    payments.forEach((payment, index) => {
        if (payment.yearMonth !== filters.yearMonth) return;
        const team = teamById.get(payment.teamId);
        // Use the same construction-company team scope as the entry screen, including legacy IDs.
        if (!team || (filters.teamId && team.id !== selectedTeam?.id)) return;
        const workerKey = payment.workerId || payment.id || `record-${index}`;
        let group = grouped.get(team.id);
        if (!group) {
            group = { team, rows: new Map() };
            grouped.set(team.id, group);
        }
        let row = group.rows.get(workerKey);
        if (!row) {
            const worker = workerById.get(payment.workerId) || workerByLegacyId.get(payment.workerId);
            row = { key: workerKey, workerId: payment.workerId, workerName: payment.workerName || '이름 미등록',
                bankName: worker?.bankName?.trim() || '', accountNumber: worker?.accountNumber?.trim() || '',
                accountHolder: worker?.accountHolder?.trim() || '',
                amount: 0, corporate: 0, labor: 0, items: {}, memos: [], memoSources: [], depositAccountSources: [] };
            group.rows.set(workerKey, row);
        }
        keys.forEach(key => {
            const value = Number(String(payment.items?.[key] ?? 0).replace(/,/g, ''));
            const amount = Number.isFinite(value) ? value : 0;
            row!.items[key] = (row!.items[key] ?? 0) + amount;
            row!.amount += amount;
            if (key.startsWith('corporate')) row!.corporate += amount;
            else row!.labor += amount;
        });
        const memo = payment.memo?.trim();
        if (memo && !row.memos.includes(memo)) row.memos.push(memo);
        row.memoSources.push({ id: payment.id || '', memo: payment.memo ?? '', salaryModel: payment.salaryModel || '급여 구분 없음' });
        row.depositAccountSources.push({ id: payment.id || '', depositAccount: normalizeAdvancePaymentDepositAccount(payment.depositAccount) });
    });

    const groups: AdvanceSummaryGroup[] = Array.from(grouped.values()).map(({ team, rows }) => {
        const visibleRows = Array.from(rows.values()).filter(row =>
            // Keep offsetting entries visible even when the net advance is zero.
            Object.values(row.items).some(value => value !== 0)
            && (!query || `${row.workerName} ${team.name} ${row.memos.join(' ')}`.toLocaleLowerCase('ko-KR').includes(query)));
        visibleRows.sort((a, b) => a.workerName.localeCompare(b.workerName, 'ko') || a.key.localeCompare(b.key));
        return { team, rows: visibleRows, total: visibleRows.reduce((sum, row) => sum + row.amount, 0) };
    }).filter(group => group.rows.length > 0).sort((a, b) => a.team.name.localeCompare(b.team.name, 'ko'));
    const rows = groups.flatMap(group => group.rows);
    return {
        groups,
        total: rows.reduce((sum, row) => sum + row.amount, 0),
        corporate: rows.reduce((sum, row) => sum + row.corporate, 0),
        labor: rows.reduce((sum, row) => sum + row.labor, 0),
        workerCount: new Set(groups.flatMap(group => group.rows.map(row => row.workerId || `${group.team.id}/${row.key}`))).size,
    };
}
