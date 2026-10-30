const fs = require('node:fs');
const path = require('node:path');
const { serialize } = require('node:v8');
const { isDeepStrictEqual } = require('node:util');

const PROJECT_ID = 'cyee-9c1e4';
const NAME = '매니저';
const MENU_ID = 'manager';
const normalize = value => String(value || '').trim().toLowerCase().replace(/^pos[ _-]*/i, '').replace(/[ _-]/g, '');
const isManager = value => /^(manager|매니저|메니저)[123]?$/.test(normalize(value));
const unique = values => [...new Set(values)];
const PROFILE_FIELDS = ['role', 'position', 'positionId', 'menuPositionId', 'systemRole', 'roles', 'additionalPositions'];
const PROFILE_COLLECTIONS = ['users', 'workers', 'office_staff', 'account_links', 'account_directory_entries'];

function mergeItems(left = [], right = []) {
  const result = structuredClone(left);
  const key = item => typeof item === 'string' ? `text:${item}`
    : item.path ? `path:${item.path}` : item.action ? `action:${item.action}` : `text:${item.text}`;
  for (const incoming of right) {
    const index = result.findIndex(item => key(item) === key(incoming));
    if (index < 0) { result.push(structuredClone(incoming)); continue; }
    const current = result[index];
    if (typeof current === 'string' || typeof incoming === 'string') continue;
    if (current.sub || incoming.sub) current.sub = mergeItems(current.sub, incoming.sub);
    if (current.roles?.length && incoming.roles?.length) current.roles = unique([...current.roles, ...incoming.roles]);
    else delete current.roles;
    if (current.hide && !incoming.hide) current.hide = false;
  }
  return result;
}

