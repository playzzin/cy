import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SupportLedgerMemo } from './SupportLedgerMemo';
import { supportLedgerMemoService } from '../../services/supportLedgerMemoService';
jest.mock('../../services/supportLedgerMemoService', () => ({ supportLedgerMemoService: { read: jest.fn(), save: jest.fn() } }));
const read = jest.mocked(supportLedgerMemoService.read);
const save = jest.mocked(supportLedgerMemoService.save);
beforeEach(() => { jest.resetAllMocks(); jest.useFakeTimers(); read.mockResolvedValue(null); save.mockResolvedValue(); });
afterEach(() => { jest.useRealTimers(); });
const settle = async () => { await act(async () => undefined); };
const advance = async () => { await act(async () => { jest.advanceTimersByTime(700); }); };
test('저장 버튼 없이 입력이 멈추면 마지막 비고만 자동 저장한다', async () => {
  render(<SupportLedgerMemo memoKey="vehicle:2026-10:v1" label="테스트 차량" initialMemo="조회기간 2026-10-01 ~ 2026-10-31" />);
  await settle();
  expect(screen.getByRole('textbox')).toHaveValue('');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '직접' } });
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '직접 입력한 비고' } });
  expect(save).not.toHaveBeenCalled();
  await advance();
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith('vehicle:2026-10:v1', '직접 입력한 비고', null);
  expect(screen.getByRole('status')).toHaveTextContent('자동 저장됨');
});
test('저장 실패 시 입력을 유지하고 다시 시도로 복구한다', async () => {
  save.mockRejectedValueOnce(new Error('저장 실패'));
  render(<SupportLedgerMemo memoKey="card:month:row" label="카드" />);
  await settle();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '보존할 비고' } });
  await advance();
  expect(screen.getByRole('alert')).toHaveTextContent('저장 실패');
  expect(screen.getByRole('textbox')).toHaveValue('보존할 비고');
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  await settle();
  expect(save).toHaveBeenNthCalledWith(2, 'card:month:row', '보존할 비고', null);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
test('조회 실패 후 기존 비고를 덮어쓸 수 없다', async () => {
  jest.mocked(supportLedgerMemoService.read).mockRejectedValue(new Error('network'));
  render(<SupportLedgerMemo memoKey="vehicle:2026-10:v1" label="테스트" />);
  await settle();
  expect(screen.getByRole('alert')).toHaveTextContent('비고를 불러오지 못했습니다.');
  expect(screen.getByRole('textbox')).toBeDisabled();
  expect(supportLedgerMemoService.save).not.toHaveBeenCalled();
});

test('다른 칸으로 이동하면 즉시 저장하고 지운 비고도 다시 나타나지 않는다', async () => {
  read.mockResolvedValueOnce('기존 비고').mockResolvedValueOnce('');
  const view = render(<SupportLedgerMemo memoKey="card:2026-10:c1" label="테스트 카드" initialMemo="과거 메모" />);
  await settle();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
  fireEvent.blur(screen.getByRole('textbox'));
  await settle();
  expect(save).toHaveBeenCalledWith('card:2026-10:c1', '', '기존 비고');
  view.unmount();
  render(<SupportLedgerMemo memoKey="card:2026-10:c1" label="테스트 카드" initialMemo="과거 메모" />);
  await settle();
  expect(screen.getByRole('textbox')).toHaveValue('');
});

test('저장 중에도 편집할 수 있고 후속 저장은 직전 저장값을 기준으로 한다', async () => {
  let finish!: () => void;
  save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<SupportLedgerMemo memoKey="card:month:row" label="카드" />);
  await settle();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '첫 내용' } });
  await advance();
  expect(screen.getByRole('textbox')).toBeEnabled();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '최종 내용' } });
  await advance();
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(save).toHaveBeenNthCalledWith(2, 'card:month:row', '최종 내용', '첫 내용');
  expect(screen.getByRole('textbox')).toHaveValue('최종 내용');
});

test('월 변경 시 미저장 비고는 원래 월에 저장하고 늦은 완료가 새 월 입력을 덮지 않는다', async () => {
  let finish!: () => void;
  save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  read.mockResolvedValueOnce(null).mockResolvedValueOnce('11월 비고');
  const view = render(<SupportLedgerMemo memoKey="vehicle:2026-10:v1" label="차량" />);
  await settle();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '10월 비고' } });
  view.rerender(<SupportLedgerMemo memoKey="vehicle:2026-11:v1" label="차량" />);
  await settle();
  expect(save).toHaveBeenCalledWith('vehicle:2026-10:v1', '10월 비고', null);
  expect(screen.getByRole('textbox')).toHaveValue('11월 비고');
  await act(async () => finish());
  expect(screen.getByRole('textbox')).toHaveValue('11월 비고');
  expect(save).toHaveBeenCalledTimes(1);
});

test('금액 재조회로 초기 문구가 달라져도 작성 중인 비고를 보존한다', async () => {
  const view = render(<SupportLedgerMemo memoKey="card:month:row" label="카드" initialMemo="기존 문구" />);
  await settle();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '작성 중' } });
  view.rerender(<SupportLedgerMemo memoKey="card:month:row" label="카드" initialMemo="새 문구" />);
  await settle();
  expect(read).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('textbox')).toHaveValue('작성 중');
  await advance();
  expect(save).toHaveBeenCalledWith('card:month:row', '작성 중', null);
});

test('자동 저장이 끝나기 전 창을 닫으면 미저장 변경을 보호한다', async () => {
  render(<SupportLedgerMemo memoKey="card:month:row" label="카드" />);
  await settle();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '입력 중' } });
  const pending = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(pending);
  expect(pending.defaultPrevented).toBe(true);
  await advance();
  const saved = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(saved);
  expect(saved.defaultPrevented).toBe(false);
});
