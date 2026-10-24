import { projectTeamVehicleOil } from './teamVehicleOilSummary';
import { messageRecipientDirectoryRow } from './messageRecipientDirectory';
import { resolvedRoleNames } from './teamExpenseRequests';
import { readWorkerScopedData } from './workerScopedRead';
import * as admin from 'firebase-admin';
import { FieldPath, Timestamp } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions/v1';
import { protectedRegion, requireCallableAuth } from './auth';
import { belongsToTeam, filterTeamRows, isTeamLeader, list, TeamReadScope, TeamRow, text } from './teamReadPolicy';
import { mergeTeamQueryRows, queryByIds, queryRows, queryTeamCandidates } from './teamScopedQuery';
import { readTeamCatalog } from './teamCatalogCache';
import { readTeamSettlementSupportDetails } from './teamSettlementSupportRead';
import { readTeamSettlementIncoming } from './teamSettlementRead';
import { projectSiteWorkReports, responsibleSites, validateSiteWorkRange } from './siteWorkReports';
import { readWhiteboardParticipation } from './whiteboardParticipation';
import { readWorkerSummaryDirectory } from './workerSummaryDirectory';

const COLLECTIONS = new Set([
    'worker_summary_directory',
    'vehicle_oil_summary',
    'site_work_reports',
    'message_recipients',
    'whiteboard_participation',
    'workers', 'teams', 'sites', 'companies', 'daily_reports', 'daily_dispatches', 'team_settlement_incoming', 'team_settlement_support_details',
    'schedule_confirmation_boards', 'field_schedule_requests',
    'accommodations', 'accommodationAssignments', 'accommodationUtilityRecords', 'accommodation_billing_documents', 'accommodation_billing_line_items', 'accommodation_billing_targets',
    'vehicles', 'vehicleAssignments', 'vehicleBillingTargets', 'vehicle_billing_documents', 'vehicleExpenses',
    'cards', 'cardAssignments', 'cardBillingTargets', 'cardBillings', 'cardTransactions',
    'team_expense_claims', 'system_configs', 'office_transactions',
    'materials', 'materialInbounds', 'materialOutbounds', 'materialPhotoBatches',
    'advance_payments', 'advance_requests',
]);

const serialize = (value: any): any => {
    if (value === undefined) return null;
    if (value instanceof Timestamp) return { __teamTimestamp: value.toMillis() };
    if (Array.isArray(value)) return value.map(serialize);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serialize(entry)]));
    return value;
};

