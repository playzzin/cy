const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');
const { root, admin, db, password, accounts } = require('./state.cjs');
function readTs(file) {
  const filename = path.resolve(root, file);
  const original = createRequire(filename);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(request => request.startsWith('.') ? readTs(path.resolve(path.dirname(filename), request) + '.ts') : original(request), module, module.exports);
  return module.exports;
}
module.exports = async function seed() {
  const month = new Date().toISOString().slice(0, 7);
  const previous = new Date(); previous.setDate(1); previous.setMonth(previous.getMonth() - 1);
  const previousMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
  for (const [role, uid] of Object.entries(accounts)) {
    await admin.auth().createUser({ uid, email: `${role}@qa.example.test`, password, displayName: `합성검수 ${role}`, emailVerified: true });
    await admin.auth().setCustomUserClaims(uid, role === 'office' ? { role: 'admin', roles: ['admin'], position: '관리자', erpRoleGroups: ['admin'] } : { role: 'user', position: role === 'leader' ? '팀장' : '일반', accountType: 'worker' });
  }
  const batch = db.batch();
  const put = (key, value) => batch.set(db.doc(key), { createdAt: admin.firestore.Timestamp.now(), ...value });
  const menu = readTs('src/constants/defaultMenu.ts').DEFAULT_MENU_CONFIG;
  put('settings/menus_v12', menu);
  put('settings/user_menu_positions', { data: '{}' });
  put('users/qa-office', { uid: 'qa-office', email: 'office@qa.example.test', name: '합성 사무실', role: 'admin', roles: ['admin'], position: '관리자', accountType: 'office', status: 'active', linkedOfficeStaffIds: ['qa-office'] });
  put('office_staff/qa-office', { uid: 'qa-office', name: '합성 사무실', role: '관리자', isActive: true });
  put('users/qa-leader', { uid: 'qa-leader', email: 'leader@qa.example.test', name: '합성 팀장', role: 'user', position: '팀장', accountType: 'worker', status: 'active', linkedWorkerIds: ['qa-leader-worker'], primaryLinkId: 'qa-leader-link' });
  for (const [uid, teamId] of [['qa-member', 'qa-team'], ['qa-outside', 'qa-other-team']]) {
    put(`users/${uid}`, { uid, email: `${uid.slice(3)}@qa.example.test`, name: uid === 'qa-member' ? '합성 팀원' : '타팀 합성', role: 'user', status: 'pending', requestedAccountType: 'worker', primaryLinkId: `${uid}-link` });
    put(`workers/${uid}-worker`, { name: uid === 'qa-member' ? '합성 팀원' : '타팀 합성', role: '일반', teamId, teamName: teamId === 'qa-team' ? '합성 검수팀' : '타팀', companyId: 'qa-company', companyName: '청연이엔지', status: '재직', isActive: true, unitPrice: 150000, bankName: '합성은행', accountNumber: 'QA-ONLY-0000', accountHolder: '합성 팀원' });
    put(`account_links/${uid}-link`, { uid, entityId: `${uid}-worker`, entityType: 'worker', accountType: 'worker', status: 'pending' });
  }
  put('workers/qa-leader-worker', { uid: 'qa-leader', name: '합성 팀장', role: '팀장', teamId: 'qa-team', teamName: '합성 검수팀', companyId: 'qa-company', companyName: '청연이엔지', status: '재직', isActive: true, unitPrice: 200000 });
  put('workers/qa-retired-worker', { name: '합성 퇴사자', role: '일반', teamId: 'qa-team', teamName: '합성 검수팀', companyId: 'qa-company', status: '퇴사', isActive: false, unitPrice: 150000 });
  put('account_links/qa-leader-link', { uid: 'qa-leader', entityId: 'qa-leader-worker', entityType: 'worker', accountType: 'worker', status: 'active' });
  put('teams/qa-team', { name: '합성 검수팀', companyId: 'qa-company', companyName: '청연이엔지', leaderId: 'qa-leader-worker', leaderWorkerId: 'qa-leader-worker', leaderName: '합성 팀장', type: '시공팀', isActive: true, status: 'active', color: '#2563eb' });
  put('teams/qa-other-team', { name: '타팀', type: '시공팀', companyId: 'qa-company', isActive: true, status: 'active' });
  put('companies/qa-company', { name: '청연이엔지', code: 'QA-COMPANY', type: '시공사', status: 'active', isActive: true });
  for (const [id, name] of [['qa-site-a', '모바일 검수용 긴 이름의 첫 번째 합성 현장'], ['qa-site-b', '두 번째 합성 현장']]) {
    put(`sites/${id}`, { name, status: 'active', responsibleTeamId: 'qa-team', responsibleTeamName: '합성 검수팀', companyId: 'qa-company', companyName: '청연이엔지', partnerId: 'qa-company', address: '합성 검수 주소' });
    for (const ym of [month, previousMonth]) put(`daily_reports/${id}-${ym}`, { date: `${ym}-01`, siteId: id, siteName: name, teamId: 'qa-team', teamName: '합성 검수팀', companyId: 'qa-company', totalManDay: 2, workers: [
      { workerId: 'qa-member-worker', workerName: '합성 팀원', name: '합성 팀원', teamId: 'qa-team', teamName: '합성 검수팀', manDay: 1, unitPrice: 150000, amount: 150000 },
      { workerId: 'qa-leader-worker', workerName: '합성 팀장', name: '합성 팀장', teamId: 'qa-team', teamName: '합성 검수팀', manDay: 1, unitPrice: 200000, amount: 200000 },
    ] });
  }
  await batch.commit();
  return { month, previousMonth };
};
