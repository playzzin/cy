import { buildLedgerPrintDocument, LedgerPrintData } from './ledgerPrintDocument';
import { buildSummaryPrintDocument, SummaryPrintData } from './summaryPrintDocument';
import { buildQuarterVatPrintDocument, QuarterVatPrintData } from './quarterVatPrintDocument';
import { buildQuarterVatReport, getSettlementLabels } from '../WorkbookLedgerModel';
import { buildQuarterVatBalances, buildQuarterVatPaymentHistory, sumQuarterVatBalances } from '../../../utils/quarterVatSettlement';

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const hostileText = '<img src=x onerror=alert(1)> & "검증"';
const ledgerData = (): LedgerPrintData => ({
    tenantKey: 'cheongyeon',
    ledgerFilter: { startDate: '2026-01-01', endDate: '2026-12-31', transactionType: '매출', partnerName: hostileText, siteName: '합성 현장', teamName: '합성 팀' },
    ledgerRows: [
        { id: 'invoice', date: '2026-02-01', partnerName: hostileText, description: '합성 거래', transactionAmount: 110000, paymentAmount: 0, balance: 110000, siteName: '합성 현장', note: hostileText, teamName: '합성 팀' },
        { id: 'payment', date: '2026-02-03', partnerName: hostileText, description: '입금', transactionAmount: 0, paymentAmount: 30000, balance: 80000, siteName: '', note: '', teamName: '' },
    ],
    ledgerTotals: { transactionAmount: 110000, paymentAmount: 30000, balance: 80000 },
});
const summaryData = (): SummaryPrintData => ({
    tenantKey: 'cheongyeon', todayString: '2026-10-25',
    summaryFilter: { startDate: '2026-01-01', endDate: '2026-12-31', mode: '미수금', partnerName: hostileText, siteName: '합성 현장', teamName: '합성 팀' },
    summarySettlementLabels: getSettlementLabels('매출'),
    summaryRows: [{ id: 'invoice', transactionType: '매출', partnerName: hostileText, siteName: '합성 현장', issueDate: '2026-02-01', appliedYear: 2026, appliedMonth: 2, supplyAmount: 100000, taxAmount: 10000, totalAmount: 110000, paymentDates: ['2026-02-02', '2026-02-03'], settledAmount: 30000, advanceUsedAmount: 0, outstandingAmount: 80000, advanceAmount: 0, settlementEntryIds: [], note: hostileText, teamName: '합성 팀' }],
    summaryTotals: { supplyAmount: 100000, taxAmount: 10000, totalAmount: 110000, settledAmount: 30000, outstandingAmount: 80000, advanceAmount: 0 },
});
const vatData = (): QuarterVatPrintData => {
    const filter: QuarterVatPrintData['quarterVatFilter'] = { year: 2026, quarter: 'Q3', basis: 'date', detailTransactionType: 'all', partnerName: '', siteName: '' };
    const report = buildQuarterVatReport([
        { id: 'q1', date: '2026-02-01', transactionType: '매출', partnerName: hostileText, siteName: '합성 현장', description: '합성 자료', supplyAmount: 1000000, taxAmount: 100000, totalAmount: 1100000, paymentAmount: 0 },
        { id: 'q3', date: '2026-08-01', transactionType: '매출', partnerName: hostileText, siteName: '합성 현장', description: '합성 자료', supplyAmount: 2000000, taxAmount: 200000, totalAmount: 2200000, paymentAmount: 0 },
    ], filter);
    const payments = [{ id: 'payment', year: 2026, quarter: 'Q1' as const, date: '2026-08-15', amount: 120000, note: hostileText, createdAt: '', createdBy: 'synthetic' }];
    const balances = buildQuarterVatBalances(2026, report.quarterRows, payments);
    return {
        companyLabel: hostileText, quarterVatFilter: filter, quarterVatPaidAmount: 0,
        quarterVatReport: report, quarterVatCompanyReport: report, quarterVatBalances: balances,
        quarterVatBalanceTotals: sumQuarterVatBalances(balances, 'Q3'),
        quarterVatAnnualBalance: sumQuarterVatBalances(balances, 'all'),
        quarterVatPaymentHistory: buildQuarterVatPaymentHistory(2026, balances, payments),
    };
};

