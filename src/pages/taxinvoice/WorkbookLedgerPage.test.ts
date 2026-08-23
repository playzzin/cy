Object.assign(process.env, {
    REACT_APP_FIREBASE_API_KEY: 'test-api-key',
    REACT_APP_FIREBASE_AUTH_DOMAIN: 'test.example.com',
    REACT_APP_FIREBASE_PROJECT_ID: 'test-project',
    REACT_APP_FIREBASE_STORAGE_BUCKET: 'test-project.appspot.com',
    REACT_APP_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
    REACT_APP_FIREBASE_APP_ID: '1:1234567890:web:test',
});

jest.mock('sweetalert2', () => ({
    __esModule: true,
    default: {
        mixin: () => ({}),
    },
}));

jest.mock('sweetalert2-react-content', () => ({
    __esModule: true,
    default: () => ({}),
}));

const {
    buildSummaryRows,
    canUseSummaryRangePreview,
    getWorkbookInputRowIssues,
    getWorkbookMonthRange,
    getLinkedSettlementStatus,
    getVisibleWorkbookRemark,
    partitionWorkbookImportDuplicates,
    shiftWorkbookMonth,
} = require('./WorkbookLedgerPage') as typeof import('./WorkbookLedgerPage');

describe('monthly workbook search range', () => {
    it('uses the first and last day of the selected month', () => {
        expect(getWorkbookMonthRange('2026-08')).toEqual({
            startDate: '2026-08-01',
            endDate: '2026-08-31',
        });
        expect(getWorkbookMonthRange('2028-02')).toEqual({
            startDate: '2028-02-01',
            endDate: '2028-02-29',
        });
    });

    it('moves across year boundaries with the left and right controls', () => {
        expect(shiftWorkbookMonth('2026-01', -1)).toBe('2025-12');
        expect(shiftWorkbookMonth('2026-12', 1)).toBe('2027-01');
    });
});

describe('canUseSummaryRangePreview', () => {
    const invoice = {
        id: 'invoice-1',
        transactionType: '매출',
        date: '2026-08-01',
        partnerName: '안전건설',
        siteName: 'A 현장',
        description: '임대료',
        supplyAmount: 100_000,
        taxAmount: 10_000,
        totalAmount: 110_000,
        paymentAmount: 0,
    };

    it('allows a preview when every settlement in the period is explicitly linked', () => {
        expect(canUseSummaryRangePreview([
            invoice,
            {
                ...invoice,
                id: 'payment-1',
                date: '2026-08-10',
                totalAmount: 0,
                paymentAmount: 40_000,
                matchedEntryId: 'invoice-1',
            },
        ] as any)).toBe(true);
    });

    it('waits for full verification when a legacy settlement or adjustment is unmapped', () => {
        expect(canUseSummaryRangePreview([
            invoice,
            { ...invoice, id: 'legacy-payment', totalAmount: 0, paymentAmount: 40_000 },
        ] as any)).toBe(false);
        expect(canUseSummaryRangePreview([
            invoice,
            { ...invoice, id: 'legacy-adjustment', totalAmount: -110_000, paymentAmount: 0 },
        ] as any)).toBe(false);
    });

    it('waits when an advance usage points outside the loaded period context', () => {
        expect(canUseSummaryRangePreview([
            invoice,
            {
                ...invoice,
                id: 'advance-usage',
                totalAmount: 0,
                paymentAmount: 30_000,
                matchedEntryId: 'invoice-1',
                sourceType: 'advanceUsage',
                sourceId: 'old-source',
            },
        ] as any)).toBe(false);
    });
});

describe('getVisibleWorkbookRemark', () => {
    it('hides a legacy mapped-address segment from an AI tax-invoice bulk-review remark', () => {
        expect(getVisibleWorkbookRemark(
            'Gemini 세금계산서 검수 · invoice-20260716.pdf · 매핑주소: 서울특별시 강남구 테헤란로 123'
        )).toBe('Gemini 세금계산서 검수 · invoice-20260716.pdf');
    });

    it('keeps the provenance of an inline mapped-address remark while hiding its address', () => {
        expect(getVisibleWorkbookRemark(
            'AI 세금계산서 대량검수 (주소 매핑: 경기도 성남시 분당구 판교로 242)'
        )).toBe('AI 세금계산서 대량검수');
    });

    it('does not alter a manual remark that happens to mention a mapping address', () => {
        const manualRemark = '현장 확인용 매핑주소: 서울특별시 강남구 테헤란로 123';

        expect(getVisibleWorkbookRemark(manualRemark)).toBe(manualRemark);
    });
});

