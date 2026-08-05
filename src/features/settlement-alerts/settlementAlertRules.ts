import type { ReceivableLedger } from '../../services/receivableService';
import type { SupportClaimIssue } from '../../services/supportClaimService';
import type { TeamExpenseClaim } from '../../types/teamExpenseLedger';
import type {
  SettlementAlert,
  SettlementAlertDomain,
  SettlementAlertSeverity,
  SettlementAlertState,
  SettlementAlertStateStatus,
  SettlementAlertType,
  SettlementAlertWithState,
} from './settlementAlertTypes';

const HIGH_AMOUNT = 3_000_000;
const CRITICAL_AMOUNT = 10_000_000;
const HIGH_AGE_DAYS = 45;
const CRITICAL_AGE_DAYS = 90;

const postedStatuses = new Set(['confirmed', 'paid', 'overdue', '완납', '확정', '연체']);
const cancelledStatuses = new Set(['cancelled', 'canceled', 'cancel', '취소']);

const normalizeText = (value: unknown): string => String(value ?? '').trim();
const normalizeLower = (value: unknown): string => normalizeText(value).toLowerCase();

export const normalizeYearMonth = (value?: string | Date): string => {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
  const text = normalizeText(value);
  if (/^\d{4}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 7);
  return normalizeYearMonth(new Date());
};

