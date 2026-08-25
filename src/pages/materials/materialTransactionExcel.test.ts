import type { InboundTransaction, OutboundTransaction } from '../../types/materials';
import {
    buildMaterialTransactionExcelRows,
    getMaterialTransactionInvoiceLabel,
    type MaterialTransactionExcelSource,
} from './materialTransactionExcel';

const makeInbound = (overrides: Partial<InboundTransaction> = {}): MaterialTransactionExcelSource => ({
    id: 'in-no-invoice',
    type: 'inbound',
    transactionDate: '2026-06-17',
    siteId: 'site-1',
    siteName: '서울 현장',
    materialId: 'material-no-invoice',
    materialKey: '기타::기타::송장없음',
    category: '기타',
    itemName: '기타',
    spec: '송장없음',
    quantity: 1,
    unit: 'EA',
    vehicleNumber: '번호없음',
    registeredBy: 'user-1',
    registeredByName: '등록자',
    ...overrides,
});

describe('material transaction Excel rows', () => {
    it('includes a no-invoice inbound row and marks its invoice status', () => {
        const rows = buildMaterialTransactionExcelRows([makeInbound()]);

        expect(rows).toHaveLength(1);
        expect(rows[0][3]).toBe('기타');
        expect(rows[0][4]).toBe('기타');
        expect(rows[0][5]).toBe('송장없음');
        expect(rows[0][6]).toBe(1);
        expect(rows[0][10]).toBe('송장없음');
    });

    it('keeps an explicit invoice number when one is stored', () => {
        expect(getMaterialTransactionInvoiceLabel(makeInbound({ invoiceNumber: 'INV-2026-001' })))
            .toBe('INV-2026-001');
    });

    it('leaves the invoice column empty for outbound transactions', () => {
        const outbound: MaterialTransactionExcelSource = {
            id: 'out-1',
            type: 'outbound',
            transactionDate: '2026-06-18',
            siteId: 'site-1',
            siteName: '서울 현장',
            materialId: 'material-1',
            category: '비계',
            itemName: '수직재',
            spec: 'P38',
            quantity: 2,
            unit: 'EA',
            recipient: '현장 담당자',
            deliveryStatus: 'delivered',
            registeredBy: 'user-1',
            registeredByName: '등록자',
        } as OutboundTransaction & { type: 'outbound' };

        expect(buildMaterialTransactionExcelRows([outbound])[0][10]).toBe('');
    });
});
