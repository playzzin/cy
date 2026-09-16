const admin = require('../functions/node_modules/firebase-admin');
const { getAiSettings } = require('./excel-converter-ai-access.cjs');
if (!admin.apps.length) admin.initializeApp({ projectId: 'cyee-9c1e4' });
const { generateExcelConversionPlan, validatePlannerRequest } = require('../functions/lib/excelConversionPlanning');
const { generateExcelStructure } = require('../functions/lib/excelStructurePlanning');
let active = false; let minute = 0; let count = 0;
const localOrigin = `http://127.0.0.1:${Number(process.env.EXCEL_PREVIEW_PORT || 4189)}`;
exports.handleAi = async (req, res, pathname) => {
  if (!pathname.startsWith('/api/excel-converter/')) return false;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, data) => { res.writeHead(status); res.end(JSON.stringify(data)); };
  if (req.headers.host !== new URL(localOrigin).host) { send(403, { error: '로컬 주소로 접속해 주세요.' }); return true; }
  try {
    if (pathname.endsWith('/status') && req.method === 'GET') { const settings = await getAiSettings(); send(200, { configured: !!settings.apiKey, model: settings.model, thinkingLevel: settings.thinkingLevel }); return true; }
    if (req.method !== 'POST' || !['/api/excel-converter/analyze','/api/excel-converter/structure'].includes(pathname) || req.headers.origin !== localOrigin || !String(req.headers['content-type']).startsWith('application/json')) { send(403, { error: '이 로컬 화면에서만 분석할 수 있습니다.' }); return true; }
    const now = Date.now(); if (now - minute > 60000) { minute = now; count = 0; }
    if (active || count >= 12) { send(429, { error: '분석이 진행 중이거나 잠시 사용량이 많습니다. 완료 후 다시 시도해 주세요.' }); return true; }
    active = true; count++;
    try {
      let bytes = 0; const chunks = [];
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 2500000) { send(413, { error: '분석 자료가 너무 큽니다.' }); return true; } chunks.push(chunk); }
      const input = JSON.parse(Buffer.concat(chunks).toString('utf8')); if(pathname.endsWith('/analyze')) validatePlannerRequest(input);
      if(input.plan) input.plan.overrides = [];
      const settings = await getAiSettings(); if (!settings.apiKey) throw new Error('서버 Gemini 설정이 없습니다.');
      const result = pathname.endsWith('/structure') ? await generateExcelStructure(input, settings) : await generateExcelConversionPlan(input, settings); send(200, result);
    } finally { active = false; }
  } catch (e) { send(500, { error: e.message || 'Gemini 연결을 확인해 주세요.' }); }
  return true;
};
