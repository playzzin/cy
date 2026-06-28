import type { DailyReportWorkerRow } from '../services/dailyReportService';
import type { Site } from '../services/siteService';
import type {
    ProgressAllocation,
    ProgressAllocationCalculatedRow,
    ProgressClaim,
    ProgressClaimLine,
    ProgressClaimSummary,
    ProgressContract,
    ProgressContractItem,
    ProgressDailyManDaySummary,
    ProgressItemCalculatedRow,
    ProgressTeamPositionMode,
    ProgressVatMode,
    ProgressVatSummary,
} from '../types/progressClaim';

export const toProgressNumber = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const normalized = value.replace(/,/g, '').trim();
        if (!normalized) return 0;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

export const roundMoney = (value: unknown): number => Math.round(toProgressNumber(value));

export const roundQuantity = (value: unknown): number => {
    const n = toProgressNumber(value);
    return Math.round(n * 1000) / 1000;
};

const normalizeRate = (value: unknown): number => {
    const rate = toProgressNumber(value);
    if (rate > 1 && rate <= 100) return rate / 100;
    return rate;
};

export const formatProgressMoney = (value: unknown): string =>
    roundMoney(value).toLocaleString('ko-KR');

export const formatProgressQuantity = (value: unknown): string => {
    const n = roundQuantity(value);
    return Number.isInteger(n) ? n.toLocaleString('ko-KR') : n.toLocaleString('ko-KR', { maximumFractionDigits: 3 });
};

export const getCurrentYearMonth = (): string => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${month}`;
};

export const getMonthDateRange = (yearMonth: string): { startDate: string; endDate: string } => {
    const [yearText, monthText] = String(yearMonth || '').split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        const fallback = getCurrentYearMonth();
        return getMonthDateRange(fallback);
    }

    const lastDay = new Date(year, month, 0).getDate();
    return {
        startDate: `${yearText}-${monthText}-01`,
        endDate: `${yearText}-${monthText}-${String(lastDay).padStart(2, '0')}`,
    };
};

export const makeProgressId = (prefix = 'progress'): string =>
    `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

const normalizeKey = (value: unknown): string =>
    String(value ?? '').trim().replace(/\s+/g, '').toLowerCase();

const siteTypeIsDirectOrContract = (value: unknown): boolean => {
    const key = normalizeKey(value);
    return key.includes(normalizeKey('도급')) || key.includes(normalizeKey('직영'));
};

export const isProgressManagedSite = (site: Pick<Site, 'siteType'> | null | undefined): boolean =>
    siteTypeIsDirectOrContract(site?.siteType);

export const getLineQuantity = (lines: ProgressClaimLine[] | undefined, itemId: string): number => {
    const found = (lines || []).find((line) => String(line.itemId) === String(itemId));
    return roundQuantity(found?.currentQuantity);
};

export const getContractItemAmount = (item: Pick<ProgressContractItem, 'contractQuantity' | 'unitPrice'>): number =>
    roundMoney(toProgressNumber(item.contractQuantity) * toProgressNumber(item.unitPrice));

const isExtraProgressLine = (line: ProgressClaimLine | undefined): boolean =>
    line?.source === 'extra' || String(line?.itemId || '').startsWith('extra_');

const makeExtraProgressItem = (line: ProgressClaimLine): ProgressContractItem => ({
    id: String(line.itemId || makeProgressId('extra')),
    category: String(line.category || '추가').trim(),
    workName: String(line.workName || '추가 기성').trim(),
    workType: String(line.workType || '추가').trim(),
    contractQuantity: roundQuantity(
        line.contractQuantity !== undefined
            ? line.contractQuantity
            : line.currentQuantity
    ),
    unit: String(line.unit || '식').trim(),
    unitPrice: toProgressNumber(line.unitPrice),
    remark: String(line.memo || '').trim(),
    active: true,
});

const firstNonEmptyText = (...values: unknown[]): string | undefined => {
    for (const value of values) {
        const text = String(value ?? '').trim();
        if (text) return text;
    }
    return undefined;
};

const firstDefined = <T,>(...values: Array<T | undefined>): T | undefined =>
    values.find((value) => value !== undefined);

