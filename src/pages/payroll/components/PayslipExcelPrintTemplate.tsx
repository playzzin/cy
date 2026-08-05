import React from 'react';
import type { PaymentData } from '../types/payroll';
import { formatPayrollPaymentDate } from '../utils/paymentDate';
import { maskAccountNumber, maskResidentId } from '../utils/payslipIssue';

interface PayslipExcelPrintTemplateProps {
    data: PaymentData;
    contractorName: string;
}

const formatMoney = (value: number): string => `${Math.floor(Number(value) || 0).toLocaleString('ko-KR')}원`;
const formatDeduction = (value: number): string => `-${Math.abs(Math.floor(Number(value) || 0)).toLocaleString('ko-KR')}원`;

/** 브라우저 인쇄와 PDF 저장에 공통으로 쓰는 A4 가로 명세서 스타일. */
export const PAYSLIP_PRINT_STYLES = `
    @media screen {
        #monthly-payslip-print-root {
            display: none !important;
        }
    }

    @media print {
        @page {
            size: A4 landscape;
            margin: 8mm;
        }

        html,
        body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-width: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        body > *:not(#monthly-payslip-print-root) {
            display: none !important;
        }

        #monthly-payslip-print-root {
            display: block !important;
            position: static !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
        }

        .monthly-payslip-print-page {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            break-after: page;
            page-break-after: always;
        }

        .monthly-payslip-print-page:last-child {
            break-after: auto;
            page-break-after: auto;
        }

        .payslip-excel-print-sheet {
            box-sizing: border-box !important;
            display: flex !important;
            width: 100% !important;
            min-height: 190mm !important;
            flex-direction: column !important;
            margin: 0 !important;
            color: #0f172a !important;
            background: #ffffff !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 12px !important;
            font-family: "Malgun Gothic", "Noto Sans KR", sans-serif !important;
            font-size: 8.5px !important;
            line-height: 1.3 !important;
        }

        .payslip-document-header {
            display: flex !important;
            min-height: 50px !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 18px !important;
            padding: 10px 16px !important;
            color: #ffffff !important;
            background: linear-gradient(120deg, #6d28d9 0%, #5b21b6 55%, #4338ca 100%) !important;
            border-radius: 11px 11px 0 0 !important;
        }

        .payslip-document-eyebrow {
            margin: 0 0 2px !important;
            color: #ddd6fe !important;
            font-size: 8px !important;
            font-weight: 700 !important;
            letter-spacing: 0.12em !important;
        }

        .payslip-document-title {
            margin: 0 !important;
            color: #ffffff !important;
            font-size: 18px !important;
            font-weight: 800 !important;
            letter-spacing: -0.02em !important;
        }

        .payslip-document-subtitle {
            margin: 2px 0 0 !important;
            color: #ede9fe !important;
            font-size: 8px !important;
        }

        .payslip-document-badges {
            display: flex !important;
            max-width: 48% !important;
            flex-wrap: wrap !important;
            justify-content: flex-end !important;
            gap: 5px !important;
        }

        .payslip-document-badge {
            padding: 3px 7px !important;
            color: #ffffff !important;
            background: rgba(255, 255, 255, 0.15) !important;
            border: 1px solid rgba(255, 255, 255, 0.3) !important;
            border-radius: 999px !important;
            font-size: 8px !important;
            font-weight: 700 !important;
            white-space: nowrap !important;
        }

        .payslip-document-info {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            border-bottom: 1px solid #e2e8f0 !important;
            background: #ffffff !important;
        }

        .payslip-document-info-item {
            min-width: 0 !important;
            padding: 6px 10px !important;
            border-right: 1px solid #e2e8f0 !important;
            border-bottom: 1px solid #f1f5f9 !important;
        }

        .payslip-document-info-item:nth-child(4n) {
            border-right: 0 !important;
        }

        .payslip-document-info-label {
            display: block !important;
            margin-bottom: 1px !important;
            color: #64748b !important;
            font-size: 7.5px !important;
            font-weight: 700 !important;
        }

        .payslip-document-info-value {
            display: block !important;
            overflow: hidden !important;
            color: #1e293b !important;
            font-size: 9px !important;
            font-weight: 700 !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
        }

        .payslip-document-stats {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            border-bottom: 1px solid #e2e8f0 !important;
            background: #ffffff !important;
        }

        .payslip-document-stat {
            padding: 6px 12px !important;
            text-align: center !important;
            border-right: 1px solid #e2e8f0 !important;
        }

        .payslip-document-stat:last-child {
            border-right: 0 !important;
            background: #ecfdf5 !important;
        }

        .payslip-document-stat-label {
            margin: 0 0 1px !important;
            color: #64748b !important;
            font-size: 7.5px !important;
            font-weight: 700 !important;
        }

        .payslip-document-stat-value {
            margin: 0 !important;
            color: #1e293b !important;
            font-size: 12px !important;
            font-weight: 800 !important;
            font-variant-numeric: tabular-nums !important;
        }

        .payslip-document-stat:last-child .payslip-document-stat-value {
            color: #047857 !important;
        }

        .payslip-document-grid {
            display: grid !important;
            flex: 1 1 auto !important;
            grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.9fr) !important;
            gap: 10px !important;
            padding: 10px !important;
            background: #ffffff !important;
        }

        .payslip-document-card {
            min-width: 0 !important;
            padding: 8px !important;
            background: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 9px !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
        }

        .payslip-document-card-header,
        .payslip-document-subsection-header {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            min-height: 22px !important;
            color: #334155 !important;
            font-weight: 800 !important;
        }

        .payslip-document-subsection-header {
            margin-top: 7px !important;
            padding-top: 5px !important;
            border-top: 1px solid #e2e8f0 !important;
        }

        .payslip-document-count {
            color: #64748b !important;
            font-size: 7.5px !important;
            font-weight: 600 !important;
        }

        .payslip-document-table-wrap {
            overflow: hidden !important;
            background: #ffffff !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 7px !important;
        }

        .payslip-document-table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
        }

        .payslip-document-table thead {
            display: table-header-group !important;
        }

        .payslip-document-table th,
        .payslip-document-table td {
            box-sizing: border-box !important;
            height: 18px !important;
            padding: 2px 4px !important;
            border: 0 !important;
            border-bottom: 1px solid #f1f5f9 !important;
            vertical-align: middle !important;
            overflow-wrap: anywhere !important;
        }

        .payslip-document-table thead th {
            height: 20px !important;
            color: #475569 !important;
            background: #f1f5f9 !important;
            font-weight: 800 !important;
            text-align: center !important;
        }

        .payslip-document-table tbody tr:nth-child(even) td {
            background: #f8fafc !important;
        }

        .payslip-document-table tbody tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
        }

        .payslip-document-table tfoot th,
        .payslip-document-table tfoot td {
            height: 21px !important;
            color: #4338ca !important;
            background: #f5f3ff !important;
            border-top: 1px solid #ddd6fe !important;
            border-bottom: 0 !important;
            font-weight: 800 !important;
        }

        .payslip-document-text {
            text-align: left !important;
        }

        .payslip-document-center {
            text-align: center !important;
        }

        .payslip-document-number {
            text-align: right !important;
            font-variant-numeric: tabular-nums !important;
            white-space: nowrap !important;
        }

        .payslip-document-deduction-table tbody td:last-child,
        .payslip-document-tax-table tbody td:last-child {
            color: #e11d48 !important;
            font-weight: 700 !important;
        }

        .payslip-document-deduction-table tfoot th,
        .payslip-document-deduction-table tfoot td {
            color: #92400e !important;
            background: #fef3c7 !important;
            border-top-color: #fde68a !important;
        }

        .payslip-document-empty {
            padding: 10px !important;
            color: #64748b !important;
            background: #ffffff !important;
            border: 1px dashed #cbd5e1 !important;
            border-radius: 7px !important;
            text-align: center !important;
        }

        .payslip-document-tax-summary {
            display: grid !important;
            gap: 3px !important;
            margin-top: 6px !important;
            padding: 6px 8px !important;
            background: #ffffff !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 7px !important;
        }

        .payslip-document-tax-summary-row {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            color: #334155 !important;
            font-weight: 700 !important;
        }

        .payslip-document-tax-summary-row strong {
            font-variant-numeric: tabular-nums !important;
        }

        .payslip-document-tax-summary-row.is-net strong {
            color: #047857 !important;
        }

        .payslip-document-tax-summary-row.is-deduction strong {
            color: #e11d48 !important;
        }

        .payslip-document-memo {
            margin: 0 10px 8px !important;
            padding: 6px 9px !important;
            color: #475569 !important;
            background: #fffbeb !important;
            border: 1px solid #fde68a !important;
            border-radius: 7px !important;
            font-size: 8px !important;
            white-space: pre-wrap !important;
        }

        .payslip-document-footer {
            display: grid !important;
            grid-template-columns: 1fr 1.4fr !important;
            min-height: 58px !important;
            align-items: center !important;
            gap: 16px !important;
            padding: 8px 16px !important;
            color: #047857 !important;
            background: linear-gradient(90deg, #d1fae5 0%, #ecfdf5 100%) !important;
            border-top: 1px solid #a7f3d0 !important;
            border-radius: 0 0 11px 11px !important;
        }

        .payslip-document-footer-block:last-child {
            text-align: right !important;
        }

        .payslip-document-footer-label {
            margin: 0 0 1px !important;
            color: #059669 !important;
            font-size: 8px !important;
            font-weight: 700 !important;
        }

        .payslip-document-footer-value {
            margin: 0 !important;
            color: #065f46 !important;
            font-size: 14px !important;
            font-weight: 900 !important;
            font-variant-numeric: tabular-nums !important;
        }

        .payslip-document-footer-block:last-child .payslip-document-footer-value {
            font-size: 21px !important;
        }

        .payslip-document-footer-note {
            margin: 1px 0 0 !important;
            color: #10b981 !important;
            font-size: 7.5px !important;
        }
    }
`;

