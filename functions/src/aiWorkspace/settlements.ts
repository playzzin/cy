import { AI_WORKSPACE_VERSION, AiPlan, AiResult, AiSettlementDetail, AiSettlementRow, AiSettlementTotals } from './contract';
import { Catalog, SourceRow, text, WorkspaceError } from './domain';

export const settlementDocumentId = (yearMonth: string, teamId: string) => `team_settlement_${yearMonth}__${teamId}`;
export const emptySettlementTotals = (): AiSettlementTotals => ({ sales: 0, purchases: 0, deductions: 0, additions: 0, prevCarryover: 0, deposit: 0, net: 0, documents: 0, card: 0, accommodation: 0, vehicle: 0, payroll: 0, other: 0 });
const number = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER / 20) throw new Error('invalid amount');
  return value;
};
const costKey = (origin: string): 'card' | 'accommodation' | 'vehicle' | 'payroll' | 'other' =>
  origin === 'card_billing' ? 'card' : origin === 'accommodation_billing' ? 'accommodation' : origin === 'vehicle_billing' ? 'vehicle'
    : ['daily_wage_payroll', 'monthly_wage_payroll', 'service_team_payroll'].includes(origin) ? 'payroll' : 'other';
const labels = { card: '카드', accommodation: '숙소', vehicle: '차량', payroll: '급여', other: '기타' };
const sum = (values: AiSettlementTotals[]): AiSettlementTotals => {
  const total = emptySettlementTotals();
  for (const value of values) for (const key of Object.keys(total) as Array<keyof AiSettlementTotals>) total[key] += value[key];
  if (Object.values(total).some(value => !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER))
    throw new WorkspaceError('failed-precondition', '정산 집계 가능한 수치 범위를 초과했습니다.');
  return total;
};

