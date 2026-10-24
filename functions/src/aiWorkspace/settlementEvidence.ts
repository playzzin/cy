import { AiEvidenceRow, AiEvidenceStatus, AiResult } from './contract';
import { Catalog, SourceRow, text, WorkspaceError } from './domain';

const directions = ['내부지원간곳', '외부지원간곳', '내부지원온곳', '외부지원온곳'];
const outgoing = (direction: string) => direction.endsWith('간곳');
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < Number.MAX_SAFE_INTEGER / 10000;
const key = (row: any, direction: string): string | null => directions.includes(direction) && text(row.siteId) && text(row.counterTeamId)
  ? JSON.stringify([direction, row.siteId, row.counterTeamId]) : null;
// Mirrors teamSettlementService.calculateSupportLaborAmount, including rounding each worker row.
export const supportSnapshotAmount = (manDay: number, unitPrice: number) => Math.round(Math.max(0, manDay) * Math.max(0, Math.round(unitPrice)));

// Inspect only authorized, accepted confirmed documents already loaded by buildSettlementResult.
// No current daily reports, rates, master data, or read-time recalculation are mixed into historical evidence.
export function buildSettlementEvidence(base: AiResult, documents: SourceRow[], catalog: Catalog): AiResult {
  const selected = base.plan.filters.find(filter => filter.entity === 'team');
  const teams = catalog.team.filter(team => !selected || team.id === selected.id);
  const accepted = new Map(base.settlement!.details.map(row => [row.teamId, row]));
  const rows: AiEvidenceRow[] = [];
  let inspectedDetails = 0;
  for (const team of teams) {
    const owner = accepted.get(team.id);
    const source = documents.find(doc => doc.id === owner?.documentId);
    const common = { teamId: team.id, teamName: text(team.name) || '이름 미등록', yearMonth: base.plan.range.startDate.slice(0, 7),
      settlementId: owner?.documentId || '', capturedAt: '', lineIds: [] as string[], evidenceCount: null as number | null,
      settledAmount: null as number | null, evidenceAmount: null as number | null, difference: null as number | null };
    const add = (patch: Partial<AiEvidenceRow> & Pick<AiEvidenceRow, 'category' | 'status' | 'reason'>) => {
      rows.push({ ...common, ...patch });
      if (rows.length > 500) throw new WorkspaceError('resource-exhausted', '근거 점검 결과가 500건을 초과했습니다. 조회할 팀을 좁혀 주세요.');
    };
    if (!owner || !source) { add({ category: '일보·지원비', status: 'noSettlement', reason: '유효한 저장 확정 정산을 확인할 수 없어 비교하지 않았습니다.' }); continue; }
    const doc = typeof source.data === 'string' ? JSON.parse(source.data) : source.data;
    const snapshot = doc.sourceSnapshot;
    const validTime = typeof snapshot?.capturedAt === 'string' && Number.isFinite(Date.parse(snapshot.capturedAt));
    const validSnapshot = snapshot && [1, 2].includes(snapshot.version) && validTime;
    if (validTime) common.capturedAt = snapshot.capturedAt;
    const reports = snapshot?.dailyReports;
    const reportsValid = validSnapshot && Array.isArray(reports) && reports.every((row: any) => row && text(row.reportId) && typeof row.date === 'string'
      && /^20\d{2}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(Date.parse(row.date)) && new Date(row.date).toISOString().slice(0, 10) === row.date
      && row.date >= base.plan.range.startDate && row.date <= base.plan.range.endDate)
      && new Set(reports.map((row: any) => row.reportId)).size === reports.length;
    add({ category: '일보 금액', status: 'unavailable', evidenceCount: reportsValid ? reports.length : null,
      reason: reportsValid ? '일보 목록은 저장되어 있지만 당시 작업자별 공수·단가·금액이 없어 금액을 비교할 수 없습니다.' : '유효한 일보 근거 목록을 확인할 수 없습니다. 현재 일보로 과거 금액을 추정하지 않았습니다.' });
    const lines = [...doc.sales.map((row: any) => ({ ...row, section: 'sales' })), ...doc.purchases.map((row: any) => ({ ...row, section: 'purchases' }))]
      .filter(row => directions.includes(row.origin) || ['support_fee_outgoing', 'support_fee_incoming'].includes(row.origin)
        || (row.kind === '지원' && !['support_outgoing', 'support_incoming'].includes(row.origin)));
    const details = snapshot?.supportDetails;
    if (!validSnapshot || !Array.isArray(details)) {
      add({ category: '지원비', status: 'unavailable', reason: '저장된 지원비 상세 근거가 없어 비교하지 않았습니다.' }); continue;
    }
    inspectedDetails += details.length;
    if (inspectedDetails > 10000) throw new WorkspaceError('resource-exhausted', '지원비 상세 근거가 10,000건을 초과했습니다. 조회할 팀을 좁혀 주세요.');
    const ids = new Set<string>();
    const invalid = details.some((row: any) => {
      if (!row || !text(row.id) || ids.has(row.id) || !directions.includes(row.direction) || !finite(row.manDay) || !finite(row.unitPrice) || !finite(row.amount)
        || row.amount !== supportSnapshotAmount(row.manDay, row.unitPrice) || typeof row.date !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(row.date)
        || !Number.isFinite(Date.parse(row.date)) || new Date(row.date).toISOString().slice(0, 10) !== row.date
        || row.date < base.plan.range.startDate || row.date > base.plan.range.endDate) return true;
      ids.add(row.id); return false;
    });
    if (invalid) { add({ category: '지원비', status: 'invalid', evidenceCount: details.length, reason: '지원비 근거의 날짜·중복·공수·단가·금액 검증에 실패해 해당 정산의 지원비 비교를 제외했습니다.' }); continue; }
    if (Date.parse(snapshot.capturedAt) > Date.parse(doc.confirmedAt)) {
      add({ category: '지원비', status: 'review', evidenceCount: details.length, reason: '근거 저장 시각이 정산 확정 시각보다 늦어 확정 당시 근거인지 확인이 필요합니다.' }); continue;
    }
    if (!lines.length && !details.length) { add({ category: '지원비', status: 'unavailable', evidenceCount: 0, reason: '저장된 지원비 상세와 비교 대상 항목이 없습니다. 전체 원장의 지원비 누락 여부를 뜻하지 않습니다.' }); continue; }
    // Missing IDs and legacy/manual lines can overlap otherwise valid groups: never match by names or silently ignore them.
    if (details.some((row: any) => !key(row, row.direction)) || lines.some(row => !key(row, row.origin) || row.source !== 'auto'
      || row.amountOverridden === true || (outgoing(row.origin) ? row.section !== 'sales' : row.section !== 'purchases'))) {
      add({ category: '지원비', status: 'review', evidenceCount: details.length, reason: '현장·상대팀 ID 누락 또는 수동·수정·구형 항목이 있어 자동 비교를 보류했습니다.' }); continue;
    }
    const keys = [...new Set([...details.map((row: any) => key(row, row.direction)!), ...lines.map(row => key(row, row.origin)!)])];
    for (const group of keys) {
      const proof = details.filter((row: any) => key(row, row.direction) === group), linked = lines.filter(row => key(row, row.origin) === group);
      const [direction] = JSON.parse(group), category = `${direction} · ${text(linked[0]?.siteName || proof[0]?.siteName).slice(0, 80) || '현장 이름 없음'}`;
      const metadata = { category, evidenceCount: proof.length, lineIds: linked.map(row => text(row.id)) };
      if (linked.length !== 1 || !proof.length) {
        add({ ...metadata, status: 'review', reason: linked.length > 1 ? '같은 방향·현장·상대팀 항목이 중복되어 비교를 보류했습니다.' : '저장 근거와 정산 항목을 양쪽에서 연결할 수 없습니다. 의도한 제외·수정 여부를 확인해 주세요.' }); continue;
      }
      const evidenceAmount = proof.reduce((sum: number, row: any) => sum + row.amount, 0);
      const proofManDay = Math.round(proof.reduce((sum: number, row: any) => sum + row.manDay, 0) * 10) / 10;
      const line = linked[0];
      if (!finite(line.manDay) || line.manDay !== proofManDay || !Number.isSafeInteger(evidenceAmount)) {
        add({ ...metadata, status: 'review', reason: '정산과 저장 근거의 공수가 다르거나 수치 범위를 확인할 수 없어 금액 비교를 보류했습니다.' }); continue;
      }
      const difference = evidenceAmount - line.amount;
      add({ ...metadata, status: difference === 0 ? 'matched' : 'difference', settledAmount: line.amount, evidenceAmount, difference,
        reason: difference === 0 ? '저장된 지원비 상세 합계와 정산 항목이 일치합니다. 현재 원장 전체 검증을 뜻하지 않습니다.' : '저장된 지원비 상세 합계와 정산 항목의 금액이 다릅니다. 조정 사유·저장 시점을 확인해 주세요.' });
    }
  }
  rows.sort((a, b) => a.teamName.localeCompare(b.teamName, 'ko') * (base.plan.direction === 'desc' ? -1 : 1) || a.teamId.localeCompare(b.teamId) || a.category.localeCompare(b.category, 'ko'));
  const counts: Record<AiEvidenceStatus, number> = { matched: 0, difference: 0, unavailable: 0, review: 0, noSettlement: 0, invalid: 0 };
  rows.forEach(row => counts[row.status]++);
  const absoluteDifference = rows.reduce((sum, row) => sum + Math.abs(row.difference ?? 0), 0);
  if (!Number.isFinite(absoluteDifference) || absoluteDifference > Number.MAX_SAFE_INTEGER) throw new WorkspaceError('failed-precondition', '차이 합계의 수치 범위를 초과했습니다.');
  return { ...base, evidence: { rows, counts, absoluteDifference }, completeness: counts.unavailable + counts.review + counts.noSettlement + counts.invalid || base.completeness === 'partial' ? 'partial' : 'complete',
    summary: `저장 근거 점검: 지원비 일치 ${counts.matched}건, 금액 차이 ${counts.difference}건입니다. 일보 금액과 현재 원장 전체 대사는 포함하지 않습니다.`,
    warnings: [...base.warnings, '저장된 근거만 점검합니다. 현재 일보·지원비 원장·변경된 단가를 조회하거나 정산을 수정하지 않습니다.'] };
}