const normalizeAmount = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeIdSegment = (value: unknown, fallback = 'none'): string => {
  const normalized = normalizeText(value)
    .replace(/[\\/#?%*:|"<>[\]]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 160);
  return normalized || fallback;
};

export const makeSettlementAlertId = (params: {
  yearMonth: string;
  domain: SettlementAlertDomain;
  type: SettlementAlertType;
  sourceId?: unknown;
  dedupeKey?: unknown;
}): string => [
  normalizeIdSegment(params.yearMonth),
  params.domain,
  params.type,
  normalizeIdSegment(params.sourceId || params.dedupeKey),
].join(':');

const parseDate = (value: unknown): Date | null => {
  const text = normalizeText(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const diffDays = (from: Date | null, to: Date): number => {
  if (!from) return 0;
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
};

const inferMoneySeverity = (amount: number, ageDays = 0): SettlementAlertSeverity => {
  const abs = Math.abs(amount);
  if (abs >= CRITICAL_AMOUNT || ageDays >= CRITICAL_AGE_DAYS) return 'critical';
  if (abs >= HIGH_AMOUNT || ageDays >= HIGH_AGE_DAYS) return 'high';
  return 'medium';
};

const formatWon = (amount: number): string => `${Math.abs(amount).toLocaleString('ko-KR')}원`;

const buildPartyLine = (parts: Array<string | undefined>): string =>
  parts.map(normalizeText).filter(Boolean).join(' · ');

const isSameMonth = (date: unknown, yearMonth: string): boolean => {
  const text = normalizeText(date);
  return text.slice(0, 7) === yearMonth;
};

export const buildReceivableAlerts = (
  ledgers: ReceivableLedger[],
  options: { yearMonth: string; today?: Date | string }
): SettlementAlert[] => {
  const yearMonth = normalizeYearMonth(options.yearMonth);
  const today = options.today instanceof Date ? options.today : parseDate(options.today) || new Date();

  return ledgers
    .filter((ledger) => isSameMonth(ledger.invoiceData?.date, yearMonth))
    .flatMap((ledger): SettlementAlert[] => {
      const status = normalizeText(ledger.status);
      const outstanding = normalizeAmount(ledger.outstandingAmount);
      const totalAmount = normalizeAmount(ledger.invoiceData?.totalAmount);
      const paidAmount = normalizeAmount(ledger.totalPaidAmount);
      const partnerName = normalizeText(ledger.invoiceData?.partnerName) || '거래처 미지정';
      const invoiceDate = normalizeText(ledger.invoiceData?.date);
      const ageDays = diffDays(parseDate(invoiceDate), today);
      const common = {
        yearMonth,
        domain: 'tax' as const,
        sourceCollection: 'receivable_ledgers',
        sourceId: ledger.id,
        companyName: partnerName,
        actionLabel: '미수금 확인',
        actionUrl: '/payroll/taxinvoice/receivables',
      };

      if (status === '과입금' || outstanding < 0) {
        const amount = Math.abs(outstanding || (paidAmount - totalAmount));
        const dedupeKey = `receivable-overpaid:${ledger.id}`;
        return [{
          ...common,
          id: makeSettlementAlertId({ yearMonth, domain: 'tax', type: 'overpaid', sourceId: ledger.id }),
          type: 'overpaid',
          direction: 'payable',
          severity: inferMoneySeverity(amount),
          title: `[과입금] ${partnerName}`,
          description: `${partnerName} 입금액이 청구액보다 ${formatWon(amount)} 많습니다. 입금 매칭, 환불 또는 다음 청구 반영 여부를 확인하세요.`,
          amount,
          dedupeKey,
        }];
      }

      if ((status === '미수' || status === '부분수납') && outstanding > 0) {
        const dedupeKey = `receivable-open:${ledger.id}`;
        return [{
          ...common,
          id: makeSettlementAlertId({ yearMonth, domain: 'tax', type: 'receivable_overdue', sourceId: ledger.id }),
          type: 'receivable_overdue',
          direction: 'receivable',
          severity: inferMoneySeverity(outstanding, ageDays),
          title: `[미수금] ${partnerName}`,
          description: `${invoiceDate || yearMonth} 청구분 ${formatWon(outstanding)}이 아직 남아 있습니다.${ageDays > 0 ? ` 경과 ${ageDays}일.` : ''}`,
          amount: outstanding,
          dedupeKey,
        }];
      }

      return [];
    });
};

export const buildExpenseClaimAlerts = (
  claims: TeamExpenseClaim[],
  options: { yearMonth: string }
): SettlementAlert[] => {
  const yearMonth = normalizeYearMonth(options.yearMonth);

  return claims
    .filter((claim) => normalizeText(claim.yearMonth).slice(0, 7) === yearMonth)
    .flatMap((claim): SettlementAlert[] => {
      const alerts: SettlementAlert[] = [];
      const amount = normalizeAmount(claim.amount);
      const payer = normalizeText(claim.payerTeamName) || '지출팀 미지정';
      const chargeTo = normalizeText(claim.chargeToTeamName) || normalizeText(claim.chargeToTeamId);
      const titleBase = buildPartyLine([payer, chargeTo, claim.siteName, claim.description]) || claim.id;
      const common = {
        yearMonth,
        domain: 'expense' as const,
        sourceCollection: 'team_expense_claims',
        sourceId: claim.id,
        teamId: claim.payerTeamId,
        teamName: payer,
        siteId: claim.siteId,
        siteName: claim.siteName,
        amount,
        actionLabel: '후청구 확인',
        actionUrl: '/support/expense-claims',
      };

      if (claim.status === 'draft') {
        alerts.push({
          ...common,
          id: makeSettlementAlertId({ yearMonth, domain: 'expense', type: 'unconfirmed_billing', sourceId: `${claim.id}:draft` }),
          type: 'unconfirmed_billing',
          direction: claim.claimType === 'teamCharge' ? 'receivable' : 'neutral',
          severity: amount >= HIGH_AMOUNT ? 'high' : 'medium',
          title: `[후청구 미확정] ${titleBase}`,
          description: `${yearMonth} 경비 후청구가 draft 상태입니다. 청구 여부와 처리 상태를 확인하세요.`,
          dedupeKey: `expense-draft:${claim.id}`,
        });
      }

      if (claim.claimType === 'teamCharge' && !normalizeText(claim.chargeToTeamId)) {
        alerts.push({
          ...common,
          id: makeSettlementAlertId({ yearMonth, domain: 'expense', type: 'data_gap', sourceId: `${claim.id}:chargeToTeamId` }),
          type: 'data_gap',
          direction: 'receivable',
          severity: 'high',
          title: `[청구 대상 누락] ${titleBase}`,
          description: '팀 후청구 항목인데 청구 대상 팀이 비어 있습니다. 받을 돈이 정산에서 빠질 수 있습니다.',
          dedupeKey: `expense-missing-charge-team:${claim.id}`,
        });
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        alerts.push({
          ...common,
          id: makeSettlementAlertId({ yearMonth, domain: 'expense', type: 'amount_anomaly', sourceId: `${claim.id}:amount` }),
          type: 'amount_anomaly',
          direction: 'neutral',
          severity: 'high',
          title: `[경비 금액 확인] ${titleBase}`,
          description: '경비 후청구 금액이 0원이거나 유효하지 않습니다. 입력 오류인지 확인하세요.',
          dedupeKey: `expense-amount:${claim.id}`,
        });
      }

      return alerts;
    });
};

const supportIssueSeverity = (type: SupportClaimIssue['type']): SettlementAlertSeverity => {
  if (type === 'MISSING_COUNTERPARTY' || type === 'MISSING_UNIT_PRICE') return 'high';
  return 'medium';
};

const supportIssueTitle = (issue: SupportClaimIssue): string => {
  if (issue.type === 'MISSING_COUNTERPARTY') return `[지원공수 매핑 누락] ${issue.siteName}`;
  if (issue.type === 'MISSING_UNIT_PRICE') return `[지원공수 단가 누락] ${issue.workerName}`;
  if (issue.type === 'MISSING_ID_NUMBER') return `[지원 청구 정보 누락] ${issue.workerName}`;
  return `[지원 청구 주소 누락] ${issue.workerName}`;
};

export const buildSupportClaimIssueAlerts = (
  issues: SupportClaimIssue[],
  options: { yearMonth: string }
): SettlementAlert[] => {
  const yearMonth = normalizeYearMonth(options.yearMonth);

  return issues.map((issue): SettlementAlert => {
    const sourceId = [
      issue.type,
      issue.contractorName,
      issue.teamName,
      issue.siteName,
      issue.workerName,
    ].map((part) => normalizeIdSegment(part)).join(':');
    const isMoneyBlocker = issue.type === 'MISSING_COUNTERPARTY' || issue.type === 'MISSING_UNIT_PRICE';

    return {
      id: makeSettlementAlertId({
        yearMonth,
        domain: 'support',
        type: isMoneyBlocker ? 'missing_billing' : 'data_gap',
        sourceId,
      }),
      yearMonth,
      domain: 'support',
      type: isMoneyBlocker ? 'missing_billing' : 'data_gap',
      direction: isMoneyBlocker ? 'receivable' : 'neutral',
      severity: supportIssueSeverity(issue.type),
      title: supportIssueTitle(issue),
      description: `${issue.contractorName} · ${issue.teamName} · ${issue.siteName} · ${issue.workerName}: ${issue.message}`,
      siteName: issue.siteName,
      teamName: issue.teamName,
      companyName: issue.contractorName,
      sourceCollection: 'support_claim_service',
      sourceId,
      actionLabel: '지원비 청구 명세서',
      actionUrl: '/payroll/support-claim',
      dedupeKey: `support-claim-issue:${sourceId}`,
    };
  });
};

export interface BillingDocumentAlertConfig<T extends Record<string, unknown>> {
  domain: Extract<SettlementAlertDomain, 'vehicle' | 'card' | 'accommodation'>;
  sourceCollection: string;
  actionLabel: string;
  actionUrl: string;
  getLabel: (doc: T) => string;
  getAmount: (doc: T) => number;
  getTeamId?: (doc: T) => string | undefined;
  getTeamName?: (doc: T) => string | undefined;
  getSiteId?: (doc: T) => string | undefined;
  getSiteName?: (doc: T) => string | undefined;
}

export const isPostedBillingStatus = (status: unknown): boolean =>
  postedStatuses.has(normalizeLower(status));

export const isCancelledBillingStatus = (status: unknown): boolean =>
  cancelledStatuses.has(normalizeLower(status));

export const buildUnconfirmedBillingAlerts = <T extends Record<string, unknown>>(
  documents: T[],
  options: { yearMonth: string; config: BillingDocumentAlertConfig<T> }
): SettlementAlert[] => {
  const yearMonth = normalizeYearMonth(options.yearMonth);
  const { config } = options;

  return documents
    .filter((doc) => normalizeText(doc.yearMonth).slice(0, 7) === yearMonth)
    .filter((doc) => !isPostedBillingStatus(doc.status) && !isCancelledBillingStatus(doc.status))
    .map((doc): SettlementAlert => {
      const sourceId = normalizeText(doc.id) || config.getLabel(doc);
      const amount = config.getAmount(doc);
      const label = config.getLabel(doc) || sourceId;
      const statusText = normalizeText(doc.status) || '상태 미지정';

      return {
        id: makeSettlementAlertId({
          yearMonth,
          domain: config.domain,
          type: 'unconfirmed_billing',
          sourceId,
        }),
        yearMonth,
        domain: config.domain,
        type: 'unconfirmed_billing',
        direction: amount > 0 ? 'receivable' : 'neutral',
        severity: amount >= HIGH_AMOUNT ? 'high' : 'medium',
        title: `[미확정 청구] ${label}`,
        description: `${yearMonth} 청구 문서 상태가 ${statusText}입니다. 확정, 지급, 연체 처리 여부를 확인하세요.`,
        amount,
        teamId: config.getTeamId?.(doc),
        teamName: config.getTeamName?.(doc),
        siteId: config.getSiteId?.(doc),
        siteName: config.getSiteName?.(doc),
        sourceCollection: config.sourceCollection,
        sourceId,
        actionLabel: config.actionLabel,
        actionUrl: config.actionUrl,
        dedupeKey: `${config.domain}:unconfirmed:${sourceId}`,
      };
    });
};

export const mergeAlertStates = (
  alerts: SettlementAlert[],
  states: SettlementAlertState[],
  options: { includeResolved?: boolean } = {}
): SettlementAlertWithState[] => {
  const stateByAlertId = new Map(states.map((state) => [state.alertId, state]));
  return alerts
    .map((alert) => {
      const state = stateByAlertId.get(alert.id);
      const stateStatus: SettlementAlertStateStatus = state?.status || 'open';
      return { ...alert, state, stateStatus };
    })
    .filter((alert) => options.includeResolved || alert.stateStatus !== 'resolved');
};

export const summarizeSettlementAlerts = (alerts: SettlementAlertWithState[]) => alerts.reduce(
  (summary, alert) => {
    const amount = normalizeAmount(alert.amount);
    summary.total += 1;
    if (alert.severity === 'critical') summary.critical += 1;
    if (alert.severity === 'high') summary.high += 1;
    if (alert.direction === 'receivable') summary.receivableAmount += amount;
    if (alert.direction === 'payable') summary.payableAmount += amount;
    if (alert.type === 'missing_billing' || alert.type === 'unconfirmed_billing') summary.unconfirmedCount += 1;
    if (alert.stateStatus === 'resolved') summary.resolvedCount += 1;
    else summary.openCount += 1;
    return summary;
  },
  {
    total: 0,
    critical: 0,
    high: 0,
    receivableAmount: 0,
    payableAmount: 0,
    unconfirmedCount: 0,
    openCount: 0,
    resolvedCount: 0,
  }
);
