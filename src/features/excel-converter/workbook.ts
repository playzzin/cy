import JSZip from 'jszip';
import { readPresentation } from './previewStyles';
import { DataTable, Field, LIMITS, Scalar, SheetInfo, ValueKind, WorkbookFile } from './types';

export const columnName = (column: number): string => { let n = column; let result = ''; while (n > 0) { n--; result = String.fromCharCode(65 + n % 26) + result; n = Math.floor(n / 26); } return result; };
export const columnNumber = (name: string): number => Array.from(name.toUpperCase()).reduce((n, char) => n * 26 + char.charCodeAt(0) - 64, 0);
export const normalizeLabel = (label: string) => label.toLowerCase().replace(/필수/g, '').replace(/[\s_\-()*[\]]/g, '');
export const xml = (text: string): Document => { if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('외부 정의가 포함된 XML은 처리할 수 없습니다.'); const doc = new DOMParser().parseFromString(text, 'application/xml'); if (doc.getElementsByTagName('parsererror').length) throw new Error('엑셀 내부 XML이 손상되었습니다.'); return doc; };
export const elements = (node: Document | Element, tag: string): Element[] => Array.from(node.getElementsByTagNameNS('*', tag));
export const serializeXml = (doc: Document) => new XMLSerializer().serializeToString(doc);
export const normalizeZipPath = (base: string, target: string): string => { const path: string[] = target.startsWith('/') ? [] : base.split('/').slice(0, -1); target.split('/').forEach(part => { if (part === '..') path.pop(); else if (part && part !== '.') path.push(part); }); return path.join('/'); };

