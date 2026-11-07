import React from 'react';
import '@testing-library/jest-dom';
import { act, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Vehicle } from '../../types/vehicle';
import type { Team } from '../../services/teamService';
import VehicleRepairLedger from './VehicleRepairLedger';
import RepairPhotoImport from './RepairPhotoImport';
import { REPAIR_COST_KEYS, REPAIR_COST_LABELS, emptyCosts } from './model';
import { analyzeRepairPhoto, identifyRepairPhoto, RepairPhotoResult } from './photoAnalysis';
import { vehicleRepairService } from './service';

jest.mock('./photoAnalysis', () => ({ analyzeRepairPhoto: jest.fn(), identifyRepairPhoto: jest.fn() }));
jest.mock('./service', () => ({ vehicleRepairService: { list: jest.fn(), saveRows: jest.fn() } }));
const vehicle = { id: 'v1', model: '승합차', licensePlate: '123하 4567', currentAssigneeType: 'TEAM', currentAssigneeId: 't1', currentAssigneeName: '테스트 배정팀' } as Vehicle;
const team = { id: 't1', name: '테스트 배정팀', color: '#ffe066', iconKey: 'fa-truck-front' } as Team;
const photoId = 'vehicle_repair_photo_fixture';
const result: RepairPhotoResult = { date: '2026-10-31', vehiclePlate: '123하4567', vendor: '정비소',
  description: '오일·필터 교환\n타이어 교환', total: 360000, category: 'personal' };
const analyze = analyzeRepairPhoto as jest.Mock;

beforeEach(() => {
  jest.resetAllMocks();
  URL.createObjectURL = jest.fn(() => 'blob:fixture');
  URL.revokeObjectURL = jest.fn();
  window.sessionStorage.setItem('cy.support-management.year-month', '2026-11');
  (vehicleRepairService.list as jest.Mock).mockResolvedValue([]);
  (vehicleRepairService.saveRows as jest.Mock).mockResolvedValue(undefined);
  (identifyRepairPhoto as jest.Mock).mockResolvedValue(photoId);
  analyze.mockResolvedValue(result);
});
const upload = (...names: string[]) => fireEvent.change(screen.getByLabelText('정비명세서 사진 파일'), {
  target: { files: (names.length ? names : ['sample.jpg']).map(name => new File([name], name, { type: 'image/jpeg' })) },
});
const drop = (...names: string[]) => fireEvent.drop(screen.getByRole('region', { name: '정비명세서 사진 놓기' }), {
  dataTransfer: { types: ['Files'], files: names.map(name => new File([name], name, { type: 'image/jpeg' })) },
});
async function openPhotoDialog() {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><VehicleRepairLedger vehicles={[vehicle]} teams={[team]} /></MemoryRouter>);
  await screen.findByText(/조회 조건에 맞는 정비내역/);
  fireEvent.click(screen.getByRole('button', { name: '정비명세서 사진 인식' }));
}
async function openLedger(...names: string[]) {
  await openPhotoDialog();
  await act(async () => upload(...names));
}

test('사진 여러 장을 창에 놓아 인식하고 내부 요소를 지날 때도 놓기 표시를 유지한다', async () => {
  (identifyRepairPhoto as jest.Mock).mockImplementation((file: File) => Promise.resolve(photoId + file.name));
  await openPhotoDialog();
  const zone = screen.getByRole('region', { name: '정비명세서 사진 놓기' });
  const dialog = screen.getByRole('dialog');
  const button = screen.getByRole('button', { name: '사진 선택' });
  const dataTransfer = { types: ['Files'], dropEffect: 'none', files: [
    new File(['first'], 'first.png', { type: 'image/png' }), new File(['second'], 'second.HEIC'),
  ] };
  fireEvent.dragEnter(dialog, { dataTransfer });
  fireEvent.dragEnter(button, { dataTransfer });
  fireEvent.dragLeave(button, { dataTransfer });
  expect(zone).toHaveClass('repair-photo-upload-dragging');
  expect(fireEvent.dragOver(zone, { dataTransfer })).toBe(false);
  expect(dataTransfer.dropEffect).toBe('copy');
  await act(async () => { expect(fireEvent.drop(dialog, { dataTransfer })).toBe(false); });
  expect(zone).not.toHaveClass('repair-photo-upload-dragging');
  expect(analyze.mock.calls.map(([file]) => file.name)).toEqual(['first.png', 'second.HEIC']);
  fireEvent.click(screen.getByRole('button', { name: '인식된 2건 대장에 추가' }));
  expect(screen.getByText('수정사항 2건')).toBeInTheDocument();
  expect(vehicleRepairService.saveRows).not.toHaveBeenCalled();
});

