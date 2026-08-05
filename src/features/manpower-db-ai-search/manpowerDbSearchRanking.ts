import { expandSearchTerms, normalizeSearchText } from './manpowerDbSynonyms';

export interface ManpowerDbRankResult {
    score: number;
    matchReason: string;
}

const fuzzySubsequenceScore = (candidate: string, keyword: string): number => {
    if (!candidate || !keyword) return 0;
    let keywordIndex = 0;
    for (let i = 0; i < candidate.length && keywordIndex < keyword.length; i += 1) {
        if (candidate[i] === keyword[keywordIndex]) keywordIndex += 1;
    }
    if (keywordIndex !== keyword.length) return 0;
    return Math.max(0.45, Math.min(0.68, keyword.length / Math.max(candidate.length, keyword.length)));
};

export const rankTextMatch = (
    candidateValue: unknown,
    keywordValue: unknown,
    label = '값'
): ManpowerDbRankResult => {
    const candidateRaw = String(candidateValue ?? '').trim();
    const keywordRaw = String(keywordValue ?? '').trim();
    const candidate = normalizeSearchText(candidateRaw);
    const keyword = normalizeSearchText(keywordRaw);

    if (!candidate || !keyword) {
        return { score: 0, matchReason: `${label} 검색어 없음` };
    }

    if (candidateRaw === keywordRaw) {
        return { score: 1, matchReason: `${label} 정확 일치` };
    }

    if (candidate === keyword) {
        return { score: 0.96, matchReason: `${label} 정규화 일치` };
    }

    if (candidate.includes(keyword)) {
        return { score: 0.88, matchReason: `${label} 포함 일치` };
    }

    if (keyword.includes(candidate)) {
        return { score: 0.78, matchReason: `${label} 역포함 일치` };
    }

    const expandedTerms = expandSearchTerms(keywordRaw);
    if (expandedTerms.some((term) => term && candidate.includes(term))) {
        return { score: 0.74, matchReason: `${label} 동의어 일치` };
    }

    const fuzzyScore = fuzzySubsequenceScore(candidate, keyword);
    if (fuzzyScore > 0) {
        return { score: fuzzyScore, matchReason: `${label} 유사 일치` };
    }

    return { score: 0, matchReason: `${label} 불일치` };
};

export const pickBestRank = (
    values: Array<{ value: unknown; label: string }>,
    keyword: unknown
): ManpowerDbRankResult => values.reduce<ManpowerDbRankResult>((best, item) => {
    const ranked = rankTextMatch(item.value, keyword, item.label);
    return ranked.score > best.score ? ranked : best;
}, { score: 0, matchReason: '일치 없음' });
