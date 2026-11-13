import { getDocs, runTransaction } from 'firebase/firestore';
import { saveAccommodationAndCleanupExpenses } from './accommodationTerminationCleanupService';

jest.mock('../config/firebase', () => ({ db: {} }));
jest.mock('../utils/firestoreConverter', () => ({ createConverter: () => ({}) }));
jest.mock('firebase/firestore', () => ({
    collection: (_db: unknown, path: string) => ({ path }),
    doc: (_db: unknown, collection: string, id: string) => {
        const ref = { path: `${collection}/${id}`, id, withConverter: () => ref };
        return ref;
    },
    where: (field: string, _operator: string, value: unknown) => ({ field, value }),
    query: (ref: unknown, ...filters: unknown[]) => ({ ...(ref as object), filters }),
    getDocs: jest.fn(), runTransaction: jest.fn(), Timestamp: { now: () => 'now' },
}));

type Data = Record<string, any>;
let store: Map<string, Data>;
let failCommit: boolean;
const record = (month: string) => `accommodationUtilityRecords/${month}`;
const item = (id: string) => `accommodation_billing_line_items/${id}`;
const bill = (id: string) => `accommodation_billing_documents/${id}`;
const snapshot = (path: string) => ({ id: path.split('/').pop()!, ref: { path }, exists: () => store.has(path), data: () => store.get(path) });
const patch = { status: 'inactive' as const, billingEndYearMonth: '2026-10', endedDate: '2026-11-13' };

beforeEach(() => {
    failCommit = false;
    store = new Map(Object.entries({
        'accommodations/room': { id: 'room', status: 'active', contract: { endDate: '2026-11-10' } },
        [record('2026-10')]: { accommodationId: 'room', yearMonth: '2026-10', costs: { rent: 450000 } },
        [record('2026-11')]: { accommodationId: 'room', yearMonth: '2026-11', costs: { rent: 450000 }, paymentStatus: 'unpaid' },
        [bill('past')]: { yearMonth: '2026-10', status: 'confirmed', teamId: 'team', lineItemIds: ['past'] },
        [bill('shared')]: { yearMonth: '2026-11', status: 'draft', teamId: 'team', lineItemIds: ['rent', 'electricity', 'other'] },
        [bill('empty')]: { yearMonth: '2026-12', status: 'draft', teamId: 'team', lineItemIds: ['manual'] },
        [item('past')]: { billingDocumentId: 'past', sourceAccommodationId: 'room', amount: 450000 },
        [item('rent')]: { billingDocumentId: 'shared', sourceAccommodationId: 'room', amount: 450000 },
        [item('electricity')]: { billingDocumentId: 'shared', sourceAccommodationId: 'room', amount: 30100 },
        [item('other')]: { billingDocumentId: 'shared', sourceAccommodationId: 'other-room', amount: 500000 },
        [item('manual')]: { billingDocumentId: 'empty', sourceAccommodationId: 'room', sourceType: 'manual', amount: -10000 },
        'support_shared_data/accommodation_billing_sync_v1_2026-11_2026-11': { data: 'old guard' },
    }));
    (getDocs as jest.Mock).mockImplementation(async ({ path, filters }) => ({ docs: [...store.keys()]
        .filter(key => key.startsWith(`${path}/`) && filters.every(({ field, value }: Data) => store.get(key)?.[field] === value))
        .map(snapshot) }));
    (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
        const writes: Array<() => void> = [];
        await callback({
            get: async ({ path }: Data) => {
                if (writes.length) throw new Error('read after write');
                return snapshot(path);
            },
            delete: ({ path }: Data) => writes.push(() => store.delete(path)),
            update: ({ path }: Data, data: Data) => writes.push(() => store.set(path, { ...store.get(path), ...data })),
            set: ({ path }: Data, data: Data) => writes.push(() => store.set(path, { ...store.get(path), ...data })),
        });
        if (failCommit) throw new Error('transaction failed');
        writes.forEach(write => write());
    });
});

it('종료월 이후의 장부·모든 비용·빈 청구서를 삭제하고 과거와 다른 숙소는 보존한다', async () => {
    const past = JSON.stringify([store.get(record('2026-10')), store.get(bill('past')), store.get(item('past'))]);
    const other = { ...store.get(item('other')) };
    await saveAccommodationAndCleanupExpenses('room', patch);
    expect(store.has(record('2026-11'))).toBe(false);
    expect(store.has(item('rent'))).toBe(false);
    expect(store.has(item('electricity'))).toBe(false);
    expect(store.has(item('manual'))).toBe(false);
    expect(store.has(bill('empty'))).toBe(false);
    expect(store.has('support_shared_data/accommodation_billing_sync_v1_2026-11_2026-11')).toBe(false);
    expect(store.get(item('other'))).toEqual(other);
    expect(store.get(bill('shared'))?.lineItemIds).toEqual(['other']);
    expect(JSON.stringify([store.get(record('2026-10')), store.get(bill('past')), store.get(item('past'))])).toBe(past);
    expect(store.get('accommodations/room')).toMatchObject(patch);
    await saveAccommodationAndCleanupExpenses('room', patch);
    expect(store.get(bill('shared'))?.lineItemIds).toEqual(['other']);
});

it.each(['confirmed', 'settled', 'paid', 'failure'])('보호된 내역이나 실패 시 숙소 종료와 삭제를 함께 취소한다 (%s)', async scenario => {
    if (scenario === 'confirmed') store.get(bill('shared'))!.status = 'confirmed';
    if (scenario === 'settled') store.set('system_configs/team_settlement_2026-11__team', { data: JSON.stringify({ confirmedAt: '2026-11-01' }) });
    if (scenario === 'paid') store.get(record('2026-11'))!.paymentStatus = 'paid';
    failCommit = scenario === 'failure';
    const before = JSON.stringify([...store]);
    await expect(saveAccommodationAndCleanupExpenses('room', patch)).rejects.toThrow();
    expect(JSON.stringify([...store])).toBe(before);
});

it('계약 기간을 연장하면 유효한 이후 월 경비를 삭제하지 않는다', async () => {
    await saveAccommodationAndCleanupExpenses('room', { contract: { endDate: '2027-12-31' } as any });
    expect(store.has(record('2026-11'))).toBe(true);
    expect(store.has(item('electricity'))).toBe(true);
    expect(store.get(bill('shared'))?.lineItemIds).toEqual(['rent', 'electricity', 'other']);
});
