import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { nextReportAt, reportFailure, reportRunId, validateCadence } from './reportSchedule';
import { AiReportCadence } from './contract';
const daily: AiReportCadence = { frequency: 'daily', time: '09:00', weekday: null, monthDay: null };
test('Korea schedule rolls strictly past now across midnight and year boundaries', () => {
  assert.equal(nextReportAt(daily, new Date('2026-09-28T00:00:00Z')), '2026-09-29T00:00:00.000Z');
  assert.equal(nextReportAt({ ...daily, time: '00:00' }, new Date('2026-12-31T14:59:59Z')), '2026-12-31T15:00:00.000Z');
  assert.equal(nextReportAt({ ...daily, time: '00:00' }, new Date('2026-12-31T15:00:00Z')), '2027-01-01T15:00:00.000Z');
});
test('weekly Monday and Sunday and monthly leap dates use Korean calendar', () => {
  assert.equal(nextReportAt({ ...daily, frequency: 'weekly', weekday: 1 }, new Date('2026-09-28T00:00:00Z')), '2026-10-05T00:00:00.000Z');
  assert.equal(nextReportAt({ ...daily, frequency: 'weekly', weekday: 7 }, new Date('2026-09-28T00:00:00Z')), '2026-10-04T00:00:00.000Z');
  assert.equal(nextReportAt({ ...daily, frequency: 'monthly', monthDay: 28 }, new Date('2028-02-28T00:00:00Z')), '2028-03-28T00:00:00.000Z');
  assert.equal(nextReportAt({ ...daily, frequency: 'monthly', monthDay: 1, time: '00:00' }, new Date('2026-12-31T15:00:00Z')), '2027-01-31T15:00:00.000Z');
});
test('unsupported time zones, cron and incomplete cadence cannot schedule silently', () => {
  for (const value of [null, [], { ...daily, time: '24:00' }, { ...daily, time: '9:00' }, { ...daily, timeZone: 'UTC' },
    { ...daily, frequency: 'weekly', weekday: 0 }, { ...daily, frequency: 'monthly', monthDay: 31 },
    { ...daily, frequency: 'monthly', monthDay: 1.5 }, { ...daily, weekday: 1 }, { ...daily, frequency: '* * * * *' }])
    assert.throws(() => validateCadence(value));
});
test('run identity binds schedule revision and exact intended time', () => {
  assert.equal(reportRunId('one', 1, 'date'), reportRunId('one', 1, 'date'));
  assert.notEqual(reportRunId('one', 1, 'date'), reportRunId('one', 2, 'date'));
  assert.notEqual(reportRunId('one', 1, 'date'), reportRunId('two', 1, 'date'));
  assert.notEqual(reportRunId('one', 1, 'date'), reportRunId('one', 1, 'next'));
});
test('failure classification avoids provider text and pauses changed access or conditions', () => {
  assert.equal(reportFailure({ code: 'permission-denied', message: 'private' }).pause, true);
  assert.equal(reportFailure({ code: 'auth/user-not-found' }).pause, true);
  assert.equal(reportFailure({ code: 'failed-precondition' }).retryable, false);
  assert.equal(reportFailure({ code: 'resource-exhausted' }).pause, true);
  assert.equal(reportFailure({ code: 'unavailable', message: 'secret-provider-body' }).retryable, true);
  assert.equal(JSON.stringify(reportFailure(new Error('secret'))).includes('secret'), false);
});