describe('getLinkedSettlementStatus', () => {
    const makeSettlementEntry = (overrides: Record<string, unknown> = {}) => ({
        id: 'payment-1',
        transactionType: '매출',
        date: '2026-08-12',
        partnerName: '현건설',
        siteName: '광주 현건설 현장',
        description: '입금',
        supplyAmount: 0,
        taxAmount: 0,
        totalAmount: 0,
        paymentAmount: 0,
        matchedEntryId: 'invoice-1',
        ...overrides,
    });

    it('marks an invoice as fully settled when a linked payment covers the total', () => {
        const result = getLinkedSettlementStatus(
            { id: 'invoice-1', totalAmount: 12_101_155, paymentAmount: 0 },
            [makeSettlementEntry({ paymentAmount: 12_101_155 })] as any,
        );

        expect(result.isFullySettled).toBe(true);
        expect(result.settledAmount).toBe(12_101_155);
        expect(result.outstandingAmount).toBe(0);
    });

    it('returns the true remainder and ignores unrelated or deleted payments', () => {
        const result = getLinkedSettlementStatus(
            { id: 'invoice-1', totalAmount: 12_101_155, paymentAmount: 0 },
            [
                makeSettlementEntry({ paymentAmount: 5_000_000 }),
                makeSettlementEntry({ id: 'payment-2', matchedEntryId: 'invoice-2', paymentAmount: 7_101_155 }),
                makeSettlementEntry({ id: 'payment-3', paymentAmount: 7_101_155, deletedAt: '2026-08-13T00:00:00.000Z' }),
            ] as any,
        );

        expect(result.isFullySettled).toBe(false);
        expect(result.settledAmount).toBe(5_000_000);
        expect(result.outstandingAmount).toBe(7_101_155);
        expect(result.entries).toHaveLength(1);
    });
});

describe('buildSummaryRows current outstanding balance', () => {
    const filter = {
        startDate: '2020-01-01',
        endDate: '2020-01-05',
        teamName: '',
        mode: '미지급금',
        partnerName: '',
        siteName: '',
    } as const;
    const invoice = {
        id: 'purchase-1',
        transactionType: '매입',
        date: '2020-01-02',
        partnerName: '안전상사',
        siteName: 'A 현장',
        description: '자재 매입',
        supplyAmount: 100_000,
        taxAmount: 10_000,
        totalAmount: 110_000,
        paymentAmount: 0,
        appliedYear: 2020,
        appliedMonth: 1,
        note: '',
        teamName: '청연팀',
    };

    it('excludes a fully paid invoice even when payment was registered after the search end date', () => {
        const rows = buildSummaryRows([
            invoice,
            {
                ...invoice,
                id: 'payment-1',
                date: '2020-01-10',
                description: '지급',
                supplyAmount: 0,
                taxAmount: 0,
                totalAmount: 0,
                paymentAmount: 110_000,
                matchedEntryId: 'purchase-1',
            },
        ] as any, filter as any);

        expect(rows).toEqual([]);
    });

    it('keeps only the true remainder for a partially paid invoice', () => {
        const rows = buildSummaryRows([
            invoice,
            {
                ...invoice,
                id: 'payment-1',
                date: '2020-01-10',
                description: '지급',
                supplyAmount: 0,
                taxAmount: 0,
                totalAmount: 0,
                paymentAmount: 40_000,
                matchedEntryId: 'purchase-1',
            },
        ] as any, filter as any);

        expect(rows).toHaveLength(1);
        expect(rows[0].settledAmount).toBe(40_000);
        expect(rows[0].outstandingAmount).toBe(70_000);
    });

    it('does not keep a fully paid row in 미지급금 just because it has an advance balance', () => {
        const rows = buildSummaryRows([
            invoice,
            {
                ...invoice,
                id: 'payment-1',
                date: '2020-01-10',
                description: '지급',
                supplyAmount: 0,
                taxAmount: 0,
                totalAmount: 0,
                paymentAmount: 120_000,
                matchedEntryId: 'purchase-1',
            },
        ] as any, filter as any);

        expect(rows).toEqual([]);
    });

    it('leaves an ambiguous legacy payment unmatched', () => {
        const firstInvoice = {
            ...invoice,
            id: 'purchase-1',
            totalAmount: 110_000,
        };
        const secondInvoice = {
            ...invoice,
            id: 'purchase-2',
            totalAmount: 220_000,
        };
        const rows = buildSummaryRows([
            firstInvoice,
            secondInvoice,
            {
                ...invoice,
                id: 'legacy-payment',
                date: '2020-01-10',
                description: '레거시 지급',
                supplyAmount: 0,
                taxAmount: 0,
                totalAmount: 0,
                paymentAmount: 50_000,
                matchedEntryId: '',
            },
        ] as any, filter as any);

        expect(rows).toHaveLength(2);
        expect(rows.map((row) => ({ id: row.id, settledAmount: row.settledAmount, outstandingAmount: row.outstandingAmount }))).toEqual([
            { id: 'purchase-1', settledAmount: 0, outstandingAmount: 110_000 },
            { id: 'purchase-2', settledAmount: 0, outstandingAmount: 220_000 },
        ]);
    });

    it('matches a legacy payment when exactly one candidate has the same amount', () => {
        const rows = buildSummaryRows([
            { ...invoice, id: 'purchase-1', totalAmount: 110_000 },
            { ...invoice, id: 'purchase-2', totalAmount: 220_000 },
            {
                ...invoice,
                id: 'legacy-payment',
                date: '2020-01-10',
                description: '레거시 지급',
                supplyAmount: 0,
                taxAmount: 0,
                totalAmount: 0,
                paymentAmount: 220_000,
                matchedEntryId: '',
            },
        ] as any, filter as any);

        expect(rows).toHaveLength(1);
        expect(rows[0]).toEqual(expect.objectContaining({
            id: 'purchase-1',
            settledAmount: 0,
            outstandingAmount: 110_000,
        }));
    });

    it('applies a uniquely matching negative adjustment without changing its own summary row', () => {
        const rows = buildSummaryRows([
            invoice,
            {
                ...invoice,
                id: 'purchase-adjustment',
                supplyAmount: -100_000,
                taxAmount: -10_000,
                totalAmount: -110_000,
            },
        ] as any, {
            ...filter,
            mode: '매입',
        } as any);

        expect(rows).toHaveLength(2);
        expect(rows[0]).toEqual(expect.objectContaining({
            id: 'purchase-1',
            settledAmount: 110_000,
            outstandingAmount: 0,
        }));
        expect(rows[1]).toEqual(expect.objectContaining({
            id: 'purchase-adjustment',
            totalAmount: -110_000,
            settledAmount: 0,
            outstandingAmount: 0,
        }));
    });

    it('preserves source advance and target remainder after advance usage', () => {
        const rows = buildSummaryRows([
            { ...invoice, id: 'purchase-source', totalAmount: 100_000 },
            { ...invoice, id: 'purchase-target', totalAmount: 80_000 },
            {
                ...invoice,
                id: 'source-payment',
                date: '2020-01-10',
                description: '지급',
                supplyAmount: 0,
                taxAmount: 0,
                totalAmount: 0,
                paymentAmount: 150_000,
                matchedEntryId: 'purchase-source',
            },
            {
                ...invoice,
                id: 'advance-usage',
                date: '2020-01-11',
                description: '선급금 사용',
                supplyAmount: 0,
                taxAmount: 0,
                totalAmount: 0,
                paymentAmount: 30_000,
                matchedEntryId: 'purchase-target',
                sourceType: 'advanceUsage',
                sourceId: 'purchase-source',
            },
        ] as any, {
            ...filter,
            mode: '매입',
        } as any);

        expect(rows).toHaveLength(2);
        expect(rows[0]).toEqual(expect.objectContaining({
            id: 'purchase-source',
            outstandingAmount: 0,
            advanceAmount: 20_000,
        }));
        expect(rows[1]).toEqual(expect.objectContaining({
            id: 'purchase-target',
            advanceUsedAmount: 30_000,
            outstandingAmount: 50_000,
        }));
    });
});

