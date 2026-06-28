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

Options:
  --port <port>  Local bridge port. Default ${DEFAULT_PORT}.
  --help         Show this help.

Endpoints:
  GET  /health
  POST /todo-codex/run  { "taskId": "<Firestore task id>" }
  POST /todo-codex/improve  { "task": { "id": "...", "title": "..." } }
`;

const parseArgs = (argv) => {
  const options = {
    help: false,
    port: Number(process.env.TODO_CODEX_BRIDGE_PORT || DEFAULT_PORT)
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--port') {
      options.port = Number(argv[index + 1] || DEFAULT_PORT);
      index += 1;
    }
  }

  if (!Number.isFinite(options.port) || options.port <= 0) {
    options.port = DEFAULT_PORT;
  }

  return options;
};

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  console.log(HELP_TEXT.trim());
  process.exit(0);
}

const activeTaskIds = new Set();

const findWindowsCodexCommand = () => {
  const appData = process.env.APPDATA || '';
  const candidates = [
    path.join(appData, 'npm', 'node_modules', '@openai', 'codex', 'node_modules', '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe'),
    path.join(appData, 'npm', 'node_modules', '@openai', 'codex', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe')
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || 'codex.cmd';
};

const codexCommand = (process.env.TODO_CODEX_COMMAND || (process.platform === 'win32' ? findWindowsCodexCommand() : 'codex')).trim();
const codexSpawnUsesShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(codexCommand);
const codexModel = (process.env.TODO_CODEX_MODEL || '').trim();
const codexSandbox = (process.env.TODO_CODEX_SANDBOX || 'read-only').trim();
const codexTimeoutMs = Number(process.env.TODO_CODEX_TIMEOUT_MS || 20 * 60 * 1000);

const ensureLogDir = () => {
  fs.mkdirSync(LOG_DIR, { recursive: true });
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
    if (!body.trim()) {
      resolve({});
      return;
    }

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
  if (!taskId || taskId.length > 256 || taskId.includes('/')) return '';
  return taskId;
};

const truncate = (value, maxLength = 3500) => {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 32)}\n...생략됨(${text.length}자)`;
};

const formatCommentsForPrompt = (comments = []) => {
  const userComments = Array.isArray(comments)
    ? comments.filter((comment) => comment && !comment.isSystem && String(comment.text || '').trim()).slice(-8)
    : [];

  if (userComments.length === 0) return '사용자 댓글 없음';

  return userComments
    .map((comment) => {
      const user = comment.user || '알 수 없음';
      const time = comment.time || '시간 없음';
      const text = truncate(comment.text, 800);
      return `- ${user} (${time}): ${text}`;
    })
    .join('\n');
};

const buildImprovementPrompt = (task) => `
/todo에 등록된 요청사항의 내용을 Codex가 바로 이해할 수 있는 좋은 작업 지시문으로 개선해 주세요.

작업 ID: ${task.id || '없음'}
요청자: ${task.createdBy || '알 수 없음'}
담당자: ${task.assignee || '알 수 없음'}
우선순위: ${task.priority || '보통'}
마감일: ${task.dueDate || '없음'}

요청사항:
${truncate(task.title, 2500)}

설명:
${truncate(task.description || '별도 설명 없음', 1500)}

최근 사용자 댓글:
${formatCommentsForPrompt(task.comments)}

작업 지침:
1. 저장소 파일이나 코드는 절대 수정하지 마세요.
2. 요청자가 쓴 원래 의도를 보존하되, 모호한 표현을 더 구체적인 작업 지시문으로 바꾸세요.
3. 없는 요구사항을 새로 지어내지 마세요. 필요한 정보가 부족하면 개선문에 확인 필요 항목을 포함하세요.
4. 결과는 반드시 JSON 객체 하나만 출력하세요. 마크다운 코드블록, 설명문, 인사말은 출력하지 마세요.
5. JSON 형식:
{
  "improvedTitle": "개선된 요청사항 전체 문장",
  "feedback": "무엇을 어떻게 개선했는지 요청자에게 남길 짧은 피드백",
  "summary": ["핵심 개선점 1", "핵심 개선점 2"]
}
`.trim();

const stripJsonFence = (value) => String(value || '')
  .trim()
  .replace(/^```(?:json)?\s*/i, '')
  .replace(/\s*```$/i, '')
  .trim();

const parseCodexImprovement = (rawMessage) => {
  const text = stripJsonFence(rawMessage);
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  const jsonText = firstBrace >= 0 && lastBrace > firstBrace
    ? text.slice(firstBrace, lastBrace + 1)
    : text;
  const parsed = JSON.parse(jsonText);
  const improvedTitle = truncate(parsed.improvedTitle || parsed.title || '', 2500);
  const feedback = truncate(parsed.feedback || '', 1800);
  const summary = Array.isArray(parsed.summary)
    ? parsed.summary.map((item) => truncate(item, 300)).filter(Boolean).slice(0, 5)
    : [];

  if (!improvedTitle) {
    throw new Error('improvedTitle이 비어 있습니다.');
  }

  return {
    improvedTitle,
    feedback: feedback || 'Codex가 요청사항을 더 명확한 작업 지시문으로 개선했습니다.',
    summary
  };
};

