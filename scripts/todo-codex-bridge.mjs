import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const DEFAULT_PORT = 8787;
const RUNNER_PATH = path.join(__dirname, 'todo-codex-worker.mjs');
const LOG_DIR = path.join(WORKSPACE_ROOT, '.codex-todo-worker');

const HELP_TEXT = `
Todo Codex bridge

Usage:
  npm run todo:codex-bridge
  npm run todo:codex-automation

Options:
  --watch              Start the opted-in automatic Todo worker with the bridge.
  --port <port>        Local bridge port. Default ${DEFAULT_PORT}.

Endpoints:
  GET  /health
  POST /todo-codex/run  { "taskId": "<Firestore task id>" }
`;

const parseArgs = (argv) => {
  const options = {
    help: false,
    port: Number(process.env.TODO_CODEX_BRIDGE_PORT || DEFAULT_PORT),
    watch: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--watch') options.watch = true;
    else if (arg === '--port') {
      options.port = Number(argv[index + 1] || DEFAULT_PORT);
      index += 1;
    }
  }
  if (!Number.isFinite(options.port) || options.port <= 0) options.port = DEFAULT_PORT;
  return options;
};

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  console.log(HELP_TEXT.trim());
  process.exit(0);
}

const activeTaskIds = new Set();
const watcher = {
  child: null,
  startedAt: '',
  lastError: ''
};
const ensureLogDir = () => fs.mkdirSync(LOG_DIR, { recursive: true });
const appendBridgeLog = (message) => {
  ensureLogDir();
  fs.appendFileSync(path.join(LOG_DIR, 'bridge.log'), `[${new Date().toISOString()}] ${message}\n`, 'utf8');
};

const writeCorsHeaders = (req, res) => {
  const origin = req.headers.origin || '';
  const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', isLocalOrigin ? origin : 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

const sendJson = (req, res, statusCode, payload) => {
  writeCorsHeaders(req, res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
};

const readJsonBody = (req) => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString('utf8');
    if (body.length > 200000) {
      reject(new Error('Request body is too large.'));
      req.destroy();
    }
  });
  req.on('end', () => {
    if (!body.trim()) return resolve({});
    try {
      resolve(JSON.parse(body));
    } catch (error) {
      reject(error);
    }
  });
  req.on('error', reject);
});

const normalizeTaskId = (value) => {
  const taskId = String(value || '').trim();
  return taskId && taskId.length <= 256 && !taskId.includes('/') ? taskId : '';
};

const isWatcherRunning = () => Boolean(watcher.child && watcher.child.exitCode === null && !watcher.child.killed);

const startWatcher = () => {
  if (isWatcherRunning()) return;

  watcher.lastError = '';
  watcher.startedAt = new Date().toISOString();
  watcher.child = spawn(process.execPath, [RUNNER_PATH, '--watch'], {
    cwd: WORKSPACE_ROOT,
    windowsHide: true,
    env: { ...process.env, TODO_CODEX_AUTO_ENABLED: 'true' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const logOutput = (stream, logger) => stream.on('data', (chunk) => {
    const message = chunk.toString('utf8').trim();
    if (!message) return;
    logger(message);
    appendBridgeLog(`[watch] ${message}`);
  });
  logOutput(watcher.child.stdout, console.log);
  logOutput(watcher.child.stderr, console.error);
  watcher.child.on('error', (error) => {
    watcher.lastError = error.message;
    appendBridgeLog(`[watch] error: ${error.message}`);
  });
  watcher.child.on('close', (code) => {
    if (code !== 0 && code !== null) watcher.lastError = `Watcher exited with code ${code}.`;
    appendBridgeLog(`[watch] close: ${code}`);
    watcher.child = null;
  });
  appendBridgeLog(`[watch] start pid=${watcher.child.pid || 'unknown'}`);
};

const stopWatcher = () => {
  if (!watcher.child || watcher.child.exitCode !== null) return;
  watcher.child.kill();
};

const getWatcherHealth = () => ({
  enabled: options.watch,
  running: isWatcherRunning(),
  pid: isWatcherRunning() ? watcher.child.pid : null,
  startedAt: watcher.startedAt || null,
  lastError: watcher.lastError || null
});

const runTask = (taskId) => {
  activeTaskIds.add(taskId);
  appendBridgeLog(`start ${taskId}`);
  const child = spawn(process.execPath, [RUNNER_PATH, '--task-id', taskId], {
    cwd: WORKSPACE_ROOT,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const logOutput = (stream, logger) => stream.on('data', (chunk) => {
    const message = chunk.toString('utf8').trim();
    if (!message) return;
    logger(message);
    appendBridgeLog(message);
  });
  logOutput(child.stdout, console.log);
  logOutput(child.stderr, console.error);
  child.on('error', (error) => {
    activeTaskIds.delete(taskId);
    appendBridgeLog(`error ${taskId}: ${error.message}`);
  });
  child.on('close', (code) => {
    activeTaskIds.delete(taskId);
    appendBridgeLog(`close ${taskId}: ${code}`);
  });
};

const server = http.createServer(async (req, res) => {
  writeCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    sendJson(req, res, 200, {
      ok: true,
      activeTaskIds: Array.from(activeTaskIds),
      watcher: getWatcherHealth()
    });
    return;
  }
  if (req.method === 'POST' && req.url === '/todo-codex/run') {
    try {
      const body = await readJsonBody(req);
      const taskId = normalizeTaskId(body.taskId);
      if (!taskId) {
        sendJson(req, res, 400, { ok: false, error: 'taskId가 필요합니다.' });
        return;
      }
      if (activeTaskIds.has(taskId)) {
        sendJson(req, res, 409, { ok: false, error: '이미 Codex 처리가 실행 중인 작업입니다.' });
        return;
      }
      runTask(taskId);
      sendJson(req, res, 202, { ok: true, taskId });
    } catch (error) {
      sendJson(req, res, 500, { ok: false, error: error instanceof Error ? error.message : 'Codex 실행 요청 처리에 실패했습니다.' });
    }
    return;
  }
  sendJson(req, res, 404, { ok: false, error: 'Not found' });
});

server.listen(options.port, '127.0.0.1', () => {
  console.log(`[todo-codex-bridge] http://localhost:${options.port}`);
  console.log('[todo-codex-bridge] POST /todo-codex/run accepts safe code-change requests.');
  if (options.watch) {
    startWatcher();
    console.log('[todo-codex-bridge] Automatic Todo worker started for tasks that opted in to Codex automation.');
  }
});

const shutdown = () => {
  stopWatcher();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2_000).unref();
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
