import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DelegatedBulkEntry from './DelegatedBulkEntry';
import type { ReceiptDirectory } from '../../features/delegated-receipts/teamDirectory';

const directory = { teams: [{ id: 't1', name: '검증 팀', color: '#112233', isCheongyeon: true }], sites: [{ id: 's1', name: '검증 현장', responsibleTeamId: 't1' }, { id: 's2', name: '추가 현장' }], workers: [{ id: 'w1', name: '검증 가', color: '#223344', teamId: 't1' }, { id: 'w2', name: '검증 나', color: '#334455', teamId: 't1' }] };
const setup = (onSave = jest.fn().mockResolvedValue({ added: 2, skipped: 0 }), sourceDirectory: ReceiptDirectory = directory) => {
  const onComplete = jest.fn();
  render(<DelegatedBulkEntry month="2026-10" directory={sourceDirectory} existingClaims={[]} onSave={onSave} onComplete={onComplete} onBusy={jest.fn()} onClose={jest.fn()} />);
  fireEvent.change(screen.getByRole('combobox', { name: '추가할 현장' }), { target: { value: 's1' } });
  return { onSave, onComplete };
};
const addTwo = () => {
  fireEvent.click(screen.getByRole('button', { name: '검색 결과 전체 추가' }));
  fireEvent.click(screen.getByRole('button', { name: '입력표 보기' }));
};
const chooseTeam = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: '작업자 소속 팀' }));
  fireEvent.click(screen.getByRole('option', { name }));
};

it('현장 기본 세율을 작업자 없는 계산서에 적용하고 각 행의 직접 금액을 저장한다', async () => {
  const onSave = jest.fn().mockResolvedValue({ added: 1, skipped: 0 });
  render(<DelegatedBulkEntry month="2026-10" directory={{ ...directory, workers: [] }} existingClaims={[]} siteTaxes={[{ key: '["id","s1"]', name: '검증 현장', taxRate: 3.3, revision: 1, operationId: 'prior', updatedAt: '' }]} onSave={onSave} onComplete={jest.fn()} onBusy={jest.fn()} onClose={jest.fn()} />);
  expect(screen.getByRole('button', { name: '계산서 직접 입력' })).toBeDisabled();
  fireEvent.change(screen.getByRole('combobox', { name: '추가할 현장' }), { target: { value: 's1' } });
  fireEvent.click(screen.getByRole('button', { name: '계산서 직접 입력' }));
  expect(screen.getByRole('textbox', { name: '1행 세율' })).toHaveValue('3.3');
  expect(screen.queryByRole('group', { name: '작업자 검색 결과' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '1행 항목명' })).toHaveFocus();
  fireEvent.change(screen.getByRole('textbox', { name: '1행 항목명' }), { target: { value: '가상 거래처' } });
  fireEvent.change(screen.getByRole('textbox', { name: '1행 세전 금액' }), { target: { value: '1000000' } });
  expect(screen.getByRole('textbox', { name: '1행 받을 예정 금액' })).toHaveValue('967,000');
  fireEvent.click(screen.getByRole('button', { name: '1행 한 번에 등록' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0][0][0]).toMatchObject({ entryKind: 'invoice', workerName: '가상 거래처', expectedAmount: 967000, siteId: 's1' });
  expect(onSave.mock.calls[0][0][0].workerId).toBeUndefined();
});
it('선택한 현장과 입력 행의 현장 담당 팀을 받는 계좌에 표시한다', () => {
  setup();
  addTwo();
  const row = screen.getByRole('combobox', { name: '1행 받는 계좌' });
  fireEvent.click(row);
  expect(screen.getByRole('option', { name: '검증 팀 팀장계좌' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '이재욱 위임' })).toBeInTheDocument();
  fireEvent.keyDown(row, { key: 'Escape' });
  fireEvent.change(screen.getByRole('combobox', { name: '1행 현장' }), { target: { value: 's2' } });
  fireEvent.click(row);
  expect(screen.getByRole('option', { name: '현장 담당 팀장계좌' })).toBeInTheDocument();
});

it('작업자를 선택하면 바로 개별 입력행을 만들고 등록은 실행하지 않는다', () => {
  const { onSave } = setup();
  expect(screen.queryByText('추가할 행의 공통 설정')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: '검증 가' }));
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', { name: '1행 세전 금액' })).toBeEnabled();
  expect(screen.getByRole('combobox', { name: '1행 입금방식' })).toBeEnabled();
  expect(screen.getByRole('combobox', { name: '1행 받는 계좌' })).toBeEnabled();
  expect(screen.getByRole('checkbox', { name: '검증 가 추가됨' })).toBeChecked();
  expect(screen.getByRole('button', { name: '1행 한 번에 등록' })).toBeEnabled();
});

