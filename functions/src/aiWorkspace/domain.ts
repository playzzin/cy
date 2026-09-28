import {
  AI_ENTITIES, AI_GROUPS, AI_WORKSPACE_VERSION, AiChoice, AiDetail, AiFilter, AiPlan,
  AiRange, AiRecord, AiResult, AiRow, AiTotals,
} from './contract';

export class WorkspaceError extends Error {
  constructor(public code: 'invalid-argument' | 'resource-exhausted' | 'failed-precondition', message: string) { super(message); }
}
export type SourceRow = Record<string, any> & { id: string };
export type Catalog = Record<'worker' | 'team' | 'site' | 'company', SourceRow[]>;
export const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const fail = (message: string): never => { throw new WorkspaceError('invalid-argument', message); };
const object = (value: any, keys: string[]) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) fail('요청 형식을 확인해 주세요.');
};
const string = (value: unknown, max: number): string => typeof value === 'string' && value.length <= max ? value.trim() : fail('입력 길이와 형식을 확인해 주세요.');
const enumeration = <T extends string>(value: unknown, values: readonly T[]): T => values.includes(value as T) ? value as T : fail('지원하지 않는 조회 기준입니다.');
const boolean = (value: unknown): boolean => typeof value === 'boolean' ? value : fail('보고서 설정을 확인해 주세요.');
export const validateRange = (value: any): AiRange => {
  object(value, ['startDate', 'endDate']);
  const dates = ['startDate', 'endDate'].map(key => {
    const date = string(value[key], 10);
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) fail('올바른 조회 날짜를 선택해 주세요.');
    return date;
  });
  const days = (Date.parse(dates[1]) - Date.parse(dates[0])) / 86400000;
  if (days < 0 || days > 365) fail('조회 기간은 시작일부터 최대 366일로 지정해 주세요.');
  return { startDate: dates[0], endDate: dates[1] };
};
export const validatePlan = (value: any): AiPlan => {
  object(value, ['dataset', 'operation', 'saved', 'entity', 'range', 'comparison', 'groupBy', 'filters', 'missingAccount', 'status', 'sortBy', 'direction', 'report', 'clarification']);
  if (!Array.isArray(value.filters) || value.filters.length > 4) fail('검색 조건은 종류별로 하나씩, 최대 4개까지 사용할 수 있습니다.');
  const filters: AiFilter[] = value.filters.map((filter: any) => {
    object(filter, ['entity', 'name', 'id']);
    const id = string(filter.id, 160);
    if (id.includes('/') || id === '.' || id === '..') fail('조회 대상 ID를 확인해 주세요.');
    const name = string(filter.name, 120);
    if (!id && !name) fail('검색할 대상 이름을 입력해 주세요.');
    return { entity: enumeration(filter.entity, AI_ENTITIES), id, name };
  });
  if (new Set(filters.map(filter => filter.entity)).size !== filters.length) fail('같은 종류의 대상은 한 번만 선택해 주세요.');
  object(value.report, ['format', 'title', 'includeDetails', 'includeAmount', 'splitByGroup']);
  const plan: AiPlan = {
    dataset: enumeration(value.dataset ?? 'dailyReports', ['dailyReports', 'teamSettlements', 'settlementAudit', 'settlementMissing', 'settlementEvidence']),
    operation: enumeration(value.operation, ['aggregate', 'search', 'export', 'clarify', 'savedFind', 'savedRun']),
    entity: enumeration(value.entity, AI_ENTITIES), range: validateRange(value.range),
    comparison: value.comparison === null ? null : validateRange(value.comparison),
    groupBy: enumeration(value.groupBy, AI_GROUPS), filters,
    missingAccount: boolean(value.missingAccount), status: string(value.status, 40),
    sortBy: enumeration(value.sortBy, ['manDay', 'amount', 'workers', 'name']),
    direction: enumeration(value.direction, ['asc', 'desc']),
    report: { format: enumeration(value.report.format, ['none', 'pdf', 'xlsx', 'both']), title: string(value.report.title, 120),
      includeDetails: boolean(value.report.includeDetails), includeAmount: boolean(value.report.includeAmount), splitByGroup: boolean(value.report.splitByGroup) },
    clarification: string(value.clarification, 350),
  };
  if (plan.operation === 'savedFind' || plan.operation === 'savedRun') {
    object(value.saved, ['query', 'usePrevious']);
    const query = string(value.saved.query, 60), usePrevious = boolean(value.saved.usePrevious);
    if ([...value.saved.query].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) || (usePrevious && (query || plan.operation !== 'savedRun'))) fail('저장한 분석의 이름이나 이전 선택을 확인해 주세요.');
    if (plan.dataset !== 'dailyReports' || plan.entity !== 'worker' || plan.groupBy !== 'site' || plan.filters.length || plan.comparison || plan.missingAccount || plan.status
      || plan.sortBy !== 'name' || plan.direction !== 'asc' || plan.report.format !== 'none' || !plan.report.includeAmount || plan.report.includeDetails || plan.report.splitByGroup)
      fail('저장한 분석은 저장된 조건 그대로 실행합니다. 조건이나 보고서 변경은 실행 후 별도로 요청해 주세요.');
    return { ...plan, saved: { query, usePrevious } };
  }
  if (value.saved !== undefined && value.saved !== null) {
    if (plan.operation !== 'clarify') fail('저장한 분석 요청과 새 조회 조건은 함께 사용할 수 없습니다.');
    // A clarification may retain the discussed saved name. Validate then discard it;
    // only savedFind/savedRun can carry an executable saved command.
    object(value.saved, ['query', 'usePrevious']); string(value.saved.query, 60); boolean(value.saved.usePrevious);
  }
  if (plan.operation === 'aggregate' && (plan.missingAccount || plan.status)) fail('계좌 등록 여부와 재직 상태 검색은 인력 검색에서 이용해 주세요.');
  if (plan.operation === 'search' && plan.comparison) fail('기간 비교는 일보 분석에서 이용해 주세요.');
  if (plan.operation === 'search' && plan.entity === 'site' && plan.missingAccount) fail('현장은 계좌 누락 검색 대상이 아닙니다.');
  if (plan.operation !== 'clarify') {
    if (plan.dataset === 'teamSettlements' || plan.dataset === 'settlementAudit' || plan.dataset === 'settlementMissing' || plan.dataset === 'settlementEvidence') {
      if (plan.operation === 'search' || plan.groupBy !== 'settlementTeam' || plan.entity !== 'team' || plan.filters.some(filter => filter.entity !== 'team') || plan.status || plan.missingAccount)
        fail('확정 정산은 정산팀 기준으로만 조회할 수 있습니다.');
      if (!['amount', 'name'].includes(plan.sortBy)) fail('확정 정산은 정산 계산액 또는 팀 이름으로 정렬해 주세요.');
      if (['settlementAudit', 'settlementMissing', 'settlementEvidence'].includes(plan.dataset) && (plan.comparison || plan.sortBy !== 'name')) fail('정산 근거·청구서 점검은 한 달을 팀 이름 순서로 조회해 주세요. 기간 비교는 지원하지 않습니다.');
      if (plan.dataset === 'settlementMissing' && plan.range.startDate < '2026-01-01') fail('미연결 청구서 점검은 지원비 정산 적용 시작일인 2026년 1월부터 가능합니다.');
      for (const period of [plan.range, plan.comparison].filter(Boolean) as AiRange[]) {
        const month = period.startDate.slice(0, 7);
        const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
        if (period.startDate !== `${month}-01` || period.endDate !== last) fail('정산 조회와 비교는 각각 한 달 전체를 지정해 주세요.');
      }
    } else if (plan.groupBy === 'settlementTeam') fail('정산팀 기준은 확정 정산 조회에서 이용해 주세요.');
  }
  return plan;
};

