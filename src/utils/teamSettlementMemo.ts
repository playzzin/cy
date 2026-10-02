import type { TeamExpenseClaim } from '../types/teamExpenseLedger';

type SettlementMemoItem = { source: string; origin: string; memo?: string };

/** Only known automatic wording is shortened; user notes and unknown text stay intact. */
export const formatTeamSettlementMemo = (item: SettlementMemoItem): string => {
  const memo = item.memo ?? '';
  if (item.source !== 'auto') return memo;

  if (['daily_report', 'support_client_site'].includes(item.origin) && memo === '지원정산 정산금액 기준') {
    return '지원정산';
  }
  if (['내부지원간곳', '외부지원간곳', '내부지원온곳', '외부지원온곳', 'support_fee_outgoing', 'support_fee_incoming'].includes(item.origin)
    && memo === '지원단가 기준 노임총액') {
    return '지원단가';
  }
  if ((item.origin === 'accommodation_billing' && memo === '월별 공과금 대장 자동집계')
    || (item.origin === 'card_billing' && memo === '월별 카드 대장 자동집계')) {
    return '월 집계';
  }
  if (item.origin === 'vehicle_billing') {
    const match = /^월별 차량 대장 배정일 자동배분 \((\d+)일\)$/.exec(memo);
    if (match) return `배분 ${match[1]}일`;
  }
  if (item.origin === 'office_expense') {
    const match = /^도급\+직영 총공수 (\d+(?:\.\d+)?) \* 10,000원$/.exec(memo);
    if (match) return `${match[1]}공수×1만원`;
  }
  const salaryModel = ({
    daily_wage_payroll: '일급제',
    monthly_wage_payroll: '월급제',
    service_team_payroll: '용역팀'
  } as Record<string, string>)[item.origin];
  if (salaryModel) {
    const match = /^(일급제|월급제|용역팀) (\d+)명 \/ 총공수 (\d+(?:\.\d+)?)$/.exec(memo);
    if (match?.[1] === salaryModel) return `${match[2]}명·${match[3]}공수`;
  }
  return memo;
};

export const compactTeamSettlementAutoMemo = <T extends SettlementMemoItem>(item: T): T => {
  const memo = formatTeamSettlementMemo(item);
  return memo === (item.memo ?? '') ? item : { ...item, memo };
};

/** Site/card details remain in the source claim; retain date, direction and the full user note. */
export const buildTeamExpenseSettlementMemo = (
  claim: Pick<TeamExpenseClaim, 'date' | 'claimType' | 'chargeToTeamId' | 'payerTeamName' | 'chargeToTeamName' | 'memo'>,
  direction: 'deduction' | 'addition'
): string => {
  const isTeamCharge = claim.claimType === 'teamCharge' && Boolean(String(claim.chargeToTeamId ?? '').trim());
  const label = direction === 'addition'
    ? `받을 후청구: ${String(claim.chargeToTeamName ?? '').trim() || '대상 미지정'}`
    : isTeamCharge
      ? `후청구: ${String(claim.payerTeamName ?? '').trim() || '사용팀 미지정'}`
      : claim.claimType === 'officeExpense' ? '사무실경비' : '기타청구';
  return [String(claim.date ?? '').trim(), label, String(claim.memo ?? '').trim()].filter(Boolean).join(' / ');
};