it('현장과 여러 작업자를 선택하고 금액·세율·계좌·입금여부·메모를 한 번에 저장한다', async () => {
  const { onSave, onComplete } = setup();
  addTwo();
  fireEvent.change(screen.getByRole('textbox', { name: '1행 세율' }), { target: { value: '3.3' } });
  fireEvent.change(screen.getByRole('textbox', { name: '1행 세전 금액' }), { target: { value: '1,000,000' } });
  expect(screen.getByRole('textbox', { name: '1행 받을 예정 금액' })).toHaveValue('967,000');
  fireEvent.change(screen.getByRole('textbox', { name: '2행 받을 예정 금액' }), { target: { value: '750,000' } });
  expect(screen.getByRole('textbox', { name: '2행 세율' })).toHaveValue('');
  fireEvent.click(screen.getByRole('combobox', { name: '1행 받는 계좌' })); fireEvent.click(screen.getByRole('option', { name: '개인통장' }));
  fireEvent.click(screen.getByRole('combobox', { name: '1행 입금방식' })); fireEvent.click(screen.getByRole('option', { name: '직불' }));
  fireEvent.change(screen.getByRole('combobox', { name: '2행 입금여부' }), { target: { value: 'complete' } });
  fireEvent.change(screen.getByRole('combobox', { name: '2행 현장' }), { target: { value: 's2' } });
  fireEvent.change(screen.getByRole('textbox', { name: '1행 메모' }), { target: { value: '검증 메모' } });
  fireEvent.click(screen.getByRole('button', { name: '2행 한 번에 등록' }));
  await waitFor(() => expect(onComplete).toHaveBeenCalledWith('2026-10', 2));
  const saved = onSave.mock.calls[0][0];
  expect(saved[0]).toMatchObject({ workerId: 'w1', siteId: 's1', delegationType: 'direct', expectedAmount: 967000, taxRate: 3.3, memo: '검증 메모', receipts: [], confirmation: { recipient: 'personal', status: 'unknown' } });
  expect(saved[1]).toMatchObject({ workerId: 'w2', siteId: 's2', delegationType: 'delegate', expectedAmount: 750000, taxRate: null, receipts: [], confirmation: { recipient: 'unknown', status: 'complete' } });
});
it('작업자와 바이백·계산서 여러 행을 직접 입력하고 각 계좌와 금액을 구분해 저장한다', async () => {
  const { onSave } = setup();
  fireEvent.click(screen.getByRole('checkbox', { name: '검증 가' }));
  fireEvent.change(screen.getByRole('textbox', { name: '1행 세전 금액' }), { target: { value: '700000' } });
  fireEvent.click(screen.getByRole('button', { name: '바이백 직접 입력' }));
  fireEvent.change(screen.getByRole('textbox', { name: '2행 항목명' }), { target: { value: '가상 바이백 정산' } });
  fireEvent.change(screen.getByRole('textbox', { name: '2행 세전 금액' }), { target: { value: '500000' } });
  fireEvent.change(screen.getByRole('textbox', { name: '2행 받을 예정 금액' }), { target: { value: '480000' } });
  fireEvent.click(screen.getByRole('combobox', { name: '2행 받는 계좌' }));
  fireEvent.click(screen.getByRole('option', { name: '직접 입력…' }));
  fireEvent.change(screen.getByRole('textbox', { name: '2행 받는 계좌 직접 입력' }), { target: { value: '가상 정산 계좌' } });
  fireEvent.click(screen.getByRole('button', { name: '계산서 직접 입력' }));
  fireEvent.change(screen.getByRole('textbox', { name: '3행 세전 금액' }), { target: { value: '300000' } });
  fireEvent.click(screen.getByRole('button', { name: '계산서 직접 입력' }));
  fireEvent.change(screen.getByRole('textbox', { name: '4행 항목명' }), { target: { value: '가상 거래처' } });
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', { name: '1행 세전 금액' })).toHaveValue('700000');
  fireEvent.click(screen.getByRole('button', { name: '4행 한 번에 등록' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  const saved = onSave.mock.calls[0][0];
  expect(saved[0]).toMatchObject({ entryKind: 'worker', workerId: 'w1', grossAmount: 700000 });
  expect(saved[1]).toMatchObject({ entryKind: 'buyback', workerName: '가상 바이백 정산', grossAmount: 500000, expectedAmount: 480000, confirmation: { recipient: 'custom:가상 정산 계좌' } });
  expect(saved[2]).toMatchObject({ entryKind: 'invoice', workerName: '계산서', grossAmount: 300000 });
  expect(saved[3]).toMatchObject({ entryKind: 'invoice', workerName: '가상 거래처' });
  expect(saved.slice(1).every((claim: { workerId?: string }) => !claim.workerId)).toBe(true);
  expect(new Set(saved.map((claim: { id: string }) => claim.id)).size).toBe(4);
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
  fireEvent.click(screen.getByRole('button', { name: '다른 현장·작업자 추가' }));
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
  teams: [{ id: 't1', name: '골조팀', leaderName: '가상 팀장 가', isCheongyeon: true, color: '#112233' }, { id: 't2', name: '설비팀', leaderName: '가상 팀장 나', isCheongyeon: true, color: '#445566' }],
  sites: [{ id: 's1', name: '선택 현장', responsibleTeamId: 't1' }, { id: 's2', name: '다른 현장', responsibleTeamId: 't2' }],
  workers: [{ id: 'w1', name: '작업자 가', teamId: 't1' }, { id: 'w2', name: '작업자 나', teamId: 't2' }, { id: 'w3', name: '작업자 다', teamName: '골조팀' }, { id: 'w4', name: '작업자 라' }],
};
it('팀 필터를 바꿔도 추가한 작업자 행과 입력을 유지하며 함께 등록한다', async () => {
  const { onSave } = setup(jest.fn().mockResolvedValue({ added: 3, skipped: 0 }), grouped);
  chooseTeam('골조팀 · 2명');
  expect(within(screen.getByRole('group', { name: '작업자 검색 결과' })).getAllByRole('checkbox')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: '검색 결과 전체 추가' }));
  fireEvent.change(screen.getByRole('textbox', { name: '1행 세전 금액' }), { target: { value: '100000' } });
  chooseTeam('설비팀 · 1명');
  expect(screen.getByRole('textbox', { name: '1행 세전 금액' })).toHaveValue('100000');
  fireEvent.click(screen.getByRole('checkbox', { name: '작업자 나' }));
  fireEvent.click(screen.getByRole('button', { name: '3행 한 번에 등록' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0][0].map((row: { workerId: string }) => row.workerId)).toEqual(['w1', 'w3', 'w2']);
});
it('팀명·팀장명 검색과 청연 현장 담당 팀 바로가기를 지원한다', () => {
  setup(undefined, grouped);
  fireEvent.change(screen.getByRole('textbox', { name: '등록할 작업자 검색' }), { target: { value: '설비 팀' } });
  expect(screen.getByRole('checkbox', { name: '작업자 나' })).toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: '작업자 가' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: '등록할 작업자 검색' }), { target: { value: '팀장 가' } });
  expect(within(screen.getByRole('group', { name: '작업자 검색 결과' })).getAllByRole('checkbox')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: '현장 담당 팀 작업자 보기' }));
  expect(screen.getByRole('button', { name: '작업자 소속 팀' })).toHaveTextContent('골조팀 · 2명');
  expect(screen.getByRole('textbox', { name: '등록할 작업자 검색' })).toHaveValue('');
  expect(screen.queryByRole('checkbox', { name: '작업자 라' })).not.toBeInTheDocument();
});

