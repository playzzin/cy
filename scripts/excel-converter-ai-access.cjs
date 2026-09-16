// Read only: report configuration availability, never credentials or worker data.
const admin = require('firebase-admin');
const fs = require('node:fs');
const path = require('node:path');
async function getAiSettings() {
  const adc = path.join(process.env.APPDATA || '', 'gcloud', 'application_default_credentials.json');
  if (!fs.existsSync(adc)) throw new Error('기존 Google 인증 설정을 찾지 못했습니다.');
  process.env.GOOGLE_APPLICATION_CREDENTIALS = adc;
  const credential = admin.credential.applicationDefault();
  const token = await credential.getAccessToken();
  const project = JSON.parse(fs.readFileSync(path.join(__dirname, '../.firebaserc'), 'utf8')).projects.default;
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/server_settings/ai`, { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`서버 AI 설정 조회 실패 (${response.status})`);
  const fields = (await response.json()).fields || {};
  return { apiKey: fields.apiKey?.stringValue || '', model: fields.excelConversionModel?.stringValue || 'gemini-3.8-flash', thinkingLevel: fields.excelConversionThinking?.stringValue || 'medium' };
}
module.exports = { getAiSettings };
if (require.main === module) getAiSettings().then(s => console.log(JSON.stringify({ configured: !!s.apiKey, model: s.model }))).catch(e => { console.log(JSON.stringify({ configured: false, reason: e.code || e.message })); process.exitCode = 1; });
