import { BANK_CODES } from '../constants/payroll.constants';

export const normalizePayrollBankKey = (value: unknown): string => {
    const collapsed = String(value ?? '')
        .trim()
        .replace(/\s+/g, '')
        .replace(/[[\](){}]/g, '')
        .toUpperCase();

    return collapsed
        .replace(/^\d{3}[-_]?/, '')
        .replace(/[-_]?\d{3}$/, '');
};

const bankCodeByName = new Map<string, string>();
const bankNameKeyEntries: Array<{ nameKey: string; code: string }> = [];

Object.entries(BANK_CODES).forEach(([rawCode, rawName]) => {
    const code = String(rawCode ?? '').trim();
    const name = String(rawName ?? '').trim();
    if (!/^\d{3}$/.test(code)) return;

    const normalizedName = normalizePayrollBankKey(name);
    if (!normalizedName) return;

    bankCodeByName.set(normalizedName, code);
    bankNameKeyEntries.push({ nameKey: normalizedName, code });

    const withoutInstitutionType = normalizePayrollBankKey(
        name.replace(/은행|증권|중앙회|저축은행/g, '')
    );
    if (withoutInstitutionType && withoutInstitutionType !== normalizedName) {
        bankNameKeyEntries.push({ nameKey: withoutInstitutionType, code });
    }
});

[
    ['국민', '004'],
    ['국민은행', '004'],
    ['KB국민', '004'],
    ['KB국민은행', '004'],
].forEach(([name, code]) => bankCodeByName.set(normalizePayrollBankKey(name), code));

bankNameKeyEntries.sort((a, b) => b.nameKey.length - a.nameKey.length);

/**
 * 급여 원천자료에 은행코드가 비어 있어도 저장된 은행명으로 표준 3자리 코드를 찾는다.
 * 이름이 여러 금융기관과 겹치면 은행을 우선하되 하나로 확정할 수 없으면 빈 값을 반환한다.
 */
export const resolvePayrollBankCode = (bankName?: string, bankCode?: string): string => {
    const explicitCode = String(bankCode ?? '').trim();
    if (/^\d{3}$/.test(explicitCode)) return explicitCode;

    const rawBankName = String(bankName ?? '').trim();
    if (/^\d{3}$/.test(rawBankName)) return rawBankName;

    const normalizedName = normalizePayrollBankKey(bankName);
    if (!normalizedName) return '';

    const exact = bankCodeByName.get(normalizedName);
    if (exact) return exact;

    const candidateCodes = new Set<string>();
    bankNameKeyEntries.forEach(({ nameKey, code }) => {
        if (normalizedName.includes(nameKey) || nameKey.includes(normalizedName)) {
            candidateCodes.add(code);
        }
    });

    if (candidateCodes.size === 1) return Array.from(candidateCodes)[0];
    if (candidateCodes.size === 0) return '';

    const ranked = Array.from(candidateCodes)
        .map((code) => {
            const officialName = String(BANK_CODES[code] ?? '');
            const officialKey = normalizePayrollBankKey(officialName);
            let score = 0;

            if (/은행|뱅크/.test(officialName)) score += 40;
            if (/저축은행/.test(officialName)) score -= 15;
            if (/증권|선물/.test(officialName)) score -= 20;
            if (officialKey === normalizedName) score += 50;
            else if (officialKey.startsWith(normalizedName)) score += 20;
            else if (officialKey.includes(normalizedName)) score += 10;

            return { code, score };
        })
        .sort((a, b) => b.score - a.score);

    return ranked[0] && (ranked.length === 1 || ranked[0].score > ranked[1].score)
        ? ranked[0].code
        : '';
};
