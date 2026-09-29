import { ConversationMessage } from './conversation';
import { CellTrace, ConversionPlan, ConversionResult, DataTable, Scalar, WorkbookFile, planSchema } from './types';
import { VerificationSummary } from './verification';
import { columnName, columnNumber } from './workbook';
import { strictDate } from './transform';

export type ChatMessage = ConversationMessage & { versionId?: string };
export interface ResultVersion {
  id: string; number: number; parentId?: string; createdAt: number;
  plan: ConversionPlan; history: ConversationMessage[];
  result: ConversionResult; request: string; verification: VerificationSummary; reused: boolean;
}
export interface CellLocation { outputIndex: number; sheet: string; address: string; stage?: 'source' | 'target' | 'result' }
export interface CellSelection extends CellLocation { revision: string; scope: 'cell' | 'row' }
export interface ReviewChange { id: string; kind: 'changed' | 'moved' | 'added' | 'removed' | 'formatted' | 'formula' | 'macro'; label: string; before: Scalar; after: Scalar; location: CellLocation; previousLocation?: CellLocation }
export const clonePlan = (plan: ConversionPlan): ConversionPlan => planSchema.parse(JSON.parse(JSON.stringify(plan)));
export const showValue = (value: Scalar | undefined) => value === null || value === undefined || value === '' ? '(빈칸)' : typeof value === 'number' ? value.toLocaleString('ko-KR', { maximumFractionDigits: 8 }) : String(value);

function indexedCells(version: ResultVersion) {
  const entries = new Map<string, { trace: CellTrace; location: CellLocation; value: Scalar }>();
  version.result.outputs.forEach((output, outputIndex) => {
    const cells = new Map(output.sheets.flatMap(sheet => sheet.cells.map(cell => [`${sheet.name}!${cell.address}`, cell] as const)));
    const rowTraces = new Map(output.traces.map(t => [`${t.sheet}:${Number(t.address.match(/\d+/)?.[0])}`, t]));
    for (const trace of output.traces) {
      if(cells.get(`${trace.sheet}!${trace.address}`)?.formula)continue;
      const field = trace.mappingKey ?? `${trace.label}:${trace.address.replace(/\d/g, '')}`;
      // List-form headers belong to the output page, not whichever person is
      // first after sorting. Personal forms still follow the person's identity.
      const record = field.startsWith('fixed:') && version.plan.mappings.length
        ? `common:${output.group}:${outputIndex}:${trace.sheet}`
        : trace.recordKey ?? trace.origins.join('\n');
      const key = JSON.stringify([record, field]);
      // Older or ambiguous traces are kept separate rather than silently overwritten.
      const unique = entries.has(key) ? `${key}:${outputIndex}:${trace.sheet}:${trace.address}` : key;
      entries.set(unique, { trace: { ...trace, recordKey: record }, location: { outputIndex, sheet: trace.sheet, address: trace.address }, value: cells.get(`${trace.sheet}!${trace.address}`)?.value ?? trace.value });
    }
    for (const sheet of output.sheets) for (const cell of sheet.cells.filter(c => c.formula)) {
      const rowTrace = rowTraces.get(`${sheet.name}:${cell.row}`);
      const record = rowTrace?.recordKey || `formula:${output.group}:${outputIndex}:${sheet.name}:${cell.address}`;
      const field = `formula:${cell.col}`;
      const trace: CellTrace = { sheet:sheet.name,address:cell.address,label:'계산값',value:cell.value,origins:[],rule:'formula',kind:cell.kind,recordKey:record,mappingKey:field };
      entries.set(JSON.stringify([record,field]), {trace,location:{outputIndex,sheet:sheet.name,address:cell.address},value:cell.value});
    }
  });
  return entries;
}

