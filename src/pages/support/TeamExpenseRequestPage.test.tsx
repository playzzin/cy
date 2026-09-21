import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TeamExpenseRequestPage from './TeamExpenseRequestPage';
import { teamExpenseRequestService } from '../../services/teamExpenseRequestService';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'leader' } }) }));
jest.mock('../../services/teamExpenseRequestService', () => ({
  teamExpenseRequestService: { list: jest.fn(), upload: jest.fn(), submit: jest.fn(), review: jest.fn(), analyze: jest.fn() },
  validateRequestReceiptFiles: (files: File[]) => { if (!files.length) throw new Error('영수증을 첨부해 주세요.'); },
}));
const service = teamExpenseRequestService as jest.Mocked<typeof teamExpenseRequestService>;
const payer = { id: 'team-a', name: 'A팀', color: '#ef4444', icon: 'fa-helmet-safety' };
const billing = { id: 'team-b', name: 'B팀', color: '#2563eb', icon: 'fa-truck-front' };
const data = { canReview: false, payerTeams: [payer], teams: [payer, billing], categories: [{ id: 'meal', label: '식대' }], requests: [] };
const request: any = { id: 'request-a', status: 'pending', teamId: 'team-a', teamName: 'A팀', submitterName: '팀장', description: '점심 식대', amount: 25000, date: '2026-09-20', categoryLabel: '식대', paymentMethod: '현찰', attachments: [{ id: 'receipt', url: 'https://example.test/receipt.png' }] };
beforeEach(() => {
  jest.clearAllMocks();
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
  fireEvent.change(screen.getByLabelText('청구팀'), { target: { value: 'team-b' } });
  fireEvent.change(screen.getByLabelText('금액 (원)'), { target: { value: '25000' } });
  fireEvent.change(screen.getByLabelText('사용 내용'), { target: { value: '점심 식대' } });
  fireEvent.change(screen.getByLabelText('영수증 파일 첨부'), { target: { files: [new File(['receipt'], '영수증.png', { type: 'image/png' })] } });
  await screen.findByDisplayValue('12000');
  fireEvent.click(screen.getByRole('button', { name: '적용하지 않고 닫기' }));
};
test('현재 소속팀을 사용팀으로 표시하고 별도 청구팀과 영수증을 제출한다', async () => {
  render(<TeamExpenseRequestPage />);
  await fillRequest();
  expect(screen.getByLabelText('현재 소속팀')).toHaveTextContent('A팀');
  expect(screen.queryByRole('combobox', { name: '사용팀 (현재 소속)' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('청구팀')).toHaveValue('team-b');
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
  expect(screen.getByText('드래그.pdf')).toBeInTheDocument();
  const captured = new File(['photo'], '촬영.jpg', { type: 'image/jpeg' });
  expect(screen.getByLabelText('촬영한 영수증 첨부')).toHaveAttribute('capture', 'environment');
  fireEvent.change(screen.getByLabelText('촬영한 영수증 첨부'), { target: { files: [captured] } });
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
  fireEvent.change(screen.getByLabelText('청구팀'), { target: { value: 'team-b' } });
  expect(screen.getByLabelText('B팀 팀 아이콘')).toHaveAttribute('data-icon', 'truck-front');
  fireEvent.change(screen.getByLabelText('사용 내용'), { target: { value: '식대 분석 테스트' } });
  fireEvent.change(screen.getByLabelText('영수증 파일 첨부'), { target: { files: [new File(['receipt'], '분석.png', { type: 'image/png' })] } });
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
  await waitFor(() => expect(service.submit).toHaveBeenCalledWith(expect.objectContaining({ amount: 14000, paymentMethod: '개인카드', category: 'meal', date: '2026-09-19' })));
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
