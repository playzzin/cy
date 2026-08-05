import type { Company } from '../../services/companyService';
import type { SettlementTarget } from '../../services/settlementTargetService';

export interface MaterialRentalCompanyOption {
    id: string;
    name: string;
    source: 'company' | 'settlementTarget';
}

const trimText = (value: unknown): string => String(value ?? '').trim();

const normalizeOptionKey = (value: unknown): string =>
    trimText(value).replace(/\s+/g, '').toLowerCase();

export const getMaterialRentalCompanyOptionId = (option: MaterialRentalCompanyOption): string =>
    trimText(option.id || option.name);

export const buildMaterialRentalCompanyOptions = (
    companies: Company[],
    settlementTargets: SettlementTarget[] = []
): MaterialRentalCompanyOption[] => {
    const optionsByName = new Map<string, MaterialRentalCompanyOption>();

    const addOption = (option: MaterialRentalCompanyOption) => {
        const name = trimText(option.name);
        const id = trimText(option.id || name);
        if (!name || !id) return;

        const key = normalizeOptionKey(name);
        const existing = optionsByName.get(key);
        if (!existing || (existing.source === 'settlementTarget' && option.source === 'company')) {
            optionsByName.set(key, { ...option, id, name });
        }
    };

    companies
        .filter((company) => company.type === '임대사' && company.status !== 'archived')
        .forEach((company) => {
            const name = trimText(company.name);
            addOption({
                // 회사 계정의 linkedCompanyIds와 동일한 원본 ID를 저장해야 포털 범위를 정확히 비교할 수 있다.
                id: trimText(company.id || company.legacyId || name),
                name,
                source: 'company',
            });
        });

    settlementTargets
        .filter((target) => target.targetType === 'rental_company' && target.status !== 'inactive')
        .forEach((target) => {
            const name = trimText(target.companyName || target.name);
            addOption({
                id: `settlementTarget:${trimText(target.id || target.companyId || name)}`,
                name,
                source: 'settlementTarget',
            });
        });

    return Array.from(optionsByName.values())
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
};
