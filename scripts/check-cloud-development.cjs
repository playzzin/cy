const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { site } = require('../firebase.staging.json').hosting;

const origin = 'http://127.0.0.1:3000';
const root = path.resolve(__dirname, '..');

async function waitForCompiler() {
  const deadline = Date.now() + 6 * 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin + '/__cy_dev/status', {
        redirect: 'error', signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
      });
      if (!response.ok) throw new Error(`개발 서버 컴파일 확인 실패 (HTTP ${response.status})`);
      return await response.json();
    } catch (error) {
      if (!['ECONNREFUSED', 'ECONNRESET'].includes(error.cause?.code)) throw error;
      await delay(1000);
    }
  }
  throw new Error('포트 3000에서 청연 개발 서버가 응답하지 않았습니다.');
}

async function check() {
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const status = await waitForCompiler();
  if (status.revision !== revision || status.projectId !== site || status.compiled !== true) {
    throw new Error('서버의 시작 커밋·Firebase 프로젝트·컴파일 결과를 확인하세요.');
  }
  const options = () => ({ redirect: 'error', signal: AbortSignal.timeout(30_000) });
  const page = await fetch(origin + '/', options());
  const html = await page.text();
  if (!page.ok || !/<title>청연ENG ERP<\/title>/i.test(html) || !/<div\s+id=["']root["']/.test(html)) {
    throw new Error('개발 서버가 청연 ERP 시작 화면을 반환하지 않았습니다.');
  }
  const scripts = Array.from(html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi), match => new URL(match[1], origin));
  const entry = scripts.find(url => url.origin === origin && url.pathname === '/static/js/bundle.js');
  if (!entry) throw new Error('청연 ERP 개발 화면에 JavaScript 진입 파일이 없습니다.');
  const bundle = await fetch(entry, options());
  if (!bundle.ok || !bundle.headers.get('content-type')?.includes('javascript') || !(await bundle.text()).includes('__webpack_require__')) {
    throw new Error('개발 서버가 실행 가능한 webpack 번들을 반환하지 않았습니다.');
  }
  console.log(`CY 개발 서버 준비 완료 · ${revision} · ${site} · 포트 3000 · HTML 및 JavaScript 확인`);
}

check().catch(error => { console.error(error.message); process.exitCode = 1; });
