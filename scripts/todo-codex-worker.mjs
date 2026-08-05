import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const TASK_COLLECTION = 'tasks';
const AUTOMATION_ACTOR = 'Codex 자동화';
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_AUTO_INTERVAL_MS = 60 * 1000;

const HELP_TEXT = `
Todo Codex task runner

Usage:
  npm run todo:codex-run -- --task-id <taskId>
  npm run todo:codex-dry-run
  npm run todo:codex-auto

Options:
  --dry-run            Print matching request tasks without updating Firestore or running Codex.
  --task-id <taskId>   Process one task id.
  --watch              Monitor opted-in request tasks. Requires TODO_CODEX_AUTO_ENABLED=true.
  --interval <ms>      Watch fallback interval. Default ${DEFAULT_AUTO_INTERVAL_MS}.
  --help               Show this help.

Environment:
  FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS  Path to service account JSON.
  REACT_APP_FIREBASE_PROJECT_ID or FIREBASE_PROJECT_ID         Firebase project id.
  TODO_CODEX_MODEL                                             Optional Codex model override.
  TODO_CODEX_TIMEOUT_MS                                        Default ${DEFAULT_TIMEOUT_MS}.
  TODO_CODEX_ASSIGNEE                                          Optional assignee filter.
  TODO_CODEX_SANDBOX                                           workspace-write (default) or read-only.
  TODO_CODEX_AUTO_ENABLED=true                                 Required for --watch.
`;

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
};

loadEnvFile(path.join(WORKSPACE_ROOT, '.env.local'));
loadEnvFile(path.join(WORKSPACE_ROOT, '.env'));

const asPositiveNumber = (value, fallback, minimum = 1) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
};

const parseArgs = (argv) => {
  const options = {
    dryRun: false,
    help: false,
    intervalMs: asPositiveNumber(process.env.TODO_CODEX_AUTO_INTERVAL_MS, DEFAULT_AUTO_INTERVAL_MS, 15 * 1000),
    taskId: '',
    watch: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--watch') options.watch = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--task-id') {
      options.taskId = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--interval') {
      options.intervalMs = asPositiveNumber(argv[index + 1], options.intervalMs, 15 * 1000);
      index += 1;
    }
  }

  return options;
};

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  console.log(HELP_TEXT.trim());
  process.exit(0);
}

const codexTimeoutMs = asPositiveNumber(process.env.TODO_CODEX_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
const codexModel = (process.env.TODO_CODEX_MODEL || '').trim();
const requestedSandbox = (process.env.TODO_CODEX_SANDBOX || 'workspace-write').trim();
const codexSandbox = ['workspace-write', 'read-only'].includes(requestedSandbox)
  ? requestedSandbox
  : 'workspace-write';
const assigneeFilter = (process.env.TODO_CODEX_ASSIGNEE || '').trim();
const autoEnabled = /^(1|true|yes)$/i.test(String(process.env.TODO_CODEX_AUTO_ENABLED || ''));

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
const logDir = path.resolve(WORKSPACE_ROOT, process.env.TODO_CODEX_LOG_DIR || '.codex-todo-worker');
const lockPath = path.join(logDir, 'workspace.lock');
const TRACKED_SOURCE_DIRECTORIES = [
  'src',
  'functions/src',
  'scripts',
  'public'
];
const TRACKED_ROOT_FILES = new Set([
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tailwind.config.js',
  'firebase.json',
  'firestore.rules',
  'firestore.indexes.json',
  'storage.rules',
  'netlify.toml'
]);
const TRACKED_FILE_EXTENSIONS = new Set([
  '.css', '.cjs', '.html', '.js', '.json', '.jsx', '.mjs', '.svg', '.ts', '.tsx'
]);

const truncate = (value, maxLength = 3500) => {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 32)}\n…생략 (${text.length}자)`;
};

const nowTime = () => new Date().toLocaleTimeString('ko-KR', {
  hour: '2-digit',
  minute: '2-digit'
});

const createSystemComment = (text) => ({
  id: Date.now() + Math.floor(Math.random() * 1000),
  user: AUTOMATION_ACTOR,
  text: truncate(text, 3000),
  time: nowTime(),
  isSystem: true
});

const createRunId = (taskId) => {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${taskId}-${Date.now()}-${suffix}`;
};

