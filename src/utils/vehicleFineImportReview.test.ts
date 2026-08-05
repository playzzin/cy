import { normalizeVehicleFineAnalysis } from './vehicleFineImportReview';
import type { VehicleFineNoticeAnalysis } from '../types/vehicleFineImport';

const notice = (patch: Partial<VehicleFineNoticeAnalysis>): VehicleFineNoticeAnalysis => ({
    fileIndex: 0,
    originalFileName: 'notice.jpg',
    issuer: '안산시 상록구청',
    noticeType: 'PARKING_FINE',
    licensePlate: '198하3585',
    violationDateTime: '2026-05-19T14:56:00',
    violationDate: '2026-05-19',
    violationLocation: '사동 장화로',
    violationDescription: '주정차위반과태료',
    dueDate: '2026-07-01',
    noticeNumber: '',
    electronicPaymentNumber: '4127022661494756294',
    originalAmount: 40_000,
    reductionAmount: 8_000,
    payableAmount: 32_000,
    driverPenaltyAmount: 0,
    ownerFineAmount: 0,
    confidence: 0.96,
    warnings: [],
    dedupeKey: 'payment:4127022661494756294',
    duplicate: false,
    existingExpenseId: '',
    ...patch,
});

describe('vehicleFineImportReview', () => {
    it('keeps the discounted final parking fine', () => {
        const result = normalizeVehicleFineAnalysis(notice({}));
        expect(result.payableAmount).toBe(32_000);
        expect(result.warnings).toHaveLength(0);
    });

    it('warns when parking original minus reduction does not match payable amount', () => {
        const result = normalizeVehicleFineAnalysis(notice({ payableAmount: 40_000 }));
        expect(result.warnings.some((warning) => warning.includes('32,000'))).toBe(true);
    });

    it('prefers vehicle-owner fine over driver penalty on police notices', () => {
        const result = normalizeVehicleFineAnalysis(notice({
            noticeType: 'TRAFFIC_FINE',
            payableAmount: 60_000,
            ownerFineAmount: 70_000,
            driverPenaltyAmount: 60_000,
        }));
        expect(result.payableAmount).toBe(70_000);
        expect(result.warnings.some((warning) => warning.includes('차량 소유자 과태료'))).toBe(true);
    });

    it('keeps Jeju speeding prepayment fine instead of post-deadline full amount', () => {
        const result = normalizeVehicleFineAnalysis(notice({
            noticeType: 'TRAFFIC_FINE',
            payableAmount: 32_000,
            ownerFineAmount: 32_000,
            driverPenaltyAmount: 30_000,
            originalAmount: 40_000,
            reductionAmount: 8_000,
        }));
        expect(result.payableAmount).toBe(32_000);
    });
});
