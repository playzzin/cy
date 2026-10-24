import type { WorkbookLedgerTenant } from '../../../services/workbookLedgerService';
import { LEDGER_PRINT_COLUMNS, buildPrintColGroup, buildPrintColumnStyles, escapeHtml, formatNumber, getPrintTableTheme } from '../WorkbookLedgerModel';
import type { LedgerFilter, LedgerRow } from '../WorkbookLedgerModel';
export interface LedgerPrintData {
    ledgerFilter: LedgerFilter;
    ledgerRows: ReadonlyArray<LedgerRow>;
    ledgerTotals: Pick<LedgerRow, 'transactionAmount' | 'paymentAmount' | 'balance'>;
    tenantKey: WorkbookLedgerTenant;
}
/** Build the existing printable document without reading or changing the DOM. */
export function buildLedgerPrintDocument({ ledgerFilter, ledgerRows, ledgerTotals, tenantKey, }: LedgerPrintData): string {
    const transactionAmountLabel = ledgerFilter.transactionType === '매출' ? '매출금액' : '매입금액';
    const paymentAmountLabel = ledgerFilter.transactionType === '매출' ? '입금금액' : '지급금액';
    const title = ledgerFilter.partnerName || `${ledgerFilter.transactionType} 거래장`;
    const filterItems = [
        ['조회 기간', `${ledgerFilter.startDate} ~ ${ledgerFilter.endDate}`],
        ['구분', ledgerFilter.transactionType],
        ['팀명', ledgerFilter.teamName || '전체'],
        ['거래처', ledgerFilter.partnerName || '전체'],
        ['현장명', ledgerFilter.siteName || '전체'],
        ['건수', `${ledgerRows.length.toLocaleString()}건`]
    ];
    const rowsHtml = ledgerRows
        .map((row) => `
                <tr>
                    <td>${escapeHtml(row.date || '-')}</td>
                    <td>${escapeHtml(row.partnerName || '-')}</td>
                    <td>${escapeHtml(row.description || '-')}</td>
                    <td class="align-right">${row.transactionAmount !== 0 ? formatNumber(row.transactionAmount) : '-'}</td>
                    <td class="align-right">${row.paymentAmount !== 0 ? formatNumber(row.paymentAmount) : '-'}</td>
                    <td class="align-right">${formatNumber(row.balance)}</td>
                    <td>${escapeHtml(row.siteName || '-')}</td>
                    <td>${escapeHtml(row.note || '-')}</td>
                    <td>${escapeHtml(row.teamName || '-')}</td>
                </tr>
            `)
        .join('');
    const totalRowHtml = `
            <tr class="summary-total-row">
                <td></td>
                <td></td>
                <td>합계</td>
                <td class="align-right">${formatNumber(ledgerTotals.transactionAmount)}</td>
                <td class="align-right">${formatNumber(ledgerTotals.paymentAmount)}</td>
                <td class="align-right">${formatNumber(ledgerTotals.balance)}</td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
        `;
    const ledgerPrintColGroup = buildPrintColGroup(LEDGER_PRINT_COLUMNS);
    const ledgerPrintColumnStyles = buildPrintColumnStyles(LEDGER_PRINT_COLUMNS);
    const printTheme = getPrintTableTheme(tenantKey);
    return `
            <!DOCTYPE html>
            <html lang="ko">
                <head>
                    <meta charset="utf-8" />
                    <title>${escapeHtml(title)} 인쇄</title>
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
                            border: 1px solid #e5cf87;
                            border-radius: 10px;
                            background: #fff8d9;
                            font-size: 12px;
                        }

                        .print-filter-item strong {
                            display: inline-block;
                            margin-right: 6px;
                            color: #111827;
                        }

                        .print-table-heading {
                            padding: 11px 14px;
                            background: linear-gradient(180deg, #365f91 0%, #27466b 100%);
                            color: #ffffff;
                            font-size: 16px;
                            font-weight: 800;
                        }

                        table {
                            width: 100%;
                            border-collapse: collapse;
                            table-layout: fixed;
                        }

                        ${ledgerPrintColumnStyles}

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

                        th {
                            background: ${printTheme.headerBackground};
                            color: ${printTheme.headerColor};
                            font-weight: 700;
                            white-space: nowrap;
                        }

                        td {
                            background: #ffffff;
                        }

                        .align-right {
                            text-align: right;
                        }

                        .summary-total-row td {
                            background: ${printTheme.totalBackground};
                            color: ${printTheme.totalColor};
                            font-weight: 700;
                        }
                    </style>
                </head>
                <body>
                    <div class="print-shell">
                        <div class="print-header">
                            <h1>${escapeHtml(title)}</h1>
                            <p>${escapeHtml(new Date().toLocaleString('ko-KR'))}</p>
                        </div>
                        <div class="print-filter-grid">
                            ${filterItems.map(([label, value]) => `
                                <div class="print-filter-item">
                                    <strong>${escapeHtml(label)}</strong>${escapeHtml(value)}
                                </div>
                            `).join('')}
                        </div>
                        <div class="print-table-heading">${escapeHtml(title)}</div>
                        <table>
                            ${ledgerPrintColGroup}
                            <thead>
                                <tr>
                                    <th>날짜</th>
                                    <th>거래처명</th>
                                    <th>내용</th>
                                    <th>${escapeHtml(transactionAmountLabel)}</th>
                                    <th>${escapeHtml(paymentAmountLabel)}</th>
                                    <th>잔액</th>
                                    <th>현장명</th>
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
