import { WorkerSchema } from './workerSchema';

it('외국인 직접 선택값을 저장·조회하고 잘못된 문자열 값은 거부한다', () => {
    for (const isForeignWorker of [true, false, undefined, null]) {
        expect(WorkerSchema.parse({ name: '가상작업자', isForeignWorker }).isForeignWorker).toBe(isForeignWorker);
    }
    expect(WorkerSchema.safeParse({ name: '가상작업자', isForeignWorker: 'true' }).success).toBe(false);
});

it('작업자 조회에서 기본계좌와 직불용 계좌를 각각 보존한다', () => {
    const result = WorkerSchema.parse({
        name: '가상작업자',
        bankName: '기본은행', accountNumber: 'BASIC-ACCOUNT', accountHolder: '기본예금주',
        directPayBankName: '직불은행', directPayAccountNumber: '000-DIRECT-ACCOUNT', directPayAccountHolder: '직불예금주',
    });
    expect(result).toMatchObject({
        bankName: '기본은행', accountNumber: 'BASIC-ACCOUNT', accountHolder: '기본예금주',
        directPayBankName: '직불은행', directPayAccountNumber: '000-DIRECT-ACCOUNT', directPayAccountHolder: '직불예금주',
    });
});

it.each([undefined, null])('직불용 계좌가 없는 기존 작업자도 조회할 수 있다 (%s)', value => {
    const result = WorkerSchema.parse({
        name: '가상작업자', bankName: '기본은행', accountNumber: 'BASIC-ACCOUNT', accountHolder: '기본예금주',
        directPayBankName: value, directPayAccountNumber: value, directPayAccountHolder: value,
    });
    expect(result.directPayBankName).toBe(value);
    expect(result.directPayAccountNumber).toBe(value);
    expect(result.directPayAccountHolder).toBe(value);
});
