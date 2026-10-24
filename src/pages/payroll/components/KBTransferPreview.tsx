import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExcel } from '@fortawesome/free-solid-svg-icons';
import type { AdvanceItemLabelsConfig } from '../../../services/payrollConfigService';
import type { KBPreviewSnapshot } from '../MonthlyWageModel';
import { getKBValidationMessages, type KBAmountType } from '../utils/kbTransferExport';
import type { reviewTransferTotals } from '../utils/payrollReview';
import { ActionButton, ActionCluster, KBPreviewPanel, KBPreviewHeader, KBPreviewTitleRow, KBPreviewTitleBlock, KBPreviewTitle, KBPreviewDescription, KBPreviewCloseButton, KBPreviewControlsGrid, KBPreviewFieldCard, KBPreviewFieldLabel, KBPreviewInput, KBPreviewFieldHint, KBPreviewSelect, KBPreviewTableArea, KBPreviewTable, KBPreviewFooter, KBPreviewSummary } from '../MonthlyWageStyles';

export interface KBTransferPreviewProps {
    snapshot: KBPreviewSnapshot | null;
    accountSettings: React.ReactNode;
    hasPrimaryAccount: boolean;
    selectedRowIds: ReadonlySet<string>;
    receiverDisplay: string;
    memoSuffix: string;
    amountType: KBAmountType;
    advanceItemLabels: AdvanceItemLabelsConfig;
    transferReview: ReturnType<typeof reviewTransferTotals> | null;
    payrollDataBlocked: boolean;
    transferError: string;
    titleRef: React.Ref<HTMLHeadingElement>;
    onReceiverDisplayChange: (value: string) => void;
    onMemoSuffixChange: (value: string) => void;
    onAmountTypeChange: (value: KBAmountType) => void;
    onApplyPrimaryAccount: () => void;
    onRestoreWorkerAccounts: () => void;
    onToggleAllRows: () => void;
    onToggleRow: (rowId: string) => void;
    onClose: () => void;
    onAddToTransfer: () => void;
    onDownload: () => void;
}

