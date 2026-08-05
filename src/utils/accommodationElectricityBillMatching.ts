import { Accommodation } from '../types/accommodation';
import {
    AccommodationElectricityBillMatchCandidate,
    AccommodationElectricityBillMatchResult,
} from '../types/accommodationElectricityBillImport';

interface AccommodationUtilityBillMatchSource {
    address: string;
    housingName: string;
}

const COMMON_ADDRESS_TOKENS = new Set([
    '대한민국', '경기도', '서울특별시', '인천광역시', '안산시', '단원구', '상록구',
    '경기', '서울', '인천', '번지', '사동', '와동',
]);

export const normalizeAccommodationMatchText = (value: unknown): string => String(value ?? '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/주식회사|\(주\)/g, '')
    .replace(/[^0-9a-z가-힣]/g, '');

const tokenizeAddress = (value: unknown): string[] => String(value ?? '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[(),]/g, ' ')
    .split(/[^0-9a-z가-힣-]+/)
    .map((token) => token.trim())
    .filter((token) => (
        token.length > 1
        && !COMMON_ADDRESS_TOKENS.has(token)
        && !/^(?:좌|우)\d+$/.test(token)
    ));

const getBigrams = (value: string): Set<string> => {
    const result = new Set<string>();
    for (let index = 0; index < value.length - 1; index += 1) {
        result.add(value.slice(index, index + 2));
    }
    return result;
};

const diceSimilarity = (left: string, right: string): number => {
    if (!left || !right) return 0;
    if (left === right) return 1;
    if (left.length >= 8 && right.length >= 8 && (left.includes(right) || right.includes(left))) return 0.93;

    const leftBigrams = getBigrams(left);
    const rightBigrams = getBigrams(right);
    if (leftBigrams.size === 0 || rightBigrams.size === 0) return 0;
    let overlap = 0;
    leftBigrams.forEach((entry) => {
        if (rightBigrams.has(entry)) overlap += 1;
    });
    return (2 * overlap) / (leftBigrams.size + rightBigrams.size);
};

const extractUnitTokens = (value: unknown): string[] => {
    const source = String(value ?? '').normalize('NFKC');
    const tokens = new Set<string>();
    const roomMatches = source.matchAll(/(?:\d{1,4}동\s*)?(\d{1,4})호/g);
    for (const match of roomMatches) tokens.add(`${match[1]}호`);

    const plainName = source.trim().match(/^(\d{2,4})$/);
    if (plainName) tokens.add(`${plainName[1]}호`);
    return Array.from(tokens);
};

const extractParcelTokens = (value: unknown): string[] => {
    const source = String(value ?? '').toLowerCase().normalize('NFKC');
    const tokens = new Set<string>();
    const matches = source.matchAll(/([가-힣]{1,12}(?:동|리))\s*(\d{1,4}(?:-\d{1,4})?)/g);
    for (const match of matches) tokens.add(`${match[1]}:${match[2]}`);
    return Array.from(tokens);
};

const extractRoadAddressTokens = (value: unknown): string[] => {
    const source = String(value ?? '').toLowerCase().normalize('NFKC');
    const tokens = new Set<string>();
    const matches = source.matchAll(/([0-9a-z가-힣]{1,24}(?:로|길))\s*(\d{1,4}(?:-\d{1,4})?)/g);
    for (const match of matches) tokens.add(`${match[1]}:${match[2]}`);
    return Array.from(tokens);
};

const hasSharedToken = (left: string[], right: string[]): boolean => {
    const rightSet = new Set(right);
    return left.some((token) => rightSet.has(token));
};

const getImportantAddressTokenOverlap = (left: unknown, right: unknown): number => {
    const leftTokens = new Set(tokenizeAddress(left));
    const rightTokens = new Set(tokenizeAddress(right));
    if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

    let weightedMatches = 0;
    let weightedTotal = 0;
    leftTokens.forEach((token) => {
        const weight = /\d/.test(token) ? 2 : 1;
        weightedTotal += weight;
        if (rightTokens.has(token)) weightedMatches += weight;
    });
    return weightedTotal > 0 ? weightedMatches / weightedTotal : 0;
};

const buildCandidate = (
    bill: AccommodationUtilityBillMatchSource,
    accommodation: Accommodation,
): AccommodationElectricityBillMatchCandidate => {
    const billAddressSource = `${bill.address} ${bill.housingName}`.trim();
    const accommodationAddressSource = `${accommodation.address} ${accommodation.name}`.trim();
    const billAddress = normalizeAccommodationMatchText(bill.address);
    const accommodationAddress = normalizeAccommodationMatchText(accommodation.address);
    const addressScore = Math.max(
        diceSimilarity(billAddress, accommodationAddress),
        diceSimilarity(
            normalizeAccommodationMatchText(billAddressSource),
            normalizeAccommodationMatchText(accommodationAddressSource),
        ),
        diceSimilarity(billAddress, normalizeAccommodationMatchText(accommodation.name)),
    );
    const tokenOverlap = Math.max(
        getImportantAddressTokenOverlap(bill.address, accommodation.address),
        getImportantAddressTokenOverlap(billAddressSource, accommodationAddressSource),
    );

    const billName = normalizeAccommodationMatchText(bill.housingName);
    const accommodationName = normalizeAccommodationMatchText(accommodation.name);
    const nameExact = Boolean(billName && accommodationName && billName === accommodationName);
    const nameContained = Boolean(
        billName && accommodationName && (billName.includes(accommodationName) || accommodationName.includes(billName)),
    );

    const billUnits = new Set(extractUnitTokens(billAddressSource));
    const accommodationUnits = new Set(extractUnitTokens(accommodationAddressSource));
    const unitMatched = Array.from(billUnits).some((unit) => accommodationUnits.has(unit));
    const parcelMatched = hasSharedToken(
        extractParcelTokens(billAddressSource),
        extractParcelTokens(accommodationAddressSource),
    );
    const roadAddressMatched = hasSharedToken(
        extractRoadAddressTokens(billAddressSource),
        extractRoadAddressTokens(accommodationAddressSource),
    );
    const strongLocationAndUnitMatch = unitMatched && (parcelMatched || roadAddressMatched);

    let score = addressScore * 0.64 + tokenOverlap * 0.14;
    const reasons: string[] = [];
    if (addressScore >= 0.92) reasons.push('주소 일치');
    else if (addressScore >= 0.62) reasons.push('주소 유사');
    if (tokenOverlap >= 0.7) reasons.push('도로명/번지 일치');
    if (unitMatched) {
        score += 0.18;
        reasons.push('호수 일치');
    }
    if (parcelMatched) {
        score += 0.12;
        reasons.push('지번 일치');
    }
    if (roadAddressMatched) {
        score += 0.1;
        reasons.push('도로명 주소 일치');
    }
    if (strongLocationAndUnitMatch) {
        score += 0.22;
        reasons.push(parcelMatched ? '지번+호수 일치' : '도로명+호수 일치');
    }
    if (tokenOverlap >= 0.9 && unitMatched) {
        score += 0.2;
        reasons.push('축약 주소 일치');
    }
    if (nameExact) {
        score += 0.12;
        reasons.push('숙소명 일치');
    } else if (nameContained) {
        score += 0.07;
        reasons.push('숙소명 유사');
    }

    if (addressScore < 0.35 && tokenOverlap < 0.4) score *= 0.55;

    return {
        accommodationId: accommodation.id,
        accommodationName: accommodation.name,
        accommodationAddress: accommodation.address,
        score: Number(Math.min(1, Math.max(0, score)).toFixed(3)),
        addressScore: Number(addressScore.toFixed(3)),
        reasons,
    };
};

export const matchElectricityBillToAccommodation = (
    bill: AccommodationUtilityBillMatchSource,
    accommodations: Accommodation[],
): AccommodationElectricityBillMatchResult => {
    const candidates = accommodations
        .map((accommodation) => buildCandidate(bill, accommodation))
        .filter((candidate) => candidate.score >= 0.18)
        .sort((left, right) => right.score - left.score)
        .slice(0, 5);

    const first = candidates[0];
    const second = candidates[1];
    const margin = first ? first.score - (second?.score ?? 0) : 0;
    const hasBillAddress = normalizeAccommodationMatchText(bill.address).length >= 6;
    const hasBillUnit = extractUnitTokens(`${bill.housingName} ${bill.address}`).length > 0;
    const strongIdentityCandidates = candidates.filter((candidate) => (
        candidate.reasons.includes('지번+호수 일치')
        || candidate.reasons.includes('도로명+호수 일치')
    ));
    const hasUniqueStrongIdentity = Boolean(
        first
        && strongIdentityCandidates.length === 1
        && strongIdentityCandidates[0].accommodationId === first.accommodationId,
    );
    const hasAddressEvidence = Boolean(first && (
        first.reasons.includes('지번+호수 일치')
        || first.reasons.includes('도로명+호수 일치')
        || (hasBillAddress && (
            first.addressScore >= 0.55
            || (first.reasons.includes('도로명/번지 일치') && first.reasons.includes('호수 일치'))
        ))
    ));
    const isAutoMatched = Boolean(first && hasAddressEvidence && (
        (hasUniqueStrongIdentity && first.score >= 0.64)
        || (first.score >= 0.74 && margin >= 0.08)
    ));
    const warnings: string[] = [];

    if (!first || first.score < 0.38) {
        if (!hasBillAddress && hasBillUnit) {
            warnings.push('호수만으로는 자동 매칭하지 않습니다. 청구서 주소를 확인하고 숙소를 선택해 주세요.');
        } else {
            warnings.push('주소와 숙소명을 기준으로 일치하는 숙소를 찾지 못했습니다.');
        }
        return {
            selectedAccommodationId: '',
            confidence: first?.score ?? 0,
            status: 'no_match',
            candidates,
            warnings,
        };
    }

    if (!isAutoMatched) {
        if (!hasAddressEvidence) warnings.push('호수만으로는 자동 매칭하지 않습니다. 주소를 확인해 주세요.');
        if (second && margin < 0.08) warnings.push('비슷한 숙소가 여러 개라 수동 선택이 필요합니다.');
    }

    return {
        selectedAccommodationId: isAutoMatched ? first.accommodationId : '',
        confidence: first.score,
        status: isAutoMatched ? 'auto_matched' : 'needs_review',
        candidates,
        warnings,
    };
};

export const findDuplicateAccommodationSelections = (accommodationIds: string[]): Set<string> => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    accommodationIds.map((value) => String(value || '').trim()).filter(Boolean).forEach((id) => {
        if (seen.has(id)) duplicates.add(id);
        seen.add(id);
    });
    return duplicates;
};
