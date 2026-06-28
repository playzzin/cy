import {
    buildMonthlyPayslipSnapshot,
    buildPayslipPayComponents,
    createPayslipChecksum,
    maskAccountNumber,
    maskResidentId,
    validateMonthlyPayslipRows,
} from './payslipIssue';

const validRow = {
    id: '2026-06__worker-1__team-1__월급제',
    workerId: 'worker-1',
    workerName: '홍길동',
    idNumber: '9001011234567',
    teamId: 'team-1',
    teamName: '홍길동팀',
    companyName: '청연ENG',
    month: '2026-06',
    totalManDay: 20,
    unitPrice: 200000,
    grossAmount: 4000000,
    totalDeduction: 300000,
    totalAmount: 3700000,
    invoiceManDay: 5,
    invoiceGrossAmount: 1000000,
    laborManDay: 15,
    laborGrossAmount: 3000000,
    bankCode: '004',
    bankName: '국민은행',
    accountNumber: '1234567890123',
    accountHolder: '홍길동',
    workEntries: [
        { date: '2026-06-01', siteName: 'A현장', paymentMethod: '노무', manDay: 1, unitPrice: 200000, amount: 200000 },
    ],
    deductionBreakdown: {
        standardLines: [],
        additionalLines: [{ label: '가불', amount: 100000 }],
        total: 100000,
    },
    taxBreakdown: {
        standardLines: [],
        additionalLines: [{ label: '[원천세] 갑근세', amount: 200000 }],
        total: 200000,
    },
    taxRateSnapshot: {
        incomeTaxRate: 0.06,
        residentTaxRate: 0.1,
    },
};

describe('payslipIssue utilities', () => {
    it('masks resident IDs and account numbers before display/export', () => {
        expect(maskResidentId('9001011234567')).toBe('900101-1******');
        expect(maskResidentId('900101-1234567')).toBe('900101-1******');
        expect(maskAccountNumber('1234567890123')).toBe('123-******-0123');
    });

    it('builds pay component formulas from invoice/labor split amounts', () => {
        const components = buildPayslipPayComponents(validRow);

        expect(components).toHaveLength(2);
        expect(components[0]).toMatchObject({
            label: '계산서 지급분',
            manDay: 5,
            amount: 1000000,
        });
        expect(components[1].formula).toContain('15.0공수');
    });

    it('validates blocking errors separately from warnings', () => {
        const summary = validateMonthlyPayslipRows([
            validRow,
            {
                ...validRow,
                id: 'bad-row',
                workerName: '',
                grossAmount: 0,
                totalAmount: -1,
                bankName: '',
            },
        ]);

        expect(summary.totalRows).toBe(2);
        expect(summary.readyRows).toBe(1);
        expect(summary.errorCount).toBeGreaterThan(0);
        expect(summary.warningCount).toBeGreaterThan(0);
    });

    it('creates stable checksums for the same snapshot payload', () => {
        const checksumA = createPayslipChecksum({ id: 'a', amount: 1000 });
        const checksumB = createPayslipChecksum({ id: 'a', amount: 1000 });
        const snapshot = buildMonthlyPayslipSnapshot(validRow, { deliveryMethod: 'confirm' });

        expect(checksumA).toBe(checksumB);
        expect(snapshot.checksum).toMatch(/^[0-9a-f]{8}$/);
        expect(snapshot.row.workerIdentifierMasked).toBe('900101-1******');
    });
});
