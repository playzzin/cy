import { getTeamSettlementAccommodationBillings } from './teamSettlementAccommodationService';
import { accommodationBillingService } from './accommodationBillingService';
import { accommodationBillingTargetService } from './accommodationBillingTargetService';

jest.mock('./accommodationBillingService', () => ({ accommodationBillingService: { getBillingDocuments: jest.fn() } }));
jest.mock('./accommodationBillingTargetService', () => ({ accommodationBillingTargetService: { listTargets: jest.fn() } }));
jest.mock('./accommodationAssignmentService', () => ({ accommodationAssignmentService: { getAllAssignments: async () => [] } }));
jest.mock('./accommodationService', () => ({ accommodationService: { getAccommodations: async () => [{ id: 'room', name: '검증 101호' }] } }));
jest.mock('./teamService', () => ({ teamService: { getTeams: async () => [{ id: 'team', name: '검증팀' }] } }));
beforeEach(() => {
  jest.mocked(accommodationBillingService.getBillingDocuments).mockResolvedValue([{ id: 'bill', yearMonth: '2026-11', teamId: 'team', teamName: '검증팀',
    issuedToType: 'team', issuedToWorkerId: '', issuedToWorkerName: '', status: 'confirmed', lineItems: [
      { id: 'rent', label: '검증 101호 월세', amount: 100, targetField: 'accommodation', sourceAccommodationId: 'room' }
    ] }]);
  jest.mocked(accommodationBillingTargetService.listTargets).mockResolvedValue([{ id: 'target', accommodationId: 'room', targetType: 'worker', workerId: 'worker' }]);
});
test('정산용 조회만 개인 청구를 제외하며 원래 청구서를 변경하지 않는다', async () => {
  expect(await getTeamSettlementAccommodationBillings('2026-11')).toEqual([]);
  expect(accommodationBillingService.getBillingDocuments).toHaveBeenLastCalledWith({ teamId: 'all', yearMonth: '2026-11', strict: true });
  expect((await accommodationBillingService.getBillingDocuments({ teamId: 'all', yearMonth: '2026-11' }))[0].lineItems[0].amount).toBe(100);
});
test('청구대상 조회 실패를 팀 청구 또는 빈 공제로 처리하지 않는다', async () => {
  jest.mocked(accommodationBillingTargetService.listTargets).mockRejectedValueOnce(new Error('permission-denied'));
  await expect(getTeamSettlementAccommodationBillings('2026-11')).rejects.toThrow('permission-denied');
});
