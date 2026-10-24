import { createRequestScope } from './requestScope';

afterEach(() => jest.useRealTimers());

test('취소 신호를 무시하는 작업도 시간 제한 후 끝내며 다음 단계는 시작하지 않는다', async () => {
  jest.useFakeTimers();
  const scope = createRequestScope(1000);
  const pending = scope.run(() => new Promise<void>(() => {}));
  const rejected = pending.catch(error => error);
  jest.advanceTimersByTime(1000); expect(await rejected).toMatchObject({ name: 'TimeoutError' });
  const later = jest.fn(async () => 1);
  await expect(scope.run(later)).rejects.toMatchObject({ name: 'TimeoutError' });
  expect(later).not.toHaveBeenCalled(); scope.dispose();
});

test('즉시 중단하면 준비 작업을 시작하지 않고 늦은 실패도 관찰한다', async () => {
  const scope = createRequestScope(); const work = jest.fn(async () => 1);
  const pending = scope.run(work); scope.controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(work).not.toHaveBeenCalled(); scope.dispose();
  const second = createRequestScope(); let fail!: (e: Error) => void;
  const running = second.run(() => new Promise((_, reject) => { fail = reject; }));
  await Promise.resolve(); second.controller.abort();
  await expect(running).rejects.toMatchObject({ name: 'AbortError' });
  fail(new Error('late failure')); await Promise.resolve(); second.dispose();
});

test('완료 시 타이머를 해제하고 원래 오류를 유지한다', async () => {
  jest.useFakeTimers(); const scope = createRequestScope();
  await expect(scope.run(async () => 42)).resolves.toBe(42);
  await expect(scope.run(async () => { throw new Error('연결 실패'); })).rejects.toThrow('연결 실패');
  scope.dispose(); expect(jest.getTimerCount()).toBe(0);
});
