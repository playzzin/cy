const invoice = (id: string, date: string, type: string, tax: number) => ({
    id, date, transactionType: type, partnerName: '검증 거래처', siteName: '검증 현장',
    description: '합성 부가세 검증', supplyAmount: tax * 10, taxAmount: tax, totalAmount: tax * 11, paymentAmount: 0,
});
export const useAuth = () => ({ currentUser: { uid: 'local-vat-qa' } });
export const companyService = { getActiveCompanies: async () => [] };
export const siteService = { getSites: async () => [] };
export const teamService = { getTeams: async () => [] };
export const accountDirectoryService = { getEntriesByCategory: async () => [] };
export const aiSettingsService = {};
export const createTaxInvoiceDuplicateFingerprint = () => '';
export const validateTaxInvoiceFiles = () => [];
export class WorkbookLedgerBatchError extends Error {}
export const createWorkbookLedgerService = () => ({
    getEntries: async () => [
        invoice('q1-sales', '2026-02-15', '매출', 1000000),
        invoice('q1-purchase', '2026-03-15', '매입', 200000),
        invoice('q2-purchase', '2026-05-15', '매입', 100000),
        invoice('q3-sales', '2026-08-15', '매출', 1500000),
        invoice('q4-sales', '2026-10-15', '매출', 500000),
    ],
});
const initialPayments = [
    { id: 'seed-1', year: 2026, quarter: 'Q1', date: '2026-08-10', amount: 300000, note: '1분기 1차 분할 납부', createdAt: '', createdBy: 'local-vat-qa' },
    { id: 'seed-2', year: 2026, quarter: 'Q1', date: '2026-09-10', amount: 200000, note: '1분기 2차 분할 납부', createdAt: '', createdBy: 'local-vat-qa' },
];
export const createQuarterVatPaymentService = (tenant: string) => {
    const key = `quarter-vat-synthetic:${tenant}`;
    const read = () => JSON.parse(localStorage.getItem(key) || JSON.stringify(tenant === 'cheongyeon' ? initialPayments : []));
    return {
        getPayments: async (year: number) => read().filter((payment: any) => payment.year === year)
            .sort((a: any, b: any) => b.date.localeCompare(a.date)),
        addPayment: async (input: any) => {
            const saved = { ...input, id: `local-${Date.now()}`, createdAt: new Date().toISOString() };
            localStorage.setItem(key, JSON.stringify([...read(), saved]));
            return saved;
        },
        deletePayment: async (year: number, quarter: string, id: string) => {
            localStorage.setItem(key, JSON.stringify(read().filter((payment: any) =>
                !(payment.id === id && payment.year === year && payment.quarter === quarter))));
        },
    };
};
export default function UnusedPreviewComponent() { return null; }
