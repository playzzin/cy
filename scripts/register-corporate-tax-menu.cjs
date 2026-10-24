const assert = require('node:assert/strict');

const PATH = '/payroll/corporate-tax';
const compact = value => String(value || '').replace(/\s/g, '');
function walk(items, visit, trail = []) {
  for (const item of items || []) {
    if (!item || typeof item !== 'object') continue;
    visit(item, trail);
    walk(item.sub, visit, [...trail, item.text]);
  }
}

// Only insert a link into existing tax folders; preserve every existing field.
function registerCorporateTaxMenu(input) {
  const config = structuredClone(input);
  const changes = [];
  for (const [siteKey, site] of Object.entries(config)) {
    if (!Array.isArray(site?.menu)) continue;
    const groups = [];
    const existing = [];
    const ids = new Set();
    walk(site.menu, (item, trail) => {
      ids.add(item.id);
      if (compact(item.text) === '세무관리') groups.push({ item, trail });
      if (item.path === PATH || ['법인세', '법인세관리'].includes(compact(item.text))) existing.push(item);
    });
    if (!groups.length) continue;
    assert.equal(groups.length, 1, `${site.name}: 세무 관리 폴더가 여러 개입니다.`);
    const { item: group, trail } = groups[0];
    assert.ok(Array.isArray(group.sub), `${site.name}: 하위 메뉴 구조를 확인해주세요.`);
    if (existing.length) {
      assert.equal(existing.length, 1, `${site.name}: 법인세 메뉴가 중복되어 있습니다.`);
      assert.ok(group.sub.includes(existing[0]) && existing[0].path === PATH && existing[0].text === '법인세 관리',
        `${site.name}: 기존 법인세 메뉴의 위치 또는 경로가 다릅니다.`);
      continue;
    }
    assert.ok(!ids.has('corporate-tax'), `${site.name}: 메뉴 ID가 이미 사용 중입니다.`);
    const ledgerIndex = group.sub.findIndex(item => item?.path === '/payroll/workbook-ledger');
    const scope = ledgerIndex >= 0 ? group.sub[ledgerIndex] : group;
    const entry = { id: 'corporate-tax', text: '법인세 관리', path: PATH, icon: 'faCalculator' };
    if (scope.roles !== undefined) entry.roles = structuredClone(scope.roles);
    if (scope.hide !== undefined) entry.hide = scope.hide;
    const index = ledgerIndex >= 0 ? ledgerIndex + 1 : group.sub.length;
    group.sub.splice(index, 0, entry);
    changes.push({ siteKey, site: site.name, parent: [...trail, group.text].join(' → '), index, entry });
  }
  return { config, changes };
}
module.exports = { registerCorporateTaxMenu, PATH };

if (require.main === module) {
  const path = require('node:path');
  const fs = require('node:fs');
  const admin = require('firebase-admin');
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(process.env.APPDATA, 'gcloud', 'application_default_credentials.json');
  admin.initializeApp({ projectId: 'cyee-9c1e4' });
  const db = admin.firestore();
  db.settings({ preferRest: true });
  const ref = db.doc('settings/menus_v12');
  const apply = process.argv.includes('--apply');
  const timer = setTimeout(() => { console.error('메뉴 요청 시간 초과. 재실행 전에 서버 저장 여부를 확인하세요.'); process.exit(1); }, 60000);
  (async () => {
    const result = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      assert.ok(snapshot.exists, '통합메뉴 설정이 없습니다.');
      const before = snapshot.data();
      const next = registerCorporateTaxMenu(before);
      if (apply && next.changes.length) {
        const fields = next.changes.flatMap(({ siteKey }) => [new admin.firestore.FieldPath(siteKey, 'menu'), next.config[siteKey].menu]);
        transaction.update(ref, ...fields);
      }
      return { mode: apply ? 'applied' : 'preview', document: ref.path, changes: next.changes };
    });
    if (apply) {
      const saved = (await ref.get()).data();
      assert.equal(registerCorporateTaxMenu(saved).changes.length, 0, '저장 후 메뉴 검증에 실패했습니다.');
      result.verified = true;
      const dir = path.join(__dirname, '../artifacts/corporate-tax-menu-20261019');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'registration.json'), JSON.stringify(result, null, 2));
    }
    console.log(JSON.stringify(result, null, 2));
    await db.terminate();
    clearTimeout(timer);
  })().catch(error => { clearTimeout(timer); console.error(error.message); process.exitCode = 1; });
}
