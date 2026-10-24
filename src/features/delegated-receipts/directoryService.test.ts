import { receiptDirectoryService } from './directoryService';
import { teamService } from '../../services/teamService';
import { companyService } from '../../services/companyService';
import { siteService } from '../../services/siteService';
import { manpowerService } from '../../services/manpowerService';

jest.mock('../../services/teamService', () => ({ teamService: { getTeams: jest.fn() } }));
jest.mock('../../services/companyService', () => ({ companyService: { getCompanies: jest.fn() } }));
jest.mock('../../services/siteService', () => ({ siteService: { getSites: jest.fn() } }));
jest.mock('../../services/manpowerService', () => ({ manpowerService: { getWorkers: jest.fn() } }));

it('현재·이전 회사 ID와 법인명을 확인하고 외부·미지정 팀을 제외 표시한다', async () => {
  (companyService.getCompanies as jest.Mock).mockResolvedValue([
    { id: 'cy', legacyId: 'old-cy', name: '(주) 청연이엔지' },
    { id: 'external', name: '다른 회사' },
  ]);
  (teamService.getTeams as jest.Mock).mockResolvedValue([
    { id: 't1', name: '팀 1', companyId: 'cy', color: '#112233' },
    { id: 't2', name: '팀 2', companyId: 'old-cy' },
    { id: 't3', name: '팀 3', companyName: '주식회사 청연이엔지' },
    { id: 't4', name: '팀 4', companyId: 'external', companyName: '청연이엔지' },
    { id: 't5', name: '팀 5' },
  ]);
  (siteService.getSites as jest.Mock).mockResolvedValue([{ id: 's1', name: '현장', responsibleTeamId: 't4' }]);
  (manpowerService.getWorkers as jest.Mock).mockResolvedValue([{ id: 'w1', name: '작업자', teamId: 't1' }]);
  const directory = await receiptDirectoryService.load();
  expect(directory.teams.filter(team => team.isCheongyeon).map(team => team.id)).toEqual(['t1', 't2', 't3']);
  expect(directory.teams).toHaveLength(5); // Existing records still need all team identities.
  expect(directory.teams[0].color).toBe('#112233');
  expect(directory.sites[0].responsibleTeamId).toBe('t4');
  expect(directory.workers?.[0].teamId).toBe('t1');
});
