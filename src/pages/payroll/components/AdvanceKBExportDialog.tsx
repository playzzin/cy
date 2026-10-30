import React, { useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as XLSX from 'xlsx-js-style';
import { Download, FileSpreadsheet, X } from 'lucide-react';
import { buildAdvanceKBSnapshot, getAdvanceKBFileName, type AdvanceKBExportSource } from '../utils/advanceSummaryKBExport';
import { buildKBTransferWorkbook } from '../utils/kbTransferWorkbook';
import { getKBValidationMessages } from '../utils/kbTransferExport';
import { normalizeHexColor } from '../../../utils/color';
import '../../../components/common/ResponsiveDetailDialog.css';
import './AdvanceKBExportDialog.css';

const won = (amount: number) => amount.toLocaleString('ko-KR');

export default function AdvanceKBExportDialog({ source, onClose }: { source: AdvanceKBExportSource; onClose: () => void }) {
    const [receiverDisplay, setReceiverDisplay] = useState('㈜다원');
    const [memoTemplate, setMemoTemplate] = useState('{이름} 가불');
    const [downloadError, setDownloadError] = useState('');
    const [downloaded, setDownloaded] = useState(false);
    const returnFocus = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const snapshot = useMemo(() => buildAdvanceKBSnapshot(source, receiverDisplay, memoTemplate), [source, receiverDisplay, memoTemplate]);
    const validRows = snapshot.rows.filter(row => !row.validationErrors.length);
    const downloadAmount = validRows.reduce((sum, row) => sum + row.amount, 0);
    const invalidCount = snapshot.rows.length - validRows.length;
    const amountSafe = Number.isSafeInteger(downloadAmount) && Number.isSafeInteger(snapshot.criteria.totalAmount);
    const canDownload = validRows.length > 0 && amountSafe;
    const colors = new Map(source.groups.map(group => [group.team.name, normalizeHexColor(group.team.color, '#0b8d69')]));
    const download = () => {
        if (!canDownload) return;
        setDownloadError(''); setDownloaded(false);
        try {
            XLSX.writeFile(buildKBTransferWorkbook(snapshot), getAdvanceKBFileName(source));
            setDownloaded(true);
        } catch { setDownloadError('엑셀을 다운로드하지 못했습니다. 다시 시도해 주세요.'); }
    };

    return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal>
        <Dialog.Overlay className="cy-detail-dialog__overlay" />
        <Dialog.Content className="cy-detail-dialog as-kb-dialog" onCloseAutoFocus={event => {
            event.preventDefault(); if (returnFocus.current?.isConnected) returnFocus.current.focus();
        }}>
            <header className="cy-detail-dialog__header"><div className="as-kb-heading"><span className="as-kb-icon"><FileSpreadsheet size={23} aria-hidden="true" /></span><div>
                <Dialog.Title>국민은행용 엑셀 미리보기</Dialog.Title>
                <Dialog.Description>{source.yearMonth} · {source.teamLabel} · {source.categoryLabel}{source.query.trim() && ` · 검색: ${source.query.trim()}`}</Dialog.Description>
            </div></div><button type="button" className="cy-detail-dialog__close" aria-label="국민은행 미리보기 닫기" onClick={onClose}><X size={18} /></button></header>
            <div className="cy-detail-dialog__body as-kb-body">
                <div className="as-kb-controls">
                    <label>받는분통장표시<input value={receiverDisplay} onChange={event => { setReceiverDisplay(event.target.value); setDownloaded(false); }} placeholder="㈜다원" /></label>
                    <label>내통장메모 규칙<input value={memoTemplate} onChange={event => { setMemoTemplate(event.target.value); setDownloaded(false); }} placeholder="{이름} 가불" /><small>{'{이름}'}은 작업자 이름으로 바뀝니다.</small></label>
                </div>
                <dl className="as-kb-totals" aria-label="국민은행 다운로드 합계">
                    <div><dt>조회 금액</dt><dd>{won(snapshot.criteria.totalAmount)}원</dd></div>
                    <div className="as-kb-total-valid"><dt>다운로드 {validRows.length}명</dt><dd>{won(downloadAmount)}원</dd></div>
                    <div className={invalidCount ? 'as-kb-total-excluded' : ''}><dt>제외 {invalidCount}명</dt><dd>{won(snapshot.criteria.totalAmount - downloadAmount)}원</dd></div>
                </dl>
                {invalidCount > 0 && <p className="as-kb-warning" role="status">은행코드·계좌번호·금액을 확인해야 하는 {invalidCount}명은 다운로드에서 제외됩니다. 제외 사유는 검증 시트에도 기록됩니다.</p>}
                {!amountSafe && <p className="as-kb-warning" role="alert">합계 금액이 처리 가능한 범위를 넘었습니다. 조회 범위를 줄여 주세요.</p>}
                <div className="as-kb-table-wrap"><table className="as-kb-table">
                    <caption className="sr-only">국민은행 가불 이체 미리보기</caption>
                    <thead><tr><th scope="col">작업자 / 팀</th><th scope="col">A. 은행코드</th><th scope="col">B. 계좌번호</th><th scope="col">C. 이체금액</th><th scope="col">D. 받는분통장표시</th><th scope="col">E. 내통장메모</th><th scope="col">검증</th></tr></thead>
                    <tbody>{snapshot.rows.map(row => <tr key={row.sourceRowId} className={row.validationErrors.length ? 'as-kb-row-invalid' : ''}>
                        <th scope="row" className="as-kb-person"><strong>{row.workerName}</strong><small><i style={{ backgroundColor: colors.get(row.teamName) }} />{row.teamName}</small></th>
                        <td data-label="은행코드"><strong>{row.bankCode || '미등록'}</strong><small>{row.bankName || '은행 미등록'}</small></td>
                        <td data-label="계좌번호" className="as-kb-account"><span>{row.accountNumber || '미등록'}</span><small>예금주 {row.accountHolder || '미등록'}</small></td>
                        <td data-label="이체금액" className="as-kb-amount">{won(row.amount)}원</td>
                        <td data-label="받는분통장표시">{row.receiverDisplay || '—'}</td><td data-label="내통장메모">{row.senderMemo || '—'}</td>
                        <td data-label="검증"><span className={row.validationErrors.length ? 'as-kb-badge-error' : 'as-kb-badge-ok'}>{row.validationErrors.length ? `제외 · ${getKBValidationMessages(row)} 확인` : '정상'}</span></td>
                    </tr>)}</tbody>
                </table></div>
                <p className="as-kb-help">현재 조회한 가불금액과 작업자 등록 계좌 기준입니다. 엑셀에는 국민은행용 A~E열과 검증 시트가 포함됩니다.</p>
                {downloadError && <p className="as-kb-warning" role="alert">{downloadError}</p>}
                {downloaded && <p className="as-kb-success" role="status">국민은행용 엑셀을 다운로드했습니다.</p>}
            </div>
            <footer className="as-kb-footer"><span>{validRows.length}명 · {won(downloadAmount)}원</span><button type="button" onClick={onClose}>가불내역으로</button><button type="button" className="as-kb-download" onClick={download} disabled={!canDownload}><Download size={16} aria-hidden="true" />국민은행용 다운로드</button></footer>
        </Dialog.Content>
    </Dialog.Portal></Dialog.Root>;
}
