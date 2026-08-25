import { InboundTransaction, OutboundTransaction } from '../../types/materials';
import { getMaterialTransactionRentalCompanyLink } from './materialTransactionRentalCompany';

export type MaterialTransactionExcelSource = (InboundTransaction | OutboundTransaction) & {
    type: 'inbound' | 'outbound';
};

export type MaterialTransactionExcelCellValue = string | number;

export const MATERIAL_TRANSACTION_EXCEL_HEADERS: MaterialTransactionExcelCellValue[] = [
    '일자',
    '구분',
    '현장',
    '분류',
    '품명',
    '규격',
    '수량',
    '단위',
    '차량번호',
    '입고처/출고자',
    '송장번호/상태',
    '임대사',
    '비고',
];

const trimText = (value: unknown): string => String(value ?? '').trim();

const isNoInvoiceMarker = (value: unknown): boolean => (
    trimText(value).replace(/\s+/g, '').includes('송장없음')
);

export const getMaterialTransactionInvoiceLabel = (transaction: MaterialTransactionExcelSource): string => {
    if (transaction.type !== 'inbound') return '';

    const inbound = transaction as InboundTransaction;
    const invoiceNumber = trimText(inbound.invoiceNumber);
    if (invoiceNumber) return invoiceNumber;

    return [inbound.category, inbound.itemName, inbound.spec, inbound.notes]
        .some(isNoInvoiceMarker)
        ? '송장없음'
        : '';
};

const toExcelQuantity = (value: unknown): number => {
    const quantity = Number(value || 0);
    return Number.isFinite(quantity) ? Math.round(quantity) : 0;
};

export const buildMaterialTransactionExcelRows = (
    transactions: readonly MaterialTransactionExcelSource[]
): MaterialTransactionExcelCellValue[][] => transactions.map((transaction) => [
    trimText(transaction.transactionDate),
    transaction.type === 'inbound' ? '입고' : '출고',
    trimText(transaction.siteName),
    trimText(transaction.category),
    trimText(transaction.itemName),
    trimText(transaction.spec),
    toExcelQuantity(transaction.quantity),
    trimText(transaction.unit),
    trimText(transaction.vehicleNumber),
    transaction.type === 'inbound'
        ? trimText((transaction as InboundTransaction).supplier)
        : trimText((transaction as OutboundTransaction).recipient),
    getMaterialTransactionInvoiceLabel(transaction),
    getMaterialTransactionRentalCompanyLink(transaction).name,
    trimText(transaction.notes),
]);
