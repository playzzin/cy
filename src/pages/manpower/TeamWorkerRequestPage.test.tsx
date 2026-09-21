import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TeamWorkerRequestPage from './TeamWorkerRequestPage';
import { teamWorkerRequestService } from '../../services/teamWorkerRequestService';
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'leader' } }) }));
jest.mock('../../services/teamWorkerRequestService', () => ({ teamWorkerRequestService: { list: jest.fn(), upload: jest.fn(), submit: jest.fn(), analyze: jest.fn(), review: jest.fn(), document: jest.fn() }, validateWorkerDocument: jest.fn() }));
const service = teamWorkerRequestService as jest.Mocked<typeof teamWorkerRequestService>;
const team = { id: 'team-a', name: 'A팀', color: '#ef4444', icon: 'fa-helmet-safety' };
const data = { canReview: false, teams: [team], company: { id: 'company-dynamic', name: '㈜청연이엔지' }, requests: [] };
const identity = new File(['test'], '신분증.png', { type: 'image/png' });
beforeEach(() => {
  jest.clearAllMocks(); URL.createObjectURL = jest.fn(() => 'blob:test-document'); URL.revokeObjectURL = jest.fn();
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: () => `test-${Math.random()}` } });
  service.list.mockResolvedValue(data); service.upload.mockResolvedValue({}); service.submit.mockResolvedValue({ id: 'request', status: 'pending' }); service.review.mockResolvedValue({});
  service.analyze.mockImplementation(async (_team, kind) => kind === 'identity' ? { fields: { name: '테스트 작업자', address: '테스트 주소', contact: '' }, warnings: ['연락처를 직접 입력해 주세요.'] } : { fields: { bankName: '테스트은행', accountNumber: '001234567890', accountHolder: '테스트 작업자' }, warnings: [] });
});
const fill = async () => {
  await screen.findByText('㈜청연이엔지');
  fireEvent.change(screen.getByLabelText('신분증 파일'), { target: { files: [identity] } });
  await screen.findByDisplayValue('테스트 작업자');
  fireEvent.change(screen.getByLabelText('연락처 *'), { target: { value: '01000000000' } });
};
test('현재 소속팀과 회사로 신청하며 분석 결과를 수정하고 미리보기 확인 전에는 업로드하지 않는다', async () => {
  render(<TeamWorkerRequestPage />); await fill();
  expect(screen.getByText('A팀')).toHaveStyle({ borderColor: '#ef4444' });
  expect(screen.getByText('연락처를 직접 입력해 주세요.')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('주소 *'), { target: { value: '수정한 테스트 주소' } });
  fireEvent.click(screen.getByRole('button', { name: '등록 전 미리보기' }));
  expect(service.upload).not.toHaveBeenCalled();
  expect(within(screen.getByRole('dialog')).getByText('수정한 테스트 주소')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '확인 후 승인 요청' }));
  await waitFor(() => expect(service.submit).toHaveBeenCalledWith(expect.any(String), 'team-a', expect.objectContaining({ contact: '01000000000', address: '수정한 테스트 주소' }), expect.any(String), undefined));
  expect(await screen.findByText(/승인을 요청했습니다/)).toBeInTheDocument();
});
test('통장을 드래그하여 분석하고 계좌번호 앞자리 0을 보존한다', async () => {
  render(<TeamWorkerRequestPage />); await fill();
  expect(screen.getByLabelText('신분증 촬영 파일')).toHaveAttribute('capture', 'environment');
  fireEvent.drop(screen.getByRole('region', { name: '통장 첨부' }), { dataTransfer: { files: [new File(['test'], '통장.png', { type: 'image/png' })] } });
  await screen.findByDisplayValue('001234567890');
  fireEvent.click(screen.getByRole('button', { name: '등록 전 미리보기' })); fireEvent.click(screen.getByRole('button', { name: '확인 후 승인 요청' }));
  await waitFor(() => expect(service.submit).toHaveBeenCalledTimes(1));
  expect(service.upload).toHaveBeenCalledTimes(2);
  expect(service.submit.mock.calls[0][2].accountNumber).toBe('001234567890');
});
test('분석 실패 후 직접 입력할 수 있고 제출 실패 시 동일한 요청으로 재시도한다', async () => {
  service.analyze.mockRejectedValueOnce(new Error('분석 실패')); service.upload.mockRejectedValueOnce(new Error('업로드 실패'));
  render(<TeamWorkerRequestPage />); await screen.findByText('㈜청연이엔지');
  fireEvent.change(screen.getByLabelText('신분증 파일'), { target: { files: [identity] } }); await screen.findByRole('alert');
  for (const [label, value] of [['이름 *', '수동 입력'], ['주소 *', '테스트 주소'], ['연락처 *', '01000000000']]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: '등록 전 미리보기' })); fireEvent.click(screen.getByRole('button', { name: '확인 후 승인 요청' }));
  await screen.findByText('업로드 실패'); expect(service.submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '확인 후 승인 요청' })); await waitFor(() => expect(service.submit).toHaveBeenCalledTimes(1));
  expect(service.upload.mock.calls[0][0]).toBe(service.upload.mock.calls[1][0]);
});
test('사무실이 내용을 검토하고 반려 사유 또는 승인으로 처리한다', async () => {
  const row: any = { id: 'request', ownerUid: 'other-leader', name: '테스트 작업자', address: '테스트 주소', contact: '01000000000', teamId: team.id, teamName: team.name, companyName: data.company.name, submitterName: '다른 팀장', status: 'pending', submittedAt: '2026-09-20T00:00:00Z', attachments: [] };
  service.list.mockResolvedValue({ ...data, teams: [], canReview: true, requests: [row] });
  render(<TeamWorkerRequestPage />); fireEvent.click(await screen.findByRole('button', { name: '서류 및 신청 내용 검토' }));
  fireEvent.click(screen.getByRole('button', { name: '반려' })); expect(service.review).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('반려 사유');
  fireEvent.click(screen.getByRole('button', { name: '승인 후 통합DB 등록' }));
  expect(service.review).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('승인 급여 구분'), { target: { value: '일급제' } });
  fireEvent.change(screen.getByLabelText('승인 단가 (원)'), { target: { value: '150000' } });
  fireEvent.click(screen.getByRole('button', { name: '승인 후 통합DB 등록' }));
  await waitFor(() => expect(service.review).toHaveBeenCalledWith('request', 'approved', '', { payType: '일급제', unitPrice: 150000 }));
});
test('조회 실패를 표시하고 다른 팀의 등록 폼을 노출하지 않는다', async () => {
  service.list.mockRejectedValueOnce(new Error('현재 소속팀 권한 확인 필요')); render(<TeamWorkerRequestPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('현재 소속팀'); expect(screen.queryByLabelText('신분증 파일')).not.toBeInTheDocument();
});

test('조회 월을 변경해도 작성 중인 입력은 유지한다', async () => {
  render(<TeamWorkerRequestPage />);
  await screen.findByLabelText('이름 *');
  fireEvent.change(screen.getByLabelText('이름 *'), { target: { value: '작성 중인 이름' } });
  fireEvent.change(screen.getByLabelText('조회 월'), { target: { value: '2000-01' } });
  await waitFor(() => expect(service.list).toHaveBeenLastCalledWith('2000-01'));
  expect(screen.getByLabelText('이름 *')).toHaveValue('작성 중인 이름');
});

test('최종 확인 중에는 배경 입력과 첨부를 잠근다', async () => {
  render(<TeamWorkerRequestPage />); await fill();
  fireEvent.click(screen.getByRole('button', { name: '등록 전 미리보기' }));
  expect(screen.getByLabelText('이름 *')).toBeDisabled();
  expect(screen.getByRole('button', { name: '사진 변경' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '돌아가서 수정' }));
  expect(screen.getByLabelText('이름 *')).toBeEnabled();
});

test('다음 페이지의 신규자 신청을 기존 목록에 이어서 표시한다', async () => {
  const row: any = { id: 'first', ownerUid: 'leader', name: '첫 신청', teamName: 'A팀', status: 'pending', submittedAt: '2026-09-20T00:00:00Z', attachments: [] };
  service.list.mockResolvedValueOnce({ ...data, requests: [row], nextCursor: 'first' }).mockResolvedValueOnce({ ...data, requests: [{ ...row, id: 'second', name: '다음 신청' }], nextCursor: null });
  render(<TeamWorkerRequestPage />);
  fireEvent.click(await screen.findByRole('button', { name: '다음 100건 더 보기' }));
  await screen.findByText('다음 신청');
  expect(screen.getByText('첫 신청')).toBeInTheDocument();
  expect(service.list.mock.calls[1][1]).toBe('first');
});


test('추가 조회에서 승인 권한이 줄면 이전 타인 신청을 제거한다', async () => {
  const other: any = { id: 'other', ownerUid: 'other', submittedAt: '2026-09-20T00:00:00Z', name: '타인 신청', teamName: 'A팀', status: 'pending', attachments: [] };
  service.list.mockResolvedValueOnce({ ...data, canReview: true, requests: [other], nextCursor: 'other' }).mockResolvedValueOnce({ ...data, requests: [], nextCursor: null });
  render(<TeamWorkerRequestPage />);
  await screen.findByText('타인 신청');
  fireEvent.click(screen.getByRole('button', { name: '다음 100건 더 보기' }));
  await waitFor(() => expect(screen.queryByText('타인 신청')).not.toBeInTheDocument());
});
