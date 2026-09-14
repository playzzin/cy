export type TeamSettlementTransactionSummaryLabel = '매출' | '매입';

const toFiniteNumber = (value: number): number => (
  Number.isFinite(value) ? value : 0
);

export const formatTeamSettlementSummaryManDay = (value: number): string => {
  const rounded = Math.round(toFiniteNumber(value) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

export const buildTeamSettlementTransactionSummary = (
  label: TeamSettlementTransactionSummaryLabel,
  amount: number,
  manDay: number
): string => (
  `${label} - ${new Intl.NumberFormat('ko-KR').format(toFiniteNumber(amount))}원 (${formatTeamSettlementSummaryManDay(manDay)}공수)`
);
