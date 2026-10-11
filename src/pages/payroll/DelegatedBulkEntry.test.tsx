import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DelegatedBulkEntry from './DelegatedBulkEntry';

const directory = { teams: [{ id: 't1', name: '검증 팀', color: '#112233' }], sites: [{ id: 's1', name: '검증 현장', responsibleTeamId: 't1' }, { id: 's2', name: '추가 현장' }], workers: [{ id: 'w1', name: '검증 가', color: '#223344' }, { id: 'w2', name: '검증 나', color: '#334455' }] };
const setup = (onSave = jest.fn().mockResolvedValue({ added: 2, skipped: 0 })) => {
  const onComplete = jest.fn();
  render(<DelegatedBulkEntry month="2026-10" directory={directory} existingClaims={[]} onSave={onSave} onComplete={onComplete} onBusy={jest.fn()} onClose={jest.fn()} />);
  fireEvent.change(screen.getByRole('combobox', { name: '추가할 현장' }), { target: { value: 's1' } });
  return { onSave, onComplete };
};
const addTwo = () => {
  fireEvent.click(screen.getByRole('button', { name: '검색 결과 전체 선택' }));
  fireEvent.click(screen.getByRole('button', { name: '선택한 2명 행 추가' }));
};

it('현장과 여러 작업자를 선택하고 금액·세율·계좌·입금여부·메모를 한 번에 저장한다', async () => {
  const { onSave, onComplete } = setup();
  fireEvent.change(screen.getByRole('textbox', { name: '새 행 세율' }), { target: { value: '3.3' } });
  addTwo();
  fireEvent.change(screen.getByRole('textbox', { name: '1행 세전 금액' }), { target: { value: '1,000,000' } });
  expect(screen.getByRole('textbox', { name: '1행 받을 예정 금액' })).toHaveValue('967,000');
  fireEvent.change(screen.getByRole('textbox', { name: '2행 받을 예정 금액' }), { target: { value: '750,000' } });
  expect(screen.getByRole('textbox', { name: '2행 세율' })).toHaveValue('');
  fireEvent.change(screen.getByRole('combobox', { name: '1행 받는 계좌' }), { target: { value: 'personal' } });
  fireEvent.change(screen.getByRole('combobox', { name: '2행 입금여부' }), { target: { value: 'complete' } });
  fireEvent.change(screen.getByRole('combobox', { name: '2행 현장' }), { target: { value: 's2' } });
  fireEvent.change(screen.getByRole('textbox', { name: '1행 메모' }), { target: { value: '검증 메모' } });
  fireEvent.click(screen.getByRole('button', { name: '2행 한 번에 등록' }));
  await waitFor(() => expect(onComplete).toHaveBeenCalledWith('2026-10', 2));
  const saved = onSave.mock.calls[0][0];
  expect(saved[0]).toMatchObject({ workerId: 'w1', siteId: 's1', expectedAmount: 967000, taxRate: 3.3, memo: '검증 메모', receipts: [], confirmation: { recipient: 'personal', status: 'unknown' } });
  expect(saved[1]).toMatchObject({ workerId: 'w2', siteId: 's2', expectedAmount: 750000, taxRate: null, receipts: [], confirmation: { status: 'complete' } });
});
it('저장 실패 시 입력과 식별자를 유지하고 재시도 중 중복 클릭을 막는다', async () => {
  let resolveSave: (value: { added: number; skipped: number }) => void = () => undefined;
  const onSave = jest.fn().mockRejectedValueOnce(new Error('lost response')).mockImplementationOnce(() => new Promise(resolve => { resolveSave = resolve; }));
  setup(onSave); addTwo();
  fireEvent.click(screen.getByRole('button', { name: '2행 한 번에 등록' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('저장 결과를 확인하지 못했습니다');
  expect(screen.getByRole('textbox', { name: '1행 세전 금액' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '다시 저장 확인' }));
  fireEvent.click(screen.getByRole('button', { name: '저장 중…' }));
  expect(onSave).toHaveBeenCalledTimes(2);
  expect(onSave.mock.calls[1][0]).toEqual(onSave.mock.calls[0][0]);
  resolveSave({ added: 0, skipped: 2 });
  await waitFor(() => expect(screen.queryByRole('button', { name: '저장 중…' })).not.toBeInTheDocument());
});
it('행 오류는 저장하지 않으며 삭제 후 다시 번호를 매긴다', async () => {
  const { onSave } = setup(); addTwo();
  fireEvent.change(screen.getByRole('textbox', { name: '2행 세전 금액' }), { target: { value: '-1' } });
  fireEvent.click(screen.getByRole('button', { name: '2행 한 번에 등록' }));
  expect(screen.getByRole('alert')).toHaveTextContent('2행: 금액');
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '1행 삭제' }));
  expect(screen.getByRole('textbox', { name: '1행 세전 금액' })).toHaveValue('-1');
  expect(within(screen.getByRole('table', { name: '일괄 등록표' })).getAllByRole('row')).toHaveLength(2);
});
it('선택한 현장에 이미 추가한 작업자는 중복 선택하지 않는다', () => {
  setup(); addTwo();
  fireEvent.click(screen.getByRole('button', { name: '다른 작업자·현장 추가' }));
  expect(screen.getByRole('checkbox', { name: '검증 가 추가됨' })).toBeDisabled();
  fireEvent.change(screen.getByRole('combobox', { name: '추가할 현장' }), { target: { value: 's2' } });
  expect(screen.getByRole('checkbox', { name: '검증 가' })).toBeEnabled();
});

it('엑셀 금액 붙여넣기와 Enter 이동은 등록을 실행하지 않는다', () => {
  const { onSave } = setup(); addTwo();
  const first = screen.getByRole('textbox', { name: '1행 세전 금액' });
  fireEvent.paste(first, { clipboardData: { getData: () => '1,000\t900\n2,000\t1,800' } });
  expect(screen.getByRole('textbox', { name: '2행 받을 예정 금액' })).toHaveValue('1,800');
  fireEvent.keyDown(first, { key: 'Enter' });
  expect(screen.getByRole('textbox', { name: '2행 세전 금액' })).toHaveFocus();
  expect(onSave).not.toHaveBeenCalled();
});
