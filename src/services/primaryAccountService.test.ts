import { doc, onSnapshot } from 'firebase/firestore';
import { primaryAccountService } from './primaryAccountService';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
    doc: jest.fn(() => 'primary-account-ref'),
    getDoc: jest.fn(),
    onSnapshot: jest.fn(),
    serverTimestamp: jest.fn(),
    setDoc: jest.fn(),
}));

beforeEach(() => {
    jest.clearAllMocks();
    (doc as jest.Mock).mockReturnValue('primary-account-ref');
});

it('계좌관리에서 저장한 대표계좌 변경을 재접속 없이 전달하고 구독을 해제한다', () => {
    const stop = jest.fn();
    (onSnapshot as jest.Mock).mockReturnValue(stop);
    const changed = jest.fn();
    const failed = jest.fn();
    const unsubscribe = primaryAccountService.subscribe(changed, failed);
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'settings', 'primary_account');
    const [ref, receive, error] = (onSnapshot as jest.Mock).mock.calls[0];
    expect(ref).toBe('primary-account-ref');
    const account = { sourceType: 'company', sourceId: 'test-company', sourceName: '테스트 회사', bankName: '테스트 은행', accountHolder: '테스트 예금주', accountNumber: '000-TEST-001' };
    receive({ exists: () => true, data: () => account });
    receive({ exists: () => true, data: () => ({ ...account, accountNumber: '000-TEST-002' }) });
    expect(changed).toHaveBeenNthCalledWith(1, account);
    expect(changed).toHaveBeenLastCalledWith({ ...account, accountNumber: '000-TEST-002' });
    error(new Error('permission-denied'));
    expect(failed).toHaveBeenCalledWith(expect.objectContaining({ message: 'permission-denied' }));
    unsubscribe();
    expect(stop).toHaveBeenCalledTimes(1);
});

it('대표계좌가 없거나 유효하지 않으면 이전 계좌를 재사용하지 않는다', () => {
    const changed = jest.fn();
    primaryAccountService.subscribe(changed, jest.fn());
    const receive = (onSnapshot as jest.Mock).mock.calls[0][1];
    receive({ exists: () => false });
    receive({ exists: () => true, data: () => ({ sourceType: 'company', accountNumber: '' }) });
    expect(changed.mock.calls).toEqual([[null], [null]]);
});
