export interface MaterialTransactionRentalFields {
    rentalCompanyId?: unknown;
    rentalCompanyName?: unknown;
}

const trimText = (value: unknown): string => String(value ?? '').trim();
const normalizeText = (value: unknown): string => trimText(value).replace(/\s+/g, '').toLowerCase();

export const getMaterialTransactionRentalCompanyLink = (
    transaction: MaterialTransactionRentalFields
): { id: string; name: string } => ({
    id: trimText(transaction.rentalCompanyId),
    name: trimText(transaction.rentalCompanyName),
});

export const matchesMaterialTransactionRentalCompanyFilter = (
    transaction: MaterialTransactionRentalFields,
    selectedCompanyId: string,
    selectedCompanyName: string,
    unassignedFilterValue: string
): boolean => {
    if (!selectedCompanyId) return true;

    const link = getMaterialTransactionRentalCompanyLink(transaction);
    if (selectedCompanyId === unassignedFilterValue) {
        return !link.id && !link.name;
    }

    const normalizedSelectedName = normalizeText(selectedCompanyName);
    return (
        link.id === selectedCompanyId ||
        (!!normalizedSelectedName && normalizeText(link.name) === normalizedSelectedName) ||
        normalizeText(link.name).includes(normalizeText(selectedCompanyId))
    );
};
