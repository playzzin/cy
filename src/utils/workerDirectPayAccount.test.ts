import { assertWorkerDirectPayAccount, clearedDirectPayAccount, directPayAccountHolderError } from './workerDirectPayAccount';
import { hasForeignRegistrationNumber, isForeignWorker } from './workerForeignStatus';

const worker = { name: '가상 작업자', directPayBankName: '검증은행', directPayAccountNumber: '001234567890', directPayAccountHolder: '가상 작업자' };
test('이름의 공백과 한글 정규화만 허용하고 다른 이름·빈 예금주를 거부한다', () => {
    expect(directPayAccountHolderError(worker, ' 가상작업자 ')).toBe('');
    expect(directPayAccountHolderError({ name: '가상' }, '가상'.normalize('NFD'))).toBe('');
    for (const holder of ['다른사람', '', '가상작업자1']) expect(directPayAccountHolderError(worker, holder)).toBeTruthy();
    expect(directPayAccountHolderError({ name: '' }, '')).toBeTruthy();
});

test.each(['5', '6', '7', '8'])('외국인등록번호 구분자 %s는 다른 직불 예금주를 허용한다', digit => {
    const foreign = { ...worker, idNumber: `000000-${digit}000000` };
    expect(hasForeignRegistrationNumber(foreign.idNumber)).toBe(true);
    expect(hasForeignRegistrationNumber(` 000000 ${digit}000000 `)).toBe(true);
    expect(directPayAccountHolderError(foreign, 'SYNTHETIC HOLDER')).toBe('');
    expect(() => assertWorkerDirectPayAccount(null, { ...foreign, directPayAccountHolder: 'SYNTHETIC HOLDER' })).not.toThrow();
    expect(() => assertWorkerDirectPayAccount(foreign, { name: '다른표기', directPayAccountHolder: 'SYNTHETIC HOLDER' })).not.toThrow();
    expect(() => assertWorkerDirectPayAccount(foreign, { directPayAccountHolder: ' ' })).toThrow('예금주');
});

test('수동 외국인 선택도 허용하고 해제나 번호 변경 시 내국인 검증을 복원한다', () => {
    const manual = { ...worker, isForeignWorker: true, directPayAccountHolder: 'SYNTHETIC HOLDER' };
    expect(isForeignWorker(manual)).toBe(true);
    expect(() => assertWorkerDirectPayAccount(null, manual)).not.toThrow();
    expect(() => assertWorkerDirectPayAccount(manual, { isForeignWorker: false })).toThrow('예금주');
    expect(() => assertWorkerDirectPayAccount({ ...manual, isForeignWorker: undefined, idNumber: '000000-5000000' }, { idNumber: '000000-1000000' })).toThrow('예금주');
    expect(() => assertWorkerDirectPayAccount({ ...manual, isForeignWorker: undefined, idNumber: '000000-5000000' }, { idNumber: '' })).toThrow('예금주');
});

test('마스킹·불완전 번호와 이름 표기만으로 외국인 예외를 추측하지 않는다', () => {
    for (const value of [null, undefined, 5, '', '000000-500000', '000000-5******', '000000-1000000', '000000-2000000', '000000-3000000', '000000-4000000', '외국인000000-5000000']) {
        expect(hasForeignRegistrationNumber(value)).toBe(false);
    }
    expect(isForeignWorker({ isForeignWorker: 'true' } as any)).toBe(false);
    expect(directPayAccountHolderError({ name: 'SYNTHETIC NAME' }, '다른예금주')).toBeTruthy();
    expect(directPayAccountHolderError({ name: '', isForeignWorker: true }, '다른예금주')).toBeTruthy();
});
test('신규·부분 수정·이름 수정에 같은 검증을 적용한다', () => {
    expect(() => assertWorkerDirectPayAccount(null, worker)).not.toThrow();
    expect(() => assertWorkerDirectPayAccount(worker, { directPayAccountHolder: '다른사람' })).toThrow('예금주');
    expect(() => assertWorkerDirectPayAccount(worker, { name: '다른사람' })).toThrow('예금주');
    expect(() => assertWorkerDirectPayAccount({ ...worker, directPayAccountHolder: '다른사람' }, { directPayAccountNumber: '001111222233' })).toThrow('예금주');
});
test('기본 계좌와 무관한 수정은 허용하고 불일치 계좌도 전체 삭제할 수 있다', () => {
    const legacy = { ...worker, directPayAccountHolder: '다른사람' };
    expect(() => assertWorkerDirectPayAccount(legacy, { bankName: '새은행', accountHolder: '타인' })).not.toThrow();
    expect(() => assertWorkerDirectPayAccount(legacy, { contact: 'test' })).not.toThrow();
    expect(() => assertWorkerDirectPayAccount(legacy, { ...legacy, accountHolder: '타인기본예금주' })).not.toThrow();
    expect(() => assertWorkerDirectPayAccount(legacy, clearedDirectPayAccount)).not.toThrow();
});
