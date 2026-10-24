import { CellSelection, clonePlan, compareVersions, editSelectedCell, explainSelection, ResultVersion, selectedTrace, selectionMapping, showValue } from './review';
import { ConversionPlan, DataTable, Scalar } from './types';
import { strictDate } from './transform';

export function isExplanationRequest(text: string): boolean {
  if (/(글꼴|글씨|글자|폰트|배경|파란|빨간|노란|색상|테두리|너비|높이|굵게|크게|작게|예쁘게|깔끔|병합|줄바꿈|가운데|오른쪽|왼쪽|서식.*(?:변경|수정|바꿔|되돌))/.test(text)&&!/(왜|이유|근거|뭐가|무엇이|어떻게.*됐)/.test(text)) return false;
  if (/(바꿔|바꾸어|바꿔서|비워|지워|옮겨|만들어|넣어|(?:변경|수정|정렬|제외|합산|적용|추가|삭제)(?:해|하[고여]|\s*부탁|\s*요청))/.test(text)) return false;
  return /(왜|어디서|어디에서|근거|설명|어떻게.*(계산|나왔)|무슨.*(뜻|의미)|(?:무엇|뭐|어디|어떤).*(변경|달라|바뀌)|어떤.*(조건|규칙)|변경\s*내역|(?:누가|누구).*(빠졌|제외|누락)|(?:경고|오류|문제).*(있|뭐|무엇|어떤|확인)|알려\s*줘)/.test(text);
}

export function explainRequest(request: string, version: ResultVersion, table: DataTable, selection?: CellSelection, previous?: ResultVersion): string {
  if (/(변경\s*내역|달라|바뀌|무엇.*변경|뭐.*변경)/.test(request)) {
    if (!previous) return '첫 결과라 비교할 이전 결과가 없습니다. 셀을 선택하면 작성한 값의 원본 근거를 확인할 수 있어요.';
    const changes = compareVersions(version, previous);
    if (!changes.length) return `결과 ${previous.number}과 비교했을 때 작성 값과 행 위치가 같습니다.`;
    const labels = {changed:'값 변경',moved:'행 이동',added:'추가',removed:'제외',formatted:'서식 변경',formula:'수식 변경',macro:'매크로 변경'};
    const summary = (['changed','moved','added','removed','formatted','formula','macro'] as const).map(kind=>[labels[kind],changes.filter(c=>c.kind===kind).length] as const).filter(([,count])=>count).map(([label,count])=>`${label} ${count}${label==='행 이동'?'행':label==='서식 변경'?'개 시트':'칸'}`).join(' · ');
    return `결과 ${previous.number} → 결과 ${version.number}: ${summary}\n${changes.slice(0,6).map(c=>`${c.label}: ${showValue(c.before)} → ${showValue(c.after)}`).join('\n')}${changes.length>6?'\n나머지는 미리보기의 변경 내역에서 확인해 주세요.':''}`;
  }
  if (/(경고|문제|오류)/.test(request)) {
    const warnings = version.result.issues.filter(i=>i.level!=='info');
    return warnings.length ? `결과 ${version.number}에서 확인할 내용 ${warnings.length}개입니다.\n${warnings.slice(0,6).map(i=>`• ${i.message}`).join('\n')}` : `결과 ${version.number}의 검사에서 발견한 오류나 경고가 없습니다.`;
  }
  if (/(누가|누구|제외된|누락된).*(빠졌|제외|누락|사람|인원)|제외.*이유/.test(request)) {
    const excluded = version.result.excluded.filter(e=>!table.skipped.some(s=>s.origin===e.origin&&s.reason===e.reason));
    return excluded.length ? `적용한 조건으로 제외된 원본 ${excluded.length}건입니다.\n${excluded.slice(0,8).map(e=>`${e.origin}: ${e.reason}`).join('\n')}` : '적용한 조건으로 제외된 인원은 없습니다. 빈 줄·합계 행 등 원본 구조상 제외한 항목은 변경 내역에서 확인할 수 있습니다.';
  }
  return explainSelection(version,table,selection);
}

