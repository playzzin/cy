import { extractVehiclePlateCandidates, matchVehicleFineNoticeToVehicle, normalizeVehiclePlate } from './vehicleFineMatching';
import type { Vehicle } from '../types/vehicle';

const vehicle = (id: string, licensePlate: string): Vehicle => ({
    id,
    licensePlate,
    model: '카니발',
    type: 'RENT',
    status: 'ASSIGNED',
    contract: {
        type: 'RENT',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        deposit: 0,
        monthlyFee: 0,
        paymentDay: 1,
        financeCompany: { name: '', contact: '' },
    },
});

describe('vehicleFineMatching', () => {
    it('normalizes spaces and punctuation in Korean plates', () => {
        expect(normalizeVehiclePlate(' 198하-3585 ')).toBe('198하3585');
    });

    it('auto matches only one exact vehicle plate', () => {
        const result = matchVehicleFineNoticeToVehicle(
            { licensePlate: '198하 3585' },
            [vehicle('a', '198하3585'), vehicle('b', '141하8983')],
        );
        expect(result.status).toBe('auto_matched');
        expect(result.selectedVehicleId).toBe('a');
    });

    it('extracts labelled violation and charged-vehicle plate values', () => {
        expect(extractVehiclePlateCandidates('부과대상 198하-3585')).toEqual(['198하3585']);
    });

    it('repairs common OCR letters inside numeric plate segments', () => {
        expect(extractVehiclePlateCandidates('위반차량 198하35B5')).toEqual(['198하3585']);
    });

    it('matches from a candidate plate when the primary OCR field is empty', () => {
        const result = matchVehicleFineNoticeToVehicle(
            { licensePlate: '', licensePlateCandidates: ['위반차량: 198하3585'] },
            [vehicle('a', '198하3585')],
        );
        expect(result.status).toBe('auto_matched');
        expect(result.selectedVehicleId).toBe('a');
        expect(result.matchedLicensePlate).toBe('198하3585');
    });

    it('requires review when labelled plate candidates conflict', () => {
        const result = matchVehicleFineNoticeToVehicle(
            {
                licensePlate: '198하3585',
                chargedTargetPlate: '198하3585',
                violationVehiclePlate: '141하8983',
                licensePlateCandidates: ['198하3585', '141하8983'],
            },
            [vehicle('a', '198하3585'), vehicle('b', '141하8983')],
        );
        expect(result.status).toBe('needs_review');
        expect(result.selectedVehicleId).toBe('');
        expect(result.warnings[0]).toContain('후보');
    });

    it('preselects one safe one-character OCR near match for manual confirmation', () => {
        const result = matchVehicleFineNoticeToVehicle(
            { licensePlate: '198H3585', licensePlateCandidates: [] },
            [vehicle('a', '198하3585'), vehicle('b', '141하8983')],
        );

        expect(result.status).toBe('needs_review');
        expect(result.selectedVehicleId).toBe('a');
        expect(result.candidates[0].reason).toContain('한 글자');
    });

    it('preselects the exact charged-target vehicle but requires review when photo evidence conflicts', () => {
        const result = matchVehicleFineNoticeToVehicle(
            {
                licensePlate: '198하3585',
                chargedTargetPlate: '198하3585',
                plateImagePlate: '198하3586',
                plateSource: 'CHARGED_VEHICLE',
                plateConfidence: 0.72,
                licensePlateCandidates: ['198하3585', '198하3586'],
            },
            [vehicle('a', '198하3585'), vehicle('b', '141하8983')],
        );

        expect(result.status).toBe('needs_review');
        expect(result.selectedVehicleId).toBe('a');
    });

    it('does not auto match by last four digits only', () => {
        const result = matchVehicleFineNoticeToVehicle(
            { licensePlate: '198하3585' },
            [vehicle('a', '124호3585')],
        );
        expect(result.status).toBe('needs_review');
        expect(result.selectedVehicleId).toBe('');
        expect(result.candidates[0].vehicleId).toBe('a');
    });

    it('requires review when duplicate vehicle plates exist', () => {
        const result = matchVehicleFineNoticeToVehicle(
            { licensePlate: '198하2488' },
            [vehicle('a', '198하2488'), vehicle('b', '198하2488')],
        );
        expect(result.status).toBe('needs_review');
        expect(result.selectedVehicleId).toBe('');
    });
});
