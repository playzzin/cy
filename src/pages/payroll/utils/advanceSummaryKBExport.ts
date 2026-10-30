import type { KBPreviewSnapshot, KBTransferRow } from '../MonthlyWageModel';
import type { AdvanceSummaryGroup } from './advanceSummary';
import { BANK_CODES } from '../constants/payroll.constants';
import { resolvePayrollBankCode } from './payrollBankCode';
import { formatKBTransferMemo, validateKBTransferRow } from './kbTransferExport';

export interface AdvanceKBExportSource {
    groups: AdvanceSummaryGroup[];
    yearMonth: string;
    teamLabel: string;
    categoryLabel: string;
    query: string;
    createdAtIso: string;
}

/** Export the reviewed request summary, using the same bank columns as integrated payroll. */
export function buildAdvanceKBSnapshot(source: AdvanceKBExportSource, receiverDisplay: string, memoTemplate: string): KBPreviewSnapshot {
    const rows: KBTransferRow[] = source.groups.flatMap(group => group.rows.map(row => {
        const resolvedCode = resolvePayrollBankCode(row.bankName);
        const bankCode = BANK_CODES[resolvedCode] ? resolvedCode : '';
        const accountNumber = row.accountNumber.replace(/[\s-]/g, '');
        const validationErrors = validateKBTransferRow({ bankCode, accountNumber, amount: row.amount });
        if (!/^\d+$/.test(accountNumber) && !validationErrors.includes('accountNumber')) validationErrors.push('accountNumber');
        if (!Number.isSafeInteger(row.amount) && !validationErrors.includes('amount')) validationErrors.push('amount');
        return {
            sourceRowId: JSON.stringify([source.yearMonth, group.team.id, row.workerId]),
            month: source.yearMonth, teamName: group.team.name, workerName: row.workerName,
            salaryLabel: source.categoryLabel, bankName: row.bankName, bankCode,
            bankCodeDisplay: bankCode || row.bankName || '미등록', bankCodeUnmapped: !bankCode,
            bankCodeNeedsFix: !bankCode, bankCodeReason: bankCode ? '' : '은행명을 확인해 주세요.', bankCodeCandidates: '',
            accountNumber, accountHolder: row.accountHolder, amount: row.amount,
            receiverDisplay: receiverDisplay.replace(/\r?\n/g, ' ').trim(),
            senderMemo: formatKBTransferMemo(memoTemplate, row.workerName).replace(/\r?\n/g, ' ').trim(),
            usesPrimaryAccount: false, validationErrors,
        };
    }));
    return {
        createdAtIso: source.createdAtIso, primaryAccount: null, sourceRows: [], rows, excludedRows: [],
        criteria: {
            generatedAt: new Date(source.createdAtIso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
            rangeLabel: source.yearMonth, teamLabel: source.teamLabel,
            targetLabel: source.teamLabel + (source.query.trim() ? ` · 검색: ${source.query.trim()}` : ''),
            salaryFilterLabel: source.categoryLabel, deductionStatusLabel: '가불 신청·선입금 조회 금액 기준',
            amountTypeLabel: source.categoryLabel === '전체 신청' ? '전체 가불 신청·선입금 합계' : `${source.categoryLabel} 금액`,
            sourceCount: rows.length, exportCount: rows.filter(row => row.validationErrors.length === 0).length,
            excludedCount: 0, totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
        },
    };
}

export function getAdvanceKBFileName(source: AdvanceKBExportSource): string {
    const safeLabel = (value: string) => Array.from(value, character =>
        character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? '_' : character).join('').slice(0, 60);
    return `팀별가불내역_국민은행용_${source.yearMonth}_${safeLabel(source.teamLabel)}_${safeLabel(source.categoryLabel)}.xlsx`;
}
