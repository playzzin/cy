import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AccountOnboardingGate } from './ProtectedRouteShell';
import { accountLinkService } from '../services/accountLinkService';
import { WorkerFormEntryContext, type WorkerFormEntry } from '../contexts/WorkerFormEntryContext';

let mockSnapshot: (snapshot: any) => Promise<void>;
let mockError: () => void;
const mockToken = jest.fn();
const mockTokenResult = jest.fn();
const mockWorker = { uid: 'qa-worker', getIdToken: mockToken, getIdTokenResult: mockTokenResult };
const mockFormList = jest.fn();
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mockWorker }) }));
jest.mock('../services/teamWorkerRequestService', () => ({ teamWorkerRequestService: { list: (...args: unknown[]) => mockFormList(...args) } }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), onSnapshot: (_: unknown, _options: unknown, next: any, error: any) => { mockSnapshot = next; mockError = error; return jest.fn(); } }));
jest.mock('../config/firebase', () => ({ db: {}, auth: { get currentUser() { return mockWorker; } } }));
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
const profile = (status: string) => ({
    exists: () => true, id: 'qa-worker', metadata: { fromCache: false, hasPendingWrites: false },
    data: () => ({ status, accountType: 'worker', position: '일반', requestedAccountType: 'worker', linkedWorkerIds: ['linked-worker'] }),
});
const workerClaims = {
    accessClaimsVersion: 1, accountType: 'worker', role: 'user', position: '일반',
    roles: ['user', 'worker', '일반'], additionalPositions: [], erpRoleGroups: ['user'],
};
const mount = () => render(<AccountOnboardingGate><p>업무 화면</p></AccountOnboardingGate>);
test('모바일 팀장 등록 조회를 권한 확인과 겹쳐 시작하고 확인 실패 시 결과를 폐기한다', async () => {
    const media = window.matchMedia;
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    const entry: WorkerFormEntry = {};
    let reject!: (error: Error) => void;
    (accountLinkService.getMyStatus as jest.Mock).mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    mockFormList.mockResolvedValue({ canReview: false, historyLoaded: false });
    try {
        render(<WorkerFormEntryContext.Provider value={entry}><AccountOnboardingGate><p>업무 화면</p></AccountOnboardingGate></WorkerFormEntryContext.Provider>);
        const active = profile('active');
        const leader = { ...active, data: () => ({ ...active.data(), position: '팀장' }) };
        await act(() => mockSnapshot({ ...leader, metadata: { fromCache: true, hasPendingWrites: false } }));
        expect(mockFormList).not.toHaveBeenCalled();
        let verification!: Promise<void>;
        await act(async () => { verification = mockSnapshot(leader); });
        expect(mockFormList).toHaveBeenCalledWith(expect.any(String), undefined, { formOnly: true });
        expect(entry.read).toBeDefined();
        expect(screen.queryByText('업무 화면')).not.toBeInTheDocument();
        await act(async () => { reject(new Error('denied')); await verification; });
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(entry.read).toBeUndefined();
    } finally { window.matchMedia = media; }
});
beforeEach(() => {
    jest.clearAllMocks(); mockToken.mockResolvedValue('synthetic-token');
    mockTokenResult.mockResolvedValue({ claims: {} });
    (accountLinkService.getMyStatus as jest.Mock).mockResolvedValue({ user: { status: 'active' } });
});

