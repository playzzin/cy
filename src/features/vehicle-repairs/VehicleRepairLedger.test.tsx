import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import VehicleRepairLedger from './VehicleRepairLedger';
import { vehicleRepairService } from './service';
import { emptyCosts, RepairRecord } from './model';

jest.mock('./service', () => ({ vehicleRepairService: { list: jest.fn(), saveRows: jest.fn(), archive: jest.fn(), importRecords: jest.fn() } }));
const row = (id: string, date: string, amount: number): RepairRecord => ({ id, date, yearMonth: date.slice(0, 7), originalDate: '', vehiclePlate: '12가3456', vehicleId: '', description: `테스트 수리 ${id}`, driver: '', vendor: '정비업체', costs: { ...emptyCosts(), cheongyeon: amount }, memo: '', issues: [], archived: false, revision: 1 });
const renderLedger = (onBeforeLeaveChange?: (guard: (() => boolean) | null) => void) => render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Link to="/other">다른 화면</Link><Routes><Route path="/" element={<VehicleRepairLedger vehicles={[]} onBeforeLeaveChange={onBeforeLeaveChange} />} /><Route path="/other" element={<p>이동 완료</p>} /></Routes></MemoryRouter>);
let counter = 0;
beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.setItem('cy.support-management.year-month', '2026-04');
  Object.defineProperty(window, 'crypto', { configurable: true, value: { randomUUID: () => `test-${++counter}` } });
  (vehicleRepairService.list as jest.Mock).mockResolvedValue([row('one', '2025-03-01', 110000), row('two', '2026-04-01', 220000)]);
  (vehicleRepairService.saveRows as jest.Mock).mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

test('월별 목록과 합계를 보여 주며 전체 기간에서 과거 내역을 조회한다', async () => {
  renderLedger();
  await screen.findByDisplayValue('테스트 수리 two');
  expect(screen.queryByDisplayValue('테스트 수리 one')).not.toBeInTheDocument();
  expect(screen.getByText('조회 내역 합계 (1건)')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '전체 기간' }));
  expect(screen.getByDisplayValue('테스트 수리 one')).toBeInTheDocument();
  expect(screen.getByText('조회 내역 합계 (2건)')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('정비 조회 월'), { target: { value: '2025-03' } });
  expect(screen.queryByDisplayValue('테스트 수리 two')).not.toBeInTheDocument();
});

test('기존 행의 금액을 바로 수정하고 저장 전까지 서버에 쓰지 않는다', async () => {
  renderLedger();
  await screen.findByDisplayValue('테스트 수리 two');
  const amount = screen.getByLabelText('1행 청연 금액');
  fireEvent.focus(amount);
  fireEvent.change(amount, { target: { value: '1234.70' } });
  fireEvent.blur(amount);
  expect(amount).toHaveValue('1,234.7');
  expect(screen.getByText('수정사항 1건')).toBeInTheDocument();
  expect(vehicleRepairService.saveRows).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await screen.findByText('1건의 정비내역을 저장했습니다.');
  expect(vehicleRepairService.saveRows).toHaveBeenCalledWith([expect.objectContaining({ id: 'two', revision: 1, costs: { ...emptyCosts(), cheongyeon: 1234.7 } })]);
});

