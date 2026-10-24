const test = require('node:test'), assert = require('node:assert/strict');
const { schedulerLocation, isWorkspaceSchedulerJob } = require('./check-ai-workspace-production.cjs');

test('scheduled functions use project App Engine/default location instead of function region', () => {
  assert.equal(schedulerLocation({}), 'us-central1');
  assert.equal(schedulerLocation({ locationId: 'us-central' }), 'us-central1');
  assert.equal(schedulerLocation({ locationId: 'europe-west' }), 'europe-west1');
  assert.equal(schedulerLocation({ locationId: 'asia-northeast3' }), 'asia-northeast3');
  assert.throws(() => schedulerLocation({ locationId: '../wrong' }), /invalid/);
});

test('scheduler target matches Firebase CLI schedule naming and the exact project and function', () => {
  const job = topicName => ({ pubsubTarget: { topicName } });
  const target = 'projects/example/topics/firebase-schedule-generateScheduledWorkspaceReports-asia-northeast3';
  assert.equal(isWorkspaceSchedulerJob(job(target), 'example'), true);
  assert.equal(isWorkspaceSchedulerJob(job(target), 'another'), false);
  assert.equal(isWorkspaceSchedulerJob(job(target.replace('firebase-schedule-', 'firebase-scheduled-')), 'example'), false);
  assert.equal(isWorkspaceSchedulerJob(job(target.replace('generateScheduledWorkspaceReports', 'anotherTask')), 'example'), false);
  assert.equal(isWorkspaceSchedulerJob({}, 'example'), false);
});
