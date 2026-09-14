import { getGoogleAuthErrorMessage } from './firebaseAuthError';

describe('getGoogleAuthErrorMessage', () => {
  it('explains a blocked popup', () => {
    expect(getGoogleAuthErrorMessage({ code: 'auth/popup-blocked' }))
      .toContain('팝업을 허용');
  });

  it('explains a missing Firebase build configuration', () => {
    expect(getGoogleAuthErrorMessage(
      new Error('[Firebase] Missing environment variable: REACT_APP_FIREBASE_API_KEY.')
    )).toContain('배포본에 로그인 서비스 설정이 누락');
  });

  it('uses a safe fallback without exposing the raw error', () => {
    const rawMessage = 'sensitive-provider-detail';
    const result = getGoogleAuthErrorMessage(new Error(rawMessage));

    expect(result).toContain('Google 로그인에 실패');
    expect(result).not.toContain(rawMessage);
  });
});
