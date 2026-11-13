import type { Accommodation } from '../types/accommodation';
import type { AccommodationBillingDocument, AccommodationBillingLineItem } from '../types/accommodationBilling';
import { applyAccommodationExpensePeriod } from './accommodationExpensePeriod';

const room = { id: 'ended', status: 'active', contract: { endDate: '2026-10-31' } } as Accommodation;
const rent = { id: 'rent', amount: 450000, targetField: 'accommodation', sourceType: 'utility_ledger',
    sourceAccommodationId: 'ended' } as AccommodationBillingLineItem;
const bill = (patch: Partial<AccommodationBillingDocument> = {}) => ({ id: 'bill', yearMonth: '2026-11',
    status: 'draft', issuedToType: 'team', lineItems: [rent], ...patch } as AccommodationBillingDocument);

it.each(['team', 'worker'] as const)('종료월까지 보존하고 다음 월에는 문서와 행을 남기지 않는다 (%s)', issuedToType => {
    const original = bill({ issuedToType });
    expect(applyAccommodationExpensePeriod([original], [room])).toEqual([]);
    expect(original.lineItems[0].amount).toBe(450000);
    expect(applyAccommodationExpensePeriod([bill({ yearMonth: '2026-10' })], [room])[0].lineItems).toEqual([rent]);
});

it.each(['draft', 'confirmed', 'PAID', 'overdue', 'cancelled'] as const)('종료 후 모든 숙소 경비를 제외하고 다른 숙소는 보존한다 (%s)', status => {
    const expired = [rent,
        { ...rent, id: 'electricity', targetField: 'electricity', amount: 30100 },
        { ...rent, id: 'internet', targetField: 'internet', amount: 34840 },
        { ...rent, id: 'other', amount: 1234 }, { ...rent, id: 'manual', sourceType: 'manual' },
        { ...rent, id: 'credit', amount: -450000 }, { ...rent, id: 'zero', amount: 0 },
    ] as AccommodationBillingLineItem[];
    const remaining = { ...rent, id: 'other-room', sourceAccommodationId: 'other' };
    expect(applyAccommodationExpensePeriod([bill({ status, lineItems: [...expired, remaining] })], [room])[0].lineItems).toEqual([remaining]);
});

it('비용 종료월을 우선하고 재활성화된 숙소의 이전 종료월은 무시한다', () => {
    const terminated = { ...room, status: 'inactive', billingEndYearMonth: '2026-11' } as Accommodation;
    expect(applyAccommodationExpensePeriod([bill()], [terminated])).toHaveLength(1);
    expect(applyAccommodationExpensePeriod([bill({ yearMonth: '2026-12' })], [terminated])).toEqual([]);
    const reopened = { ...room, billingEndYearMonth: '2026-09', contract: { ...room.contract, endDate: '2027-12-31' } };
    expect(applyAccommodationExpensePeriod([bill()], [reopened])).toHaveLength(1);
});
