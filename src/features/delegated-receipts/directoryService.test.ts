import { receiptDirectoryService } from './directoryService';
import { teamService } from '../../services/teamService';
import { siteService } from '../../services/siteService';
import { manpowerService } from '../../services/manpowerService';

jest.mock('../../services/teamService', () => ({ teamService: { getTeams: jest.fn() } }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: jest.fn() } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));

it('작업자 색상과 현장 담당 팀을 각각 불러오고 표시용 정보만 전달한다', async () => {
  (teamService.getTeams as jest.Mock).mockResolvedValue([{ id: 'team-a', name: '가상 팀', color: '#112233' }]);
  (siteService.getSites as jest.Mock).mockResolvedValue([{ id: 'site-a', name: '가상 현장', responsibleTeamId: 'team-a' }]);
  (manpowerService.getWorkers as jest.Mock).mockResolvedValue([{ id: 'worker-a', name: '가상 작업자', color: '#445566', teamId: 'team-b', memo: '표시에 필요 없는 가상 정보' }]);
  const directory = await receiptDirectoryService.load();
  expect(manpowerService.getWorkers).toHaveBeenCalledWith(true);
  expect(directory.workers).toEqual([{ id: 'worker-a', name: '가상 작업자', color: '#445566' }]);
  expect(directory.sites).toEqual([{ id: 'site-a', name: '가상 현장', responsibleTeamId: 'team-a' }]);
  expect(directory.teams[0].color).toBe('#112233');
});

it('작업자 조회 실패를 색상 없는 정상 조회로 숨기지 않는다', async () => {
  (teamService.getTeams as jest.Mock).mockResolvedValue([]);
  (siteService.getSites as jest.Mock).mockResolvedValue([]);
  (manpowerService.getWorkers as jest.Mock).mockRejectedValue(new Error('unavailable'));
  await expect(receiptDirectoryService.load()).rejects.toThrow('unavailable');
});
