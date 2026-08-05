import { COMPANY_TYPE_OPTIONS, getCompanyTypeLabel } from './companyTypeLabel';

describe('company type labels', () => {
    it('uses the same short labels in registration and list views', () => {
        expect(COMPANY_TYPE_OPTIONS).toEqual([
            { value: '미지정', label: '미지정' },
            { value: '시공사', label: '시공' },
            { value: '협력사', label: '협력' },
            { value: '건설사', label: '건설' },
            { value: '임대사', label: '임대' },
            { value: '기타', label: '기타' },
        ]);
    });

    it('keeps saved values while standardizing their labels', () => {
        expect(getCompanyTypeLabel('시공사')).toBe('시공');
        expect(getCompanyTypeLabel('협력사')).toBe('협력');
        expect(getCompanyTypeLabel(undefined)).toBe('미지정');
    });
});
