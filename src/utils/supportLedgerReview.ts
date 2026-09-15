/** Read-only comparisons. Identity and cost category are compared before totals. */
export interface LedgerCharge {
    sourceId?: string;
    recipient: string;
    recipientLabel?: string;
    category: string;
    amount: number;
    lineId: string;
}
export interface LedgerReviewSource {
    id: string;
    entityId?: string;
    startDate?: string;
    endDate?: string;
    label: string;
    amount: number;
    expected: LedgerCharge[];
    missingTarget?: boolean;
}
export interface LedgerReviewBill {
    id: string;
    label: string;
    status: string;
    teamId: string;
    workerId?: string;
    recipientType: string;
    postedAdvancePaymentId?: string;
    charges: LedgerCharge[];
    total: number;
}
export interface LedgerReviewFinding {
    label: string;
    title: string;
    detail: string;
    level: 'difference' | 'unverified' | 'pending' | 'info';
    expected?: number;
    actual?: number;
}
export const activeReviewBills = (bills: LedgerReviewBill[]) => bills.filter(b => b.status.toUpperCase() !== 'CANCELLED');
const sum = (items: { amount: number }[]) => items.reduce((value, item) => value + item.amount, 0);
const differs = (a: number, b: number) => !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) >= 1;

const categoryLabels: Record<string, string> = { accommodation: '숙소비', privateRoom: '개인방', electricity: '전기료', gas: '가스비', water: '수도료', internet: '인터넷', fines: '과태료', deposit: '보증금', gloves: '장갑', RENT: '렌트비', LEASE: '리스비', FUEL: '유류비', REPAIR: '수리비', TOLL: '통행료', FINE: '과태료', OTHER: '기타' };

export function reviewSupportLedger(sources: LedgerReviewSource[], allBills: LedgerReviewBill[]): LedgerReviewFinding[] {
    const findings: LedgerReviewFinding[] = [];
    const bills = activeReviewBills(allBills);
    const actual = bills.flatMap(b => b.charges);
    const sourceIds = new Set(sources.map(s => s.id));
    const seen = new Set<string>();
    for (const source of sources) {
        const linked = actual.filter(c => c.sourceId === source.id);
        if (source.missingTarget) findings.push({ label: source.label, level: 'unverified', title: '부담 대상 확인 필요', detail: '배정되지 않은 비용이 있습니다. 원장의 부담 대상을 확인해 주세요.' });
        if (differs(source.amount, sum(source.expected))) findings.push({ label: source.label, level: 'difference', title: '원장과 배분 금액 차이', detail: '원장 비용이 부담 대상에 모두 배분되었는지 확인해 주세요.', expected: source.amount, actual: sum(source.expected) });
        const keys = new Set([...source.expected, ...linked].map(c => JSON.stringify([c.recipient, c.category])));
        for (const key of keys) {
            const matches = (c: LedgerCharge) => JSON.stringify([c.recipient, c.category]) === key;
            const expected = sum(source.expected.filter(matches));
            const value = sum(linked.filter(matches));
            if (differs(expected, value)) findings.push({ label: source.label, level: 'difference', title: '원장과 청구 금액 차이', detail: `${[...source.expected, ...linked].find(matches)?.recipientLabel || '부담 대상'} · ${categoryLabels[JSON.parse(key)[1]] || '비용'} 금액을 확인해 주세요.`, expected, actual: value });
        }
    }
    for (const bill of bills) {
        if (differs(bill.total, sum(bill.charges))) findings.push({ label: bill.label, level: 'difference', title: '청구서 합계 차이', detail: '청구서의 항목 합계와 총액이 다릅니다.', expected: sum(bill.charges), actual: bill.total });
        for (const charge of bill.charges) {
            if (!Number.isFinite(charge.amount)) findings.push({ label: bill.label, level: 'unverified', title: '금액 형식 확인 필요', detail: '숫자로 확인할 수 없는 청구 금액이 있습니다.' });
            if (!charge.sourceId || !sourceIds.has(charge.sourceId)) {
                findings.push({ label: bill.label, level: 'unverified', title: '원장 연결 확인 필요', detail: '수기 청구 또는 현재 원장에 없는 항목입니다. 원장과 자동 대조할 수 없습니다.' });
                continue;
            }
            const key = JSON.stringify([charge.sourceId, charge.recipient, charge.lineId]);
            if (seen.has(key)) findings.push({ label: bill.label, level: 'difference', title: '중복 청구 항목', detail: '같은 원장 항목이 같은 부담 대상에 두 번 이상 청구되어 있습니다.' });
            seen.add(key);
        }
    }
    return findings;
}

export interface SavedLedgerSettlement {
    teamId: string;
    confirmed: boolean;
    deductions: { id: string; amount: number; origin: string }[];
}
export interface PostedLedgerAdvance {
    id: string;
    yearMonth: string;
    accommodationBillingDocId?: string;
    amounts: Record<string, number>;
}

