import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PagePrimaryAccountCard from './PagePrimaryAccountCard';
import { PagePrimaryAccountState } from '../../hooks/usePagePrimaryAccount';
import { primaryAccountService } from '../../services/primaryAccountService';
import { loadPrimaryAccountOptions } from '../../services/primaryAccountOptions';

const mockUser = { getIdTokenResult: jest.fn() };
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mockUser }) }));
jest.mock('../../services/primaryAccountService', () => ({ PRIMARY_ACCOUNT_PAGES: [{ id: 'monthly-wage', label: '월급제', path: '/payroll/monthly-wage' }], primaryAccountService: { setPrimaryAccount: jest.fn() } }));
jest.mock('../../services/primaryAccountOptions', () => ({ loadPrimaryAccountOptions: jest.fn() }));

const state: PagePrimaryAccountState = { scope: 'monthly-wage', account: null, pageAccount: null, loading: false, error: '', usesCommon: false, retry: jest.fn() };
beforeEach(() => {
    jest.clearAllMocks();
    mockUser.getIdTokenResult.mockResolvedValue({ claims: { role: 'admin' } });
    (primaryAccountService.setPrimaryAccount as jest.Mock).mockResolvedValue(undefined);
});
async function open() { fireEvent.click(await screen.findByRole('button', { name: '계좌 등록' })); }
function fill() {
    fireEvent.change(screen.getByLabelText('은행'), { target: { value: '검증은행' } });
    fireEvent.change(screen.getByLabelText('예금주'), { target: { value: '샘플' } });
    fireEvent.change(screen.getByLabelText('계좌번호'), { target: { value: '000-TEST-01' } });
}

it('페이지 안에서 입력한 계좌를 그 페이지에만 저장한다', async () => {
    render(<PagePrimaryAccountCard state={state} />); await open(); fill();
    fireEvent.click(screen.getByRole('button', { name: '대표계좌 저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(primaryAccountService.setPrimaryAccount).toHaveBeenCalledWith(expect.objectContaining({ bankName: '검증은행', accountNumber: '000-TEST-01', accountHolder: '샘플' }), 'monthly-wage');
    expect(screen.getByRole('status')).toHaveTextContent('저장했습니다');
});

it('기존 계좌를 검색하여 가져온 뒤 검토하고 저장한다', async () => {
    (loadPrimaryAccountOptions as jest.Mock).mockResolvedValue({ accounts: [{ sourceType: 'company', sourceId: 'sample', sourceName: '샘플회사', bankName: '검증은행', accountHolder: '회사', accountNumber: '000-TEST-02' }], partialFailure: false });
    render(<PagePrimaryAccountCard state={state} />); await open();
    fireEvent.click(screen.getByRole('button', { name: '등록된 계좌에서 가져오기' }));
    fireEvent.change(screen.getByLabelText('계좌 검색'), { target: { value: '샘플회사' } });
    fireEvent.click(await screen.findByRole('button', { name: /회사 · 샘플회사/ }));
    expect(screen.getByLabelText('계좌번호')).toHaveValue('000-TEST-02');
    expect(primaryAccountService.setPrimaryAccount).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '대표계좌 저장' }));
    await waitFor(() => expect(primaryAccountService.setPrimaryAccount).toHaveBeenCalledWith(expect.objectContaining({ sourceId: 'sample' }), 'monthly-wage'));
});

it('누락된 입력은 저장하지 않고 저장 실패 시 입력을 유지한다', async () => {
    (primaryAccountService.setPrimaryAccount as jest.Mock).mockRejectedValue(new Error('offline'));
    render(<PagePrimaryAccountCard state={state} />); await open();
    fireEvent.click(screen.getByRole('button', { name: '대표계좌 저장' }));
    expect(screen.getByRole('alert')).toHaveTextContent('모두 입력');
    expect(primaryAccountService.setPrimaryAccount).not.toHaveBeenCalled();
    fill(); fireEvent.click(screen.getByRole('button', { name: '대표계좌 저장' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('저장하지 못했습니다'));
    expect(screen.getByLabelText('계좌번호')).toHaveValue('000-TEST-01');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
});

it('취소는 저장하지 않으며 읽기 오류가 있을 때 새 계좌로 덮어쓰지 않는다', async () => {
    const { rerender } = render(<PagePrimaryAccountCard state={state} />); await open(); fill();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(primaryAccountService.setPrimaryAccount).not.toHaveBeenCalled();
    rerender(<PagePrimaryAccountCard state={{ ...state, error: '읽기 오류' }} />);
    expect(screen.getByRole('button', { name: '계좌 등록' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(state.retry).toHaveBeenCalled();
});

it('수정 권한이 없는 사용자는 계좌를 볼 수 있지만 등록 버튼은 보이지 않는다', async () => {
    mockUser.getIdTokenResult.mockResolvedValue({ claims: { role: 'worker' } });
    render(<PagePrimaryAccountCard state={state} />);
    await waitFor(() => expect(mockUser.getIdTokenResult).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: '계좌 등록' })).not.toBeInTheDocument();
    expect(screen.getByText(/관리자에게 요청/)).toBeInTheDocument();
});
