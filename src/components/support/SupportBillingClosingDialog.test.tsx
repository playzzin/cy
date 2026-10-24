import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SupportBillingClosingDialog from './SupportBillingClosingDialog';
import { supportBillingClosingService as service } from '../../services/supportBillingClosingService';
import type { SupportBillingClosingPreview } from '../../services/supportBillingClosingService';

jest.mock('../../services/supportBillingClosingService', () => ({
  supportBillingClosingService: { list: jest.fn(), preview: jest.fn(), apply: jest.fn() },
}));
const mocked = service as jest.Mocked<typeof service>;
const preview: SupportBillingClosingPreview = {
  domain: 'card', id: 'billing-1', yearMonth: '2026-09', title: '업무 카드', teamName: 'A팀',
  targetName: 'A팀', status: 'CONFIRMED', totalAmount: 12000, version: 'v1', actorUid: 'operator',
  action: 'reopen', blockedReason: null, impact: '금액은 유지하고 수정 가능한 상태로 되돌립니다.',
  lineItems: [{ label: '교통비', amount: 12000 }],
};
const renderDialog = (onClose = jest.fn()) => render(<SupportBillingClosingDialog domain="card" yearMonth="2026-09" onClose={onClose} />);
const select = async () => fireEvent.click(await screen.findByRole('button', { name: /업무 카드/ }));

beforeEach(() => {
  jest.clearAllMocks();
  mocked.list.mockResolvedValue([preview]);
  mocked.preview.mockResolvedValue(preview);
  mocked.apply.mockResolvedValue();
});

it('loads a read-only list and requires preview plus a cancellation reason', async () => {
  renderDialog();
  await screen.findByRole('button', { name: /업무 카드/ });
  expect(mocked.apply).not.toHaveBeenCalled();
  expect(mocked.preview).not.toHaveBeenCalled();
  await select();
  const submit = await screen.findByRole('button', { name: '사유를 기록하고 확정 취소' });
  expect(submit).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: /확정 취소 사유/ }), { target: { value: '   ' } });
  expect(submit).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: /확정 취소 사유/ }), { target: { value: '청구 대상 확인' } });
  fireEvent.click(submit);
  await waitFor(() => expect(mocked.apply).toHaveBeenCalledWith(preview, '청구 대상 확인'));
  expect(await screen.findByText(/확정을 취소하고 처리 이력을 저장/)).toBeInTheDocument();
});

it('shows a blocking reason without offering a mutation button', async () => {
  mocked.preview.mockResolvedValue({ ...preview, blockedReason: '팀정산이 확정되어 있습니다.' });
  renderDialog(); await select();
  expect(await screen.findByRole('alert')).toHaveTextContent('팀정산');
  expect(screen.queryByRole('button', { name: '사유를 기록하고 확정 취소' })).not.toBeInTheDocument();
  expect(mocked.apply).not.toHaveBeenCalled();
});

it('blocks actions if the underlying ledger begins processing while review is open', async () => {
  render(<SupportBillingClosingDialog domain="card" yearMonth="2026-09" onClose={jest.fn()} externalBlockedReason="대장 저장 중" />);
  await select();
  expect(await screen.findByRole('alert')).toHaveTextContent('대장 저장 중');
  expect(screen.queryByRole('button', { name: '사유를 기록하고 확정 취소' })).not.toBeInTheDocument();
  expect(mocked.apply).not.toHaveBeenCalled();
});

it('prevents duplicate submissions and closing while the save is in flight', async () => {
  let resolveSave!: () => void;
  mocked.apply.mockImplementation(() => new Promise(resolve => { resolveSave = resolve; }));
  const onClose = jest.fn();
  renderDialog(onClose); await select();
  fireEvent.change(await screen.findByRole('textbox', { name: /확정 취소 사유/ }), { target: { value: '수정 확인' } });
  const button = screen.getByRole('button', { name: '사유를 기록하고 확정 취소' });
  fireEvent.click(button); fireEvent.click(button);
  expect(mocked.apply).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: '청구 마감 닫기' })).toBeDisabled();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => resolveSave());
});

it('requires a fresh preview after a rejected transition', async () => {
  mocked.apply.mockRejectedValue(new Error('확인 후 자료가 변경되었습니다.'));
  renderDialog(); await select();
  fireEvent.change(await screen.findByRole('textbox', { name: /확정 취소 사유/ }), { target: { value: '수정 확인' } });
  fireEvent.click(screen.getByRole('button', { name: '사유를 기록하고 확정 취소' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('자료가 변경');
  expect(screen.queryByRole('button', { name: '사유를 기록하고 확정 취소' })).not.toBeInTheDocument();
});

it('does not present a failed list read as an empty successful month', async () => {
  mocked.list.mockRejectedValue({ code: 'permission-denied' });
  renderDialog();
  expect(await screen.findByRole('alert')).toHaveTextContent('권한');
  expect(screen.queryByText('해당 조건의 저장된 청구서가 없습니다.')).not.toBeInTheDocument();
  expect(mocked.apply).not.toHaveBeenCalled();
});

it('ignores an older preview that arrives after a newer selection', async () => {
  let resolveOld!: (value: SupportBillingClosingPreview) => void;
  mocked.list.mockResolvedValue([preview, { ...preview, id: 'billing-2', title: '두 번째 카드' }]);
  mocked.preview.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  mocked.preview.mockResolvedValueOnce({ ...preview, id: 'billing-2', title: '두 번째 카드', blockedReason: '급여가 확정되었습니다.' });
  renderDialog(); await select();
  fireEvent.click(screen.getByRole('button', { name: /두 번째 카드/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('급여');
  await act(async () => resolveOld(preview));
  expect(screen.getByRole('alert')).toHaveTextContent('급여');
  expect(screen.queryByRole('button', { name: '사유를 기록하고 확정 취소' })).not.toBeInTheDocument();
});
