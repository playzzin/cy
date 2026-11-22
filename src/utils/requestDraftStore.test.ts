import { clearRequestDrafts, deleteRequestDraft, readRequestDraft, saveRequestDraft, setRequestDraftOwner } from './requestDraftStore';

afterEach(() => setRequestDraftOwner(null));

it('같은 계정의 첨부 File을 포함한 초안을 메모리에서 복원한다', () => {
  const storage = jest.spyOn(Storage.prototype, 'setItem');
  const draft = { text: '검증 초안', file: new File(['test'], 'test.png', { type: 'image/png' }) };
  const dispose = jest.fn();
  setRequestDraftOwner('first');
  saveRequestDraft('first', 'worker', draft, dispose);
  expect(readRequestDraft('first', 'worker')).toBe(draft);
  expect(storage).not.toHaveBeenCalled();
  expect(dispose).not.toHaveBeenCalled();
  deleteRequestDraft('first', 'worker');
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(readRequestDraft('first', 'worker')).toBeUndefined();
  storage.mockRestore();
});

it('계정 전환 및 로그아웃에서 초안과 첨부를 정리하고 늦은 이전 계정의 저장을 무시한다', () => {
  const dispose = jest.fn();
  setRequestDraftOwner('first');
  saveRequestDraft('first', 'expense', { text: '검증 초안' }, dispose);
  setRequestDraftOwner('second');
  expect(dispose).toHaveBeenCalledTimes(1);
  saveRequestDraft('first', 'expense', { text: '늦은 응답' }, dispose);
  expect(readRequestDraft('second', 'expense')).toBeUndefined();
  saveRequestDraft('second', 'expense', { text: '다음 계정' }, dispose);
  setRequestDraftOwner(null);
  expect(dispose).toHaveBeenCalledTimes(2);
  clearRequestDrafts();
  expect(readRequestDraft('second', 'expense')).toBeUndefined();
});
