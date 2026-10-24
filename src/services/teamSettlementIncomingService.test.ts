import { auth } from '../config/firebase';
import { getTeamScopedRows } from './teamScopedReadService';
import { dailyReportService } from './dailyReportService';
import { teamService } from './teamService';
import { siteService } from './siteService';
import { manpowerService } from './manpowerService';
import { supportRateService } from './supportRateService';
import { getTeamSettlementIncomingRows, getTeamSettlementOutgoingRows } from './teamSettlementIncomingService';

jest.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'admin' } } }));
jest.mock('./teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));
jest.mock('./dailyReportService', () => ({ dailyReportService: { getReportsByRange: jest.fn() } }));
jest.mock('./teamService', () => ({ teamService: { getTeams: jest.fn() } }));
jest.mock('./siteService', () => ({ siteService: { getSites: jest.fn() } }));
jest.mock('./manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));
jest.mock('./supportRateService', () => ({ supportRateService: { getAllSiteRates: jest.fn() } }));

const params = { yearMonth: '2026-08', teamId: 'a' };
beforeEach(() => {
  jest.clearAllMocks();
  (auth as any).currentUser = { uid: 'admin' };
  (getTeamScopedRows as jest.Mock).mockResolvedValue(null);
  (teamService.getTeams as jest.Mock).mockResolvedValue([{ id: 'a', legacyId: 'old-a' }, { id: 'b', legacyId: 'old-b', name: '지원팀', supportRate: 250000 }]);
  (siteService.getSites as jest.Mock).mockResolvedValue([{ id: 'site', legacyId: 'old-site', responsibleTeamId: 'a' }]);
  (manpowerService.getWorkers as jest.Mock).mockResolvedValue([{ id: 'own', teamId: 'a' }]);
  (supportRateService.getAllSiteRates as jest.Mock).mockResolvedValue([{ siteId: 'site', defaultRate: 270000 }]);
  (dailyReportService.getReportsByRange as jest.Mock).mockResolvedValue([
    { date: '2026-08-03', siteId: 'old-site', responsibleTeamId: 'old-a', workers: [
      { workerId: 'b1', teamId: 'old-b', manDay: 1, unitPrice: 990000, name: 'private-name' },
      { workerId: 'b2', teamId: 'b', manDay: 0.5, unitPrice: 880000 },
      { workerId: 'own', teamId: 'a', manDay: 1 }
    ] }
  ]);
});

it('관리자도 담당 현장에 지원 온 팀을 합산하고 개인 급여 대신 지원단가를 표시한다', async () => {
  const rows = await getTeamSettlementIncomingRows(params);
  expect(dailyReportService.getReportsByRange).toHaveBeenCalledWith('2026-08-01', '2026-08-31');
  expect(rows).toEqual([expect.objectContaining({ teamId: 'b', teamLegacyId: 'old-b', siteId: 'site', manDay: 1.5, supportRate: 270000, supportAmount: 405000 })]);
  expect(JSON.stringify(rows)).not.toMatch(/private-name|990000|880000|workerId|unitPrice/);
});

it('팀장의 서버 응답이 빈 배열이어도 관리자 전체 조회로 전환하지 않는다', async () => {
  (getTeamScopedRows as jest.Mock).mockResolvedValue([]);
  expect(await getTeamSettlementIncomingRows(params)).toEqual([]);
  expect(dailyReportService.getReportsByRange).not.toHaveBeenCalled();
});

it('팀장 조회 거부를 전체 조회로 우회하지 않는다', async () => {
  (getTeamScopedRows as jest.Mock).mockRejectedValue(new Error('permission-denied'));
  await expect(getTeamSettlementIncomingRows(params)).rejects.toThrow('permission-denied');
  expect(teamService.getTeams).not.toHaveBeenCalled();
});

it('서버에서 조회한 팀장 공수와 지원단가를 그대로 사용한다', async () => {
  const rows = [{ id: 'incoming', manDay: 2, supportRate: 230000 }];
  (getTeamScopedRows as jest.Mock).mockResolvedValue(rows);
  expect(await getTeamSettlementIncomingRows(params)).toBe(rows);
  expect(dailyReportService.getReportsByRange).not.toHaveBeenCalled();
});

it('담당 팀이 다른 과거 일보와 다른 달 일보를 포함하지 않는다', async () => {
  (dailyReportService.getReportsByRange as jest.Mock).mockResolvedValue([
    { date: '2026-08-03', siteId: 'site', responsibleTeamId: 'b', workers: [{ teamId: 'b', manDay: 2 }] },
    { date: '2026-09-01', siteId: 'site', responsibleTeamId: 'a', workers: [{ teamId: 'b', manDay: 2 }] }
  ]);
  expect(await getTeamSettlementIncomingRows(params)).toEqual([]);
});

it('현장 단가가 없으면 팀 지원단가, 팀 단가도 없으면 기본 지원단가를 사용한다', async () => {
  (supportRateService.getAllSiteRates as jest.Mock).mockResolvedValue([]);
  expect((await getTeamSettlementIncomingRows(params))[0].supportRate).toBe(250000);
  (teamService.getTeams as jest.Mock).mockResolvedValue([{ id: 'a', legacyId: 'old-a' }, { id: 'b', legacyId: 'old-b' }]);
  expect((await getTeamSettlementIncomingRows(params))[0].supportRate).toBe(230000);
});

it('잘못된 조회 월을 거부한다', async () => {
  await expect(getTeamSettlementIncomingRows({ ...params, yearMonth: '2026-13' })).rejects.toThrow('조회 월');
  expect(getTeamScopedRows).not.toHaveBeenCalled();
});

it('지원 간 우리 팀 공수도 팀장 서버 조회를 사용하며 관리자 전체 조회로 우회하지 않는다', async () => {
  const rows = [{ id: 'outgoing', manDay: 3, supportRate: 270000 }];
  (getTeamScopedRows as jest.Mock).mockResolvedValue(rows);
  expect(await getTeamSettlementOutgoingRows(params)).toBe(rows);
  expect(getTeamScopedRows).toHaveBeenCalledWith('team_settlement_incoming', { ...params, direction: 'outgoing' });
  (getTeamScopedRows as jest.Mock).mockRejectedValue(new Error('permission-denied'));
  await expect(getTeamSettlementOutgoingRows(params)).rejects.toThrow('permission-denied');
  expect(dailyReportService.getReportsByRange).not.toHaveBeenCalled();
});

it('관리자 조회 도중 계정이 바뀌면 이전 계정의 결과를 반환하지 않는다', async () => {
  (dailyReportService.getReportsByRange as jest.Mock).mockImplementation(async () => {
    (auth as any).currentUser = { uid: 'other' };
    return [];
  });
  await expect(getTeamSettlementIncomingRows(params)).rejects.toThrow('로그인 계정이 변경');
});
