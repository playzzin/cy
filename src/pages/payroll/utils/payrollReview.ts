import type { SimplePayrollClosingRow } from '../components/SimplePayrollClosingTable';

export interface PayrollReviewRow extends SimplePayrollClosingRow {
    workerId: string;
    teamId: string;
    salaryModel: string;
    bankCode: string;
    accountNumber: string;
    accountHolder: string;
    deductionLineTotal: number;
    saved?: { grossAmount: number; totalDeduction?: number; netAmount: number };
}

export interface PayrollReviewIssue {
    id: string;
    rowId: string;
    workerName: string;
    month: string;
    teamName: string;
    severity: 'error' | 'warning';
    title: string;
    detail: string;
    target: 'payroll' | 'ledger' | 'account';
}

const won = (amount: number) => `${Math.round(amount).toLocaleString('ko-KR')}원`;
const differs = (a: number, b: number) => Math.abs(a - b) >= 1;

/** Compares existing values; never recalculates taxes or changes a payroll record. */
export function reviewPayroll(rows: PayrollReviewRow[]) {
    const issues: PayrollReviewIssue[] = [];
    const identities = new Set<string>();
    rows.forEach((row, index) => {
        const add = (code: string, title: string, detail: string, target: PayrollReviewIssue['target'], severity: PayrollReviewIssue['severity'] = 'error') => {
            issues.push({ id: `${index}:${code}`, rowId: row.id, workerName: row.workerName, month: row.month, teamName: row.teamName, severity, title, detail, target });
        };
        const identity = JSON.stringify([row.month, row.teamId, row.workerId, row.salaryModel]);
        if (!row.workerId || !row.teamId || !row.month) {
            add('identity', '소속 또는 작업자 연결 확인', '월·팀·작업자 연결이 빠져 있습니다. 상세 급여표에서 원본을 확인해 주세요.', 'payroll');
        } else if (identities.has(identity)) {
            add('duplicate', '동일한 지급 대상 중복', '같은 월·팀·작업자·급여유형이 두 번 포함되어 있습니다.', 'payroll');
        }
        identities.add(identity);

        const amounts = [row.grossAmount, row.personalDeduction, row.taxDeduction, row.totalDeduction, row.netAmount, row.deductionLineTotal];
        if (amounts.some(value => !Number.isFinite(value))) {
            add('invalid-amount', '금액을 읽을 수 없음', '숫자가 아닌 금액이 있습니다. 원본을 확인한 뒤 다시 조회해 주세요.', 'payroll');
        } else {
            if (differs(row.grossAmount - row.totalDeduction, row.netAmount)) {
                add('net', '총급여와 실지급액 차이', `총급여에서 공제를 뺀 금액은 ${won(row.grossAmount - row.totalDeduction)}이며, 표시된 실지급액은 ${won(row.netAmount)}입니다.`, 'payroll');
            }
            if (differs(row.personalDeduction + row.taxDeduction, row.totalDeduction) || differs(row.deductionLineTotal, row.personalDeduction)) {
                add('deduction', '공제 상세와 합계 차이', `개인공제 상세 합계 ${won(row.deductionLineTotal)}, 개인공제 표시 ${won(row.personalDeduction)}, 세금·보험 ${won(row.taxDeduction)}, 총공제 ${won(row.totalDeduction)}를 대조해 주세요.`, 'ledger');
            }
            if (row.netAmount < 0) add('negative', '공제액이 급여보다 큼', `실지급액이 ${won(row.netAmount)}입니다. 가불·공제와 이월 처리 여부를 확인해 주세요.`, 'ledger');
        }
        if (row.netAmount > 0) {
            const missing = [!row.bankCode.trim() && '은행', !row.accountNumber.trim() && '계좌번호', !row.accountHolder.trim() && '예금주'].filter(Boolean);
            if (missing.length) add('account', '지급 계좌 확인', `${missing.join('·')} 정보가 없습니다. 대표계좌를 사용할 경우 은행이체 미리보기에서 적용 결과를 확인해 주세요.`, 'account', 'warning');
        }
        if (row.saved && !row.isSnapshot && (
            differs(row.grossAmount, row.saved.grossAmount)
            || differs(row.netAmount, row.saved.netAmount)
            || (row.saved.totalDeduction !== undefined && differs(row.totalDeduction, row.saved.totalDeduction))
        )) {
            add('saved-changed', '저장본과 현재 금액이 다름', `저장본 실지급액 ${won(row.saved.netAmount)}, 현재 ${won(row.netAmount)}입니다. 확정 전에 저장본과 변경 내용을 확인해 주세요.`, 'payroll');
        }
    });
    return { issues, errorCount: issues.filter(issue => issue.severity === 'error').length, warningCount: issues.filter(issue => issue.severity === 'warning').length };
}

export function reviewTransferTotals(
    sourceRows: Array<{ sourceRowId: string; amount: number }>,
    exportRows: Array<{ sourceRowId: string; amount: number; validationErrors: unknown[] }>,
) {
    const eligible = sourceRows.filter(row => Number.isFinite(row.amount) && row.amount > 0);
    const valid = exportRows.filter(row => row.validationErrors.length === 0);
    const expected = eligible.reduce((sum, row) => sum + row.amount, 0);
    const downloadable = valid.reduce((sum, row) => sum + row.amount, 0);
    const byId = new Map(eligible.map(row => [row.sourceRowId, row.amount]));
    const seen = new Set<string>();
    const unexpected = valid.some(row => {
        const duplicate = seen.has(row.sourceRowId);
        seen.add(row.sourceRowId);
        return duplicate || !byId.has(row.sourceRowId) || differs(byId.get(row.sourceRowId)!, row.amount);
    });
    return { expected, downloadable, excludedCount: eligible.length - valid.length, difference: expected - downloadable, matches: !unexpected && eligible.length === valid.length && !differs(expected, downloadable) };
}