const mergeExtraProgressLine = (
    previous: ProgressClaimLine | undefined,
    next: ProgressClaimLine
): ProgressClaimLine => ({
    itemId: String(next.itemId || previous?.itemId || makeProgressId('extra')),
    source: 'extra',
    category: firstNonEmptyText(next.category, previous?.category),
    workName: firstNonEmptyText(next.workName, previous?.workName),
    workType: firstNonEmptyText(next.workType, previous?.workType),
    contractQuantity: firstDefined(next.contractQuantity, previous?.contractQuantity),
    unit: firstNonEmptyText(next.unit, previous?.unit),
    unitPrice: firstDefined(next.unitPrice, previous?.unitPrice),
    currentQuantity: roundQuantity(firstDefined(next.currentQuantity, previous?.currentQuantity) ?? 0),
    memo: firstNonEmptyText(next.memo, previous?.memo),
});

export const summarizeDailyRowsForProgress = (
    rows: DailyReportWorkerRow[],
    sites: Site[] = []
): ProgressDailyManDaySummary[] => {
    const siteById = new Map<string, Site>();
    const siteByName = new Map<string, Site>();

    sites.forEach((site) => {
        const id = String(site.id ?? '').trim();
        const name = String(site.name ?? '').trim();
        if (id) siteById.set(id, site);
        if (name) siteByName.set(normalizeKey(name), site);
    });

    const grouped = new Map<string, ProgressDailyManDaySummary>();

    rows.forEach((row) => {
        const siteId = String(row.siteId ?? '').trim();
        const siteName = String(row.siteName ?? '').trim() || '현장 미지정';
        const site = siteById.get(siteId) || siteByName.get(normalizeKey(siteName));
        const siteType = String(row.siteType || site?.siteType || '').trim();
        if (!siteTypeIsDirectOrContract(siteType)) return;

        const manDay = toProgressNumber(row.manDay);
        if (manDay <= 0) return;

        const key = siteId || normalizeKey(siteName);
        const current = grouped.get(key) || {
            siteId,
            siteName,
            siteType,
            manDay: 0,
            amount: 0,
            rowCount: 0,
        };

        grouped.set(key, {
            ...current,
            siteId: current.siteId || siteId,
            siteName: current.siteName || siteName,
            siteType: current.siteType || siteType,
            manDay: roundQuantity(current.manDay + manDay),
            amount: roundMoney(current.amount + toProgressNumber(row.amount || row.manDay * row.unitPrice)),
            rowCount: current.rowCount + 1,
        });
    });

    return Array.from(grouped.values()).sort((a, b) => a.siteName.localeCompare(b.siteName, 'ko'));
};

export const calculateVatSummary = (
    amount: number,
    vatMode: ProgressVatMode,
    vatRate: number
): ProgressVatSummary => {
    const safeAmount = roundMoney(amount);
    const safeRate = Math.max(0, normalizeRate(vatRate));

    if (vatMode === 'separate') {
        const vatAmount = roundMoney(safeAmount * safeRate);
        return {
            supplyAmount: safeAmount,
            vatAmount,
            billingAmount: safeAmount + vatAmount,
        };
    }

    if (vatMode === 'included' && safeRate > 0) {
        const supplyAmount = roundMoney(safeAmount / (1 + safeRate));
        const vatAmount = safeAmount - supplyAmount;
        return {
            supplyAmount,
            vatAmount,
            billingAmount: safeAmount,
        };
    }

    return {
        supplyAmount: safeAmount,
        vatAmount: 0,
        billingAmount: safeAmount,
    };
};