export function selectedRequest(version: ResultVersion, selection: CellSelection, request: string): ConversionPlan {
  let target = selection;
  if (selection.scope === 'row') {
    const origin = selectedTrace(version, selection)?.recordKey;
    const matches = version.result.outputs[selection.outputIndex]?.traces.filter(t => t.recordKey === origin && request.includes(t.label)) || [];
    if (matches.length !== 1) throw new Error('이 행에서 바꿀 항목을 하나 지정해 주세요. 예: “주소를 서울로 바꿔줘”. 또는 수정할 셀을 선택해 주세요.');
    target = { ...selection, address: matches[0].address, scope: 'cell' };
  }
  const mapping = selectionMapping(version, target);
  if (!mapping) throw new Error('수식·제목·공통 항목은 이 방식으로 수정할 수 없습니다. 개별 입력칸을 선택하거나 선택을 해제하고 전체 요청을 입력해 주세요.');
  if (/(비워|빈칸으로|지워)/.test(request)) return editSelectedCell(version, target, null, 'blank');
  const match = request.match(/(?:을|를|은|는|값|여기|이 칸|이 부분|선택한 칸)\s*[:=]?\s*["“']?(.+?)["”']?\s*(?:으로|로)\s*(?:바꿔|변경|수정|설정)/);
  if (!match) throw new Error('선택한 칸의 새 값을 알려주세요. 예: “이 칸을 서울로 바꿔줘”, “이 칸을 비워줘”. 원본 근거 탭에서 값을 직접 입력할 수도 있어요.');
  let value: Scalar = match[1].replace(/^(?:을|를)\s*/, '').replace(/^["“']|["”']$/g, '').trim();
  const cell = version.result.outputs[target.outputIndex].sheets.find(s => s.name === target.sheet)?.cells.find(c => c.address === target.address);
  const kind = mapping.format === 'text' ? 'text' : cell?.kind === 'number' ? 'number' : cell?.kind === 'date' ? 'date' : 'text';
  if (kind === 'number') { if (!/^-?(?:\d[\d,]*)(?:\.\d+)?$/.test(value)) throw new Error('숫자 입력칸입니다. 새 숫자를 명확히 입력해 주세요.'); value = Number(value.replace(/,/g, '')); }
  if (kind === 'date' && !strictDate(value)) throw new Error('날짜는 연-월-일 형식으로 알려주세요.');
  return editSelectedCell(version, target, value, kind);
}

// Reassert unrelated rules from the immutable base. Only the current request can
// authorize a new filter, sort or grouping; old conversation text is not consent.
export function preserveUnrequestedRules(next: ConversionPlan, base: ConversionPlan, request: string): ConversionPlan {
  const result = clonePlan(next);
  if (!/(정렬|순서|오름|내림|역순|이름순)/.test(request)) result.rules.sort = base.rules.sort;
  if (!/(제외|빼|만\s|만$|필터|미만|이상|초과|이하|없는|있는|모두|전체|전부|복원)/.test(request)) result.rules.filters = base.rules.filters;
  if (!/(합산|합쳐|묶|집계|합계|그룹|개별)/.test(request)) { result.rules.groupBy = base.rules.groupBy; result.rules.sums = base.rules.sums; }
  if (!/(분리|나눠|나누|파일별|한 파일)/.test(request)) result.rules.splitBy = base.rules.splitBy;
  const related = (label: string) => {
    if (/(모든|전체).*?(초기화|원본대로|원본 값)/.test(request)) return true;
    if (request.includes(label)) return true;
    return [['회사','상호'],['현장','사업장'],['성명','이름'],['서명','날인'],['주소'],['주민','생년'],['금액','임금','노임','지급액'],['공수'],['계좌'],['은행'],['단가']].some(words => words.some(word=>label.includes(word)) && words.some(word=>request.includes(word)));
  };
  const protectedMapping = (mapping: ConversionPlan['mappings'][number]) => (mapping.mode === 'constant' || (mapping.mode === 'blank' && /서명|날인/.test(mapping.label))) && !related(mapping.label);
  for (const mapping of base.mappings.filter(protectedMapping)) {
    const index = result.mappings.findIndex(m => m.targetColumn === mapping.targetColumn && (m.rowOffset || 0) === (mapping.rowOffset || 0));
    if (index < 0) result.mappings.push(mapping); else result.mappings[index] = mapping;
  }
  for (const fixed of base.fixedCells.filter(f => protectedMapping(f.mapping))) {
    const index = result.fixedCells.findIndex(f => f.address === fixed.address);
    if (index < 0) result.fixedCells.push(fixed); else result.fixedCells[index] = fixed;
  }
  result.overrides = base.overrides;
  result.edits = base.edits; result.formulaEdits=base.formulaEdits; result.macroEdits=base.macroEdits;
  return result;
}

export function applicableHistory(version: ResultVersion | undefined) { return version?.history || []; }

export function conditionContext(plan: ConversionPlan, table: DataTable): string {
  // Values stay in the existing plan; do not repeat source rows in the prompt.
  const labels = plan.rules.sort.map(s => `${table.fields.find(f => f.key === s.key)?.label || s.key} ${s.direction === 'asc' ? '오름차순' : '내림차순'}`);
  return `\n현재 plan의 조건이 기준이다. 이번 요청과 관계없는 정렬·필터·합산·고정값을 유지한다. 취소된 조건을 이전 대화에서 복구하지 않는다.${labels.length ? ` 적용 중인 정렬: ${labels.join(', ')}.` : ''}`;
}
