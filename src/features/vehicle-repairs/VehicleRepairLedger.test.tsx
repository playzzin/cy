import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import VehicleRepairLedger from './VehicleRepairLedger';
import { vehicleRepairService } from './service';
import { emptyCosts, RepairRecord } from './model';

jest.mock('./service', () => ({ vehicleRepairService: { list: jest.fn(), save: jest.fn(), archive: jest.fn(), importRecords: jest.fn() } }));
const row = (id: string, date: string, amount: number): RepairRecord => ({ id, date, yearMonth: date.slice(0, 7), originalDate: '', vehiclePlate: '12가3456', vehicleId: '', description: `테스트 수리 ${id}`, driver: '', vendor: '정비업체', costs: { ...emptyCosts(), cheongyeon: amount }, memo: '', issues: [], archived: false, revision: 1 });
beforeEach(() => { jest.clearAllMocks(); (vehicleRepairService.list as jest.Mock).mockResolvedValue([row('one', '2025-03-01', 110000), row('two', '2026-04-01', 220000)]); });

test('연도 필터가 목록과 금액에 함께 적용되고 검색 초기화가 복원한다', async () => {
  render(<VehicleRepairLedger vehicles={[]} />);
  await screen.findByText('테스트 수리 one');
  fireEvent.change(screen.getByLabelText('정비 연도'), { target: { value: '2026' } });
  expect(screen.queryByText('테스트 수리 one')).not.toBeInTheDocument();
  expect(screen.getByText('테스트 수리 two')).toBeInTheDocument();
  expect(screen.getByText('조회 내역 합계 (1건)')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '초기화' }));
  expect(screen.getByText('테스트 수리 one')).toBeInTheDocument();
});

test('수정 실패 시 입력 내용과 오류를 유지한다', async () => {
  (vehicleRepairService.save as jest.Mock).mockRejectedValue(new Error('다른 사용자가 수정했습니다.'));
  render(<VehicleRepairLedger vehicles={[]} />);
  await screen.findByText('테스트 수리 two');
  fireEvent.click(screen.getAllByRole('button', { name: '수정' })[0]);
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('정비내용'), { target: { value: '새 수리 내용' } });
  fireEvent.click(within(dialog).getByRole('button', { name: '정비내역 저장' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('다른 사용자가 수정');
  expect(within(dialog).getByLabelText('정비내용')).toHaveValue('새 수리 내용');
});

test('보관 확인을 취소하면 서버 상태를 바꾸지 않는다', async () => {
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  render(<VehicleRepairLedger vehicles={[]} />);
  await screen.findByText('테스트 수리 one');
  fireEvent.click(screen.getAllByRole('button', { name: '보관' })[0]);
  expect(vehicleRepairService.archive).not.toHaveBeenCalled();
  confirm.mockRestore();
});

test('조회 실패를 표시하고 다시 조회할 수 있다', async () => {
  (vehicleRepairService.list as jest.Mock).mockRejectedValueOnce(new Error('서버 연결 실패'));
  render(<VehicleRepairLedger vehicles={[]} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('서버 연결 실패');
  fireEvent.click(screen.getByRole('button', { name: '다시 조회' }));
  expect(await screen.findByText('테스트 수리 one')).toBeInTheDocument();
});