// Inspect the ZIP central directory before inflation to bound uploaded workbooks.
export function validateArchive(bytes: ArrayBuffer): void {
  if (bytes.byteLength > LIMITS.fileBytes) throw new Error('파일 하나는 20MB 이하로 선택해 주세요.');
  const view = new DataView(bytes); let total = 0; let count = 0;
  for (let i = 0; i + 46 <= view.byteLength; i++) {
    if (view.getUint32(i, true) !== 0x02014b50) continue;
    const size = view.getUint32(i + 24, true); total += size; count++;
    if (size === 0xffffffff || total > LIMITS.expandedBytes || count > 5000) throw new Error('압축을 푼 크기가 너무 크거나 지원하지 않는 엑셀입니다.');
    i += 45 + view.getUint16(i + 28, true) + view.getUint16(i + 30, true) + view.getUint16(i + 32, true);
  }
  if (!count) throw new Error('정상적인 .xlsx 파일을 선택해 주세요. 암호화 파일은 지원하지 않습니다.');
}
export async function fingerprint(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest)).map(n => n.toString(16).padStart(2, '0')).join('');
}
export function detectHeader(cells: SheetInfo['cells']): number {
  const rows = new Map<number, number>();
  cells.filter(c => c.row <= 100 && c.kind === 'text' && !c.formula && String(c.value).length < 60).forEach(c => rows.set(c.row, (rows.get(c.row) || 0) + 1));
  return Array.from(rows).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] || 1;
}
export async function readWorkbook(bytes: ArrayBuffer, name: string, id = `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`): Promise<WorkbookFile> {
  if (!/\.xlsx$/i.test(name)) throw new Error('.xlsx 파일만 지원합니다. 구형·매크로 파일은 Excel에서 .xlsx로 저장해 주세요.');
  validateArchive(bytes);
  const zip = await JSZip.loadAsync(new Uint8Array(bytes));
  if (!zip.file('xl/workbook.xml')) throw new Error('엑셀 통합문서가 아닙니다.');
  if (Object.keys(zip.files).some(p => /vbaProject|externalLinks\/externalLink|_xmlsignatures|activeX|embeddings\//i.test(p))) throw new Error('매크로·외부 연결·전자서명·실행 개체가 있는 파일은 지원하지 않습니다.');
  const manifest = xml(await zip.file('xl/workbook.xml')!.async('string'));
  const rels = xml(await zip.file('xl/_rels/workbook.xml.rels')!.async('string'));
  const paths = new Map(elements(rels, 'Relationship').map(r => [r.getAttribute('Id'), normalizeZipPath('xl/workbook.xml', r.getAttribute('Target') || '')]));
  const sheetPaths = new Map(elements(manifest, 'sheet').map(s => [s.getAttribute('name'), paths.get(s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')) || '']));
  if (sheetPaths.size > LIMITS.sheets) throw new Error('한 파일에서 최대 30개 시트까지 지원합니다.');
  const sharedStrings = zip.file('xl/sharedStrings.xml') ? elements(xml(await zip.file('xl/sharedStrings.xml')!.async('string')), 'si').map(si => elements(si, 't').map(t => t.textContent || '').join('')) : [];
  const styleDoc = zip.file('xl/styles.xml') ? xml(await zip.file('xl/styles.xml')!.async('string')) : null;
  const formatCodes = new Map<number, string>([[14, 'mm-dd-yy'], [15, 'd-mmm-yy'], [16, 'd-mmm'], [17, 'mmm-yy'], [22, 'm/d/yy h:mm'], [49, '@']]);
  if (styleDoc) elements(styleDoc, 'numFmt').forEach(f => formatCodes.set(Number(f.getAttribute('numFmtId')), f.getAttribute('formatCode') || ''));
  const cellFormats = styleDoc ? Array.from(elements(styleDoc, 'cellXfs')[0]?.children || []).map(f => formatCodes.get(Number(f.getAttribute('numFmtId'))) || '') : [];
  const date1904 = ['1', 'true'].includes(elements(manifest, 'workbookPr')[0]?.getAttribute('date1904') || '');
  const sheets: SheetInfo[] = [];
  for (const [name, path] of Array.from(sheetPaths)) {
    if (!path || !zip.file(path)) throw new Error('엑셀 시트 연결 정보가 올바르지 않습니다.');
    const doc = xml(await zip.file(path)!.async('string'));
    const info: SheetInfo = { name: name!, path, cells: [], rowCount: 0, columnCount: 0, headerRow: 1, merges: elements(doc, 'mergeCell').map(m => m.getAttribute('ref') || ''), hiddenRows: [], hiddenColumns: [], warnings: [] };
    for (const row of elements(doc, 'row')) { const r = Number(row.getAttribute('r')); info.rowCount = Math.max(info.rowCount, r); if (['1', 'true'].includes(row.getAttribute('hidden') || '')) info.hiddenRows.push(r); }
    for (const col of elements(doc, 'col')) if (['1', 'true'].includes(col.getAttribute('hidden') || '')) for (let c = Number(col.getAttribute('min')); c <= Math.min(LIMITS.columns, Number(col.getAttribute('max'))); c++) info.hiddenColumns.push(c);
    const cellNodes = elements(doc, 'c'); if (cellNodes.length > 250000) throw new Error('시트에 사용된 셀이 250,000개를 초과합니다. 데이터를 나누어 주세요.');
    for (const cell of cellNodes) {
      const address = cell.getAttribute('r') || ''; const match = address.match(/^([A-Z]+)(\d+)$/); if (!match) throw new Error('셀 주소가 올바르지 않습니다.');
      const row = Number(match[2]); const col = columnNumber(match[1]); const style = Number(cell.getAttribute('s') || 0); const format = cellFormats[style] || '';
      info.rowCount = Math.max(info.rowCount, row); info.columnCount = Math.max(info.columnCount, col);
      if (info.rowCount > LIMITS.rows || info.columnCount > LIMITS.columns) throw new Error('시트당 30,000행·100열 이내로 준비해 주세요.');
      const type = cell.getAttribute('t'); const raw = elements(cell, 'v')[0]?.textContent ?? ''; const f = elements(cell, 'f')[0]; const formula = f ? f.textContent || '(공유 수식)' : undefined;
      let value: Scalar = null; let kind: ValueKind = 'blank';
      if (type === 'inlineStr') { value = elements(cell, 't').map(t => t.textContent || '').join(''); kind = 'text'; }
      else if (type === 's') { value = sharedStrings[Number(raw)] ?? ''; kind = 'text'; }
      else if (type === 'str' || type === 'e') { value = raw; kind = 'text'; }
      else if (type === 'b') { value = raw === '1'; kind = 'boolean'; }
      else if (type === 'd' && raw) { value = raw.slice(0, 10); kind = 'date'; }
      else if (raw !== '') {
        const number = Number(raw); if (!Number.isFinite(number)) throw new Error(`${name}!${address}: 숫자 형식이 올바르지 않습니다.`);
        if (/^0{2,}$/.test(format)) { value = String(number).padStart(format.length, '0'); kind = 'text'; }
        else if (/[yd]/i.test(format.replace(/"[^"]*"|\[[^\]]*\]/g, ''))) { value = new Date(Math.round((number - (date1904 ? 24107 : 25569)) * 86400000)).toISOString().slice(0, 10); kind = 'date'; }
        else { value = number; kind = 'number'; }
      }
      info.cells.push({ address, row, col, value, kind, formula, text: value === null ? '' : String(value), style, hidden: info.hiddenRows.includes(row) || info.hiddenColumns.includes(col) });
    }
    info.presentation = readPresentation(styleDoc, doc);
    info.headerRow = detectHeader(info.cells);
    if (elements(doc, 'sheetProtection').length) info.warnings.push('보호된 시트입니다. 보호를 해제한 양식을 사용해 주세요.');
    if (elements(doc, 'tableParts').length) info.warnings.push('Excel 표가 포함되어 있습니다. 페이지 복제는 지원하지 않으며 기존 영역 안에서 작성할 수 있습니다.');
    if (info.hiddenRows.length) info.warnings.push(`숨김 행 ${info.hiddenRows.length}개: 포함 여부를 확인해 주세요.`);
    if (info.cells.some(c => c.formula && c.value === null)) info.warnings.push('계산 결과가 저장되지 않은 수식이 있습니다. 원본 데이터라면 Excel에서 재계산 후 저장해 주세요.');
    sheets.push(info);
  }
  return { id, name, bytes: bytes.slice(0), sheets, fingerprint: await fingerprint(bytes), warnings: [] };
}
export function extractTable(file: WorkbookFile, sheetName: string, headerRow: number, includeHidden = true, prefix = ''): DataTable {
  const sheet = file.sheets.find(s => s.name === sheetName); if (!sheet) throw new Error('선택한 시트를 찾을 수 없습니다.');
  const headers = sheet.cells.filter(c => c.row === headerRow && c.value !== null);
  const labels = new Set<string>(); const warnings: string[] = [];
  const fields: Field[] = headers.map(c => {
    const label = String(c.value).trim(); if (labels.has(label)) warnings.push(`중복 머리글: ${label}. 열 위치를 확인해 주세요.`); labels.add(label);
    const sample = sheet.cells.find(s => s.col === c.col && s.row > headerRow && s.value !== null && !s.formula);
    return { key: `${prefix}c${c.col}`, label, col: c.col, kind: sample?.kind || 'text' };
  });
  const byRow = new Map<number, Map<number, SheetInfo['cells'][number]>>();
  sheet.cells.filter(c => c.row > headerRow).forEach(c => { if (!byRow.has(c.row)) byRow.set(c.row, new Map()); byRow.get(c.row)!.set(c.col, c); });
  const rows: DataTable['rows'] = []; const skipped: DataTable['skipped'] = [];
  for (const [row, cells] of byRow) {
    const origin = `${file.name} / ${sheetName} / ${row}행`;
    const values = Object.fromEntries(fields.map(f => [f.key, cells.get(f.col)?.value ?? null]));
    if (Object.values(values).every(v => v === null || v === '')) continue;
    if (!includeHidden && sheet.hiddenRows.includes(row)) { skipped.push({ origin, reason: '숨김 행 제외' }); continue; }
    if (fields.length && fields.every(f => String(values[f.key] ?? '') === f.label)) { skipped.push({ origin, reason: '반복 머리글' }); continue; }
    const first = Object.values(values).find(v => v !== null && v !== '');
    if (/^(총\s*합계|합계|소계|총계|subtotal|grand total)$/i.test(String(first).trim())) { skipped.push({ origin, reason: '합계 행' }); continue; }
    for (const f of fields) { const c = cells.get(f.col); if (c?.formula && c.value === null) warnings.push(`${origin} ${f.label}: 수식 계산값이 없습니다.`); if (typeof c?.value === 'string' && /^#(REF!|DIV\/0!|VALUE!|N\/A|NUM!|NAME\?)/.test(c.value)) warnings.push(`${origin} ${f.label}: 원본 오류 ${c.value}`); }
    rows.push({ id: `${file.id}:${sheetName}:${row}`, values, origins: [origin] });
  }
  return { fields, rows, warnings, skipped };
}
export const templateSignature = (sheet: SheetInfo, headerRow: number) => JSON.stringify({ name: sheet.name, headers: sheet.cells.filter(c => c.row === headerRow).map(c => [c.col, c.value]), merges: sheet.merges, formulas: sheet.cells.filter(c => c.formula).map(c => [c.address, c.formula]) });
export function describeTemplateChanges(previous: SheetInfo, next: SheetInfo): string[] {
  const oldHeaders = previous.cells.filter(c => c.row === previous.headerRow && c.value !== null); const newHeaders = next.cells.filter(c => c.row === next.headerRow && c.value !== null); const changes: string[] = [];
  for (const c of newHeaders) { const old = oldHeaders.find(o => normalizeLabel(String(o.value)) === normalizeLabel(String(c.value))); if (!old) changes.push(`추가: ${c.value} (${c.address})`); else if (old.address !== c.address) changes.push(`이동: ${c.value} ${old.address} → ${c.address}`); }
  for (const c of oldHeaders) if (!newHeaders.some(n => normalizeLabel(String(n.value)) === normalizeLabel(String(c.value)))) changes.push(`삭제: ${c.value}`);
  if (previous.merges.join() !== next.merges.join()) changes.push('병합 영역이 변경되었습니다.');
  if (JSON.stringify(previous.cells.filter(c => c.formula).map(c => [c.address, c.formula])) !== JSON.stringify(next.cells.filter(c => c.formula).map(c => [c.address, c.formula]))) changes.push('수식 또는 합계 위치가 변경되었습니다.');
  return changes.length ? changes : ['선택한 시트의 머리글·병합·수식 구조가 같습니다.'];
}
