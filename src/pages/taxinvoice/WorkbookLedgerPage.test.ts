Object.assign(process.env, {
    REACT_APP_FIREBASE_API_KEY: 'test-api-key',
    REACT_APP_FIREBASE_AUTH_DOMAIN: 'test.example.com',
    REACT_APP_FIREBASE_PROJECT_ID: 'test-project',
    REACT_APP_FIREBASE_STORAGE_BUCKET: 'test-project.appspot.com',
    REACT_APP_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
    REACT_APP_FIREBASE_APP_ID: '1:1234567890:web:test',
});

jest.mock('sweetalert2', () => ({
    __esModule: true,
    default: {
        mixin: () => ({}),
    },
}));

jest.mock('sweetalert2-react-content', () => ({
    __esModule: true,
    default: () => ({}),
}));

const { getVisibleWorkbookRemark } = require('./WorkbookLedgerPage') as typeof import('./WorkbookLedgerPage');

describe('getVisibleWorkbookRemark', () => {
    it('hides a legacy mapped-address segment from an AI tax-invoice bulk-review remark', () => {
        expect(getVisibleWorkbookRemark(
            'Gemini 세금계산서 검수 · invoice-20260716.pdf · 매핑주소: 서울특별시 강남구 테헤란로 123'
        )).toBe('Gemini 세금계산서 검수 · invoice-20260716.pdf');
    });

    it('keeps the provenance of an inline mapped-address remark while hiding its address', () => {
        expect(getVisibleWorkbookRemark(
            'AI 세금계산서 대량검수 (주소 매핑: 경기도 성남시 분당구 판교로 242)'
        )).toBe('AI 세금계산서 대량검수');
    });

    it('does not alter a manual remark that happens to mention a mapping address', () => {
        const manualRemark = '현장 확인용 매핑주소: 서울특별시 강남구 테헤란로 123';

        expect(getVisibleWorkbookRemark(manualRemark)).toBe(manualRemark);
    });
});