function buildPlan(records) {
  const byPath = new Map(records.map(record => [record.path, record]));
  const menuRecord = byPath.get('settings/menus_v12');
  if (!menuRecord?.data?.admin) throw new Error('운영 메뉴 설정을 찾을 수 없습니다.');
  const positions = records.filter(record => record.path.startsWith('positions/') && isManager(record.data.name));
  if (!positions.length) throw new Error('통합할 매니저 직책을 찾을 수 없습니다.');
  positions.sort((a, b) => Number(b.data.name === NAME) - Number(a.data.name === NAME)
    || Number(b.path.split('/')[1].startsWith('default_')) - Number(a.path.split('/')[1].startsWith('default_'))
    || (a.data.rank || 0) - (b.data.rank || 0));
  const canonical = positions[0];
  const positionId = canonical.path.split('/')[1];
  const aliases = new Set(positions.flatMap(record => [record.path.split('/')[1], record.data.legacyId, record.data.name]).filter(Boolean).map(normalize));
  const menus = structuredClone(menuRecord.data);
  for (const site of Object.values(menus)) {
    for (const config of site.positionConfig || []) {
      if (isManager(config.name) || isManager(config.id)) aliases.add(normalize(config.id));
    }
  }
  const matches = value => isManager(value) || (Boolean(value) && aliases.has(normalize(value)));
  const replaceRole = value => matches(value) ? NAME : value;
  const replaceRoles = values => Array.isArray(values) ? unique(values.map(replaceRole)) : values;
  const rewriteItems = items => (items || []).map(item => {
    if (typeof item === 'string') return item;
    const next = { ...item };
    if (Array.isArray(item.roles)) next.roles = replaceRoles(item.roles);
    if (Array.isArray(item.sub)) next.sub = rewriteItems(item.sub);
    return next;
  });

  const sourceKeys = Object.keys(menus).filter(key => key.startsWith('pos_') && (matches(key) || isManager(menus[key]?.name)));
  if (!sourceKeys.length) throw new Error('매니저 메뉴가 없습니다.');
  sourceKeys.sort((a, b) => Number(b === 'pos_manager') - Number(a === 'pos_manager')
    || String(menus[a].name).localeCompare(String(menus[b].name)));
  const merged = structuredClone(menus[sourceKeys[0]]);
  for (const key of sourceKeys.slice(1)) {
    for (const field of ['menu', 'headerActions', 'trash']) {
      if (merged[field] || menus[key][field]) merged[field] = mergeItems(merged[field], menus[key][field]);
    }
    if (merged.deletedItems || menus[key].deletedItems) merged.deletedItems = unique([...(merged.deletedItems || []), ...(menus[key].deletedItems || [])]);
  }
  merged.name = NAME;
  for (const key of sourceKeys) delete menus[key];
  menus.pos_manager = merged;
  for (const site of Object.values(menus)) {
    for (const field of ['menu', 'headerActions', 'trash']) {
      if (Array.isArray(site[field])) site[field] = rewriteItems(site[field]);
    }
    if (!Array.isArray(site.positionConfig)) continue;
    let retained = false;
    site.positionConfig = site.positionConfig.flatMap(config => {
      if (!matches(config.id) && !isManager(config.name)) return [config];
      if (retained) return [];
      retained = true;
      return [{ ...config, id: MENU_ID, name: NAME }];
    });
  }

  const operations = [];
  const changesByCollection = {};
  const changedUserIds = new Set();
  const addUpdate = (record, patch) => {
    const changed = Object.fromEntries(Object.entries(patch).filter(([key, value]) => !isDeepStrictEqual(record.data[key], value)));
    if (!Object.keys(changed).length) return;
    operations.push({ path: record.path, type: 'update', patch: changed });
    const collection = record.path.split('/')[0];
    changesByCollection[collection] = (changesByCollection[collection] || 0) + 1;
    if (collection === 'users') changedUserIds.add(record.path.split('/')[1]);
    else if (['workers', 'office_staff'].includes(collection) && record.data.uid) changedUserIds.add(record.data.uid);
  };
  if (!isDeepStrictEqual(menus, menuRecord.data)) operations.push({ path: menuRecord.path, type: 'set', data: menus });
  addUpdate(canonical, { name: NAME, legacyId: MENU_ID, systemRole: NAME, description: '통합 매니저' });
  for (const record of positions.slice(1)) operations.push({ path: record.path, type: 'delete' });

  for (const record of records.filter(record => PROFILE_COLLECTIONS.includes(record.path.split('/')[0]))) {
    const patch = {};
    for (const field of PROFILE_FIELDS) {
      if (!(field in record.data)) continue;
      const value = record.data[field];
      if (Array.isArray(value)) patch[field] = replaceRoles(value);
      else if (matches(value)) patch[field] = field === 'positionId' ? positionId
        : field === 'menuPositionId' ? MENU_ID
          : field === 'role' && record.path.startsWith('users/') ? 'manager' : NAME;
    }
    // A base position must not also appear as an additional position.
    if ((patch.position || record.data.position) === NAME && Array.isArray(patch.additionalPositions)) {
      patch.additionalPositions = patch.additionalPositions.filter(value => value !== NAME);
    }
    addUpdate(record, patch);
  }

  let additionalAssignments = 0;
  const mapRecord = byPath.get('system_configs/user_menu_positions');
  if (mapRecord) {
    const current = JSON.parse(mapRecord.data.data || '{}');
    const next = {};
    for (const [uid, values] of Object.entries(current)) {
      if (!Array.isArray(values)) throw new Error('추가 직책 설정 형식이 올바르지 않습니다.');
      next[uid] = replaceRoles(values);
      if (!isDeepStrictEqual(values, next[uid])) { additionalAssignments++; changedUserIds.add(uid); }
    }
    if (!isDeepStrictEqual(current, next)) addUpdate(mapRecord, { data: JSON.stringify(next) });
  }
  const permissionRecord = byPath.get('system_configs/permissions');
  if (permissionRecord) {
    const permissions = JSON.parse(permissionRecord.data.data || '{}');
    const next = structuredClone(permissions);
    const keys = Object.keys(permissions).filter(matches);
    if (keys.length) {
      const combined = {};
      for (const key of keys) {
        for (const [permission, allowed] of Object.entries(permissions[key])) {
          if (typeof allowed !== 'boolean') throw new Error('직책 권한 값은 boolean이어야 합니다.');
          combined[permission] = combined[permission] === true || allowed;
        }
        delete next[key];
      }
      next[NAME] = combined;
    }
    if (!isDeepStrictEqual(permissions, next)) addUpdate(permissionRecord, { data: JSON.stringify(next) });
  }
  return {
    operations, changedUserIds: [...changedUserIds],
    summary: { positionDocumentsBefore: positions.length, positionDocumentsAfter: 1,
      menuGroupsBefore: sourceKeys.length, menuGroupsAfter: 1,
      changedProfiles: changesByCollection, additionalAssignments, operations: operations.length },
  };
}

