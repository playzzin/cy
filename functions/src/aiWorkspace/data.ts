import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import * as functions from 'firebase-functions/v1';
import { requireCallableAuth } from '../auth';
import { resolvedRoleNames } from '../teamExpenseRequests';
import { readTeamScopedData } from '../teamScopedRead';
import { queryByIds, queryRows } from '../teamScopedQuery';
import { AiPlan } from './contract';
import { Catalog, SourceRow, text, WorkspaceError } from './domain';
import { settlementDocumentId } from './settlements';
import { accommodationParent, AuditEntry, BILLING_COLLECTIONS, billingBelongsToEntry, billingKey } from './reconciliation';
import { BillingOrigin, billingIsPosted } from './reconciliation';
import { billOwner, missingTeams, MISSING_BILL_LIMIT, ScopedBill } from './missingBilling';
import { requireWorkspaceRuntime } from './runtime';

const adminRoles = new Set(['admin', 'administrator', 'superadmin', 'owner', 'dev', 'developer', 'systemadmin', '관리자', '사장', '실장', '개발', '개발자', '시스템관리자']);
export const isWorkspaceAdmin = (roles: string[]) => roles.some(role => adminRoles.has(role.toLowerCase().replace(/[\s_-]/g, '')));
export type WorkspaceAccess = { uid: string; all: boolean; hash: string; runtimeRevision: number; teamCatalog?: { teams: SourceRow[]; workers: SourceRow[] } };
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const authorizeWorkspace = async (context: functions.https.CallableContext): Promise<WorkspaceAccess> => {
  const { uid } = requireCallableAuth(context);
  const runtime = await requireWorkspaceRuntime(uid);
  if ((await admin.auth().getUser(uid)).disabled) throw new functions.https.HttpsError('permission-denied', '사용할 수 없는 계정입니다.');
  const db = admin.firestore();
  const profile = (await db.doc(`users/${uid}`).get()).data();
  if (!profile || profile.status !== 'active') throw new functions.https.HttpsError('permission-denied', '활성 계정이 필요합니다.');
  const menu = (await db.doc('settings/menus_v12').get()).data();
  // Use current profile roles, never stale custom claims, when granting all-data access.
  const roles = resolvedRoleNames(profile, menu).map(String).sort();
  if (isWorkspaceAdmin(roles)) return { uid, all: true, runtimeRevision: runtime.revision, hash: hash([uid, roles, 'all', runtime.revision]) };
  const response = await readTeamScopedData({ requests: [{ collection: 'teams' }, { collection: 'workers' }] }, context) as any;
  if (response.results?.some((result: any) => result.error)) throw new functions.https.HttpsError('permission-denied', '연결된 팀의 조회 권한을 확인해 주세요.');
  const teams: SourceRow[] = response.results[0].rows, workers: SourceRow[] = response.results[1].rows;
  return { uid, all: false, runtimeRevision: runtime.revision, teamCatalog: { teams, workers }, hash: hash([uid, roles,
    teams.map(row => row.id).sort(), workers.map(row => row.id).sort(), workers.map(row => text(row.teamId)).sort(), runtime.revision]) };
};
const collections = { worker: 'workers', team: 'teams', site: 'sites', company: 'companies' } as const;
export async function loadCatalog(access: WorkspaceAccess, plan: AiPlan, context: functions.https.CallableContext): Promise<Catalog> {
  const result: Catalog = { worker: [], team: [], site: [], company: [] };
  const needed = new Set(plan.filters.map(filter => filter.entity));
  if (plan.operation === 'search') needed.add(plan.entity);
  if (['workerTeam', 'responsibleTeam', 'settlementTeam'].includes(plan.groupBy)) needed.add('team');
  for (const entity of needed) {
    if (access.all) result[entity] = await queryRows(admin.firestore().collection(collections[entity]));
    else if (entity === 'worker') result.worker = access.teamCatalog!.workers;
    else if (entity === 'team') result.team = access.teamCatalog!.teams;
    else {
      const response = await readTeamScopedData({ collection: collections[entity] }, context) as any;
      result[entity] = entity === 'company' ? response.rows.map((row: SourceRow) => ({ ...row, _accountVisibility: false })) : response.rows;
    }
  }
  return result;
}
export async function loadReports(access: WorkspaceAccess, plan: AiPlan, context: functions.https.CallableContext): Promise<SourceRow[]> {
  if (plan.operation !== 'aggregate') return [];
  const rows = new Map<string, SourceRow>();
  for (const range of [plan.range, plan.comparison].filter(Boolean)) {
    let documents: SourceRow[];
    if (access.all) {
      // Bound date reads before decoding legacy embedded worker arrays. No full-history scan.
      documents = await queryRows(admin.firestore().collection('daily_reports')
        .where('date', '>=', range!.startDate).where('date', '<=', range!.endDate));
    } else {
      const response = await readTeamScopedData({ collection: 'daily_reports', filters: range }, context) as any;
      documents = response.rows;
    }
    documents.forEach(row => rows.set(row.id, row));
    if (rows.size > 5000) throw new WorkspaceError('resource-exhausted', '비교할 일보가 많습니다. 기간을 좁혀 주세요.');
  }
  return [...rows.values()];
}

