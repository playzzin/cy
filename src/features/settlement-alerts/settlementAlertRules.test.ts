import type { ReceivableLedger } from '../../services/receivableService';
import type { TeamExpenseClaim } from '../../types/teamExpenseLedger';
import {
  buildExpenseClaimAlerts,
  buildReceivableAlerts,
  buildSupportClaimIssueAlerts,
  buildUnconfirmedBillingAlerts,
  mergeAlertStates,
} from './settlementAlertRules';
import type { SettlementAlert } from './settlementAlertTypes';

const makeReceivable = (overrides: Partial<ReceivableLedger>): ReceivableLedger => {
  const invoiceData: ReceivableLedger['invoiceData'] = {
    date: '2026-06-01',
    partnerName: '청연건설',
    totalAmount: 5000000,
    itemName: '공사대금',
    ...overrides.invoiceData,
  };
  const { invoiceData: _invoiceDataOverride, ...restOverrides } = overrides;

  return {
    id: 'r1',
    invoiceData,
    status: '미수',
    totalPaidAmount: 0,
    outstandingAmount: 5000000,
    registeredAt: null,
    updatedAt: null,
    ...restOverrides,
  };
};

const makeExpenseClaim = (overrides: Partial<TeamExpenseClaim>): TeamExpenseClaim => ({
  id: 'c1',
  yearMonth: '2026-06',
  date: '2026-06-15',
  claimType: 'teamCharge',
  payerTeamId: 'team-a',
  payerTeamName: 'A팀',
  chargeToTeamId: 'team-b',
  chargeToTeamName: 'B팀',
  siteId: 'site-a',
  siteName: '강남현장',
  category: '식대',
  description: '야간 식대',
  amount: 120000,
  status: 'draft',
  ...overrides,
});

describe('settlementAlertRules', () => {
  it('builds overdue receivable alerts for the selected month', () => {
    const alerts = buildReceivableAlerts([
      makeReceivable({ outstandingAmount: 3500000 }),
      makeReceivable({ id: 'old', invoiceData: { date: '2026-05-31', partnerName: '이전거래처', totalAmount: 1000000, itemName: '이전분' } }),
      makeReceivable({ id: 'missing-date', invoiceData: { date: '', partnerName: '날짜없음', totalAmount: 1000000, itemName: '미지정' } }),
    ], { yearMonth: '2026-06', today: '2026-07-20' });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      type: 'receivable_overdue',
      direction: 'receivable',
      severity: 'high',
      amount: 3500000,
      companyName: '청연건설',
    });
  });

  it('builds payable alerts for overpaid receivables', () => {
    const alerts = buildReceivableAlerts([
      makeReceivable({
        status: '과입금',
        totalPaidAmount: 5300000,
        outstandingAmount: -300000,
      }),
    ], { yearMonth: '2026-06', today: '2026-06-30' });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      type: 'overpaid',
      direction: 'payable',
      amount: 300000,
    });
  });

  it('builds expense claim alerts for draft, missing target, and invalid amount', () => {
    const alerts = buildExpenseClaimAlerts([
      makeExpenseClaim({
        chargeToTeamId: '',
        chargeToTeamName: '',
        amount: 0,
      }),
    ], { yearMonth: '2026-06' });

    expect(alerts.map((alert) => alert.type).sort()).toEqual([
      'amount_anomaly',
      'data_gap',
      'unconfirmed_billing',
    ]);
    expect(alerts.every((alert) => alert.actionUrl === '/support/expense-claims')).toBe(true);
  });

  it('builds unconfirmed billing alerts and skips posted or cancelled documents', () => {
    const alerts = buildUnconfirmedBillingAlerts([
      { id: 'v1', yearMonth: '2026-06', status: 'draft', label: '차량 12가3456', amount: 4000000 },
      { id: 'v2', yearMonth: '2026-06', status: 'confirmed', label: '확정 차량', amount: 1000000 },
      { id: 'v3', yearMonth: '2026-06', status: '취소', label: '취소 차량', amount: 1000000 },
    ], {
      yearMonth: '2026-06',
      config: {
        domain: 'vehicle',
        sourceCollection: 'vehicle_billing_documents',
        actionLabel: '차량 청구 로그',
        actionUrl: '/support/vehicles/logs',
        getLabel: (doc) => String(doc.label),
        getAmount: (doc) => Number(doc.amount),
      },
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      domain: 'vehicle',
      type: 'unconfirmed_billing',
      severity: 'high',
      amount: 4000000,
    });
  });

  it('builds support claim issue alerts from existing claim validation issues', () => {
    const alerts = buildSupportClaimIssueAlerts([
      {
        type: 'MISSING_UNIT_PRICE',
        workerName: '홍길동',
        contractorName: '청연',
        teamName: '지원A팀',
        siteName: '판교현장',
        message: '단가 정보가 없어 청구 금액 계산이 불완전합니다.',
      },
      {
        type: 'MISSING_ADDRESS',
        workerName: '김철수',
        contractorName: '청연',
        teamName: '지원A팀',
        siteName: '판교현장',
        message: '주소가 누락되었습니다.',
      },
    ], { yearMonth: '2026-06' });

    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toMatchObject({
      domain: 'support',
      type: 'missing_billing',
      direction: 'receivable',
      severity: 'high',
      actionUrl: '/payroll/support-claim',
    });
    expect(alerts[1]).toMatchObject({
      domain: 'support',
      type: 'data_gap',
      direction: 'neutral',
      severity: 'medium',
    });
  });

  it('hides resolved alerts unless includeResolved is enabled', () => {
    const alert: SettlementAlert = {
      id: 'alert-1',
      yearMonth: '2026-06',
      domain: 'tax',
      type: 'receivable_overdue',
      direction: 'receivable',
      severity: 'high',
      title: '미수금',
      description: '확인 필요',
      amount: 1000000,
      actionLabel: '미수금 확인',
      actionUrl: '/payroll/taxinvoice/receivables',
      dedupeKey: 'alert-1',
    };

    const states = [{ alertId: 'alert-1', yearMonth: '2026-06', status: 'resolved' as const }];

    expect(mergeAlertStates([alert], states)).toHaveLength(0);
    expect(mergeAlertStates([alert], states, { includeResolved: true })[0].stateStatus).toBe('resolved');
  });
});
