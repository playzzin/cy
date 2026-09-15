import { listSystemConfigs, listAllAdvancePayments, listAllUtilityRecords, listAllVehicleExpenses } from './firestoreCrudCompat';
import { TeamSettlementDocumentSchema } from '../types/teamSettlement';
import { LedgerReviewBill, LedgerReviewFinding, LedgerReviewSource, PostedLedgerAdvance, reviewLedgerPosting, SavedLedgerSettlement } from '../utils/supportLedgerReview';
import { reviewLedgerSourceCoverage } from '../utils/supportLedgerCoverage';

// Use raw saved records: getTeamSettlement can calculate and save on read.
export async function reviewSavedLedgerPosting(kind: 'accommodation' | 'vehicle', month: string, bills: LedgerReviewBill[], sources: LedgerReviewSource[] = []): Promise<LedgerReviewFinding[]> {
    const [configs, payments, sourceResponse] = await Promise.all([
        listSystemConfigs({ limit: Number.MAX_SAFE_INTEGER, offset: 0 }),
        kind === 'accommodation' ? listAllAdvancePayments({ limit: Number.MAX_SAFE_INTEGER, offset: 0 }) : Promise.resolve({ data: { advancePayments: [] } }),
        kind === 'accommodation' ? listAllUtilityRecords({ limit: Number.MAX_SAFE_INTEGER, offset: 0 }) : listAllVehicleExpenses({ limit: Number.MAX_SAFE_INTEGER, offset: 0 }),
    ]);
    const settlements: SavedLedgerSettlement[] = [];
    const malformed: LedgerReviewFinding[] = [];
    for (const row of configs.data.systemConfigs) {
        if (!String(row.id).startsWith(`team_settlement_${month}`)) continue;
        try {
            const parsed = TeamSettlementDocumentSchema.parse(typeof row.data === 'string' ? JSON.parse(row.data) : row.data);
            if (parsed.yearMonth === month) settlements.push({ teamId: parsed.teamId, confirmed: Boolean(parsed.confirmedAt), deductions: parsed.deductions });
        } catch {
            malformed.push({ label: '저장 정산', level: 'unverified', title: '정산 자료 형식 확인 필요', detail: '일부 저장 정산을 읽을 수 없어 대조하지 못했습니다.' });
        }
    }
    const fields = ['accommodation', 'privateRoom', 'electricity', 'gas', 'water', 'internet', 'fines', 'deposit', 'gloves'];
    const advances: PostedLedgerAdvance[] = payments.data.advancePayments.map((row: Record<string, unknown>) => ({
        id: String(row.id ?? ''), yearMonth: String(row.yearMonth ?? ''), accommodationBillingDocId: String(row.accommodationBillingDocId ?? ''),
        amounts: Object.fromEntries(fields.map(field => [field, Number(row[field] ?? 0)])),
    }));
    const sourceRows = kind === 'accommodation' ? sourceResponse.data.utilityRecords : sourceResponse.data.vehicleExpenses;
    return [...malformed, ...reviewLedgerSourceCoverage(kind, month, sources, sourceRows), ...reviewLedgerPosting(kind, month, bills, settlements, advances)];
}
