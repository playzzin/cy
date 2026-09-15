import * as XLSX from 'xlsx';
import { canonicalizeImportRow, importHeaderKey, importText, ImportField, ImportRecord } from './masterDataImport';

export type WorkbookSection = { name: string; keywords: string[]; fields: Array<Pick<ImportField, 'label' | 'aliases' | 'required'>> };
export type WorkbookSheetSummary = { name: string; target: string; rows: number; columns: number };

/** Read every matching sheet, retaining source rows and surfacing every unhandled column. */
export function readIntegratedWorkbook<T extends string>(workbook: XLSX.WorkBook, sections: Record<T, WorkbookSection>) {
    const types = Object.keys(sections) as T[];
    const data = Object.fromEntries(types.map(type => [type, []])) as unknown as Record<T, ImportRecord[]>;
    const summaries: WorkbookSheetSummary[] = [];
    const issues: string[] = [];
    const rowIssues = new Map<ImportRecord, string[]>();
    const sources = new Map<ImportRecord, string>();
    const guideNames = new Set(['가이드', '운영플로우', '체크리스트', '오류코드']);
    for (const sheetName of workbook.SheetNames) {
        if (guideNames.has(sheetName)) continue;
        const sheet = workbook.Sheets[sheetName];
        if (!sheet['!ref']) continue;
        const range = XLSX.utils.decode_range(sheet['!ref']);
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false });
        const headers = (matrix[0] || []).map(importText);
        const rows = matrix.slice(1).filter(row => row.some(value => importText(value)));
        if (!rows.length) continue;
        const normalizedName = importHeaderKey(sheetName);
        const exact = types.filter(type => sections[type].keywords.some(keyword => normalizedName === importHeaderKey(keyword)));
        const candidates = exact.length ? exact : types.filter(type => sections[type].keywords.some(keyword => {
            const base = importHeaderKey(keyword);
            return normalizedName.startsWith(base) && /^(?:[_\-\d(]|목록|정보|추가|데이터)/.test(normalizedName.slice(base.length));
        }));
        if (candidates.length !== 1) {
            issues.push(`${sheetName}: ${rows.length}행의 시트를 분류하지 못했습니다. 가이드의 시트명으로 바꿔주세요.`);
            summaries.push({ name: sheetName, target: '미분류', rows: rows.length, columns: headers.length });
            continue;
        }
        const type = candidates[0];
        const section = sections[type];
        const headerKeys = new Set(headers.map(importHeaderKey));
        section.fields.filter(field => field.required).forEach(field => {
            if (![field.label, ...field.aliases].some(label => headerKeys.has(importHeaderKey(label)))) issues.push(`${sheetName}: 필수 컬럼 누락 (${field.label})`);
        });
        const seenHeaders = new Set<string>();
        headers.forEach(header => {
            const key = importHeaderKey(header);
            if (key && seenHeaders.has(key)) issues.push(`${sheetName}: 중복 열 제목 (${header})`);
            seenHeaders.add(key);
        });
        matrix.slice(1).forEach((cells, index) => {
            if (!cells.some(value => importText(value))) return;
            const source = `${sheetName} ${range.s.r + index + 2}행`;
            const raw: ImportRecord = {};
            const cellErrors: string[] = [];
            cells.forEach((value, column) => {
                const header = headers[column] || `제목없는열${column + 1}`;
                raw[header] = value;
                const field = section.fields.find(f => [f.label, ...f.aliases].some(a => importHeaderKey(a) === importHeaderKey(header)));
                const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r + index + 1, c: range.s.c + column })];
                if (cell?.t === 'n' && Math.abs(Number(cell.v)) >= 1e15 && field && /번호|연락처|주민/.test(field.label)) cellErrors.push(`${header}: 긴 숫자는 엑셀에서 정밀도가 손실될 수 있습니다. 원문을 텍스트 형식으로 입력하세요.`);
                if (cell?.t === 'e') cellErrors.push(`${header}: 엑셀 셀 오류를 수정하세요.`);
            });
            const result = canonicalizeImportRow(section.fields, raw);
            const errors = [...result.errors, ...cellErrors];
            data[type].push(result.row);
            rowIssues.set(result.row, errors);
            sources.set(result.row, source);
            if (errors.length) issues.push(`${source}: ${errors.join(' / ')}`);
        });
        summaries.push({ name: sheetName, target: section.name, rows: rows.length, columns: headers.filter(Boolean).length });
    }
    if (!types.some(type => data[type].length)) issues.push('등록할 데이터가 없습니다. 양식의 시트명과 첫 행의 열 제목을 확인하세요.');
    return { data, summaries, issues: [...new Set(issues)], rowIssues, sources };
}
