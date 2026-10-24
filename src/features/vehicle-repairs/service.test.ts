import { runTransaction, getDocs, doc } from 'firebase/firestore';
import { vehicleRepairService } from './service';
import { emptyCosts, RepairRecord } from './model';

jest.mock('../../config/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'test-user' } } }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), doc: jest.fn((_db, _collection, id) => id), getDocs: jest.fn(), query: jest.fn(), where: jest.fn(), runTransaction: jest.fn(), serverTimestamp: () => 'server-time' }));
const record = (id = 'repair-1'): RepairRecord => ({ id, date: '2026-01-01', yearMonth: '2026-01', originalDate: '', vehiclePlate: '12가3456', vehicleId: '', description: '수리', driver: '', vendor: '업체', costs: { ...emptyCosts(), personal: 100 }, memo: '', issues: [], archived: false, revision: 1, source: { fileName: 'a.xlsx', sheet: '2026년', cell: 'A2', signature: 'original', costHeaders: ['개인'] } });
const transaction = { get: jest.fn(), set: jest.fn(), update: jest.fn() };
beforeEach(() => {
  jest.clearAllMocks();
  (doc as jest.Mock).mockImplementation((_db, _collection, id) => id);
  (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => callback(transaction));
});

test('동시 수정 충돌을 감지하고 기존 기록을 덮어쓰지 않는다', async () => {
  transaction.get.mockResolvedValue({ exists: () => true, data: () => ({ data: { ...record(), revision: 2 } }) });
  await expect(vehicleRepairService.save(record())).rejects.toThrow('다른 사용자가 수정');
  expect(transaction.set).not.toHaveBeenCalled();
});

test('중복 및 원본 변경은 보존하고 새로운 행만 생성한다', async () => {
  transaction.get.mockImplementation(async id => ({ exists: () => id !== 'new', data: () => ({ data: { ...record(id), source: { signature: id === 'duplicate' ? 'original' : 'changed' } } }) }));
  const result = await vehicleRepairService.importRecords([record('new'), record('duplicate'), record('conflict')]);
  expect(result).toEqual({ added: 1, skipped: 1, conflicts: 1 });
  expect(transaction.set).toHaveBeenCalledTimes(1);
  expect(transaction.set.mock.calls[0][1].data.id).toBe('new');
});

test('수정 시 날짜 오류를 차단하지만 가져올 때 원본 오류를 보존한다', async () => {
  const invalid = { ...record(), date: '', issues: ['날짜 확인 필요'] };
  await expect(vehicleRepairService.save(invalid)).rejects.toThrow('날짜 확인 필요');
  transaction.get.mockResolvedValue({ exists: () => false });
  await vehicleRepairService.importRecords([invalid]);
  expect(transaction.set.mock.calls[0][1].data.issues).toEqual(['날짜 확인 필요']);
});

test('가져오기가 일부 완료된 뒤 실패해도 재시도로 안전하게 완료한다', async () => {
  const stored = new Map<string, unknown>();
  transaction.get.mockImplementation(async id => ({ exists: () => stored.has(id), data: () => stored.get(id) }));
  transaction.set.mockImplementation((id, data) => stored.set(id, data));
  (runTransaction as jest.Mock).mockImplementationOnce(async (_db, callback) => callback(transaction)).mockRejectedValueOnce(new Error('network')).mockImplementation(async (_db, callback) => callback(transaction));
  const rows = Array.from({ length: 105 }, (_, i) => record(`row-${i}`));
  await expect(vehicleRepairService.importRecords(rows)).rejects.toThrow('network');
  expect(stored.size).toBe(100);
  expect(await vehicleRepairService.importRecords(rows)).toEqual({ added: 5, skipped: 100, conflicts: 0 });
  expect(stored.size).toBe(105);
});

test('읽기 실패를 빈 목록으로 숨기지 않는다', async () => {
  (getDocs as jest.Mock).mockRejectedValue(new Error('permission-denied'));
  await expect(vehicleRepairService.list()).rejects.toThrow('permission-denied');
});

test('여러 행 저장은 모든 충돌 검사를 통과한 뒤 한 트랜잭션에서 처리한다', async () => {
  const events: string[] = [];
  transaction.get.mockImplementation(async id => { events.push(`read:${id}`); return { exists: () => id !== 'new', data: () => ({ data: record(id) }) }; });
  transaction.set.mockImplementation(id => events.push(`write:${id}`));
  await vehicleRepairService.saveRows([record('old'), { ...record('new'), revision: 0, costs: { ...emptyCosts(), personal: 0, cheongyeon: 100.7 } }]);
  expect(runTransaction).toHaveBeenCalledTimes(1);
  expect(events).toEqual(['read:old', 'read:new', 'write:old', 'write:new']);
  expect(transaction.set.mock.calls[1][1].data).toMatchObject({ revision: 1, costs: { ...emptyCosts(), personal: 0, cheongyeon: 100.7 } });
});

test('여러 행 중 마지막 행의 충돌도 전체 저장을 차단한다', async () => {
  transaction.get.mockImplementation(async id => ({ exists: () => true, data: () => ({ data: { ...record(id), revision: id === 'conflict' ? 2 : 1 } }) }));
  await expect(vehicleRepairService.saveRows([record('valid'), record('conflict')])).rejects.toThrow('다른 사용자가 수정');
  expect(transaction.set).not.toHaveBeenCalled();
});

test('잘못된 행과 중복 ID는 서버 저장 전에 차단한다', async () => {
  await expect(vehicleRepairService.saveRows([record(), { ...record('invalid'), date: '2026-02-29' }])).rejects.toThrow('날짜 확인 필요');
  await expect(vehicleRepairService.saveRows([record(), record()])).rejects.toThrow('중복된');
  expect(runTransaction).not.toHaveBeenCalled();
});

test('운전자 수정으로 비용 메모의 확인 필요 표시가 사라지지 않는다', async () => {
  const note = '개인 비용란 메모 확인';
  const current = { ...record(), issues: [note] };
  transaction.get.mockResolvedValue({ exists: () => true, data: () => ({ data: current }) });
  await vehicleRepairService.save({ ...current, driver: '수정된 운전자' });
  expect(transaction.set.mock.calls[0][1].data.issues).toContain(note);
});

test('저장 경계에서 소수 셋째 자리 금액을 거부한다', async () => {
  transaction.get.mockResolvedValue({ exists: () => true, data: () => ({ data: record() }) });
  await expect(vehicleRepairService.save({ ...record(), costs: { ...emptyCosts(), personal: 10.001 } })).rejects.toThrow('금액');
  expect(transaction.set).not.toHaveBeenCalled();
});

test('잘못된 저장 데이터 형식은 화면 계산 오류 대신 조회 오류로 알린다', async () => {
  (getDocs as jest.Mock).mockResolvedValue({ docs: [{ id: 'bad-data', data: () => ({ data: { ...record(), costs: { ...emptyCosts(), personal: '100원' } } }) }] });
  await expect(vehicleRepairService.list()).rejects.toThrow('데이터 형식');
});
