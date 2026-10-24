// Read-only. Credentials stay in memory and are never printed or written to artifacts.
const fs = require('node:fs');
const path = require('node:path');
const admin = require('firebase-admin');
const { normalizeGeminiModelName } = require('../functions/lib/geminiModelPolicy');
async function readWorkspaceAiSettings() {
  const adc = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.env.APPDATA || '', 'gcloud', 'application_default_credentials.json');
  if (!fs.existsSync(adc)) throw new Error('기존 Google 인증 설정이 없습니다.');
  process.env.GOOGLE_APPLICATION_CREDENTIALS = adc;
  const { access_token } = await admin.credential.applicationDefault().getAccessToken();
  const project = JSON.parse(fs.readFileSync(path.join(__dirname, '../.firebaserc'), 'utf8')).projects.default;
  if (!/^[a-z0-9-]+$/.test(project)) throw new Error('프로젝트 설정을 확인해 주세요.');
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/server_settings/ai`, {
    headers: { Authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`AI 설정 조회 실패 (HTTP ${response.status})`);
  const fields = (await response.json()).fields || {};
  return { apiKey: fields.apiKey?.stringValue || '', model: normalizeGeminiModelName(fields.model?.stringValue), project };
}
module.exports = { readWorkspaceAiSettings };
if (require.main === module) readWorkspaceAiSettings().then(value => console.log(JSON.stringify({ configured: Boolean(value.apiKey), model: value.model })))
  .catch(() => { console.error('서버 AI 설정을 읽지 못했습니다. 인증 또는 연결 상태를 확인해 주세요.'); process.exitCode = 1; });
