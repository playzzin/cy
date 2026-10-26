import { planWorkerAccountImport } from './workerAccountImport';
import { getWorkerAccount, hasMissingWorkerAccount } from './workerAccount';
import type { Worker } from '../services/manpowerService';
jest.mock('../services/aiSettingsService', () => ({ aiSettingsService: {} }));

const worker: Worker = { id: 'one', name: '가상 작업자', teamName: '검증팀', bankName: '기본은행', accountNumber: '001234567890', accountHolder: '기본예금주', directPayBankName: '직불은행', directPayAccountNumber: '009876543210', directPayAccountHolder: '직불예금주' };
test('기존 양식은 기본 계좌만 갱신하고 직불용 계좌를 보존한다', () => {
    const [plan] = planWorkerAccountImport([{ id: 'one', 은행: '새기본은행', 계좌번호: '000-123-456789', 예금주: '새예금주' }], [worker]);
    expect(plan.error).toBeUndefined();
    expect(plan.updates).toEqual({ bankName: '새기본은행', accountNumber: '000123456789', accountHolder: '새예금주' });
});
test('직불용 열만 있는 파일은 기본 계좌를 건드리지 않는다', () => {
    const [plan] = planWorkerAccountImport([{ id: 'one', '직불용 은행': '새직불은행', '직불용 계좌번호': '000123456789', '직불용 예금주': '새직불예금주' }], [worker]);
    expect(plan.error).toBeUndefined();
    expect(plan.updates).toEqual({ directPayBankName: '새직불은행', directPayAccountNumber: '000123456789', directPayAccountHolder: '새직불예금주' });
});
test('누락된 열과 빈 셀은 저장된 정보를 삭제하지 않는다', () => {
    const [plan] = planWorkerAccountImport([{ id: 'one', 은행: '변경은행', 계좌번호: '', 예금주: '' }], [worker]);
    expect(plan.updates).toEqual({ bankName: '변경은행', accountNumber: worker.accountNumber, accountHolder: worker.accountHolder });
    expect(planWorkerAccountImport([{ id: 'one' }], [worker])[0].error).toMatch('변경할 계좌정보가 없습니다');
});
test('명시한 ID가 틀리면 이름이 같은 다른 작업자에게 저장하지 않는다', () => {
    const [plan] = planWorkerAccountImport([{ id: 'missing', 이름: worker.name, 팀명: worker.teamName, 은행: '변경은행' }], [worker]);
    expect(plan.error).toMatch('미매칭'); expect(plan.updates).toEqual({});
});
test('ID가 없는 동명이인은 제외하고 유일한 이름·팀만 연결한다', () => {
    const row = { 이름: worker.name, 팀명: worker.teamName, 은행: '변경은행' };
    expect(planWorkerAccountImport([row], [worker, { ...worker, id: 'two' }])[0].error).toMatch('동명이인');
    expect(planWorkerAccountImport([row], [worker])[0].workerId).toBe('one');
});
test('같은 작업자가 여러 행이면 모두 제외한다', () => {
    const plans = planWorkerAccountImport([{ id: 'one', 은행: '변경1' }, { id: 'one', 은행: '변경2' }], [worker]);
    expect(plans.every(plan => plan.error?.includes('중복') && !Object.keys(plan.updates).length)).toBe(true);
});
test.each([123456789, '1.2345E+12', '****567890', '123'])('불확실한 계좌번호 %s는 저장하지 않는다', number => {
    const [plan] = planWorkerAccountImport([{ id: 'one', 계좌번호: number }], [worker]);
    expect(plan.error).toBeTruthy(); expect(plan.updates).toEqual({});
});
test('두 계좌 중 하나라도 잘못되면 해당 작업자의 행 전체를 제외한다', () => {
    const [plan] = planWorkerAccountImport([{ id: 'one', 은행: '변경은행', '직불용 계좌번호': 'invalid' }], [worker]);
    expect(plan.error).toMatch('직불용'); expect(plan.updates).toEqual({});
});
test('불완전한 계좌와 잘못된 변수 타입을 미등록으로 판단하고 화면 오류를 방지한다', () => {
    expect(hasMissingWorkerAccount(worker)).toBe(false);
    expect(hasMissingWorkerAccount({ ...worker, directPayAccountHolder: '' })).toBe(true);
    const legacy = { ...worker, accountNumber: 12345 } as unknown as Worker;
    expect(getWorkerAccount(legacy, 'default').accountNumber).toBe('');
    expect(hasMissingWorkerAccount(legacy)).toBe(true);
});
