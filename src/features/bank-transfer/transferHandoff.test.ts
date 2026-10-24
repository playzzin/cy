import { clearTransferHandoff, readTransferHandoff, storeTransferHandoff } from './transferHandoff';
import type { TransferCandidate } from './types';

const candidate: TransferCandidate = {
    id: 'payroll:fixture:totalAmount', source: 'payroll', sourceId: 'fixture', name: '검증작업자',
    groupName: '검증팀', category: 'worker', bankName: '국민은행', bankCode: '004',
    accountNumber: '000123456789', accountHolder: '검증예금주', amount: 96700, period: '2026-10',
    detail: '급여 미리보기', receiverDisplay: '검증법인', senderMemo: '검증작업자 정산',
};

beforeEach(() => {
    jest.restoreAllMocks();
    sessionStorage.clear();
});

it('같은 로그인 계정에서 그대로 읽고 삭제하며 다른 계정에는 노출하지 않는다', () => {
    storeTransferHandoff('fixture-user', [candidate]);
    expect(readTransferHandoff('fixture-user')).toEqual([candidate]);
    expect(readTransferHandoff('other-user')).toBeNull();
    clearTransferHandoff('other-user');
    expect(readTransferHandoff('fixture-user')).toEqual([candidate]);
    clearTransferHandoff('fixture-user');
    expect(readTransferHandoff('fixture-user')).toBeNull();
});

it('로그인 계정이 없으면 저장·읽기·삭제를 차단한다', () => {
    expect(() => storeTransferHandoff('', [candidate])).toThrow('로그인');
    expect(() => readTransferHandoff('  ')).toThrow('로그인');
    expect(() => clearTransferHandoff('')).toThrow('로그인');
    expect(sessionStorage.length).toBe(0);
});

it('키만 바꾸어 다른 로그인 계정의 데이터를 주입해도 거절한다', () => {
    storeTransferHandoff('fixture-user', [candidate]);
    sessionStorage.setItem('bank-transfer-handoff:v1:other-user', sessionStorage.getItem('bank-transfer-handoff:v1:fixture-user')!);
    expect(() => readTransferHandoff('other-user')).toThrow('현재 로그인 계정');
});

it('손상되거나 지원하지 않는 버전·금액·source 데이터는 반환하지 않는다', () => {
    const key = 'bank-transfer-handoff:v1:fixture-user';
    sessionStorage.setItem(key, '{broken');
    expect(() => readTransferHandoff('fixture-user')).toThrow('손상');
    for (const payload of [
        { version: 2, userId: 'fixture-user', candidates: [candidate] },
        { version: 1, userId: 'fixture-user', candidates: [{ ...candidate, amount: '96700' }] },
        { version: 1, userId: 'fixture-user', candidates: [{ ...candidate, source: 'unknown' }] },
    ]) {
        sessionStorage.setItem(key, JSON.stringify(payload));
        expect(() => readTransferHandoff('fixture-user')).toThrow('형식');
    }
    expect(() => storeTransferHandoff('fixture-user', [{ ...candidate, amount: NaN }])).toThrow('올바르지');
});

it('저장 공간 오류를 실제 계좌가 포함되지 않은 안내로 변환한다', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error(candidate.accountNumber); });
    expect(() => storeTransferHandoff('fixture-user', [candidate])).toThrow('임시 저장하지 못했습니다');
    expect(() => storeTransferHandoff('fixture-user', [candidate])).not.toThrow(candidate.accountNumber);
});

it('브라우저 읽기·삭제 오류를 호출자에게 알린다', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('fixture blocked'); });
    expect(() => readTransferHandoff('fixture-user')).toThrow('읽지 못했습니다');
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('fixture blocked'); });
    expect(() => clearTransferHandoff('fixture-user')).toThrow('정리하지 못했습니다');
});
