import { ConversionPlan, SheetInfo } from './types';

const point = (address: string) => {
  const match = address.replace(/\$/g, '').match(/^([A-Z]+)([1-9]\d*)$/);
  if (!match) throw new Error('병합 셀 주소가 올바르지 않습니다.');
  return { row: Number(match[2]), col: Array.from(match[1]).reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) };
};
export function mergeBounds(range: string) {
  const [a, b = a] = range.split(':');
  const start = point(a), end = point(b);
  if (start.row > end.row || start.col > end.col) throw new Error('병합 셀 범위가 올바르지 않습니다.');
  return { range, start, end };
}

// Physical rows for each record. Never unmerge cells or put data into hidden
// children of a merge. Different record heights may coexist in a template.
export function inputRecordRows(sheet: SheetInfo, plan: Pick<ConversionPlan, 'startRow' | 'endRow' | 'mappings' | 'recordHeight'>): number[] {
  if (!plan.mappings.length) return Array.from({ length: plan.endRow - plan.startRow + 1 }, (_, i) => plan.startRow + i);
  const columns = new Set(plan.mappings.map(m => m.targetColumn));
  if (plan.recordHeight || plan.mappings.some(m => m.rowOffset)) return offsetRecordRows(sheet, plan);
  const merges = sheet.merges.map(mergeBounds).filter(m => [...columns].some(c => c >= m.start.col && c <= m.end.col) && m.start.row <= plan.endRow && m.end.row >= plan.startRow);
  const byStart = new Map<number, typeof merges>();
  for (const merge of merges) { const group = byStart.get(merge.start.row) || []; group.push(merge); byStart.set(merge.start.row, group); }
  const occupied = new Map<number, SheetInfo['cells']>();
  for (const cell of sheet.cells) if (columns.has(cell.col) && (cell.formula || (cell.value !== null && cell.value !== ''))) { const group = occupied.get(cell.row) || []; group.push(cell); occupied.set(cell.row, group); }
  if (merges.some(m => m.start.row < plan.startRow)) throw new Error('입력 범위가 병합 셀 중간에서 끊깁니다. 상세 설정에서 병합 셀 전체가 포함되도록 시작·마지막 행을 조정해 주세요.');
  const rows: number[] = [];
  for (let row = plan.startRow; row <= plan.endRow;) {
    const covering = byStart.get(row) || [];
    if (covering.some(m => m.end.row > plan.endRow)) throw new Error('입력 범위가 병합 셀 중간에서 끊깁니다. 상세 설정에서 병합 셀 전체가 포함되도록 시작·마지막 행을 조정해 주세요.');
    const ends = [...new Set(covering.filter(m => m.end.row > row).map(m => m.end.row))];
    const end = ends[0] ?? row;
    if (ends.length > 1) throw new Error('항목마다 병합된 인원 구간이 다릅니다. 한 사람의 입력칸이 어디까지인지 확인할 수 있도록 실제 양식을 확인해야 합니다.');
    if (covering.some(m => [...columns].some(c => c > m.start.col && c <= m.end.col))) throw new Error('병합 셀의 시작 칸에만 값을 입력할 수 있습니다. 대상 열을 수정해 주세요.');
    // Lower rows with distinct values need a separate field mapping. Do not
    // silently erase or leave another person's data underneath a record.
    for (let r = row + 1; r <= end; r++) {
      if (byStart.has(r)) throw new Error('항목마다 병합된 인원 구간이 다릅니다. 한 사람의 입력칸이 어디까지인지 확인할 수 있도록 실제 양식을 확인해야 합니다.');
      if ((occupied.get(r) || []).some(c => !covering.some(m => c.col >= m.start.col && c.col <= m.end.col && c.row <= m.end.row))) throw new Error('한 사람의 아래쪽 행에도 별도 데이터나 수식이 있습니다. 각 행의 항목을 구분해야 하므로 원본과 받을 양식을 함께 확인해 주세요.');
    }
    rows.push(row); row = end + 1;
  }
  return rows;
}

function offsetRecordRows(sheet: SheetInfo, plan: Pick<ConversionPlan, 'startRow' | 'endRow' | 'mappings' | 'recordHeight'>): number[] {
  const columns = new Set(plan.mappings.map(m => m.targetColumn));
  const merges = sheet.merges.map(mergeBounds).filter(m => [...columns].some(c => c >= m.start.col && c <= m.end.col));
  const rows: number[] = [];
  for (let row = plan.startRow; row <= plan.endRow;) {
    const covering = merges.filter(m => m.start.row <= row && m.end.row >= row);
    if (covering.some(m => m.start.row < row)) throw new Error('입력 범위가 병합 셀 중간에서 끊깁니다.');
    const ends = [...new Set(covering.filter(m => m.end.row > row).map(m => m.end.row))];
    if (!plan.recordHeight && ends.length > 1) throw new Error('항목마다 병합된 인원 구간이 다릅니다.');
    const end = plan.recordHeight ? row + plan.recordHeight - 1 : ends[0] ?? row + Math.max(...plan.mappings.map(m => m.rowOffset || 0));
    if (ends.some(n => n > end)) throw new Error('병합 셀이 한 사람의 입력 구간을 벗어납니다.');
    if (end > plan.endRow) throw new Error('입력 범위가 병합 셀 중간에서 끊깁니다.');
    const addresses = new Set<string>();
    for (const mapping of plan.mappings) {
      const r = row + (mapping.rowOffset || 0);
      if (r > end) throw new Error('아래쪽 행의 항목이 한 사람의 입력 구간을 벗어납니다.');
      const merge = merges.find(m => r >= m.start.row && r <= m.end.row && mapping.targetColumn >= m.start.col && mapping.targetColumn <= m.end.col);
      if (merge && (merge.start.row !== r || merge.start.col !== mapping.targetColumn || merge.end.row > end)) throw new Error('병합 셀의 시작 칸에만 값을 입력할 수 있습니다.');
      addresses.add(`${r}:${mapping.targetColumn}`);
    }
    for (const cell of sheet.cells.filter(c => c.row > row && c.row <= end && columns.has(c.col) && (c.formula || (c.value !== null && c.value !== '')))) {
      if (!addresses.has(`${cell.row}:${cell.col}`)) throw new Error('한 사람의 아래쪽 행에도 별도 데이터나 수식이 있습니다. 해당 줄의 항목을 연결해 주세요.');
    }
    rows.push(row); row = end + 1;
  }
  return rows;
}

export function headerEndRow(sheet: SheetInfo, headerRow: number): number {
  return Math.max(headerRow, ...sheet.merges.map(mergeBounds).filter(m => m.start.row === headerRow).map(m => m.end.row));
}