test('새 행과 기존 행을 한 번에 저장하고 0원과 빈 비용을 구분한다', async () => {
  renderLedger();
  await screen.findByDisplayValue('테스트 수리 two');
  fireEvent.change(screen.getByLabelText('1행 운전자'), { target: { value: '운전자 수정' } });
  fireEvent.click(screen.getByRole('button', { name: '행 추가' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByLabelText('1행 정비일')).toHaveValue('2026-04-01');
  fireEvent.change(screen.getByLabelText('1행 차량번호'), { target: { value: '34나5678' } });
  fireEvent.change(screen.getByLabelText('1행 정비내용'), { target: { value: '무상 점검' } });
  fireEvent.change(screen.getByLabelText('1행 개인 금액'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await screen.findByText('2건의 정비내역을 저장했습니다.');
  const saved = (vehicleRepairService.saveRows as jest.Mock).mock.calls[0][0];
  expect(saved).toHaveLength(2);
  expect(saved.find((item: RepairRecord) => item.description === '무상 점검')).toMatchObject({ revision: 0, costs: { ...emptyCosts(), personal: 0 } });
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
});

test('빈 신규 행은 저장을 차단하고 표 안에 확인할 항목을 표시한다', async () => {
  renderLedger();
  await screen.findByDisplayValue('테스트 수리 two');
  fireEvent.click(screen.getByRole('button', { name: '행 추가' }));
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(vehicleRepairService.saveRows).not.toHaveBeenCalled();
  expect(screen.getAllByRole('alert').map(el => el.textContent).join(' ')).toContain('차량번호 확인 필요');
  fireEvent.click(screen.getByRole('button', { name: '행 취소' }));
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
});

test('저장 실패 시 여러 행의 입력과 오류를 유지해 재시도할 수 있다', async () => {
  (vehicleRepairService.saveRows as jest.Mock).mockRejectedValueOnce(new Error('다른 사용자가 수정했습니다.'));
  renderLedger();
  await screen.findByDisplayValue('테스트 수리 two');
  fireEvent.change(screen.getByLabelText('1행 정비내용'), { target: { value: '새 수리 내용' } });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('다른 사용자가 수정');
  expect(screen.getByLabelText('1행 정비내용')).toHaveValue('새 수리 내용');
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await screen.findByText('1건의 정비내역을 저장했습니다.');
});

test('저장 중에는 셀과 이동 및 반복 저장이 잠긴다', async () => {
  let finish!: () => void;
  (vehicleRepairService.saveRows as jest.Mock).mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  renderLedger();
  await screen.findByDisplayValue('테스트 수리 two');
  fireEvent.change(screen.getByLabelText('1행 정비내용'), { target: { value: '변경 내용' } });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(screen.getByLabelText('1행 정비내용')).toBeDisabled();
  expect(screen.getByRole('button', { name: '저장 중…' })).toBeDisabled();
  finish();
  await screen.findByText('1건의 정비내역을 저장했습니다.');
});

test('미저장 상태에서 월 이동과 다른 화면 이동을 취소하면 입력을 보존한다', async () => {
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  renderLedger();
  await screen.findByDisplayValue('테스트 수리 two');
  fireEvent.change(screen.getByLabelText('1행 정비내용'), { target: { value: '입력 유지' } });
  fireEvent.click(screen.getByRole('button', { name: '정비 다음 달' }));
  expect(screen.getByLabelText('정비 조회 월')).toHaveValue('2026-04');
  fireEvent.click(screen.getByRole('link', { name: '다른 화면' }));
  expect(screen.getByLabelText('1행 정비내용')).toHaveValue('입력 유지');
  expect(screen.queryByText('이동 완료')).not.toBeInTheDocument();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('link', { name: '다른 화면' }));
  expect(await screen.findByText('이동 완료')).toBeInTheDocument();
});

test('새로고침과 엑셀 가져오기는 미저장 편집이 있으면 잠긴다', async () => {
  renderLedger();
  await screen.findByDisplayValue('테스트 수리 two');
  fireEvent.change(screen.getByLabelText('1행 운전자'), { target: { value: '변경' } });
  expect(screen.getByRole('button', { name: '정비내역 새로고침' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '엑셀 가져오기' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
  expect(screen.getByRole('button', { name: '엑셀 가져오기' })).toBeEnabled();
});

test('삭제 확인을 취소하면 서버 상태를 바꾸지 않는다', async () => {
  jest.spyOn(window, 'confirm').mockReturnValue(false);
  renderLedger();
  await screen.findByDisplayValue('테스트 수리 two');
  fireEvent.click(screen.getByRole('button', { name: '삭제' }));
  expect(vehicleRepairService.archive).not.toHaveBeenCalled();
});

test('삭제 후 휴지통에서 복원할 수 있다', async () => {
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  const active = row('two', '2026-04-01', 220000);
  const archived = { ...active, archived: true, revision: 2 };
  (vehicleRepairService.archive as jest.Mock).mockResolvedValue(undefined);
  renderLedger();
  await screen.findByDisplayValue('테스트 수리 two');
  (vehicleRepairService.list as jest.Mock).mockResolvedValue([archived]);
  fireEvent.click(screen.getByRole('button', { name: '삭제' }));
  await screen.findByText('정비내역을 삭제했습니다. 휴지통에서 복원할 수 있습니다.');
  await waitFor(() => expect(screen.queryByDisplayValue('테스트 수리 two')).not.toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('정비 상태'), { target: { value: 'archived' } });
  expect(screen.getByDisplayValue('테스트 수리 two')).toBeInTheDocument();
  (vehicleRepairService.list as jest.Mock).mockResolvedValue([{ ...active, revision: 3 }]);
  fireEvent.click(screen.getByRole('button', { name: '복원' }));
  await screen.findByText('정비내역을 복원했습니다.');
  expect(vehicleRepairService.archive).toHaveBeenLastCalledWith(archived);
});

test('조회 실패를 표시하고 다시 조회할 수 있다', async () => {
  (vehicleRepairService.list as jest.Mock).mockRejectedValueOnce(new Error('서버 연결 실패'));
  renderLedger();
  expect(await screen.findByRole('alert')).toHaveTextContent('서버 연결 실패');
  fireEvent.click(screen.getByRole('button', { name: '다시 조회' }));
  expect(await screen.findByDisplayValue('테스트 수리 two')).toBeInTheDocument();
});

test('잘못 입력한 금액도 페이지를 이동했다 돌아오면 원문을 유지한다', async () => {
  (vehicleRepairService.list as jest.Mock).mockResolvedValue(Array.from({ length: 51 }, (_, i) => row(`row-${String(i).padStart(2, '0')}`, '2026-04-01', 100)));
  renderLedger();
  await screen.findByDisplayValue('테스트 수리 row-00');
  fireEvent.change(screen.getByLabelText('1행 청연 금액'), { target: { value: '12.345' } });
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  fireEvent.click(screen.getByRole('button', { name: '이전' }));
  expect(screen.getByLabelText('1행 청연 금액')).toHaveValue('12.345');
});

test('입력값을 원래 값으로 되돌리면 미저장 변경으로 남지 않는다', async () => {
  renderLedger();
  await screen.findByDisplayValue('테스트 수리 two');
  fireEvent.change(screen.getByLabelText('1행 운전자'), { target: { value: '잘못 입력' } });
  fireEvent.change(screen.getByLabelText('1행 운전자'), { target: { value: '' } });
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  expect(screen.queryByText('수정사항 1건')).not.toBeInTheDocument();
});

test('잘못된 쉼표 구분을 임의 금액으로 변환해 저장하지 않는다', async () => {
  renderLedger();
  await screen.findByDisplayValue('테스트 수리 two');
  fireEvent.change(screen.getByLabelText('1행 청연 금액'), { target: { value: '1,2' } });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(vehicleRepairService.saveRows).not.toHaveBeenCalled();
  expect(screen.getByLabelText('1행 청연 금액')).toHaveValue('1,2');
});

test('비용 메모를 명시적으로 확인하기 전에는 수정·저장 후에도 표시한다', async () => {
  const note = '개인 비용란 메모 확인';
  (vehicleRepairService.list as jest.Mock).mockResolvedValue([{ ...row('note', '2026-04-01', 100), memo: '원본 비용 메모', issues: [note] }]);
  renderLedger();
  await screen.findByDisplayValue('테스트 수리 note');
  fireEvent.change(screen.getByLabelText('1행 운전자'), { target: { value: '운전자 수정' } });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await screen.findByText('1건의 정비내역을 저장했습니다.');
  expect(screen.getByTitle(note)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('1행 비용 메모 확인 완료'));
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(vehicleRepairService.saveRows).toHaveBeenCalledTimes(2));
  expect((vehicleRepairService.saveRows as jest.Mock).mock.calls[1][0][0].issues).toEqual([]);
});

test('같은 금액의 표기만 바꿨다가 새로고침하면 최신 서버 값을 보여준다', async () => {
  renderLedger();
  await screen.findByDisplayValue('테스트 수리 two');
  fireEvent.change(screen.getByLabelText('1행 청연 금액'), { target: { value: '220,000.00' } });
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  (vehicleRepairService.list as jest.Mock).mockResolvedValue([row('two', '2026-04-01', 330000)]);
  fireEvent.click(screen.getByRole('button', { name: '정비내역 새로고침' }));
  expect(await screen.findByDisplayValue('330,000')).toBeInTheDocument();
});