export const calculateProgressItemRows = (
    contract: ProgressContract | undefined,
    allClaims: ProgressClaim[],
    currentClaim: ProgressClaim | undefined,
    yearMonth: string
): ProgressItemCalculatedRow[] => {
    const scopeSiteId = contract?.siteId || currentClaim?.siteId || '';
    const currentClaimMonth = String(currentClaim?.yearMonth || yearMonth);
    const scopedClaims = allClaims.filter((claim) =>
        claim.siteId === scopeSiteId &&
        String(claim.yearMonth || '') <= yearMonth &&
        !(currentClaim && String(claim.yearMonth || '') === currentClaimMonth)
    );
    const itemHasClaimQuantity = (itemId: string): boolean =>
        scopedClaims.some((claim) => getLineQuantity(claim.progressLines, itemId) !== 0) ||
        getLineQuantity(currentClaim?.progressLines, itemId) !== 0;
    const items = (contract?.items || []).filter((item) =>
        item.active !== false || itemHasClaimQuantity(item.id)
    );
    const previousClaims = allClaims.filter((claim) =>
        claim.siteId === scopeSiteId &&
        String(claim.yearMonth || '') < yearMonth
    );

    const contractRows = items.map((item) => {
        const previousQuantity = previousClaims.reduce((sum, claim) => sum + getLineQuantity(claim.progressLines, item.id), 0);
        const currentQuantity = getLineQuantity(currentClaim?.progressLines, item.id);
        const cumulativeQuantity = roundQuantity(previousQuantity + currentQuantity);
        const remainingQuantity = roundQuantity(toProgressNumber(item.contractQuantity) - cumulativeQuantity);
        const unitPrice = toProgressNumber(item.unitPrice);
        const contractAmount = getContractItemAmount(item);
        const previousAmount = roundMoney(previousQuantity * unitPrice);
        const currentAmount = roundMoney(currentQuantity * unitPrice);
        const cumulativeAmount = roundMoney(cumulativeQuantity * unitPrice);
        const remainingAmount = contractAmount - cumulativeAmount;
        const progressRate = contractAmount > 0 ? cumulativeAmount / contractAmount : 0;

        return {
            item,
            source: 'contract' as const,
            contractAmount,
            previousQuantity: roundQuantity(previousQuantity),
            currentQuantity,
            cumulativeQuantity,
            remainingQuantity,
            previousAmount,
            currentAmount,
            cumulativeAmount,
            remainingAmount,
            progressRate,
        };
    });

    const extraLineById = new Map<string, ProgressClaimLine>();
    scopedClaims.forEach((claim) => {
        (claim.progressLines || [])
            .filter(isExtraProgressLine)
            .forEach((line) => {
                if (line.itemId) extraLineById.set(line.itemId, mergeExtraProgressLine(extraLineById.get(line.itemId), line));
            });
    });
    (currentClaim?.progressLines || [])
        .filter(isExtraProgressLine)
        .forEach((line) => {
            if (line.itemId) extraLineById.set(line.itemId, mergeExtraProgressLine(extraLineById.get(line.itemId), line));
        });

    const extraRows = Array.from(extraLineById.values()).map((line) => {
        const item = makeExtraProgressItem(line);
        const previousQuantity = previousClaims.reduce((sum, claim) => sum + getLineQuantity(claim.progressLines, item.id), 0);
        const currentQuantity = getLineQuantity(currentClaim?.progressLines, item.id);
        const cumulativeQuantity = roundQuantity(previousQuantity + currentQuantity);
        const unitPrice = toProgressNumber(item.unitPrice);
        const extraContractQuantity = roundQuantity(Math.max(
            toProgressNumber(item.contractQuantity),
            cumulativeQuantity
        ));
        const normalizedItem = {
            ...item,
            contractQuantity: extraContractQuantity,
        };
        const contractAmount = getContractItemAmount(normalizedItem);
        const previousAmount = roundMoney(previousQuantity * unitPrice);
        const currentAmount = roundMoney(currentQuantity * unitPrice);
        const cumulativeAmount = roundMoney(cumulativeQuantity * unitPrice);
        const remainingQuantity = roundQuantity(extraContractQuantity - cumulativeQuantity);
        const remainingAmount = contractAmount - cumulativeAmount;
        const progressRate = contractAmount > 0 ? cumulativeAmount / contractAmount : 0;

        return {
            item: normalizedItem,
            line,
            source: 'extra' as const,
            contractAmount,
            previousQuantity: roundQuantity(previousQuantity),
            currentQuantity,
            cumulativeQuantity,
            remainingQuantity,
            previousAmount,
            currentAmount,
            cumulativeAmount,
            remainingAmount,
            progressRate,
        };
    });

    return [...contractRows, ...extraRows];
};

