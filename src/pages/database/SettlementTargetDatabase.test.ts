import type { Company } from '../../services/companyService';
import {
    normalizeSettlementTarget,
    normalizeSettlementTargetAfterTaxRate,
    type SettlementTarget,
} from '../../services/settlementTargetService';
import { SettlementTargetSchema } from '../../types/zod/settlementTargetSchema';
import {
    buildSettlementTargetFormState,
    buildSettlementTargetPayload,
    maskSettlementTargetAccountNumber,
    TARGET_TYPE_OPTIONS,
} from './SettlementTargetDatabase';

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('../../utils/swal', () => ({
    toast: {
        saved: jest.fn(),
        updated: jest.fn(),
        success: jest.fn(),
    },
}));

const EXISTING_TARGET: SettlementTarget = {
    id: 'target-1',
    name: '홍길동',
    targetType: 'salesperson',
    defaultProcessType: 'memo',
    companyId: 'company-1',
    companyName: '기존 발주사',
    officeStaffId: 'staff-1',
    officeStaffName: '홍길동 직원',
    positionTitle: '영업팀장',
    defaultAfterTaxRate: 0.75,
    contact: '010-1234-5678',
    bankName: '테스트은행',
    accountNumber: '123-45-678901',
    accountHolder: '홍길동',
    evidenceRequired: true,
    status: 'active',
    memo: '기존 메모',
};

describe('SettlementTargetDatabase helpers', () => {
    it('offers every editable target type while excluding synthetic office income', () => {
        expect(TARGET_TYPE_OPTIONS.map((option) => option.value)).toEqual([
            'salesperson',
            'client_contact',
            'client_company',
            'rental_company',
            'office_staff',
            'other',
        ]);
        expect(TARGET_TYPE_OPTIONS.some((option) => option.value === 'office_income')).toBe(false);
    });

    it('preserves the existing type and omits hidden fields from update payloads', () => {
        const form = buildSettlementTargetFormState(EXISTING_TARGET);
        const payload = buildSettlementTargetPayload(form, [] as Company[], EXISTING_TARGET);

        expect(form.targetType).toBe('salesperson');
        expect(form.positionTitle).toBe('영업팀장');
        expect(form.defaultAfterTaxPercent).toBe('75');
        expect(payload).toMatchObject({
            targetType: 'salesperson',
            positionTitle: '영업팀장',
            defaultAfterTaxRate: 0.75,
            companyId: 'company-1',
            companyName: '기존 발주사',
        });
        expect(payload).not.toHaveProperty('defaultProcessType');
        expect(payload).not.toHaveProperty('officeStaffId');
        expect(payload).not.toHaveProperty('officeStaffName');
    });

    it('uses payable only for new targets and stores percent input as a ratio', () => {
        const form = buildSettlementTargetFormState(null);
        form.name = '신규 영업사원';
        form.targetType = 'salesperson';
        form.defaultAfterTaxPercent = '82.5';

        expect(buildSettlementTargetPayload(form, [], null)).toMatchObject({
            targetType: 'salesperson',
            defaultProcessType: 'payable',
            defaultAfterTaxRate: 0.825,
        });
    });

    it('masks account numbers to the last four digits', () => {
        const masked = maskSettlementTargetAccountNumber('123-45-678901');
        expect(masked).toBe('•••• 8901');
        expect(masked).not.toContain('123-45');
        expect(maskSettlementTargetAccountNumber('')).toBe('');
    });
});

describe('SettlementTarget schema and normalization', () => {
    it('defaults the after-tax rate to 0.75 and validates the 0..1 range', () => {
        expect(SettlementTargetSchema.parse({ name: '기본 대상자' }).defaultAfterTaxRate).toBe(0.75);
        expect(SettlementTargetSchema.safeParse({ name: '오류', defaultAfterTaxRate: -0.01 }).success).toBe(false);
        expect(SettlementTargetSchema.safeParse({ name: '오류', defaultAfterTaxRate: 1.01 }).success).toBe(false);
    });

    it('normalizes legacy percent values and missing defaults', () => {
        expect(normalizeSettlementTargetAfterTaxRate(75)).toBe(0.75);
        expect(normalizeSettlementTargetAfterTaxRate(undefined)).toBe(0.75);
        expect(normalizeSettlementTarget({ name: '대상자' } as SettlementTarget)).toMatchObject({
            targetType: 'other',
            defaultProcessType: 'payable',
            defaultAfterTaxRate: 0.75,
            status: 'active',
            evidenceRequired: false,
        });
    });
});
