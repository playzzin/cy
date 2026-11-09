import { buildTransactionInboundCertificate, buildTransactionOutboundCertificate, getTransactionCertificateGroupKey } from './materialTransactionCertificate';
import type { MaterialTransactionRow } from './MaterialTransactionDateList';
import type { MaterialRentalCompanyOption } from './materialRentalCompanyOptions';

const row: MaterialTransactionRow = {
    type: 'inbound', id: 'one', transactionDate: '2026-11-08', siteId: 'site', siteName: '현장',
    rentalCompanyId: 'rental', rentalCompanyName: '임대사', vehicleNumber: '12가3456',
    materialId: 'material', itemName: '수직재', category: '동바리', spec: 'P17', unit: 'EA', quantity: 0.1,
    registeredBy: '', registeredByName: '',
};
const companies: MaterialRentalCompanyOption[] = [{ id: 'rental', name: '임대사', source: 'company' }];

it('동명 현장·임대사 ID, 차량, 날짜, 입출고 구분이 다른 거래를 섞지 않는다', () => {
    const key = getTransactionCertificateGroupKey(row, companies);
    for (const change of [{ siteId: 'other-site' }, { rentalCompanyId: 'other-rental' },
        { vehicleNumber: '다른 차량' }, { transactionDate: '2026-11-09' }, { type: 'outbound' as const }]) {
        const other = { ...row, ...change } as MaterialTransactionRow;
        expect(getTransactionCertificateGroupKey(other, companies)).not.toBe(key);
        expect(() => buildTransactionInboundCertificate('draft', [row, other], [], companies)).toThrow();
    }
    expect(() => buildTransactionOutboundCertificate('draft', [row], [], companies)).toThrow();
    expect(() => buildTransactionInboundCertificate('draft', [], [], companies)).toThrow();
});

it('이름만 저장한 임대사는 유일하게 일치할 때 연결하고, 단위가 다른 품목은 분리한다', () => {
    const legacy = { ...row, id: 'two', rentalCompanyId: '', rentalCompanyName: '임 대 사', quantity: 0.2, photoBatchId: 'batch' };
    expect(getTransactionCertificateGroupKey(legacy, companies)).toBe(getTransactionCertificateGroupKey(row, companies));
    const ambiguous = [...companies, { ...companies[0], id: 'another' }];
    expect(getTransactionCertificateGroupKey(legacy, ambiguous)).not.toBe(getTransactionCertificateGroupKey(row, ambiguous));
    const draft = buildTransactionInboundCertificate('draft', [row, legacy, { ...row, id: 'three', unit: 'SET', quantity: 2 }], [], companies);
    expect(draft.items.map(item => [item.unit, item.quantity])).toEqual([['EA', 0.3], ['SET', 2]]);
    expect(draft.photoReferences).toContainEqual(expect.objectContaining({ photoBatchId: 'batch' }));
    expect(draft.returnTo).toBe('/materials/transactions');
});
