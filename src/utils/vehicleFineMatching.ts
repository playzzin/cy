import type { Vehicle } from '../types/vehicle';
import type { VehicleFineNoticeAnalysis } from '../types/vehicleFineImport';

export interface VehicleFineMatchCandidate {
    vehicleId: string;
    licensePlate: string;
    model: string;
    score: number;
    reason: string;
}

export interface VehicleFineMatchResult {
    selectedVehicleId: string;
    status: 'auto_matched' | 'needs_review' | 'no_match';
    confidence: number;
    candidates: VehicleFineMatchCandidate[];
    warnings: string[];
    matchedLicensePlate?: string;
}

export const normalizeVehiclePlate = (value: unknown): string => String(value ?? '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^0-9A-Z\uAC00-\uD7A3]/g, '');

const PLATE_PATTERN = /\d{2,3}[\s-]*[\uAC00-\uD7A3A-Z][\s-]*\d{4}/gi;
const OCR_PLATE_PATTERN = /[0-9A-Z]{2,3}[\s-]*[\uAC00-\uD7A3A-Z][\s-]*[0-9A-Z]{4}/gi;
const NORMALIZED_PLATE_PATTERN = /^\d{2,3}[\uAC00-\uD7A3A-Z]\d{4}$/;
const OCR_DIGIT_REPLACEMENTS: Record<string, string> = {
    O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', G: '6', T: '7', B: '8',
};

const repairNumericSegment = (value: string): string => Array.from(value).map((character) => (
    /\d/.test(character) ? character : OCR_DIGIT_REPLACEMENTS[character] || ''
)).join('');

const normalizePlateCandidate = (value: unknown): string => {
    const text = String(value ?? '').normalize('NFKC').toUpperCase();
    const strictMatch = text.match(PLATE_PATTERN)?.[0];
    if (strictMatch) return normalizeVehiclePlate(strictMatch);

    const embedded = text.match(OCR_PLATE_PATTERN)?.[0] || text;
    const compact = normalizeVehiclePlate(embedded);
    const prefixLength = compact.length - 5;
    if (prefixLength !== 2 && prefixLength !== 3) return '';
    const prefix = repairNumericSegment(compact.slice(0, prefixLength));
    const vehicleLetter = compact.slice(prefixLength, prefixLength + 1);
    const suffix = repairNumericSegment(compact.slice(prefixLength + 1));
    if (prefix.length !== prefixLength || suffix.length !== 4) return '';
    const normalized = `${prefix}${vehicleLetter}${suffix}`;
    return NORMALIZED_PLATE_PATTERN.test(normalized) ? normalized : '';
};

export const extractVehiclePlateCandidates = (value: unknown): string[] => {
    const values = Array.isArray(value) ? value : [value];
    return Array.from(new Set(values
        .flatMap((item) => {
            const text = String(item ?? '').normalize('NFKC');
            const matches = text.match(PLATE_PATTERN) || text.match(OCR_PLATE_PATTERN);
            return matches && matches.length > 0 ? matches : [text];
        })
        .map(normalizePlateCandidate)
        .filter(Boolean)))
        .slice(0, 3);
};

const getLastFourDigits = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 4 ? digits.slice(-4) : '';
};

const getCharacterDistance = (left: string, right: string): number => {
    const leftCharacters = Array.from(left);
    const rightCharacters = Array.from(right);
    if (leftCharacters.length !== rightCharacters.length) return Number.POSITIVE_INFINITY;
    return leftCharacters.reduce((distance, character, index) => (
        distance + (character === rightCharacters[index] ? 0 : 1)
    ), 0);
};

const isSafeOcrNearMatch = (noticePlate: string, vehiclePlate: string): boolean => {
    if (getCharacterDistance(noticePlate, vehiclePlate) !== 1) return false;
    return noticePlate.slice(-4) === vehiclePlate.slice(-4)
        || noticePlate.slice(0, -4) === vehiclePlate.slice(0, -4);
};

