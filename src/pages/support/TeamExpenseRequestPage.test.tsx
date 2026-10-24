import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TeamExpenseRequestPage from './TeamExpenseRequestPage';
import { teamExpenseRequestService } from '../../services/teamExpenseRequestService';
import * as preparation from '../../utils/expenseReceiptPreparation';

let mockCurrentUser: { uid: string } | null = { uid: 'leader' };
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mockCurrentUser }) }));
jest.mock('../../services/teamExpenseRequestService', () => ({
  teamExpenseRequestService: { list: jest.fn(), upload: jest.fn(), submit: jest.fn(), review: jest.fn(), analyze: jest.fn() },
  validateRequestReceiptFiles: (files: File[]) => { if (!files.length) throw new Error('영수증을 첨부해 주세요.'); },
}));
const service = teamExpenseRequestService as jest.Mocked<typeof teamExpenseRequestService>;
const payer = { id: 'team-a', name: 'A팀', color: '#ef4444', icon: 'fa-helmet-safety' };
const billing = { id: 'team-b', name: 'B팀', color: '#2563eb', icon: 'fa-truck-front' };
const data = { canReview: false, payerTeams: [payer], teams: [payer, billing], categories: [{ id: 'meal', label: '식대' }], paymentCards: [{ id: 'card-a', label: '경비카드 1234', teamId: 'team-a' }], requests: [] };
const request: any = { id: 'request-a', status: 'pending', teamId: 'team-a', teamName: 'A팀', submitterName: '팀장', description: '점심 식대', amount: 25000, date: '2026-09-20', categoryLabel: '식대', paymentMethod: '현찰', attachments: [{ id: 'receipt', url: 'https://example.test/receipt.png' }] };
beforeEach(() => {
  jest.resetAllMocks();
  mockCurrentUser = { uid: 'leader' };
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: () => `test-${Math.random()}` } });
  URL.createObjectURL = jest.fn(() => 'blob:test-receipt');
  URL.revokeObjectURL = jest.fn();
  service.list.mockResolvedValue(data);
  service.analyze.mockResolvedValue({ date: '2026-09-19', amount: 12000, paymentMethod: '개인카드', category: 'meal', warnings: [], isReceipt: true });
  service.upload.mockResolvedValue({ receipt: { id: 'receipt', name: '영수증.png', fullPath: 'test/receipt' } });
  service.submit.mockResolvedValue({ id: 'request-a', status: 'pending' });
  service.review.mockResolvedValue({});
});
const fillRequest = async () => {
  await screen.findByLabelText('청구팀');
  fireEvent.change(screen.getByLabelText('청구팀'), { target: { value: 'B팀' } });
  fireEvent.click(screen.getByRole('option', { name: 'B팀' }));
  fireEvent.change(screen.getByLabelText('배정된 카드'), { target: { value: 'card:card-a' } });
  fireEvent.change(screen.getByLabelText('금액 (원)'), { target: { value: '25000' } });
  fireEvent.change(screen.getByLabelText('사용 내용'), { target: { value: '점심 식대' } });
  fireEvent.change(screen.getByLabelText('영수증 파일 첨부'), { target: { files: [new File(['receipt'], '영수증.png', { type: 'image/png' })] } });
  await screen.findByText('영수증.png');
};

test('청구팀 입력칸에서 검색하고 키보드로 선택하며 미선택 검색어는 저장하지 않는다', async () => {
  render(<TeamExpenseRequestPage />);
  const input = await screen.findByRole('combobox', { name: '청구팀' });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: ' b 팀 ' } });
  expect(screen.queryByRole('option', { name: 'A팀' })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'B팀' })).toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(input).toHaveValue('B팀');
  expect(input).toHaveAttribute('aria-expanded', 'false');
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: '없는팀' } });
  expect(screen.getByText('검색 결과가 없습니다.')).toBeInTheDocument();
  fireEvent.blur(input);
  expect(input).toHaveValue('B팀');
});

