import { reviewLedgerSourceCoverage } from './supportLedgerCoverage';
const costs = { rent: 100, electricity: 0, gas: 0, water: 0, internet: 0, maintenance: 0, other: 0, total: 100 };
const source = { id: 'row', entityId: 'room', label: '시험', amount: 100, expected: [] };
test('detects saved accommodation costs hidden by master filtering', () => {
    expect(reviewLedgerSourceCoverage('accommodation', '2026-09', [], [{ id: 'saved', accommodationId: 'room', yearMonth: '2026-09', costs }])[0].title).toBe('화면 밖 저장 원장 확인 필요');
});
test('flags contract previews that have never been saved', () => {
    expect(reviewLedgerSourceCoverage('accommodation', '2026-09', [source], [])[0].title).toBe('원장 저장 확인 필요');
});
test('validates each saved cost field and detects stale displayed totals', () => {
    const rows = [{ id: 'saved', accommodationId: 'room', yearMonth: '2026-09', costs }];
    expect(reviewLedgerSourceCoverage('accommodation', '2026-09', [source], rows)).toEqual([]);
    expect(reviewLedgerSourceCoverage('accommodation', '2026-09', [source], [{ ...rows[0], costs: { ...costs, total: 200 } }])).toHaveLength(2);
});
test('detects duplicate saved room-month records', () => {
    const row = { accommodationId: 'room', yearMonth: '2026-09', costs };
    expect(reviewLedgerSourceCoverage('accommodation', '2026-09', [source], [row, row]).every(i => i.title === '같은 월의 숙소 원장 중복')).toBe(true);
});
test('includes disposed vehicle costs and rejects invalid/missing usage dates', () => {
    const findings = reviewLedgerSourceCoverage('vehicle', '2026-09', [], [{ vehicleId: 'disposed', yearMonth: '2026-09', type: 'FUEL', amount: 5000 }]);
    expect(findings.some(f => f.title === '차량 비용 연결 확인 필요')).toBe(true);
});
test('excludes cancellations and other months', () => {
    expect(reviewLedgerSourceCoverage('vehicle', '2026-09', [], [{ date: '2026-08-01', amount: 50 }, { date: '2026-09-01', status: 'CANCELLED', amount: 90 }])).toEqual([]);
});
