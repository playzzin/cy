import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DelegatedBulkEntry from './DelegatedBulkEntry';
import type { ReceiptDirectory } from '../../features/delegated-receipts/teamDirectory';

const directory = { teams: [{ id: 't1', name: '검증 팀', color: '#112233' }], sites: [{ id: 's1', name: '검증 현장', responsibleTeamId: 't1' }, { id: 's2', name: '추가 현장' }], workers: [{ id: 'w1', name: '검증 가', color: '#223344' }, { id: 'w2', name: '검증 나', color: '#334455' }] };
const setup = (onSave = jest.fn().mockResolvedValue({ added: 2, skipped: 0 }), sourceDirectory: ReceiptDirectory = directory) => {
  const onComplete = jest.fn();
  render(<DelegatedBulkEntry month="2026-10" directory={sourceDirectory} existingClaims={[]} onSave={onSave} onComplete={onComplete} onBusy={jest.fn()} onClose={jest.fn()} />);
  fireEvent.change(screen.getByRole('combobox', { name: '추가할 현장' }), { target: { value: 's1' } });
  return { onSave, onComplete };
};
const addTwo = () => {
  fireEvent.click(screen.getByRole('button', { name: '검색 결과 전체 선택' }));
  fireEvent.click(screen.getByRole('button', { name: '선택한 2명 행 추가' }));
};

it('행 추가 클릭이 같은 위치에 나타난 등록 버튼의 제출로 이어지지 않는다', () => {
  const { onSave } = setup();
  fireEvent.click(screen.getByRole('button', { name: '검색 결과 전체 선택' }));
  const defaultAllowed = fireEvent.click(screen.getByRole('button', { name: '선택한 2명 행 추가' }));
  expect(defaultAllowed).toBe(false);
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', { name: '1행 세전 금액' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '2행 한 번에 등록' })).toBeEnabled();
});

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

