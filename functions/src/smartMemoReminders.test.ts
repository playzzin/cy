import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { canReceiveMemoReminder, nextMemoReminderTime } from './smartMemoReminders';

const time = (value: string) => Date.parse(`${value}+09:00`);
test('only active owners, public viewers and DEV can schedule a memo reminder', () => {
    const memo = { userId: 'owner', scope: 'private' };
    assert.equal(canReceiveMemoReminder('owner', { status: 'active' }, memo), true);
    assert.equal(canReceiveMemoReminder('other', { status: 'active' }, memo), false);
    assert.equal(canReceiveMemoReminder('other', { status: 'active', role: 'admin' }, memo), false);
    assert.equal(canReceiveMemoReminder('other', { position: ' ＤＥＶ ' }, memo), true);
    assert.equal(canReceiveMemoReminder('other', { additionalPositions: ['개발자'] }, memo), true);
    assert.equal(canReceiveMemoReminder('other', {}, { ...memo, scope: 'public' }), true);
    assert.equal(canReceiveMemoReminder('owner', { status: 'suspended' }, memo), false);
    assert.equal(canReceiveMemoReminder('owner', null, memo), false);
    assert.equal(canReceiveMemoReminder('owner', {}, null), false);
    assert.equal(canReceiveMemoReminder('other', { email: 'legacy@example.test' }, { userId: 'legacy@example.test', scope: 'private' }), false);
});

test('once, daily and weekly schedules advance past missed occurrences', () => {
    const at = time('2026-09-14T09:30');
    assert.equal(nextMemoReminderTime(at, 'none', at, 14), null);
    assert.equal(nextMemoReminderTime(at, 'daily', at, 14), time('2026-09-15T09:30'));
    assert.equal(nextMemoReminderTime(at, 'weekly', at, 14), time('2026-09-21T09:30'));
    assert.equal(nextMemoReminderTime(at, 'daily', time('2026-09-18T10:00'), 14), time('2026-09-19T09:30'));
    assert.equal(nextMemoReminderTime(at, 'weekly', time('2026-09-28T09:30'), 14), time('2026-10-05T09:30'));
});

test('weekday recurrence skips weekends in Korean time', () => {
    const friday = time('2026-09-18T00:30');
    assert.equal(nextMemoReminderTime(friday, 'weekdays', friday, 18), time('2026-09-21T00:30'));
    assert.equal(nextMemoReminderTime(friday, 'weekdays', time('2026-09-25T10:00'), 18), time('2026-09-28T00:30'));
});

test('monthly recurrence clamps to month end and recovers the original day', () => {
    const january = time('2026-01-31T09:30');
    const february = nextMemoReminderTime(january, 'monthly', january, 31)!;
    assert.equal(february, time('2026-02-28T09:30'));
    assert.equal(nextMemoReminderTime(february, 'monthly', february, 31), time('2026-03-31T09:30'));
    const leap = time('2028-01-31T09:30');
    assert.equal(nextMemoReminderTime(leap, 'monthly', leap, 31), time('2028-02-29T09:30'));
    assert.equal(nextMemoReminderTime(january, 'monthly', time('2027-03-01T10:00'), 31), time('2027-03-31T09:30'));
});
