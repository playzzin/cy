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

const HELP_TEXT = `
Todo Codex task runner

Usage:
  npm run todo:codex-run -- --task-id <taskId>
  npm run todo:codex-dry-run

Options:
  --dry-run    Print matching request tasks without updating Firestore or running Codex.
  --task-id    Process one task id.
  --help       Show this help.

Environment:
  FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS  Path to service account JSON.
  REACT_APP_FIREBASE_PROJECT_ID or FIREBASE_PROJECT_ID         Firebase project id.
  TODO_CODEX_MODEL                                             Optional Codex model override.
  TODO_CODEX_TIMEOUT_MS                                        Default ${DEFAULT_TIMEOUT_MS}.
  TODO_CODEX_ASSIGNEE                                          Optional assignee filter.
  TODO_CODEX_SANDBOX                                           Default read-only.
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
};

loadEnvFile(path.join(WORKSPACE_ROOT, '.env.local'));
loadEnvFile(path.join(WORKSPACE_ROOT, '.env'));

const parseArgs = (argv) => {
  const options = {
    once: false,
    dryRun: false,
    help: false,
    taskId: ''
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--once') options.once = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--task-id') {
      options.taskId = argv[index + 1] || '';
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

const asPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const codexTimeoutMs = asPositiveNumber(
  process.env.TODO_CODEX_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS
);
const codexModel = (process.env.TODO_CODEX_MODEL || '').trim();
const codexSandbox = (process.env.TODO_CODEX_SANDBOX || 'read-only').trim();
const assigneeFilter = (process.env.TODO_CODEX_ASSIGNEE || '').trim();

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

const truncate = (value, maxLength = 3500) => {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 32)}\n...생략됨(${text.length}자)`;
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

  const projectId = process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.REACT_APP_FIREBASE_PROJECT_ID;
  const serviceAccountPath = resolveServiceAccountPath();
  const appOptions = {};

  if (projectId) appOptions.projectId = projectId;

  if (serviceAccountPath) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    appOptions.credential = cert(serviceAccount);
    if (!appOptions.projectId && serviceAccount.project_id) {
      appOptions.projectId = serviceAccount.project_id;
    }
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

const buildCodexPrompt = (task) => `
/todo에 등록된 요청사항의 내용을 Codex가 바로 이해할 수 있는 좋은 작업 지시문으로 개선해 주세요.

작업 ID: ${task.id}
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

const ensureLogDir = () => {
  fs.mkdirSync(logDir, { recursive: true });
};

const runCodex = (task) => new Promise((resolve) => {
  ensureLogDir();

  const runId = task.automation?.runId || createRunId(task.id);
  const prompt = buildCodexPrompt(task);
  const stdoutPath = path.join(logDir, `${runId}.stdout.log`);
  const stderrPath = path.join(logDir, `${runId}.stderr.log`);
  const lastMessagePath = path.join(logDir, `${runId}.final.txt`);
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

  console.log(`[todo-codex-worker] Codex 실행 시작: ${task.id}`);

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
    resolve({
      runId,
      exitCode: -1,
      timedOut,
      stdoutPath,
      stderrPath,
      lastMessagePath,
      finalMessage: '',
      error: error.message
    });
  });

  child.on('close', (code) => {
    clearTimeout(timeout);
    stdoutStream.end();
    stderrStream.end();

    const finalMessage = fs.existsSync(lastMessagePath)
      ? fs.readFileSync(lastMessagePath, 'utf8')
      : stdout;

    resolve({
      runId,
      exitCode: typeof code === 'number' ? code : -1,
      timedOut,
      stdoutPath,
      stderrPath,
      lastMessagePath,
      finalMessage: truncate(finalMessage || stdout || stderr, 5000),
      error: timedOut ? `Codex 실행 시간이 ${codexTimeoutMs}ms를 초과했습니다.` : ''
    });
  });

  child.stdin.end(prompt);
});

const toRelativePath = (filePath) => path.relative(WORKSPACE_ROOT, filePath).replace(/\\/g, '/');

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

  try {
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
  } catch (error) {
    throw new Error(`Codex 개선 결과 JSON 파싱 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const claimTask = async (taskRef) => db.runTransaction(async (transaction) => {
  const snapshot = await transaction.get(taskRef);
  if (!snapshot.exists) return null;

  const task = { id: snapshot.id, ...snapshot.data() };
  if (task.status !== '요청' && task.status !== '재요청') return null;
  if (assigneeFilter && task.assignee !== assigneeFilter) return null;

  const runId = createRunId(task.id);
  const startedAt = new Date().toISOString();
  const comments = Array.isArray(task.comments) ? task.comments : [];
  const startComment = createSystemComment(
    `Codex 수정 버튼으로 요청 처리를 시작해 상태를 [진행]으로 변경했습니다. 실행 ID: ${runId}`
  );
  const automation = {
    status: 'in_progress',
    source: 'codex_cli',
    startedAt,
    originalTitle: task.title || '',
    runId,
    workerHost: os.hostname()
  };

  transaction.update(taskRef, {
    status: '진행',
    comments: [...comments, startComment],
    automation
  });

  return {
    ...task,
    status: '진행',
    comments: [...comments, startComment],
    automation
  };
});