/** Displays a reviewed snapshot; account updates and downloads stay with the page. */
export function KBTransferPreview({
    snapshot: kbPreviewSnapshot, accountSettings, hasPrimaryAccount,
    selectedRowIds: kbSelectedTransferRowIds, receiverDisplay: kbReceiverDisplay,
    memoSuffix: kbMemoSuffix, amountType: kbAmountType, advanceItemLabels,
    transferReview: kbTransferReview, payrollDataBlocked, transferError: kbTransferError,
    titleRef: kbPreviewTitleRef, onReceiverDisplayChange, onMemoSuffixChange, onAmountTypeChange,
    onApplyPrimaryAccount: handleApplyPrimaryAccountToSelectedRows,
    onRestoreWorkerAccounts: handleRestoreSelectedWorkerAccounts,
    onToggleAllRows: toggleAllKBPreviewRows, onToggleRow: toggleKBPreviewRowSelection,
    onClose, onAddToTransfer: handleAddKBPreviewToTransfer, onDownload: handleDownloadKBExcel,
}: KBTransferPreviewProps) {
    const kbPreviewRows = kbPreviewSnapshot?.rows ?? [];
    const kbPreviewExcludedRows = kbPreviewSnapshot?.excludedRows ?? [];
    const kbPreviewInvalidRows = kbPreviewRows.filter(row => row.validationErrors.length > 0);
    const kbPreviewValidRows = kbPreviewRows.filter(row => row.validationErrors.length === 0);
    const kbPreviewValidAmount = kbPreviewValidRows.reduce((sum, row) => sum + row.amount, 0);
    const kbAllPreviewRowsSelected = kbPreviewRows.length > 0
        && kbPreviewRows.every(row => kbSelectedTransferRowIds.has(row.sourceRowId));
    const kbAppliedPrimaryAccountCount = kbPreviewRows.filter(row => row.usesPrimaryAccount).length;
    const canDownloadKBExcel = !payrollDataBlocked && Boolean(kbPreviewSnapshot && kbPreviewValidRows.length > 0);

    return (
        <KBPreviewPanel aria-labelledby="kb-preview-title">
            <KBPreviewHeader>
                <KBPreviewTitleRow>
                    <KBPreviewTitleBlock>
                        <KBPreviewTitle id="kb-preview-title" ref={kbPreviewTitleRef} tabIndex={-1}>국민은행용 엑셀 미리보기</KBPreviewTitle>
                        <KBPreviewDescription>현재 조회·공제 기준</KBPreviewDescription>
                    </KBPreviewTitleBlock>
                    <KBPreviewCloseButton type="button" onClick={() => onClose()}>
                        ← 급여 화면으로
                    </KBPreviewCloseButton>
                </KBPreviewTitleRow>

                <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-2 py-1.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="shrink-0 text-xs font-bold text-amber-300">작업자 입금계좌 변경</span>
                    <div className="min-w-0 flex-[1_1_300px]">
                        {accountSettings}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="whitespace-nowrap text-xs font-bold text-slate-200">
                            선택 {kbSelectedTransferRowIds.size}명 · 적용 {kbAppliedPrimaryAccountCount}명
                        </span>
                        <button
                            type="button"
                            onClick={handleApplyPrimaryAccountToSelectedRows}
                            disabled={!hasPrimaryAccount || kbSelectedTransferRowIds.size === 0}
                            title="선택한 작업자의 이체용 계좌만 대표계좌로 변경합니다."
                            aria-describedby="kb-account-hint"
                            className="min-h-[28px] whitespace-nowrap rounded-md border border-amber-300 bg-amber-400 px-2 text-xs font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-700 disabled:text-slate-400"
                        >
                            선택 → 대표계좌
                        </button>
                        <button
                            type="button"
                            onClick={handleRestoreSelectedWorkerAccounts}
                            disabled={kbSelectedTransferRowIds.size === 0}
                            title="선택한 작업자의 원래 입금계좌로 되돌립니다."
                            className="min-h-[28px] whitespace-nowrap rounded-md border border-slate-600 bg-slate-800 px-2 text-xs font-bold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            원계좌 복원
                        </button>
                    </div>
                    </div>
                    <p id="kb-account-hint" className="mt-1 text-[11px] leading-snug text-slate-300">아래 작업자를 선택한 뒤 대표계좌를 적용하면 해당 작업자의 국민은행 이체 계좌만 변경됩니다.</p>
                </div>

                <KBPreviewControlsGrid>
                    <KBPreviewFieldCard>
                        <KBPreviewFieldLabel htmlFor="kb-receiver-display">받는분통장표시</KBPreviewFieldLabel>
                        <KBPreviewInput
                            id="kb-receiver-display"
                            type="text"
                            value={kbReceiverDisplay}
                            onChange={(e) => onReceiverDisplayChange(e.target.value)}
                            placeholder="㈜다원"
                            aria-describedby="kb-receiver-display-hint"
                        />
                        <KBPreviewFieldHint id="kb-receiver-display-hint">은행 업로드 파일의 D열에 동일하게 들어갑니다.</KBPreviewFieldHint>
                    </KBPreviewFieldCard>

                    <KBPreviewFieldCard>
                        <KBPreviewFieldLabel htmlFor="kb-memo-suffix">내통장메모 규칙</KBPreviewFieldLabel>
                        <KBPreviewInput
                            id="kb-memo-suffix"
                            type="text"
                            value={kbMemoSuffix}
                            onChange={(e) => onMemoSuffixChange(e.target.value)}
                            placeholder="{이름} 가불"
                            aria-describedby="kb-memo-suffix-hint"
                        />
                        <KBPreviewFieldHint id="kb-memo-suffix-hint">{'{이름}'} 치환자를 쓰면 작업자 이름 뒤에 자동으로 붙습니다.</KBPreviewFieldHint>
                    </KBPreviewFieldCard>

                    <KBPreviewFieldCard>
                        <KBPreviewFieldLabel htmlFor="kb-amount-type">이체금액 적용 기준</KBPreviewFieldLabel>
                        <KBPreviewSelect
                            id="kb-amount-type"
                            aria-describedby="kb-amount-type-hint"
                            value={kbAmountType}
                            onChange={(e) => onAmountTypeChange(e.target.value as KBAmountType)}
                        >
                            <option value="totalAmount">현재 화면 실지급액</option>
                            <option value="invoiceNet">공제후 법인총액</option>
                            <option value="laborNet">공제후 노무총액</option>
                            <option value="invoiceAdvance">법인가불 총액</option>
                            <option value="laborAdvance">노무가불 총액</option>
                            {(() => {
                                const al = advanceItemLabels;
                                return (
                                    <>
                                        <option disabled>── 법인가불 개별 ──</option>
                                        <option value="corporateAdvance1">{al.corporateAdvance1}</option>
                                        <option value="corporateAdvance2">{al.corporateAdvance2}</option>
                                        <option value="corporateAdvance3">{al.corporateAdvance3}</option>
                                        <option value="corporateAdvance4">{al.corporateAdvance4}</option>
                                        <option disabled>── 노무가불 개별 ──</option>
                                        <option value="laborAdvance1">{al.laborAdvance1}</option>
                                        <option value="laborAdvance2">{al.laborAdvance2}</option>
                                        <option value="laborAdvance3">{al.laborAdvance3}</option>
                                        <option value="laborAdvance4">{al.laborAdvance4}</option>
                                    </>
                                );
                            })()}
                        </KBPreviewSelect>
                        <KBPreviewFieldHint id="kb-amount-type-hint">선택한 기준으로 C열 이체금액이 계산됩니다.</KBPreviewFieldHint>
                    </KBPreviewFieldCard>
                </KBPreviewControlsGrid>

                {kbPreviewSnapshot && (
                    <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                            <span>기간 <strong className="text-slate-100">{kbPreviewSnapshot.criteria.rangeLabel}</strong></span>
                            <span>대상 <strong className="text-slate-100">{kbPreviewSnapshot.criteria.targetLabel}</strong></span>
                            <span>구분 <strong className="text-slate-100">{kbPreviewSnapshot.criteria.salaryFilterLabel}</strong></span>
                            <span>금액 기준 <strong className="text-slate-100">{kbPreviewSnapshot.criteria.amountTypeLabel}</strong></span>
                            <span>{kbPreviewSnapshot.criteria.deductionStatusLabel}</span>
                        </div>
                        {kbTransferReview && <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 text-xs ${kbTransferReview.matches ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
                            <strong>이체 금액 대조 · {kbTransferReview.matches ? '일치' : '확인 필요'}</strong>
                            <span>선택 기준 합계 {kbTransferReview.expected.toLocaleString()}원 · 다운로드 {kbTransferReview.downloadable.toLocaleString()}원 · 차이 {kbTransferReview.difference.toLocaleString()}원</span>
                            {!kbTransferReview.matches && <span>계좌 오류로 제외된 대상과 아래 목록을 확인해 주세요. 같은 총액이어도 지급 대상이 다르면 확인이 필요합니다.</span>}
                        </div>}
                        {(kbPreviewInvalidRows.length > 0 || kbPreviewExcludedRows.length > 0) && (
                            <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                                {kbPreviewInvalidRows.length > 0 && (
                                    <div className="font-bold">검증 오류로 다운로드 제외 {kbPreviewInvalidRows.length}건: {kbPreviewInvalidRows.slice(0, 5).map((row) => `${row.workerName}(${getKBValidationMessages(row)})`).join(', ')}</div>
                                )}
                                {kbPreviewExcludedRows.length > 0 && (
                                    <div className="mt-1">다운로드 제외 {kbPreviewExcludedRows.length}건: {kbPreviewExcludedRows.slice(0, 5).map((row) => `${row.workerName}(${row.reason})`).join(', ')}</div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </KBPreviewHeader>
            <KBPreviewTableArea>
                <KBPreviewTable>
                    <thead className="bg-slate-800/95 sticky top-0">
                        <tr>
                            <th className="border border-slate-700 px-3 py-2 text-left font-bold text-slate-100">
                                <label className="flex min-w-[150px] cursor-pointer items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={kbAllPreviewRowsSelected}
                                        onChange={toggleAllKBPreviewRows}
                                        className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-amber-400 focus:ring-amber-400"
                                    />
                                    작업자 선택
                                </label>
                            </th>
                            <th className="border border-slate-700 px-3 py-2 text-left font-bold text-slate-100">A. 은행코드</th>
                            <th className="border border-slate-700 px-3 py-2 text-left font-bold text-slate-100">B. 계좌번호</th>
                            <th className="border border-slate-700 px-3 py-2 text-right font-bold text-slate-100">C. 이체금액</th>
                            <th className="border border-slate-700 px-3 py-2 text-left font-bold text-slate-100">D. 받는분통장표시</th>
                            <th className="border border-slate-700 px-3 py-2 text-left font-bold text-slate-100">E. 내통장메모</th>
                            <th className="border border-slate-700 px-3 py-2 text-left font-bold text-slate-100">검증</th>
                        </tr>
                    </thead>
                    <tbody>
                        {kbPreviewRows.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="border border-slate-700 px-3 py-8 text-center text-slate-400">
                                    다운로드할 이체금액 데이터가 없습니다.
                                </td>
                            </tr>
                        ) : kbPreviewRows.map((row, idx) => (
                            <tr key={row.sourceRowId || idx} className={`hover:bg-slate-800/60 ${row.usesPrimaryAccount ? 'bg-amber-950/30' : row.validationErrors.length > 0 ? 'bg-rose-950/30' : ''}`}>
                                <td className="border border-slate-700 px-3 py-2">
                                    <label className="flex cursor-pointer items-start gap-2">
                                        <input
                                            type="checkbox"
                                            checked={kbSelectedTransferRowIds.has(row.sourceRowId)}
                                            onChange={() => toggleKBPreviewRowSelection(row.sourceRowId)}
                                            aria-label={`${row.workerName} 계좌 선택`}
                                            className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-900 text-amber-400 focus:ring-amber-400"
                                        />
                                        <span>
                                            <span className="block font-bold text-slate-100">{row.workerName}</span>
                                            <span className="block text-[11px] text-slate-400">{row.teamName || row.salaryLabel}</span>
                                            {row.usesPrimaryAccount && (
                                                <span className="mt-1 inline-flex rounded-full border border-amber-400/50 bg-amber-400/15 px-2 py-0.5 text-[10px] font-black text-amber-300">
                                                    대표계좌 적용
                                                </span>
                                            )}
                                        </span>
                                    </label>
                                </td>
                                <td className={`border border-slate-700 px-3 py-2 ${row.bankCodeUnmapped ? 'text-rose-300 font-semibold' : ''}`}>
                                    <div className="flex items-center gap-1.5">
                                        <span>{row.bankCodeDisplay}</span>
                                        {row.bankCodeNeedsFix && (
                                            <span className="inline-flex items-center rounded bg-rose-500/30 px-1.5 py-0.5 text-[10px] font-bold text-rose-100">
                                                수정요망
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="border border-slate-700 px-3 py-2">{row.accountNumber || <span className="text-rose-300">미입력</span>}</td>
                                <td className="border border-slate-700 px-3 py-2 text-right font-medium text-amber-300">{row.amount.toLocaleString()}</td>
                                <td className="border border-slate-700 px-3 py-2">{row.receiverDisplay}</td>
                                <td className="border border-slate-700 px-3 py-2">{row.senderMemo}</td>
                                <td className={`border border-slate-700 px-3 py-2 ${row.validationErrors.length > 0 ? 'text-rose-300 font-semibold' : 'text-emerald-300'}`}>
                                    {row.validationErrors.length > 0 ? getKBValidationMessages(row) : '정상'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </KBPreviewTable>
            </KBPreviewTableArea>
            {kbTransferError && <p role="alert" className="px-3 py-2 text-sm text-rose-300">{kbTransferError}</p>}
            <KBPreviewFooter>
                <KBPreviewSummary>
                    다운로드 가능 {kbPreviewValidRows.length}명 · 이체금액 {kbPreviewValidAmount.toLocaleString()}원 · 제외 {kbPreviewInvalidRows.length + (kbPreviewSnapshot?.criteria.excludedCount ?? 0)}건
                </KBPreviewSummary>
                <ActionCluster>
                    <ActionButton
                        type="button"
                        $variant="outline"
                        onClick={() => onClose()}
                    >
                        급여 화면으로
                    </ActionButton>
                    <ActionButton
                        type="button"
                        $variant="outline"
                        onClick={handleAddKBPreviewToTransfer}
                        disabled={payrollDataBlocked || kbPreviewRows.length === 0}
                        title="미리보기의 모든 행을 현재 계좌·금액·메모 그대로 송금 목록에 담습니다."
                    >
                        송금 목록에 담기
                    </ActionButton>
                    <ActionButton
                        type="button"
                        $variant="warning"
                        onClick={handleDownloadKBExcel}
                        disabled={!canDownloadKBExcel}
                        title={!canDownloadKBExcel ? '은행코드와 계좌번호가 정상인 행이 없습니다.' : `정상 ${kbPreviewValidRows.length}건을 다운로드합니다.`}
                    >
                        <FontAwesomeIcon icon={faFileExcel} />
                        국민은행용 다운로드
                    </ActionButton>
                </ActionCluster>
            </KBPreviewFooter>
        </KBPreviewPanel>
    );
}
