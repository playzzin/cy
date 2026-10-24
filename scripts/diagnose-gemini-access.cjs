// Read-only account/log diagnosis. --probe sends one tiny synthetic Gemini request.
// Credentials, provider messages, user identities and business content never leave memory.
const fs = require('node:fs');
const path = require('node:path');
const admin = require('../functions/node_modules/firebase-admin');
let stage = 'authentication';

async function main() {
  const adc = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.env.APPDATA || '', 'gcloud/application_default_credentials.json');
  if (!fs.existsSync(adc)) throw new Error('ADC_UNAVAILABLE');
  process.env.GOOGLE_APPLICATION_CREDENTIALS = adc;
  const { access_token } = await admin.credential.applicationDefault().getAccessToken();
  const project = JSON.parse(fs.readFileSync(path.join(__dirname, '../.firebaserc'), 'utf8')).projects.default;
  if (!/^[a-z0-9-]+$/.test(project)) throw new Error('INVALID_PROJECT');
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const headers = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };
  async function read(url, options = {}) {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000), ...options });
    let body; try { body = await response.json(); } catch { body = {}; }
    return { status: response.status, ok: response.ok, body };
  }
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  stage = 'settings';
  const settings = await read(`${base}/server_settings/ai`);
  if (!settings.ok) throw new Error(`SETTINGS_HTTP_${settings.status}`);
  const fields = settings.body.fields || {};
  const apiKey = fields.apiKey?.stringValue || '';
  const rawModel = fields.model?.stringValue || '';
  const { normalizeGeminiModelName } = require('../functions/lib/geminiModelPolicy');
  const model = normalizeGeminiModelName(rawModel);
  console.log(JSON.stringify({ check: 'settings', project, configured: Boolean(apiKey), storedModel: rawModel,
    effectiveModel: model, documentModel: normalizeGeminiModelName(fields.documentModel?.stringValue),
    updatedAt: fields.updatedAt?.timestampValue || null }));

  stage = 'usage-logs';
  const logs = await read(`${base}:runQuery`, { method: 'POST', body: JSON.stringify({ structuredQuery: {
    from: [{ collectionId: 'gemini_usage_logs' }],
    select: { fields: ['createdAt', 'model', 'feature', 'status', 'errorCode'].map(fieldPath => ({ fieldPath })) },
    where: { fieldFilter: { field: { fieldPath: 'createdAt' }, op: 'GREATER_THAN_OR_EQUAL', value: { timestampValue: since } } },
    orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }], limit: 1000,
  } }) });
  if (logs.ok && Array.isArray(logs.body)) {
    const groups = new Map();
    for (const row of logs.body) {
      const f = row.document?.fields; if (!f) continue;
      const timestamp = f.createdAt?.timestampValue;
      const day = timestamp ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date(timestamp)) : 'unknown';
      const item = { day, feature: f.feature?.stringValue, model: f.model?.stringValue, status: f.status?.stringValue, errorCode: f.errorCode?.stringValue };
      const key = JSON.stringify(item), prior = groups.get(key);
      groups.set(key, { ...item, count: (prior?.count || 0) + 1,
        firstAt: !prior || timestamp < prior.firstAt ? timestamp : prior.firstAt,
        lastAt: !prior || timestamp > prior.lastAt ? timestamp : prior.lastAt });
    }
    console.log(JSON.stringify({ check: 'usage', httpStatus: logs.status, limit: 1000, groups: [...groups.values()] }));
  } else console.log(JSON.stringify({ check: 'usage', httpStatus: logs.status }));

  if (!apiKey) return;
  stage = 'key-project';
  const lookup = await read(`https://apikeys.googleapis.com/v2/keys:lookupKey?keyString=${encodeURIComponent(apiKey)}`);
  const parent = typeof lookup.body.parent === 'string' && /^projects\/\d+\/locations\/global$/.test(lookup.body.parent) ? lookup.body.parent : '';
  const keyProjectNumber = parent.split('/')[1];
  console.log(JSON.stringify({ check: 'keyProject', httpStatus: lookup.status, projectNumber: keyProjectNumber || null }));
  if (keyProjectNumber) {
    const identity = await read(`https://cloudresourcemanager.googleapis.com/v3/projects/${keyProjectNumber}`);
    const billing = await read(`https://cloudbilling.googleapis.com/v1/projects/${keyProjectNumber}/billingInfo`);
    console.log(JSON.stringify({ check: 'projectBilling', project: identity.ok ? identity.body.projectId : null,
      sameAsErp: identity.ok ? identity.body.projectId === project : null,
      httpStatus: billing.status, billingEnabled: billing.ok ? billing.body.billingEnabled === true : null }));
  }
  const modelInfo = await read(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`, { headers: { 'x-goog-api-key': apiKey } });
  console.log(JSON.stringify({ check: 'modelMetadata', model, httpStatus: modelInfo.status,
    supportsGeneration: modelInfo.ok && modelInfo.body.supportedGenerationMethods?.includes('generateContent') === true,
    confirmsGenerationAccess: false }));
  if (process.argv.includes('--probe')) {
    stage = 'synthetic-generation';
    const probe = await read(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply only with OK.' }] }], generationConfig: { maxOutputTokens: 128, candidateCount: 1 } }),
    });
    const message = typeof probe.body.error?.message === 'string' ? probe.body.error.message.slice(0, 4096) : '';
    const providerStatus = ['RESOURCE_EXHAUSTED', 'FAILED_PRECONDITION', 'PERMISSION_DENIED', 'UNAUTHENTICATED', 'INVALID_ARGUMENT', 'NOT_FOUND', 'UNAVAILABLE'].includes(probe.body.error?.status) ? probe.body.error.status : undefined;
    console.log(JSON.stringify({ check: 'syntheticGeneration', model, httpStatus: probe.status, providerStatus,
      explicitPrepayDepleted: /prepay(?:ment|id)? credits? (?:are |is )?(?:depleted|exhausted)/i.test(message),
      explicitSpendCap: /(?:spend(?:ing)? cap|spend(?:ing)? limit).{0,60}(?:exceed|reach)/i.test(message),
      candidateReturned: Array.isArray(probe.body.candidates) && probe.body.candidates.length > 0,
      totalTokens: probe.body.usageMetadata?.totalTokenCount ?? null }));
  }
}
if (require.main === module) main().catch(error => {
  const reason = /^(?:ADC_UNAVAILABLE|INVALID_PROJECT|SETTINGS_HTTP_\d{3})$/.test(error?.message) ? error.message : 'AUTH_OR_NETWORK_FAILURE';
  console.error(JSON.stringify({ check: 'diagnosis-failed', stage, reason }));
  process.exitCode = 1;
});
