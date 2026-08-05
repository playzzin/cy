import type { Company } from '../services/companyService';

export const COMPANY_TYPE_OPTIONS: ReadonlyArray<{ value: Company['type']; label: string }> = [
    { value: '미지정', label: '미지정' },
    { value: '시공사', label: '시공' },
    { value: '협력사', label: '협력' },
    { value: '건설사', label: '건설' },
    { value: '임대사', label: '임대' },
    { value: '기타', label: '기타' },
];

const COMPANY_TYPE_LABELS = new Map(COMPANY_TYPE_OPTIONS.map(({ value, label }) => [value, label]));

export const getCompanyTypeLabel = (type: Company['type'] | string | null | undefined): string => {
    const value = String(type || '').trim();
    return COMPANY_TYPE_LABELS.get(value as Company['type']) || value || '미지정';
};