/**
 * 미리보기의 근무·공제 카드와 하단 실지급 강조 영역을 PDF에 맞게 재구성한다.
 */
export const PayslipExcelPrintTemplate: React.FC<PayslipExcelPrintTemplateProps> = ({
    data,
    contractorName,
}) => {
    const workEntries = data.workEntries ?? [];
    const deductionLines = [
        ...(data.deductionBreakdown?.standardLines ?? []),
        ...(data.deductionBreakdown?.additionalLines ?? []),
    ];
    const taxLines = [
        ...(data.taxBreakdown?.standardLines ?? []),
        ...(data.taxBreakdown?.additionalLines ?? []),
    ];
    const totalWorkManDay = workEntries.reduce((sum, entry) => sum + Number(entry.manDay || 0), 0);
    const displayedManDay = workEntries.length > 0 ? totalWorkManDay : Number(data.totalManDay || 0);
    const deductionTotal = deductionLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    const contractor = contractorName || data.companyName || '-';

    const infoItems = [
        ['성명', data.workerName],
        ['팀', data.teamName || '-'],
        ['근로자 식별', maskResidentId(data.idNumber || data.workerId)],
        ['시공사', contractor],
        ['지급월', data.month],
        ['지급일', formatPayrollPaymentDate(data.month)],
        ['입금은행', data.bankName || '-'],
        ['계좌번호', maskAccountNumber(data.accountNumber)],
    ];

    return (
        <article className="payslip-excel-print-sheet" aria-label={`${data.workerName} 노임명세서`}>
            <header className="payslip-document-header">
                <div>
                    <p className="payslip-document-eyebrow">MONTHLY PAY STATEMENT</p>
                    <h1 className="payslip-document-title">{data.month} 노임명세서</h1>
                    <p className="payslip-document-subtitle">근무내역 · 공제내역 · 실지급액을 한눈에 확인</p>
                </div>
                <div className="payslip-document-badges">
                    <span className="payslip-document-badge">{data.workerName}</span>
                    <span className="payslip-document-badge">{data.teamName || '소속팀 미지정'}</span>
                    <span className="payslip-document-badge">{contractor}</span>
                </div>
            </header>

            <section className="payslip-document-info" aria-label="사원 정보">
                {infoItems.map(([label, value]) => (
                    <div key={label} className="payslip-document-info-item">
                        <span className="payslip-document-info-label">{label}</span>
                        <span className="payslip-document-info-value">{value}</span>
                    </div>
                ))}
            </section>

            <section className="payslip-document-stats" aria-label="지급 요약">
                <div className="payslip-document-stat">
                    <p className="payslip-document-stat-label">총 공수</p>
                    <p className="payslip-document-stat-value">{displayedManDay.toFixed(1)}</p>
                </div>
                <div className="payslip-document-stat">
                    <p className="payslip-document-stat-label">지급전 금액</p>
                    <p className="payslip-document-stat-value">{formatMoney(data.grossAmount)}</p>
                </div>
                <div className="payslip-document-stat">
                    <p className="payslip-document-stat-label">실 지급액</p>
                    <p className="payslip-document-stat-value">{formatMoney(data.totalAmount)}</p>
                </div>
            </section>

            <section className="payslip-document-grid">
                <div className="payslip-document-card">
                    <div className="payslip-document-card-header">
                        <span>근무내역</span>
                        <span className="payslip-document-count">총 {workEntries.length}건</span>
                    </div>
                    {workEntries.length > 0 ? (
                        <div className="payslip-document-table-wrap">
                            <table className="payslip-document-table payslip-document-work-table">
                                <colgroup>
                                    <col style={{ width: '17%' }} />
                                    <col style={{ width: '27%' }} />
                                    <col style={{ width: '12%' }} />
                                    <col style={{ width: '10%' }} />
                                    <col style={{ width: '16%' }} />
                                    <col style={{ width: '18%' }} />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>일자</th>
                                        <th>현장</th>
                                        <th>구분</th>
                                        <th>공수</th>
                                        <th>단가</th>
                                        <th>금액</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {workEntries.map((entry, index) => (
                                        <tr key={`${entry.date}-${entry.siteName}-${index}`}>
                                            <td className="payslip-document-center">{entry.date}</td>
                                            <td className="payslip-document-text">{entry.siteName}</td>
                                            <td className="payslip-document-center">{entry.paymentMethod || '-'}</td>
                                            <td className="payslip-document-number">{entry.manDay.toFixed(1)}</td>
                                            <td className="payslip-document-number">{Math.floor(entry.unitPrice).toLocaleString('ko-KR')}</td>
                                            <td className="payslip-document-number">{Math.floor(entry.amount || 0).toLocaleString('ko-KR')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <th colSpan={3} className="payslip-document-text">근무 합계</th>
                                        <td className="payslip-document-number">{totalWorkManDay.toFixed(1)}</td>
                                        <td />
                                        <td className="payslip-document-number">{formatMoney(data.grossAmount)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ) : (
                        <div className="payslip-document-empty">근무내역이 없습니다.</div>
                    )}
                </div>

                <div className="payslip-document-card">
                    <div className="payslip-document-card-header">
                        <span>공제내역</span>
                        <span className="payslip-document-count">총 {deductionLines.length}건</span>
                    </div>
                    {deductionLines.length > 0 ? (
                        <div className="payslip-document-table-wrap">
                            <table className="payslip-document-table payslip-document-deduction-table">
                                <thead>
                                    <tr>
                                        <th className="payslip-document-text">항목</th>
                                        <th className="payslip-document-number">금액</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {deductionLines.map((line, index) => (
                                        <tr key={`${line.label}-${index}`}>
                                            <td className="payslip-document-text">{line.label}</td>
                                            <td className="payslip-document-number">{formatDeduction(line.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <th className="payslip-document-text">공제 합계</th>
                                        <td className="payslip-document-number">{formatDeduction(deductionTotal)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ) : (
                        <div className="payslip-document-empty">공제 내역이 없습니다.</div>
                    )}

                    <div className="payslip-document-subsection-header">
                        <span>세금내역</span>
                        <span className="payslip-document-count">총 {taxLines.length}건</span>
                    </div>
                    {taxLines.length > 0 ? (
                        <div className="payslip-document-table-wrap">
                            <table className="payslip-document-table payslip-document-tax-table">
                                <thead>
                                    <tr>
                                        <th className="payslip-document-text">항목</th>
                                        <th className="payslip-document-number">금액</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {taxLines.map((line, index) => (
                                        <tr key={`${line.label}-${index}`}>
                                            <td className="payslip-document-text">{line.label}</td>
                                            <td className="payslip-document-number">{formatDeduction(line.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="payslip-document-empty">세금 내역이 없습니다.</div>
                    )}

                    <div className="payslip-document-tax-summary">
                        <div className="payslip-document-tax-summary-row">
                            <span>세전 금액</span>
                            <strong>{formatMoney(data.grossAmount)}</strong>
                        </div>
                        <div className="payslip-document-tax-summary-row is-net">
                            <span>세후 금액</span>
                            <strong>{formatMoney(data.totalAmount)}</strong>
                        </div>
                        <div className="payslip-document-tax-summary-row is-deduction">
                            <span>총 차감액 (공제 + 세금)</span>
                            <strong>{formatDeduction(data.totalDeduction)}</strong>
                        </div>
                    </div>
                </div>
            </section>

            <footer className="payslip-document-footer">
                <div className="payslip-document-footer-block">
                    <p className="payslip-document-footer-label">총 공제금</p>
                    <p className="payslip-document-footer-value">{formatMoney(data.totalDeduction)}</p>
                    <p className="payslip-document-footer-note">공제 및 세금 합계</p>
                </div>
                <div className="payslip-document-footer-block">
                    <p className="payslip-document-footer-label">실 지급액</p>
                    <p className="payslip-document-footer-value">{formatMoney(data.totalAmount)}</p>
                    <p className="payslip-document-footer-note">
                        지급전 {formatMoney(data.grossAmount)} - 차감 {formatMoney(data.totalDeduction)}
                    </p>
                </div>
            </footer>
        </article>
    );
};
