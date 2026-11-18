import { normalizeCardHistoryTimeline } from './cardHistoryTimeline';

const history = (id: string, startDate: string, endDate?: string, cardId = 'card') => ({ id, cardId, startDate, endDate });

it('does not revive an overlapping predecessor after its corrected successor ends', () => {
    const records = [
        history('old', '2026-05-01', '2026-11-01'),
        history('corrected', '2026-05-15', '2026-10-31'),
        history('invalid', '2026-05-15', '2026-04-30')
    ];
    const normalized = normalizeCardHistoryTimeline(records);
    expect(normalized).toEqual([
        history('old', '2026-05-01', '2026-05-14'),
        history('corrected', '2026-05-15', '2026-10-31')
    ]);
    expect(normalized.filter(record => !record.endDate || record.endDate >= '2026-11-01')).toEqual([]);
    expect(records[0].endDate).toBe('2026-11-01');
});

it('preserves earlier gaps, separates cards and handles leap-day handoffs', () => {
    expect(normalizeCardHistoryTimeline([
        history('a', '2024-02-01'), history('b', '2024-03-01', '2024-03-10'),
        history('c', '2024-04-01'), history('other', '2024-02-01', undefined, 'other')
    ])).toEqual([
        history('a', '2024-02-01', '2024-02-29'), history('b', '2024-03-01', '2024-03-10'),
        history('c', '2024-04-01'), history('other', '2024-02-01', undefined, 'other')
    ]);
});

it('uses a deterministic last record for same-day handoffs and rejects invalid dates', () => {
    expect(normalizeCardHistoryTimeline([
        history('b', '2026-01-01'), history('a', '2026-01-01'),
        history('bad', '2026-02-30'), history('bad-end', '2026-03-01', '2026-04-31')
    ])).toEqual([history('b', '2026-01-01')]);
});
