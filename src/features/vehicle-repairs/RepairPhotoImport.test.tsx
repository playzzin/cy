import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Vehicle } from '../../types/vehicle';
import VehicleRepairLedger from './VehicleRepairLedger';
import { COST_KEYS, COST_LABELS, emptyCosts } from './model';
import { analyzeRepairPhoto, identifyRepairPhoto, RepairPhotoResult } from './photoAnalysis';
import { vehicleRepairService } from './service';

jest.mock('./photoAnalysis', () => ({ analyzeRepairPhoto: jest.fn(), identifyRepairPhoto: jest.fn() }));
jest.mock('./service', () => ({ vehicleRepairService: { list: jest.fn(), saveRows: jest.fn() } }));
const vehicle = { id: 'v1', model: '승합차', licensePlate: '123하 4567', currentAssigneeType: 'TEAM', currentAssigneeId: 't1', currentAssigneeName: '테스트 배정팀' } as Vehicle;
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
const upload = (name = 'sample.jpg') => fireEvent.change(screen.getByLabelText('정비명세서 사진 파일'), {
  target: { files: [new File(['fixture'], name, { type: 'image/jpeg' })] },
});
async function openLedger() {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><VehicleRepairLedger vehicles={[vehicle]} /></MemoryRouter>);
  await screen.findByText(/조회 조건에 맞는 정비내역/);
  fireEvent.click(screen.getByRole('button', { name: '정비명세서 사진 인식' }));
  upload();
}

test.each(COST_KEYS)('검수한 합계 전액을 %s 한 곳에 넣고 명시적인 저장 때만 등록한다', async category => {
  await openLedger();
  const dialog = within(screen.getByRole('dialog'));
  expect(await dialog.findByDisplayValue('360,000')).toBeInTheDocument();
  expect(dialog.getByText('테스트 배정팀')).toBeInTheDocument();
  expect(dialog.getByLabelText('비용 구분')).toHaveValue('personal');
  fireEvent.change(dialog.getByLabelText('비용 구분'), { target: { value: category } });
  fireEvent.click(dialog.getByRole('button', { name: '대장에 추가' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(vehicleRepairService.saveRows).not.toHaveBeenCalled();
  expect(screen.getByLabelText('정비 조회 월')).toHaveValue('2026-10');
  expect(screen.getByLabelText('1행 ' + COST_LABELS[category] + ' 금액')).toHaveValue('360,000');
  expect(screen.getByLabelText('1행 정비내용')).toHaveValue('오일·필터 교환 / 타이어 교환');
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await screen.findByText('1건의 정비내역을 저장했습니다.');
  expect(vehicleRepairService.saveRows).toHaveBeenCalledWith([expect.objectContaining({
    id: photoId, date: result.date, yearMonth: '2026-10', vehicleId: 'v1', teamId: 't1', teamName: '테스트 배정팀',
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
    vehicleId: '', teamId: '', teamName: '', costs: { ...emptyCosts(), corporate: 0 },
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

test('교체 전 사진의 늦은 응답은 무시하고, 실패한 사진은 같은 파일로 다시 인식한다', async () => {
  let finish!: (value: RepairPhotoResult) => void;
  analyze.mockImplementationOnce(() => new Promise<RepairPhotoResult>(resolve => { finish = resolve; }))
    .mockRejectedValueOnce(new Error('AI 요청 실패'));
  await openLedger();
  await waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
  const signal = analyze.mock.calls[0][1] as AbortSignal;
  upload('new.jpg');
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
    vehiclePlate: result.vehiclePlate, teamId: 'previous', teamName: '기존 배정팀', description: '수리', driver: '',
    vendor: '정비소', archived: false, issues: [], costs: { ...emptyCosts(), personal: 1000 }, memo: '', revision: 1,
  }]);
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><VehicleRepairLedger vehicles={[vehicle]} /></MemoryRouter>);
  await screen.findByText('기존 배정팀');
  fireEvent.change(screen.getByLabelText('1행 비고'), { target: { value: '확인 완료' } });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await screen.findByText('1건의 정비내역을 저장했습니다.');
  expect(vehicleRepairService.saveRows).toHaveBeenCalledWith([expect.objectContaining({ teamId: 'previous', teamName: '기존 배정팀' })]);
});
