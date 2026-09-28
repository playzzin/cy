const PROVIDERS: Record<string, string> = {
  password: '이메일', google: 'Google', 'google.com': 'Google', firebase: '로그인 유지',
  'dev-admin': '개발용 계정', unknown: '알 수 없음',
};
const METHODS: Record<string, string> = {
  'email/password': '이메일 로그인', popup: 'Google 로그인', session_restore: '앱 다시 열기',
  manual: '직접 로그아웃', unknown: '알 수 없음',
};
export const loginProviderLabel = (value: string): string => PROVIDERS[value] || value;
export const loginMethodLabel = (value: string): string => METHODS[value] || value;
