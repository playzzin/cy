// User-authorized conversion settings only; never print or rewrite credentials.
const admin = require('firebase-admin');
const fs = require('node:fs'); const path = require('node:path');
async function main() {
  const results = ['위임장', '노임명세서'].map(label => JSON.parse(fs.readFileSync(path.join(__dirname, '../outputs/excel-converter/business/verified', `${label}_실제Gemini응답.json`), 'utf8')));
  if (results.some(r => r.model !== 'gemini-3.8-flash' || r.plan.questions.length)) throw new Error('두 예시의 Gemini 3.8 Flash 검증 응답이 필요합니다.');
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(process.env.APPDATA, 'gcloud/application_default_credentials.json');
  const credential = admin.credential.applicationDefault(); const token = await credential.getAccessToken();
  const project = JSON.parse(fs.readFileSync(path.join(__dirname, '../.firebaserc'), 'utf8')).projects.default;
  const endpoint = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/server_settings/ai`;
  const headers = {Authorization: `Bearer ${token.access_token}`, 'Content-Type':'application/json'};
  const before = await fetch(endpoint, {headers}); if (!before.ok) throw new Error(`설정 읽기 실패 ${before.status}`);
  const original = await before.json();
  const fields = {excelConversionModel:{stringValue:'gemini-3.8-flash'},excelConversionThinking:{stringValue:'medium'},excelConversionVerifiedAt:{timestampValue:new Date().toISOString()}};
  const query = new URLSearchParams();Object.keys(fields).forEach(key=>query.append('updateMask.fieldPaths',key));query.set('currentDocument.updateTime',original.updateTime);
  const response = await fetch(`${endpoint}?${query}`,{method:'PATCH',headers,body:JSON.stringify({fields})});
  if(!response.ok) throw new Error(`설정 변경 실패 ${response.status}`);
  const after = await fetch(endpoint,{headers});if(!after.ok)throw new Error(`저장 확인 실패 ${after.status}`);
  const saved = (await after.json()).fields;
  for(const [key,value] of Object.entries(original.fields)) if(!(key in fields) && JSON.stringify(saved[key])!==JSON.stringify(value))throw new Error('관련 없는 설정이 변경됐습니다.');
  if(saved.excelConversionModel?.stringValue!=='gemini-3.8-flash'||saved.excelConversionThinking?.stringValue!=='medium')throw new Error('설정 확인 실패');
  const report={project,model:saved.excelConversionModel.stringValue,thinkingLevel:saved.excelConversionThinking.stringValue,verifiedAt:saved.excelConversionVerifiedAt.timestampValue,otherSettingsPreserved:true};
  fs.writeFileSync(path.join(__dirname,'../outputs/excel-converter/business/AI설정_적용결과.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
