import { getDataLoadErrorMessage } from './dataLoadError';

test.each(['연결된 작업자에게 소속 팀이 지정되지 않았습니다.', '연결된 소속 팀을 찾을 수 없습니다.'])(
    '소속 오류는 재로그인 대신 기존 작업자와 팀 연결 확인을 안내한다: %s', message => {
        expect(getDataLoadErrorMessage(Object.assign(new Error(message), { code: 'functions/failed-precondition' })))
            .toContain('기존 작업자와 계정 연결, 소속 팀 지정');
    },
);

test('권한 오류와 만료된 로그인은 원인에 맞게 안내한다', () => {
    expect(getDataLoadErrorMessage({ code: 'functions/permission-denied' })).toContain('조회 권한');
    expect(getDataLoadErrorMessage({ code: 'functions/unauthenticated' })).toContain('다시 로그인');
});

test('알 수 없는 오류의 내부 정보는 화면에 노출하지 않는다', () => {
    const message = getDataLoadErrorMessage(Object.assign(new Error('internal document path'), { code: 'functions/internal' }));
    expect(message).toContain('다시 시도');
    expect(message).not.toContain('internal document path');
    expect(getDataLoadErrorMessage(null)).toBe(message);
});
