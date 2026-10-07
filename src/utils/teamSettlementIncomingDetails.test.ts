import { applySavedIncomingSupportRates, applySavedOutgoingSupportRates, getIncomingTeamsForSettlementLine, getOutgoingTeamsForSettlementLine } from './teamSettlementIncomingDetails';
import type { TeamSettlementIncomingRow } from '../services/teamSettlementIncomingService';

const row: TeamSettlementIncomingRow = { id: 'r', date: '2026-09-01', siteId: 'site-a', siteLegacyId: 'old-site', siteName: 'A현장', teamId: 'b', teamLegacyId: 'old-b', teamName: 'B팀', manDay: 2 };
const siteLine = { source: 'auto', origin: 'daily_report', direction: 'sales', siteId: 'site-a' };
it('지원 매출의 상대팀과 현장을 연결하고 저장된 우리 팀 지원단가를 사용한다', () => {
  const line = { id: 'sale', source: 'auto' as const, origin: '내부지원간곳' as const, kind: '지원' as const,
    siteId: 'old-site', siteName: 'A현장', counterTeamId: 'old-b', manDay: 2, amount: 540000 };
  expect(getOutgoingTeamsForSettlementLine({ ...line, direction: 'sales' }, [row])).toEqual([row]);
  expect(applySavedOutgoingSupportRates([row], [line])[0]).toMatchObject({ manDay: 2, supportRate: 270000, supportAmount: 540000 });
  expect(getOutgoingTeamsForSettlementLine({ ...line, direction: 'purchase' }, [row])).toEqual([]);
});
it('도급·직영 현장 상세에 지원 온 팀을 연결한다', () => {
  expect(getIncomingTeamsForSettlementLine(siteLine, [row])).toEqual([row]);
  expect(getIncomingTeamsForSettlementLine({ ...siteLine, siteId: 'old-site' }, [row])).toEqual([row]);
});
it('합쳐진 지원 매입 상세는 해당 상대팀의 여러 현장을 보여준다', () => {
  const line = { source: 'auto', origin: '내부지원온곳', direction: 'purchase', counterTeamId: 'old-b' };
  const second = { ...row, id: 'r2', siteId: 'site-b' };
  expect(getIncomingTeamsForSettlementLine(line, [row, second, { ...row, teamId: 'c', teamLegacyId: undefined }])).toEqual([row, second]);
  expect(getIncomingTeamsForSettlementLine({ ...line, origin: 'support_fee_incoming' }, [row])).toEqual([row]);
});
it('ID가 다른 같은 이름 현장·다른 지원팀·지원간곳·수기 항목은 섞지 않는다', () => {
  for (const line of [
    { ...siteLine, siteId: 'other', siteName: row.siteName },
    { ...siteLine, source: 'manual' },
    { ...siteLine, origin: '내부지원간곳' },
    { source: 'auto', origin: '외부지원온곳', direction: 'purchase', counterTeamId: 'c', counterTeamName: row.teamName },
  ]) expect(getIncomingTeamsForSettlementLine(line, [row])).toEqual([]);
});
it('ID 없는 구 정산은 저장된 현장명과 팀명으로 연결한다', () => {
  expect(getIncomingTeamsForSettlementLine({ source: 'auto', origin: '외부지원온곳', direction: 'purchase', siteName: 'A 현장', counterTeamName: 'B 팀' }, [row])).toEqual([row]);
});

it('저장된 지원 정산 단가를 우선하고 금액 반올림도 정산 합계와 맞춘다', () => {
  const rows = [row, { ...row, id: 'r2', manDay: 1, date: '2026-09-02' }];
  const result = applySavedIncomingSupportRates(rows, [{ id: 'p', source: 'auto', origin: '내부지원온곳', kind: '지원', siteId: 'site-a', siteName: 'A현장', counterTeamId: 'b', manDay: 3, amount: 700001 }]);
  expect(result.every(value => value.rateSource === 'saved')).toBe(true);
  expect(result[0].supportRate).toBe(700001 / 3);
  expect(result.reduce((sum, value) => sum + value.supportAmount!, 0)).toBe(700001);
  expect(applySavedIncomingSupportRates([{ ...row, supportRate: 250000, supportAmount: 500000 }], [])[0].supportRate).toBe(250000);
  expect(rows[0]).toBe(row);
});
