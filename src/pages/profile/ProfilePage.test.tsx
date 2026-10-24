import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import ProfilePage from './ProfilePage';
import { userService } from '../../services/userService';
import { profileConnectionService } from '../../services/profileConnectionService';
import { formatDateLike, profileStatus } from './profilePresentation';

let mockCurrentUser: any = { uid: 'test-user', metadata: { creationTime: '2024-01-02T00:00:00Z' }, email: 'test@example.test' };
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mockCurrentUser }) }));
jest.mock('../../services/userService', () => ({ userService: { getUser: jest.fn(), updateUserProfile: jest.fn() } }));
jest.mock('../../services/profileConnectionService', () => ({ profileConnectionService: { load: jest.fn() } }));
jest.mock('../../components/manpower/AccountLinkingModal', () => () => <div>관리자 연결 화면</div>);
const user = { uid: 'test-user', displayName: '테스트 사용자', phoneNumber: '010-0000-1234', email: 'test@example.test', role: 'user', position: '작업자', accountType: 'worker', status: 'active', lastLogin: { toDate: () => new Date('2026-09-01T00:00:00Z') } };
const emptyConnections = { workers: [], officeStaff: [], links: [], unavailable: [] };
const getUser = userService.getUser as jest.Mock;
const save = userService.updateUserProfile as jest.Mock;
const loadConnections = profileConnectionService.load as jest.Mock;
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
const view = () => <MemoryRouter initialEntries={['/profile']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Link to="/elsewhere">다른 화면</Link><Routes><Route path="/profile" element={<ProfilePage />} /><Route path="/elsewhere" element={<p>이동 완료</p>} /></Routes></MemoryRouter>;
const open = async () => { const utils = render(view()); await screen.findByRole('button', { name: '편집' }); return utils; };
const edit = () => fireEvent.click(screen.getByRole('button', { name: '편집' }));

beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = { uid: 'test-user', metadata: { creationTime: '2024-01-02T00:00:00Z' }, email: 'test@example.test' };
    getUser.mockResolvedValue(user); save.mockResolvedValue(undefined); loadConnections.mockResolvedValue(emptyConnections);
    jest.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => jest.restoreAllMocks());