export async function loadSettlements(plan: AiPlan, catalog: Catalog): Promise<SourceRow[]> {
  const selected = plan.filters.find(filter => filter.entity === 'team');
  const teams = catalog.team.filter(team => !selected || team.id === selected.id);
  if (teams.length > 500) throw new WorkspaceError('resource-exhausted', '정산 조회는 한 번에 최대 500개 팀입니다. 조회 대상을 좁혀 주세요.');
  const months = [...new Set([plan.range.startDate, plan.comparison?.startDate].filter(Boolean).map(date => date!.slice(0, 7)))];
  const refs = months.flatMap(month => teams.map(team => admin.firestore().doc(`system_configs/${settlementDocumentId(month, team.id)}`)));
  const result: SourceRow[] = [];
  for (let offset = 0; offset < refs.length; offset += 100) {
    const snapshots = await admin.firestore().getAll(...refs.slice(offset, offset + 100));
    snapshots.forEach(snapshot => { if (snapshot.exists) result.push({ ...snapshot.data(), id: snapshot.id }); });
  }
  return result;
}

export async function loadReconciliationSources(entries: AuditEntry[], catalog: Catalog): Promise<Map<string, SourceRow>> {
  const requested = entries.filter(entry => entry.referenceId);
  const keys = [...new Set(requested.map(entry => billingKey(entry.origin, entry.referenceId)))], result = new Map<string, SourceRow>();
  if (keys.length > 500) throw new WorkspaceError('resource-exhausted', '청구서가 많습니다. 조회할 팀을 좁혀 주세요.');
  for (let offset = 0; offset < keys.length; offset += 100) {
    const docs = await admin.firestore().getAll(...keys.slice(offset, offset + 100).map(key => admin.firestore().doc(key)));
    for (const doc of docs) {
      const source = { ...doc.data(), id: doc.id };
      // Validate the parent before reading accommodation child rows. Never return other teams' fields.
      if (doc.exists && requested.some(entry => billingKey(entry.origin, entry.referenceId) === doc.ref.path && billingBelongsToEntry(source, entry, catalog))) result.set(doc.ref.path, source);
    }
  }
  const parents = [...result.entries()].filter(([key]) => key.startsWith(`${BILLING_COLLECTIONS.accommodation_billing}/`));
  if (parents.length) {
    const items = await queryByIds(admin.firestore(), 'accommodation_billing_line_items', ['billingDocumentId', 'billingDocument.id'], parents.map(([, row]) => row.id));
    for (const [, parent] of parents) parent.lineItems = items.filter(row => accommodationParent(row) === parent.id);
  }
  return result;
}

export async function loadMissingBills(plan: AiPlan, catalog: Catalog): Promise<{ bills: ScopedBill[]; excludedUnconfirmed: number }> {
  const teams = missingTeams(plan, catalog), month = plan.range.startDate.slice(0, 7);
  const ids = [...new Set(teams.flatMap(team => [team.id, text(team.legacyId)]).filter(Boolean))];
  const seen = new Set<string>(), bills: ScopedBill[] = [];
  let excludedUnconfirmed = 0;
  for (const [origin, collection] of Object.entries(BILLING_COLLECTIONS) as Array<[BillingOrigin, string]>) {
    for (const field of ['team.id', 'teamId', 'assignedTeamId']) for (let offset = 0; offset < ids.length; offset += 30) {
      // Both month and authorized team identities are constrained before reading. Never fall back to a full collection scan.
      const snapshot = await admin.firestore().collection(collection).where('yearMonth', '==', month)
        .where(field, 'in', ids.slice(offset, offset + 30)).limit(MISSING_BILL_LIMIT + 1).get();
      for (const doc of snapshot.docs) {
        if (seen.has(doc.ref.path)) continue;
        seen.add(doc.ref.path);
        if (seen.size > MISSING_BILL_LIMIT) throw new WorkspaceError('resource-exhausted', '해당 월의 청구서 조회가 500건을 초과했습니다. 조회할 팀을 좁혀 주세요.');
        const source: SourceRow = { ...doc.data(), id: doc.id }, teamId = billOwner(source, teams, month);
        if (!teamId) continue;
        if (!billingIsPosted(source)) { excludedUnconfirmed++; continue; }
        bills.push({ origin, source, teamId });
      }
    }
  }
  const parents = bills.filter(bill => bill.origin === 'accommodation_billing');
  if (parents.length) {
    const lines = await queryByIds(admin.firestore(), 'accommodation_billing_line_items', ['billingDocumentId', 'billingDocument.id'], parents.map(bill => bill.source.id));
    for (const parent of parents) parent.source.lineItems = lines.filter(line => accommodationParent(line) === parent.source.id);
  }
  return { bills, excludedUnconfirmed };
}
