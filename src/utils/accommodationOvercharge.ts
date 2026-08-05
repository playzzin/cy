import type { Accommodation, UtilityRecord } from '../types/accommodation';

export const ACCOMMODATION_OVERCHARGE_MEMO_PREFIX = '[과청구 자동]';

const DEFAULT_OVERCHARGE_THRESHOLDS: Partial<Record<Accommodation['type'], number>> = {
    TwoRoom: 200_000,
    ThreeRoom: 300_000
};

const ACCOMMODATION_TYPE_LABELS: Partial<Record<Accommodation['type'], string>> = {
    TwoRoom: '투룸',
    ThreeRoom: '쓰리룸'
};

export interface AccommodationOverchargeSummary {
    type: 'TwoRoom' | 'ThreeRoom';
    typeLabel: string;
    utilityTotal: number;
    threshold: number;
    exceededAmount: number;
}

const toSafeAmount = (value: unknown): number => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export const getUtilityOnlyTotal = (record: Pick<UtilityRecord, 'costs'>): number => (
    toSafeAmount(record.costs.electricity)
    + toSafeAmount(record.costs.gas)
    + toSafeAmount(record.costs.water)
    + toSafeAmount(record.costs.internet)
    + toSafeAmount(record.costs.maintenance)
    + toSafeAmount(record.costs.other)
);

export const getDefaultAccommodationOverchargeThreshold = (
    type?: Accommodation['type'] | null
): number | null => (
    type ? DEFAULT_OVERCHARGE_THRESHOLDS[type] ?? null : null
);

export const getAccommodationOvercharge = (
    record: Pick<UtilityRecord, 'costs'>,
    accommodation?: Pick<Accommodation, 'type' | 'utilityOverchargeThreshold'> | null
): AccommodationOverchargeSummary | null => {
    const type = accommodation?.type;
    if (type !== 'TwoRoom' && type !== 'ThreeRoom') return null;

    const configuredThreshold = toSafeAmount(accommodation?.utilityOverchargeThreshold);
    const threshold = configuredThreshold > 0
        ? configuredThreshold
        : getDefaultAccommodationOverchargeThreshold(type);
    if (!threshold) return null;

    const utilityTotal = getUtilityOnlyTotal(record);
    if (utilityTotal < threshold) return null;

    return {
        type,
        typeLabel: ACCOMMODATION_TYPE_LABELS[type] ?? type,
        utilityTotal,
        threshold,
        exceededAmount: Math.max(0, utilityTotal - threshold)
    };
};

export const stripAccommodationOverchargeMemo = (memo?: string): string => (
    String(memo ?? '')
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith(ACCOMMODATION_OVERCHARGE_MEMO_PREFIX))
        .join('\n')
        .trim()
);

export const formatAccommodationOverchargeMemo = (
    summary: AccommodationOverchargeSummary
): string => (
    `${ACCOMMODATION_OVERCHARGE_MEMO_PREFIX} ${summary.typeLabel} 공과금 `
    + `${summary.utilityTotal.toLocaleString('ko-KR')}원 / 기준 `
    + `${summary.threshold.toLocaleString('ko-KR')}원 / 초과액 `
    + `${summary.exceededAmount.toLocaleString('ko-KR')}원`
);

export const syncAccommodationOverchargeMemo = (
    memo: string | undefined,
    summary: AccommodationOverchargeSummary | null
): string => {
    const manualMemo = stripAccommodationOverchargeMemo(memo);
    if (!summary) return manualMemo;

    const automaticMemo = formatAccommodationOverchargeMemo(summary);
    return manualMemo ? `${automaticMemo}\n${manualMemo}` : automaticMemo;
};
