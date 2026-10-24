import { getDocs, limit, onSnapshot, orderBy, startAfter, where } from 'firebase/firestore';
import { ACTIVITY_SOURCES } from './activitySources';
import { fetchActivityPage } from './activityQuery';

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_, name) => name), query: jest.fn((...args) => args),
  where: jest.fn((...args) => args), limit: jest.fn(value => value), orderBy: jest.fn((...args) => args),
  startAfter: jest.fn(value => value), getDocs: jest.fn(), onSnapshot: jest.fn(),
  Timestamp: { fromMillis: (millis: number) => ({ millis }) },
}));
const filter = { from: '2026-10-22', to: '2026-10-22', actorId: 'actor-a' };
beforeEach(() => jest.clearAllMocks());

it('reads only 50 records from the selected source with server-side date and actor filtering', async () => {
  const last = { id: 'last', data: () => ({ createdAt: '2026-10-22T01:00:00Z' }) };
  (getDocs as jest.Mock).mockResolvedValue({ docs: Array.from({ length: 50 }, (_, index) => ({ ...last, id: `${index}` })) });
  const source = ACTIVITY_SOURCES[0];
  const page = await fetchActivityPage(source, filter);
  expect(getDocs).toHaveBeenCalledTimes(1);
  expect(limit).toHaveBeenCalledWith(50);
  expect(where).toHaveBeenCalledWith('createdAt', '>=', { millis: Date.parse('2026-10-21T15:00:00Z') });
  expect(where).toHaveBeenCalledWith('actor.uid', '==', 'actor-a');
  expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
  expect(page.hasMore).toBe(true);
  await fetchActivityPage(source, filter, page.cursor);
  expect(startAfter).toHaveBeenCalledWith(page.cursor);
  expect(onSnapshot).not.toHaveBeenCalled();
});

it('uses ISO bounds for browser audits and never retries an index failure by scanning the collection', async () => {
  const failure = { code: 'failed-precondition' };
  (getDocs as jest.Mock).mockRejectedValue(failure);
  const source = ACTIVITY_SOURCES.find(item => item.id === 'files')!;
  await expect(fetchActivityPage(source, filter)).rejects.toEqual(failure);
  expect(where).toHaveBeenCalledWith('category', '==', 'FILE_TRANSFER');
  expect(where).toHaveBeenCalledWith('timestamp', '<', '2026-10-22T15:00:00.000Z');
  expect(where).toHaveBeenCalledWith('actorId', '==', 'actor-a');
  expect(getDocs).toHaveBeenCalledTimes(1);
});

it('rejects invalid periods before doing network work', async () => {
  await expect(fetchActivityPage(ACTIVITY_SOURCES[0], { ...filter, from: '2026-11-01' })).rejects.toThrow();
  expect(getDocs).not.toHaveBeenCalled();
});