export const matchVehicleFineNoticeToVehicle = (
    notice: Pick<VehicleFineNoticeAnalysis,
        'licensePlate' | 'licensePlateCandidates' | 'chargedTargetPlate' |
        'violationVehiclePlate' | 'plateImagePlate' | 'plateSource' | 'plateConfidence'>,
    vehicles: Vehicle[],
): VehicleFineMatchResult => {
    const labelledPlates = extractVehiclePlateCandidates([
        notice.chargedTargetPlate,
        notice.violationVehiclePlate,
    ]);
    const primaryPlates = extractVehiclePlateCandidates(notice.licensePlate);
    const imagePlates = extractVehiclePlateCandidates(notice.plateImagePlate);
    const otherCandidates = extractVehiclePlateCandidates(notice.licensePlateCandidates || []);
    const noticePlates = Array.from(new Set([
        ...labelledPlates,
        ...primaryPlates,
        ...imagePlates,
        ...otherCandidates,
    ]));
    if (noticePlates.length === 0) {
        return {
            selectedVehicleId: '',
            status: 'no_match',
            confidence: 0,
            candidates: [],
            warnings: ['고지서에서 차량번호를 읽지 못했습니다.'],
        };
    }

    const preferredPlates = labelledPlates.length > 0
        ? labelledPlates
        : primaryPlates.length > 0 ? primaryPlates : imagePlates;
    const exact = vehicles.filter((vehicle) => noticePlates.includes(normalizeVehiclePlate(vehicle.licensePlate)));
    const preferredExact = vehicles.filter((vehicle) => preferredPlates.includes(normalizeVehiclePlate(vehicle.licensePlate)));
    const uniqueExactIds = new Set(exact.map((vehicle) => String(vehicle.id)));
    const uniquePreferredExactIds = new Set(preferredExact.map((vehicle) => String(vehicle.id)));
    const hasConflictingPlateCandidates = noticePlates.length > 1;
    const hasConflictingLabelCandidates = labelledPlates.length > 1;
    if (uniquePreferredExactIds.size === 1 && !hasConflictingLabelCandidates) {
        const matchedVehicle = preferredExact.find((vehicle) => uniquePreferredExactIds.has(String(vehicle.id)))!;
        const requiresReview = hasConflictingPlateCandidates
            || notice.plateSource === 'PLATE_IMAGE'
            || (notice.plateConfidence !== undefined && notice.plateConfidence < 0.78);
        return {
            selectedVehicleId: String(matchedVehicle.id),
            status: requiresReview ? 'needs_review' : 'auto_matched',
            confidence: requiresReview ? Math.max(0.8, Number(notice.plateConfidence || 0)) : 1,
            candidates: [{
                vehicleId: String(matchedVehicle.id),
                licensePlate: matchedVehicle.licensePlate,
                model: matchedVehicle.model,
                score: requiresReview ? 0.9 : 1,
                reason: requiresReview
                    ? '대장 차량번호 일치, 판독 근거 확인 필요'
                    : '위반차량/부과대상 번호 정확 일치',
            }],
            warnings: requiresReview
                ? ['대장 차량을 추천했습니다. 부과대상·위반차량·사진 번호판 근거를 확인해 주세요.']
                : [],
            matchedLicensePlate: requiresReview ? undefined : matchedVehicle.licensePlate,
        };
    }

    if (
        uniqueExactIds.size === 1
        && noticePlates.length === 1
        && !hasConflictingLabelCandidates
        && notice.plateSource !== 'PLATE_IMAGE'
        && (notice.plateConfidence === undefined || notice.plateConfidence >= 0.78)
    ) {
        const matchedVehicle = exact.find((vehicle) => uniqueExactIds.has(String(vehicle.id)))!;
        return {
            selectedVehicleId: String(matchedVehicle.id),
            status: 'auto_matched',
            confidence: 1,
            candidates: [{
                vehicleId: String(matchedVehicle.id),
                licensePlate: matchedVehicle.licensePlate,
                model: matchedVehicle.model,
                score: 1,
                reason: '차량번호 후보 대장 정확 일치',
            }],
            warnings: [],
            matchedLicensePlate: matchedVehicle.licensePlate,
        };
    }

    if (uniqueExactIds.size === 1 && !hasConflictingLabelCandidates) {
        const matchedVehicle = exact.find((vehicle) => uniqueExactIds.has(String(vehicle.id)))!;
        return {
            selectedVehicleId: String(matchedVehicle.id),
            status: 'needs_review',
            confidence: 0.88,
            candidates: [{
                vehicleId: String(matchedVehicle.id),
                licensePlate: matchedVehicle.licensePlate,
                model: matchedVehicle.model,
                score: 0.88,
                reason: '후보 중 대장 차량번호가 한 대만 일치',
            }],
            warnings: ['서로 다른 판독 후보 중 대장과 일치하는 차량을 추천했습니다. 원본 번호를 확인해 주세요.'],
        };
    }

    const nearMatches = vehicles.filter((vehicle) => {
        const vehiclePlate = normalizeVehiclePlate(vehicle.licensePlate);
        return noticePlates.some((plate) => isSafeOcrNearMatch(plate, vehiclePlate));
    });
    const uniqueNearIds = new Set(nearMatches.map((vehicle) => String(vehicle.id)));
    if (uniqueNearIds.size === 1 && !hasConflictingLabelCandidates) {
        const matchedVehicle = nearMatches.find((vehicle) => uniqueNearIds.has(String(vehicle.id)))!;
        return {
            selectedVehicleId: String(matchedVehicle.id),
            status: 'needs_review',
            confidence: 0.78,
            candidates: [{
                vehicleId: String(matchedVehicle.id),
                licensePlate: matchedVehicle.licensePlate,
                model: matchedVehicle.model,
                score: 0.78,
                reason: '차량번호 한 글자 OCR 유사',
            }],
            warnings: ['차량번호 한 글자가 다르지만 나머지 번호가 일치하는 대장 차량을 추천했습니다. 반드시 원본을 확인해 주세요.'],
        };
    }

    const lastFour = new Set(noticePlates.map(getLastFourDigits).filter(Boolean));
    const candidates = vehicles
        .map((vehicle): VehicleFineMatchCandidate | null => {
            const vehiclePlate = normalizeVehiclePlate(vehicle.licensePlate);
            const exactCandidate = noticePlates.includes(vehiclePlate);
            const sameLastFour = lastFour.has(getLastFourDigits(vehiclePlate));
            const partialCandidate = noticePlates.some((plate) => vehiclePlate.includes(plate) || plate.includes(vehiclePlate));
            if (!exactCandidate && !sameLastFour && !partialCandidate) return null;
            const score = exactCandidate ? 1 : sameLastFour ? 0.62 : 0.5;
            return {
                vehicleId: String(vehicle.id),
                licensePlate: vehicle.licensePlate,
                model: vehicle.model,
                score,
                reason: exactCandidate
                    ? '위반차량/부과대상 후보 일치'
                    : sameLastFour ? '끝 4자리 일치, 수동 확인 필요' : '차량번호 일부 일치',
            };
        })
        .filter((candidate): candidate is VehicleFineMatchCandidate => Boolean(candidate))
        .sort((left, right) => right.score - left.score || left.licensePlate.localeCompare(right.licensePlate, 'ko'))
        .slice(0, 5);

    if (uniqueExactIds.size > 1) {
        exact.forEach((vehicle) => {
            if (!candidates.some((candidate) => candidate.vehicleId === String(vehicle.id))) {
                candidates.unshift({
                    vehicleId: String(vehicle.id),
                    licensePlate: vehicle.licensePlate,
                    model: vehicle.model,
                    score: 1,
                    reason: '동일 차량번호가 여러 대 등록됨',
                });
            }
        });
    }

    const warnings = hasConflictingPlateCandidates && exact.length > 0
        ? ['위반차량/부과대상 후보가 서로 달라 자동 연결하지 않았습니다.']
        : uniqueExactIds.size > 1
            ? ['동일한 차량번호가 여러 대장에 있어 자동 연결하지 않았습니다.']
            : ['차량번호 전체 일치가 없어 직접 차량을 선택해야 합니다.'];

    return {
        selectedVehicleId: '',
        status: candidates.length > 0 ? 'needs_review' : 'no_match',
        confidence: candidates[0]?.score ?? 0,
        candidates,
        warnings,
    };
};

export const isManualVehicleFineMatch = (
    extractedPlate: string,
    selectedVehicle?: Pick<Vehicle, 'licensePlate'> | null,
): boolean => Boolean(selectedVehicle)
    && normalizeVehiclePlate(extractedPlate) !== normalizeVehiclePlate(selectedVehicle?.licensePlate);