export function compareVersions(current: ResultVersion, previous?: ResultVersion): ReviewChange[] {
  if (!previous) return [];
  const before = indexedCells(previous), after = indexedCells(current);
  const changes: ReviewChange[] = [];
  const moved = new Set<string>();
  for (const [id, entry] of after) {
    const old = before.get(id);
    if (!old) changes.push({ id, kind: 'added', label: entry.trace.label, before: null, after: entry.value, location: entry.location });
    else if (old.value !== entry.value) changes.push({ id, kind: 'changed', label: entry.trace.label, before: old.value, after: entry.value, location: entry.location, previousLocation: old.location });
    else if (JSON.stringify(old.location) !== JSON.stringify(entry.location)) {
      const record = entry.trace.recordKey ?? entry.trace.origins.join('\n');
      if (!moved.has(record)) { moved.add(record); changes.push({ id, kind: 'moved', label: '행 위치', before: `${old.location.sheet}!${old.location.address}`, after: `${entry.location.sheet}!${entry.location.address}`, location: entry.location, previousLocation: old.location }); }
    }
  }
  for (const [id, entry] of before) if (!after.has(id)) changes.push({ id, kind: 'removed', label: entry.trace.label, before: entry.value, after: null, location: entry.location, previousLocation: entry.location });
  if(JSON.stringify(current.plan.edits)!==JSON.stringify(previous.plan.edits))current.result.outputs.forEach((output,outputIndex)=>{
    const old=previous.result.outputs[outputIndex];if(!old)return;
    for(const sheet of output.sheets){const prior=old.sheets.find(s=>s.name===sheet.name);if(!prior)continue;
      const appearance=(s:typeof sheet)=>JSON.stringify({merges:s.merges,widths:s.presentation?.widths,heights:s.presentation?.heights,cells:s.cells.map(c=>[c.address,s.presentation?.styles[c.style]])});
      if(appearance(sheet)!==appearance(prior)||JSON.stringify(current.plan.edits.filter(e=>e.kind==='page'))!==JSON.stringify(previous.plan.edits.filter(e=>e.kind==='page')))changes.push({id:`format:${outputIndex}:${sheet.name}`,kind:'formatted',label:'문서 서식',before:'이전 서식',after:'요청한 글꼴·색상·배치 반영',location:{outputIndex,sheet:sheet.name,address:current.plan.edits.some(e=>e.kind==='style')?(current.plan.edits.find(e=>e.kind==='style') as {range:string}).range.split(':')[0]:'A1'}});
    }
  });
  if(JSON.stringify(current.plan.formulaEdits)!==JSON.stringify(previous.plan.formulaEdits))current.result.outputs.forEach((output,outputIndex)=>{
    for(const sheet of output.sheets){const old=previous.result.outputs[outputIndex]?.sheets.find(s=>s.name===sheet.name);if(!old)continue;const oldFormulas=new Map(old.cells.map(c=>[c.address,c.formula]));
      for(const cell of sheet.cells){const before=oldFormulas.get(cell.address);if(cell.formula!==before&&(cell.formula||before))changes.push({id:`formula:${outputIndex}:${sheet.name}:${cell.address}`,kind:'formula',label:'계산식',before:before?'='+before:null,after:cell.formula?'='+cell.formula:null,location:{outputIndex,sheet:sheet.name,address:cell.address}});}
    }
  });
  for(const edit of current.plan.macroEdits)if(previous.plan.macroEdits.find(m=>m.module===edit.module)?.code!==edit.code)changes.push({id:'macro:'+edit.module,kind:'macro',label:edit.module,before:'이전 VBA 코드',after:'수정한 VBA 코드 저장 · 실행은 Excel에서 확인',location:{outputIndex:0,sheet:current.plan.sheetName,address:'A1'}});
  for(const edit of previous.plan.macroEdits)if(!current.plan.macroEdits.some(m=>m.module===edit.module))changes.push({id:'macro-restore:'+edit.module,kind:'macro',label:edit.module,before:'수정된 VBA 코드',after:'원본 VBA 코드로 복원',location:{outputIndex:0,sheet:current.plan.sheetName,address:'A1'}});
  return changes;
}

export function selectedTrace(version: ResultVersion, selection?: CellSelection) {
  if (!selection || selection.revision !== version.id) return undefined;
  return version.result.outputs[selection.outputIndex]?.traces.find(trace => trace.sheet === selection.sheet && trace.address === selection.address);
}

