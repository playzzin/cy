#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."
case "${1:-}" in
  setup|start|check) operation=$1 ;;
  *) echo 'Usage: bash ops/cloud/server.sh setup|start|check' >&2; exit 2 ;;
esac
if [[ $(uname -s) != Linux ]]; then
  echo 'Run this command in the Linux development checkout. On Windows use npm run dev:cloud.' >&2
  exit 1
fi
if [[ $operation != check ]]; then
  mkdir -p .firebase
  exec 9>>.firebase/cloud-development.lock
  flock -n 9 || { echo 'This checkout already has a running setup or development server.' >&2; exit 1; }
fi

# Use the installed Node 22 when it supports the Hosting proxy settings.
runtime_dir="$PWD/.cache/cy-cloud-runtime"
if [[ -x "$runtime_dir/node_modules/.bin/node" ]]; then
  export PATH="$runtime_dir/node_modules/.bin:$PATH"
fi
node_ready() {
  node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major === 22 && minor >= 21 ? 0 : 1)' 2>/dev/null
}
if ! node_ready; then
  if [[ $operation != setup ]]; then
    echo 'Prepare Node 22 with bash ops/cloud/server.sh setup first.' >&2
    exit 1
  fi
  npm install --prefix "$runtime_dir" --no-save --no-package-lock --no-audit --no-fund node@22.23.5 npm@10.9.8
  export PATH="$runtime_dir/node_modules/.bin:$PATH"
  node_ready
fi

case "$operation" in
  setup)
    if [[ -L node_modules || -L functions/node_modules ]]; then
      echo 'Use a checkout with its own dependency folders before running npm ci.' >&2
      exit 1
    fi
    npm run cloud:setup
    ;;
  start)
    export HOST=0.0.0.0 PORT=3000 BROWSER=none CI=true
    # Check the exact preview port before CRA can offer another one.
    node -e 'const server = require("node:net").createServer(); server.on("error", e => { console.error("Port 3000:", e.code); process.exitCode = 1; }); server.listen(3000, "0.0.0.0", () => server.close());'
    exec node scripts/react-scripts-start.js --staging --cloud-server
    ;;
  check)
    exec node scripts/check-cloud-development.cjs
    ;;
esac