export const calculateAllocations = (
    allocations: ProgressAllocation[] | undefined,
    baseAmount: number,
    manDay: number
): ProgressAllocationCalculatedRow[] => {
    const safeBase = toProgressNumber(baseAmount);
    const safeManDay = toProgressNumber(manDay);

    return (allocations || []).map((allocation) => {
        let amount = 0;
        if (allocation.method === 'fixed') amount = toProgressNumber(allocation.fixedAmount);
        if (allocation.method === 'percent') amount = safeBase * toProgressNumber(allocation.percent) / 100;
        if (allocation.method === 'perManDay') amount = safeManDay * toProgressNumber(allocation.amountPerManDay);
        if (allocation.method === 'manual') amount = toProgressNumber(allocation.manualAmount);

        return {
            allocation,
            amount: roundMoney(amount),
        };
    });
};

const resolveTeamPositionMode = (value: unknown): ProgressTeamPositionMode =>
    value === 'manual' ? 'manual' : 'currentAmount';

export const calculateProgressClaimSummary = (
    contract: ProgressContract | undefined,
    allClaims: ProgressClaim[],
    currentClaim: ProgressClaim | undefined,
    dailySummary: ProgressDailyManDaySummary | undefined,
    yearMonth: string
): { itemRows: ProgressItemCalculatedRow[]; allocationRows: ProgressAllocationCalculatedRow[]; summary: ProgressClaimSummary } => {
    const itemRows = calculateProgressItemRows(contract, allClaims, currentClaim, yearMonth);
    const contractAmount = itemRows.reduce((sum, row) => sum + row.contractAmount, 0);
    const previousAmount = itemRows.reduce((sum, row) => sum + row.previousAmount, 0);
    const currentAmount = itemRows.reduce((sum, row) => sum + row.currentAmount, 0);
    const cumulativeAmount = itemRows.reduce((sum, row) => sum + row.cumulativeAmount, 0);
    const remainingAmount = contractAmount - cumulativeAmount;
    const totalManDay = toProgressNumber(dailySummary?.manDay);
    const dailyAmount = toProgressNumber(dailySummary?.amount);
    const teamPositionMode = resolveTeamPositionMode(currentClaim?.teamPositionMode);
    const teamPositionManualAmount = Math.max(0, roundMoney(currentClaim?.teamPositionManualAmount));
    const teamPositionAmount = teamPositionMode === 'manual'
        ? Math.min(currentAmount, teamPositionManualAmount)
        : currentAmount;
    const sukumiUnitPrice = totalManDay > 0 ? roundMoney(teamPositionAmount / totalManDay) : 0;
    const buybackTotalAmount = Math.max(0, roundMoney(currentAmount - teamPositionAmount));
    const buybackUnit = totalManDay > 0
        ? roundMoney(buybackTotalAmount / totalManDay)
        : 0;
    const teamPositionUnit = sukumiUnitPrice;
    const buybackPoolAmount = buybackTotalAmount;
    const vat = calculateVatSummary(
        currentAmount,
        currentClaim?.vatMode || 'none',
        currentClaim?.vatRate ?? 0.1
    );
    const allocationBaseAmount = roundMoney(
        currentClaim?.distributionBaseAmount !== undefined
            ? currentClaim.distributionBaseAmount
            : buybackPoolAmount
    );
    const allocationRows = calculateAllocations(currentClaim?.allocations, allocationBaseAmount, totalManDay);
    const allocationAmount = allocationRows.reduce((sum, row) => sum + row.amount, 0);

    return {
        itemRows,
        allocationRows,
        summary: {
            siteId: contract?.siteId || currentClaim?.siteId || dailySummary?.siteId || '',
            siteName: contract?.siteName || currentClaim?.siteName || dailySummary?.siteName || '현장 미지정',
            contractAmount,
            previousAmount,
            currentAmount,
            cumulativeAmount,
            remainingAmount,
            totalManDay,
            dailyAmount,
            dailyRowCount: dailySummary?.rowCount || 0,
            sukumiUnitPrice,
            teamPositionMode,
            teamPositionManualAmount,
            buybackUnit,
            buybackTotalAmount,
            teamPositionUnit,
            teamPositionAmount,
            buybackPoolAmount,
            allocationBaseAmount,
            allocationAmount,
            allocationRemainAmount: allocationBaseAmount - allocationAmount,
            ...vat,
        },
    };
};
