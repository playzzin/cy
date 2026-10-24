import type { WorkbookLedgerTenant } from '../../../services/workbookLedgerService';
import { SUMMARY_PRINT_COLUMNS, buildPrintColGroup, buildPrintColumnStyles, escapeHtml, formatDateInput, formatNumber, getPrintTableTheme, getSummaryDisplayedSettledAmount, isSummarySettlementMode } from '../WorkbookLedgerModel';
import type { SummaryFilter, SummaryRow, getSettlementLabels } from '../WorkbookLedgerModel';
export interface SummaryPrintData {
    summaryFilter: SummaryFilter;
    summaryRows: ReadonlyArray<SummaryRow>;
    summarySettlementLabels: ReturnType<typeof getSettlementLabels>;
    summaryTotals: Pick<SummaryRow, 'supplyAmount' | 'taxAmount' | 'totalAmount' | 'settledAmount' | 'outstandingAmount' | 'advanceAmount'>;
    tenantKey: WorkbookLedgerTenant;
    todayString: string;
}
/** Build the existing printable document without reading or changing the DOM. */
export function buildSummaryPrintDocument({ summaryFilter, summaryRows, summarySettlementLabels, summaryTotals, tenantKey, todayString, }: SummaryPrintData): string {
    const paymentDateLabel = summarySettlementLabels.date;
    const settledAmountLabel = summarySettlementLabels.amount;
    const outstandingLabel = summarySettlementLabels.outstanding;
    const advanceLabel = summarySettlementLabels.advance;
    const countText = `${summaryRows.length.toLocaleString()}건`;
    const isSettlementSummaryMode = isSummarySettlementMode(summaryFilter.mode);
    const paymentBasisItem = isSettlementSummaryMode
        ? ['잔액 반영 기준', `${todayString}까지 등록된 입금/지급`]
        : [`${settledAmountLabel} 반영`, `${formatDateInput(new Date())}까지`];
    const filterItems = [
        ['발행일 기간', `${summaryFilter.startDate} ~ ${summaryFilter.endDate}`],
        paymentBasisItem,
        ['구분', summaryFilter.mode],
        ['팀명', summaryFilter.teamName || '전체'],
        ['거래처', summaryFilter.partnerName || '전체'],
        ['현장명', summaryFilter.siteName || '전체'],
        ['건수', countText]
    ];
    const rowsHtml = summaryRows
        .map((row, index) => `
                <tr>
                    <td class="align-right">${index + 1}</td>
                    <td>${escapeHtml(row.partnerName || '-')}</td>
                    <td>${escapeHtml(row.siteName || '-')}</td>
                    <td>${escapeHtml(row.issueDate || '-')}</td>
                    <td class="align-right">${formatNumber(row.supplyAmount)}</td>
                    <td class="align-right">${formatNumber(row.taxAmount)}</td>
                    <td class="align-right">${formatNumber(row.totalAmount)}</td>
                    <td>${row.paymentDates.length > 0 ? row.paymentDates.map((paymentDate) => escapeHtml(paymentDate)).join('<br />') : '-'}</td>
                    <td class="align-right">${formatNumber(getSummaryDisplayedSettledAmount(row))}</td>
                    <td class="align-right">${formatNumber(row.outstandingAmount)}</td>
                    <td class="align-right">${row.advanceAmount > 0 ? formatNumber(row.advanceAmount) : '-'}</td>
                    <td>${escapeHtml(row.note || '-')}</td>
                    <td>${escapeHtml(row.teamName || '-')}</td>
                </tr>
            `)
        .join('');
    const totalRowHtml = `
            <tr class="summary-total-row">
                <td></td>
                <td>합계</td>
                <td></td>
                <td></td>
                <td class="align-right">${formatNumber(summaryTotals.supplyAmount)}</td>
                <td class="align-right">${formatNumber(summaryTotals.taxAmount)}</td>
                <td class="align-right">${formatNumber(summaryTotals.totalAmount)}</td>
                <td></td>
                <td class="align-right">${formatNumber(summaryTotals.settledAmount)}</td>
                <td class="align-right">${formatNumber(summaryTotals.outstandingAmount)}</td>
                <td class="align-right">${formatNumber(summaryTotals.advanceAmount)}</td>
                <td></td>
                <td></td>
            </tr>
        `;
    const summaryPrintColGroup = buildPrintColGroup(SUMMARY_PRINT_COLUMNS);
    const summaryPrintColumnStyles = buildPrintColumnStyles(SUMMARY_PRINT_COLUMNS);
    const printTheme = getPrintTableTheme(tenantKey);
    return `
            <!DOCTYPE html>
            <html lang="ko">
                <head>
                    <meta charset="utf-8" />
                    <title>전체 조회 인쇄</title>
                    <style>
                        @page {
                            size: A4 landscape;
                            margin: 12mm;
                        }

                        * {
                            box-sizing: border-box;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }

                        body {
                            margin: 0;
                            font-family: "Segoe UI", "Malgun Gothic", sans-serif;
                            color: #111827;
                            background: #ffffff;
                        }

                        .print-shell {
                            padding: 20px 24px 28px;
                        }

                        .print-header {
                            margin-bottom: 16px;
                        }

                        .print-header h1 {
                            margin: 0;
                            font-size: 26px;
                        }

                        .print-header p {
                            margin: 6px 0 0;
                            color: #475569;
                            font-size: 12px;
                        }

                        .print-filter-grid {
                            display: grid;
                            grid-template-columns: repeat(3, minmax(0, 1fr));
                            gap: 8px;
                            margin-bottom: 16px;
                        }

                        .print-filter-item {
                            padding: 8px 10px;
                            border: 1px solid #d7dde7;
                            border-radius: 10px;
                            background: #f8fafc;
                            font-size: 12px;
                        }

                        .print-filter-item strong {
                            display: inline-block;
                            margin-right: 6px;
                            color: #334155;
                        }

                        table {
                            width: 100%;
                            border-collapse: collapse;
                            table-layout: fixed;
                        }

                        ${summaryPrintColumnStyles}

                        th,
                        td {
                            border: 1px solid #cbd5e1;
                            padding: 5px 7px;
                            font-size: 11px;
                            line-height: 1.25;
                            vertical-align: top;
                            white-space: normal;
                            word-break: keep-all;
                            overflow-wrap: anywhere;
                        }

                        thead th {
                            background: ${printTheme.summaryHeaderBackground};
                            color: ${printTheme.summaryHeaderColor};
                            font-weight: 700;
                            white-space: nowrap;
                        }

                        tbody td:first-child {
                            background: #f8fafc;
                        }

                        .summary-total-row td {
                            background: ${printTheme.totalBackground};
                            color: ${printTheme.totalColor};
                            font-weight: 700;
                        }

                        .align-right {
                            text-align: right;
                        }

                        td:nth-child(4),
                        td:nth-child(5),
                        td:nth-child(6),
                        td:nth-child(7),
                        td:nth-child(8),
                        td:nth-child(9),
                        td:nth-child(10),
                        td:nth-child(11) {
                            white-space: nowrap;
                            word-break: keep-all;
                            overflow-wrap: normal;
                        }
                    </style>
                </head>
                <body>
                    <div class="print-shell">
                        <div class="print-header">
                            <h1>전체 조회</h1>
                            <p>현재 조회 조건으로 검색된 결과만 인쇄합니다.</p>
                        </div>
                        <div class="print-filter-grid">
                            ${filterItems.map(([label, value]) => `
                                <div class="print-filter-item">
                                    <strong>${escapeHtml(label)}</strong>${escapeHtml(value)}
                                </div>
                            `).join('')}
                        </div>
                        <table>
                            ${summaryPrintColGroup}
                            <thead>
                                <tr>
                                    <th>No</th>
                                    <th>거래처명</th>
                                    <th>현장명</th>
                                    <th>발행일</th>
                                    <th>공급가액</th>
                                    <th>세액</th>
                                    <th>합계</th>
                                    <th>${escapeHtml(paymentDateLabel)}</th>
                                    <th>${escapeHtml(settledAmountLabel)}</th>
                                    <th>${escapeHtml(outstandingLabel)}</th>
                                    <th>${escapeHtml(advanceLabel)}</th>
                                    <th>비고</th>
                                    <th>팀명</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                                ${totalRowHtml}
                            </tbody>
                        </table>
                    </div>
                </body>
            </html>
        `;
}