// Read saved, confirmed snapshots only. No calls to the UI service that recalculates/saves on read.
export function buildSettlementResult(id: string, plan: AiPlan, documents: SourceRow[], catalog: Catalog, now = new Date()): AiResult {
  const warnings = new Set<string>(['저장된 확정 정산만 포함합니다. 미확정·미저장 자료는 포함하지 않습니다.', ...(['settlementAudit', 'settlementMissing', 'settlementEvidence'].includes(plan.dataset || '') ? [] : ['정산 계산액은 실지급액·회계상 순이익이 아닙니다. 여러 팀 합계는 내부거래 제거 전 단순 합계입니다.'])]);
  const selected = plan.filters.find(filter => filter.entity === 'team');
  if (selected && !catalog.team.some(team => team.id === selected.id)) throw new WorkspaceError('failed-precondition', '정산팀을 다시 선택해 주세요.');
  const allowed = new Map(catalog.team.filter(team => !selected || team.id === selected.id).map(team => [team.id, team]));
  const current = new Map<string, AiSettlementTotals>(), previous = new Map<string, AiSettlementTotals>();
  const details: AiSettlementDetail[] = [], names = new Map<string, string>(), seen = new Set<string>();
  let invalid = 0, unconfirmed = 0;
  for (const source of documents) {
    if (seen.has(source.id)) continue;
    seen.add(source.id);
    let doc: any;
    try { doc = typeof source.data === 'string' ? JSON.parse(source.data) : source.data; } catch { invalid++; continue; }
    if (!doc || !allowed.has(text(doc.teamId))) continue;
    const isCurrent = doc.yearMonth === plan.range.startDate.slice(0, 7), isPrevious = doc.yearMonth === plan.comparison?.startDate.slice(0, 7);
    if (!isCurrent && !isPrevious) continue;
    if (source.id !== settlementDocumentId(doc.yearMonth, doc.teamId)) { invalid++; continue; }
    if (!doc.confirmedAt) { unconfirmed++; continue; }
    try {
      if (typeof doc.confirmedAt !== 'string' || !Number.isFinite(Date.parse(doc.confirmedAt))) throw new Error('invalid confirmation');
      const totals = emptySettlementTotals(), rows: AiSettlementDetail[] = [];
      const teamName = text(doc.teamName) || text(allowed.get(doc.teamId)?.name) || '이름 미등록';
      const addRow = (section: AiSettlementDetail['section'], category: string, amount: number) => rows.push({ documentId: source.id, teamId: doc.teamId, teamName, yearMonth: doc.yearMonth, confirmedAt: doc.confirmedAt, section, category, amount });
      const sections = ['sales', 'purchases', 'deductions', 'additions'] as const;
      for (const section of sections) {
        const entries = section === 'additions' ? doc[section] ?? [] : doc[section];
        if (!Array.isArray(entries)) throw new Error('invalid section');
        const ids = new Set<string>();
        for (const item of entries) {
          if (!item || !text(item.id) || ids.has(item.id)) throw new Error('duplicate or missing line id');
          ids.add(item.id);
          // Same exclusion as teamSettlementService.stripSupportOriginalLines; prevent legacy support double counting.
          if ((section === 'sales' && item.origin === 'support_outgoing') || (section === 'purchases' && item.origin === 'support_incoming')) continue;
          const amount = number(item.amount);
          totals[section] += amount;
          if (section === 'deductions') totals[costKey(text(item.origin))] += amount;
          addRow(({ sales: '매출', purchases: '매입', deductions: '차감', additions: '추가' } as const)[section],
            section === 'deductions' ? labels[costKey(text(item.origin))] : text(item.siteName) || text(item.category) || '기타', amount);
        }
      }
      if (!doc.summary || typeof doc.summary !== 'object') throw new Error('missing summary');
      totals.prevCarryover = number(doc.summary.prevCarryover ?? 0); totals.deposit = number(doc.summary.deposit ?? 0);
      totals.net = totals.sales - totals.purchases - totals.deductions + totals.additions + totals.prevCarryover + totals.deposit;
      totals.documents = 1; sum([totals]);
      addRow('이월', '전월 이월', totals.prevCarryover); addRow('입금', '입금/정산조정', totals.deposit);
      names.set(doc.teamId, teamName);
      if (isCurrent) { current.set(doc.teamId, totals); details.push(...rows); }
      if (isPrevious) previous.set(doc.teamId, totals);
    } catch { invalid++; }
    if (details.length > 10000) throw new WorkspaceError('resource-exhausted', '정산 상세 내역이 많습니다. 조회할 팀을 좁혀 주세요.');
  }
  if (invalid) warnings.add(`형식·금액·문서 식별이 올바르지 않은 정산 ${invalid}건은 문서 전체를 제외했습니다.`);
  if (unconfirmed) warnings.add(`미확정 정산 ${unconfirmed}건을 제외했습니다.`);
  const totals = sum([...current.values()]), previousTotals = plan.comparison ? sum([...previous.values()]) : null;
  const rows: AiSettlementRow[] = [...new Set([...current.keys(), ...previous.keys()])].map(teamId => {
    const value = current.get(teamId) || emptySettlementTotals(), before = plan.comparison ? previous.get(teamId) || emptySettlementTotals() : null;
    return { id: teamId, name: names.get(teamId)!, ...value, previous: before, netChange: before ? value.net - before.net : null };
  }).sort((a, b) => (plan.sortBy === 'name' ? a.name.localeCompare(b.name, 'ko') : a.net - b.net) * (plan.direction === 'asc' ? 1 : -1) || a.id.localeCompare(b.id));
  return { id, version: AI_WORKSPACE_VERSION, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 3600000).toISOString(),
    plan, totals: { manDay: 0, amount: 0, reports: 0, workers: 0 }, previousTotals: null, rows: [], records: [], details: [],
    warnings: [...warnings], completeness: invalid ? 'partial' : 'complete', settlement: { totals, previousTotals, rows, details },
    summary: totals.documents ? `확정 정산 ${totals.documents}건을 조회했습니다.${plan.report.includeAmount ? ` 정산 계산액 합계 ${totals.net.toLocaleString('ko-KR')}원입니다.` : ''}` : '조건에 맞는 저장된 확정 정산이 없습니다.' };
}
