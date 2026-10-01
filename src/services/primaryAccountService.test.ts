import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
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

const exampleAccount = { sourceType: 'custom' as const, sourceId: '', sourceName: '검증용', bankName: '샘플은행', accountHolder: '테스트', accountNumber: '000-TEST-01' };

it('각 페이지를 서로 다른 문서에 저장하며 공통계좌를 덮어쓰지 않는다', async () => {
    await primaryAccountService.setPrimaryAccount(exampleAccount, 'monthly-wage');
    await primaryAccountService.setPrimaryAccount({ ...exampleAccount, accountNumber: '000-TEST-02' }, 'client-site-labor');
    expect((doc as jest.Mock).mock.calls.map(call => call[2])).toEqual(['primary_account_monthly-wage', 'primary_account_client-site-labor']);
    expect(setDoc).toHaveBeenNthCalledWith(2, 'primary-account-ref', expect.objectContaining({ accountNumber: '000-TEST-02' }));
});

it('새로 열었을 때도 해당 페이지에 저장된 계좌를 조회한다', async () => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => exampleAccount });
    expect(await primaryAccountService.getPrimaryAccount('support-team-incoming')).toEqual(exampleAccount);
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'settings', 'primary_account_support-team-incoming');
});

it('은행이나 예금주가 없는 페이지 계좌는 저장하지 않는다', async () => {
    await expect(primaryAccountService.setPrimaryAccount({ ...exampleAccount, bankName: ' ' }, 'monthly-wage')).rejects.toThrow('은행과 예금주');
    await expect(primaryAccountService.setPrimaryAccount({ ...exampleAccount, accountHolder: '' }, 'monthly-wage')).rejects.toThrow('은행과 예금주');
    expect(setDoc).not.toHaveBeenCalled();
});
