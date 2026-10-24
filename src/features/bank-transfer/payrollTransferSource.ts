import { monthlyPayrollSettlementService } from '../../services/monthlyPayrollSettlementService';
import type { KBTransferRow } from '../../pages/payroll/MonthlyWageModel';
import { getKBValidationErrorLabel, type KBAmountType } from '../../pages/payroll/utils/kbTransferExport';
import { resolvePayrollBankCode } from '../../pages/payroll/utils/payrollBankCode';
import type { TransferCandidate, TransferLoadResult } from './types';
import { buildPayrollTransferDetail } from './payrollTransferDetail';

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const payrollCandidateId = (sourceId: string, amountType: KBAmountType): string => `payroll:${sourceId}:${amountType}`;
const previewGuide = '급여 페이지에서 미리보기를 연 뒤 “송금 목록에 담기”로 현재 계산 결과를 가져올 수 있습니다.';

/** The preview has already applied taxes, allocation and per-worker account overrides. */
// @guide-sync 02: 급여 금액 기준/확정·지급완료 제외/상세 항목 변경 시 transferGuideContent.ts의
// 급여 안내와 TransferGuideSimulator.tsx의 Detail 및 시연 지급액·공제 예시를 함께 맞춘다.
export const buildPayrollPreviewCandidates = (
    rows: KBTransferRow[],
    amountType: KBAmountType,
    amountTypeLabel: string,
): TransferCandidate[] => rows.map(row => ({
    id: payrollCandidateId(row.sourceRowId, amountType),
    source: 'payroll',
    sourceId: row.sourceRowId,
    name: row.workerName,
    groupName: row.teamName,
    category: 'worker',
    bankName: row.bankName,
    bankCode: row.bankCode,
    accountNumber: row.accountNumber,
    accountHolder: row.accountHolder,
    amount: row.amount,
    period: row.month,
    detail: ['급여 미리보기', amountTypeLabel, row.salaryLabel, row.usesPrimaryAccount ? '대표계좌 적용' : ''].filter(Boolean).join(' · '),
    receiverDisplay: row.receiverDisplay,
    senderMemo: row.senderMemo,
    payrollDetail: row.payrollDetail,
    ...(row.validationErrors.length > 0
        ? { warning: `${row.validationErrors.map(getKBValidationErrorLabel).join(', ')} 확인 필요` }
        : {}),
}));

/** Only persisted payment snapshots are reliable outside the payroll calculator. */
export const loadPayrollTransferCandidates = async (period: string): Promise<TransferLoadResult> => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
        throw new Error('급여를 불러올 월을 선택해 주세요.');
    }
    const settlements = (await monthlyPayrollSettlementService.getSettlementsByYear(Number(period.slice(0, 4))))
        .filter(settlement => settlement.yearMonth === period);
    if (settlements.length === 0) {
        return { candidates: [], warnings: [`선택한 월의 저장된 급여가 없습니다. ${previewGuide}`] };
    }

    const candidates: TransferCandidate[] = [];
    const ids = new Set<string>();
    let unavailableCount = 0;
    let inconsistentCount = 0;
    let nonPositiveCount = 0;
    let paidCount = 0;
    let unconfirmedCount = 0;
    let duplicateCount = 0;

    for (const settlement of settlements) {
        for (const row of settlement.rows) {
            if (settlement.runStatus === 'paid') {
                paidCount += 1;
                continue;
            }
            const snapshot = row.paymentSnapshot;
            const amount = snapshot?.totalAmount;
            // Legacy netAmount alone cannot recover the original transfer account or calculation.
            if (!snapshot || typeof amount !== 'number' || !Number.isFinite(amount)) {
                unavailableCount += 1;
                continue;
            }
            // The payroll page also uses the saved row total. Refuse ambiguous snapshots.
            if (row.netAmount !== undefined && (typeof row.netAmount !== 'number' || !Number.isFinite(row.netAmount) || row.netAmount !== amount)) {
                inconsistentCount += 1;
                continue;
            }
            if (amount <= 0) {
                nonPositiveCount += 1;
                continue;
            }
            const sourceId = text(snapshot.id) || text(row.rowKey);
            if (!sourceId || (text(snapshot.month) && text(snapshot.month) !== period)) {
                unavailableCount += 1;
                continue;
            }
            const id = payrollCandidateId(sourceId, 'totalAmount');
            if (ids.has(id)) {
                duplicateCount += 1;
                continue;
            }
            ids.add(id);
            const confirmed = settlement.runStatus === 'confirmed';
            const bankName = text(snapshot.bankName);
            const bankCode = resolvePayrollBankCode(bankName, text(snapshot.bankCode));
            const accountNumber = text(snapshot.accountNumber);
            const name = text(snapshot.workerName) || text(row.workerName);
            const warnings: string[] = [];
            if (!confirmed) {
                unconfirmedCount += 1;
                warnings.push('확정 전 저장본');
            }
            if (row.isValid === false || snapshot.isValid === false) warnings.push('급여 원본 확인 필요');
            if (!bankCode) warnings.push('은행코드 확인 필요');
            if (!accountNumber) warnings.push('계좌번호 확인 필요');
            candidates.push({
                id,
                source: 'payroll',
                sourceId,
                name,
                groupName: text(snapshot.teamName) || text(row.teamName) || settlement.teamName,
                category: 'worker',
                bankName,
                bankCode,
                accountNumber,
                accountHolder: text(snapshot.accountHolder),
                amount,
                period,
                detail: `${confirmed ? '확정' : '저장'} 급여 · 실지급액 · ${text(row.salaryModel) || '급여'}`,
                payrollDetail: buildPayrollTransferDetail(snapshot, {
                    salaryLabel: text(row.salaryModel) || '급여', amountBasis: '실지급액', originalAmount: amount, isFinalized: confirmed,
                }),
                ...(warnings.length > 0 ? { warning: warnings.join(' · ') } : {}),
            });
        }
    }

    const warnings: string[] = [
        '저장 당시의 실지급액과 작업자 계좌를 불러옵니다. 미리보기에서 변경한 대표계좌·금액 기준·메모는 급여 페이지의 “송금 목록에 담기”로 가져오세요.',
    ];
    if (unavailableCount > 0) warnings.push(`저장된 계산 결과가 불완전한 ${unavailableCount}건을 제외했습니다. ${previewGuide}`);
    if (inconsistentCount > 0) warnings.push(`저장된 실지급액과 계산 스냅샷이 서로 다른 ${inconsistentCount}건을 제외했습니다. ${previewGuide}`);
    if (nonPositiveCount > 0) warnings.push(`실지급액이 0원 이하인 ${nonPositiveCount}건을 제외했습니다.`);
    if (paidCount > 0) warnings.push(`이미 지급완료된 급여 ${paidCount}건을 제외했습니다.`);
    if (unconfirmedCount > 0) warnings.push(`확정 전 저장본 ${unconfirmedCount}건이 포함되어 있습니다. 금액을 검토해 주세요.`);
    if (duplicateCount > 0) warnings.push(`동일한 급여 원본 ${duplicateCount}건은 중복으로 불러오지 않았습니다.`);
    if (candidates.length === 0 && unavailableCount === 0) warnings.push(`가져올 수 있는 저장 급여가 없습니다. ${previewGuide}`);
    return { candidates, warnings };
};
