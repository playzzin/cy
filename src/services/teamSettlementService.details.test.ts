import { teamSettlementService } from './teamSettlementService';
import { getTeamScopedRows } from './teamScopedReadService';
import { teamService } from './teamService';
import { dailyReportService } from './dailyReportService';

jest.mock('../config/firebase', () => ({ db: {}, auth: {}, functions: {}, storage: {} }));
jest.mock('./teamScopedReadService', () => ({ getTeamScopedRows: jest.fn() }));
jest.mock('../utils/swal', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

afterEach(() => jest.restoreAllMocks());

it('팀장 상세는 일반 일보/타 팀 목록 없이 서버가 허용한 작업자 행을 그대로 사용한다', async () => {
  const rows = [{ id: 'detail', direction: '내부지원온곳', workerName: '지원 작업자', manDay: 2, unitPrice: 270000 }];
  jest.mocked(getTeamScopedRows).mockResolvedValue(rows);
  const teams = jest.spyOn(teamService, 'getTeams');
  const reports = jest.spyOn(dailyReportService, 'getReportsByRange');
  await expect(teamSettlementService.getSupportSettlementDetailRows({ yearMonth: '2026-08', teamId: 'own' })).resolves.toBe(rows);
  expect(getTeamScopedRows).toHaveBeenCalledWith('team_settlement_support_details', { yearMonth: '2026-08', teamId: 'own' });
  expect(teams).not.toHaveBeenCalled();
  expect(reports).not.toHaveBeenCalled();
});

it('지원 상세 권한 오류를 일반 조회로 우회하거나 빈 목록으로 숨기지 않는다', async () => {
  jest.mocked(getTeamScopedRows).mockRejectedValue(new Error('permission-denied'));
  const teams = jest.spyOn(teamService, 'getTeams');
  await expect(teamSettlementService.getSupportSettlementDetailRows({ yearMonth: '2026-08', teamId: 'other' })).rejects.toThrow('permission-denied');
  expect(teams).not.toHaveBeenCalled();
});
