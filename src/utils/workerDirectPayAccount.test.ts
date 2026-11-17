import { assertWorkerDirectPayAccount, clearedDirectPayAccount, directPayAccountHolderError } from './workerDirectPayAccount';

const worker = { name: '가상 작업자', directPayBankName: '검증은행', directPayAccountNumber: '001234567890', directPayAccountHolder: '가상 작업자' };
test('이름의 공백과 한글 정규화만 허용하고 다른 이름·빈 예금주를 거부한다', () => {
    expect(directPayAccountHolderError(worker.name, ' 가상작업자 ')).toBe('');
    expect(directPayAccountHolderError('가상', '가상'.normalize('NFD'))).toBe('');
    for (const holder of ['다른사람', '', '가상작업자1']) expect(directPayAccountHolderError(worker.name, holder)).toBeTruthy();
    expect(directPayAccountHolderError('', '')).toBeTruthy();
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
    expect(() => assertWorkerDirectPayAccount(legacy, clearedDirectPayAccount)).not.toThrow();
});
