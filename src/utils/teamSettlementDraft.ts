import type {
  TeamSettlementDocument,
  TeamSettlementPurchaseItem,
  TeamSettlementSalesItem
} from '../types/teamSettlement';

export type TeamSettlementConfirmationIssue = {
  code: string;
  message: string;
};
const safeAmount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const lineLabel = (line: TeamSettlementSalesItem | TeamSettlementPurchaseItem): string => (
  String(line.siteName || line.counterTeamName || line.kind || '미지정 내역').trim()
);

export const createTeamSettlementDraftFingerprint = (
  doc: TeamSettlementDocument | null
): string => {
  if (!doc) return '';

  return JSON.stringify({
    ...doc,
    confirmedAt: null,
    updatedAt: ''
  });
};

export const getTeamSettlementConfirmationIssues = (
  doc: TeamSettlementDocument | null
): TeamSettlementConfirmationIssue[] => {
  if (!doc) {
    return [{ code: 'missing-document', message: '정산 문서를 먼저 불러와 주세요.' }];
  }

  const issues: TeamSettlementConfirmationIssue[] = [];

  doc.sales.forEach((line) => {
    if (safeAmount(line.manDay) <= 0 || safeAmount(line.amount) > 0) return;
    issues.push({
      code: `sales-amount:${line.id}`,
      message: `${lineLabel(line)} 매출의 공수는 있지만 정산금액이 0원입니다.`
    });
  });

  doc.purchases.forEach((line) => {
    if (safeAmount(line.manDay) <= 0 || safeAmount(line.amount) > 0) return;
    issues.push({
      code: `purchase-amount:${line.id}`,
      message: `${lineLabel(line)} 매입의 공수는 있지만 정산금액이 0원입니다.`
    });
  });

  doc.deductions.forEach((item) => {
    if (item.source !== 'manual') return;
    if (!String(item.category ?? '').trim() || safeAmount(item.amount) === 0) {
      issues.push({
        code: `manual-deduction:${item.id}`,
        message: '수기 공제 항목의 이름과 금액을 확인해 주세요.'
      });
    }
  });

  (doc.additions ?? []).forEach((item) => {
    if (item.source !== 'manual') return;
    if (!String(item.category ?? '').trim() || safeAmount(item.amount) === 0) {
      issues.push({
        code: `manual-addition:${item.id}`,
        message: '수기 추가 항목의 이름과 금액을 확인해 주세요.'
      });
    }
  });

  return issues;
};
