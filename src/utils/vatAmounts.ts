export const calculateVatAmount = (supplyAmount: number): number => {
    if (!Number.isFinite(supplyAmount) || supplyAmount === 0) return 0;
    return Math.trunc(supplyAmount / 10);
};

export const calculateVatInclusiveAmount = (supplyAmount: number): number => {
    if (!Number.isFinite(supplyAmount) || supplyAmount === 0) return 0;
    return supplyAmount + calculateVatAmount(supplyAmount);
};
