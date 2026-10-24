import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DelegatedSiteSettings from './DelegatedSiteSettings';
import { DelegatedClaim } from '../../features/delegated-receipts/model';
const base: DelegatedClaim = { id: 'a', siteId: 's1', month: '2026-10', siteName: '가상 현장', workerName: '작업자 가', grossAmount: 1000000, expectedAmount: 950000, receipts: [], paymentMethod: 'transfer', delegationType: 'delegate', sourceStatus: '', sourceLabel: '', memo: '', updatedAt: '2026-10-01T00:00:00Z' };
const directory = { teams: [], sites: [{ id: 's1', name: '가상 현장' }] };
const setup = (onSave = jest.fn().mockResolvedValue(undefined)) => {
  render(<DelegatedSiteSettings month="2026-10" claims={[base, { ...base, id: 'b', workerName: '계산서 항목', entryKind: 'invoice' }, { ...base, id: 'c', workerName: '미확정 작업자', grossAmount: null }]} directory={directory} settings={[]} initialKey='["id","s1"]' onSave={onSave} onBusy={jest.fn()} onClose={jest.fn()} />);
  return onSave;
};
it('기존 내역은 기본 미선택이며 금액 비교 후 선택한 한 건만 제출한다', async () => {
  const save = setup();
  fireEvent.change(screen.getByRole('textbox', { name: '현장 기본 세율' }), { target: { value: '3.3' } });
  expect(screen.getAllByRole('checkbox').every(box => !(box as HTMLInputElement).checked)).toBe(true);
  expect(screen.getByRole('checkbox', { name: '미확정 작업자 세율 재계산' })).toBeDisabled();
  expect(screen.getAllByText('→ 967,000원')).toHaveLength(2);
  fireEvent.click(screen.getByRole('checkbox', { name: '계산서 항목 세율 재계산' }));
  fireEvent.click(screen.getByRole('button', { name: '세율 저장 · 1건 재계산' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.calls[0][0]).toMatchObject({ taxRate: 3.3, selected: [{ id: 'b', updatedAt: base.updatedAt }] });
});
it('0%에서 기본 설정만 저장하고 미설정으로 바꾸면 재계산 선택이 해제된다', async () => {
  const save = setup();
  fireEvent.change(screen.getByRole('textbox', { name: '현장 기본 세율' }), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: '금액 있는 내역 선택' }));
  fireEvent.change(screen.getByRole('textbox', { name: '현장 기본 세율' }), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: '기본 세율 저장' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ taxRate: null, selected: [] })));
});
it('저장 응답 유실 때 수정과 중복 클릭을 막고 같은 요청으로 재확인한다', async () => {
  const save = setup(jest.fn().mockRejectedValueOnce(new Error('응답 확인 실패')).mockResolvedValue(undefined));
  fireEvent.change(screen.getByRole('textbox', { name: '현장 기본 세율' }), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: '기본 세율 저장' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('textbox', { name: '현장 기본 세율' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '다시 저장 확인' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0]);
});