test('사진이 아닌 파일이 섞여 있는 놓기는 기존 사진과 검수 내용을 유지한다', async () => {
  await openLedger();
  fireEvent.change(screen.getByLabelText('합계금액 (원)'), { target: { value: '99000' } });
  fireEvent.drop(screen.getByRole('dialog'), { dataTransfer: { types: ['Files'], files: [
    new File(['photo'], 'another.jpg', { type: 'image/jpeg' }), new File(['document'], 'document.pdf', { type: 'application/pdf' }),
  ] } });
  expect(screen.getByRole('alert')).toHaveTextContent('사진 파일만 선택하거나 끌어다 놓아 주세요');
  expect(screen.getByLabelText('합계금액 (원)')).toHaveValue('99000');
  expect(screen.getByRole('button', { name: /1\. sample.jpg/ })).toBeInTheDocument();
  expect(analyze).toHaveBeenCalledTimes(1);
});

test('창 밖에 놓은 파일의 브라우저 이동을 막되 글자 드래그와 창을 닫은 후의 동작은 가로채지 않는다', async () => {
  await openPhotoDialog();
  const files = { types: ['Files'], files: [new File(['outside'], 'outside.jpg', { type: 'image/jpeg' })] };
  const outsideDrop = createEvent.drop(document.body, { dataTransfer: files });
  fireEvent(document.body, outsideDrop);
  expect(outsideDrop.defaultPrevented).toBe(true);
  const textDrop = createEvent.drop(screen.getByRole('dialog'), { dataTransfer: { types: ['text/plain'], files: [] } });
  fireEvent(screen.getByRole('dialog'), textDrop);
  expect(textDrop.defaultPrevented).toBe(false);
  expect(analyze).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  const afterClose = createEvent.drop(document.body, { dataTransfer: files });
  fireEvent(document.body, afterClose);
  expect(afterClose.defaultPrevented).toBe(false);
});

test('여러 사진의 검수 내용을 유지하고 서로 다른 월의 내역을 한꺼번에 추가·저장한다', async () => {
  (identifyRepairPhoto as jest.Mock).mockImplementation((file: File) => Promise.resolve(photoId + file.name));
  analyze.mockResolvedValueOnce(result).mockResolvedValueOnce({ ...result, date: '2026-11-02', total: 120000 });
  await openLedger('october.jpg', 'november.jpg');
  expect(screen.getByLabelText('정비명세서 사진 파일')).toHaveAttribute('multiple');
  const add = await screen.findByRole('button', { name: '인식된 2건 대장에 추가' });
  await waitFor(() => expect(add).toBeEnabled());
  fireEvent.change(screen.getByLabelText('합계금액 (원)'), { target: { value: '350000' } });
  fireEvent.click(screen.getByRole('button', { name: /2\. november.jpg/ }));
  expect(screen.getByLabelText('합계금액 (원)')).toHaveValue('120,000');
  fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('비용 구분'), { target: { value: 'corporate' } });
  fireEvent.click(screen.getByRole('button', { name: /1\. october.jpg/ }));
  expect(screen.getByLabelText('합계금액 (원)')).toHaveValue('350000');
  fireEvent.click(add);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(vehicleRepairService.saveRows).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '전체 기간' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('수정사항 2건')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await screen.findByText('2건의 정비내역을 저장했습니다.');
  expect(vehicleRepairService.saveRows).toHaveBeenCalledWith([
    expect.objectContaining({ id: photoId + 'october.jpg', yearMonth: '2026-10', costs: { ...emptyCosts(), personal: 350000 } }),
    expect.objectContaining({ id: photoId + 'november.jpg', yearMonth: '2026-11', costs: { ...emptyCosts(), corporate: 120000 } }),
  ]);
});

test('실패한 사진 뒤에도 나머지 사진을 인식하고 해당 사진만 다시 시도한다', async () => {
  (identifyRepairPhoto as jest.Mock).mockImplementation((file: File) => Promise.resolve(photoId + file.name));
  analyze.mockResolvedValueOnce(result).mockRejectedValueOnce(new Error('두 번째 사진 인식 실패')).mockResolvedValueOnce(result);
  await openLedger('first.jpg', 'failed.jpg', 'last.jpg');
  const add = await screen.findByRole('button', { name: '인식된 2건 대장에 추가' });
  await waitFor(() => expect(add).toBeEnabled());
  expect(analyze.mock.calls.map(([file]) => file.name)).toEqual(['first.jpg', 'failed.jpg', 'last.jpg']);
  fireEvent.click(screen.getByRole('button', { name: /2\. failed.jpg/ }));
  expect(screen.getByRole('alert')).toHaveTextContent('두 번째 사진 인식 실패');
  fireEvent.click(screen.getByRole('button', { name: '다시 인식' }));
  const retryAdd = await screen.findByRole('button', { name: '인식된 3건 대장에 추가' });
  await waitFor(() => expect(retryAdd).toBeEnabled());
  expect(analyze.mock.calls.map(([file]) => file.name)).toEqual(['first.jpg', 'failed.jpg', 'last.jpg', 'failed.jpg']);
  fireEvent.click(retryAdd);
  expect(screen.getByText('수정사항 3건')).toBeInTheDocument();
  expect(vehicleRepairService.saveRows).not.toHaveBeenCalled();
});