const resolveServiceAccountPath = () => {
  const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (explicitPath) return path.resolve(WORKSPACE_ROOT, explicitPath);

  const defaultPath = path.join(WORKSPACE_ROOT, 'service-account.json');
  return fs.existsSync(defaultPath) ? defaultPath : '';
};

const initializeFirebase = () => {
  if (getApps().length > 0) return;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.REACT_APP_FIREBASE_PROJECT_ID;
  const serviceAccountPath = resolveServiceAccountPath();
  const appOptions = {};

  if (projectId) appOptions.projectId = projectId;
  if (serviceAccountPath) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    appOptions.credential = cert(serviceAccount);
    if (!appOptions.projectId && serviceAccount.project_id) appOptions.projectId = serviceAccount.project_id;
  } else {
    appOptions.credential = applicationDefault();
  }

  initializeApp(appOptions);
};

initializeFirebase();
const db = getFirestore();
const getTaskRef = (taskId) => db.collection(TASK_COLLECTION).doc(taskId);

const formatCommentsForPrompt = (comments = []) => {
  const userComments = comments
    .filter((comment) => comment && !comment.isSystem && String(comment.text || '').trim())
    .slice(-8);

  if (userComments.length === 0) return '없음';

  return userComments
    .map((comment) => `- ${comment.user || '이름 없음'} (${comment.time || '시간 없음'}): ${truncate(comment.text, 800)}`)
    .join('\n');
};

const buildCodexPrompt = (task) => `
You are implementing a Todo request in an existing codebase. Inspect the relevant source first, then make the smallest safe code changes needed to address the request.

Task ID: ${task.id}
Requester: ${task.createdBy || 'Unknown'}
Assignee: ${task.assignee || 'Unknown'}
Priority: ${task.priority || 'Normal'}
Due date: ${task.dueDate || 'None'}

Request:
${truncate(task.title, 2500)}

Description:
${truncate(task.description || 'No additional description.', 1500)}

Recent requester comments:
${formatCommentsForPrompt(task.comments)}

Safety rules:
1. Work only on this repository and only on source/config/test files necessary for this request.
2. Do not commit, push, deploy, send external messages, modify credentials or .env files, change access controls, make payments, delete data, run migrations, or change live Firebase data.
3. If the request is ambiguous, requires any forbidden action, or cannot be safely verified, do not make speculative changes. Return needs_review or blocked instead.
4. Run the smallest relevant validation after your change. Do not claim validation that you did not run.
5. Do not modify the Todo task record yourself; the runner records the result.

Return exactly one JSON object, no Markdown fence or prose:
{
  "status": "completed" | "needs_review" | "blocked",
  "feedback": "Korean explanation for the requester of what was changed or why review is needed.",
  "summary": ["short change summary"],
  "verification": ["actual command or check and its result"],
  "reviewReason": "required when status is needs_review or blocked"
}
`.trim();

const ensureLogDir = () => fs.mkdirSync(logDir, { recursive: true });

const isWithinWorkspace = (filePath) => {
  const relative = path.relative(WORKSPACE_ROOT, filePath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
};

const hashFile = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const shouldTrackWorkspaceFile = (filePath) => {
  const relativePath = path.relative(WORKSPACE_ROOT, filePath).replace(/\\/g, '/');
  if (TRACKED_ROOT_FILES.has(relativePath)) return true;
  return TRACKED_SOURCE_DIRECTORIES.some((directory) => (
    relativePath.startsWith(`${directory}/`) && TRACKED_FILE_EXTENSIONS.has(path.extname(relativePath).toLowerCase())
  ));
};

const getWorkspaceFiles = () => {
  const files = new Set();
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === '.codex-todo-worker' || entry.name === 'node_modules') continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile() && shouldTrackWorkspaceFile(absolutePath)) files.add(absolutePath);
    }
  };

  for (const relativePath of TRACKED_ROOT_FILES) {
    const absolutePath = path.join(WORKSPACE_ROOT, relativePath);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) files.add(absolutePath);
  }
  for (const relativePath of TRACKED_SOURCE_DIRECTORIES) {
    const absolutePath = path.join(WORKSPACE_ROOT, relativePath);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) visit(absolutePath);
  }
  return files;
};