const normalize = (value: unknown) => text(value).replace(/\s+/g, '').toLowerCase();
export const resolveFilters = (plan: AiPlan, catalog: Catalog): { plan: AiPlan; choices: AiChoice[]; message?: string } => {
  const resolved = { ...plan, filters: plan.filters.map(filter => ({ ...filter })) };
  for (let index = 0; index < resolved.filters.length; index++) {
    const filter = resolved.filters[index];
    const rows = catalog[filter.entity];
    const exact = rows.filter(row => filter.id ? row.id === filter.id || text(row.legacyId) === filter.id : normalize(row.name) === normalize(filter.name));
    const matches = filter.id || exact.length ? exact : rows.filter(row => normalize(row.name).includes(normalize(filter.name)));
    if (matches.length !== 1) return { plan: resolved, choices: matches.slice(0, 12).map(row => ({ filterIndex: index, id: row.id,
      name: text(row.name), label: `${text(row.name)} · ${text(row.teamName) || text(row.code) || text(row.status) || '대상'} · ${row.id.slice(-8)}` })),
      message: matches.length ? '같은 이름의 후보가 있습니다. 조회할 대상을 선택해 주세요.' : '조회할 수 있는 대상이 없습니다. 이름과 접근 범위를 확인해 주세요.' };
    filter.id = matches[0].id; filter.name = text(matches[0].name);
  }
  return { plan: resolved, choices: [] };
};
const aliasIds = (catalog: Catalog, filter?: AiFilter) => {
  if (!filter) return new Set<string>();
  const row = catalog[filter.entity].find(value => value.id === filter.id);
  if (!row) throw new WorkspaceError('failed-precondition', '조회 대상을 다시 선택해 주세요.');
  return new Set([row.id, text(row.legacyId)].filter(Boolean));
};
const inRange = (date: string, range: AiRange) => date >= range.startDate && date <= range.endDate;
const round = (value: number, scale = 1) => Math.round(value * scale) / scale;
const emptyTotals = (): AiTotals => ({ manDay: 0, amount: 0, workers: 0, reports: 0 });
export const percentage = (current: number, previous: number): number | null => previous === 0 ? null : round((current - previous) / previous * 100, 10);
export const summarize = (details: AiDetail[]): AiTotals => {
  const manDay = details.reduce((sum, row) => sum + row.manDay, 0), amount = details.reduce((sum, row) => sum + row.amount, 0);
  if (!Number.isFinite(manDay) || manDay > Number.MAX_SAFE_INTEGER / 10 || !Number.isFinite(amount) || amount > Number.MAX_SAFE_INTEGER)
    throw new WorkspaceError('failed-precondition', '집계 가능한 수치 범위를 초과했습니다. 원본을 확인해 주세요.');
  return {
  manDay: round(manDay, 10),
  amount: round(amount),
  workers: new Set(details.map(row => row.workerId)).size,
  reports: new Set(details.map(row => row.reportId)).size,
  };
};
export const detailGroup = (row: AiDetail, plan: AiPlan): { id: string; name: string } => {
  if (plan.groupBy === 'date') return { id: row.date, name: row.date };
  if (plan.groupBy === 'worker') return { id: row.workerId, name: row.workerName };
  const prefix = plan.groupBy;
  return { id: row[`${prefix}Id`] || '__unknown__', name: row[`${prefix}Name`] || '미지정' };
};
export const analyzeReports = (plan: AiPlan, reports: SourceRow[], catalog: Catalog): Pick<AiResult, 'rows' | 'details' | 'totals' | 'previousTotals' | 'warnings' | 'completeness'> => {
  const warnings = new Set<string>();
  const ids = Object.fromEntries(AI_ENTITIES.map(entity => [entity, aliasIds(catalog, plan.filters.find(filter => filter.entity === entity))]));
  const filtered = (entity: string, value: string) => !ids[entity].size || ids[entity].has(value);
  const teams = new Map(catalog.team.flatMap(row => [row.id, text(row.legacyId)].filter(Boolean).map(id => [id, row] as const)));
  const details: AiDetail[] = [], previous: AiDetail[] = [];
  const seenReports = new Set<string>();
  for (const report of reports) {
    if (seenReports.has(report.id)) continue;
    seenReports.add(report.id);
    const date = text(report.date);
    const current = inRange(date, plan.range), prior = plan.comparison && inRange(date, plan.comparison);
    if (!current && !prior) continue;
    const responsibleTeamId = text(report.responsibleTeamId) || text(report.teamId);
    if (!filtered('site', text(report.siteId)) || !filtered('company', text(report.companyId) || text(report.constructorCompanyId))) continue;
    if (plan.groupBy !== 'workerTeam' && !filtered('team', responsibleTeamId)) continue;
    const sourceWorkers = Array.isArray(report.workers) ? report.workers : [];
    if (!Array.isArray(report.workers)) warnings.add('작업자 목록 형식이 올바르지 않은 일보를 제외했습니다.');
    const seenWorkers = new Set<string>();
    for (const worker of sourceWorkers) {
      const workerId = text(worker?.workerId);
      if (!filtered('worker', workerId)) continue;
      const workerTeamId = text(worker?.teamId);
      if (plan.groupBy === 'workerTeam' && !filtered('team', workerTeamId)) continue;
      if (!workerId || seenWorkers.has(workerId)) { warnings.add('작업자 ID 누락 또는 일보 내 중복 행을 제외했습니다.'); continue; }
      seenWorkers.add(workerId);
      if (typeof worker.manDay !== 'number' || !Number.isFinite(worker.manDay) || worker.manDay < 0
        || typeof worker.unitPrice !== 'number' || !Number.isFinite(worker.unitPrice) || worker.unitPrice < 0) {
        warnings.add('공수 또는 단가가 누락되거나 잘못된 행을 제외했습니다.'); continue;
      }
      const amount = worker.manDay * worker.unitPrice;
      if (!Number.isFinite(amount) || amount > Number.MAX_SAFE_INTEGER) throw new WorkspaceError('failed-precondition', '계산 가능한 금액 범위를 초과했습니다. 원본을 확인해 주세요.');
      if (!workerTeamId && plan.groupBy === 'workerTeam') warnings.add('당시 작업자 소속팀이 없는 행은 미지정으로 분류했습니다.');
      const row: AiDetail = { reportId: report.id, date, siteId: text(report.siteId), siteName: text(report.siteName) || '미지정',
        responsibleTeamId, responsibleTeamName: text(report.responsibleTeamName) || text(report.teamName) || text(teams.get(responsibleTeamId)?.name),
        workerTeamId, workerTeamName: text(worker.workerTeamName) || text(teams.get(workerTeamId)?.name),
        workerId, workerName: text(worker.name) || '이름 미등록', manDay: worker.manDay, unitPrice: worker.unitPrice, amount };
      if (current) details.push(row);
      if (prior) previous.push(row);
      if (details.length + previous.length > 10000) throw new WorkspaceError('resource-exhausted', '작업자 내역이 많습니다. 기간이나 대상을 좁혀 주세요.');
    }
  }
  const groups = (list: AiDetail[]) => {
    const result = new Map<string, { name: string; values: AiDetail[] }>();
    list.forEach(row => { const key = detailGroup(row, plan); const group = result.get(key.id) || { name: key.name, values: [] }; group.values.push(row); result.set(key.id, group); });
    return result;
  };
  const now = groups(details), before = groups(previous);
  const rows: AiRow[] = [...new Set([...now.keys(), ...before.keys()])].map(id => {
    const totals = summarize(now.get(id)?.values || []), prev = plan.comparison ? summarize(before.get(id)?.values || []) : null;
    return { id, name: now.get(id)?.name || before.get(id)!.name, ...totals, previous: prev,
      manDayChangePercent: prev ? percentage(totals.manDay, prev.manDay) : null,
      amountChangePercent: prev ? percentage(totals.amount, prev.amount) : null };
  });
  rows.sort((a, b) => (plan.sortBy === 'name' ? a.name.localeCompare(b.name, 'ko') : a[plan.sortBy] - b[plan.sortBy]) * (plan.direction === 'asc' ? 1 : -1) || a.id.localeCompare(b.id));
  return { rows, details, totals: summarize(details), previousTotals: plan.comparison ? summarize(previous) : null,
    warnings: [...warnings], completeness: warnings.size ? 'partial' : 'complete' };
};

