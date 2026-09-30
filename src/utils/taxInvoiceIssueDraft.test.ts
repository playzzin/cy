import { assertValidIssueNumbers, parseIssueNumber } from './taxInvoiceIssueDraft';

test.each(['1,2', '12,34', ',100', '100,', '1,,000', '1.2,3', '9007199254740993', '-9007199254740993'])('잘못된 구분 기호와 안전 범위를 넘는 숫자 %s를 거절한다', value => {
    expect(parseIssueNumber(value)).toBeNull();
});

test.each([['1,234,567', 1234567], ['-1,234.5', -1234.5], [' 1,000 ', 1000], ['.5', 0.5], ['-0.5', -0.5], ['100.', 100], ['', 0], ['0', 0]])('정상 숫자 %s는 기존 값으로 해석한다', (value, expected) => {
    expect(parseIssueNumber(String(value))).toBe(expected);
});

test('직접 저장 요청도 표현 가능한 범위를 넘는 금액과 공수를 거절한다', () => {
    expect(() => assertValidIssueNumbers({ supplyAmount: Number.MAX_SAFE_INTEGER + 1 })).toThrow('숫자');
    expect(() => assertValidIssueNumbers({ manDays: -Number.MAX_SAFE_INTEGER - 1 })).toThrow('숫자');
    expect(() => assertValidIssueNumbers({ supplyAmount: -1234, manDays: 1.5 })).not.toThrow();
});