const captureWorkspaceSnapshot = () => {
  const snapshot = new Map();
  for (const absolutePath of getWorkspaceFiles()) {
    if (!isWithinWorkspace(absolutePath)) continue;
    const relativePath = path.relative(WORKSPACE_ROOT, absolutePath).replace(/\\/g, '/');
    snapshot.set(relativePath, hashFile(absolutePath));
  }
  return snapshot;
};

const findChangedWorkspaceFiles = (before, after) => Array.from(new Set([...before.keys(), ...after.keys()]))
  .filter((filePath) => before.get(filePath) !== after.get(filePath))
  .sort();

const withChangedFiles = (workspaceBefore, payload) => ({
  ...payload,
  changedFiles: findChangedWorkspaceFiles(workspaceBefore, captureWorkspaceSnapshot())
});

const isProcessRunning = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
};

const removeStaleWorkspaceLock = () => {
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (lock.host && lock.host !== os.hostname()) return false;
    if (isProcessRunning(Number(lock.pid))) return false;
    fs.unlinkSync(lockPath);
    console.warn(`[todo-codex-worker] Removed stale workspace lock from pid ${lock.pid || 'unknown'}.`);
    return true;
  } catch (error) {
    return false;
  }
};

const tryAcquireWorkspaceLock = () => {
  ensureLogDir();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      fs.writeFileSync(lockPath, JSON.stringify({
        pid: process.pid,
        host: os.hostname(),
        startedAt: new Date().toISOString()
      }), { flag: 'wx' });
      return true;
    } catch (error) {
      if (error && error.code === 'EEXIST' && attempt === 0 && removeStaleWorkspaceLock()) continue;
      if (error && error.code === 'EEXIST') return false;
      throw error;
    }
  }
  return false;
};

const releaseWorkspaceLock = () => {
  try {
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  } catch (error) {
    console.warn(`[todo-codex-worker] Could not remove workspace lock: ${error.message}`);
  }
};

const summarizeRunnerFailure = (value) => {
  const lines = String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const relevantLines = lines.filter((line) => /\berror\b|failed|requires a newer version|invalid_request|auth|required|timeout/i.test(line));
  return truncate((relevantLines.length > 0 ? relevantLines : lines).slice(-12).join('\n'), 1600);
};

const runCodex = (task) => new Promise((resolve) => {
  ensureLogDir();
  const workspaceBefore = captureWorkspaceSnapshot();
  const runId = task.automation?.runId || createRunId(task.id);
  const prompt = buildCodexPrompt(task);
  const stdoutPath = path.join(logDir, `${runId}.stdout.log`);
  const stderrPath = path.join(logDir, `${runId}.stderr.log`);
  const lastMessagePath = path.join(logDir, `${runId}.final.txt`);
  const stdoutStream = fs.createWriteStream(stdoutPath, { flags: 'a' });
  const stderrStream = fs.createWriteStream(stderrPath, { flags: 'a' });
  const args = ['exec', '--cd', WORKSPACE_ROOT, '--sandbox', codexSandbox, '--output-last-message', lastMessagePath, '--color', 'never'];

  if (codexModel) args.push('--model', codexModel);
  args.push('-');

  let stdout = '';
  let stderr = '';
  let timedOut = false;
  let settled = false;

  const settle = (payload) => {
    if (settled) return;
    settled = true;
    resolve(withChangedFiles(workspaceBefore, payload));
  };

  console.log(`[todo-codex-worker] Starting Codex: ${task.id}`);
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
  }, codexTimeoutMs);

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
    settle({ runId, exitCode: -1, timedOut, stdoutPath, stderrPath, lastMessagePath, finalMessage: '', error: error.message });
  });
  child.on('close', (code) => {
    clearTimeout(timeout);
    stdoutStream.end();
    stderrStream.end();
    const finalMessage = fs.existsSync(lastMessagePath) ? fs.readFileSync(lastMessagePath, 'utf8') : stdout;
    const exitCode = typeof code === 'number' ? code : -1;
    const failureDetail = summarizeRunnerFailure(stderr || finalMessage || stdout);
    settle({
      runId,
      exitCode,
      timedOut,
      stdoutPath,
      stderrPath,
      lastMessagePath,
      finalMessage: truncate(finalMessage || stdout || stderr, 5000),
      error: timedOut
        ? `Codex execution exceeded ${codexTimeoutMs}ms.`
        : exitCode === 0
          ? ''
          : failureDetail || `Codex execution failed. Exit code: ${exitCode}`
    });
  });
  child.stdin.end(prompt);
});

