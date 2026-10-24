import type { VatQuarterBalance, VatPaymentHistoryRow, sumQuarterVatBalances } from '../../../utils/quarterVatSettlement';
import { escapeHtml, formatNumber, getQuarterVatLabel } from '../WorkbookLedgerModel';
import type { QuarterVatFilter, QuarterVatReport } from '../WorkbookLedgerModel';
export interface QuarterVatPrintData {
    companyLabel: string;
    quarterVatFilter: QuarterVatFilter;
    quarterVatPaidAmount: number;
    quarterVatReport: QuarterVatReport;
    quarterVatCompanyReport: QuarterVatReport;
    quarterVatBalances: ReadonlyArray<VatQuarterBalance>;
    quarterVatBalanceTotals: ReturnType<typeof sumQuarterVatBalances>;
    quarterVatAnnualBalance: ReturnType<typeof sumQuarterVatBalances>;
    quarterVatPaymentHistory: ReadonlyArray<VatPaymentHistoryRow>;
}
/** Build the existing printable document without reading or changing the DOM. */
export function buildQuarterVatPrintDocument({ companyLabel, quarterVatFilter, quarterVatPaidAmount, quarterVatReport, quarterVatCompanyReport, quarterVatBalances, quarterVatBalanceTotals, quarterVatAnnualBalance, quarterVatPaymentHistory, }: QuarterVatPrintData): string {
    const selectedLabel = quarterVatFilter.quarter === 'all'
        ? `${quarterVatFilter.year}년 전체`
        : `${quarterVatFilter.year}년 ${getQuarterVatLabel(quarterVatFilter.quarter)}`;
    const basisLabel = quarterVatFilter.basis === 'applied' ? '적용연월 기준' : '발행일 기준';
    const detailTransactionLabel = quarterVatFilter.detailTransactionType === 'all'
        ? '매출·매입'
        : quarterVatFilter.detailTransactionType;
    const paidAmount = quarterVatPaidAmount;
    const remainingPaymentAmount = quarterVatBalanceTotals.remainingAmount;
    const metricRows = [
        ['매출세액', quarterVatCompanyReport.totals.salesVat],
        ['매입세액', quarterVatCompanyReport.totals.purchaseVat],
        ['예상 납부세액', quarterVatBalanceTotals.expectedAmount],
        ['누적 납부금액', paidAmount],
        ['남은 납부금액', remainingPaymentAmount],
        ['초과 납부금액', quarterVatBalanceTotals.overpaidAmount],
        ['환급 예상세액', quarterVatBalanceTotals.refundAmount],
    ];
    const quarterRowsHtml = quarterVatBalances.map((row) => `
            <tr>
                <td>${escapeHtml(getQuarterVatLabel(row.quarter))}</td>
                <td class="right">${formatNumber(row.payableVat)}</td>
                <td class="right">${formatNumber(row.paidAmount)}</td>
                <td class="right">${formatNumber(row.remainingAmount)}</td>
                <td class="right">${formatNumber(row.overpaidAmount)}</td>
                <td>${escapeHtml(row.lastPaymentDate || '-')}</td>
                <td>${escapeHtml(row.status)}</td>
            </tr>
        `).join('');
    const monthlyRowsHtml = quarterVatReport.monthlyRows.map((row) => `
            <tr>
                <td>${escapeHtml(row.label)}</td>
                <td class="right">${formatNumber(row.salesSupply)}</td>
                <td class="right">${formatNumber(row.salesVat)}</td>
                <td class="right">${formatNumber(row.purchaseSupply)}</td>
                <td class="right">${formatNumber(row.purchaseVat)}</td>
                <td class="right">${formatNumber(row.payableVat)}</td>
                <td class="right">${formatNumber(row.entryCount)}</td>
            </tr>
        `).join('');
    const detailRowsHtml = quarterVatReport.detailRows.map((row, index) => `
            <tr>
                <td class="right">${index + 1}</td>
                <td>${escapeHtml(row.transactionType)}</td>
                <td>${escapeHtml(row.date)}</td>
                <td>${escapeHtml(row.periodLabel)}</td>
                <td>${escapeHtml(row.partnerName)}</td>
                <td>${escapeHtml(row.siteName || '-')}</td>
                <td class="right">${formatNumber(row.supplyAmount)}</td>
                <td class="right">${formatNumber(row.taxAmount)}</td>
                <td class="right">${formatNumber(row.totalAmount)}</td>
            </tr>
        `).join('');
    const paymentRowsHtml = quarterVatPaymentHistory.length > 0
        ? quarterVatPaymentHistory.map((row) => `
                <tr${row.payment === null ? ' class="opening"' : ''}>
                    <td>${row.year}년 ${escapeHtml(getQuarterVatLabel(row.quarter))}</td>
                    <td>${escapeHtml(row.date || '-')}</td>
                    <td class="right">${row.expectedAmount === null ? '-' : formatNumber(row.expectedAmount)}</td>
                    <td class="right">${row.paymentAmount === null ? '-' : formatNumber(row.paymentAmount)}</td>
                    <td class="right">${formatNumber(row.remainingAmount)}</td>
                    <td>${escapeHtml(row.note || '-')}</td>
                </tr>
            `).join('')
        : '<tr><td colspan="6">등록된 납부 내역이 없습니다.</td></tr>';
    const metricRowsHtml = metricRows.map(([label, value]) => `
            <div class="metric"><span>${escapeHtml(String(label))}</span><strong>${formatNumber(Number(value))}</strong></div>
        `).join('');
    return `
            <!doctype html>
            <html lang="ko">
            <head>
                <meta charset="utf-8" />
                <title>${escapeHtml(companyLabel)} ${escapeHtml(selectedLabel)} 부가세</title>
                <style>
                    body { margin: 24px; color: #111827; font-family: "Malgun Gothic", Arial, sans-serif; }
                    h1 { margin: 0; font-size: 22px; }
                    h2 { margin: 24px 0 8px; font-size: 15px; }
                    .meta { margin-top: 8px; color: #475569; font-size: 12px; }
                    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-top: 16px; }
                    .metric { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc; }
                    .metric span { display: block; color: #64748b; font-size: 11px; font-weight: 700; }
                    .metric strong { display: block; margin-top: 4px; font-size: 16px; }
                    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                    th, td { border: 1px solid #cbd5e1; padding: 6px 7px; font-size: 11px; word-break: keep-all; }
                    th { background: #1e3a8a; color: white; }
                    .right { text-align: right; }
                    .opening td { background: #eff6ff; }
                    tfoot td { background: #e0e7ff; font-weight: 700; }
                    @media print { body { margin: 12mm; } .no-print { display: none; } }
                </style>
            </head>
            <body>
                <h1>${escapeHtml(companyLabel)} ${escapeHtml(selectedLabel)} 부가세</h1>
                <div class="meta">${escapeHtml(basisLabel)} · 거래처 ${escapeHtml(quarterVatFilter.partnerName || '전체')} · 현장 ${escapeHtml(quarterVatFilter.siteName || '전체')} · 세부 ${escapeHtml(detailTransactionLabel)}</div>
                <div class="meta">납부 현황은 회사 전체 기준입니다. 검색조건은 월별·세부 내역에 적용됩니다. 분기별 미납액은 다른 분기의 환급·초과납부와 상계하지 않습니다.</div>
                <div class="metrics">${metricRowsHtml}</div>
                <h2>납부 내역 · ${quarterVatFilter.year}년 귀속 전체</h2>
                <div class="meta">귀속분기별 · 납부일 오름차순. 발생금액은 조회 기준의 분기별 예상 납부세액이며, 잔액은 귀속분기별로 계산합니다.</div>
                <table>
                    <thead><tr><th>귀속연도·분기</th><th>실제 납부일</th><th>발생금액</th><th>납부금액</th><th>잔액</th><th>메모</th></tr></thead>
                    <tbody>${paymentRowsHtml}</tbody>
                    <tfoot><tr><td colspan="2">합계</td><td class="right">${formatNumber(quarterVatAnnualBalance.expectedAmount)}</td><td class="right">${formatNumber(quarterVatAnnualBalance.paidAmount)}</td><td class="right">${formatNumber(quarterVatAnnualBalance.remainingAmount)}</td><td></td></tr></tfoot>
                </table>
                <h2>분기별 납부 현황 · ${quarterVatFilter.year}년 회사 전체</h2>
                <table>
                    <thead><tr><th>귀속분기</th><th>예상세액</th><th>누적 납부</th><th>남은 납부</th><th>초과 납부</th><th>최근 납부일</th><th>상태</th></tr></thead>
                    <tbody>${quarterRowsHtml}</tbody>
                </table>
                <h2>월별 요약</h2>
                <table>
                    <thead><tr><th>월</th><th>매출 공급가액</th><th>매출세액</th><th>매입 공급가액</th><th>매입세액</th><th>예상 납부</th><th>건수</th></tr></thead>
                    <tbody>${monthlyRowsHtml}</tbody>
                </table>
                <h2>세부 내역</h2>
                <table>
                    <thead><tr><th>No</th><th>구분</th><th>발행일</th><th>귀속</th><th>거래처명</th><th>현장명</th><th>공급가액</th><th>세액</th><th>합계</th></tr></thead>
                    <tbody>${detailRowsHtml}</tbody>
                </table>
                <script>
                    window.addEventListener('load', () => {
                        window.print();
                    });
                </script>
            </body>
            </html>
        `;
}