async function loadRecords(db) {
  const snapshots = await Promise.all([
    db.collection('positions').get(),
    ...PROFILE_COLLECTIONS.map(collection => db.collection(collection).select(...PROFILE_FIELDS, 'uid').get()),
  ]);
  const singles = await db.getAll(db.doc('settings/menus_v12'), db.doc('system_configs/user_menu_positions'), db.doc('system_configs/permissions'));
  return [...snapshots.flatMap(snapshot => snapshot.docs), ...singles.filter(snapshot => snapshot.exists)]
    .map(snapshot => ({ path: snapshot.ref.path, data: snapshot.data(), updateTime: snapshot.updateTime }));
}

async function main() {
  const apply = process.argv.includes('--apply');
  const verify = process.argv.includes('--verify');
  if (process.argv.some(arg => arg.startsWith('--') && !['--apply', '--verify'].includes(arg))) throw new Error('지원하지 않는 옵션입니다.');
  const admin = require('../functions/node_modules/firebase-admin');
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||= path.join(process.env.APPDATA, 'gcloud', 'application_default_credentials.json');
  admin.initializeApp({ projectId: PROJECT_ID });
  const db = admin.firestore();
  try {
    const records = await loadRecords(db);
    const plan = buildPlan(records);
    console.log(JSON.stringify({ mode: apply ? 'apply' : verify ? 'verify' : 'preview', ...plan.summary }));
    if (verify && plan.operations.length) throw new Error('아직 통합되지 않은 직책 참조가 남아 있습니다.');
    if (!apply || !plan.operations.length) return;
    if (plan.operations.length > 450) throw new Error('원자적 처리 한도를 초과했습니다.');
    const backupDirectory = path.join(__dirname, '../backups/manager-consolidation');
    fs.mkdirSync(backupDirectory, { recursive: true });
    // Store only the affected settings/role fields, never account names, emails or credentials.
    const affectedPaths = new Set(plan.operations.map(operation => operation.path));
    const backupFile = path.join(backupDirectory, `before-${Date.now()}.bin`);
    fs.writeFileSync(backupFile, serialize({ projectId: PROJECT_ID, records: records.filter(record => affectedPaths.has(record.path)), plan }));
    await db.runTransaction(async transaction => {
      const current = await transaction.getAll(...records.map(record => db.doc(record.path)));
      current.forEach((snapshot, index) => {
        if (!snapshot.updateTime?.isEqual(records[index].updateTime)) throw new Error('검토 이후 데이터가 변경되었습니다. 다시 검토해 주세요.');
      });
      for (const operation of plan.operations) {
        const ref = db.doc(operation.path);
        if (operation.type === 'delete') transaction.delete(ref);
        else if (operation.type === 'set') transaction.set(ref, operation.data);
        else transaction.update(ref, { ...operation.patch, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    });
    // The menu-position map has no user-write trigger. Refresh all affected accounts explicitly.
    const { refreshAccessClaimsForUid } = require('../functions/lib/roleClaims');
    let syncedClaims = 0;
    let missingAuthAccounts = 0;
    for (const uid of plan.changedUserIds) {
      try { await refreshAccessClaimsForUid(uid); syncedClaims++; }
      catch (error) { if (error.code === 'auth/user-not-found') missingAuthAccounts++; else throw error; }
    }
    const remaining = buildPlan(await loadRecords(db));
    if (remaining.operations.length) throw new Error('적용 후 검증에서 미통합 참조가 확인되었습니다.');
    console.log(JSON.stringify({ applied: true, verified: true, syncedClaims, missingAuthAccounts, remainingChanges: 0 }));
  } finally { await db.terminate(); }
}

module.exports = { buildPlan, mergeItems, isManager };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
