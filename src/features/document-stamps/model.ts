export const STAMP_DOCUMENTS = [
    { key: 'employment', label: '재직증명서', size: '화면 80 × 80px · 인쇄 64 × 64px' },
    { key: 'termination', label: '해촉증명서', size: '화면 80 × 80px · 인쇄 64 × 64px' },
    { key: 'estimate', label: '견적서', size: '화면 48 × 48px · 엑셀 70 × 63px' },
    { key: 'transaction', label: '거래명세서', size: '화면 48 × 48px · 엑셀 70 × 63px' },
    { key: 'receipt', label: '현금수령확인서', size: '인쇄 20 × 20mm · 개인 서명 우선' },
] as const;

export type StampDocument = typeof STAMP_DOCUMENTS[number]['key'];
export type StampProfile = Partial<Record<StampDocument | 'default', string>>;
export interface StampAsset {
    id: string;
    name: string;
    url?: string;
    storagePath?: string;
    width?: number;
    height?: number;
    builtin?: boolean;
}
export interface StampSettings {
    revision: number;
    assets: StampAsset[];
    profiles: Record<string, StampProfile>;
}

export const GLOBAL_STAMP_SCOPE = 'global';
export const ROUND_STAMP_URL = '/assets/estimate/cheongyeon-stamp-round.png';
export const createDefaultStampSettings = (): StampSettings => ({
    revision: 0,
    assets: [
        { id: 'legacy-cheongyeon', name: '청연 기본 직인', storagePath: '청연도장.jpg', builtin: true },
        { id: 'legacy-dawon', name: '다원 기본 직인', storagePath: '다원도장.png', builtin: true },
        { id: 'legacy-round', name: '청연 엑셀 원형 직인', url: ROUND_STAMP_URL, builtin: true },
    ],
    profiles: {},
});

// Estimates store the supplier name, so all document families resolve the same company key.
export const getStampCompanyScope = (companyName?: string | null): string => {
    const name = (companyName || '').replace(/주식회사|\(주\)|㈜|\s/g, '').toLowerCase();
    if (!name) return GLOBAL_STAMP_SCOPE;
    if (name.includes('청연')) return 'company-cheongyeon';
    if (name.includes('다원')) return 'company-dawon';
    return `company-${encodeURIComponent(name)}`;
};

export const resolveStampAsset = (
    settings: StampSettings,
    document: StampDocument,
    companyName?: string | null,
    output: 'screen' | 'excel' = 'screen',
): StampAsset | null => {
    const scope = getStampCompanyScope(companyName);
    const company = settings.profiles[scope] || {};
    const common = settings.profiles[GLOBAL_STAMP_SCOPE] || {};
    const explicit = company[document] || company.default || common[document] || common.default;
    if (explicit) return settings.assets.find(asset => asset.id === explicit) || null;

    // Preserve the original document-specific defaults until the user changes them.
    let legacyId: string | undefined;
    if (document === 'estimate' || document === 'transaction') {
        legacyId = output === 'excel' ? 'legacy-round' : 'legacy-cheongyeon';
    } else if (scope === 'company-cheongyeon') legacyId = 'legacy-cheongyeon';
    else if (scope === 'company-dawon') legacyId = 'legacy-dawon';
    return settings.assets.find(asset => asset.id === legacyId) || null;
};

export type StampCommand =
    | { type: 'upsert'; asset: StampAsset; editing: boolean }
    | { type: 'delete'; id: string; replacementId: string }
    | { type: 'assign'; scope: string; document: StampDocument | 'default'; id: string }
    | { type: 'applyAll'; scope: string; id: string };

export const applyStampCommand = (current: StampSettings, command: StampCommand): StampSettings => {
    const next: StampSettings = JSON.parse(JSON.stringify(current));
    const requireAsset = (id: string) => {
        if (id && !next.assets.some(asset => asset.id === id)) throw new Error('선택한 도장이 없습니다. 목록을 새로 확인해 주세요.');
    };
    if (command.type === 'upsert') {
        const index = next.assets.findIndex(asset => asset.id === command.asset.id);
        if (command.editing && index < 0) throw new Error('다른 작업에서 삭제된 도장입니다. 다시 등록해 주세요.');
        if (!command.asset.name.trim()) throw new Error('도장 이름을 입력해 주세요.');
        if (command.asset.name.length > 80) throw new Error('도장 이름은 80자까지 입력할 수 있습니다.');
        if (index < 0) {
            if (next.assets.length >= 100) throw new Error('도장은 최대 100개까지 등록할 수 있습니다.');
            next.assets.push(command.asset);
        } else next.assets[index] = command.asset;
    } else if (command.type === 'delete') {
        requireAsset(command.id);
        requireAsset(command.replacementId);
        if (command.id === command.replacementId) throw new Error('다른 대체 도장을 선택해 주세요.');
        next.assets = next.assets.filter(asset => asset.id !== command.id);
        for (const profile of Object.values(next.profiles)) {
            for (const key of Object.keys(profile) as (keyof StampProfile)[]) {
                if (profile[key] === command.id) {
                    if (command.replacementId) profile[key] = command.replacementId;
                    else delete profile[key];
                }
            }
        }
        // Replace implicit legacy usages as well as explicit assignments.
        if (command.replacementId) {
            for (const [name, scope] of [['청연', 'company-cheongyeon'], ['다원', 'company-dawon'], ['', GLOBAL_STAMP_SCOPE]]) {
                for (const { key } of STAMP_DOCUMENTS) {
                    if (resolveStampAsset(current, key, name)?.id === command.id ||
                        resolveStampAsset(current, key, name, 'excel')?.id === command.id) {
                        next.profiles[scope] = { ...next.profiles[scope], [key]: command.replacementId };
                    }
                }
            }
        }
    } else {
        requireAsset(command.id);
        if (command.type === 'applyAll') {
            if (!command.id) throw new Error('전체 적용할 도장을 선택해 주세요.');
            // Global means every company, including existing company overrides.
            if (command.scope === GLOBAL_STAMP_SCOPE) next.profiles = {};
            next.profiles[command.scope] = { default: command.id };
        } else {
            next.profiles[command.scope] = { ...next.profiles[command.scope] };
            if (command.id) next.profiles[command.scope][command.document] = command.id;
            else delete next.profiles[command.scope][command.document];
        }
    }
    next.revision++;
    return next;
};