const appendBridgeLog = (message) => {
  ensureLogDir();
  fs.appendFileSync(
    path.join(LOG_DIR, 'bridge.log'),
    `[${new Date().toISOString()}] ${message}\n`,
    'utf8'
  );
};

const createRunId = (taskId) => {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${taskId || 'todo'}-${Date.now()}-${suffix}`;
};

const runCodexImprovement = (task) => new Promise((resolve, reject) => {
  ensureLogDir();

  const taskId = normalizeTaskId(task.id) || 'todo';
  const runId = createRunId(taskId);
  const stdoutPath = path.join(LOG_DIR, `${runId}.stdout.log`);
  const stderrPath = path.join(LOG_DIR, `${runId}.stderr.log`);
  const lastMessagePath = path.join(LOG_DIR, `${runId}.final.txt`);
  const stdoutStream = fs.createWriteStream(stdoutPath, { flags: 'a' });
  const stderrStream = fs.createWriteStream(stderrPath, { flags: 'a' });
  const args = [
    'exec',
    '--cd', WORKSPACE_ROOT,
    '--sandbox', codexSandbox,
    '--output-last-message', lastMessagePath,
    '--color', 'never'
  ];

  if (codexModel) {
    args.push('--model', codexModel);
  }

  args.push('-');

  let stdout = '';
  let stderr = '';
  let timedOut = false;

  appendBridgeLog(`improve start ${taskId}`);

  const child = spawn(codexCommand, args, {
    cwd: WORKSPACE_ROOT,
    windowsHide: true,
    shell: codexSpawnUsesShell,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill();
    setTimeout(() => child.kill('SIGKILL'), 5000).unref();
  }, Number.isFinite(codexTimeoutMs) && codexTimeoutMs > 0 ? codexTimeoutMs : 20 * 60 * 1000);

  child.stdout.on('data', (chunk) => {
    stdoutStream.write(chunk);
    stdout += chunk.toString('utf8');
    if (stdout.length > 200000) stdout = stdout.slice(-200000);
  });

  child.stderr.on('data', (chunk) => {
    stderrStream.write(chunk);
    stderr += chunk.toString('utf8');
    if (stderr.length > 100000) stderr = stderr.slice(-100000);
  });

  child.on('error', (error) => {
    clearTimeout(timeout);
    stdoutStream.end();
    stderrStream.end();
    reject(error);
  });

  child.on('close', (code) => {
    clearTimeout(timeout);
    stdoutStream.end();
    stderrStream.end();

    if (timedOut) {
      reject(new Error('Codex 실행 시간이 초과되었습니다.'));
      return;
    }

    if (code !== 0) {
      reject(new Error(`Codex 실행이 실패했습니다. 종료 코드: ${code}. ${truncate(stderr, 1200)}`));
      return;
    }

    const finalMessage = fs.existsSync(lastMessagePath)
      ? fs.readFileSync(lastMessagePath, 'utf8')
      : stdout;

    try {
      resolve({
        runId,
        improvement: parseCodexImprovement(finalMessage),
        logPath: path.relative(WORKSPACE_ROOT, lastMessagePath).replace(/\\/g, '/')
      });
    } catch (error) {
      reject(error);
    }
  });

  child.stdin.end(buildImprovementPrompt(task));
});

const runTask = (taskId) => {
  activeTaskIds.add(taskId);
  appendBridgeLog(`start ${taskId}`);

  const child = spawn(process.execPath, [RUNNER_PATH, '--task-id', taskId], {
    cwd: WORKSPACE_ROOT,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString('utf8').trim();
    if (text) {
      console.log(text);
      appendBridgeLog(text);
    }
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString('utf8').trim();
    if (text) {
      console.error(text);
      appendBridgeLog(text);
    }
  });

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
      activeTaskIds: Array.from(activeTaskIds)
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
      sendJson(req, res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : 'Codex 브릿지 요청 처리에 실패했습니다.'
      });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/todo-codex/improve') {
    try {
      const body = await readJsonBody(req);
      const task = body.task || {};
      const taskId = normalizeTaskId(task.id);

      if (!taskId || !String(task.title || '').trim()) {
        sendJson(req, res, 400, { ok: false, error: 'task.id와 task.title이 필요합니다.' });
        return;
      }

      if (activeTaskIds.has(taskId)) {
        sendJson(req, res, 409, { ok: false, error: '이미 Codex 개선이 실행 중인 작업입니다.' });
        return;
      }

      activeTaskIds.add(taskId);
      try {
        const result = await runCodexImprovement(task);
        sendJson(req, res, 200, { ok: true, taskId, ...result });
      } finally {
        activeTaskIds.delete(taskId);
      }
    } catch (error) {
      sendJson(req, res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : 'Codex 개선 요청 처리에 실패했습니다.'
      });
    }
    return;
  }

  sendJson(req, res, 404, { ok: false, error: 'Not found' });
});

server.listen(options.port, '127.0.0.1', () => {
  console.log(`[todo-codex-bridge] http://localhost:${options.port}`);
  console.log('[todo-codex-bridge] POST /todo-codex/improve 으로 클릭 개선 요청을 받습니다.');
});
