type FirebaseAuthErrorLike = {
  code?: string;
  message?: string;
};

const GOOGLE_AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/popup-blocked': '브라우저가 Google 로그인 창을 차단했습니다. 팝업을 허용한 뒤 다시 시도해 주세요.',
  'auth/popup-closed-by-user': 'Google 로그인 창이 닫혔습니다. 다시 시도해 주세요.',
  'auth/cancelled-popup-request': '이미 Google 로그인을 진행 중입니다. 열린 로그인 창을 확인해 주세요.',
  'auth/unauthorized-domain': '현재 접속 주소가 Google 로그인 허용 목록에 없습니다. 관리자에게 문의해 주세요.',
  'auth/operation-not-allowed': 'Google 로그인이 Firebase에서 활성화되지 않았습니다. 관리자에게 문의해 주세요.',
  'auth/network-request-failed': '네트워크 연결 문제로 Google 로그인에 실패했습니다. 연결 상태를 확인해 주세요.',
  'auth/web-storage-unsupported': '브라우저의 저장소 사용이 차단되어 로그인할 수 없습니다. 브라우저 설정을 확인해 주세요.',
  'auth/account-exists-with-different-credential': '같은 이메일의 다른 로그인 방식이 이미 등록되어 있습니다. 기존 방식으로 로그인해 주세요.',
};

export const getGoogleAuthErrorMessage = (error: unknown): string => {
  const authError = error as FirebaseAuthErrorLike | null;
  const code = typeof authError?.code === 'string' ? authError.code : '';
  const message = typeof authError?.message === 'string' ? authError.message : '';

  if (code && GOOGLE_AUTH_ERROR_MESSAGES[code]) {
    return GOOGLE_AUTH_ERROR_MESSAGES[code];
  }

  if (message.includes('[Firebase] Missing environment variable')) {
    return '배포본에 로그인 서비스 설정이 누락되었습니다. 관리자에게 문의해 주세요.';
  }

  return 'Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.';
};
