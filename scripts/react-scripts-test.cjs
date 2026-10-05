function ciTestArgs(args, { platform = process.platform, cwd = process.cwd() } = {}) {
  const explicitWorkers = args.some(arg => /^--(?:maxWorkers|runInBand)(?:=|$)/.test(arg)
    || arg === '-i' || arg === '-w' || arg.startsWith('-w='));
  // CRA/Jest escapes dots in an absolute Windows root into a path separator
  // (for example playz\\.codex). Keep the same test patterns relative to the
  // existing src root so managed worktrees do not silently lose every test.
  const needsRelativeMatch = platform === 'win32' && /(^|[\\/])[^\\/]*\.[^\\/]*(?:[\\/]|$)/.test(cwd)
    && !args.some(arg => /^--test(?:Match|Regex)(?:=|$)/.test(arg));
  const patterns = needsRelativeMatch ? [
    '--testMatch=**/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '--testMatch=**/src/**/*.{spec,test}.{js,jsx,ts,tsx}',
  ] : [];
  return ['--watchAll=false', ...(!explicitWorkers ? ['--maxWorkers=2'] : []), ...patterns, ...args];
}

module.exports = { ciTestArgs };
if (require.main === module) {
  process.argv = [process.argv[0], require.resolve('react-scripts/scripts/test'), ...ciTestArgs(process.argv.slice(2))];
  require('react-scripts/scripts/test');
}
