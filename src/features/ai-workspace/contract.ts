// Kept identical in src/features/ai-workspace/contract.ts; parity is tested.
export const AI_WORKSPACE_VERSION = 'workspace-v9';
export const AI_GROUPS = ['site', 'responsibleTeam', 'workerTeam', 'worker', 'date', 'settlementTeam'] as const;
export const AI_ENTITIES = ['worker', 'team', 'site', 'company'] as const;
export type AiGroup = typeof AI_GROUPS[number];
export type AiEntity = typeof AI_ENTITIES[number];
export type AiRange = { startDate: string; endDate: string };
export type AiFilter = { entity: AiEntity; name: string; id: string };
export type AiReportSpec = {
  format: 'none' | 'pdf' | 'xlsx' | 'both'; title: string;
  includeDetails: boolean; includeAmount: boolean; splitByGroup: boolean;
};
export interface AiPlan {
  dataset?: 'dailyReports' | 'teamSettlements' | 'settlementAudit' | 'settlementMissing' | 'settlementEvidence';
  operation: 'aggregate' | 'search' | 'export' | 'clarify' | 'savedFind' | 'savedRun';
  saved?: { query: string; usePrevious: boolean };
  entity: AiEntity;
  range: AiRange;
  comparison: AiRange | null;
  groupBy: AiGroup;
  filters: AiFilter[];
  missingAccount: boolean;
  status: string;
  sortBy: 'manDay' | 'amount' | 'workers' | 'name';
  direction: 'asc' | 'desc';
  report: AiReportSpec;
  clarification: string;
}
export interface AiTotals { manDay: number; amount: number; workers: number; reports: number }
export interface AiRow extends AiTotals {
  id: string; name: string;
  previous: AiTotals | null;
  manDayChangePercent: number | null;
  amountChangePercent: number | null;
}
export interface AiDetail {
  reportId: string; date: string; siteId: string; siteName: string;
  responsibleTeamId: string; responsibleTeamName: string;
  workerTeamId: string; workerTeamName: string;
  workerId: string; workerName: string; manDay: number; unitPrice: number; amount: number;
}
export interface AiRecord {
  id: string; entity: AiEntity; name: string; teamName: string; status: string;
  accountRegistered: boolean | null;
}
export interface AiResult {
  id: string; version: string; createdAt: string; expiresAt: string;
  plan: AiPlan; totals: AiTotals; previousTotals: AiTotals | null;
  rows: AiRow[]; records: AiRecord[]; details: AiDetail[];
  warnings: string[]; completeness: 'complete' | 'partial';
  summary: string;
  settlement?: AiSettlementResult;
  reconciliation?: AiReconciliation;
  missingBilling?: AiMissingBilling;
  evidence?: AiEvidence;
}
export const AI_EVIDENCE_STATUS_LABELS = { matched: '저장 근거 일치', difference: '금액 차이', unavailable: '비교 근거 부족', review: '판단 보류', noSettlement: '확정 정산 확인 불가', invalid: '근거 형식 오류' } as const;
export type AiEvidenceStatus = keyof typeof AI_EVIDENCE_STATUS_LABELS;
export interface AiEvidenceRow {
  teamId: string; teamName: string; yearMonth: string; settlementId: string; capturedAt: string;
  category: string; status: AiEvidenceStatus; reason: string; evidenceCount: number | null; lineIds: string[];
  settledAmount: number | null; evidenceAmount: number | null; difference: number | null;
}
export interface AiEvidence { rows: AiEvidenceRow[]; counts: Record<AiEvidenceStatus, number>; absoluteDifference: number }
export const AI_EVIDENCE_METRICS = [
  { id: 'evidenceScope', label: '근거 점검 범위', definition: '저장된 확정 정산의 일보 목록 보유 여부와 지원비 상세를 점검합니다. 현재 원장·단가·마스터를 재조회하지 않으며 전체 누락이나 실지급액을 판정하지 않습니다.' },
  { id: 'evidenceDifference', label: '지원비 비교 기준', definition: '방향·현장·상대팀 ID로 연결되고 공수가 같은 자동 정산 항목만 비교합니다. 차이 = 저장 근거 합계 − 정산 반영액. 차이 합계는 비교 가능한 항목의 절댓값 합계입니다.' },
  { id: 'evidenceDaily', label: '일보 금액 한계', definition: '일보 목록에는 당시 작업자별 공수·단가·금액이 없어 과거 금액 대사가 불가능합니다. 현재 값을 섞어 차이로 표시하지 않습니다. 지원비도 수동 수정·중복·근거 누락은 판단을 보류합니다.' },
] as const;
export const AI_MISSING_STATUS_LABELS = { linked: '연결 확인', candidate: '미연결 후보', review: '판단 보류', noSettlement: '확정 정산 확인 불가', invalid: '금액 형식 오류', zero: '후보 제외' } as const;
export type AiMissingStatus = keyof typeof AI_MISSING_STATUS_LABELS;
export interface AiMissingBillingRow {
  teamId: string; teamName: string; yearMonth: string; category: string;
  sourceId: string; sourceCollection: string; settlementId: string; lineIds: string[];
  status: AiMissingStatus; reason: string; sourceAmount: number | null;
}
export interface AiMissingBilling {
  rows: AiMissingBillingRow[]; counts: Record<AiMissingStatus, number>; candidateAmount: number;
  teams: Array<{ id: string; name: string; settlementId: string; confirmed: boolean; bills: number }>;
  excludedUnconfirmed: number;
}
export const AI_MISSING_METRICS = [
  { id: 'missingScope', label: '점검 범위', definition: '선택한 한 달의 현재 확정·납부·연체 상태인 팀 청구서와 저장된 확정 정산의 ID 연결을 점검합니다. 개인 청구·이름만 있는 청구·미확정 청구는 대상이 아닙니다.' },
  { id: 'missingCandidate', label: '미연결 후보', definition: '유효한 확정 정산에 직접 연결되지 않은 양수 청구서입니다. 수동·원장 합산·중복 가능성은 보류합니다. 정산 이후 청구나 의도한 제외일 수 있어 실제 누락·미지급으로 단정하지 않습니다.' },
  { id: 'missingTime', label: '조회 기준', definition: '현재 청구서와 저장 정산을 비교하며 과거 버전과 전체 원장·일보·지원비 대사를 포함하지 않습니다. 여러 문서를 하나의 시점으로 고정한 조회는 아닙니다. 원본은 변경하지 않습니다.' },
] as const;
export const AI_AUDIT_STATUS_LABELS = { matched: '일치', difference: '금액 차이', unconfirmed: '청구 미확정', unavailable: '원본 확인 불가', duplicate: '중복 연결', unsupported: '개별 연결 없음', invalid: '금액 형식 오류' } as const;
export type AiAuditStatus = keyof typeof AI_AUDIT_STATUS_LABELS;
export interface AiAuditRow {
  settlementId: string; teamId: string; teamName: string; yearMonth: string; lineId: string;
  category: string; sourceId: string; status: AiAuditStatus; reason: string;
  settledAmount: number; sourceAmount: number | null; difference: number | null;
}
export interface AiReconciliation {
  rows: AiAuditRow[];
  counts: Record<AiAuditStatus, number>;
  comparedSettledAmount: number; comparedSourceAmount: number; absoluteDifference: number;
}
export const AI_AUDIT_METRICS = [
  { id: 'auditScope', label: '대사 범위', definition: '확정 정산에 연결된 카드·숙소·차량 청구서의 현재 금액과 상태만 비교합니다. 미연결 청구서 누락, 일보·지원비·급여 전체 대사는 포함하지 않습니다.' },
  { id: 'auditDifference', label: '금액 차이', definition: '현재 청구액 − 정산 반영액. 비교 가능한 확정 청구서만 계산하며 총 차이는 절댓값 합계입니다. 원인이나 과오납을 단정하지 않습니다.' },
  { id: 'auditTime', label: '조회 기준', definition: '정산 확정 시점의 차감액과 조회 시점의 청구서를 비교합니다. 여러 원본을 하나의 시점으로 고정한 거래 스냅샷은 아닙니다. 원본은 수정하지 않습니다.' },
] as const;
export interface AiSettlementTotals {
  sales: number; purchases: number; deductions: number; additions: number;
  prevCarryover: number; deposit: number; net: number; documents: number;
  card: number; accommodation: number; vehicle: number; payroll: number; other: number;
}
export interface AiSettlementRow extends AiSettlementTotals {
  id: string; name: string; previous: AiSettlementTotals | null; netChange: number | null;
}
export interface AiSettlementDetail {
  documentId: string; teamId: string; teamName: string; yearMonth: string; confirmedAt: string;
  section: '매출' | '매입' | '차감' | '추가' | '이월' | '입금'; category: string; amount: number;
}
export interface AiSettlementResult {
  totals: AiSettlementTotals; previousTotals: AiSettlementTotals | null;
  rows: AiSettlementRow[]; details: AiSettlementDetail[];
}
export interface AiChoice { filterIndex: number; id: string; name: string; label: string }
export interface AiResponse {
  status: 'complete' | 'clarification' | 'saved'; plan: AiPlan;
  savedMatches?: { contextId: string; items: AiSavedAnalysis[] };
  result?: AiResult; choices?: AiChoice[]; message?: string;
}
export type AiSavedPeriod = 'fixed' | 'thisMonth' | 'lastMonth';
export interface AiSavedAnalysis {
  id: string; revision: number; name: string; period: AiSavedPeriod;
  plan: AiPlan; createdAt: string; updatedAt: string;
}
export type AiSaveAnalysisInput = {
  resultId: string; name: string; period: AiSavedPeriod; id?: string; revision?: number;
};
export const AI_SAVED_LIMIT = 20;
export const AI_SCHEDULE_LIMIT = 5;
export const AI_REPORT_RETENTION_DAYS = 7;
export type AiReportCadence = { frequency: 'daily' | 'weekly' | 'monthly'; time: string; weekday: number | null; monthDay: number | null };
export type AiReportRunStatus = 'running' | 'complete' | 'partial' | 'failed';
export interface AiReportSchedule {
  id: string; revision: number; savedId: string; savedRevision: number; name: string;
  cadence: AiReportCadence; enabled: boolean; nextRunAt: string | null; updatedAt: string;
  lastMessage: string;
}
export interface AiReportRun {
  id: string; scheduleId: string; scheduleRevision: number; name: string;
  dueAt: string; createdAt: string; completedAt: string | null; expiresAt: string;
  status: AiReportRunStatus; attempts: number; message: string; retryable: boolean;
}
export interface AiReportOverview { schedules: AiReportSchedule[]; runs: AiReportRun[]; schedulerEnabled?: boolean }
export type AiReportScheduleInput = { id?: string; revision?: number; savedId: string; savedRevision: number; cadence: AiReportCadence };
export const AI_SAVED_PERIOD_LABELS: Record<AiSavedPeriod, string> = {
  fixed: '저장한 기간 유지', thisMonth: '실행 시 이번 달', lastMonth: '실행 시 지난달',
};
export const aiMonthRange = (date: string, offset = 0): AiRange => {
  const year = Number(date.slice(0, 4)), month = Number(date.slice(5, 7)) - 1 + offset;
  return { startDate: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10),
    endDate: new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10) };
};
// Rolling periods preserve full-month semantics and only shift an explicit previous-month comparison.
export const canUseRollingMonth = (plan: AiPlan): boolean => {
  const full = aiMonthRange(plan.range.startDate), previous = aiMonthRange(plan.range.startDate, -1);
  return plan.operation === 'aggregate' && plan.range.startDate === full.startDate && plan.range.endDate === full.endDate
    && (!plan.comparison || (plan.comparison.startDate === previous.startDate && plan.comparison.endDate === previous.endDate));
};
export const AI_GROUP_LABELS: Record<AiGroup, string> = {
  site: '현장', responsibleTeam: '현장 담당팀', workerTeam: '작업자 소속팀', worker: '작업자', date: '일자', settlementTeam: '정산팀',
};
export const AI_SETTLEMENT_METRICS = [
  { id: 'net', label: '정산 계산액', definition: '확정 문서의 매출 − 매입 − 차감 + 추가 + 전월 이월 + 입금/정산조정. 실지급액 또는 회계상 순이익을 뜻하지 않습니다.' },
  { id: 'costs', label: '차감 비용', definition: '확정 정산에 반영된 카드·숙소·차량·급여 및 기타 차감입니다. 원장 지출을 다시 더하지 않습니다.' },
  { id: 'scope', label: '확정 기준', definition: '선택한 한 달의 저장된 확정 정산만 조회합니다. 자동 재집계·저장·확정은 수행하지 않습니다. 여러 팀 합계는 내부거래 제거 전 단순 합계입니다.' },
] as const;
export const AI_METRICS = [
  { id: 'manDay', label: '공수', unit: '공수', definition: '일보 작업자 행의 공수 합계. 마지막에 소수 1자리로 반올림합니다.' },
  { id: 'amount', label: '일보 산출액', unit: '원', definition: '일보의 공수 × 당시 단가 합계. 마지막에 원 단위로 반올림합니다. 확정 정산액·실지급액과 구분합니다.' },
  { id: 'workers', label: '고유 작업자', unit: '명', definition: '조건에 해당하는 작업자 ID의 중복을 제거한 수입니다. 이름이 같아도 ID가 다르면 구분합니다.' },
] as const;
