export {};

jest.mock('./firebaseBase', () => ({ app: { name: 'test-app' } }));
jest.mock('../utils/devPreviewRuntime', () => ({ isDevPreviewFrame: false, previewAuthFacade: (auth: unknown) => auth }));
jest.mock('firebase/auth', () => ({
    browserLocalPersistence: { type: 'LOCAL' },
    browserSessionPersistence: { type: 'SESSION' },
    indexedDBLocalPersistence: { type: 'INDEXED_DB' },
    initializeAuth: jest.fn(),
    getAuth: jest.fn(),
}));

const loadAuth = (path: string, pendingRedirect = false) => {
    jest.resetModules();
    window.history.replaceState({}, '', path);
    window.sessionStorage.clear();
    if (pendingRedirect) require('../utils/googleLoginRedirect').rememberGoogleLoginRedirect(path);
    const sdk = require('firebase/auth');
    require('./firebaseAuth');
    return sdk;
};

afterEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/');
});

it('현장정보 첫 진입은 기존 세션 저장소를 유지하고 팝업 준비를 시작하지 않는다', () => {
    const sdk = loadAuth('/manpower/site-responsible-detail/?qa_cold=1');
    expect(sdk.initializeAuth).toHaveBeenCalledWith({ name: 'test-app' }, {
        persistence: [sdk.indexedDBLocalPersistence, sdk.browserLocalPersistence, sdk.browserSessionPersistence],
    });
    expect(sdk.getAuth).not.toHaveBeenCalled();
});

it.each([
    ['/manpower/site-responsible-detail', true],
    ['/login', false],
] as const)('Google 복귀 또는 기존 로그인 경로 %s는 기본 Auth로 시작한다', (path, redirect) => {
    const sdk = loadAuth(path, redirect);
    expect(sdk.getAuth).toHaveBeenCalledWith({ name: 'test-app' });
    expect(sdk.initializeAuth).not.toHaveBeenCalled();
});