describe('거래장 인쇄 문서', () => {
    it.each(['매출', '매입'] as const)('%s 열과 최종 잔액을 보존한다', transactionType => {
        const data = ledgerData();
        data.ledgerFilter.transactionType = transactionType;
        const doc = parse(buildLedgerPrintDocument(data));
        const headers = Array.from(doc.querySelectorAll('thead th'), cell => cell.textContent);
        expect(headers.slice(3, 5)).toEqual(transactionType === '매출' ? ['매출금액', '입금금액'] : ['매입금액', '지급금액']);
        const rows = doc.querySelectorAll('tbody tr');
        expect(rows).toHaveLength(3);
        expect(Array.from(rows[2].querySelectorAll('td'), cell => cell.textContent).slice(3, 6)).toEqual(['110,000', '30,000', '80,000']);
        expect(rows[1].querySelectorAll('td')[3].textContent).toBe('-');
        expect(doc.querySelectorAll('col')).toHaveLength(9);
    });

    it.each(['cheongyeon', 'dawon'] as const)('%s 회사 테마와 입력 문자열을 안전하게 보존한다', tenantKey => {
        const data = { ...ledgerData(), tenantKey };
        const before = JSON.stringify(data);
        const html = buildLedgerPrintDocument(data);
        const doc = parse(html);
        expect(doc.querySelector('img')).toBeNull();
        expect(doc.querySelector('script')).toBeNull();
        expect(doc.body.textContent).toContain(hostileText);
        expect(html).toContain(tenantKey === 'dawon' ? '#dc2626' : '#4338ca');
        expect(JSON.stringify(data)).toBe(before);
    });
});

describe('집계표 인쇄 문서', () => {
    it.each(['매출', '매입', '미수금', '미지급금'] as const)('%s의 지급 구분과 금액을 보존한다', mode => {
        const data = summaryData();
        data.summaryFilter.mode = mode;
        const purchase = mode === '매입' || mode === '미지급금';
        data.summarySettlementLabels = getSettlementLabels(purchase ? '매입' : '매출');
        const doc = parse(buildSummaryPrintDocument(data));
        const headers = Array.from(doc.querySelectorAll('thead th'), cell => cell.textContent);
        expect(headers.slice(7, 11)).toEqual(purchase ? ['지급일자', '지급금액', '미지급금', '선급금'] : ['입금일자', '입금금액', '미수금', '선수금']);
        const row = doc.querySelector('tbody tr')!;
        expect(row.querySelectorAll('td')[7].innerHTML).toBe('2026-02-02<br>2026-02-03');
        expect(Array.from(row.querySelectorAll('td'), cell => cell.textContent).slice(8, 11)).toEqual(['30,000', '80,000', '-']);
        expect(doc.querySelectorAll('col')).toHaveLength(13);
        expect(doc.querySelector('img')).toBeNull();
        expect(doc.body.textContent?.includes('2026-10-25까지 등록된 입금/지급'))
            .toBe(mode === '미수금' || mode === '미지급금');
    });
});

describe('부가세 인쇄 문서', () => {
    it('선택 분기와 연간 납부 내역을 구분하고 초과 납부를 다른 분기에서 차감하지 않는다', () => {
        const data = vatData();
        const before = JSON.stringify(data);
        const doc = parse(buildQuarterVatPrintDocument(data));
        const tables = doc.querySelectorAll('table');
        expect(tables).toHaveLength(4);
        expect(doc.querySelector('h1')?.textContent).toContain('2026년 3분기');
        const metrics = Array.from(doc.querySelectorAll('.metric'), item => item.textContent);
        expect(metrics).toContain('남은 납부금액200,000');
        expect(tables[0].textContent).toContain('2026년 1분기');
        expect(tables[0].textContent).toContain('2026-08-15');
        expect(Array.from(tables[0].querySelectorAll('tfoot td'), cell => cell.textContent)).toEqual(['합계', '300,000', '120,000', '200,000', '']);
        expect(tables[3].querySelectorAll('tbody tr')).toHaveLength(1);
        expect(doc.querySelector('img')).toBeNull();
        expect(doc.querySelectorAll('script')).toHaveLength(1);
        expect(JSON.stringify(data)).toBe(before);
    });

    it('납부 내역이 없는 경우 안내를 출력한다', () => {
        const data = vatData();
        data.quarterVatPaymentHistory = [];
        const doc = parse(buildQuarterVatPrintDocument(data));
        expect(doc.querySelector('table tbody')?.textContent).toContain('등록된 납부 내역이 없습니다.');
    });
});
