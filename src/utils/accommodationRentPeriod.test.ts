import type { Accommodation } from '../types/accommodation';
import type { AccommodationBillingDocument, AccommodationBillingLineItem } from '../types/accommodationBilling';
import { applyAccommodationRentPeriod } from './accommodationRentPeriod';

const room = { id: 'ended', status: 'active', contract: { endDate: '2026-10-31' } } as Accommodation;
const rent = { id: 'utility-ended-rent', label: '종료숙소 월세', amount: 450000, targetField: 'accommodation',
    sourceType: 'utility_ledger', sourceAccommodationId: 'ended' } as AccommodationBillingLineItem;
const bill = (patch: Partial<AccommodationBillingDocument> = {}) => ({ id: 'bill', yearMonth: '2026-11',
    status: 'draft', issuedToType: 'team', lineItems: [rent], ...patch } as AccommodationBillingDocument);

it.each(['team', 'worker'] as const)('활성 상태라도 10월 종료면 11월 자동 월세를 제외한다 (%s)', issuedToType => {
    const original = bill({ issuedToType });
    const [projected] = applyAccommodationRentPeriod([original], [room]);
    expect(projected.lineItems[0]).toMatchObject({ amount: 0, excludedContractRent: { amount: 450000, endMonth: '2026-10' } });
    expect(original.lineItems[0].amount).toBe(450000);
    expect(original.lineItems[0].excludedContractRent).toBeUndefined();
    expect(applyAccommodationRentPeriod([bill({ yearMonth: '2026-10' })], [room])[0].lineItems[0].amount).toBe(450000);
});

it('종료 후 공과금, 수기 청구, 기타 비용, 음수 조정, 다른 숙소는 보존한다', () => {
    const kept = [
        { ...rent, id: 'electricity', targetField: 'electricity', amount: 30100 },
        { ...rent, id: 'internet', targetField: 'internet', amount: 34840 },
        { ...rent, id: 'utility-ended-other', label: '종료숙소 기타', amount: 1234 },
        { ...rent, id: 'manual', sourceType: 'manual' },
        { ...rent, id: 'credit', amount: -450000 },
        { ...rent, id: 'unknown', sourceAccommodationId: 'unknown' },
        { ...rent, id: 'legacy', sourceType: undefined },
    ] as AccommodationBillingLineItem[];
    expect(applyAccommodationRentPeriod([bill({ lineItems: [rent, ...kept] })], [room])[0].lineItems.slice(1)).toEqual(kept);
});

it.each(['confirmed', 'PAID', 'overdue', 'cancelled'] as const)('확정된 회계 내역은 재계산하지 않는다 (%s)', status => {
    const original = bill({ status });
    expect(applyAccommodationRentPeriod([original], [room])[0]).toBe(original);
});

it('명시된 비용 종료월을 계약 만기보다 우선하고 재활성화된 숙소의 이전 종료월은 무시한다', () => {
    const terminated = { ...room, status: 'inactive', billingEndYearMonth: '2026-11' } as Accommodation;
    expect(applyAccommodationRentPeriod([bill()], [terminated])[0].lineItems[0].amount).toBe(450000);
    expect(applyAccommodationRentPeriod([bill({ yearMonth: '2026-12' })], [terminated])[0].lineItems[0].amount).toBe(0);
    const reopened = { ...room, billingEndYearMonth: '2026-09', contract: { ...room.contract, endDate: '2027-12-31' } };
    expect(applyAccommodationRentPeriod([bill()], [reopened])[0].lineItems[0].amount).toBe(450000);
});
