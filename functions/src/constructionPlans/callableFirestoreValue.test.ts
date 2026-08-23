import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Timestamp } from 'firebase-admin/firestore';
import { callableFirestoreValue } from './callableFirestoreValue';

test('normalizes Admin SDK Timestamp values without a namespace constructor lookup', () => {
    const instant = new Date('2026-08-22T03:04:05.678Z');
    assert.equal(callableFirestoreValue(Timestamp.fromDate(instant)), instant.toISOString());
});

test('normalizes Timestamp-like values from a different SDK copy or emulator realm', () => {
    class ForeignTimestamp {
        constructor(private readonly instant: Date) {}

        toDate(): Date {
            return new Date(this.instant.getTime());
        }
    }

    const instant = new Date('2026-08-22T10:20:30.000Z');
    assert.deepEqual(callableFirestoreValue({
        createdAt: new ForeignTimestamp(instant),
        nested: [new ForeignTimestamp(instant), { updatedAt: instant }],
    }), {
        createdAt: instant.toISOString(),
        nested: [instant.toISOString(), { updatedAt: instant.toISOString() }],
    });
});

test('falls back to ordinary object normalization for an invalid Timestamp-like value', () => {
    let calls = 0;
    const normalized = callableFirestoreValue({
        seconds: 123,
        toDate: () => {
            calls += 1;
            throw new Error('not-a-firestore-timestamp');
        },
    }) as Record<string, unknown>;

    assert.equal(calls, 1);
    assert.equal(normalized.seconds, 123);
    assert.equal(typeof normalized.toDate, 'function');
});