const completeTask = async (taskId, result) => {
  const taskRef = getTaskRef(taskId);
  const snapshot = await taskRef.get();
  if (!snapshot.exists) return;

  const task = { id: snapshot.id, ...snapshot.data() };
  const improvement = parseCodexImprovement(result.finalMessage);
  const comments = Array.isArray(task.comments) ? task.comments : [];
  const completedAt = new Date().toISOString();
  const summaryText = improvement.summary.length > 0
    ? `\n\n개선 요약:\n${improvement.summary.map((item) => `- ${item}`).join('\n')}`
    : '';
  const feedback = `Codex가 요청 내용을 개선했습니다.\n\n${improvement.feedback}${summaryText}`;
  const completionComment = createSystemComment(feedback);
  const update = {
    title: improvement.improvedTitle,
    status: '완료',
    comments: [...comments, completionComment],
    automation: {
      ...(task.automation || {}),
      status: 'completed',
      completedAt,
      updatedTitle: improvement.improvedTitle,
      feedback: truncate(feedback, 3500),
      exitCode: result.exitCode,
      logPath: toRelativePath(result.lastMessagePath)
    }
  };

  if (task.createdBy && task.assignee !== task.createdBy) {
    update.assignee = task.createdBy;
  }

  await taskRef.update(update);
};

const failTask = async (taskId, result) => {
  const taskRef = getTaskRef(taskId);
  const snapshot = await taskRef.get();
  if (!snapshot.exists) return;

  const task = { id: snapshot.id, ...snapshot.data() };
  const comments = Array.isArray(task.comments) ? task.comments : [];
  const completedAt = new Date().toISOString();
  const errorText = result.error || `Codex 실행이 실패했습니다. 종료 코드: ${result.exitCode}`;
  const failureComment = createSystemComment(
    `Codex 처리가 실패해 상태를 [재요청]으로 변경했습니다.\n\n${truncate(errorText, 1600)}`
  );

  await taskRef.update({
    status: '재요청',
    comments: [...comments, failureComment],
    automation: {
      ...(task.automation || {}),
      status: 'failed',
      completedAt,
      error: truncate(errorText, 1800),
      exitCode: result.exitCode,
      logPath: toRelativePath(result.stderrPath)
    }
  });
};

const processTaskRef = async (taskRef) => {
  const claimedTask = await claimTask(taskRef);
  if (!claimedTask) return false;

  const result = await runCodex(claimedTask);

  if (result.exitCode === 0 && !result.timedOut) {
    try {
      await completeTask(claimedTask.id, result);
      console.log(`[todo-codex-worker] 완료: ${claimedTask.id}`);
    } catch (error) {
      await failTask(claimedTask.id, {
        ...result,
        error: error instanceof Error ? error.message : String(error)
      });
      console.warn(`[todo-codex-worker] 실패: ${claimedTask.id} (${error instanceof Error ? error.message : String(error)})`);
    }
  } else {
    await failTask(claimedTask.id, result);
    console.warn(`[todo-codex-worker] 실패: ${claimedTask.id} (${result.error || result.exitCode})`);
  }

  return true;
};

let isScanning = false;

const scanOnce = async () => {
  if (options.taskId) {
    if (options.dryRun) {
      const snapshot = await getTaskRef(options.taskId).get();
      console.log(snapshot.exists ? `[dry-run] 대상 작업: ${options.taskId}` : `[dry-run] 작업 없음: ${options.taskId}`);
      return 0;
    }
    return (await processTaskRef(getTaskRef(options.taskId))) ? 1 : 0;
  }

  const snapshot = await db.collection(TASK_COLLECTION)
    .where('status', 'in', ['요청', '재요청'])
    .limit(10)
    .get();

  const docs = assigneeFilter
    ? snapshot.docs.filter((doc) => doc.data().assignee === assigneeFilter)
    : snapshot.docs;

  if (options.dryRun) {
    if (docs.length === 0) {
      console.log('[dry-run] 처리할 요청 작업이 없습니다.');
      return 0;
    }

    for (const doc of docs) {
      const task = doc.data();
      console.log(`[dry-run] ${doc.id}: ${task.title || '(제목 없음)'}`);
    }
    return docs.length;
  }

  let processed = 0;
  for (const doc of docs) {
    const didProcess = await processTaskRef(doc.ref);
    if (didProcess) processed += 1;
  }

  if (processed === 0) {
    console.log('[todo-codex-worker] 처리할 요청 작업이 없습니다.');
  }

  return processed;
};

const scanSafely = async () => {
  if (isScanning) {
    console.log('[todo-codex-worker] 이전 스캔이 아직 실행 중입니다.');
    return 0;
  }

  isScanning = true;
  try {
    return await scanOnce();
  } finally {
    isScanning = false;
  }
};

const main = async () => {
  console.log(`[todo-codex-worker] workspace=${WORKSPACE_ROOT}`);
  console.log(`[todo-codex-worker] command=${codexCommand}, sandbox=${codexSandbox}`);
  if (codexModel) console.log(`[todo-codex-worker] model=${codexModel}`);
  if (assigneeFilter) console.log(`[todo-codex-worker] assignee filter=${assigneeFilter}`);

  if (!options.taskId && !options.dryRun) {
    console.error('[todo-codex-worker] --task-id가 필요합니다. 클릭 실행은 todo-codex-bridge를 통해 호출하세요.');
    process.exitCode = 1;
    return;
  }

  await scanSafely();
};

main().catch((error) => {
  console.error('[todo-codex-worker] fatal:', error);
  process.exitCode = 1;
});