describe('getWorkbookInputRowIssues', () => {
    it('returns row-level fields for an incomplete input row', () => {
        const issues = getWorkbookInputRowIssues([{
            transactionType: '매출',
            date: '',
            partnerName: '',
            supplyAmount: null,
            paymentAmount: null,
        }], 2026, '청연팀');

        expect(issues).toHaveLength(1);
        expect(issues[0].rowNumber).toBe(1);
        expect(issues[0].fields).toEqual(expect.arrayContaining([
            'date',
            'partnerName',
            'supplyAmount',
            'paymentAmount',
        ]));
    });

    it('accepts a complete supply-amount row after deriving tax and total', () => {
        const issues = getWorkbookInputRowIssues([{
            transactionType: '매입',
            date: '2026-08-13',
            partnerName: '테스트 거래처',
            supplyAmount: 100_000,
            paymentAmount: null,
        }], 2026, '청연팀');

        expect(issues).toEqual([]);
    });
});

describe('partitionWorkbookImportDuplicates', () => {
    const makeEntry = (overrides: Record<string, unknown> = {}) => ({
        transactionType: '매입',
        date: '2026-08-13',
        partnerName: '테스트 거래처',
        siteName: 'A 현장',
        description: '세금계산서',
        supplyAmount: 100_000,
        taxAmount: 10_000,
        totalAmount: 110_000,
        paymentAmount: 0,
        appliedYear: 2026,
        appliedMonth: 8,
        note: '',
        teamName: '청연팀',
        ...overrides,
    });

    it('excludes exact existing and in-file duplicates while keeping a different site', () => {
        const existing = [{ id: 'existing-1', ...makeEntry() }];
        const result = partitionWorkbookImportDuplicates([
            makeEntry(),
            makeEntry({ siteName: 'B 현장' }),
            makeEntry({ siteName: 'B 현장' }),
        ] as any, existing as any);

        expect(result.newEntries).toHaveLength(1);
        expect(result.newEntries[0].siteName).toBe('B 현장');
        expect(result.duplicateEntries).toHaveLength(2);
    });
});
