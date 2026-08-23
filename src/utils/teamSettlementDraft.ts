import type {
  TeamSettlementDocument,
  TeamSettlementPurchaseItem,
  TeamSettlementSalesItem
} from '../types/teamSettlement';

export type TeamSettlementConfirmationIssue = {
  code: string;
  message: string;
  severity?: 'error' | 'warning';
  targetId?: string;
};
const safeAmount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const lineLabel = (line: TeamSettlementSalesItem | TeamSettlementPurchaseItem): string => (
  String(line.siteName || line.counterTeamName || line.kind || '미지정 내역').trim()
);

const sumAutoAmounts = (rows: Array<{ source: string; amount: number }>): number =>
  Math.round(rows
    .filter((row) => row.source === 'auto')
    .reduce((sum, row) => sum + safeAmount(row.amount), 0));

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
      message: `${lineLabel(line)} 매출의 공수는 있지만 정산금액이 0원입니다.`,
      severity: 'error',
      targetId: 'settlement-transactions'
    });
  });

  doc.purchases.forEach((line) => {
    if (safeAmount(line.manDay) <= 0 || safeAmount(line.amount) > 0) return;
    issues.push({
      code: `purchase-amount:${line.id}`,
      message: `${lineLabel(line)} 매입의 공수는 있지만 정산금액이 0원입니다.`,
      severity: 'error',
      targetId: 'settlement-transactions'
    });
  });

  doc.deductions.forEach((item) => {
    if (item.source !== 'manual') return;
    if (!String(item.category ?? '').trim() || safeAmount(item.amount) === 0) {
      issues.push({
        code: `manual-deduction:${item.id}`,
        message: '수기 공제 항목의 이름과 금액을 확인해 주세요.',
        severity: 'error',
        targetId: 'settlement-deductions'
      });
    }
  });

  (doc.additions ?? []).forEach((item) => {
    if (item.source !== 'manual') return;
    if (!String(item.category ?? '').trim() || safeAmount(item.amount) === 0) {
      issues.push({
        code: `manual-addition:${item.id}`,
        message: '수기 추가 항목의 이름과 금액을 확인해 주세요.',
        severity: 'error',
        targetId: 'settlement-additions'
      });
    }
  });

  if (doc.sourceSnapshot) {
    const snapshotTotals = doc.sourceSnapshot.totals;
    const currentAutoTotals = {
      sales: sumAutoAmounts(doc.sales),
      purchases: sumAutoAmounts(doc.purchases),
      deductions: sumAutoAmounts(doc.deductions),
      additions: sumAutoAmounts(doc.additions ?? [])
    };
    const totalChecks = [
      { key: 'sales', label: '매출', targetId: 'settlement-transactions' },
      { key: 'purchases', label: '매입', targetId: 'settlement-transactions' },
      { key: 'deductions', label: '공제', targetId: 'settlement-deductions' },
      { key: 'additions', label: '추가', targetId: 'settlement-additions' }
    ] as const;

    totalChecks.forEach(({ key, label, targetId }) => {
      if (Math.abs(currentAutoTotals[key] - snapshotTotals[key]) <= 1) return;
      issues.push({
        code: `snapshot-total:${key}`,
        message: `${label} 자동집계 합계가 저장된 원천 스냅샷과 일치하지 않습니다. 재집계해 주세요.`,
        severity: 'error',
        targetId
      });
    });

    const expectedSnapshotNet = snapshotTotals.sales
      - snapshotTotals.purchases
      - snapshotTotals.deductions
      + snapshotTotals.additions;
    if (Math.abs(expectedSnapshotNet - snapshotTotals.net) > 1) {
      issues.push({
        code: 'snapshot-total:net',
        message: '최종 자동집계 합계가 매출·매입·공제·추가 원천 합계와 일치하지 않습니다.',
        severity: 'error',
        targetId: 'settlement-finalize'
      });
    }
  }

  return issues;
};
