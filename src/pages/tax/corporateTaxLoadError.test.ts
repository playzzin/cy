import { CorporateTaxSourceAmountError, describeCorporateTaxLoadError } from './corporateTaxLoadError';

it.each([
    ['permission-denied', '자료 조회 권한'], ['firestore/unauthenticated', '로그인 상태'],
    ['unavailable', '서버 연결'], ['deadline-exceeded', '서버 연결'],
    ['resource-exhausted', '요청 한도'], ['failed-precondition', '데이터베이스 설정'],
])('오류 코드 %s를 원인과 조치로 안내한다', (code, explanation) => {
    expect(describeCorporateTaxLoadError({ code })).toContain(explanation);
});

it('원본 금액 오류를 조회 권한 오류와 구분한다', () => {
    expect(describeCorporateTaxLoadError(new CorporateTaxSourceAmountError())).toContain('원본 화면의 금액');
});

it('예외의 원본 메시지나 알 수 없는 코드를 사용자 화면에 복사하지 않는다', () => {
    const message = 'private-record-value';
    expect(describeCorporateTaxLoadError({ code: message, message })).not.toContain(message);
    expect(describeCorporateTaxLoadError(new Error(message))).not.toContain(message);
});
