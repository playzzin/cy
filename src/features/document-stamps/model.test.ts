import { applyStampCommand, createDefaultStampSettings, getStampCompanyScope, resolveStampAsset, STAMP_DOCUMENTS } from './model';

const custom = { id: 'new', name: '새 도장', url: '/test-stamp.png' };
const withCustom = () => applyStampCommand(createDefaultStampSettings(), { type: 'upsert', asset: custom, editing: false });

it('변경 전 회사별 증명서와 화면·엑셀 도장 기본값을 그대로 유지한다', () => {
    const settings = createDefaultStampSettings();
    expect(resolveStampAsset(settings, 'employment', '주식회사 청연이엔지')?.storagePath).toBe('청연도장.jpg');
    expect(resolveStampAsset(settings, 'termination', '다원(주)')?.storagePath).toBe('다원도장.png');
    expect(resolveStampAsset(settings, 'employment', '다른 회사')).toBeNull();
    expect(resolveStampAsset(settings, 'employment', null)).toBeNull();
    for (const type of ['estimate', 'transaction'] as const) {
        expect(resolveStampAsset(settings, type, '공급사')?.id).toBe('legacy-cheongyeon');
        expect(resolveStampAsset(settings, type, '공급사', 'excel')?.id).toBe('legacy-round');
    }
});

it('회사의 표기 차이를 정규화하고 회사·문서 지정이 공통보다 우선한다', () => {
    expect(getStampCompanyScope('㈜ 테스트 회사')).toBe(getStampCompanyScope('테스트회사(주)'));
    let settings = withCustom();
    settings = applyStampCommand(settings, { type: 'assign', scope: 'global', document: 'default', id: custom.id });
    settings = applyStampCommand(settings, { type: 'assign', scope: 'company-dawon', document: 'default', id: 'legacy-dawon' });
    settings = applyStampCommand(settings, { type: 'assign', scope: 'company-dawon', document: 'termination', id: 'legacy-round' });
    expect(resolveStampAsset(settings, 'employment', '청연')?.id).toBe(custom.id);
    expect(resolveStampAsset(settings, 'employment', '다원')?.id).toBe('legacy-dawon');
    expect(resolveStampAsset(settings, 'termination', '다원')?.id).toBe('legacy-round');
});

it('전체 변경은 모든 회사의 기존 개별 지정을 해제하고 화면과 엑셀 모두에 적용한다', () => {
    const settings = withCustom();
    settings.profiles = { 'company-dawon': { default: 'legacy-dawon', estimate: 'legacy-round' } };
    const next = applyStampCommand(settings, { type: 'applyAll', scope: 'global', id: custom.id });
    for (const company of ['청연', '다원', '신규 회사']) for (const { key } of STAMP_DOCUMENTS) {
        expect(resolveStampAsset(next, key, company)?.id).toBe(custom.id);
        expect(resolveStampAsset(next, key, company, 'excel')?.id).toBe(custom.id);
    }
    expect(settings.profiles['company-dawon'].estimate).toBe('legacy-round');
});

it('회사 전체 변경은 다른 회사의 설정을 보존한다', () => {
    const settings = applyStampCommand(withCustom(), { type: 'applyAll', scope: 'company-cheongyeon', id: custom.id });
    expect(resolveStampAsset(settings, 'employment', '청연')?.id).toBe(custom.id);
    expect(resolveStampAsset(settings, 'employment', '다원')?.id).toBe('legacy-dawon');
});

it('같은 도장의 이미지를 수정하면 기존 연결을 유지한다', () => {
    let settings = applyStampCommand(withCustom(), { type: 'applyAll', scope: 'global', id: custom.id });
    settings = applyStampCommand(settings, { type: 'upsert', asset: { ...custom, url: '/replacement.png' }, editing: true });
    expect(resolveStampAsset(settings, 'estimate', '청연')?.url).toBe('/replacement.png');
    expect(settings.assets.filter(asset => asset.id === custom.id)).toHaveLength(1);
});

it('삭제 시 명시적 연결과 기존 기본 도장 연결을 대체하고 대체 없는 삭제는 복원하지 않는다', () => {
    let settings = withCustom();
    settings.profiles.global = { default: 'legacy-cheongyeon' };
    settings = applyStampCommand(settings, { type: 'delete', id: 'legacy-cheongyeon', replacementId: custom.id });
    expect(resolveStampAsset(settings, 'employment', '청연')?.id).toBe(custom.id);
    expect(settings.assets.some(asset => asset.id === 'legacy-cheongyeon')).toBe(false);
    const removed = applyStampCommand(createDefaultStampSettings(), { type: 'delete', id: 'legacy-dawon', replacementId: '' });
    expect(resolveStampAsset(removed, 'termination', '다원')).toBeNull();
    expect(() => applyStampCommand(removed, { type: 'assign', scope: 'global', document: 'default', id: 'missing' })).toThrow('도장이 없습니다');
    expect(() => applyStampCommand(removed, { type: 'upsert', asset: custom, editing: true })).toThrow('삭제된 도장');
});
