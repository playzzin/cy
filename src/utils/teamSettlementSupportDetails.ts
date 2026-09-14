import type {
  TeamSettlementSourceSnapshot,
  TeamSettlementSupportDetailSnapshot
} from '../types/teamSettlement';

export type TeamSettlementSupportDetailSource = 'snapshot' | 'live';

export const resolveTeamSettlementSupportDetails = (
  snapshot: TeamSettlementSourceSnapshot | undefined,
  liveRows: TeamSettlementSupportDetailSnapshot[]
): { rows: TeamSettlementSupportDetailSnapshot[]; source: TeamSettlementSupportDetailSource } => {
  if (snapshot?.supportDetails) {
    return { rows: snapshot.supportDetails, source: 'snapshot' };
  }

  return { rows: liveRows, source: 'live' };
};

export const getTeamSettlementSupportDetailConsistency = (
  expectedManDay: number,
  rows: Array<{ manDay: number }>,
  tolerance = 0.05
): { expectedManDay: number; detailManDay: number; matches: boolean } => {
  const safeExpected = Number.isFinite(expectedManDay) ? expectedManDay : 0;
  const detailManDay = rows.reduce(
    (sum, row) => sum + (Number.isFinite(row.manDay) ? row.manDay : 0),
    0
  );

  return {
    expectedManDay: safeExpected,
    detailManDay,
    matches: Math.abs(safeExpected - detailManDay) <= tolerance
  };
};
