import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { TransferExportRecord, TransferResult, TransferRow } from './types';
import { matchTransferResults, readTransferResultFile, ResultColumns } from './transferResults';

const emptyColumns: ResultColumns = { bank: -1, account: -1, amount: -1, status: -1, note: -1 };
const columnLabels: Record<keyof ResultColumns, string> = { bank: '은행코드', account: '계좌번호', amount: '이체금액', status: '처리결과', note: '비고' };
export default function TransferResultsPanel({ record, onApply, onRetry }: {
    record: TransferExportRecord; onApply: (id: string, results: TransferResult[], fileName?: string) => void; onRetry: (rows: TransferRow[]) => void;
}) {
    const [book, setBook] = useState<Awaited<ReturnType<typeof readTransferResultFile>>>();
    const [sheetName, setSheetName] = useState(''), [fileName, setFileName] = useState('');
    const [header, setHeader] = useState(1), [columns, setColumns] = useState<ResultColumns>(emptyColumns);
    const [successText, setSuccessText] = useState('성공,정상,이체완료'), [failedText, setFailedText] = useState('실패,오류,이체실패');
    const [error, setError] = useState(''), [loading, setLoading] = useState(false), [showMatches, setShowMatches] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [manual, setManual] = useState<Record<string, TransferResult>>({});
    const sequence = useRef(0);
    useEffect(() => () => { sequence.current += 1; }, []);
    const sheet = book?.sheets[sheetName] ?? [];
    const headers = sheet[header - 1] ?? [];
    const comparison = useMemo(() => {
        try { return { matches: matchTransferResults(sheet.slice(header), columns, record.rows ?? [], successText, failedText, header + 1), error: '' }; }
        catch (err) { return { matches: [], error: err instanceof Error ? err.message : '열을 선택해 주세요.' }; }
    }, [sheet, header, columns, record.rows, successText, failedText]);
    const resultsById = new Map(record.results?.map(result => [result.rowId, result]));
    const failedRows = (record.rows ?? []).filter(row => resultsById.get(row.rowId)?.status === 'failed');
    const successful = record.results?.filter(result => result.status === 'success').length ?? 0;
    const resetPreview = () => { setShowMatches(false); setSelected(new Set()); };
    const readFile = async (file: File) => {
        const current = ++sequence.current;
        setLoading(true); setError(''); setBook(undefined); resetPreview();
        try {
            const parsed = await readTransferResultFile(file);
            if (current !== sequence.current) return;
            setBook(parsed); setSheetName(parsed.names[0]); setFileName(file.name); setHeader(1); setColumns(emptyColumns);
        } catch (err) { if (current === sequence.current) setError(err instanceof Error ? err.message : '파일을 읽지 못했습니다.'); }
        finally { if (current === sequence.current) setLoading(false); }
    };
    const chosen = comparison.matches.filter(match => selected.has(match.line) && match.result).map(match => match.result!);
    const changed = chosen.filter(result => resultsById.has(result.rowId) && resultsById.get(result.rowId)?.status !== result.status).length;
    return <details className="bt-results-panel"><summary>이체 결과 확인 · 성공 {successful} / 실패 {failedRows.length} / 미확인 {record.rowCount - (record.results?.length ?? 0)}</summary>
        <p>위 파일 생성 이력에 해당하는 은행 결과인지 먼저 확인하세요. 은행코드·계좌번호·금액이 모두 일치하는 항목만 연결합니다. 급여·월세·지원비 원본의 지급 상태는 바뀌지 않습니다.</p>
        {record.resultsUpdatedAt && <p>최근 결과 기록: {new Date(record.resultsUpdatedAt).toLocaleString('ko-KR')}{record.resultFileName ? ` · ${record.resultFileName}` : ' · 개별 확인'}</p>}
        <label className="bt-result-upload">은행 결과 파일 선택<input aria-label="은행 결과 파일 선택" type="file" accept=".xlsx,.xls,.csv" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void readFile(file); }} /></label>
        {loading && <p role="status">결과 파일을 읽고 있습니다…</p>}{error && <p role="alert" className="bt-invalid">{error}</p>}
        {book && <div className="bt-result-mapping">
            <label>시트<select aria-label="결과 파일 시트" value={sheetName} onChange={event => { setSheetName(event.target.value); setHeader(1); setColumns(emptyColumns); resetPreview(); }}>{book.names.map(name => <option key={name}>{name}</option>)}</select></label>
            <label>제목 행<input aria-label="결과 파일 제목 행" type="number" min={1} max={Math.max(1, sheet.length)} value={header} onChange={event => { setHeader(Math.max(1, Math.min(sheet.length || 1, Number(event.target.value) || 1))); setColumns(emptyColumns); resetPreview(); }} /></label>
            {(Object.keys(columnLabels) as (keyof ResultColumns)[]).map(key => <label key={key}>{columnLabels[key]} 열<select aria-label={`${columnLabels[key]} 결과 열`} value={columns[key]} onChange={event => { setColumns({ ...columns, [key]: Number(event.target.value) }); resetPreview(); }}><option value={-1}>{key === 'note' ? '사용 안 함' : '선택하세요'}</option>{headers.map((name, index) => <option key={index} value={index}>{index + 1}열 · {name || '(제목 없음)'}</option>)}</select></label>)}
            <label>성공 표시<input aria-label="성공 결과 표시" value={successText} onChange={event => { setSuccessText(event.target.value); resetPreview(); }} /></label>
            <label>실패 표시<input aria-label="실패 결과 표시" value={failedText} onChange={event => { setFailedText(event.target.value); resetPreview(); }} /></label>
            <p>은행코드 열에는 정확한 은행명도 사용할 수 있습니다. 파일의 결과 문구는 쉼표로 구분합니다. 계좌번호 앞자리 0이 사라진 파일은 원본을 다시 확인하세요.</p>
            <button onClick={() => { setError(comparison.error); if (!comparison.error) { setShowMatches(true); setSelected(new Set()); } }}>연결 결과 미리보기</button>
        </div>}
        {showMatches && <div className="bt-result-match"><p>연결 가능 {comparison.matches.filter(match => match.result).length}건 / 개별 확인 {comparison.matches.filter(match => !match.result).length}건</p>
            <label><input type="checkbox" aria-label="연결 가능한 결과 전체 선택" checked={comparison.matches.some(match => match.result) && comparison.matches.filter(match => match.result).every(match => selected.has(match.line))} onChange={event => setSelected(new Set(event.target.checked ? comparison.matches.filter(match => match.result).map(match => match.line) : []))} /> 연결 가능한 결과 전체 선택</label>
            <ul>{comparison.matches.map(match => <li key={match.line}><label><input type="checkbox" aria-label={`결과 ${match.line}행 선택`} disabled={!match.result} checked={selected.has(match.line)} onChange={event => setSelected(previous => { const next = new Set(previous); event.target.checked ? next.add(match.line) : next.delete(match.line); return next; })} />{match.line}행 · {match.account} · {match.amount}원 · {match.rawStatus} · {match.message}</label></li>)}</ul>
            {!!changed && <p className="bt-invalid">기존 성공·실패 기록 {changed}건이 변경됩니다. 선택한 결과를 확인하세요.</p>}
            <button disabled={!chosen.length} onClick={() => { onApply(record.id, chosen, fileName); resetPreview(); }}>선택 {chosen.length}건 결과 반영</button>
        </div>}
        <details><summary>은행 내역을 보고 개별 기록하기</summary><div className="bt-result-manual">{record.rows?.map(row => <label key={row.rowId}><span>{row.name} · {row.accountNumber} · {row.amount.toLocaleString('ko-KR')}원 <small>현재: {resultsById.get(row.rowId)?.status === 'success' ? '성공' : resultsById.get(row.rowId)?.status === 'failed' ? '실패' : '미확인'}{resultsById.get(row.rowId)?.note ? ` · ${resultsById.get(row.rowId)?.note}` : ''}</small></span>
            <select aria-label={`${row.name} 확인한 이체 결과`} value={manual[row.rowId]?.status ?? ''} onChange={event => setManual(previous => { const next = { ...previous }; if (event.target.value) next[row.rowId] = { rowId: row.rowId, status: event.target.value as 'success' | 'failed', note: next[row.rowId]?.note ?? '' }; else delete next[row.rowId]; return next; })}><option value="">변경 안 함</option><option value="success">성공 확인</option><option value="failed">실패 확인</option></select>
            <input aria-label={`${row.name} 결과 비고`} maxLength={500} placeholder="확인 내용 / 실패 사유" disabled={!manual[row.rowId]} value={manual[row.rowId]?.note ?? ''} onChange={event => setManual({ ...manual, [row.rowId]: { ...manual[row.rowId], note: event.target.value } })} />
        </label>)}</div><button disabled={!Object.keys(manual).length} onClick={() => { onApply(record.id, Object.values(manual)); setManual({}); }}>개별 확인 {Object.keys(manual).length}건 반영</button></details>
        <button disabled={!failedRows.length} onClick={() => onRetry(failedRows.map(row => ({ ...row, retryContext: { exportFileName: record.fileName, failureReason: resultsById.get(row.rowId)?.note ?? '' } })))}>실패 {failedRows.length}건으로 새 송금 목록 만들기</button>
    </details>;
}