export function explainSelection(version: ResultVersion, table: DataTable, selection?: CellSelection): string {
  if (!selection || selection.revision !== version.id) return `결과 ${version.number}은 ${version.result.inputCount}건 중 ${version.result.outputCount}건을 작성했습니다.\n현재 조건: ${activeConditions(version.plan,table).map(c=>c.label).join(', ') || '원본 내용을 양식에 맞게 옮기기'}\n궁금한 셀을 선택하면 원본 위치와 적용한 규칙을 확인할 수 있어요.`;
  const output = version.result.outputs[selection.outputIndex];
  const cell = output?.sheets.find(sheet => sheet.name === selection.sheet)?.cells.find(cell => cell.address === selection.address);
  if (!cell) return '선택한 칸은 비어 있습니다. 원본 값이나 작성 규칙이 연결된 칸을 선택해 주세요.';
  const trace = selectedTrace(version, selection);
  if (cell.formula) {
    const sheet = output.sheets.find(sheet => sheet.name === selection.sheet)!;
    const refs = Array.from(new Set(cell.formula.match(/\$?[A-Z]{1,3}\$?\d+/g) || [])).slice(0, 8);
    const values = refs.map(ref => `${ref} = ${showValue(sheet.cells.find(c => c.address === ref.replace(/\$/g, ''))?.value)}`);
    return `${selection.sheet}!${cell.address}: ${cell.displayText ?? showValue(cell.value)}\n양식의 수식 =${cell.formula}\n${values.join('\n')}\n${cell.value === null ? '계산하지 못한 수식입니다. Excel에서 재계산이 필요합니다.' : '이 결과 파일에 저장된 계산값입니다. 범위 수식의 참조 목록은 시작·끝 주소를 보여줍니다.'}`;
  }
  if (!trace) return `${selection.sheet}!${cell.address}: ${cell.displayText ?? showValue(cell.value)}\n받을 양식에서 유지한 내용입니다.`;
  const mapping = trace.mappingKey?.startsWith('fixed:') ? version.plan.fixedCells.find(f => f.address === trace.address)?.mapping : version.plan.mappings.find(m => `column:${m.targetColumn}:${m.rowOffset || 0}` === trace.mappingKey);
  const rows = table.rows.filter(row => (trace.recordKey || trace.origins.join('\n')).split('\n').some(origin => row.origins.includes(origin)));
  const values = rows.slice(0, 5).flatMap(row => (mapping?.sourceKeys || []).map(key => `${table.fields.find(f => f.key === key)?.label || key}: ${showValue(row.values[key])}`));
  return `${trace.label} · ${selection.sheet}!${cell.address}: ${cell.displayText ?? showValue(cell.value)}\n원본 위치: ${trace.origins.join(', ')}\n적용: ${trace.rule === 'copy' ? '원본 값 그대로 옮기기' : trace.rule === 'constant' ? '사용자가 지정한 고정값' : trace.rule === 'blank' ? '빈칸 유지' : trace.rule}\n${values.join('\n')}`.trim();
}

export function activeConditions(plan: ConversionPlan, table?: DataTable): { id: string; label: string; removable: boolean }[] {
  const name = (key: string) => table?.fields.find(field => field.key === key)?.label || key;
  return [
    ...plan.rules.sort.map((sort, i) => ({ id: `sort:${i}`, label: `${name(sort.key)} ${sort.direction === 'asc' ? '오름차순' : '내림차순'}`, removable: true })),
    ...plan.rules.filters.map((filter, i) => ({ id: `filter:${i}`, label: `${name(filter.key)} ${({ eq:'같음', neq:'다름', contains:'포함', notContains:'미포함', gt:'초과', gte:'이상', lt:'미만', lte:'이하', empty:'빈칸', notEmpty:'값 있음' })[filter.op]} ${filter.value}`, removable: true })),
    ...(plan.rules.groupBy.length ? [{ id: 'group', label: `${plan.rules.groupBy.map(name).join('·')}별 합산`, removable: true }] : []),
    ...(plan.rules.splitBy ? [{ id: 'split', label: `${name(plan.rules.splitBy)}별 분리`, removable: true }] : []),
    ...[...plan.mappings, ...plan.fixedCells.map(f => f.mapping)].filter(m => m.mode === 'constant' || (m.mode === 'blank' && /서명|날인/.test(m.label))).map((m, i) => ({ id: `mapping:${i}`, label: `${m.label}: ${m.mode === 'blank' ? '비우기' : showValue(m.constant)}`, removable: false })),
    ...(plan.overrides.length ? [{ id: 'overrides', label: `직접 수정 ${plan.overrides.length}칸`, removable: true }] : []),
    ...(plan.formulaEdits.length ? [{id:'formulas',label:`수식 편집 ${plan.formulaEdits.length}개`,removable:true}] : []),
    ...(plan.macroEdits.length ? [{id:'macros',label:`매크로 편집 ${plan.macroEdits.length}개`,removable:true}] : []),
    ...(plan.edits.length ? [{id:'appearance',label:`서식 편집 ${plan.edits.length}개`,removable:true}] : []),
  ];
}

export function removeCondition(plan: ConversionPlan, id: string): ConversionPlan {
  const next = clonePlan(plan), [kind, index] = id.split(':');
  if (kind === 'sort') next.rules.sort.splice(Number(index), 1);
  if (kind === 'filter') next.rules.filters.splice(Number(index), 1);
  if (kind === 'group') { next.rules.groupBy = []; next.rules.sums = []; }
  if (kind === 'split') next.rules.splitBy = '';
  if (kind === 'overrides') next.overrides = [];
  if (kind === 'formulas') next.formulaEdits = [];
  if (kind === 'macros') next.macroEdits = [];
  if (kind === 'appearance') next.edits = [];
  return next;
}

