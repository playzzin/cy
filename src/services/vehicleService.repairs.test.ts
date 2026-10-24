import { vehicleService } from './vehicleService';
import { vehicleFirestoreService } from './vehicleFirestoreService';
import { vehicleRepairService } from '../features/vehicle-repairs/service';
import { emptyCosts, RepairRecord } from '../features/vehicle-repairs/model';
jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('./vehicleFirestoreService', () => ({ vehicleFirestoreService: { listVehicleExpenses: jest.fn(), listVehicles: jest.fn() } }));
jest.mock('../features/vehicle-repairs/service', () => ({ vehicleRepairService: { list: jest.fn() } }));
const row: RepairRecord = { id: 'r1', date: '2026-10-05', yearMonth: '2026-10', originalDate: '', vehicleId: '', vehiclePlate: '12가3456', description: '수리', driver: '', vendor: '', costs: { ...emptyCosts(), cheongyeon: 110000 }, memo: '', issues: [], archived: false, revision: 1 };
beforeEach(() => {
  jest.mocked(vehicleFirestoreService.listVehicleExpenses).mockResolvedValue([]);
  jest.mocked(vehicleFirestoreService.listVehicles).mockResolvedValue([{ id: 'v1', licensePlate: '12가3456' }] as any);
  jest.mocked(vehicleRepairService.list).mockResolvedValue([row]);
});
test('월별 경비 조회가 저장된 정비비를 즉시 읽고 삭제 후에는 제외한다', async () => {
  expect(await vehicleService.getExpensesByMonth('2026-10')).toEqual([expect.objectContaining({ vehicleId: 'v1', type: 'REPAIR', amount: 110000 })]);
  jest.mocked(vehicleRepairService.list).mockResolvedValue([{ ...row, archived: true }]);
  expect(await vehicleService.getExpensesByMonth('2026-10')).toEqual([]);
});
test('정비내역 읽기가 실패하면 불완전한 금액을 반환하지 않는다', async () => {
  jest.mocked(vehicleRepairService.list).mockRejectedValue(new Error('읽기 실패'));
  await expect(vehicleService.getExpensesByMonth('2026-10')).rejects.toThrow('읽기 실패');
});