export function reviewLedgerPosting(kind: 'accommodation' | 'vehicle', month: string, allBills: LedgerReviewBill[], settlements: SavedLedgerSettlement[], advances: PostedLedgerAdvance[]): LedgerReviewFinding[] {
    const findings: LedgerReviewFinding[] = [];
    const bills = activeReviewBills(allBills);
    for (const bill of bills) {
        const base = { label: bill.label };
        const draft = bill.status.trim().toUpperCase() === 'DRAFT';
        const pending: LedgerReviewFinding = { ...base, level: 'pending', title: '청구 확정 대기', detail: '작성 중인 청구입니다. 금액과 부담 대상을 검토한 뒤 확정하고 정산 또는 개인 공제 반영 여부를 확인해 주세요.' };
        if (bill.teamId === '__office__' || bill.teamId === '__office_staff__') {
            findings.push({ ...base, level: 'info', title: '사무실 부담', detail: '사무실 부담 비용으로 분류되어 있습니다.' });
            continue;
        }
        if (bill.recipientType === 'worker') {
            if (kind === 'vehicle') {
                if (draft) { findings.push(pending); continue; }
                findings.push({ ...base, level: 'unverified', title: '개인 차량비 반영 확인 필요', detail: '개인 공제와 연결된 기록이 없어 자동 대조할 수 없습니다.' });
                continue;
            }
            const matches = advances.filter(a => a.yearMonth === month && a.id === bill.postedAdvancePaymentId && a.accommodationBillingDocId === bill.id);
            if (matches.length !== 1) {
                if (draft && !bill.postedAdvancePaymentId && !advances.some(a => a.yearMonth === month && a.accommodationBillingDocId === bill.id)) { findings.push(pending); continue; }
                findings.push({ ...base, level: 'unverified', title: '개인 공제 연결 확인 필요', detail: '청구서와 연결된 개인 공제 기록을 한 건으로 확인할 수 없습니다. 청구 확정 및 공제 반영 상태를 확인해 주세요.' });
                continue;
            }
            const categories = new Set(bill.charges.map(c => c.category));
            for (const category of categories) {
                const expected = sum(bill.charges.filter(c => c.category === category));
                const actual = matches[0].amounts[category] ?? 0;
                if (differs(expected, actual)) findings.push({ ...base, level: 'difference', title: '청구와 개인 공제 차이', detail: `${categoryLabels[category] || '비용'} 항목의 청구와 개인 공제 금액이 다릅니다.`, expected, actual });
            }
            continue;
        }
        if (!['team', 'team_leader'].includes(bill.recipientType) || !bill.teamId) {
            findings.push({ ...base, level: 'unverified', title: '정산 대상 확인 필요', detail: '팀 또는 개인 부담 정보를 확인해 주세요.' });
            continue;
        }
        const docs = settlements.filter(s => s.teamId === bill.teamId);
        const id = `${kind}_billing:${month}:${bill.id}`;
        const linked = docs.flatMap(s => s.deductions.filter(d => d.id === id && d.origin === `${kind}_billing`));
        if (linked.length !== 1) {
            if (draft && linked.length === 0 && !settlements.some(s => s.deductions.some(d => d.id === id))) { findings.push(pending); continue; }
            findings.push({ ...base, level: linked.length > 1 ? 'difference' : 'unverified', title: linked.length > 1 ? '정산 중복 반영' : '정산 반영 확인 필요', detail: '청구서 번호로 연결된 저장 정산을 한 건으로 확인할 수 없습니다. 미확정 청구나 구 방식의 원장 합산 정산은 정산 화면에서 확인해 주세요.' });
        } else if (differs(bill.total, linked[0].amount)) {
            findings.push({ ...base, level: 'difference', title: '청구와 저장 정산 차이', detail: docs.some(d => d.confirmed) ? '확정 당시 금액과 현재 청구 금액이 다릅니다. 확정본을 확인해 주세요.' : '저장된 정산 금액이 현재 청구 금액과 다릅니다.', expected: bill.total, actual: linked[0].amount });
        }
    }
    for (const settlement of settlements) for (const item of settlement.deductions) {
        if (item.origin !== `${kind}_billing`) continue;
        const prefix = `${kind}_billing:${month}:`;
        if (!item.id.startsWith(prefix) || !bills.some(b => item.id === prefix + b.id && b.teamId === settlement.teamId)) findings.push({ label: '저장 정산', level: 'unverified', title: '정산의 원본 청구 확인 필요', detail: '원장 합산 방식이거나 현재 유효한 청구서와 연결되지 않는 정산 항목이 있습니다.' });
    }
    return findings;
}
