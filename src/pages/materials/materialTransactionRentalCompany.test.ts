import {
    getMaterialTransactionRentalCompanyLink,
    matchesMaterialTransactionRentalCompanyFilter,
} from './materialTransactionRentalCompany';

const UNASSIGNED = '__unassigned__';

describe('material transaction rental company link', () => {
    it('reads the rental company saved on an inbound transaction', () => {
        expect(getMaterialTransactionRentalCompanyLink({
            rentalCompanyId: ' rental-1 ',
            rentalCompanyName: ' 아성시스템 ',
        })).toEqual({
            id: 'rental-1',
            name: '아성시스템',
        });
    });

    it('matches inbound and outbound-shaped records by the same rental-company fields', () => {
        const inbound = { rentalCompanyId: 'rental-1', rentalCompanyName: '아성시스템' };
        const outbound = { rentalCompanyId: 'rental-1', rentalCompanyName: '아성시스템' };

        expect(matchesMaterialTransactionRentalCompanyFilter(inbound, 'rental-1', '아성시스템', UNASSIGNED)).toBe(true);
        expect(matchesMaterialTransactionRentalCompanyFilter(outbound, 'rental-1', '아성시스템', UNASSIGNED)).toBe(true);
    });

    it('supports legacy name matching and the unassigned filter', () => {
        expect(matchesMaterialTransactionRentalCompanyFilter(
            { rentalCompanyName: '아성 시스템' },
            'rental-legacy',
            '아성시스템',
            UNASSIGNED
        )).toBe(true);
        expect(matchesMaterialTransactionRentalCompanyFilter({}, UNASSIGNED, '', UNASSIGNED)).toBe(true);
        expect(matchesMaterialTransactionRentalCompanyFilter(
            { rentalCompanyName: '아성시스템' },
            UNASSIGNED,
            '',
            UNASSIGNED
        )).toBe(false);
    });
});
