import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AccountOnboardingGate } from './ProtectedRouteShell';
import { accountLinkService } from '../services/accountLinkService';

let mockSnapshot: (snapshot: any) => Promise<void>;
let mockError: () => void;
const mockToken = jest.fn();
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'qa-worker', getIdToken: mockToken } }) }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), onSnapshot: (_: unknown, next: any, error: any) => { mockSnapshot = next; mockError = error; return jest.fn(); } }));
jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('../services/accountLinkService', () => ({ accountLinkService: { getMyStatus: jest.fn() } }));
jest.mock('../services/teamScopedReadService', () => ({ invalidateTeamScopedCache: jest.fn() }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
jest.mock('../routes/TeamWorkflowGate', () => ({ children }: { children: React.ReactNode }) => <>{children}</>);
jest.mock('../contexts/MasterDataContext', () => ({ MasterDataProvider: () => null }));
jest.mock('../hooks/useWorkerTeamIdMigration', () => ({ useWorkerTeamIdMigration: () => ({ status: 'done' }) }));
jest.mock('../components/layout/DashboardLayout', () => () => null);
jest.mock('../components/auth/ProfileSetup', () => () => <p>가입 설정</p>);
jest.mock('../components/auth/AccountApprovalStatus', () => ({ profile }: any) => <p>{profile.status} 승인 상태</p>);
jest.mock('../components/common/AppIntroScreen', () => () => <p>계정 확인 중</p>);
const profile = (status: string) => ({ exists: () => true, id: 'qa-worker', data: () => ({ status, accountType: 'worker', position: '일반', requestedAccountType: 'worker' }) });
const mount = () => render(<AccountOnboardingGate><p>업무 화면</p></AccountOnboardingGate>);
beforeEach(() => {
    jest.clearAllMocks(); mockToken.mockResolvedValue('synthetic-token');
    (accountLinkService.getMyStatus as jest.Mock).mockResolvedValue({ user: { status: 'active' } });
});

test('승인 대기에서 활성 상태로 바뀌면 서버 권한 갱신 후 즉시 업무 화면으로 이동하고 재접속해도 유지한다', async () => {
    const view = mount();
    await act(() => mockSnapshot(profile('pending')));
    expect(screen.getByText('pending 승인 상태')).toBeInTheDocument();
    await act(() => mockSnapshot(profile('active')));
    expect(accountLinkService.getMyStatus).toHaveBeenCalledWith({ refreshAccessClaims: true });
    expect(mockToken).toHaveBeenCalledWith(true);
    expect(screen.getByText('업무 화면')).toBeInTheDocument();
    view.unmount(); mount();
    await act(() => mockSnapshot(profile('active')));
    expect(screen.getByText('업무 화면')).toBeInTheDocument();
    expect(screen.queryByText('가입 설정')).not.toBeInTheDocument();
});

test('활성 상태 권한 갱신보다 나중에 도착한 정지 상태를 우선한다', async () => {
    let resolve!: (value: unknown) => void;
    (accountLinkService.getMyStatus as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
    mount(); let pending!: Promise<void>;
    act(() => { pending = mockSnapshot(profile('active')); });
    await act(() => mockSnapshot(profile('suspended')));
    await act(async () => { resolve({ user: { status: 'active' } }); await pending; });
    expect(screen.getByText('suspended 승인 상태')).toBeInTheDocument();
    expect(screen.queryByText('업무 화면')).not.toBeInTheDocument();
});

test('조회 또는 토큰 갱신 실패는 재승인/가입 화면으로 보내지 않고 재시도한다', async () => {
    mount(); act(() => mockError());
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('가입 설정')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 확인' }));
    mockToken.mockRejectedValueOnce(new Error('offline'));
    await act(() => mockSnapshot(profile('active')));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 확인' }));
    await act(() => mockSnapshot(profile('active')));
    expect(screen.getByText('업무 화면')).toBeInTheDocument();
});

test('활성 계정의 다른 창 로그인이나 표시 정보 갱신은 입력 중인 업무 화면을 초기화하지 않는다', async () => {
    const Draft = () => { const [text, setText] = React.useState(''); return <input aria-label="작성 중 메모" value={text} onChange={event => setText(event.target.value)} />; };
    render(<AccountOnboardingGate><Draft /></AccountOnboardingGate>);
    await act(() => mockSnapshot(profile('active')));
    fireEvent.change(screen.getByLabelText('작성 중 메모'), { target: { value: '저장 전 업무 내용' } });
    let resolve!: (value: unknown) => void;
    (accountLinkService.getMyStatus as jest.Mock).mockReturnValueOnce(new Promise(done => { resolve = done; }));
    let pending!: Promise<void>;
    act(() => { pending = mockSnapshot(profile('active')); });
    expect(screen.getByLabelText('작성 중 메모')).toHaveValue('저장 전 업무 내용');
    await act(async () => { resolve({ user: { status: 'active' } }); await pending; });
    expect(screen.getByLabelText('작성 중 메모')).toHaveValue('저장 전 업무 내용');
});
