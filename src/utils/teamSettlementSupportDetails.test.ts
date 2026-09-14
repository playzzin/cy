import {
  getTeamSettlementSupportDetailConsistency,
  resolveTeamSettlementSupportDetails
} from './teamSettlementSupportDetails';
import type {
  TeamSettlementSourceSnapshot,
  TeamSettlementSupportDetailSnapshot
} from '../types/teamSettlement';

const buildRow = (manDay: number): TeamSettlementSupportDetailSnapshot => ({
  id: `row-${manDay}`,
  direction: '내부지원간곳',
  date: '2026-08-01',
  siteId: 'site-1',
  siteName: '테스트 현장',
  counterTeamId: 'team-2',
  counterTeamName: '김봉수팀',
  workerId: 'worker-1',
  workerName: '작업자',
  workerTeamId: 'team-1',
  workerTeamName: '김종남팀',
  manDay,
  unitPrice: 230000,
  amount: manDay * 230000
});

describe('teamSettlementSupportDetails', () => {
  it('저장된 지원 상세 스냅샷을 최신 원천보다 우선한다', () => {
    const snapshotRow = buildRow(21);
    const snapshot: TeamSettlementSourceSnapshot = {
      version: 2,
      capturedAt: '2026-08-01T00:00:00.000Z',
      dailyReports: [],
      supportDetails: [snapshotRow],
      totals: { sales: 0, purchases: 0, deductions: 0, additions: 0, net: 0 }
    };

    const resolved = resolveTeamSettlementSupportDetails(snapshot, [buildRow(94)]);

    expect(resolved.source).toBe('snapshot');
    expect(resolved.rows).toEqual([snapshotRow]);
  });

  it('구 스냅샷은 현재 원천을 사용하되 공수 불일치를 감지한다', () => {
    const legacySnapshot: TeamSettlementSourceSnapshot = {
      version: 1,
      capturedAt: '2026-07-01T00:00:00.000Z',
      dailyReports: [],
      totals: { sales: 0, purchases: 0, deductions: 0, additions: 0, net: 0 }
    };

    const resolved = resolveTeamSettlementSupportDetails(legacySnapshot, [buildRow(87), buildRow(7)]);
    const consistency = getTeamSettlementSupportDetailConsistency(21, resolved.rows);

    expect(resolved.source).toBe('live');
    expect(consistency).toEqual({ expectedManDay: 21, detailManDay: 94, matches: false });
  });
});
