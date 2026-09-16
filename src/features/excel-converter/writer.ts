import JSZip from 'jszip';
import { recalculateSheet } from './formulaRecalculation';
import { CellTrace, ConversionPlan, DataTable, Issue, LIMITS, Mapping, ConversionResult, WorkbookFile, planSchema } from './types';
import { buildTraces, numberValue, runRules } from './transform';
import { columnName, columnNumber, elements, normalizeZipPath, readWorkbook, serializeXml, xml } from './workbook';
import { validatePlanReferences } from './planning';
import { inputRecordRows } from './mergedLayout';
export { evaluateFormula } from './formula';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const DOCREL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const newNode = (doc: Document, name: string, text?: string) => { const el = doc.createElementNS(NS, name); if (text !== undefined)
    el.textContent = text; return el; };
function containsAddress(range: string, address: string): boolean {
    const parse = (a: string) => { const m = a.replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/); return m ? [columnNumber(m[1]), Number(m[2])] : null; };
    const [start, end = start] = range.split(':');
    const a = parse(start);
    const b = parse(end);
    const c = parse(address);
    return !!a && !!b && !!c && c[0] >= a[0] && c[0] <= b[0] && c[1] >= a[1] && c[1] <= b[1];
}
function validateInputRestrictions(doc: Document, traces: CellTrace[], file: WorkbookFile): Issue[] {
    const issues: Issue[] = [];
    for (const validation of elements(doc, 'dataValidation')) {
        const affected = traces.filter(t => (validation.getAttribute('sqref') || '').split(/\s+/).some(range => containsAddress(range, t.address)));
        const type = validation.getAttribute('type') || 'none';
        const f1 = elements(validation, 'formula1')[0]?.textContent || '';
        const f2 = elements(validation, 'formula2')[0]?.textContent || '';
        for (const trace of affected) {
            if (trace.value === null || trace.value === '') {
                if (!['1', 'true'].includes(validation.getAttribute('allowBlank') || ''))
                    issues.push({ level: 'error', code: 'validation-blank', message: `${trace.label}: 양식의 입력 제한에서 빈값을 허용하지 않습니다.`, location: trace.address });
                continue;
            }
            let valid: boolean | undefined;
            if (type === 'none')
                continue;
            if (type === 'list') {
                let allowed: string[] | undefined;
                if (/^".*"$/.test(f1))
                    allowed = f1.slice(1, -1).split(',');
                else {
                    const ref = f1.replace(/^=/, '').match(/^(?:'((?:[^']|'')+)'|([^!]+))!(\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?)$/);
                    const same = f1.replace(/^=/, '').match(/^\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?$/);
                    const sheet = ref ? file.sheets.find(s => s.name === (ref[1] || ref[2]).replace(/''/g, "'")) : same ? file.sheets.find(s => s.name === trace.sheet) : undefined;
                    if (sheet)
                        allowed = sheet.cells.filter(c => c.value !== null && containsAddress(ref ? ref[3] : same![0], c.address)).map(c => String(c.value));
                }
                if (allowed)
                    valid = allowed.includes(String(trace.value));
            }
            else if (['whole', 'decimal', 'textLength'].includes(type) && numberValue(f1) !== null) {
                const n = type === 'textLength' ? String(trace.value).length : numberValue(trace.value);
                const a = Number(f1);
                const b = numberValue(f2);
                const op = validation.getAttribute('operator') || 'between';
                valid = n !== null && (type !== 'whole' || Number.isInteger(n)) && (op === 'between' ? b !== null && n >= a && n <= b : op === 'notBetween' ? b !== null && (n < a || n > b) : op === 'equal' ? n === a : op === 'notEqual' ? n !== a : op === 'greaterThan' ? n > a : op === 'lessThan' ? n < a : op === 'greaterThanOrEqual' ? n >= a : op === 'lessThanOrEqual' ? n <= a : false);
            }
            if (valid === false)
                issues.push({ level: 'error', code: 'validation-value', message: `${trace.label}: 대상 양식의 허용값·숫자 범위를 벗어납니다.`, location: trace.address });
            if (valid === undefined)
                issues.push({ level: 'warning', code: 'validation-unverified', message: `${trace.label}: 사용자 지정 입력 제한은 Excel에서 확인해야 합니다.`, location: trace.address });
        }
    }
    return issues;
}
const cellIndexes = new WeakMap<Document, {
    data: Element;
    rows: Map<number, Element>;
    cells: Map<string, Element>;
}>();
function getCell(doc: Document, address: string): Element {
    let cache = cellIndexes.get(doc);
    if (!cache) {
        const data = elements(doc, 'sheetData')[0];
        if (!data) throw new Error('시트 데이터 영역이 없습니다.');
        cache = { data, rows: new Map(elements(data, 'row').map(r => [Number(r.getAttribute('r')), r])), cells: new Map(elements(data, 'c').map(c => [c.getAttribute('r')!, c])) };
        cellIndexes.set(doc, cache);
    }
    const data = cache.data;
    const existing = cache.cells.get(address);
    if (existing)
        return existing;
    const n = Number(address.match(/\d+$/)![0]);
    let row = cache.rows.get(n);
    if (!row) {
        row = newNode(doc, 'row');
        row.setAttribute('r', String(n));
        const next = Array.from(cache.rows).filter(([r]) => r > n).sort(([a], [b]) => a - b)[0]?.[1];
        data.insertBefore(row, next || null);
        cache.rows.set(n, row);
    }
    const cell = newNode(doc, 'c');
    cell.setAttribute('r', address);
    const col = columnNumber(address.replace(/\d/g, ''));
    const next = elements(row, 'c').find(c => columnNumber((c.getAttribute('r') || '').replace(/\d/g, '')) > col);
    row.insertBefore(cell, next || null);
    cache.cells.set(address, cell);
    return cell;
}
function assignValue(doc: Document, cell: Element, trace: Pick<CellTrace, 'value' | 'kind'>, date1904: boolean) {
    for (const child of Array.from(cell.children))
        if (['v', 'f', 'is'].includes(child.localName))
            cell.removeChild(child);
    cell.removeAttribute('t');
    if (trace.value === null || trace.value === '')
        return;
    if (trace.kind === 'date') {
        const date = Date.parse(`${trace.value}T00:00:00Z`);
        cell.appendChild(newNode(doc, 'v', String(date / 86400000 + (date1904 ? 24107 : 25569))));
    }
    else if (typeof trace.value === 'number')
        cell.appendChild(newNode(doc, 'v', String(trace.value)));
    else if (typeof trace.value === 'boolean') {
        cell.setAttribute('t', 'b');
        cell.appendChild(newNode(doc, 'v', trace.value ? '1' : '0'));
    }
    else {
        cell.setAttribute('t', 'inlineStr');
        const inline = newNode(doc, 'is');
        const text = newNode(doc, 't', String(trace.value));
        text.setAttribute('xml:space', 'preserve');
        inline.appendChild(text);
        cell.appendChild(inline);
    }
}
function applyFormat(styles: Document, cell: Element, mapping: Mapping, cache: Map<string, number>) {
    const code = mapping.format === 'text' ? '@' : mapping.format === 'date' ? mapping.dateFormat : mapping.format === 'number' || mapping.decimals !== null ? `#,##0${mapping.decimals ? '.' + '0'.repeat(mapping.decimals) : ''}` : '';
    if (!code)
        return;
    const baseId = Number(cell.getAttribute('s') || 0);
    const cacheKey = `${baseId}:${code}`;
    if (cache.has(cacheKey)) {
        cell.setAttribute('s', String(cache.get(cacheKey)));
        return;
    }
    const xfs = elements(styles, 'cellXfs')[0];
    if (!xfs)
        throw new Error('엑셀 서식 정의를 찾을 수 없습니다.');
    let formats = elements(styles, 'numFmts')[0];
    if (!formats) {
        formats = newNode(styles, 'numFmts');
        styles.documentElement.insertBefore(formats, styles.documentElement.firstChild);
    }
    let format = elements(formats, 'numFmt').find(f => f.getAttribute('formatCode') === code);
    if (!format) {
        format = newNode(styles, 'numFmt');
        format.setAttribute('numFmtId', String(Math.max(163, ...elements(formats, 'numFmt').map(f => Number(f.getAttribute('numFmtId')))) + 1));
        format.setAttribute('formatCode', code);
        formats.appendChild(format);
        formats.setAttribute('count', String(formats.children.length));
    }
    const xf = xfs.children[baseId]?.cloneNode(true) as Element;
    if (!xf)
        throw new Error('존재하지 않는 셀 서식입니다.');
    xf.setAttribute('numFmtId', format.getAttribute('numFmtId')!);
    xf.setAttribute('applyNumberFormat', '1');
    const index = xfs.children.length;
    xfs.appendChild(xf);
    xfs.setAttribute('count', String(xfs.children.length));
    cache.set(cacheKey, index);
    cell.setAttribute('s', String(index));
}
const safeFilename = (name: string) => Array.from(name).map(c => c.charCodeAt(0) < 32 ? '_' : c).join('').replace(/[<>:"/\\|?*]/g, '_').replace(/[. ]+$/g, '').slice(0, 100) || '변환결과';
function safeSheetName(name: string, existing: string[]): string { const base = name.replace(/[\\/?*[\]:]/g, '_').replace(/^'|'$/g, '').slice(0, 25) || '결과'; const names = new Set(existing.map(s => s.toLowerCase())); let result = base; let i = 2; while (names.has(result.toLowerCase()))
    result = `${base}_${i++}`.slice(0, 31); return result; }
export async function convertWorkbook(target: WorkbookFile, rawPlan: ConversionPlan, table: DataTable, onProgress?: (message: string) => void, signal?: AbortSignal): Promise<ConversionResult> {
    const started = Date.now();
    const calculationDate = new Date();
    const plan = planSchema.parse(rawPlan);
    const errors = validatePlanReferences(plan, table.fields);
    if (errors.length)
        throw new Error(errors.join('\n'));
    const sourceSheet = target.sheets.find(s => s.name === plan.sheetName);
    if (!sourceSheet)
        throw new Error('대상 시트를 찾을 수 없습니다.');
    const templateZip = await JSZip.loadAsync(new Uint8Array(target.bytes));
    const templateDoc = xml(await templateZip.file(sourceSheet.path)!.async('string'));
    if (elements(templateDoc, 'sheetProtection').length)
        throw new Error('보호된 시트는 변경할 수 없습니다. Excel에서 보호를 해제한 양식을 선택해 주세요.');
    const inputRows = inputRecordRows(sourceSheet, plan);
    for (const fixed of plan.fixedCells) {
        const row = Number(fixed.address.match(/\d+$/)![0]);
        if (row > LIMITS.rows || columnNumber(fixed.address.replace(/\d/g, '')) > LIMITS.columns)
            throw new Error('단일 입력 칸이 지원하는 시트 범위를 초과합니다.');
        if (sourceSheet.merges.some(range => containsAddress(range, fixed.address) && range.split(':')[0] !== fixed.address))
            throw new Error('단일 입력은 병합 셀의 시작 칸에만 지정할 수 있습니다.');
        if (row >= plan.startRow && row <= plan.endRow && plan.mappings.some(m => `${columnName(m.targetColumn)}${row}` === fixed.address))
            throw new Error('단일 입력 칸이 반복 입력 영역과 겹칩니다.');
        if (fixed.mapping.mode !== 'blank' && sourceSheet.cells.some(c => c.address === fixed.address && c.formula))
            throw new Error('단일 입력 칸이 기존 수식과 겹칩니다.');
    }
    const usedKeys = Array.from(new Set([...plan.mappings, ...plan.fixedCells.map(f => f.mapping)].flatMap(m => [...m.sourceKeys, ...(m.verifyKey ? [m.verifyKey] : [])]).concat(plan.rules.sort.map(s => s.key), plan.rules.splitBy ? [plan.rules.splitBy] : [])));
    const processed = runRules(table, plan.rules, usedKeys);
    const result: ConversionResult = { outputs: [], issues: [...processed.issues], excluded: processed.excluded, inputCount: table.rows.length, outputCount: processed.rows.length, elapsedMs: 0 };
    if (!processed.rows.length)
        result.issues.push({ level: 'error', code: 'no-rows', message: '조건에 맞는 데이터가 없습니다. 제외 조건을 확인해 주세요.' });
    for (const override of plan.overrides || [])
        if (!processed.rows.some(r => r.origins.join('\n') === override.originsKey) || !plan.mappings.some(m => m.targetColumn === override.targetColumn && (m.rowOffset || 0) === (override.rowOffset || 0)))
            result.issues.push({ level: 'error', code: 'stale-override', message: '직접 수정한 행의 원본 구성이나 대상 열이 바뀌었습니다. 직접 수정 내역을 해제하고 다시 확인해 주세요.' });
    if (result.issues.some(i => i.level === 'error'))
        return result;
    const groups = new Map<string, typeof processed.rows>();
    for (const row of processed.rows) {
        const key = plan.rules.splitBy ? String(row.values[plan.rules.splitBy] ?? '') : '';
        if (plan.rules.splitBy && !key) {
            result.issues.push({ level: 'error', code: 'split-empty', message: '파일 분리 기준값이 비어 있는 행이 있습니다.', location: row.origins[0] });
            continue;
        }
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key)!.push(row);
    }
    if (result.issues.some(i => i.level === 'error'))
        return result;
    const capacity = inputRows.length;
    // Sheet code names and controls may be referenced by VBA. Split whole
    // workbooks instead of cloning sheets inside a macro-enabled workbook.
    const outputFormat = target.format || (/\.xlsm$/i.test(target.name) ? 'xlsm' : 'xlsx');
    const overflow = outputFormat === 'xlsm' && plan.overflow === 'sheets' ? 'files' : plan.overflow;
    const totalPages = Array.from(groups.values()).reduce((n, rows) => n + Math.ceil(rows.length / capacity), 0);
    if (totalPages > LIMITS.outputs)
        throw new Error('결과 페이지가 100개를 초과합니다. 입력 영역을 늘리거나 데이터를 나누어 주세요.');
    const usedNames = new Set<string>();
    for (const [group, rows] of groups) {
        const pages = Array.from({ length: Math.ceil(rows.length / capacity) }, (_, i) => rows.slice(i * capacity, (i + 1) * capacity));
        if (overflow === 'sheets' && target.sheets.length + pages.length - 1 > LIMITS.sheets)
            throw new Error('복제 후 시트가 30개를 초과합니다. 여러 파일로 나누기를 선택해 주세요.');
        if (pages.length > 1 && overflow === 'stop')
            throw new Error(`양식에는 ${capacity}건을 입력할 수 있지만 결과는 ${rows.length}건입니다. 초과 처리 방법을 선택해 주세요.`);
        if (pages.length > 1 && overflow === 'sheets' && (elements(templateDoc, 'tableParts').length || elements(templateDoc, 'legacyDrawing').length || elements(templateDoc, 'pivotTableParts').length))
            throw new Error('Excel 표·메모·피벗이 있는 양식은 페이지 복제를 지원하지 않습니다. 입력 칸이 충분한 양식을 사용해 주세요.');
        const bundles = overflow === 'files' ? pages.map(p => [p]) : [pages];
        for (let bundleIndex = 0; bundleIndex < bundles.length; bundleIndex++) {
            if (signal?.aborted)
                throw new Error('변환을 중단했습니다.');
            onProgress?.(`${result.outputs.length + 1}번째 파일 작성·검증 중`);
            await new Promise(resolve => setTimeout(resolve, 0));
            const zip = await JSZip.loadAsync(new Uint8Array(target.bytes));
            const workbook = xml(await zip.file('xl/workbook.xml')!.async('string'));
            const rels = xml(await zip.file('xl/_rels/workbook.xml.rels')!.async('string'));
            const contentTypes = xml(await zip.file('[Content_Types].xml')!.async('string'));
            const styles = xml(await zip.file('xl/styles.xml')!.async('string'));
            const styleCache = new Map<string, number>();
            const date1904 = ['1', 'true'].includes(elements(workbook, 'workbookPr')[0]?.getAttribute('date1904') || '');
            const sheetsNode = elements(workbook, 'sheets')[0];
            const allTraces: CellTrace[] = [];
            const outputIssues: Issue[] = [];
            const bundle = bundles[bundleIndex];
            const modifiedPaths: string[] = [];
            for (let page = 0; page < bundle.length; page++) {
                const doc = xml(await templateZip.file(sourceSheet.path)!.async('string'));
                let path = sourceSheet.path;
                let sheetName = sourceSheet.name;
                if (page > 0) {
                    sheetName = safeSheetName(`${sourceSheet.name}_${page + 1}`, elements(workbook, 'sheet').map(s => s.getAttribute('name')!));
                    const id = Math.max(...elements(workbook, 'sheet').map(s => Number(s.getAttribute('sheetId')))) + 1;
                    let suffix = id;
                    do {
                        path = `xl/worksheets/conversion${suffix++}.xml`;
                    } while (zip.file(path));
                    const relationIds = new Set(elements(rels, 'Relationship').map(r => r.getAttribute('Id')));
                    let relationId = `rIdConversion${id}`;
                    while (relationIds.has(relationId))
                        relationId += '_';
                    const sheet = newNode(workbook, 'sheet');
                    sheet.setAttribute('name', sheetName);
                    sheet.setAttribute('sheetId', String(id));
                    sheet.setAttributeNS(DOCREL, 'r:id', relationId);
                    sheetsNode.appendChild(sheet);
                    const relationship = rels.createElementNS(REL, 'Relationship');
                    relationship.setAttribute('Id', relationId);
                    relationship.setAttribute('Type', `${DOCREL}/worksheet`);
                    relationship.setAttribute('Target', path.replace(/^xl\//, ''));
                    rels.documentElement.appendChild(relationship);
                    const override = contentTypes.createElementNS(contentTypes.documentElement.namespaceURI, 'Override');
                    override.setAttribute('PartName', `/${path}`);
                    override.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml');
                    contentTypes.documentElement.appendChild(override);
                    const oldRelPath = sourceSheet.path.replace(/([^/]+)$/, '_rels/$1.rels');
                    const newRelPath = path.replace(/([^/]+)$/, '_rels/$1.rels');
                    if (templateZip.file(oldRelPath))
                        zip.file(newRelPath, await templateZip.file(oldRelPath)!.async('uint8array'));
                    const originalIndex = target.sheets.findIndex(s => s.name === sourceSheet.name);
                    const names = elements(workbook, 'definedName').filter(n => n.getAttribute('localSheetId') === String(originalIndex));
                    for (const name of names) {
                        const clone = name.cloneNode(true) as Element;
                        clone.setAttribute('localSheetId', String(elements(workbook, 'sheet').length - 1));
                        clone.textContent = (clone.textContent || '').split(`'${sourceSheet.name.replace(/'/g, "''")}'!`).join(`'${sheetName.replace(/'/g, "''")}'!`).split(`${sourceSheet.name}!`).join(`'${sheetName.replace(/'/g, "''")}'!`);
                        name.parentNode!.appendChild(clone);
                    }
                }
                // Clear only confirmed input columns; existing formulas remain authoritative.
                for (const r of inputRows)
                    for (const mapping of plan.mappings) {
                        const cell = getCell(doc, `${columnName(mapping.targetColumn)}${r + (mapping.rowOffset || 0)}`);
                        if (!elements(cell, 'f').length)
                            assignValue(doc, cell, { value: null, kind: 'blank' }, date1904);
                    }
                const prepared = buildTraces(plan, bundle[page], sheetName, inputRows);
                outputIssues.push(...prepared.issues, ...validateInputRestrictions(doc, prepared.traces, target));
                for (const trace of prepared.traces) {
                    const cell = getCell(doc, trace.address);
                    if (elements(cell, 'f').length) {
                        if (trace.value !== null)
                            outputIssues.push({ level: 'error', code: 'formula-overwrite', message: `${trace.label}: 기존 수식 칸은 덮어쓸 수 없습니다. 이 열을 빈칸·수식 유지로 설정해 주세요.`, location: `${sheetName}!${trace.address}` });
                        continue;
                    }
                    assignValue(doc, cell, trace, date1904);
                    const mapping = plan.fixedCells.find(f => f.address === trace.address)?.mapping || plan.mappings.find(m => m.targetColumn === columnNumber(trace.address.replace(/\d/g, '')) && inputRows.includes(Number(trace.address.match(/\d+$/)![0]) - (m.rowOffset || 0)))!;
                    applyFormat(styles, cell, mapping, styleCache);
                    allTraces.push(trace);
                }
                const maxRow = Math.max(sourceSheet.rowCount, plan.endRow, ...plan.fixedCells.map(f => Number(f.address.match(/\d+$/)![0])));
                const maxCol = Math.max(sourceSheet.columnCount, ...plan.mappings.map(m => m.targetColumn), ...plan.fixedCells.map(f => columnNumber(f.address.replace(/\d/g, ''))));
                const dim = elements(doc, 'dimension')[0];
                if (dim)
                    dim.setAttribute('ref', `A1:${columnName(maxCol)}${maxRow}`);
                zip.file(path, serializeXml(doc));
                modifiedPaths.push(path);
            }
            if (outputIssues.some(i => i.level === 'error')) {
                result.issues.push(...outputIssues);
                continue;
            }
            // All formula caches are affected by changed values, including untouched sheets.
            const formulaCalculation = { calculated: 0, unresolved: 0 };
            const stringsEntry = zip.file('xl/sharedStrings.xml');
            const sharedStrings = stringsEntry ? elements(xml(await stringsEntry.async('string')), 'si').map(si => elements(si, 't').map(t => t.textContent || '').join('')) : [];
            for (const rel of elements(rels, 'Relationship').filter(r => (r.getAttribute('Type') || '').endsWith('/worksheet'))) {
                const path = normalizeZipPath('xl/workbook.xml', rel.getAttribute('Target')!);
                const entry = zip.file(path);
                if (!entry)
                    continue;
                const doc = xml(await entry.async('string'));
                if (!elements(doc, 'f').length)
                    continue;
                const counts = recalculateSheet(doc, { sharedStrings, date1904, today: calculationDate });
                formulaCalculation.calculated += counts.calculated;
                formulaCalculation.unresolved += counts.unresolved;
                zip.file(path, serializeXml(doc));
            }
            if (formulaCalculation.unresolved)
                outputIssues.push({ level: 'warning', code: 'formula-recalc', message: `수식 ${formulaCalculation.unresolved}개는 Excel에서 재계산해야 합니다. 이전 계산값을 제거했으며 해당 결과는 미검증 상태입니다.` });
            const calc = elements(workbook, 'calcPr')[0] || newNode(workbook, 'calcPr');
            calc.setAttribute('fullCalcOnLoad', '1');
            calc.setAttribute('forceFullCalc', '1');
            calc.setAttribute('calcMode', 'auto');
            if (!calc.parentNode)
                workbook.documentElement.appendChild(calc);
            zip.remove('xl/calcChain.xml');
            elements(rels, 'Relationship').filter(r => (r.getAttribute('Type') || '').endsWith('/calcChain')).forEach(r => r.parentNode!.removeChild(r));
            elements(contentTypes, 'Override').filter(r => r.getAttribute('PartName') === '/xl/calcChain.xml').forEach(r => r.parentNode!.removeChild(r));
            zip.file('xl/workbook.xml', serializeXml(workbook));
            zip.file('xl/_rels/workbook.xml.rels', serializeXml(rels));
            zip.file('[Content_Types].xml', serializeXml(contentTypes));
            zip.file('xl/styles.xml', serializeXml(styles));
            const bytes = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
            const base = safeFilename(`${target.name.replace(/\.xls[xm]$/i, '')}${group ? `_${group}` : ''}${bundles.length > 1 ? `_${bundleIndex + 1}` : ''}_변환완료`);
            let name = `${base}.${outputFormat}`;
            let duplicate = 2;
            while (usedNames.has(name))
                name = `${base}_${duplicate++}.${outputFormat}`;
            usedNames.add(name);
            const reread = await readWorkbook(bytes, name);
            const rereadValues = new Map(reread.sheets.map(s => [s.name, new Map(s.cells.map(c => [c.address, c.value]))]));
            for (const trace of allTraces) {
                const actual = rereadValues.get(trace.sheet)?.get(trace.address) ?? null;
                if ((actual ?? '') !== (trace.value ?? ''))
                    outputIssues.push({ level: 'error', code: 'roundtrip', message: '저장 후 다시 읽은 값이 계획과 다릅니다.', location: `${trace.sheet}!${trace.address}` });
            }
            bundle.forEach((pageRows, index) => {
                const sheetName = index === 0 ? sourceSheet.name : elements(workbook, 'sheet')[target.sheets.length + index - 1]?.getAttribute('name');
                const sheet = reread.sheets.find(s => s.name === sheetName);
                pageRows.forEach((row, i) => plan.mappings.filter(m => m.verifyKey).forEach(mapping => {
                    const address = `${columnName(mapping.targetColumn)}${inputRows[i] + (mapping.rowOffset || 0)}`;
                    const expected = numberValue(row.values[mapping.verifyKey]);
                    const actual = numberValue(sheet?.cells.find(c => c.address === address)?.value ?? null);
                    if (expected === null || actual === null || Math.abs(expected - actual) > 0.0000001)
                        outputIssues.push({ level: 'error', code: 'reconciliation', message: `${mapping.label}: 양식 계산 결과와 원본의 대응 값이 일치하지 않습니다. 계산식·합산·단가를 확인해 주세요.`, location: `${sheetName}!${address}` });
                }));
                plan.fixedCells.filter(f => f.mapping.verifyKey).forEach(({ address, mapping }) => {
                    const expected = numberValue(pageRows[0]?.values[mapping.verifyKey] ?? null);
                    const actual = numberValue(sheet?.cells.find(c => c.address === address)?.value ?? null);
                    if (expected === null || actual === null || Math.abs(expected - actual) > 0.0000001) outputIssues.push({ level: 'error', code: 'reconciliation', message: `${mapping.label}: 원본 금액과 양식 계산 결과가 다릅니다.`, location: `${sheetName}!${address}` });
                });
            });
            result.outputs.push({ name, bytes, sheets: reread.sheets, traces: allTraces, issues: outputIssues, inputCount: table.rows.length, excludedCount: processed.excluded.length, outputCount: bundle.flat().length, group, formulaCalculation });
            result.issues.push(...outputIssues);
        }
    }
    result.elapsedMs = Date.now() - started;
    return result;
}
