export interface ManpowerDbSynonymGroup {
    canonical: string;
    terms: string[];
}

export const MANPOWER_DB_SYNONYM_GROUPS: ManpowerDbSynonymGroup[] = [
    { canonical: '출역', terms: ['출역', '투입', '근무', '일보에나옴', '일보등장', '일한', '나온'] },
    { canonical: '계좌없음', terms: ['계좌없음', '계좌없는', '계좌누락', '계좌미등록', '계좌가없는', '계좌번호없음'] },
    { canonical: '재직자', terms: ['재직자', '재직', '현재근무자', '근무중', '근무자'] },
    { canonical: '퇴사자', terms: ['퇴사자', '퇴사', '퇴직자', '퇴직'] },
    { canonical: '담당팀', terms: ['담당팀', '배정팀', '책임팀', '담당하는팀', '맡은팀'] },
    { canonical: '지원온곳', terms: ['지원온곳', '온곳', '들어온지원', '지원받은곳', '지원받은', '받은지원', '받은곳'] },
    { canonical: '지원간곳', terms: ['지원간곳', '간곳', '나간지원', '지원보낸곳', '지원간', '보낸지원', '보낸곳'] },
    { canonical: '외부지원', terms: ['외부지원', '외부팀', '외부인력', '타사팀', '협력사팀', '용역팀'] },
    { canonical: '내부지원', terms: ['내부지원', '내부팀', '우리팀', '청연팀', '자사팀'] },
    { canonical: '현장', terms: ['현장', '공사현장', '사이트'] },
    { canonical: '회사', terms: ['회사', '업체', '거래처', '협력사', '시공사'] },
    { canonical: '작업자', terms: ['작업자', '근로자', '인력', '사람', '직원'] },
    { canonical: '급증', terms: ['급증', '증가', '늘어난', '늘어남', '많아진', '상승'] },
    { canonical: '감소', terms: ['감소', '줄어든', '줄어듦', '줄어든', '적어진', '하락'] },
];

const COMPANY_PREFIX_PATTERN = /주식회사|유한회사|\(주\)|㈜|주\)|\(유\)|유\)/g;
const SPECIAL_CHARS_PATTERN = /[\s\-_.,/\\()[\]{}（）·]/g;

export const normalizeSearchText = (value: unknown): string => String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(COMPANY_PREFIX_PATTERN, '')
    .replace(SPECIAL_CHARS_PATTERN, '');

export const compactQuestionText = (value: unknown): string => String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

export const normalizeQuestionText = (question: string): string => {
    let normalized = compactQuestionText(question);
    MANPOWER_DB_SYNONYM_GROUPS.forEach((group) => {
        group.terms.forEach((term) => {
            const normalizedTerm = normalizeSearchText(term);
            if (normalizedTerm) {
                normalized = normalized.split(normalizedTerm).join(group.canonical);
            }
        });
    });
    return normalized;
};

export const expandSearchTerms = (term: string): string[] => {
    const normalizedTerm = normalizeSearchText(term);
    const matched = MANPOWER_DB_SYNONYM_GROUPS.find((group) =>
        normalizeSearchText(group.canonical) === normalizedTerm ||
        group.terms.some((item) => normalizeSearchText(item) === normalizedTerm)
    );

    const terms = matched ? [matched.canonical, ...matched.terms] : [term];
    return Array.from(new Set(terms.map(normalizeSearchText).filter(Boolean)));
};

export const hasNormalizedToken = (question: string, tokens: string[]): boolean => {
    const normalized = normalizeQuestionText(question);
    return tokens.some((token) => normalized.includes(normalizeSearchText(token)));
};

export const stripQueryNoise = (value: string): string => value
    .replace(/정보|보여줘|알려줘|조회|검색|목록|리스트|찾아줘|출력|확인/g, '')
    .replace(/중|에서|으로|를|을|이|가|은|는|의|관련|포함된|포함/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