test('정상 결과를 먼저 추가해도 누락된 결과는 보존하고 보완 후 추가할 수 있다', async () => {
  (identifyRepairPhoto as jest.Mock).mockImplementation((file: File) => Promise.resolve(photoId + file.name));
  analyze.mockResolvedValueOnce(result).mockResolvedValueOnce({ ...result, date: '2026-11-03', total: null, category: '' });
  await openLedger('ready.jpg', 'incomplete.jpg');
  await screen.findByRole('button', { name: /2\. incomplete.jpg 확인 필요/ });
  fireEvent.click(screen.getByRole('button', { name: '인식된 1건 대장에 추가' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /1\. ready.jpg/ })).not.toBeInTheDocument();
  expect(screen.getByLabelText('합계금액 (원)')).toHaveValue('');
  expect(screen.getByRole('button', { name: '대장에 추가' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('합계금액 (원)'), { target: { value: '75000' } });
  fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('비용 구분'), { target: { value: 'corporate' } });
  fireEvent.click(screen.getByRole('button', { name: '대장에 추가' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '전체 기간' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await screen.findByText('2건의 정비내역을 저장했습니다.');
  expect(vehicleRepairService.saveRows).toHaveBeenCalledWith(expect.arrayContaining([
    expect.objectContaining({ id: photoId + 'ready.jpg', costs: { ...emptyCosts(), personal: 360000 } }),
    expect.objectContaining({ id: photoId + 'incomplete.jpg', costs: { ...emptyCosts(), corporate: 75000 } }),
  ]));
});

test('한 번에 선택한 같은 사진은 중복 인식·추가하지 않고 다른 사진은 계속 처리한다', async () => {
  (identifyRepairPhoto as jest.Mock).mockResolvedValueOnce(photoId).mockResolvedValueOnce(photoId).mockResolvedValueOnce(photoId + '_other');
  await openLedger('first.jpg', 'duplicate.jpg', 'other.jpg');
  const add = await screen.findByRole('button', { name: '인식된 2건 대장에 추가' });
  await waitFor(() => expect(add).toBeEnabled());
  expect(analyze).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: /2\. duplicate.jpg/ }));
  expect(screen.getByRole('alert')).toHaveTextContent('함께 선택한 사진 중 같은 사진');
  fireEvent.click(add);
  expect(screen.getByRole('button', { name: '대장에 추가' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  expect(screen.getByText('수정사항 2건')).toBeInTheDocument();
});

test.each(['선택', '놓기'])('남은 추가 가능 건수를 넘기면 %s도 인식 요청 전에 차단한다', method => {
  const onAdd = jest.fn();
  render(<RepairPhotoImport vehicles={[]} lookup={() => ({ vehicleId: '', teamId: '', teamName: '', teamColor: '', teamIcon: '' })}
    alreadyAdded={() => false} remaining={1} onAdd={onAdd} onClose={jest.fn()} />);
  (method === '놓기' ? drop : upload)('one.jpg', 'two.jpg');
  expect(screen.getByRole('alert')).toHaveTextContent('현재 1장까지 선택할 수 있습니다');
  expect(identifyRepairPhoto).not.toHaveBeenCalled();
  expect(analyze).not.toHaveBeenCalled();
  expect(onAdd).not.toHaveBeenCalled();
});

test('여러 장 인식 중 닫으면 진행 중 요청을 취소하고 다음 사진을 요청하지 않는다', async () => {
  let finish!: (value: RepairPhotoResult) => void;
  analyze.mockImplementationOnce(() => new Promise<RepairPhotoResult>(resolve => { finish = resolve; }));
  await openLedger('first.jpg', 'second.jpg');
  await waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
  const signal = analyze.mock.calls[0][1] as AbortSignal;
  expect(screen.getByRole('button', { name: '인식된 0건 대장에 추가' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  expect(signal.aborted).toBe(true);
  await act(async () => finish(result));
  expect(analyze).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/수정사항/)).not.toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalled();
});

test.each(REPAIR_COST_KEYS)('검수한 합계 전액을 %s 한 곳에 넣고 명시적인 저장 때만 등록한다', async category => {
  await openLedger();
  const dialog = within(screen.getByRole('dialog'));
  expect(await dialog.findByDisplayValue('360,000')).toBeInTheDocument();
  expect(dialog.getByText('테스트 배정팀')).toBeInTheDocument();
  const previewBadge = dialog.getByTitle(team.name);
  expect(previewBadge).toHaveStyle({ backgroundColor: team.color });
  expect(within(previewBadge).getByRole('img', { hidden: true })).toHaveAttribute('data-icon', 'truck-front');
  expect(dialog.getByLabelText('비용 구분')).toHaveValue('personal');
  fireEvent.change(dialog.getByLabelText('비용 구분'), { target: { value: category } });
  fireEvent.click(dialog.getByRole('button', { name: '대장에 추가' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(vehicleRepairService.saveRows).not.toHaveBeenCalled();
  expect(screen.getByLabelText('정비 조회 월')).toHaveValue('2026-10');
  expect(screen.getByLabelText('1행 ' + REPAIR_COST_LABELS[category] + ' 금액')).toHaveValue(category === 'personal' ? '360,000' : '327,273');
  expect(screen.getByLabelText('1행 VAT')).toHaveTextContent(category === 'personal' ? '0' : '32,727');
  expect(screen.getByLabelText('1행 합계')).toHaveTextContent('360,000');
  expect(screen.getByLabelText('1행 정비내용')).toHaveValue('오일·필터 교환 / 타이어 교환');
  expect(within(screen.getByTitle(team.name)).getByRole('img', { hidden: true })).toHaveAttribute('data-icon', 'truck-front');
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await screen.findByText('1건의 정비내역을 저장했습니다.');
  expect(vehicleRepairService.saveRows).toHaveBeenCalledWith([expect.objectContaining({
    id: photoId, date: result.date, yearMonth: '2026-10', vehicleId: 'v1', teamId: 't1', teamName: '테스트 배정팀', teamColor: '#ffe066', teamIcon: 'fa-truck-front',
    costs: { ...emptyCosts(), [category]: 360000 }, revision: 0,
  })]);
});

test('누락된 합계와 구분을 직접 보완하고 차량번호를 고치면 팀도 다시 판정한다', async () => {
  analyze.mockResolvedValue({ ...result, vehiclePlate: '4567', category: '', total: null });
  await openLedger();
  const dialog = within(screen.getByRole('dialog'));
  const plate = await dialog.findByLabelText('차량번호');
  expect(dialog.getByText(/일치하는 차량이 한 대인지/)).toBeInTheDocument();
  const add = dialog.getByRole('button', { name: '대장에 추가' });
  expect(add).toBeDisabled();
  fireEvent.change(plate, { target: { value: '123하4567' } });
  expect(dialog.getByText('테스트 배정팀')).toBeInTheDocument();
  fireEvent.change(dialog.getByLabelText('합계금액 (원)'), { target: { value: '0' } });
  expect(add).toBeDisabled();
  fireEvent.change(dialog.getByLabelText('비용 구분'), { target: { value: 'corporate' } });
  fireEvent.click(add);
  fireEvent.change(screen.getByLabelText('1행 차량번호'), { target: { value: '다른 차량' } });
  expect(screen.queryByText('테스트 배정팀')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await screen.findByText('1건의 정비내역을 저장했습니다.');
  expect(vehicleRepairService.saveRows).toHaveBeenCalledWith([expect.objectContaining({
    vehicleId: '', teamId: '', teamName: '', teamColor: '', teamIcon: '', costs: { ...emptyCosts(), corporate: 0 },
  })]);
});

test('다시 올린 사진은 저장된 행과 작성 중인 행을 중복 생성하지 않는다', async () => {
  await openLedger();
  await screen.findByDisplayValue('360,000');
  fireEvent.click(screen.getByRole('button', { name: '대장에 추가' }));
  for (const saved of [false, true]) {
    if (saved) {
      fireEvent.click(screen.getByRole('button', { name: '저장' }));
      await screen.findByText('1건의 정비내역을 저장했습니다.');
    }
    fireEvent.click(screen.getByRole('button', { name: '정비명세서 사진 인식' }));
    upload('renamed.jpg');
    expect(await screen.findByRole('alert')).toHaveTextContent('이미 대장 또는 작성 중인 행');
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  }
  expect(vehicleRepairService.saveRows).toHaveBeenCalledTimes(1);
  expect(analyze).toHaveBeenCalledTimes(1);
});

test.each(['선택', '놓기'])('사진 %s 후에는 이전 응답을 무시하고 실패한 사진만 다시 인식한다', async method => {
  let finish!: (value: RepairPhotoResult) => void;
  analyze.mockImplementationOnce(() => new Promise<RepairPhotoResult>(resolve => { finish = resolve; }))
    .mockRejectedValueOnce(new Error('AI 요청 실패'));
  await openLedger();
  await waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
  const signal = analyze.mock.calls[0][1] as AbortSignal;
  (method === '놓기' ? drop : upload)('new.jpg');
  expect(signal.aborted).toBe(true);
  expect(await screen.findByRole('alert')).toHaveTextContent('AI 요청 실패');
  await act(async () => finish({ ...result, total: 111 }));
  expect(screen.queryByDisplayValue('111')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '다시 인식' }));
  await screen.findByDisplayValue('360,000');
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  expect(vehicleRepairService.saveRows).not.toHaveBeenCalled();
});

test('차량이 재배정된 뒤 다른 항목을 수정해도 등록할 때 확인한 팀을 보존한다', async () => {
  (vehicleRepairService.list as jest.Mock).mockResolvedValue([{
    id: photoId, yearMonth: '2026-11', date: '2026-11-01', originalDate: '', vehicleId: vehicle.id,
    vehiclePlate: result.vehiclePlate, teamId: 'previous', teamName: '기존 배정팀', teamColor: '#144088', teamIcon: 'fa-wrench', description: '수리', driver: '',
    vendor: '정비소', archived: false, issues: [], costs: { ...emptyCosts(), personal: 1000 }, memo: '', revision: 1,
  }]);
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><VehicleRepairLedger vehicles={[vehicle]} teams={[team]} /></MemoryRouter>);
  await screen.findByText('기존 배정팀');
  expect(screen.getByTitle('기존 배정팀')).toHaveStyle({ backgroundColor: '#144088' });
  expect(within(screen.getByTitle('기존 배정팀')).getByRole('img', { hidden: true })).toHaveAttribute('data-icon', 'wrench');
  fireEvent.change(screen.getByLabelText('1행 비고'), { target: { value: '확인 완료' } });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await screen.findByText('1건의 정비내역을 저장했습니다.');
  expect(vehicleRepairService.saveRows).toHaveBeenCalledWith([expect.objectContaining({ teamId: 'previous', teamName: '기존 배정팀', teamColor: '#144088', teamIcon: 'fa-wrench' })]);
});

test('이전 기록은 다시 저장하지 않아도 팀 명부의 아이콘과 색상을 보여 준다', async () => {
  const old = { yearMonth: '2026-11', date: '2026-11-01', originalDate: '', vehicleId: vehicle.id, vehiclePlate: result.vehiclePlate,
    description: '정비', driver: '', vendor: '', costs: { ...emptyCosts(), personal: 1 }, memo: '', issues: [], archived: false, revision: 1 };
  (vehicleRepairService.list as jest.Mock).mockResolvedValue([
    { ...old, id: 'saved-team', teamId: team.id, teamName: '저장된 팀명' }, { ...old, id: 'no-snapshot' },
    { ...old, id: 'no-link', vehiclePlate: '4567', vehicleId: '' },
    { ...old, id: 'no-icon', teamId: 'default', teamName: '아이콘 미설정팀' },
  ]);
  const defaultTeam = { ...team, id: 'default', name: '아이콘 미설정팀', iconKey: '', color: '#225599' };
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><VehicleRepairLedger vehicles={[vehicle]} teams={[team, defaultTeam]} /></MemoryRouter>);
  for (const title of ['저장된 팀명', '현재 차량 배정팀 · 테스트 배정팀']) {
    const badge = await screen.findByTitle(title);
    expect(badge).toHaveStyle({ backgroundColor: '#ffe066' });
    expect(within(badge).getByRole('img', { hidden: true })).toHaveAttribute('data-icon', 'truck-front');
  }
  const fallback = screen.getByTitle('아이콘 미설정팀');
  expect(fallback).toHaveStyle({ backgroundColor: '#225599' });
  expect(within(fallback).getByRole('img', { hidden: true })).toHaveAttribute('data-icon', 'users');
  expect(within(screen.getByRole('cell', { name: '—' })).queryByRole('img', { hidden: true })).not.toBeInTheDocument();
  expect(vehicleRepairService.saveRows).not.toHaveBeenCalled();
});
