const { randomUUID } = require('node:crypto');
const normalize = value => String(value || '').replace(/\s/g, '');
const PATH = '/support/team-expense-requests';
function find(items, name) {
  for (const item of items || []) {
    if (!item || typeof item !== 'object') continue;
    if (normalize(item.text) === normalize(name)) return item;
    const child = find(item.sub, name);
    if (child) return child;
  }
}
function addChild(parent, text, previousLabel, makeId) {
  if (!Array.isArray(parent.sub)) parent.sub = [];
  if (parent.path && parent.path !== PATH && !parent.sub.some(item => item.path === parent.path)) {
    parent.sub.unshift({ id: makeId(), text: previousLabel, path: parent.path, icon: 'faFileLines' });
  }
  // A folder and its original-page child must not duplicate the same route;
  // the existing office menu normalizer would otherwise restore its defaults.
  delete parent.path;
  const existing = parent.sub.find(item => item.path === PATH || item.text === text);
  if (existing) { existing.text = text; existing.path = PATH; existing.hide = false; }
  else parent.sub.push({ id: makeId(), text, path: PATH, icon: 'faFileCirclePlus', hide: false });
}
function registerTeamExpenseMenu(input, makeId = () => `menu-${randomUUID()}`) {
  const config = structuredClone(input);
  const position = (config.admin?.positionConfig || []).find(item => normalize(item.name) === '팀장');
  const siteKey = position && `pos_${position.id}`;
  if (!siteKey || !config[siteKey]) throw new Error('통합메뉴에 팀장 직책 메뉴가 없습니다.');
  const expense = find(config[siteKey].menu, '경비관리');
  if (!expense) throw new Error('팀장 경비관리 메뉴를 찾을 수 없습니다.');
  addChild(expense, '경비입력', '경비내역', makeId);
  const changedSites = [siteKey];
  const officePosition = (config.admin?.positionConfig || []).find(item => ['사무실', '사무실직원'].includes(normalize(item.name)));
  const officeKey = officePosition && `pos_${officePosition.id}`;
  if (!officeKey || !config[officeKey]) throw new Error('사무실 승인 메뉴를 등록할 직책을 찾을 수 없습니다.');
  const officeApproval = config[officeKey].menu.find(item => item.path === PATH);
  if (officeApproval) { officeApproval.text = '경비 승인'; officeApproval.hide = false; }
  else config[officeKey].menu.push({ id: makeId(), text: '경비 승인', path: PATH, icon: 'faFileCirclePlus', hide: false });
  changedSites.push(officeKey);
  const management = find(config.admin.menu, '운영 관리');
  if (management) { addChild(management, '팀장 경비 승인', '운영 관리', makeId); changedSites.push('admin'); }
  return { config, changedSites, teamSiteKey: siteKey, officeSiteKey: officeKey };
}
module.exports = { registerTeamExpenseMenu };
if (require.main === module) {
  const fs = require('node:fs');
  const path = require('node:path');
  const admin = require('../functions/node_modules/firebase-admin');
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(process.env.APPDATA, 'gcloud', 'application_default_credentials.json');
  admin.initializeApp({ projectId: 'cyee-9c1e4' });
  const db = admin.firestore();
  const ref = db.doc('settings/menus_v12');
  const apply = process.argv.includes('--apply');
  (async () => {
    const result = await db.runTransaction(async transaction => {
      const before = (await transaction.get(ref)).data();
      const next = registerTeamExpenseMenu(before);
      if (apply && JSON.stringify(next.config) !== JSON.stringify(before)) {
        const backupDir = path.join(__dirname, '../.codex-team-expense-request');
        fs.mkdirSync(backupDir, { recursive: true });
        fs.writeFileSync(path.join(backupDir, `menu-before-${Date.now()}.json`), JSON.stringify(before, null, 2));
        const fields = Object.fromEntries(next.changedSites.map(key => [key, next.config[key]]));
        transaction.update(ref, fields);
      }
      return { mode: apply ? 'applied' : 'preview', team: next.config[next.teamSiteKey].name, teamExpenseMenu: find(next.config[next.teamSiteKey].menu, '경비관리'), office: next.config[next.officeSiteKey].name, changedSites: next.changedSites };
    });
    console.log(JSON.stringify(result, null, 2));
    await db.terminate();
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
