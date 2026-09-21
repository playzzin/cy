import type { TeamSettlementDocument } from '../types/teamSettlement';
import { TeamSettlementDocumentSchema } from '../types/teamSettlement';
import {
  createTeamSettlementDraftFingerprint,
  getTeamSettlementConfirmationIssues
} from './teamSettlementDraft';

const buildDocument = (): TeamSettlementDocument => ({
  yearMonth: '2026-08',
  teamId: 'team-1',
  teamName: '테스트팀',
  sales: [],
  purchases: [],
  deductions: [],
  additions: [],
  summary: { prevCarryover: 0, deposit: 0 },
  confirmedAt: null,
  updatedAt: '2026-08-04T00:00:00.000Z'
});

describe('teamSettlementDraft', () => {
  test('메모를 저장 형식에 보존하고 작성·삭제를 미저장 변경으로 인식한다', () => {
    const original = buildDocument();
    const edited = TeamSettlementDocumentSchema.parse({ ...original, transactionMemo: '확인할 내용\n전달사항' });
    expect(edited.transactionMemo).toBe('확인할 내용\n전달사항');
    expect(TeamSettlementDocumentSchema.safeParse(original).success).toBe(true);
    expect(createTeamSettlementDraftFingerprint(edited)).not.toBe(createTeamSettlementDraftFingerprint(original));
    expect(createTeamSettlementDraftFingerprint({ ...edited, transactionMemo: '' })).not.toBe(createTeamSettlementDraftFingerprint(edited));
  });

  test('저장 시각과 확정 시각은 편집 변경으로 계산하지 않는다', () => {
    const first = buildDocument();
    const second = {
      ...first,
      confirmedAt: '2026-08-04T01:00:00.000Z',
      updatedAt: '2026-08-04T01:00:00.000Z'
    };

    expect(createTeamSettlementDraftFingerprint(first)).toBe(
      createTeamSettlementDraftFingerprint(second)
    );
  });

  test('공수는 있지만 금액이 없는 거래를 확정 전 검토 항목으로 반환한다', () => {
    const doc = buildDocument();
    doc.sales.push({
      id: 'sale-1',
      source: 'auto',
      origin: 'daily_report',
      kind: '도급',
      siteName: 'A현장',
      manDay: 3,
      amount: 0
    });

    expect(getTeamSettlementConfirmationIssues(doc)).toEqual([
      expect.objectContaining({ code: 'sales-amount:sale-1' })
    ]);
  });

  test('비어 있는 수기 조정 항목을 확정 전 검토 항목으로 반환한다', () => {
    const doc = buildDocument();
    doc.additions = [{
      id: 'addition-1',
      source: 'manual',
      origin: 'manual',
      category: '',
      amount: 0
    }];

    expect(getTeamSettlementConfirmationIssues(doc)).toEqual([
      expect.objectContaining({ code: 'manual-addition:addition-1' })
    ]);
  });

  test('저장된 원천 스냅샷 합계와 자동집계 금액이 다르면 오류를 반환한다', () => {
    const doc = buildDocument();
    doc.sales = [{
      id: 'sale-snapshot',
      source: 'auto',
      origin: 'daily_report',
      kind: '직영',
      siteName: 'A현장',
      manDay: 1,
      amount: 100000
    }];
    doc.sourceSnapshot = {
      version: 1,
      capturedAt: '2026-08-04T00:00:00.000Z',
      dailyReports: [],
      totals: {
        sales: 90000,
        purchases: 0,
        deductions: 0,
        additions: 0,
        net: 90000
      }
    };

    expect(getTeamSettlementConfirmationIssues(doc)).toEqual([
      expect.objectContaining({ code: 'snapshot-total:sales', targetId: 'settlement-transactions' })
    ]);
  });
});