const toRelativePath = (filePath) => filePath
  ? path.relative(WORKSPACE_ROOT, filePath).replace(/\\/g, '/')
  : '';
const stripJsonFence = (value) => String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
const asStringList = (value, maxItems = 12) => Array.isArray(value)
  ? value.map((item) => truncate(item, 500)).filter(Boolean).slice(0, maxItems)
  : [];

const parseCodexImplementation = (rawMessage) => {
  const text = stripJsonFence(rawMessage);
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  const jsonText = firstBrace >= 0 && lastBrace > firstBrace ? text.slice(firstBrace, lastBrace + 1) : text;

  try {
    const parsed = JSON.parse(jsonText);
    const status = String(parsed.status || '').trim().toLowerCase();
    if (!['completed', 'needs_review', 'blocked'].includes(status)) {
      throw new Error('status must be completed, needs_review, or blocked.');
    }

    const feedback = truncate(parsed.feedback || '', 1800);
    if (!feedback) throw new Error('feedback is required.');

    return {
      status,
      feedback,
      summary: asStringList(parsed.summary, 8),
      verification: asStringList(parsed.verification, 8),
      reviewReason: truncate(parsed.reviewReason || '', 1200)
    };
  } catch (error) {
    throw new Error(`Codex result JSON could not be parsed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const isRequestedStatus = (status) => status === '요청' || status === '재요청';
const shouldAutoRunTask = (task) => autoEnabled && task?.automation?.autoRun === true;

const claimTask = async (taskRef, { autoTriggered = false } = {}) => db.runTransaction(async (transaction) => {
  const snapshot = await transaction.get(taskRef);
  if (!snapshot.exists) return null;

  const task = { id: snapshot.id, ...snapshot.data() };
  if (!isRequestedStatus(task.status)) return null;
  if (assigneeFilter && task.assignee !== assigneeFilter) return null;
  if (autoTriggered && !shouldAutoRunTask(task)) return null;

  const runId = createRunId(task.id);
  const startedAt = new Date().toISOString();
  const comments = Array.isArray(task.comments) ? task.comments : [];
  const mode = autoTriggered ? 'auto' : 'manual';
  const startComment = createSystemComment(
    `Codex ${mode === 'auto' ? '자동 처리' : '실행'}가 코드 수정 및 검증을 시작해 상태를 [진행]으로 변경했습니다. 실행 ID: ${runId}`
  );
  const automation = {
    ...(task.automation || {}),
    status: 'in_progress',
    source: 'codex_cli',
    mode,
    startedAt,
    originalTitle: task.title || '',
    runId,
    workerHost: os.hostname(),
    error: ''
  };

  transaction.update(taskRef, { status: '진행', comments: [...comments, startComment], automation });
  return { ...task, status: '진행', comments: [...comments, startComment], automation };
});

const formatList = (heading, items) => items.length > 0 ? `\n\n${heading}:\n${items.map((item) => `- ${item}`).join('\n')}` : '';

const completeTask = async (taskId, result) => {
  const taskRef = getTaskRef(taskId);
  const snapshot = await taskRef.get();
  if (!snapshot.exists) return;

  const task = { id: snapshot.id, ...snapshot.data() };
  const implementation = parseCodexImplementation(result.finalMessage);
  const changedFiles = Array.isArray(result.changedFiles) ? result.changedFiles : [];
  const completionAllowed = implementation.status === 'completed' && changedFiles.length > 0 && implementation.verification.length > 0;
  const status = completionAllowed ? '완료' : '검토';
  const reviewReason = implementation.reviewReason || (
    implementation.status !== 'completed'
      ? 'Codex가 안전상 자동 완료할 수 없다고 판단했습니다.'
      : changedFiles.length === 0
        ? '실제 변경된 파일을 확인하지 못했습니다.'
        : '실행한 검증 결과를 확인하지 못했습니다.'
  );
  const feedback = [
    completionAllowed ? 'Codex가 요청을 구현하고 완료로 변경했습니다.' : 'Codex 처리 결과를 검토로 전환했습니다.',
    implementation.feedback,
    formatList('수정 파일', changedFiles),
    formatList('검증', implementation.verification),
    completionAllowed ? '' : `\n\n검토 필요: ${reviewReason}`
  ].filter(Boolean).join('\n');
  const comments = Array.isArray(task.comments) ? task.comments : [];
  const completedAt = new Date().toISOString();

  await taskRef.update({
    status,
    comments: [...comments, createSystemComment(feedback)],
    automation: {
      ...(task.automation || {}),
      status: 'completed',
      source: 'codex_cli',
      completedAt,
      feedback: truncate(feedback, 3500),
      changedFiles,
      verification: implementation.verification,
      reviewRequired: !completionAllowed,
      reviewReason: completionAllowed ? '' : reviewReason,
      exitCode: result.exitCode,
      logPath: toRelativePath(result.lastMessagePath)
    }
  });
};

const failTask = async (taskId, result) => {
  const taskRef = getTaskRef(taskId);
  const snapshot = await taskRef.get();
  if (!snapshot.exists) return;

  const task = { id: snapshot.id, ...snapshot.data() };
  const comments = Array.isArray(task.comments) ? task.comments : [];
  const completedAt = new Date().toISOString();
  const errorText = result.error || `Codex execution failed. Exit code: ${result.exitCode}`;
  const wasAutoRun = task.automation?.mode === 'auto' && task.automation?.autoRun === true;
  const status = wasAutoRun ? '검토' : '재요청';
  const feedback = wasAutoRun
    ? `Codex 자동 처리에 실패했습니다. 같은 요청이 반복 실행되지 않도록 자동 처리를 중지하고 상태를 [검토]로 변경했습니다. 오류를 해결한 뒤 Codex 버튼으로 다시 실행할 수 있습니다.\n\n${truncate(errorText, 1600)}`
    : `Codex 처리에 실패해 상태를 [재요청]으로 변경했습니다.\n\n${truncate(errorText, 1600)}`;

  await taskRef.update({
    status,
    comments: [...comments, createSystemComment(feedback)],
    automation: {
      ...(task.automation || {}),
      status: 'failed',
      autoRun: wasAutoRun ? false : task.automation?.autoRun,
      completedAt,
      error: truncate(errorText, 1800),
      exitCode: result.exitCode,
      logPath: toRelativePath(result.stderrPath)
    }
  });
};

const processTaskRef = async (taskRef, processOptions = {}) => {
  if (!tryAcquireWorkspaceLock()) {
    console.log('[todo-codex-worker] Another Codex task is using this workspace. It will be retried later.');
    return false;
  }

  try {
    const claimedTask = await claimTask(taskRef, processOptions);
    if (!claimedTask) return false;

    let result;
    try {
      result = await runCodex(claimedTask);
    } catch (error) {
      result = {
        exitCode: -1,
        timedOut: false,
        stdoutPath: '',
        stderrPath: '',
        lastMessagePath: '',
        finalMessage: '',
        changedFiles: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
    if (result.exitCode === 0 && !result.timedOut) {
      try {
        await completeTask(claimedTask.id, result);
        console.log(`[todo-codex-worker] Processed: ${claimedTask.id}`);
      } catch (error) {
        await failTask(claimedTask.id, { ...result, error: error instanceof Error ? error.message : String(error) });
        console.warn(`[todo-codex-worker] Failed: ${claimedTask.id}`);
      }
    } else {
      await failTask(claimedTask.id, result);
      console.warn(`[todo-codex-worker] Failed: ${claimedTask.id}`);
    }
    return true;
  } finally {
    releaseWorkspaceLock();
  }
};

let isScanning = false;

const scanOnce = async ({ autoTriggered = false } = {}) => {
  if (options.taskId) {
    if (options.dryRun) {
      const snapshot = await getTaskRef(options.taskId).get();
      console.log(snapshot.exists ? `[dry-run] Found task: ${options.taskId}` : `[dry-run] Task not found: ${options.taskId}`);
      return 0;
    }
    return (await processTaskRef(getTaskRef(options.taskId), { autoTriggered })) ? 1 : 0;
  }

  const snapshot = await db.collection(TASK_COLLECTION).where('status', 'in', ['요청', '재요청']).limit(10).get();
  const docs = snapshot.docs.filter((doc) => {
    const task = doc.data();
    return (!assigneeFilter || task.assignee === assigneeFilter) && (!autoTriggered || shouldAutoRunTask(task));
  });

  if (options.dryRun) {
    if (docs.length === 0) console.log('[dry-run] No matching request tasks.');
    for (const doc of docs) console.log(`[dry-run] ${doc.id}: ${doc.data().title || '(untitled)'}`);
    return docs.length;
  }

  let processed = 0;
  for (const doc of docs) {
    if (await processTaskRef(doc.ref, { autoTriggered })) processed += 1;
  }
  if (processed === 0) console.log('[todo-codex-worker] No matching request tasks.');
  return processed;
};

const scanSafely = async (scanOptions = {}) => {
  if (isScanning) return 0;
  isScanning = true;
  try {
    return await scanOnce(scanOptions);
  } finally {
    isScanning = false;
  }
};

const watchForTasks = async () => {
  if (!autoEnabled) throw new Error('TODO_CODEX_AUTO_ENABLED=true is required for --watch.');

  console.log(`[todo-codex-worker] Watching opted-in Todo requests every ${options.intervalMs}ms.`);
  const query = db.collection(TASK_COLLECTION).where('status', 'in', ['요청', '재요청']).limit(10);
  const runScan = () => void scanSafely({ autoTriggered: true }).catch((error) => console.error('[todo-codex-worker] Watch scan failed:', error));
  const unsubscribe = query.onSnapshot(runScan, (error) => console.error('[todo-codex-worker] Watch listener failed:', error));
  const interval = setInterval(runScan, options.intervalMs);
  runScan();

  await new Promise((resolve) => {
    const stop = () => resolve();
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
  clearInterval(interval);
  unsubscribe();
};

const main = async () => {
  console.log(`[todo-codex-worker] workspace=${WORKSPACE_ROOT}`);
  console.log(`[todo-codex-worker] command=${codexCommand}, sandbox=${codexSandbox}`);
  if (requestedSandbox !== codexSandbox) console.warn('[todo-codex-worker] Unsupported sandbox was ignored.');
  if (codexModel) console.log(`[todo-codex-worker] model=${codexModel}`);
  if (assigneeFilter) console.log(`[todo-codex-worker] assignee filter=${assigneeFilter}`);

  if (options.watch) {
    await watchForTasks();
    return;
  }
  if (!options.taskId && !options.dryRun) {
    throw new Error('Use --task-id for manual execution, --dry-run, or --watch.');
  }
  await scanSafely();
};

main().catch((error) => {
  console.error('[todo-codex-worker] fatal:', error);
  process.exitCode = 1;
});