const grouped: ReceiptDirectory = {
  teams: [{ id: 't1', name: '골조팀', leaderName: '가상 팀장 가' }, { id: 't2', name: '설비팀', leaderName: '가상 팀장 나' }],
  sites: [{ id: 's1', name: '선택 현장', responsibleTeamId: 't1' }, { id: 's2', name: '다른 현장', responsibleTeamId: 't2' }],
  workers: [{ id: 'w1', name: '작업자 가', teamId: 't1' }, { id: 'w2', name: '작업자 나', teamId: 't2' }, { id: 'w3', name: '작업자 다', teamName: '골조팀' }, { id: 'w4', name: '작업자 라' }],
};
it('소속 팀으로 검색하고 필터를 바꿔도 선택 명단을 유지하며 해당 작업자를 함께 등록한다', async () => {
  const { onSave } = setup(jest.fn().mockResolvedValue({ added: 3, skipped: 0 }), grouped);
  fireEvent.change(screen.getByRole('combobox', { name: '작업자 소속 팀' }), { target: { value: 't1' } });
  expect(within(screen.getByRole('group', { name: '작업자 검색 결과' })).getAllByRole('checkbox')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: '검색 결과 전체 선택' }));
  fireEvent.change(screen.getByRole('combobox', { name: '작업자 소속 팀' }), { target: { value: 't2' } });
  expect(screen.getByRole('region', { name: '선택한 작업자' })).toHaveTextContent('다른 검색에서 선택한 2명 포함');
  fireEvent.click(screen.getByRole('checkbox', { name: '작업자 나' }));
  fireEvent.click(screen.getByRole('button', { name: '선택한 3명 행 추가' }));
  fireEvent.click(screen.getByRole('button', { name: '3행 한 번에 등록' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0][0].map((row: { workerId: string }) => row.workerId)).toEqual(['w1', 'w3', 'w2']);
});
it('팀명·팀장명 검색, 미지정 팀, 현장 담당 팀 바로가기를 지원한다', () => {
  setup(undefined, grouped);
  fireEvent.change(screen.getByRole('textbox', { name: '등록할 작업자 검색' }), { target: { value: '설비 팀' } });
  expect(screen.getByRole('checkbox', { name: '작업자 나' })).toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: '작업자 가' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: '등록할 작업자 검색' }), { target: { value: '팀장 가' } });
  expect(within(screen.getByRole('group', { name: '작업자 검색 결과' })).getAllByRole('checkbox')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: '현장 담당 팀 작업자 보기' }));
  expect(screen.getByRole('combobox', { name: '작업자 소속 팀' })).toHaveValue('t1');
  expect(screen.getByRole('textbox', { name: '등록할 작업자 검색' })).toHaveValue('');
  fireEvent.change(screen.getByRole('combobox', { name: '작업자 소속 팀' }), { target: { value: 'unassigned' } });
  expect(screen.getByRole('checkbox', { name: '작업자 라' })).toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: '작업자 검색 결과' })).getAllByRole('checkbox')).toHaveLength(1);
});
it('현장 이름·담당 팀으로 찾되 현재 선택한 현장은 잃지 않는다', () => {
  setup(undefined, grouped);
  fireEvent.change(screen.getByRole('textbox', { name: '등록할 현장 검색' }), { target: { value: '설비팀' } });
  const sites = screen.getByRole('combobox', { name: '추가할 현장' });
  expect(sites).toHaveValue('s1');
  expect(within(sites).getByRole('option', { name: '선택 현장 · 선택됨' })).toBeInTheDocument();
  expect(within(sites).getByRole('option', { name: '다른 현장' })).toBeInTheDocument();
  fireEvent.change(sites, { target: { value: 's2' } });
  expect(screen.getByRole('button', { name: '현장 담당 팀 작업자 보기' })).toBeInTheDocument();
});
it('선택 취소와 현장 변경은 명단을 정리하고 입력표에 빠진 선택은 저장 전에 알린다', () => {
  const { onSave } = setup(undefined, grouped);
  fireEvent.click(screen.getByRole('checkbox', { name: '작업자 가' }));
  fireEvent.click(screen.getByRole('button', { name: '작업자 가 선택 취소' }));
  expect(screen.getByRole('checkbox', { name: '작업자 가' })).not.toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: '작업자 가' }));
  fireEvent.click(screen.getByRole('button', { name: '선택한 1명 행 추가' }));
  fireEvent.click(screen.getByRole('button', { name: '다른 작업자·현장 추가' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '작업자 나' }));
  fireEvent.click(screen.getByRole('button', { name: '입력표 보기' }));
  fireEvent.click(screen.getByRole('button', { name: '1행 한 번에 등록' }));
  expect(screen.getByRole('alert')).toHaveTextContent('선택한 작업자가 아직 입력표에 없습니다');
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('combobox', { name: '추가할 현장' }), { target: { value: 's2' } });
  expect(screen.getByRole('button', { name: '선택한 0명 행 추가' })).toBeDisabled();
});
it('100명을 넘게 선택할 때 일부 인원을 조용히 빼지 않고 선택 범위를 안내한다', () => {
  setup(undefined, { ...grouped, workers: Array.from({ length: 101 }, (_, index) => ({ id: `w${index}`, name: `검증 ${String(index).padStart(3, '0')}`, teamId: 't1' })) });
  fireEvent.click(screen.getByRole('button', { name: '검색 결과 전체 선택' }));
  expect(screen.getByRole('alert')).toHaveTextContent('현재 100명까지 더 추가');
  expect(screen.getByRole('button', { name: '선택한 0명 행 추가' })).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: '등록할 작업자 검색' }), { target: { value: '검증 100' } });
  fireEvent.click(screen.getByRole('button', { name: '검색 결과 전체 선택' }));
  expect(screen.getByRole('button', { name: '선택한 1명 행 추가' })).toBeEnabled();
});
