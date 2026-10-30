import type { AdvanceRequest } from '../../../services/advanceRequestService';
import type { Worker } from '../../../services/manpowerService';
import { normalizeAdvancePaymentDepositAccount, type AdvancePaymentDepositAccount, type AdvanceDepositAccountCategory } from '../../../types/advancePaymentDepositAccount';
import { ADVANCE_REQUEST_CATEGORIES, ADVANCE_REQUEST_CATEGORY_LABELS, getAdvanceRequestCategory, type AdvanceRequestCategory } from '../../../types/advanceRequestCategory';

export type AdvanceSummaryFilter = 'all' | AdvanceRequestCategory;
export type AdvanceSummaryWorker = Pick<Worker, 'id' | 'legacyId' | 'bankName' | 'accountNumber' | 'accountHolder'> & Partial<Pick<Worker, 'name' | 'teamId' | 'teamName'>>;
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
    items: Partial<Record<AdvanceRequestCategory, number>>;
    depositAmounts: Record<AdvanceDepositAccountCategory | 'unclassified', number>;
    memos: string[];
    memoSources: { id: string; memo: string; label: string }[];
    depositAccountSources: { id: string; depositAccount: AdvancePaymentDepositAccount }[];
}
export interface AdvanceSummaryGroup {
    team: AdvanceSummaryTeam;
    rows: AdvanceSummaryRow[];
    total: number;
}

export const isAdvanceSummaryMonth = (value: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
export const isAdvanceSummaryFilter = (value: string): value is AdvanceSummaryFilter =>
    ['all', ...ADVANCE_REQUEST_CATEGORIES, 'unclassified'].includes(value);

/** Report submitted amounts, never the deduction ledger or the available-amount snapshots. */
export function buildAdvanceSummary(
    requests: AdvanceRequest[],
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
    const query = filters.query.trim().toLocaleLowerCase('ko-KR');
    const grouped = new Map<string, { team: AdvanceSummaryTeam; rows: Map<string, AdvanceSummaryRow> }>();

    requests.forEach((request, index) => {
        if (request.yearMonth !== filters.yearMonth || !['requested', 'approved', 'paid'].includes(request.status)) return;
        const category = getAdvanceRequestCategory(request);
        if (filters.item !== 'all' && filters.item !== category) return;
        const amount = Number(String(request.requestedAmount ?? 0).replace(/,/g, ''));
        if (!Number.isSafeInteger(amount) || amount <= 0) return;
        const team = teamById.get(request.teamId || '');
        // Preserve the construction-company team scope, including historical team IDs.
        if (!team || (filters.teamId && team.id !== selectedTeam?.id)) return;
        const worker = workerById.get(request.workerId) || workerByLegacyId.get(request.workerId);
        const workerKey = worker?.id || request.workerId || request.id || `record-${index}`;
        let group = grouped.get(team.id);
        if (!group) {
            group = { team, rows: new Map() };
            grouped.set(team.id, group);
        }
        let row = group.rows.get(workerKey);
        if (!row) {
            row = { key: workerKey, workerId: worker?.id || request.workerId, workerName: request.workerName || '이름 미등록',
                bankName: worker?.bankName?.trim() || '', accountNumber: worker?.accountNumber?.trim() || '',
                accountHolder: worker?.accountHolder?.trim() || '',
                amount: 0, items: {}, depositAmounts: { corporate: 0, personal: 0, other: 0, unclassified: 0 }, memos: [], memoSources: [], depositAccountSources: [] };
            group.rows.set(workerKey, row);
        }
        row.items[category] = (row.items[category] ?? 0) + amount;
        row.amount += amount;
        const memo = request.memo?.trim();
        if (memo && !row.memos.includes(memo)) row.memos.push(memo);
        row.memoSources.push({ id: request.id || '', memo: request.memo ?? '', label: ADVANCE_REQUEST_CATEGORY_LABELS[category] });
        const depositAccount = normalizeAdvancePaymentDepositAccount(request.depositAccount);
        const depositCategory = depositAccount === 'corporate' || depositAccount === 'personal' || depositAccount === 'other' ? depositAccount : 'unclassified';
        row.depositAmounts[depositCategory] += amount;
        row.depositAccountSources.push({ id: request.id || '', depositAccount });
    });

    const groups: AdvanceSummaryGroup[] = Array.from(grouped.values()).map(({ team, rows }) => {
        const visibleRows = Array.from(rows.values()).filter(row =>
            !query || `${row.workerName} ${team.name} ${row.memos.join(' ')}`.toLocaleLowerCase('ko-KR').includes(query));
        visibleRows.sort((a, b) => a.workerName.localeCompare(b.workerName, 'ko') || a.key.localeCompare(b.key));
        return { team, rows: visibleRows, total: visibleRows.reduce((sum, row) => sum + row.amount, 0) };
    }).filter(group => group.rows.length > 0).sort((a, b) => a.team.name.localeCompare(b.team.name, 'ko'));
    const rows = groups.flatMap(group => group.rows);
    return {
        groups,
        total: rows.reduce((sum, row) => sum + row.amount, 0),
        first: rows.reduce((sum, row) => sum + (row.items.first || 0), 0),
        second: rows.reduce((sum, row) => sum + (row.items.second || 0), 0),
        other: rows.reduce((sum, row) => sum + (row.items.other || 0), 0),
        unclassified: rows.reduce((sum, row) => sum + (row.items.unclassified || 0), 0),
        depositTotals: rows.reduce((totals, row) => ({
            corporate: totals.corporate + row.depositAmounts.corporate,
            personal: totals.personal + row.depositAmounts.personal,
            other: totals.other + row.depositAmounts.other,
            unclassified: totals.unclassified + row.depositAmounts.unclassified,
        }), { corporate: 0, personal: 0, other: 0, unclassified: 0 }),
        workerCount: new Set(groups.flatMap(group => group.rows.map(row => row.workerId || `${group.team.id}/${row.key}`))).size,
    };
}
