import React from 'react';
import { Download } from 'lucide-react';
import { getTransferExportCells, SOURCE_LABELS } from './transferModel';
import { buildTransferReview } from './transferReview';
import type { TransferRow, WorkerEmployment } from './types';
import { getWorkerEmployment } from './workerEmployment';
import WorkerEmploymentBadge from './WorkerEmploymentBadge';

const money = (amount: number) => Number.isFinite(amount) ? amount.toLocaleString('ko-KR') : '확인 필요';
export default function TransferPreview({ rows, total, errorsByRow, review, onBack, onDetail, onExport, canExport, reviewed, onReview, onFix, workerEmployment = {} }: {
    rows: TransferRow[]; total: number; errorsByRow: Map<string, string[]>; review: ReturnType<typeof buildTransferReview>;
    onBack: () => void; onDetail: (row: TransferRow) => void; onExport: () => void; canExport: boolean;
    reviewed: boolean; onReview: () => void; onFix: (row: TransferRow) => void;
    workerEmployment?: Record<string, WorkerEmployment>;
}) {
    const invalidCount = rows.filter(row => errorsByRow.get(row.rowId)?.length).length;
    return <section className="bt-preview" aria-label="국민은행 엑셀 미리보기">
        <div className="bt-section-heading bt-kb-preview-header"><div><h2>국민은행용 엑셀 미리보기</h2><p>현재 송금 목록 기준 · 파일에는 A~E열만 들어갑니다.</p></div><button onClick={onBack}>← 송금 목록으로</button></div>
        <div className="bt-review-summary">
            <div><span>이체 대상</span><strong>{rows.length}건</strong></div><div><span>총 이체금액</span><strong>{money(total)}원</strong></div>
            <div><span>파일 오류</span><strong className={invalidCount ? 'bt-invalid' : 'bt-valid'}>{invalidCount}건</strong></div><div><span>주의사항</span><strong>{review.warningCount}건</strong></div>
        </div>
        {!!invalidCount && <div role="alert" className="bt-error">계좌·금액 확인이 필요한 {invalidCount}건을 수정해 주세요. 오류가 있으면 파일을 만들지 않습니다.</div>}
        {rows.length > 0 && !Number.isSafeInteger(total) && <div role="alert" className="bt-error">총 이체금액을 정확하게 계산할 수 없습니다. 입력 금액을 확인하고 목록을 나누어 주세요.</div>}
        {(review.warningCount > 0 || review.periods.length > 1) && <div className="bt-review-notice" role="note">
            {!!review.warningCount && <p>주의사항 {review.warningCount}건{review.duplicateAccounts ? ` · 동일 계좌 ${review.duplicateAccounts}개` : ''}. 아래 각 행에서 원본 안내와 중복 지급 여부를 확인하세요.</p>}
            {!!review.crossDraftCount && <p>다른 저장 목록과 유사한 대상 {review.crossDraftCount}건이 있습니다. 파일 생성 이력은 실제 지급완료를 뜻하지 않습니다.</p>}
            {review.periods.length > 1 && <p>여러 대상 월이 포함되어 있습니다: {review.periods.join(', ')}</p>}
        </div>}
        <p className="bt-review-help">‘파일 형식 확인’은 입력값 검사 결과입니다. 계좌의 실제 예금주 확인은 은행에서 진행됩니다.</p>
        <div className="bt-preview-table" role="region" aria-label="송금 파일 확인 표" tabIndex={0}><table><thead><tr>{['송금 대상', 'A. 은행코드', 'B. 계좌번호', 'C. 이체금액', 'D. 받는분통장표시', 'E. 내통장메모', '검증·수정'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => {
            const [bankCode, accountNumber, amount, receiverDisplay, senderMemo] = getTransferExportCells(row);
            const errors = errorsByRow.get(row.rowId) ?? [];
            const notes = review.notes.get(row.rowId) ?? [];
            return <React.Fragment key={row.rowId}><tr aria-label={`${row.name} 엑셀 출력값`} className={errors.length ? 'bt-review-has-error' : notes.length ? 'bt-review-has-note' : ''}>
                <td className="bt-preview-person"><strong>{index + 1}. {row.name}</strong><WorkerEmploymentBadge status={getWorkerEmployment(row, workerEmployment)} /><small>{row.groupName || '소속 미지정'}</small><small>{SOURCE_LABELS[row.source]} · {row.period || '월 지정 없음'}</small></td>
                <td>{bankCode || '—'}<small className="bt-review-period">{row.bankName}</small></td><td className="bt-number">{accountNumber || '미입력'}<small className="bt-review-period">예금주 {row.accountHolder || '미등록'}</small></td><td className="bt-amount">{money(amount)}</td><td>{receiverDisplay}</td><td>{senderMemo}</td>
                <td className="bt-preview-check"><span className={errors.length ? 'bt-invalid' : 'bt-valid'}>{errors.join(' · ') || '파일 형식 확인'}</span><div>
                    {row.source !== 'account' && <button aria-label={`${row.name} 상세내역 확인`} onClick={() => onDetail(row)}>상세내역</button>}
                    <button aria-label={`${row.name} 송금 내용 수정`} onClick={() => onFix(row)}>수정</button>
                </div></td></tr>
                {notes.length > 0 && <tr className="bt-review-context"><td colSpan={7}><ul className="bt-review-row-notes" aria-label={`${row.name} 주의사항`}>{notes.map((note, i) => <li key={i}>{note}</li>)}</ul></td></tr>}
            </React.Fragment>;
        })}</tbody></table></div>
        <footer className="bt-preview-footer"><div className="bt-preview-footer-copy"><strong>{reviewed ? '검토 완료 · 파일 생성 가능' : '계좌·금액·주의사항을 확인해 주세요'}</strong><small>생성 당시 내역을 함께 보관합니다. 송금 내용 수정 시 다시 검토합니다.</small></div><div className="bt-preview-footer-actions"><button disabled={!canExport || reviewed} onClick={onReview}>{reviewed ? '검토 완료됨' : '내용 확인 후 검토 완료'}</button><button className="bt-primary" disabled={!canExport || !reviewed} onClick={onExport}><Download size={16} /> 국민은행용 엑셀 다운로드</button></div></footer>
    </section>;
}
