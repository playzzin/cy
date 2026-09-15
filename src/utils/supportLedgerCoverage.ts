import { LedgerReviewFinding, LedgerReviewSource } from './supportLedgerReview';
import { normalizeVehicleExpenseType } from './vehicleExpenseType';

/** Includes saved costs that the current master/assignment filters can hide. */
export function reviewLedgerSourceCoverage(kind: 'accommodation' | 'vehicle', month: string, sources: LedgerReviewSource[], records: Record<string, any>[]): LedgerReviewFinding[] {
    const findings: LedgerReviewFinding[] = [];
    const saved = records.filter(row => kind === 'accommodation' ? row.yearMonth === month : (String(row.date || '').startsWith(month + '-') || row.yearMonth === month));
    const active = saved.filter(row => String(row.status || '').toUpperCase() !== 'CANCELLED' && !row.cancelledAt);
    if (kind === 'accommodation') {
        for (const row of active) {
            const matched = sources.filter(source => source.entityId === row.accommodationId);
            const label = String(row.accommodationName || '저장된 숙소 원장');
            if (matched.length !== 1) findings.push({ label, level: 'unverified', title: '화면 밖 저장 원장 확인 필요', detail: '종료된 숙소 또는 연결 정보가 없는 저장 비용입니다. 현재 배정으로 자동 대조할 수 없습니다.' });
            else if (matched[0].amount !== row.costs?.total) findings.push({ label, level: 'unverified', title: '원장 변경 확인 필요', detail: '불러온 금액과 현재 저장 금액이 다릅니다. 자료를 새로 불러온 뒤 다시 검사해 주세요.' });
            const costs = row.costs || {};
            const values = ['rent', 'electricity', 'gas', 'water', 'internet', 'maintenance', 'other'].map(key => costs[key]);
            if (values.some(value => typeof value !== 'number' || !Number.isFinite(value)) || !Number.isFinite(costs.total) || Math.abs(values.reduce((total, value) => total + value, 0) - costs.total) >= 1) findings.push({ label, level: 'difference', title: '저장 원장 항목 합계 확인 필요', detail: '저장된 비용 항목과 합계가 일치하지 않거나 금액 형식을 확인할 수 없습니다.' });
            if (active.filter(other => other.accommodationId === row.accommodationId).length > 1) findings.push({ label, level: 'unverified', title: '같은 월의 숙소 원장 중복', detail: '같은 숙소에 저장 원장이 여러 건 있습니다. 최신 기록과 이전 기록을 확인해 주세요.' });
        }
        for (const source of sources) if (!active.some(row => row.accommodationId === source.entityId)) findings.push({ label: source.label, level: 'unverified', title: '원장 저장 확인 필요', detail: '계약 기준으로 표시된 예상 비용입니다. 저장된 월 원장을 찾을 수 없습니다.' });
    } else {
        const amounts = new Map<string, number>();
        for (const row of active) {
            const matched = sources.filter(source => source.entityId === row.vehicleId && source.startDate && source.endDate && row.date >= source.startDate && row.date <= source.endDate);
            const label = String(row.vehiclePlate || '저장된 차량 비용');
            if (matched.length !== 1 || typeof row.amount !== 'number' || !Number.isFinite(row.amount)) findings.push({ label, level: 'unverified', title: '차량 비용 연결 확인 필요', detail: '현재 원장의 차량·사용 기간에 연결할 수 없거나 금액 형식이 올바르지 않습니다. 처분 차량과 사용 기간 밖의 비용도 확인해 주세요.' });
            const key = JSON.stringify([row.vehicleId, normalizeVehicleExpenseType(row.type, row.note, row.id)]);
            amounts.set(key, (amounts.get(key) ?? 0) + Number(row.amount));
        }
        const expected = new Map<string, number>();
        for (const source of sources) for (const charge of source.expected) {
            if (['RENT', 'LEASE'].includes(charge.category)) continue;
            const key = JSON.stringify([source.entityId, charge.category]);
            expected.set(key, (expected.get(key) ?? 0) + charge.amount);
        }
        for (const key of new Set([...amounts.keys(), ...expected.keys()])) {
            const a = amounts.get(key) ?? 0;
            const b = expected.get(key) ?? 0;
            if (!Number.isFinite(a) || Math.abs(a - b) >= 1) findings.push({ label: sources.find(s => s.entityId === JSON.parse(key)[0])?.label || '저장된 차량 비용', level: 'unverified', title: '저장 비용과 원장 배분 확인 필요', detail: '저장된 차량 비용이 현재 원장에 모두 배분되었는지 확인해 주세요.', expected: a, actual: b });
        }
    }
    return findings;
}
