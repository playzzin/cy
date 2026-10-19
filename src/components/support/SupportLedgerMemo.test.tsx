import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SupportLedgerMemo } from './SupportLedgerMemo';
import { supportLedgerMemoService } from '../../services/supportLedgerMemoService';
jest.mock('../../services/supportLedgerMemoService', () => ({ supportLedgerMemoService: { read: jest.fn(), save: jest.fn() } }));
beforeEach(() => { jest.resetAllMocks(); jest.mocked(supportLedgerMemoService.read).mockResolvedValue(null); jest.mocked(supportLedgerMemoService.save).mockResolvedValue(); });
test('자동 문구 없이 입력하고 금액과 별개로 비고를 저장한다', async () => {
  render(<SupportLedgerMemo memoKey="vehicle:2026-10:v1" label="테스트 차량" initialMemo="조회기간 2026-10-01 ~ 2026-10-31" />);
  await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
  expect(screen.getByRole('textbox')).toHaveValue('');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '직접 입력한 비고' } });
  fireEvent.click(screen.getByRole('button', { name: '비고 저장' }));
  await screen.findByText('저장됨');
  expect(supportLedgerMemoService.save).toHaveBeenCalledWith('vehicle:2026-10:v1', '직접 입력한 비고', null);
});
test('비고를 지운 값도 유지하고 실패하면 입력을 보존한다', async () => {
  jest.mocked(supportLedgerMemoService.read).mockResolvedValue('');
  jest.mocked(supportLedgerMemoService.save).mockRejectedValue(new Error('저장 실패'));
  render(<SupportLedgerMemo memoKey="card:2026-10:c1" label="테스트 카드" initialMemo="과거 메모" />);
  await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
  expect(screen.getByRole('textbox')).toHaveValue('');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '보존할 비고' } });
  fireEvent.click(screen.getByRole('button', { name: '비고 저장' }));
  await screen.findByText('저장 실패');
  expect(screen.getByRole('textbox')).toHaveValue('보존할 비고');
});
test('조회 실패 후 기존 비고를 덮어쓸 수 없다', async () => {
  jest.mocked(supportLedgerMemoService.read).mockRejectedValue(new Error('network'));
  render(<SupportLedgerMemo memoKey="vehicle:2026-10:v1" label="테스트" />);
  await screen.findByText('비고를 불러오지 못했습니다. 화면을 다시 열어 주세요.');
  expect(screen.getByRole('textbox')).toBeDisabled();
  expect(supportLedgerMemoService.save).not.toHaveBeenCalled();
});
