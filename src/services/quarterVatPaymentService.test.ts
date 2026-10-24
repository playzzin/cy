import { createQuarterVatPaymentService } from './quarterVatPaymentService';

const mockAddDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockDeleteDoc = jest.fn();
jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
    collection: (_db: unknown, ...parts: string[]) => parts.join('/'),
    doc: (_db: unknown, ...parts: string[]) => parts.join('/'),
    orderBy: () => undefined,
    query: (path: string) => path,
    addDoc: (...args: unknown[]) => mockAddDoc(...args),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'saved-payment' });
    mockGetDocs.mockResolvedValue({ docs: [] });
});

it.each(['cheongyeon', 'dawon'])('persists and reloads %s payment under the attribution year/quarter, independently of payment date', async (tenant) => {
    const service = createQuarterVatPaymentService(tenant);
    const collectionName = tenant === 'dawon' ? 'quarter_vat_payments_dawon' : 'quarter_vat_payments';
    const saved = await service.addPayment({ year: 2025, quarter: 'Q1', date: '2026-08-12', amount: 12000, note: '분할 납부' });
    expect(mockAddDoc).toHaveBeenCalledWith(`${collectionName}/2025_Q1/payments`, expect.objectContaining({
        year: 2025, quarter: 'Q1', date: '2026-08-12', amount: 12000,
    }));
    mockGetDocs.mockImplementation(async (path) => ({ docs: path.includes('2025_Q1')
        ? [{ id: saved.id, data: () => saved }] : [] }));
    expect(await service.getPayments(2025, 'all')).toEqual([saved]);
    expect(mockGetDocs.mock.calls.map(([path]) => path)).toEqual(['Q1', 'Q2', 'Q3', 'Q4'].map((quarter) => `${collectionName}/2025_${quarter}/payments`));
    await service.deletePayment(2025, 'Q1', saved.id);
    expect(mockDeleteDoc).toHaveBeenCalledWith(`${collectionName}/2025_Q1/payments/saved-payment`);
});

it.each([
    { date: '2026-02-30' }, { date: '2026-13-01' }, { date: '2026-02-29' },
    { year: 2026.5 }, { quarter: 'all' as const }, { amount: 0 }, { amount: -1 }, { amount: Infinity },
])('rejects invalid payment before writing: %p', async (invalid) => {
    await expect(createQuarterVatPaymentService().addPayment({
        year: 2026, quarter: 'Q1', date: '2026-08-12', amount: 12000, ...invalid,
    })).rejects.toThrow();
    expect(mockAddDoc).not.toHaveBeenCalled();
});

it('propagates a failed quarter load instead of returning a misleading partial annual total', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('unavailable'));
    await expect(createQuarterVatPaymentService().getPayments(2026, 'all')).rejects.toThrow('unavailable');
});
