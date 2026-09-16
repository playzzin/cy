import { blankMapping, ConversionPlan, DataTable, emptyRules, Field, JoinSpec, Mapping, planSchema, Rules, WorkbookFile } from './types';
import { extractTable, normalizeLabel } from './workbook';

const SYNONYMS = [
  ['품명', '품목명', '상품명', '제품명', 'itemname', 'productname'], ['품번', '품목코드', '상품코드', '제품코드', 'sku'],
  ['수량', '납품수량', '주문수량', 'quantity', 'qty'], ['단가', '공급단가', 'unitprice'],
  ['공급가액', '공급금액', '세전금액'], ['납기', '납기일', '납품예정일', '입고예정일', '납품일'],
  ['규격', '제품규격', 'spec'], ['단위', '수량단위', 'unit'], ['거래처', '납품처', '납품처명', '고객사'],
  ['주소', '기본주소'], ['상세주소', '주소상세'], ['상태', '주문상태', '처리상태'], ['비고', '메모', '참고사항'],
];
export function suggestMapping(label: string, column: number, fields: Field[], dictionary: Record<string, string> = {}): Mapping {
  const mapping = blankMapping(label, column); const normalized = normalizeLabel(label);
  const chosen = dictionary[label]; const group = SYNONYMS.find(g => g.map(normalizeLabel).includes(normalized));
  const candidates = fields.filter(f => chosen ? f.label === chosen : normalizeLabel(f.label) === normalized || group?.some(g => normalizeLabel(g) === normalizeLabel(f.label)));
  mapping.required = /\*|필수/.test(label);
  if (candidates.length === 1) {
    mapping.sourceKeys = [candidates[0].key]; mapping.mode = 'copy'; mapping.confirmed = true;
    mapping.format = /코드|품번|전화|우편|계좌/.test(label) ? 'text' : candidates[0].kind === 'date' ? 'date' : 'keep';
    mapping.reason = chosen ? '저장된 업무 사전으로 연결' : `${candidates[0].label}와 의미가 일치합니다.`;
  } else mapping.reason = candidates.length ? '같은 의미의 원본 항목이 여러 개입니다. 사용할 열을 선택해 주세요.' : '연결할 원본 항목을 선택하거나 빈칸으로 확인해 주세요.';
  return mapping;
}
export function createPlan(target: WorkbookFile, sheetName: string, fields: Field[], dictionary: Record<string, string> = {}, headerRow?: number): ConversionPlan {
  const sheet = target.sheets.find(s => s.name === sheetName); if (!sheet) throw new Error('대상 시트를 선택해 주세요.');
  const header = headerRow || sheet.headerRow; const startRow = header + 1;
  const total = sheet.cells.find(c => c.row > header && /^(합계|총계|소계|총합계|total)$/i.test(String(c.value).trim()));
  const endRow = total ? total.row - 1 : Math.max(startRow, sheet.rowCount);
  return planSchema.parse({ version: 1, targetId: target.id, sheetName, headerRow: header, startRow, endRow, mappings: sheet.cells.filter(c => c.row === header && c.value !== null).map(c => {
    const mapping = suggestMapping(String(c.value), c.col, fields, dictionary);
    if (sheet.cells.some(body => body.col === c.col && body.row === startRow && body.formula)) return { ...mapping, mode: 'blank', verifyKey: mapping.sourceKeys[0] || '', sourceKeys: [], required: false, confirmed: true, reason: '기존 수식을 유지하고 원본의 대응 금액과 계산 결과를 검증합니다.' };
    return mapping;
  }), fixedCells: [], rules: emptyRules(), overflow: 'sheets', summary: ['머리글을 기준으로 항목을 연결했습니다. 입력 시작·마지막 행을 확인해 주세요.'], questions: [], origin: 'local' });
}
export function applyJoins(primary: DataTable, files: WorkbookFile[], joins: JoinSpec[]): DataTable {
  const result: DataTable = { fields: [...primary.fields], rows: primary.rows.map(r => ({ ...r, values: { ...r.values }, origins: [...r.origins] })), warnings: [...primary.warnings], skipped: [...primary.skipped] };
  for (const join of joins) {
    const file = files.find(f => f.id === join.fileId); if (!file) throw new Error('연결할 보조 자료를 찾을 수 없습니다.');
    const lookup = extractTable(file, join.sheetName, join.headerRow, true, join.prefix);
    const key = `${join.prefix}c${join.rightColumn}`; const index = new Map<string, typeof lookup.rows[number]>();
    if (!result.fields.some(f => f.key === join.leftKey) || !lookup.fields.some(f => f.key === key)) throw new Error('자료 연결 기준 열을 선택해 주세요.');
    for (const row of lookup.rows) {
      const v = row.values[key]; if (v === null || v === '') continue;
      if (index.has(String(v))) throw new Error(`보조 자료의 연결 기준이 중복됩니다: ${file.name}. 중복 행을 정리하거나 다른 기준을 선택해 주세요.`);
      index.set(String(v), row);
    }
    for (const row of result.rows) {
      const match = index.get(String(row.values[join.leftKey] ?? ''));
      if (!match) throw new Error(`보조 자료에서 연결하지 못한 행이 있습니다: ${row.origins[0]}`);
      row.values = { ...row.values, ...match.values }; row.origins.push(...match.origins);
    }
    if (lookup.fields.some(f => result.fields.some(r => r.key === f.key))) throw new Error('보조 자료 식별자가 중복되었습니다.');
    result.fields.push(...lookup.fields.map(f => ({ ...f, label: `${file.name.replace(/\.xlsx$/i, '')} · ${f.label}` })));
    result.warnings.push(...lookup.warnings);
  }
  return result;
}
export function describeRules(rules: Rules, fields: Field[]): string[] {
  const label = (key: string) => fields.find(f => f.key === key)?.label || key;
  const op = { eq: '같음', neq: '다름', contains: '포함', notContains: '미포함', gt: '초과', gte: '이상', lt: '미만', lte: '이하', notEmpty: '값 있음', empty: '빈칸' };
  return [
    ...rules.filters.map(f => `${label(f.key)} ${op[f.op]} ${f.value}`),
    ...(rules.groupBy.length ? [`${rules.groupBy.map(label).join(' + ')} 기준으로 묶어 ${rules.sums.map(label).join(', ') || '선택 항목'} 합산`] : []),
    ...rules.sort.map(s => `${label(s.key)} ${s.direction === 'asc' ? '오름차순' : '내림차순'} 정렬`),
    ...(rules.splitBy ? [`${label(rules.splitBy)}별 결과 파일 분리`] : []),
    ...(!rules.includeHidden ? ['숨김 행 제외'] : []),
  ];
}
export function validatePlanReferences(plan: ConversionPlan, fields: Field[]): string[] {
  const errors: string[] = []; const keys = new Set(fields.map(f => f.key));
  const used = [...plan.mappings, ...plan.fixedCells.map(f => f.mapping)].flatMap(m => [...m.sourceKeys, ...(m.verifyKey ? [m.verifyKey] : [])]).concat(plan.rules.groupBy, plan.rules.sums, plan.rules.filters.map(f => f.key), plan.rules.sort.map(s => s.key), plan.rules.splitBy ? [plan.rules.splitBy] : []);
  for (const key of Array.from(new Set(used))) if (!keys.has(key)) errors.push(`존재하지 않는 원본 항목: ${key}`);
  if (plan.startRow <= plan.headerRow || plan.endRow < plan.startRow) errors.push('입력 영역은 머리글 다음 행부터 시작해야 합니다.');
  if (plan.endRow - plan.startRow > 10000) errors.push('입력 영역은 한 번에 10,000행 이내로 지정해 주세요.');
  const columns = plan.mappings.map(m => m.targetColumn); if (new Set(columns).size !== columns.length) errors.push('같은 대상 열에 두 규칙을 적용할 수 없습니다.');
  const addresses = plan.fixedCells.map(f => f.address); if (new Set(addresses).size !== addresses.length) errors.push('같은 단일 입력 칸에 두 규칙을 적용할 수 없습니다.');
  for (const m of [...plan.mappings, ...plan.fixedCells.map(f => f.mapping)]) {
    if (!m.confirmed) errors.push(`${m.label}: 연결 또는 빈칸 처리를 확인해 주세요.`);
    if (m.required && (m.mode === 'blank' || (m.mode === 'constant' && (m.constant === null || m.constant === '')))) errors.push(`${m.label}: 필수 항목입니다.`);
    if (['copy', 'concat', 'product'].includes(m.mode) && !m.sourceKeys.length) errors.push(`${m.label}: 원본 항목을 선택해 주세요.`);
    if (m.mode === 'copy' && m.sourceKeys.length !== 1) errors.push(`${m.label}: 그대로 입력은 원본 항목 하나만 선택할 수 있습니다.`);
  }
  if (plan.rules.groupBy.length && !plan.rules.sums.length) errors.push('합산할 숫자 항목을 선택해 주세요.');
  if (!plan.rules.groupBy.length && plan.rules.sums.length) errors.push('합산 기준 항목을 선택해 주세요.');
  if (plan.rules.sums.some(k => plan.rules.groupBy.includes(k))) errors.push('같은 항목을 합산 기준과 합산 값으로 동시에 사용할 수 없습니다.');
  errors.push(...plan.questions);
  return errors;
}
