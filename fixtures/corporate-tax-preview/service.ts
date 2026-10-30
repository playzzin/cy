import { emptyManual, CorporateTaxManual, CorporateTaxCompany, Evidence } from '../../src/pages/tax/corporateTaxModel';
const key = (year: number, company: CorporateTaxCompany) => 'ct-qa-v2-' + company + '-' + year;
export const corporateTaxService = {
    async loadSources(year: number, company: CorporateTaxCompany = 'cheongyeon') {
        if (new URLSearchParams(location.search).has('fail')) return { evidence: [], errors: { ledger: '검증용 장부 조회 실패' } };
        const factor = company === 'cheongyeon' ? 1 : 2;
        const evidence: Evidence[] = Array.from({ length: 12 }, (_, index) => {
            const month = index + 1;
            return [
                { id: month + '-sale', month, field: 'sales' as const, label: '검증용 매출처', description: '공사대금 · 공급가액', amount: 10000000 * factor },
                { id: month + '-buy', month, field: 'purchases' as const, label: '검증용 매입처', description: '자재비 · 공급가액', amount: 3000000 * factor },
                { id: month + '-lodging', month, field: 'lodging' as const, label: company === 'cheongyeon' ? '청연 검증 숙소' : '다원 검증 숙소', description: '월세 500,000 + 관리비 110,000 · 월별 저장 자료', amount: 610000 },
            ];
        }).flat();
        if (new URLSearchParams(location.search).has('partialFail')) return {
            evidence: evidence.filter(row => row.field !== 'lodging' || row.month !== 6),
            errors: { lodging: '경비관리 숙소비용 내역 · 6월: 검증용 서버 연결 오류' }, failedMonths: { lodging: [6] },
        };
        return { evidence, errors: {} };
    },
    async loadManual(year: number, company: CorporateTaxCompany = 'cheongyeon') {
        const saved = localStorage.getItem(key(year, company));
        return saved ? JSON.parse(saved) : { manual: emptyManual(), revision: 0 };
    },
    async saveManual(year: number, manual: CorporateTaxManual, revision: number, company: CorporateTaxCompany = 'cheongyeon') {
        const current = JSON.parse(localStorage.getItem(key(year, company)) || '{"revision":0}');
        if (current.revision !== revision) throw new Error('다른 화면에서 수기 자료가 변경되었습니다.');
        localStorage.setItem(key(year, company), JSON.stringify({ manual, revision: revision + 1 }));
        return revision + 1;
    },
};