export const searchCatalog = (plan: AiPlan, catalog: Catalog): AiRecord[] => {
  // Only explicit, implemented joins are accepted; no silently ignored filters.
  const allowed = plan.entity === 'worker' ? ['worker', 'team', 'company', 'site'] : [plan.entity];
  if (plan.filters.some(filter => !allowed.includes(filter.entity))) throw new WorkspaceError('invalid-argument', '이 검색의 연결 조건은 아직 지원하지 않습니다. 대상 이름으로 검색해 주세요.');
  if (plan.missingAccount && catalog[plan.entity].some(row => row._accountVisibility === false)) throw new WorkspaceError('failed-precondition', '현재 계정에서 계좌 등록 여부를 확인할 수 없는 대상입니다.');
  return catalog[plan.entity].filter(row => plan.filters.every(filter => {
    const ids = aliasIds(catalog, filter);
    return ids.has(filter.entity === plan.entity ? row.id : text(row[`${filter.entity}Id`]));
  }) && (!plan.status || normalize(row.status) === normalize(plan.status)) && (!plan.missingAccount || !text(row.accountNumber)))
    .map(row => ({ id: row.id, entity: plan.entity, name: text(row.name), teamName: text(row.teamName),
      status: text(row.status), accountRegistered: plan.entity === 'site' || row._accountVisibility === false ? null : Boolean(text(row.accountNumber)) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
};
export const buildResult = (id: string, plan: AiPlan, reports: SourceRow[], catalog: Catalog, now = new Date()): AiResult => {
  const data = plan.operation === 'search' ? { rows: [], details: [], totals: emptyTotals(), previousTotals: null,
    warnings: ['현재 마스터 정보 검색입니다. 일보 기간별 투입 여부는 일보 분석으로 확인해 주세요.'], completeness: 'complete' as const }
    : analyzeReports(plan, reports, catalog);
  const records = plan.operation === 'search' ? searchCatalog(plan, catalog) : [];
  return { id, version: AI_WORKSPACE_VERSION, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 3600000).toISOString(),
    plan, ...data, records,
    summary: plan.operation === 'search' ? `접근 가능한 ${records.length}건을 찾았습니다.`
      : `${data.completeness === 'partial' ? '일부 제외된 자료가 있습니다. 포함된' : '조회한'} 일보 ${data.totals.reports}건, ${data.totals.manDay}공수, 일보 산출액 ${data.totals.amount.toLocaleString('ko-KR')}원입니다.` };
};