it('청연 소속 팀만 표시하고 검색·키보드 선택을 지원한다', () => {
  setup(undefined, { ...grouped,
    teams: [...grouped.teams, { id: 'external', name: '외부팀', color: '#ff0000', isCheongyeon: false }, { id: 'empty', name: '신규팀', color: '#00ff00', isCheongyeon: true }],
    sites: [{ id: 's1', name: '외부 담당 현장', responsibleTeamId: 'external' }],
    workers: [...grouped.workers!, { id: 'external-worker', name: '외부 작업자', teamId: 'external' }],
  });
  expect(screen.queryByRole('checkbox', { name: '외부 작업자' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '현장 담당 팀 작업자 보기' })).not.toBeInTheDocument();
  const trigger = screen.getByRole('button', { name: '작업자 소속 팀' });
  expect(trigger).toHaveTextContent('청연이엔지 전체 팀 · 3명');
  fireEvent.click(trigger);
  expect(within(screen.getByRole('listbox', { name: '작업자 소속 팀 목록' })).queryByRole('option', { name: /외부팀|팀 미지정/ })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: '신규팀 · 0명' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '골조팀 · 2명' })).toBeInTheDocument();
  const search = screen.getByRole('combobox', { name: '작업자 소속 팀 검색' });
  fireEvent.change(search, { target: { value: '골조' } });
  fireEvent.keyDown(search, { key: 'Enter' });
  expect(trigger).toHaveTextContent('골조팀 · 2명');
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole('dialog', { name: '작업자 소속 팀 선택' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '검색 초기화' }));
  expect(within(screen.getByRole('group', { name: '작업자 검색 결과' })).getAllByRole('checkbox')).toHaveLength(3);
});

