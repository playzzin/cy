import React, { useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import type { TransferExportRecord, TransferResult, TransferRow } from './types';
import { buildTransferWorkbook } from './transferModel';
import { compareExportRows } from './transferWorkflow';
import TransferResultsPanel from './TransferResultsPanel';
import TransferAmountSummary from './TransferAmountSummary';
import PayrollTransferDetails from './PayrollTransferDetails';
import SupportTransferDetails from './SupportTransferDetails';
import RentTransferDetails from './RentTransferDetails';

export default function TransferExportHistory({ records = [], currentRows = [], onResults, onRetry }: {
    records?: TransferExportRecord[]; currentRows?: TransferRow[];
    onResults?: (id: string, results: TransferResult[], fileName?: string) => void; onRetry?: (rows: TransferRow[]) => void;
}) {
    const [error, setError] = useState('');
    if (!records.length) return null;
    const date = (value: string) => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return <details className="bt-export-history"><summary>파일 생성 이력 {records.length}건 <small>최근 {date(records[0].createdAt)}</small></summary>
        <p>최근 20회까지 보관합니다. 생성 당시 내역을 유지하며, 현재 편집 내용과 다를 수 있습니다. 파일 생성은 실제 송금 완료를 뜻하지 않습니다.</p>
        {error && <p role="alert" className="bt-invalid">{error}</p>}
        <ol>{records.map(record => {
            const diff = record.rows ? compareExportRows(record.rows, currentRows) : undefined;
            return <li key={record.id}><div><strong>{date(record.createdAt)}</strong><span>{record.rowCount}건 · {record.totalAmount.toLocaleString('ko-KR')}원</span></div><small>{record.fileName}</small>
                {!record.rows ? <p>이전 이력에는 생성 당시 상세가 없어 다시 내려받을 수 없습니다. 새로 생성하는 파일부터 내역을 보관합니다.</p> : <>
                    <button onClick={() => { try { XLSX.writeFile(buildTransferWorkbook(record.rows!), record.fileName); setError(''); } catch { setError('보관한 파일을 다시 만들지 못했습니다. 잠시 후 다시 시도해 주세요.'); } }}>생성 당시 파일 다시 다운로드</button>
                    <details className="bt-history-detail"><summary>생성 당시 내역 · 현재 목록과 비교</summary>
                        <p>현재 목록: 추가 {diff!.added.length} / 제외 {diff!.removed.length} / 변경 {diff!.changed.length}건{diff!.reordered ? ' · 순서 변경' : ''}</p>
                        {!!diff!.added.length && <p>추가: {diff!.added.map(row => row.name).join(', ')}</p>}
                        {!!diff!.removed.length && <p>제외: {diff!.removed.map(row => row.name).join(', ')}</p>}
                        {diff!.changed.map(item => <p key={item.row.rowId}>{item.row.name}: {item.fields.join(' · ')}</p>)}
                        <div className="bt-history-rows">{record.rows.map(row => <details key={row.rowId}><summary>{row.name} · {row.accountHolder} · {row.amount.toLocaleString('ko-KR')}원</summary>
                            <p>{row.bankName} · {row.accountNumber} · {row.period} · {row.groupName}</p><p>받는분통장표시: {row.receiverDisplay} / 내통장메모: {row.senderMemo}</p>
                            {row.source === 'account' && <TransferAmountSummary row={row} />}
                            <PayrollTransferDetails row={row} /><SupportTransferDetails row={row} /><RentTransferDetails row={row} />
                        </details>)}</div>
                    </details>
                    {onResults && onRetry && <TransferResultsPanel key={record.id} record={record} onApply={onResults} onRetry={onRetry} />}
                </>}
            </li>;
        })}</ol>
    </details>;
}
