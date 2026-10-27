const REQUIRED_JOBS = [
  ['frontend', 'FRONTEND_RESULT'],
  ['server', 'SERVER_RESULT'],
  ['rules', 'RULES_RESULT'],
];
const KNOWN_RESULTS = new Set(['success', 'failure', 'cancelled', 'skipped', 'in_progress', 'queued']);

function verifyQualityResults(environment = process.env, log = console.log) {
  const results = REQUIRED_JOBS.map(([job, key]) => {
    const value = environment[key];
    // Only fixed job names and recognized statuses may reach the workflow log.
    const status = value === undefined || value === '' ? 'missing'
      : KNOWN_RESULTS.has(value) ? value : 'unknown';
    log(`${job}: ${status}`);
    return { job, status };
  });
  const blocked = results.filter(result => result.status !== 'success');
  if (blocked.length) {
    throw new Error(`Quality Gate 실패: ${blocked.map(result => result.job).join(', ')} 검사가 모두 성공해야 합니다.`);
  }
  return results;
}

module.exports = { verifyQualityResults };
if (require.main === module) {
  try { verifyQualityResults(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
