const fs = require('node:fs');

function diagnostics(log) {
  const details = new Set();
  for (const line of log.split(/\r?\n/).slice(-200)) {
    const http = line.match(/\[status\]\s+(GET|POST|PATCH|PUT|DELETE)\s+https:\/\/([a-z0-9.-]+)\/\S*\s+([45]\d{2})\b/i);
    if (http) details.add(`${http[1]} ${http[2]} → HTTP ${http[3]}`);
    const error = line.match(/\b(TypeError|ReferenceError|SyntaxError|RangeError):/);
    if (error) details.add(error[1]);
    const frame = line.match(/\bat\s+.*?node_modules\/(firebase-tools|google-auth-library)\/([\w./-]+:\d+:\d+)/);
    if (frame) details.add(`${frame[1]}/${frame[2]}`);
  }
  return [...details].slice(-12);
}

module.exports = { diagnostics };
if (require.main === module && fs.existsSync('firebase-debug.log')) {
  for (const message of diagnostics(fs.readFileSync('firebase-debug.log', 'utf8'))) console.error(message);
}
