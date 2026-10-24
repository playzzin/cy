import { emptyManual, CorporateTaxManual, Evidence, freelancerEvidence } from '../../src/pages/tax/corporateTaxModel';
const key = (year: number) => `ct-qa-${year}`;
export const corporateTaxService = {
    async loadSources(year: number) {
        if (new URLSearchParams(location.search).has('fail')) return { evidence: [], errors: { ledger: '검증용 장부 조회 실패' }, warnings: [], missingSalaryMonths: [] };
        const evidence: Evidence[] = Array.from({ length: year === 2026 ? 9 : 2 }, (_, index) => {
            const month = index + 1;
            return [
                { id: `${month}-sale`, month, field: 'sales' as const, label: '검증용 매출처', date: `${year}-${String(month).padStart(2, '0')}-15`, description: '공사대금 · 검증현장 · 공급가액', amount: 138000000 + month * 500000 },
                { id: `${month}-buy`, month, field: 'purchases' as const, label: '검증용 매입처', date: `${year}-${String(month).padStart(2, '0')}-20`, description: '자재비 · 검증현장 · 공급가액', amount: 68000000 + month * 150000 },
                { id: `${month}-salary`, month, field: 'salary' as const, label: '검증 급여 합계', description: '세전 총액 · 월 저장본', amount: 10000000 },
                { id: `${month}-card`, month, field: 'card' as const, label: '검증 카드', description: '경비관리 카드 사용내역', amount: 6000000 },
                { id: `${month}-lodging`, month, field: 'lodging' as const, label: '검증 숙소', description: '월세 1,800,000 + 공과금·관리비 200,000', amount: 2000000 },
            ];
        }).flat();
        evidence.push(...freelancerEvidence([
            { teamId: 'a', teamName: '검증A팀', ...Object.fromEntries(Array.from({ length: year === 2026 ? 9 : 2 }, (_, i) => [`m${String(i + 1).padStart(2, '0')}`, 8000000])) },
            { teamId: 'a', teamName: '검증A팀', ...Object.fromEntries(Array.from({ length: year === 2026 ? 9 : 2 }, (_, i) => [`m${String(i + 1).padStart(2, '0')}`, 7000000])) },
            { teamId: 'b', teamName: '검증B팀', ...Object.fromEntries(Array.from({ length: year === 2026 ? 9 : 2 }, (_, i) => [`m${String(i + 1).padStart(2, '0')}`, 8000000])) },
        ], [], []));
        if (new URLSearchParams(location.search).has('partialFail')) return {
            evidence: evidence.filter(row => row.field !== 'card' || row.month !== 6),
            errors: { card: '경비관리 카드사용 내역 · 6월: 검증용 서버 연결 오류' }, failedMonths: { card: [6] },
            warnings: [], missingSalaryMonths: [10, 11, 12],
        };
        return { evidence, errors: {}, warnings: [], missingSalaryMonths: [10, 11, 12] };
    },
    async loadManual(year: number) {
        const saved = localStorage.getItem(key(year));
        if (saved) return JSON.parse(saved);
        const manual = emptyManual();
        if (year === 2026) {
            for (let month = 1; month <= 9; month++) manual.months[month] = { amounts: { invoice: 3700000, other: 500000 }, notes: { invoice: '검증용 계산서 합계' } };
        }
        return { manual, revision: 0 };
    },
    async saveManual(year: number, manual: CorporateTaxManual, revision: number) {
        const current = localStorage.getItem(key(year));
        if ((current ? JSON.parse(current).revision : 0) !== revision) throw new Error('다른 화면에서 수기 자료가 변경되었습니다. 저장 자료를 다시 불러와 주세요.');
        localStorage.setItem(key(year), JSON.stringify({ manual, revision: revision + 1 }));
        return revision + 1;
    },
};
