// Explicit synthetic fixtures only. No application data is written remotely.
const fs = require('node:fs');
const path = require('node:path');
const admin = require('../functions/node_modules/firebase-admin');
const { getAiSettings } = require('./excel-converter-ai-access.cjs');
if (!admin.apps.length) admin.initializeApp({ projectId: 'cyee-9c1e4' });
const { generateExcelConversionPlan } = require('../functions/lib/excelConversionPlanning');
async function main() {
  const settings = await getAiSettings(); if (!settings.apiKey) throw new Error('서버 Gemini 설정이 없습니다.');
  const modelIndex = process.argv.indexOf('--model');
  if (modelIndex >= 0) settings.model = process.argv[modelIndex + 1];
  settings.thinkingLevel = 'medium';
  const directory = path.join(__dirname, '../outputs/excel-converter/business/verified');
  for (const label of ['위임장', '노임명세서']) {
    const request = JSON.parse(fs.readFileSync(path.join(directory, `${label}_AI요청.json`), 'utf8'));
    const result = await generateExcelConversionPlan(request, settings, async (...args) => {
      const response = await fetch(...args);
      if (!response.ok) { const error = await response.clone().json().catch(() => ({})); console.log(JSON.stringify({ status: response.status, message: String(error.error?.message || '').split(settings.apiKey).join('[redacted]').slice(0, 700) })); }
      return response;
    });
    fs.writeFileSync(path.join(directory, `${label}_실제Gemini응답.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ document: label, model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, elapsedMs: result.elapsedMs, questions: result.plan.questions.length, mappings: result.plan.mappings.length, fixedCells: result.plan.fixedCells.length }));
  }
}
main().catch(e => { console.log(JSON.stringify({ error: e.message })); process.exitCode = 1; });