test('승인 대기에서 활성 상태로 바뀌면 서버 권한 갱신 후 즉시 업무 화면으로 이동하고 재접속해도 유지한다', async () => {
    mockTokenResult.mockResolvedValue({ claims: workerClaims });
    const view = mount();
    await act(() => mockSnapshot(profile('pending')));
    expect(screen.getByText('pending 승인 상태')).toBeInTheDocument();
    await act(() => mockSnapshot(profile('active')));
    expect(accountLinkService.getMyStatus).toHaveBeenCalledWith({ refreshAccessClaims: true });
    expect(mockToken).toHaveBeenCalledWith(true);
    expect(screen.getByText('업무 화면')).toBeInTheDocument();
    view.unmount(); mount();
    await act(() => mockSnapshot(profile('active')));
    expect(accountLinkService.getMyStatus).toHaveBeenCalledTimes(1);
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

test('같은 활성 프로필에서 로그인 시각과 수정 시각만 바뀌면 권한 확인을 공유한다', async () => {
    let resolve!: (value: unknown) => void;
    const status = accountLinkService.getMyStatus as jest.Mock;
    status.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    mount();
    const active = profile('active');
    await act(async () => {
        void mockSnapshot(active);
        void mockSnapshot({ ...active, data: () => ({ ...active.data(), lastLogin: 'updated', updatedAt: 'updated' }) });
    });
    expect(status).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('업무 화면')).not.toBeInTheDocument();
    await act(async () => resolve({ user: { status: 'active' } }));
    expect(mockToken).toHaveBeenCalledTimes(1);
    expect(screen.getByText('업무 화면')).toBeInTheDocument();
    await act(() => mockSnapshot({ ...active, data: () => ({ ...active.data(), lastLogin: 'later', updatedAt: 'later' }) }));
    expect(status).toHaveBeenCalledTimes(1);
    expect(mockToken).toHaveBeenCalledTimes(1);
});

test('서버 확인을 받은 활성 작업자의 기존 권한을 재사용하고 실제 직책 변경은 다시 확인한다', async () => {
    mockTokenResult.mockResolvedValue({ claims: workerClaims });
    const active = profile('active');
    mount();
    await act(() => mockSnapshot({ ...active, metadata: { fromCache: true, hasPendingWrites: false } }));
    await act(() => mockSnapshot({ ...active, metadata: { fromCache: false, hasPendingWrites: true } }));
    expect(screen.queryByText('업무 화면')).not.toBeInTheDocument();
    expect(mockTokenResult).not.toHaveBeenCalled();
    await act(() => mockSnapshot(active));
    expect(screen.getByText('업무 화면')).toBeInTheDocument();
    expect(accountLinkService.getMyStatus).not.toHaveBeenCalled();
    expect(mockToken).not.toHaveBeenCalled();
    await act(() => mockSnapshot({ ...active, data: () => ({ ...active.data(), position: '팀장' }) }));
    expect(accountLinkService.getMyStatus).toHaveBeenCalledTimes(1);
    expect(mockToken).toHaveBeenCalledWith(true);
    await act(() => mockSnapshot(profile('suspended')));
    expect(screen.queryByText('업무 화면')).not.toBeInTheDocument();
    expect(screen.getByText('suspended 승인 상태')).toBeInTheDocument();
});

test.each([
    { ...workerClaims, roles: ['user', 'admin'] },
    { ...workerClaims, erpRoleGroups: ['user', 'finance'] },
    { ...workerClaims, additionalPositions: ['매니저'] },
    { ...workerClaims, roles: ['user', 'worker', '팀장'] },
    { ...workerClaims, position: '팀장' },
])('기존 토큰의 권한을 그대로 사용할 조건이 맞지 않으면 서버에서 갱신한다 (%j)', async claims => {
    mockTokenResult.mockResolvedValue({ claims });
    mount();
    await act(() => mockSnapshot(profile('active')));
    expect(accountLinkService.getMyStatus).toHaveBeenCalledTimes(1);
    expect(mockToken).toHaveBeenCalledWith(true);
    expect(screen.getByText('업무 화면')).toBeInTheDocument();
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
    const active = profile('active');
    await act(() => mockSnapshot({ ...active, data: () => ({ ...active.data(), displayName: '검증 이름', updatedAt: 'now' }) }));
    expect(screen.getByLabelText('작성 중 메모')).toHaveValue('저장 전 업무 내용');
    expect(accountLinkService.getMyStatus).toHaveBeenCalledTimes(1);
});