it('소속 팀이 없으면 다른 회사 팀으로 대체하지 않고 안내한다', () => {
  setup(undefined, { ...directory, teams: directory.teams.map(team => ({ ...team, isCheongyeon: false })) });
  expect(screen.getByText('청연이엔지 소속으로 등록된 팀이 없습니다. 팀의 소속 회사를 확인해 주세요.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '검색 결과 전체 추가' })).toBeDisabled();
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
it('행 삭제 후 다시 선택할 수 있고 현장을 바꿔도 먼저 입력한 행은 유지한다', () => {
  setup(undefined, grouped);
  fireEvent.click(screen.getByRole('checkbox', { name: '작업자 가' }));
  fireEvent.click(screen.getByRole('button', { name: '1행 삭제' }));
  expect(screen.getByRole('checkbox', { name: '작업자 가' })).toBeEnabled();
  fireEvent.click(screen.getByRole('checkbox', { name: '작업자 가' }));
  fireEvent.change(screen.getByRole('textbox', { name: '1행 세전 금액' }), { target: { value: '120000' } });
  fireEvent.change(screen.getByRole('combobox', { name: '추가할 현장' }), { target: { value: 's2' } });
  fireEvent.click(screen.getByRole('checkbox', { name: '작업자 가' }));
  expect(screen.getByRole('combobox', { name: '1행 현장' })).toHaveValue('s1');
  expect(screen.getByRole('textbox', { name: '1행 세전 금액' })).toHaveValue('120000');
  expect(screen.getByRole('combobox', { name: '2행 현장' })).toHaveValue('s2');
});
it('100명을 넘게 선택할 때 일부 인원을 조용히 빼지 않고 선택 범위를 안내한다', () => {
  setup(undefined, { ...grouped, workers: Array.from({ length: 101 }, (_, index) => ({ id: `w${index}`, name: `검증 ${String(index).padStart(3, '0')}`, teamId: 't1' })) });
  fireEvent.click(screen.getByRole('button', { name: '검색 결과 전체 추가' }));
  expect(screen.getByRole('alert')).toHaveTextContent('현재 100명까지 더 추가');
  expect(screen.getByRole('button', { name: '0행 한 번에 등록' })).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: '등록할 작업자 검색' }), { target: { value: '검증 100' } });
  fireEvent.click(screen.getByRole('button', { name: '검색 결과 전체 추가' }));
  expect(screen.getByRole('button', { name: '1행 한 번에 등록' })).toBeEnabled();
});