// This endpoint decodes and filters several collections per call. In gen 1,
// memory also controls CPU; the shared 256MB budget throttled these batches.
// Keep scale-to-zero and the existing instance cap; change only this endpoint.
export const readTeamScopedData = async (input: any, context: functions.https.CallableContext) => {
    const startedAt = Date.now();
    const auth = requireCallableAuth(context);
    const batch = Array.isArray(input?.requests);
    const requests = batch ? input.requests : [input];
    if (!requests.length || requests.length > 20 || requests.some(request => !COLLECTIONS.has(text(request?.collection)))) {
        throw new functions.https.HttpsError('invalid-argument', '지원하지 않는 팀 조회입니다.');
    }
    const db = admin.firestore();
    const user = (await db.doc(`users/${auth.uid}`).get()).data();
    if (!user || (user.status && user.status !== 'active')) {
        throw new functions.https.HttpsError('permission-denied', '활성 계정이 필요합니다.');
    }
    const linkedIds = Array.isArray(user.linkedWorkerIds) ? user.linkedWorkerIds.map(text).filter(Boolean) : [];
    const linked = linkedIds.length ? await db.getAll(...linkedIds.map((id: string) => db.collection('workers').doc(id))) : [];
    const anchors = linked.filter(doc => doc.exists && doc.data()?.isActive !== false && !['퇴사', 'inactive', 'retired', 'archived'].includes(text(doc.data()?.status))).map(doc => ({ ...doc.data(), id: doc.id } as TeamRow));
    const menu = (await db.doc('settings/menus_v12').get()).data();
    const roles = resolvedRoleNames(user, menu);
    if (!roles.some(isTeamLeader) && (user.accountType === 'worker' || roles.some(role => ['worker', '작업자', '일반'].includes(text(role).toLowerCase())))) {
        return serialize(await readWorkerScopedData(db, auth.uid, user, anchors, requests, batch));
    }
    if (!anchors.length || !roles.some(isTeamLeader)) {
        throw new functions.https.HttpsError('permission-denied', '팀장 계정의 작업자 연결을 확인해 주세요.');
    }
    const anchorTeamIds: string[] = Array.from(new Set(anchors.map(row => text(row.teamId)).filter(Boolean)));
    if (!anchorTeamIds.length) throw new functions.https.HttpsError('failed-precondition', '연결된 작업자에게 소속 팀이 지정되지 않았습니다.');
    const pending = new Map<string, Promise<TeamRow[]>>();
    let resolvedTeamIds = anchorTeamIds;
    const scope: TeamReadScope = { teamIds: anchorTeamIds, workerIds: [], siteIds: [] };
    const metrics = { queries: 0, documents: 0 };
    const byIds = (name: string, fields: Array<string | FieldPath>, ids: string[]) => queryByIds(db, name, fields, ids, metrics);
    const candidates = (name: string) => queryTeamCandidates(db, name, scope, metrics);
    const read = (name: string, filters: Record<string, any> = {}): Promise<TeamRow[]> => {
        // Reuse the raw read when the database query does not use dates. Apply
        // each caller's dates below, after scope filtering, without another read.
        const dateQuery = ['daily_reports', 'daily_dispatches', 'schedule_confirmation_boards', 'field_schedule_requests', 'accommodation_billing_line_items'].includes(name);
        const key = JSON.stringify([name, dateQuery ? [filters.yearMonth, filters.startDate, filters.endDate] : null,
            name === 'system_configs' ? text(filters.configId) : null,
            ['companies', 'materials'].includes(name) && Boolean(filters.bypassCache)]);
        if (!pending.has(key)) pending.set(key, (async () => {
            if (name === 'teams') return byIds(name, [FieldPath.documentId(), 'legacyId'], anchorTeamIds);
            if (name === 'workers') return byIds(name, ['teamId'], resolvedTeamIds);
            if (name === 'companies') {
                await sitesReady;
                const ids = [...teams, ...sites].flatMap(row => [row.companyId, row.clientCompanyId, row.constructorCompanyId]).map(text).filter(Boolean);
                return readTeamCatalog(auth.uid, name, ids, Boolean(filters.bypassCache), async () =>
                    (await byIds(name, [FieldPath.documentId()], ids)).map(row => ({ id: row.id, name: row.name, type: row.type, code: row.code })));
            }
            if (name === 'materials') {
                return readTeamCatalog(auth.uid, name, [], Boolean(filters.bypassCache), async () =>
                    (await queryRows(db.collection(name), metrics)).map(row => ({
                        id: row.id, itemName: row.itemName ?? row.name, materialKey: row.materialKey,
                        category: row.category, unit: row.unit, spec: row.spec, code: row.code,
                        safetyStock: row.safetyStock, isActive: row.isActive,
                        isCatalogDefault: row.isCatalogDefault, hiddenCatalogDefault: row.hiddenCatalogDefault,
                    })));
            }
            if (['materialInbounds', 'materialOutbounds', 'materialPhotoBatches'].includes(name)) return byIds(name, ['siteId'], scope.siteIds);
            if (name === 'advance_payments' || name === 'advance_requests') {
                // Payroll authorization is worker-only, so team/asset candidate
                // queries cannot contribute any permitted rows.
                return byIds(name, ['workerId', 'worker.id'], scope.workerIds);
            }
            if (name === 'system_configs') {
                const configId = text(filters.configId);
                if (configId) {
                    if (configId.includes('/') || !(configId === 'support_site_rates' || configId.startsWith('team_settlement_'))) return [];
                    return byIds(name, [FieldPath.documentId()], [configId]);
                }
                // Only these IDs can survive the policy below. Avoid decoding
                // unrelated menu, editor and document settings on every screen.
                return mergeTeamQueryRows(await Promise.all([
                    byIds(name, [FieldPath.documentId()], ['support_site_rates']),
                    queryRows(db.collection(name).orderBy(FieldPath.documentId())
                        .startAt('team_settlement_').endBefore('team_settlement`'), metrics),
                ]));
            }
            if (['accommodations', 'vehicles', 'cards', 'cardTransactions', 'vehicleExpenses', 'accommodationUtilityRecords'].includes(name)) {
                const kind = name === 'cards' || name === 'cardTransactions' ? 'card' : name === 'vehicles' || name === 'vehicleExpenses' ? 'vehicle' : 'accommodation';
                const assignments = (await read(`${kind}Assignments`)).filter(row => belongsToTeam(row, scope));
                const ids = assignments.map(row => text(row[`${kind}Id`] ?? row[kind]?.id));
                const isAsset = ['accommodations', 'vehicles', 'cards'].includes(name);
                const groups = await Promise.all([
                    byIds(name, isAsset ? [FieldPath.documentId()] : [`${kind}Id`], ids),
                    isAsset ? candidates(name) : Promise.resolve([]),
                ]);
                return mergeTeamQueryRows(groups);
            }
            if (name === 'accommodation_billing_line_items') {
                const docs = filterTeamRows('accommodation_billing_documents', await read('accommodation_billing_documents', filters), scope)
                    .filter(row => !filters.yearMonth || row.yearMonth === filters.yearMonth);
                return byIds(name, ['billingDocumentId', 'billingDocument.id'], docs.map(row => row.id));
            }
            // Legacy embedded worker/assignment arrays cannot be queried by team
            // without migrating their schema. Bound those reads by the screen's date.
            if (!['daily_reports', 'daily_dispatches', 'schedule_confirmation_boards', 'field_schedule_requests', 'system_configs', 'materials'].includes(name)) {
                return candidates(name);
            }
            let query: admin.firestore.Query = db.collection(name);
            if (filters.yearMonth) query = query.where('yearMonth', '==', text(filters.yearMonth));
            if (filters.startDate) query = query.where('date', '>=', text(filters.startDate));
            if (filters.endDate) query = query.where('date', '<=', text(filters.endDate));
            return queryRows(query, metrics);
        })());
        return pending.get(key)!;
    };
    const teams = (await read('teams')).filter(row => anchorTeamIds.includes(row.id) || anchorTeamIds.includes(text(row.legacyId)));
    const teamIds = Array.from(new Set(teams.flatMap(row => [row.id, text(row.legacyId)]).filter(Boolean)));
    if (!teamIds.length) throw new functions.https.HttpsError('failed-precondition', '연결된 소속 팀을 찾을 수 없습니다.');
    if (teamIds.length > 30) throw new functions.https.HttpsError('failed-precondition', '팀 연결 수를 확인해 주세요.');
    resolvedTeamIds = teamIds;
    scope.teamIds = teamIds;
    const needsWorkers = requests.some(request => !['teams', 'materials', 'whiteboard_participation', 'worker_summary_directory'].includes(text(request.collection)));
    const requiresSites = (request: any) => ['site_work_reports', 'sites', 'companies', 'materialInbounds', 'materialOutbounds', 'materialPhotoBatches'].includes(text(request.collection))
        || (request.collection === 'system_configs' && (!text(request.filters?.configId) || request.filters.configId === 'support_site_rates'));
    const needsSites = requests.some(requiresSites);
    const workers = needsWorkers ? (await read('workers')).filter(row => teamIds.includes(text(row.teamId))) : [];
    scope.workerIds = workers.flatMap(row => [row.id, text(row.legacyId)]).filter(Boolean);
    let sites: TeamRow[] = [];
    // Site-dependent panels wait here; worker, payroll, report and resource
    // panels can start immediately after their own dependencies are ready.
    const sitesReady = needsSites ? read('sites').then(rows => {
        sites = rows.filter(row => belongsToTeam(row, scope));
        scope.siteIds = sites.flatMap(row => [row.id, text(row.legacyId)]).filter(Boolean);
    }) : Promise.resolve();
    const resolveRows = async (request: any) => {
        const collection = text(request.collection);
        const filters = request.filters || {};
        if (collection === 'worker_summary_directory') {
            return { rows: serialize([await readWorkerSummaryDirectory(db, teams, metrics)]) };
        }
        if (collection === 'vehicle_oil_summary') {
            // Ignore client-supplied team/vehicle IDs and never return the shared map.
            const vehicles = await byIds('vehicles', ['currentAssigneeId', 'billingTargetId'], [...scope.teamIds, ...scope.workerIds]);
            const shared = (await db.doc('support_shared_data/engine_oil_cycle').get()).data();
            return { rows: projectTeamVehicleOil(vehicles, workers, teams, shared?.data) };
        }
        if (collection === 'site_work_reports') {
            validateSiteWorkRange(filters);
            await sitesReady;
            const reports = await read('daily_reports', { startDate: filters.startDate, endDate: filters.endDate });
            const siteIds = new Set(responsibleSites(sites, scope).flatMap(row => [row.id, text(row.legacyId)]).filter(Boolean));
            const attendees = reports.filter(row => siteIds.has(text(row.siteId))).flatMap(row => list(row.workers));
            const missingTeams = attendees.filter(row => !text(row.teamId) && !scope.workerIds.includes(text(row.workerId || row.id)));
            const supportWorkers = await byIds('workers', [FieldPath.documentId(), 'legacyId'], missingTeams.map(row => text(row.workerId || row.id)).filter(Boolean));
            const attendanceTeams = await byIds('teams', [FieldPath.documentId(), 'legacyId'],
                [...attendees, ...supportWorkers, ...workers].map(row => text(row.teamId)).filter(Boolean));
            return { rows: serialize(projectSiteWorkReports(reports, sites, scope, [...workers, ...supportWorkers], attendanceTeams)) };
        }
        if (collection === 'message_recipients') {
            const recipients = await queryRows(db.collection('users').where('status', '==', 'active')
                .select('displayName', 'name', 'role', 'position', 'department', 'status', 'isActive', 'linkedWorkerIds'), metrics);
            return { rows: recipients.map(row => messageRecipientDirectoryRow(row, scope.workerIds)).filter(Boolean) };
        }
        if (collection === 'whiteboard_participation') {
            return { rows: serialize([await readWhiteboardParticipation(db, teams, filters, metrics)]) };
        }
        if (collection === 'team_settlement_support_details') {
            return { rows: serialize(await readTeamSettlementSupportDetails(db, teams, filters, metrics)) };
        }
        if (collection === 'team_settlement_incoming') {
            return { rows: serialize(await readTeamSettlementIncoming(db, teams, workers, filters, metrics)) };
        }
        if (requiresSites(request)) await sitesReady;
        let rows = await read(collection, filters);
        if (collection === 'companies') {
            const ids = new Set([...teams, ...sites].flatMap(row => [row.companyId, row.clientCompanyId, row.constructorCompanyId]).map(text).filter(Boolean));
            rows = rows.filter(row => ids.has(row.id)).map(row => ({ id: row.id, name: row.name, type: row.type, code: row.code }));
        } else if (['accommodations', 'vehicles', 'cards'].includes(collection)) {
            const config: Record<string, [string, string]> = { accommodations: ['accommodationAssignments', 'accommodationId'], vehicles: ['vehicleAssignments', 'vehicleId'], cards: ['cardAssignments', 'cardId'] };
            const [assignments, field] = config[collection];
            const assigned = (await read(assignments)).filter(row => belongsToTeam(row, scope));
            const ids = new Set(assigned.map(row => text(row[field] ?? row[field.replace(/Id$/, '')]?.id)));
            rows = rows.filter(row => ids.has(row.id) || belongsToTeam(row, scope));
            rows = rows.map(row => {
                const result = { ...row };
                if (!belongsToTeam({ id: row.id, currentAssigneeType: row.currentAssigneeType, currentAssigneeId: row.currentAssigneeId }, scope)) {
                    delete result.currentAssigneeId; delete result.currentAssigneeName; delete result.currentAssigneeType;
                }
                if (!belongsToTeam({ id: row.id, targetType: row.billingTargetType, targetId: row.billingTargetId }, scope)) {
                    delete result.billingTargetId; delete result.billingTargetName; delete result.billingTargetType;
                }
                return result;
            });
        } else if (collection === 'cardTransactions' || collection === 'vehicleExpenses') {
            const isCard = collection === 'cardTransactions';
            const field = isCard ? 'cardId' : 'vehicleId';
            const assignments = (await read(isCard ? 'cardAssignments' : 'vehicleAssignments')).filter(row => belongsToTeam(row, scope));
            rows = rows.filter(row => assignments.some(assignment => text(row[field]) === text(assignment[field])
                && text(row.date) >= text(assignment.startDate) && (!assignment.endDate || text(row.date) <= text(assignment.endDate))));
        } else if (collection === 'accommodationUtilityRecords') {
            const assignments = (await read('accommodationAssignments')).filter(row => belongsToTeam(row, scope));
            rows = rows.filter(row => assignments.some(assignment => text(row.accommodationId) === text(assignment.accommodationId || assignment.accommodation?.id)
                && text(assignment.startDate).slice(0, 7) <= text(row.yearMonth)
                && (!assignment.endDate || text(assignment.endDate).slice(0, 7) >= text(row.yearMonth))));
        } else if (collection === 'accommodation_billing_line_items') {
            const ids = new Set(filterTeamRows('accommodation_billing_documents', await read('accommodation_billing_documents', filters), scope).map(row => row.id));
            rows = rows.filter(row => ids.has(text(row.billingDocumentId || row.billingDocument?.id)));
        } else if (collection === 'system_configs') {
            rows = rows.flatMap(row => {
                let data: any;
                try { data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data; } catch { return []; }
                if (row.id === 'support_site_rates') {
                    const rates = list(Array.isArray(data) ? data : data?.rates).filter(rate => scope.siteIds.includes(text(rate.siteId)));
                    return [{ ...row, data: JSON.stringify(Array.isArray(data) ? rates : { rates }) }];
                }
                return row.id.startsWith('team_settlement_') && data && belongsToTeam(data, scope) ? [row] : [];
            });
        } else if (collection === 'materials') {
            // Shared catalog only: stock movements and prices remain team-scoped.
            rows = rows.map(row => ({
                id: row.id, itemName: row.itemName ?? row.name, materialKey: row.materialKey,
                category: row.category, unit: row.unit, spec: row.spec, code: row.code,
                safetyStock: row.safetyStock, isActive: row.isActive,
                isCatalogDefault: row.isCatalogDefault, hiddenCatalogDefault: row.hiddenCatalogDefault,
            }));
        } else {
            rows = filterTeamRows(collection, rows, scope);
        }
        rows = rows.filter(row => (!filters.yearMonth || collection === 'accommodation_billing_line_items' || row.yearMonth === filters.yearMonth)
            && (!filters.startDate || text(row.date) >= text(filters.startDate))
            && (!filters.endDate || text(row.date) <= text(filters.endDate)));
        return { rows: serialize(rows) };
    };
    const logPerformance = () => functions.logger.info('team-scoped-read', {
        requestCount: requests.length,
        collectionQueries: metrics.queries,
        collectionDocuments: metrics.documents,
        durationMs: Date.now() - startedAt,
    });
    const confirmScopeUnchanged = async () => {
        const [currentProfile, currentMenu, currentAnchors] = await Promise.all([
            db.doc(`users/${auth.uid}`).get(),
            db.doc('settings/menus_v12').get(),
            linkedIds.length ? db.getAll(...linkedIds.map((id: string) => db.collection('workers').doc(id))) : Promise.resolve([]),
        ]);
        // Session timestamps and display fields cannot change access. Compare
        // the actual authorization inputs, including menu-defined role names.
        const values = (items: any[]) => [...new Set(items.map(text).filter(Boolean))].sort();
        const profileSignature = (profile: any, settings: any) => JSON.stringify([
            Boolean(profile), profile?.status,
            values(resolvedRoleNames(profile, settings)),
            values(Array.isArray(profile?.linkedWorkerIds) ? profile.linkedWorkerIds : []),
        ]);
        const signature = (row: any) => JSON.stringify([Boolean(row), row?.status, row?.isActive, row?.teamId, row?.role, row?.uid]);
        if (profileSignature(currentProfile.data(), currentMenu.data()) !== profileSignature(user, menu)
            || currentAnchors.some((doc, index) => signature(doc.data()) !== signature(linked[index].data()))) {
            throw new functions.https.HttpsError('permission-denied', '조회 중 권한 또는 소속이 변경되었습니다. 다시 조회해 주세요.');
        }
    };
    if (!batch) {
        const result = await resolveRows(requests[0]);
        await confirmScopeUnchanged();
        logPerformance();
        return result;
    }
    // Keep optional panel failures local to that panel, while sharing authorization
    // and dependency reads across the whole screen. Never expose raw server errors.
    const results = await Promise.all(requests.map(async request => {
        try { return await resolveRows(request); } catch (error) {
            return { error: error instanceof functions.https.HttpsError
                ? { code: error.code, message: error.message }
                : { code: 'internal', message: '팀 데이터를 불러오지 못했습니다.' } };
        }
    }));
    await confirmScopeUnchanged();
    logPerformance();
    return { results };
};

export const getTeamScopedData = protectedRegion.runWith({ memory: '1GB' }).https.onCall(readTeamScopedData);
