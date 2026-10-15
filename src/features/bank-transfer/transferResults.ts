import * as XLSX from 'xlsx-js-style';
import type { TransferExportRecord, TransferResult, TransferRow } from './types';
import { BANK_CODES } from '../../pages/payroll/constants/payroll.constants';

// @guide-sync 07: 결과 열·연결 기준·성공/실패 판정을 바꾸면 transferGuideContent.ts의 결과 안내와
// TransferGuideSimulator.tsx의 Results, transferGuideSimulation.ts의 결과 반영·재처리 연습도 수정한다.
export type ResultColumns = { bank: number; account: number; amount: number; status: number; note: number };
export type ResultMatch = { line: number; account: string; amount: string; rawStatus: string; result?: TransferResult; message: string };
const cleanAccount = (value: string) => value.trim().replace(/[ -]/g, '');
const keyFor = (bank: string, account: string, amount: number) => `${bank}:${account}:${amount}`;
const labels = (value: string) => new Set(value.split(',').map(part => part.trim()).filter(Boolean));
const bankKey = (value: string) => value.replace(/\s/g, '').toUpperCase();
const exactBanks = new Map([...Object.entries(BANK_CODES).map(([code, name]) => [bankKey(name), code] as [string, string]),
    ...['국민', 'KB국민', 'KB국민은행'].map(name => [bankKey(name), '004'] as [string, string])]);

/** Exact bank + account + amount matching. Names, row order and partial account numbers are never used. */
export function matchTransferResults(data: string[][], columns: ResultColumns, rows: TransferRow[], successText: string, failedText: string, firstLine = 2): ResultMatch[] {
    const required = [columns.bank, columns.account, columns.amount, columns.status];
    if (required.some(column => column < 0) || new Set(required).size !== required.length || (columns.note >= 0 && required.includes(columns.note))) throw new Error('은행코드·계좌번호·금액·결과 열을 각각 다르게 선택해 주세요.');
    const success = labels(successText), failed = labels(failedText);
    if (!success.size || !failed.size || [...success].some(label => failed.has(label))) throw new Error('성공·실패 표시는 비워둘 수 없으며 서로 겹치면 안 됩니다.');
    const index = new Map<string, TransferRow[]>();
    rows.forEach(row => {
        const key = keyFor(row.bankCode.trim(), cleanAccount(row.accountNumber), row.amount);
        index.set(key, [...(index.get(key) ?? []), row]);
    });
    const counts = new Map<string, number>();
    const parsed = data.map((cells, i): ResultMatch => {
        const bankText = (cells[columns.bank] ?? '').trim();
        const bank = /^\d{1,3}$/.test(bankText) ? bankText.padStart(3, '0') : exactBanks.get(bankKey(bankText)) ?? '';
        const account = cleanAccount(cells[columns.account] ?? '');
        const amountText = (cells[columns.amount] ?? '').trim().replace(/,/g, '');
        const amount = Number(amountText);
        const rawStatus = (cells[columns.status] ?? '').trim();
        const base = { line: firstLine + i, account, amount: cells[columns.amount] ?? '', rawStatus };
        if (!/^\d{3}$/.test(bank) || !/^\d{6,20}$/.test(account) || !/^\d+$/.test(amountText) || !Number.isSafeInteger(amount) || amount <= 0) return { ...base, message: '은행코드·계좌·금액 형식 확인 (앞자리 0 포함)' };
        const matches = index.get(keyFor(bank, account, amount)) ?? [];
        if (matches.length !== 1) return { ...base, message: matches.length ? '동일 계좌·금액이 여러 건이라 자동 연결 불가' : '생성 당시 내역과 일치하는 항목 없음' };
        counts.set(matches[0].rowId, (counts.get(matches[0].rowId) ?? 0) + 1);
        const status = success.has(rawStatus) ? 'success' : failed.has(rawStatus) ? 'failed' : undefined;
        if (!status) return { ...base, message: '결과 표시를 확인해 주세요. 미확인으로 유지합니다.' };
        return { ...base, result: { rowId: matches[0].rowId, status, note: (cells[columns.note] ?? '').slice(0, 500) }, message: `${matches[0].name} · ${status === 'success' ? '성공' : '실패'}` };
    });
    // Duplicate source lines (including contradictory statuses) must be resolved explicitly, never last-write-wins.
    return parsed.map(item => item.result && counts.get(item.result.rowId)! > 1 ? { ...item, result: undefined, message: '결과 파일에 같은 대상이 여러 줄입니다. 개별 확인 필요' } : item)
        .filter((_, index) => data[index].some(cell => cell.trim()));
}

export function mergeTransferResults(record: TransferExportRecord, incoming: TransferResult[]) {
    const rows = new Set(record.rows?.map(row => row.rowId));
    if (!record.rows || incoming.some(result => !rows.has(result.rowId) || !['success', 'failed'].includes(result.status) || result.note.length > 500)
        || new Set(incoming.map(result => result.rowId)).size !== incoming.length) throw new Error('결과 대상이 생성 당시 목록과 일치하지 않습니다.');
    const results = new Map((record.results ?? []).map(result => [result.rowId, result]));
    incoming.forEach(result => results.set(result.rowId, { ...result }));
    return [...results.values()];
}

export async function readTransferResultFile(file: File): Promise<{ names: string[]; sheets: Record<string, string[][]> }> {
    if (file.size > 5_000_000) throw new Error('결과 파일은 5MB 이하로 나누어 주세요.');
    if (!/\.(xlsx?|csv)$/i.test(file.name)) throw new Error('엑셀(.xlsx, .xls) 또는 CSV 파일을 선택해 주세요.');
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error('결과 파일을 읽지 못했습니다.'));
        reader.onerror = () => reject(new Error('결과 파일을 읽지 못했습니다.'));
        reader.readAsArrayBuffer(file);
    });
    let workbook: XLSX.WorkBook;
    try { workbook = XLSX.read(buffer, { type: 'array', cellText: true, sheetRows: 5002, raw: true }); }
    catch { throw new Error('파일을 열 수 없습니다. 암호를 해제한 엑셀 또는 UTF-8 CSV를 사용해 주세요.'); }
    const sheets: Record<string, string[][]> = Object.create(null);
    workbook.SheetNames.forEach(name => {
        const sheet = workbook.Sheets[name];
        const range = XLSX.utils.decode_range(sheet['!fullref'] ?? sheet['!ref'] ?? 'A1');
        if (range.e.r >= 5000 || range.e.c >= 100) throw new Error('결과 파일은 제목을 포함해 5,000행·100열 이하로 나누어 주세요.');
        sheets[name] = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '', blankrows: true });
    });
    if (!workbook.SheetNames.length) throw new Error('결과 파일에 시트가 없습니다.');
    return { names: workbook.SheetNames, sheets };
}