test('사용팀의 경비카드를 결제수단으로 선택해 카드 ID와 이름을 제출한다', async () => {
  service.list.mockResolvedValue({ ...data, paymentCards: [
    { id: 'card-a', label: '현장 경비 · 테스트카드 · •••• 1234', teamId: 'team-a' },
    { id: 'card-b', label: '다른팀 카드', teamId: 'team-b' },
  ] });
  render(<TeamExpenseRequestPage />);
  await fillRequest();
  const payment = screen.getByLabelText('배정된 카드');
  expect(within(payment).queryByRole('option', { name: '다른팀 카드' })).not.toBeInTheDocument();
  fireEvent.change(payment, { target: { value: 'card:card-a' } });
  fireEvent.click(screen.getByRole('button', { name: '등록 전 미리보기' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('현장 경비 · 테스트카드 · •••• 1234');
  fireEvent.click(screen.getByRole('button', { name: '확인 후 승인 요청' }));
  await waitFor(() => expect(service.submit).toHaveBeenCalledWith(expect.objectContaining({ paymentCardId: 'card-a', paymentMethod: '현장 경비 · 테스트카드 · •••• 1234' })));
});

test('사용팀 변경과 카드 배정 해제 후에는 결제수단을 다시 선택해야 한다', async () => {
  const withCards = { ...data, payerTeams: [payer, billing], paymentCards: [{ id: 'card-a', label: '경비카드 1234', teamId: 'team-a' }] };
  service.list.mockResolvedValue(withCards);
  render(<TeamExpenseRequestPage />);
  const team = await screen.findByLabelText('사용팀 (현재 소속)');
  fireEvent.change(team, { target: { value: 'team-a' } });
  fireEvent.change(screen.getByLabelText('배정된 카드'), { target: { value: 'card:card-a' } });
  fireEvent.change(team, { target: { value: 'team-b' } });
  expect(screen.getByLabelText('배정된 카드')).toHaveValue('');
  expect(screen.queryByRole('option', { name: '경비카드 1234' })).not.toBeInTheDocument();
  fireEvent.change(team, { target: { value: 'team-a' } });
  fireEvent.change(screen.getByLabelText('배정된 카드'), { target: { value: 'card:card-a' } });
  service.list.mockResolvedValue({ ...withCards, paymentCards: [] });
  fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
  await waitFor(() => expect(screen.getByLabelText('배정된 카드')).toHaveValue(''));
});

test('배정된 카드만 선택할 수 있고 카드 미선택 상태에서는 제출하지 않는다', async () => {
  render(<TeamExpenseRequestPage />);
  await fillRequest();
  const card = screen.getByLabelText('배정된 카드');
  expect(within(card).getAllByRole('option').map(option => option.textContent)).toEqual(['배정된 카드 선택', '경비카드 1234']);
  expect(screen.queryByLabelText('결제수단')).not.toBeInTheDocument();
  fireEvent.change(card, { target: { value: '' } });
  fireEvent.submit(screen.getByRole('form', { name: '새 경비 신청' }));
  expect(screen.getByRole('alert')).toHaveTextContent('사용팀에 배정된 카드를 선택해 주세요.');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(service.submit).not.toHaveBeenCalled();
});

test('AI 분석의 결제수단과 관계없이 직접 선택한 배정 카드를 유지한다', async () => {
  service.list.mockResolvedValue({ ...data, paymentCards: [{ id: 'card-a', label: '경비카드 1234', teamId: 'team-a' }] });
  render(<TeamExpenseRequestPage />);
  await fillRequest();
  fireEvent.change(screen.getByLabelText('배정된 카드'), { target: { value: 'card:card-a' } });
  fireEvent.click(screen.getByRole('button', { name: '영수증.png AI 입력' }));
  await screen.findByDisplayValue('12000');
  fireEvent.click(screen.getByRole('button', { name: '확인 후 입력란에 적용' }));
  expect(screen.getByLabelText('배정된 카드')).toHaveValue('card:card-a');
  service.analyze.mockResolvedValue({ date: '2026-09-19', amount: 15000, paymentMethod: '현찰', category: 'meal', warnings: [], isReceipt: true });
  fireEvent.click(screen.getByRole('button', { name: '영수증.png AI 입력' }));
  await screen.findByDisplayValue('15000');
  expect(screen.queryByLabelText('분석 결제수단')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '확인 후 입력란에 적용' }));
  expect(screen.getByLabelText('배정된 카드')).toHaveValue('card:card-a');
});

test('신청 내역을 사용팀·청구팀 이름으로 검색하고 상태 필터와 함께 적용한다', async () => {
  service.list.mockResolvedValue({ ...data, requests: [
    { ...request, chargeToTeamName: 'B팀' },
    { ...request, id: 'other', teamName: 'C팀', description: '다른 경비', status: 'approved' },
  ] });
  render(<TeamExpenseRequestPage />);
  const search = await screen.findByRole('searchbox', { name: '내역 팀 검색' });
  fireEvent.change(search, { target: { value: ' b 팀 ' } });
  expect(screen.getByText('점심 식대')).toBeInTheDocument();
  expect(screen.queryByText('다른 경비')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('상태'), { target: { value: 'approved' } });
  expect(screen.queryByText('점심 식대')).not.toBeInTheDocument();
  fireEvent.change(search, { target: { value: 'c팀' } });
  expect(screen.getByText('다른 경비')).toBeInTheDocument();
});
test('현재 소속팀을 사용팀으로 표시하고 별도 청구팀과 영수증을 제출한다', async () => {
  render(<TeamExpenseRequestPage />);
  await fillRequest();
  expect(screen.getByLabelText('현재 소속팀')).toHaveTextContent('A팀');
  expect(screen.queryByRole('combobox', { name: '사용팀 (현재 소속)' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('청구팀')).toHaveValue('B팀');
  expect(within(screen.getByLabelText('현재 소속팀')).getByText('A팀')).toHaveStyle({ borderColor: '#ef4444' });
  expect(screen.queryByRole('button', { name: '승인 및 반영' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '등록 전 미리보기' }));
  fireEvent.click(screen.getByRole('button', { name: '확인 후 승인 요청' }));
  await waitFor(() => expect(service.submit).toHaveBeenCalledWith(expect.objectContaining({ teamId: 'team-a', chargeToTeamId: 'team-b', amount: 25000, receiptIds: [expect.any(String)] })));
  expect(service.upload).toHaveBeenCalledTimes(1);
  expect(await screen.findByText(/승인을 요청했습니다/)).toBeInTheDocument();
});
test('영수증 업로드 실패 시 제출하지 않으며 같은 요청 ID로 재시도한다', async () => {
  service.upload.mockRejectedValueOnce(new Error('업로드 실패'));
  render(<TeamExpenseRequestPage />);
  await fillRequest();
  fireEvent.click(screen.getByRole('button', { name: '등록 전 미리보기' }));
  fireEvent.click(screen.getByRole('button', { name: '확인 후 승인 요청' }));
  await screen.findByText('업로드 실패');
  expect(service.submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '확인 후 승인 요청' }));
  await waitFor(() => expect(service.submit).toHaveBeenCalledTimes(1));
  expect(service.upload.mock.calls[0][0]).toBe(service.upload.mock.calls[1][0]);
});
test('권한 또는 조회 실패 시 빈 성공 화면으로 숨기지 않는다', async () => {
  service.list.mockRejectedValueOnce(new Error('팀장 또는 사무실 직원만 이용할 수 있습니다.'));
  render(<TeamExpenseRequestPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('팀장 또는 사무실 직원');
  expect(screen.queryByRole('button', { name: '등록 전 미리보기' })).not.toBeInTheDocument();
});
test('사무실은 경비와 환급 반영 안내를 확인한 뒤 승인한다', async () => {
  service.list.mockResolvedValue({ ...data, canReview: true, requests: [request] });
  render(<TeamExpenseRequestPage />);
  fireEvent.click(await screen.findByRole('button', { name: '승인 및 반영' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('사용팀 A팀청구팀 A팀');
  expect(screen.getByRole('dialog')).toHaveTextContent('청구팀에서 경비를 차감하고 사용팀에 선지급금을 환급');
  fireEvent.click(screen.getByRole('button', { name: '승인 확정' }));
  await waitFor(() => expect(service.review).toHaveBeenCalledWith('request-a', 'approved', ''));
});

test('파일을 드래그해서 추가하고 촬영 파일과 함께 제출하며 첨부 취소를 반영한다', async () => {
  render(<TeamExpenseRequestPage />);
  await fillRequest();
  const drop = screen.getByRole('group', { name: '영수증 등록' });
  const dragged = new File(['pdf'], '드래그.pdf', { type: 'application/pdf' });
  fireEvent.dragEnter(drop, { dataTransfer: { types: ['Files'] } });
  expect(drop).toHaveClass('dragging');
  fireEvent.drop(drop, { dataTransfer: { files: [dragged] } });
  expect(drop).not.toHaveClass('dragging');
  expect(await screen.findByText('드래그.pdf')).toBeInTheDocument();
  const captured = new File(['photo'], '촬영.jpg', { type: 'image/jpeg' });
  expect(screen.getByLabelText('촬영한 영수증 첨부')).toHaveAttribute('capture', 'environment');
  fireEvent.change(screen.getByLabelText('촬영한 영수증 첨부'), { target: { files: [captured] } });
  await screen.findByText('촬영.jpg');
  fireEvent.click(screen.getByRole('button', { name: '영수증.png 첨부 취소' }));
  fireEvent.click(screen.getByRole('button', { name: '등록 전 미리보기' }));
  fireEvent.click(screen.getByRole('button', { name: '확인 후 승인 요청' }));
  await waitFor(() => expect(service.submit).toHaveBeenCalledTimes(1));
  expect(service.upload.mock.calls.map(call => call[3])).toEqual([dragged, captured]);
});

test('소속팀이 없으면 다른 팀이 목록에 있어도 경비를 제출할 수 없다', async () => {
  service.list.mockResolvedValue({ ...data, payerTeams: [] });
  render(<TeamExpenseRequestPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('연결된 소속팀이 없습니다');
  const drop = screen.getByRole('group', { name: '영수증 등록' });
  fireEvent.drop(drop, { dataTransfer: { files: [new File(['image'], '입력불가.png', { type: 'image/png' })] } });
  expect(screen.queryByText('입력불가.png')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '사진 촬영' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '등록 전 미리보기' })).toBeDisabled();
});
test('반려 사유 없이는 처리하지 않고 입력한 사유를 전달한다', async () => {
  service.list.mockResolvedValue({ ...data, canReview: true, requests: [request] });
  render(<TeamExpenseRequestPage />);
  fireEvent.click(await screen.findByRole('button', { name: '반려' }));
  fireEvent.click(screen.getByRole('button', { name: '반려 확정' }));
  expect(service.review).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('처리 사유'), { target: { value: '영수증 금액 확인' } });
  fireEvent.click(screen.getByRole('button', { name: '반려 확정' }));
  await waitFor(() => expect(service.review).toHaveBeenCalledWith('request-a', 'rejected', '영수증 금액 확인'));
});

test('분석을 확인해 적용한 항목과 팀 아이콘을 최종 미리보기에서 확인하고 요청한다', async () => {
  render(<TeamExpenseRequestPage />);
  await screen.findByLabelText('청구팀');
  expect(screen.getByLabelText('A팀 팀 아이콘')).toHaveAttribute('data-icon', 'helmet-safety');
  fireEvent.change(screen.getByLabelText('청구팀'), { target: { value: 'B팀' } });
  fireEvent.click(screen.getByRole('option', { name: 'B팀' }));
  fireEvent.change(screen.getByLabelText('배정된 카드'), { target: { value: 'card:card-a' } });
  expect(screen.getByLabelText('B팀 팀 아이콘')).toHaveAttribute('data-icon', 'truck-front');
  fireEvent.change(screen.getByLabelText('사용 내용'), { target: { value: '식대 분석 테스트' } });
  fireEvent.change(screen.getByLabelText('영수증 파일 첨부'), { target: { files: [new File(['receipt'], '분석.png', { type: 'image/png' })] } });
  fireEvent.click(await screen.findByRole('button', { name: '분석.png AI 입력' }));
  await screen.findByDisplayValue('12000');
  expect(service.submit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('분석 금액 (원)'), { target: { value: '13000' } });
  fireEvent.click(screen.getByRole('button', { name: '확인 후 입력란에 적용' }));
  expect(screen.getByLabelText('금액 (원)')).toHaveValue(13000);
  fireEvent.click(screen.getByRole('button', { name: '등록 전 미리보기' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('13,000원');
  expect(screen.getByRole('dialog')).toHaveTextContent('2026-09-19');
  expect(service.upload).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '돌아가서 수정' }));
  fireEvent.change(screen.getByLabelText('금액 (원)'), { target: { value: '14000' } });
  fireEvent.click(screen.getByRole('button', { name: '등록 전 미리보기' }));
  fireEvent.click(screen.getByRole('button', { name: '확인 후 승인 요청' }));
  await waitFor(() => expect(service.submit).toHaveBeenCalledWith(expect.objectContaining({ amount: 14000, paymentMethod: '경비카드 1234', category: 'meal', date: '2026-09-19' })));
});

test('추가 조회 실패를 재시도하고 같은 신청을 중복 표시하지 않는다', async () => {
  service.list.mockResolvedValueOnce({ ...data, requests: [request], nextCursor: 'request-a' }).mockRejectedValueOnce(new Error('추가 조회 실패')).mockResolvedValueOnce({ ...data, requests: [request, { ...request, id: 'request-b', description: '다음 신청' }], nextCursor: null });
  render(<TeamExpenseRequestPage />);
  fireEvent.click(await screen.findByRole('button', { name: '다음 100건 더 보기' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('추가 조회 실패');
  fireEvent.click(screen.getByRole('button', { name: '다음 100건 더 보기' }));
  await screen.findByText('다음 신청');
  expect(screen.getAllByText('점심 식대')).toHaveLength(1);
  expect(service.list.mock.calls[2][1]).toBe('request-a');
  expect(screen.queryByRole('button', { name: '다음 100건 더 보기' })).not.toBeInTheDocument();
});


test('추가 조회에서 승인 권한이 줄면 이전 타인 경비를 제거한다', async () => {
  service.list.mockResolvedValueOnce({ ...data, canReview: true, requests: [{ ...request, ownerUid: 'other', description: '타인 경비' }], nextCursor: 'request-a' }).mockResolvedValueOnce({ ...data, canReview: false, requests: [], nextCursor: null });
  render(<TeamExpenseRequestPage />);
  await screen.findByText('타인 경비');
  fireEvent.click(screen.getByRole('button', { name: '다음 100건 더 보기' }));
  await waitFor(() => expect(screen.queryByText('타인 경비')).not.toBeInTheDocument());
});

test('새로고침은 새 요청을 보내고 승인 권한이 줄면 열려 있던 승인 창을 닫는다', async () => {
  service.list.mockResolvedValueOnce({ ...data, canReview: true, requests: [request] }).mockResolvedValueOnce(data);
  render(<TeamExpenseRequestPage />);
  fireEvent.click(await screen.findByRole('button', { name: '승인 및 반영' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(service.list).toHaveBeenLastCalledWith(expect.any(String), undefined, { forceReload: true });
  expect(screen.queryByText('점심 식대')).not.toBeInTheDocument();
});

test('월을 빠르게 변경하면 늦게 도착한 이전 월 내역이 현재 월을 덮어쓰지 않는다', async () => {
  let finishPrevious!: (value: any) => void;
  service.list.mockResolvedValueOnce(data)
    .mockReturnValueOnce(new Promise(resolve => { finishPrevious = resolve; }))
    .mockResolvedValueOnce({ ...data, requests: [{ ...request, id: 'new-month', description: '현재 월 경비' }] });
  render(<TeamExpenseRequestPage />);
  const month = await screen.findByLabelText('조회 월');
  fireEvent.change(month, { target: { value: '2026-07' } });
  fireEvent.change(month, { target: { value: '2026-08' } });
  await screen.findByText('현재 월 경비');
  await act(async () => { finishPrevious({ ...data, requests: [{ ...request, description: '이전 월 경비' }] }); });
  expect(screen.queryByText('이전 월 경비')).not.toBeInTheDocument();
  expect(screen.getByText('현재 월 경비')).toBeInTheDocument();
});

test('계정 전환 후 늦게 도착한 이전 계정의 신청을 표시하지 않는다', async () => {
  let finishPrevious!: (value: any) => void;
  service.list.mockReturnValueOnce(new Promise(resolve => { finishPrevious = resolve; }))
    .mockResolvedValueOnce({ ...data, requests: [{ ...request, id: 'new-user', description: '현재 계정 경비' }] });
  const { rerender } = render(<TeamExpenseRequestPage />);
  mockCurrentUser = { uid: 'other-leader' };
  rerender(<TeamExpenseRequestPage />);
  await screen.findByText('현재 계정 경비');
  await act(async () => { finishPrevious({ ...data, requests: [{ ...request, description: '이전 계정 경비' }] }); });
  expect(screen.queryByText('이전 계정 경비')).not.toBeInTheDocument();
  expect(screen.getByText('현재 계정 경비')).toBeInTheDocument();
});

test('첫 조회 중에는 신청 요약을 0건으로 확정하지 않고 준비 상태를 표시한다', async () => {
  let finishLoading!: (value: typeof data) => void;
  service.list.mockReturnValueOnce(new Promise(resolve => { finishLoading = resolve; }));
  render(<TeamExpenseRequestPage />);
  expect(screen.getByRole('status')).toHaveTextContent('경비 신청을 불러오는 중입니다.');
  expect(screen.getByLabelText('경비 신청 요약')).toHaveAttribute('aria-busy', 'true');
  expect(within(screen.getByLabelText('경비 신청 요약')).getAllByRole('definition').map(item => item.textContent)).toEqual(['—건', '—건', '—건', '—건']);
  expect(screen.queryByLabelText('청구팀')).not.toBeInTheDocument();
  expect(service.analyze).not.toHaveBeenCalled();
  await act(async () => { finishLoading(data); });
  expect(screen.queryByText('경비 신청을 불러오는 중입니다.')).not.toBeInTheDocument();
  expect(screen.getByLabelText('청구팀')).toBeInTheDocument();
});

test('요약은 불러온 신청의 상태와 대기 금액을 집계하고 목록 필터와 구분한다', async () => {
  service.list.mockResolvedValueOnce({ ...data, canReview: true, requests: [
    request,
    { ...request, id: 'approved-request', status: 'approved', amount: 90000, description: '승인된 경비' },
    { ...request, id: 'rejected-request', status: 'rejected', amount: 80000, description: '반려된 경비' },
  ] });
  render(<TeamExpenseRequestPage />);
  await screen.findByText('승인된 경비');
  const summary = screen.getByLabelText('경비 신청 요약');
  expect(within(summary).getAllByRole('definition').map(item => item.textContent)).toEqual(['3건', '1건', '1건', '1건']);
  expect(summary).toHaveTextContent('25,000원');
  fireEvent.change(screen.getByLabelText('상태'), { target: { value: 'rejected' } });
  expect(screen.queryByText('승인된 경비')).not.toBeInTheDocument();
  expect(screen.getByText('반려된 경비')).toBeInTheDocument();
  expect(within(summary).getAllByRole('definition')[0]).toHaveTextContent('3건');
  expect(within(screen.getByRole('main')).getByRole('region', { name: '미제출 첨부 정리' })).toBeInTheDocument();
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const uploaded = { receipt: { id: 'receipt', name: 'receipt.png', fullPath: 'test/receipt' } };
const confirmRequest = () => {
  fireEvent.click(screen.getByRole('button', { name: '등록 전 미리보기' }));
  fireEvent.click(screen.getByRole('button', { name: '확인 후 승인 요청' }));
};

test('첨부만 하면 AI 대기 없이 직접 입력하고 등록할 수 있다', async () => {
  render(<TeamExpenseRequestPage />);
  await fillRequest();
  expect(service.analyze).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByLabelText('금액 (원)')).toBeEnabled();
  confirmRequest();
  await waitFor(() => expect(service.submit).toHaveBeenCalledTimes(1));
});

test('영수증은 최대 두 개씩 업로드하고 모두 완료된 뒤에만 제출한다', async () => {
  const first = deferred<typeof uploaded>(), second = deferred<typeof uploaded>(), third = deferred<typeof uploaded>();
  service.upload.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockReturnValueOnce(third.promise);
  render(<TeamExpenseRequestPage />);
  await fillRequest();
  fireEvent.change(screen.getByLabelText('영수증 파일 첨부'), { target: { files: [new File(['2'], '둘.png', { type: 'image/png' }), new File(['3'], '셋.png', { type: 'image/png' })] } });
  await screen.findByText('셋.png');
  confirmRequest();
  expect(service.upload).toHaveBeenCalledTimes(2);
  expect(service.submit).not.toHaveBeenCalled();
  await act(async () => { first.resolve(uploaded); });
  expect(service.upload).toHaveBeenCalledTimes(2);
  await act(async () => { second.resolve(uploaded); });
  expect(service.upload).toHaveBeenCalledTimes(3);
  expect(service.submit).not.toHaveBeenCalled();
  await act(async () => { third.resolve(uploaded); });
  expect(service.submit).toHaveBeenCalledTimes(1);
});

test('일부 업로드 실패 시 나머지 종료까지 잠금을 유지하고 실패한 파일만 재시도한다', async () => {
  const first = deferred<typeof uploaded>(), second = deferred<typeof uploaded>();
  service.upload.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  render(<TeamExpenseRequestPage />);
  await fillRequest();
  fireEvent.change(screen.getByLabelText('영수증 파일 첨부'), { target: { files: [new File(['2'], '둘.png', { type: 'image/png' })] } });
  await screen.findByText('둘.png');
  confirmRequest();
  await act(async () => { first.reject(new Error('첫 파일 실패')); });
  expect(screen.getByRole('button', { name: '돌아가서 수정' })).toBeDisabled();
  expect(service.submit).not.toHaveBeenCalled();
  await act(async () => { second.resolve(uploaded); });
  await screen.findByText('첫 파일 실패');
  fireEvent.click(screen.getByRole('button', { name: '확인 후 승인 요청' }));
  await waitFor(() => expect(service.submit).toHaveBeenCalledTimes(1));
  expect(service.upload).toHaveBeenCalledTimes(3);
  expect(service.upload.mock.calls[2]).toEqual(service.upload.mock.calls[0]);
});

test('제출 응답 유실 후 같은 요청을 재시도할 때 성공한 첨부를 다시 보내지 않는다', async () => {
  service.submit.mockRejectedValueOnce(new Error('응답 연결 끊김'));
  render(<TeamExpenseRequestPage />);
  await fillRequest();
  confirmRequest();
  await screen.findByText('응답 연결 끊김');
  fireEvent.click(screen.getByRole('button', { name: '확인 후 승인 요청' }));
  await screen.findByText(/승인을 요청했습니다/);
  expect(service.submit).toHaveBeenCalledTimes(2);
  expect(service.submit.mock.calls[1]).toEqual(service.submit.mock.calls[0]);
  expect(service.upload).toHaveBeenCalledTimes(1);
});

test('성공 후 조회가 지연되거나 실패해도 다음 입력과 선택값을 유지한다', async () => {
  const refresh = deferred<typeof data>();
  service.list.mockResolvedValueOnce(data).mockReturnValueOnce(refresh.promise);
  render(<TeamExpenseRequestPage />);
  await fillRequest();
  fireEvent.change(screen.getByLabelText('배정된 카드'), { target: { value: 'card:card-a' } });
  confirmRequest();
  await screen.findByText(/승인을 요청했습니다/);
  expect(screen.getByLabelText('금액 (원)')).toBeEnabled();
  expect(screen.getByLabelText('청구팀')).toHaveValue('B팀');
  expect(screen.getByLabelText('배정된 카드')).toHaveValue('card:card-a');
  fireEvent.change(screen.getByLabelText('사용 내용'), { target: { value: '다음 경비' } });
  fireEvent.change(screen.getByLabelText('금액 (원)'), { target: { value: '8000' } });
  await act(async () => { refresh.reject(new Error('연결 시간 초과')); });
  expect(screen.getByRole('alert')).toHaveTextContent('승인 요청은 접수되었습니다');
  expect(screen.getByLabelText('사용 내용')).toHaveValue('다음 경비');
  expect(screen.getByLabelText('금액 (원)')).toHaveValue(8000);
});

test('배경 조회에서 권한이 거부되면 기존 권한 화면을 지운다', async () => {
  service.list.mockResolvedValueOnce(data).mockRejectedValueOnce(Object.assign(new Error('권한 없음'), { code: 'functions/permission-denied' }));
  render(<TeamExpenseRequestPage />);
  await fillRequest();
  confirmRequest();
  await screen.findByText(/승인 요청은 접수되었습니다/);
  expect(screen.queryByLabelText('청구팀')).not.toBeInTheDocument();
});

test('업로드 중 계정이 바뀌면 이전 계정의 경비를 제출하지 않는다', async () => {
  const upload = deferred<typeof uploaded>();
  service.upload.mockReturnValueOnce(upload.promise);
  const { rerender } = render(<TeamExpenseRequestPage />);
  await fillRequest();
  confirmRequest();
  mockCurrentUser = { uid: 'another-leader' };
  rerender(<TeamExpenseRequestPage />);
  await act(async () => { upload.resolve(uploaded); });
  expect(service.submit).not.toHaveBeenCalled();
  expect(screen.queryByText('영수증.png')).not.toBeInTheDocument();
});

test('다른 월 경비를 등록하면 해당 월을 배경 조회하면서 다음 입력을 허용한다', async () => {
  const refresh = deferred<typeof data>();
  service.list.mockResolvedValueOnce(data).mockReturnValueOnce(refresh.promise);
  render(<TeamExpenseRequestPage />);
  await fillRequest();
  fireEvent.change(screen.getByLabelText('사용일'), { target: { value: '2025-02-15' } });
  confirmRequest();
  await screen.findByText(/승인을 요청했습니다/);
  expect(screen.getByLabelText('조회 월')).toHaveValue('2025-02');
  expect(service.list).toHaveBeenLastCalledWith('2025-02', undefined, { forceReload: true });
  expect(screen.getByLabelText('금액 (원)')).toBeEnabled();
  fireEvent.change(screen.getByLabelText('사용 내용'), { target: { value: '다음 경비' } });
  await act(async () => { refresh.resolve(data); });
  expect(screen.getByLabelText('사용 내용')).toHaveValue('다음 경비');
});

test('첫 사진 준비 중에는 저장과 중복 첨부를 막고 이탈을 경고한다', async () => {
  const prepared = deferred<File>();
  const prepare = jest.spyOn(preparation, 'prepareExpenseReceipt').mockReturnValueOnce(prepared.promise);
  try {
    render(<TeamExpenseRequestPage />);
    await screen.findByLabelText('청구팀');
    const file = new File(['photo'], '사진.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('영수증 파일 첨부'), { target: { files: [file] } });
    expect(screen.getByRole('button', { name: '등록 전 미리보기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '파일 첨부' })).toBeDisabled();
    expect(screen.getByLabelText('금액 (원)')).toBeEnabled();
    const beforeUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);
    await act(async () => { prepared.resolve(file); });
    expect(screen.getByText('사진.jpg')).toBeInTheDocument();
    expect(service.analyze).not.toHaveBeenCalled();
  } finally { prepare.mockRestore(); }
});

test('다른 월 제출 후 조회가 실패해도 이전 월 내역을 새 월 내역으로 표시하지 않는다', async () => {
  const refresh = deferred<typeof data>();
  service.list.mockResolvedValueOnce({ ...data, requests: [{ ...request, description: '이전 조회 월 경비' }] }).mockReturnValueOnce(refresh.promise);
  render(<TeamExpenseRequestPage />);
  await fillRequest();
  expect(screen.getByText('이전 조회 월 경비')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('사용일'), { target: { value: '2025-02-15' } });
  confirmRequest();
  await screen.findByText(/승인을 요청했습니다/);
  expect(screen.getByLabelText('조회 월')).toHaveValue('2025-02');
  expect(screen.queryByText('이전 조회 월 경비')).not.toBeInTheDocument();
  await act(async () => { refresh.reject(new Error('다른 월 조회 실패')); });
  expect(screen.queryByText('이전 조회 월 경비')).not.toBeInTheDocument();
  expect(screen.getByLabelText('금액 (원)')).toBeEnabled();
  expect(within(screen.getByLabelText('경비 신청 요약')).getAllByRole('definition')[0]).toHaveTextContent('0건');
});
