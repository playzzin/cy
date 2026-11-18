import { getDocs, writeBatch } from 'firebase/firestore';
import { dailyAdvanceStatementRecruiterFeeService as service } from './dailyAdvanceStatementRecruiterFeeService';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'fees'), doc: jest.fn((_db, _collection, id) => id), query: jest.fn(), where: jest.fn(),
  getDocs: jest.fn(), onSnapshot: jest.fn(), writeBatch: jest.fn(), Timestamp: { now: () => 'timestamp' }
}));
const fee = { month: '2026-02', teamKey: 'team', workerId: 'worker', amount: 120000 };
let set: jest.Mock;
let commit: jest.Mock;
beforeEach(() => {
  set = jest.fn(); commit = jest.fn().mockResolvedValue(undefined);
  jest.mocked(writeBatch).mockReturnValue({ set, commit } as any);
});
test('유효한 해당 월 청구일만 중복 없이 저장하고 다시 조회한다', async () => {
  await service.saveFees([{ ...fee, chargeDates: ['2026-02-03', '2026-02-01', '2026-02-03', '2026-02-29', '2026-03-01', 'invalid'] }]);
  const stored = set.mock.calls[0][1];
  expect(stored).toMatchObject({ ...fee, chargeDates: ['2026-02-01', '2026-02-03'] });
  expect(commit).toHaveBeenCalledTimes(1);
  jest.mocked(getDocs).mockResolvedValue({ docs: [{ data: () => stored }] } as any);
  expect(await service.getFeesByMonth('2026-02')).toEqual([expect.objectContaining({ ...fee, chargeDates: ['2026-02-01', '2026-02-03'] })]);
});
test('날짜를 선택 지우기하면 빈 배열을 저장하고 기존 금액만 저장하는 호출은 날짜를 덮어쓰지 않는다', async () => {
  await service.saveFees([{ ...fee, chargeDates: [] }]);
  expect(set.mock.calls[0][1].chargeDates).toEqual([]);
  await service.saveFees([fee]);
  expect(set.mock.calls[1][1]).not.toHaveProperty('chargeDates');
  expect(set.mock.calls[1][2]).toEqual({ merge: true });
});
test('이전 청구서에 날짜가 없으면 근무일로 보충하지 않는다', async () => {
  jest.mocked(getDocs).mockResolvedValue({ docs: [{ data: () => fee }] } as any);
  expect((await service.getFeesByMonth('2026-02'))[0].chargeDates).toEqual([]);
});
