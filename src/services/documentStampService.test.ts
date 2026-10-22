import { doc, getDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { ref, getDownloadURL, uploadBytes } from 'firebase/storage';
import { documentStampService, validateStampFile } from './documentStampService';
import { applyStampCommand, createDefaultStampSettings } from '../features/document-stamps/model';
import { LEGACY_ESTIMATE_STAMP_URL } from '../features/document-stamps/legacyStampUrl';

jest.mock('../config/firebase', () => ({ db: {}, storage: {} }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(() => 'settings-ref'), getDoc: jest.fn(), onSnapshot: jest.fn(), runTransaction: jest.fn(), serverTimestamp: () => 'server-time' }));
jest.mock('firebase/storage', () => ({ ref: jest.fn((_, path) => path), getDownloadURL: jest.fn(), uploadBytes: jest.fn() }));

beforeEach(() => {
    jest.clearAllMocks();
    (doc as jest.Mock).mockReturnValue('settings-ref');
    (ref as jest.Mock).mockImplementation((_, path) => path);
});

it('저장된 설정이 없으면 기존 기본값을 반환하며 데이터를 쓰지 않는다', async () => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
    expect(await documentStampService.getSettings()).toEqual(createDefaultStampSettings());
    expect(runTransaction).not.toHaveBeenCalled();
});

it('동시 변경이 감지되면 최신 설정을 덮어쓰지 않는다', async () => {
    const set = jest.fn();
    (runTransaction as jest.Mock).mockImplementation(async (_, update) => update({ get: async () => ({ exists: () => true, data: () => ({ ...createDefaultStampSettings(), revision: 5 }) }), set }));
    await expect(documentStampService.execute({ type: 'applyAll', scope: 'global', id: 'legacy-dawon' }, 4)).rejects.toThrow('다른 작업');
    expect(set).not.toHaveBeenCalled();
    await documentStampService.execute({ type: 'applyAll', scope: 'global', id: 'legacy-dawon' }, 5);
    expect(set).toHaveBeenCalledWith('settings-ref', expect.objectContaining({ revision: 6, profiles: { global: { default: 'legacy-dawon' } } }));
});

it('실시간 구독의 읽기 오류를 호출자에게 전달한다', () => {
    const error = jest.fn(), next = jest.fn();
    (onSnapshot as jest.Mock).mockImplementation((_, __, fail) => { fail(new Error('offline')); return jest.fn(); });
    documentStampService.subscribe(next, error);
    expect(error).toHaveBeenCalled(); expect(next).not.toHaveBeenCalled();
});

it('설정을 읽지 못해도 견적 엑셀과 증명서의 기존 도장 경로를 유지한다', async () => {
    (getDoc as jest.Mock).mockRejectedValue(new Error('offline'));
    (getDownloadURL as jest.Mock).mockResolvedValue('/legacy-dawon.png');
    expect(await documentStampService.getUrl('estimate', '청연', 'excel')).toBe('/assets/estimate/cheongyeon-stamp-round.png');
    expect(await documentStampService.getUrl('termination', '다원')).toBe('/legacy-dawon.png');
    expect(getDownloadURL).toHaveBeenCalledWith('다원도장.png');
});

it('잘못된 형식·빈 파일·크기 초과를 업로드 전에 차단한다', () => {
    expect(() => validateStampFile(new File(['svg'], 'seal.svg', { type: 'image/svg+xml' }))).toThrow('PNG');
    expect(() => validateStampFile(new File([], 'seal.png', { type: 'image/png' }))).toThrow('2MB');
    expect(() => validateStampFile(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'seal.png', { type: 'image/png' }))).toThrow('2MB');
    expect(uploadBytes).not.toHaveBeenCalled();
});

it.each(['screen', 'excel'] as const)('거래명세표 %s는 등록된 청연 회사 직인을 사용한다', async output => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
    (getDownloadURL as jest.Mock).mockResolvedValue('/registered-cheongyeon.jpg');
    expect(await documentStampService.getUrl('transaction', '청연이엔지', output)).toBe('/registered-cheongyeon.jpg');
    expect(getDownloadURL).toHaveBeenCalledWith('청연도장.jpg');
});

it.each(['screen', 'excel'] as const)('거래명세표 %s는 기본 직인의 이미지 수정도 반영한다', async output => {
    const defaults = createDefaultStampSettings();
    const settings = applyStampCommand(defaults, {
        type: 'upsert', editing: true,
        asset: { ...defaults.assets[0], url: '/updated-company-seal.png' },
    });
    expect(await documentStampService.resolveUrl(settings, 'transaction', '청연', output)).toBe('/updated-company-seal.png');
    expect(getDownloadURL).not.toHaveBeenCalled();
});

it.each(['screen', 'excel'] as const)('거래명세표 %s는 설정·Storage 조회 실패 시에도 확인된 청연 직인을 사용한다', async output => {
    (getDoc as jest.Mock).mockRejectedValue(new Error('offline'));
    (getDownloadURL as jest.Mock).mockRejectedValue(new Error('offline'));
    expect(await documentStampService.getUrl('transaction', '청연', output)).toBe(LEGACY_ESTIMATE_STAMP_URL);
});