it('연결 조회가 실패해도 기본 정보를 표시하고 편집할 수 있다', async () => {
    loadConnections.mockRejectedValue(new Error('permission-denied'));
    await open(); edit();
    expect(screen.getByRole('textbox', { name: /이름/ })).toHaveValue(user.displayName);
    expect(screen.queryByRole('textbox', { name: '직책' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    fireEvent.click(screen.getByRole('tab', { name: '소속·연결' }));
    expect(await screen.findByText('일부 정보를 확인하지 못했습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '계정 연동' })).not.toBeInTheDocument();
});

it('이름과 연락처만 저장하며 중복 제출을 막는다', async () => {
    const pending = deferred<void>(); save.mockReturnValue(pending.promise);
    await open(); edit();
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: /이름/ }), { target: { value: ' 변경한 이름 ' } });
    const form = screen.getByRole('form', { name: '기본 정보 편집' });
    fireEvent.submit(form); fireEvent.submit(form);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(user.uid, { displayName: '변경한 이름', phoneNumber: user.phoneNumber });
    expect(screen.getByRole('button', { name: '저장 중' })).toBeDisabled();
    await act(async () => pending.resolve());
    expect(await screen.findByText('기본 정보가 저장되었습니다.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '변경한 이름' })).toBeInTheDocument();
    const unload = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
});

it('빈 이름과 잘못된 전화번호는 저장하지 않고 해당 입력란을 안내한다', async () => {
    await open(); edit();
    fireEvent.change(screen.getByRole('textbox', { name: /이름/ }), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(screen.getByText('이름을 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /이름/ })).toHaveFocus();
    fireEvent.change(screen.getByRole('textbox', { name: /이름/ }), { target: { value: '테스트' } });
    fireEvent.change(screen.getByRole('textbox', { name: /연락처/ }), { target: { value: '잘못된 번호' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(screen.getByRole('textbox', { name: /연락처/ })).toHaveAttribute('aria-invalid', 'true');
    expect(save).not.toHaveBeenCalled();
});

it('저장 실패 시 입력을 보존하고 다시 저장하면 오류를 해제한다', async () => {
    save.mockRejectedValueOnce(new Error('offline'));
    await open(); edit();
    fireEvent.change(screen.getByRole('textbox', { name: /연락처/ }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('입력한 내용은 유지됩니다');
    expect(screen.getByRole('textbox', { name: /연락처/ })).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('기본 정보가 저장되었습니다.');
    expect(save).toHaveBeenLastCalledWith(user.uid, { displayName: user.displayName, phoneNumber: '' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('미저장 변경의 취소·탭 이동·메뉴 이동·새로고침을 안내한다', async () => {
    await open(); edit();
    fireEvent.change(screen.getByRole('textbox', { name: /이름/ }), { target: { value: '아직 저장 안 함' } });
    (window.confirm as jest.Mock).mockReturnValue(false);
    fireEvent.click(screen.getByRole('tab', { name: '계정 정보' }));
    fireEvent.click(screen.getByRole('link', { name: '다른 화면' }));
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.getByRole('textbox', { name: /이름/ })).toHaveValue('아직 저장 안 함');
    const unload = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    (window.confirm as jest.Mock).mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    edit(); expect(screen.getByRole('textbox', { name: /이름/ })).toHaveValue(user.displayName);
});

it('가입일·최근 접속을 분리하고 정지 상태를 올바르게 표시한다', async () => {
    getUser.mockResolvedValue({ ...user, status: 'suspended' });
    await open();
    expect(screen.getByText('사용 중지')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '계정 정보' }));
    expect(screen.getByText(formatDateLike(mockCurrentUser.metadata.creationTime))).toBeInTheDocument();
    expect(screen.getByText(formatDateLike(user.lastLogin))).toBeInTheDocument();
    expect(screen.queryByText('계정 활성')).not.toBeInTheDocument();
});

it('키보드로 영역을 이동하며 사무실 직원에게 누적공수를 표시하지 않는다', async () => {
    loadConnections.mockResolvedValue({ ...emptyConnections, officeStaff: [{ id: 'office-test', name: '직원 예시', role: '사무', idNumber: 'TEST-ID-UNMASKED', accountNumber: 'TEST-ACCOUNT-UNMASKED' }] });
    await open();
    expect(screen.queryByRole('heading', { name: '누적공수' })).not.toBeInTheDocument();
    const tab = screen.getByRole('tab', { name: '기본 정보' });
    fireEvent.keyDown(tab, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: '소속·연결' })).toHaveFocus();
    fireEvent.click(screen.getByRole('tab', { name: '급여·개인정보' }));
    expect(await screen.findByText('TEST-ID-UNMASKED')).toBeInTheDocument();
    expect(screen.getByText('TEST-ACCOUNT-UNMASKED')).toBeInTheDocument();
});

it('이전 계정의 늦은 연결 응답을 새 계정에 표시하지 않는다', async () => {
    const previous = deferred<any>(); loadConnections.mockReturnValueOnce(previous.promise);
    const result = await open();
    mockCurrentUser = { ...mockCurrentUser, uid: 'second-user' };
    getUser.mockResolvedValue({ ...user, uid: 'second-user', displayName: '두 번째 사용자' });
    result.rerender(view());
    await screen.findByRole('heading', { name: '두 번째 사용자' });
    await act(async () => previous.resolve({ ...emptyConnections, workers: [{ id: 'old', name: '이전 계정 직원' }] }));
    fireEvent.click(screen.getByRole('tab', { name: '소속·연결' }));
    expect(screen.queryByText('이전 계정 직원')).not.toBeInTheDocument();
});

it('기본 정보 조회 실패를 빈 프로필로 오인하지 않고 재시도할 수 있다', async () => {
    getUser.mockRejectedValueOnce(new Error('offline'));
    render(view());
    fireEvent.click(await screen.findByRole('button', { name: '다시 불러오기' }));
    await screen.findByRole('button', { name: '편집' });
    expect(getUser).toHaveBeenCalledTimes(2);
});

it('지원하는 상태와 누락·직렬화된 날짜를 안전하게 표현한다', () => {
    expect(['active', 'pending', 'rejected', 'suspended', undefined].map(profileStatus).map(value => value.label))
        .toEqual(['계정 활성', '승인 대기', '반려', '사용 중지', '상태 확인 필요']);
    expect(formatDateLike('invalid-date')).toBe('');
    expect(formatDateLike({ seconds: 1704153600 })).toBe(formatDateLike('2024-01-02T00:00:00Z'));
});