export function editSelectedCell(version: ResultVersion, selection: CellSelection, value: Scalar, kind: 'text' | 'number' | 'date' | 'boolean' | 'blank'): ConversionPlan {
  if (kind === 'date' && !strictDate(String(value ?? ''))) throw new Error('유효한 날짜를 연-월-일 형식으로 입력해 주세요.');
  if (selection.revision !== version.id) throw new Error('결과가 바뀌었습니다. 수정할 칸을 다시 선택해 주세요.');
  const output = version.result.outputs[selection.outputIndex];
  const cell = output?.sheets.find(s => s.name === selection.sheet)?.cells.find(c => c.address === selection.address);
  if (cell?.formula) throw new Error('수식 칸은 직접 덮어쓸 수 없습니다. 계산에 쓰인 입력값을 선택해 주세요.');
  const trace = selectedTrace(version, selection);
  if (!trace?.mappingKey || !trace.recordKey) throw new Error('이 칸은 작성 대상이 아닙니다. 원본에서 옮긴 입력칸을 선택해 주세요.');
  const next = clonePlan(version.plan);
  if (trace.mappingKey.startsWith('fixed:')) {
    if (output.outputCount !== 1) throw new Error('이 칸은 여러 사람의 공통 항목입니다. 회사명·현장명 등의 변경은 전체 요청으로 입력해 주세요.');
    next.overrides = next.overrides.filter(o => !(o.originsKey === trace.recordKey && o.fixedAddress === trace.address));
    next.overrides.push({originsKey:trace.recordKey,targetColumn:columnNumber(trace.address.replace(/\d/g,'')),fixedAddress:trace.address,value,kind});
    return planSchema.parse(next);
  }
  const [, column, offset] = trace.mappingKey.split(':');
  next.overrides = next.overrides.filter(o => !(o.originsKey === trace.recordKey && !o.fixedAddress && o.targetColumn === Number(column) && (o.rowOffset || 0) === Number(offset)));
  next.overrides.push({ originsKey: trace.recordKey, targetColumn: Number(column), rowOffset: Number(offset), value, kind });
  return planSchema.parse(next);
}

export function sourceLocation(trace: CellTrace, source: WorkbookFile, table: DataTable, plan: ConversionPlan): CellLocation | undefined {
  const row = table.rows.find(row => row.origins.some(origin => (trace.recordKey || trace.origins.join('\n')).split('\n').includes(origin)));
  if (!row) return undefined;
  const mapping = trace.mappingKey?.startsWith('fixed:') ? plan.fixedCells.find(f => f.address === trace.address)?.mapping : plan.mappings.find(m => `column:${m.targetColumn}:${m.rowOffset || 0}` === trace.mappingKey);
  const field = table.fields.find(f => f.key === mapping?.sourceKeys[0]);
  for (const origin of row.origins) {
    const match = origin.match(/!([A-Z]*)(\d+)/);
    const rowMatch = origin.match(/\/\s*(\d+)(?:~\d+)?행/);
    const sheet = source.sheets.find(s => origin.includes(s.name));
    if (match && sheet) return { stage: 'source', outputIndex: 0, sheet: sheet.name, address: `${match[1] || columnName(field?.col || 1)}${match[2]}` };
    if (rowMatch && sheet) {
      const start = Number(rowMatch[1]), end = Number(origin.match(/~(\d+)행/)?.[1] || start);
      const value = field ? row.values[field.key] : null;
      const candidates = value === null || value === undefined || value === '' ? [] : sheet.cells.filter(c=>c.row>=start&&c.row<=end&&(c.value===value||(typeof c.value==='string'&&c.value.includes(String(value)))));
      return { stage:'source',outputIndex:0,sheet:sheet.name,address:candidates.length===1?candidates[0].address:`A${start}` };
    }
  }
  return undefined;
}

export function selectionMapping(version: ResultVersion, selection: CellSelection) {
  const trace = selectedTrace(version, selection);
  if (trace?.mappingKey?.startsWith('fixed:') && version.result.outputs[selection.outputIndex]?.outputCount === 1) return version.plan.fixedCells.find(f=>f.address===trace.address)?.mapping;
  const col = columnNumber(selection.address.replace(/\d/g, ''));
  return trace?.mappingKey?.startsWith('column:') ? version.plan.mappings.find(m => m.targetColumn === col && `column:${m.targetColumn}:${m.rowOffset || 0}` === trace.mappingKey) : undefined;
}
