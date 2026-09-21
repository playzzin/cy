export type TeamRow = Record<string, any> & { id: string };
export const text = (value: unknown): string => String(value ?? '').trim();
export const list = (value: unknown): any[] => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
    }
    return [];
};
export const isTeamLeader = (value: unknown): boolean =>
    ['팀장', '반장', 'teamlead', 'teamleader', 'foreman'].includes(text(value).toLowerCase().replace(/[\s_-]/g, ''));

export interface TeamReadScope {
    teamIds: string[];
    workerIds: string[];
    siteIds: string[];
}

const relatedId = (row: TeamRow, field: string) => text(row[field] ?? row[field.replace(/Id$/, '')]?.id);
export const belongsToTeam = (row: TeamRow, scope: TeamReadScope): boolean =>
    ['teamId', 'assignedTeamId', 'responsibleTeamId', 'payerTeamId', 'chargeToTeamId', 'relatedTeamId']
        .some(field => scope.teamIds.includes(relatedId(row, field)))
    || [['assigneeType', 'assigneeId'], ['targetType', 'targetId'], ['currentAssigneeType', 'currentAssigneeId']]
        .some(([type, id]) => (text(row[type]).toLowerCase() === 'team' && scope.teamIds.includes(text(row[id])))
            || (text(row[type]).toLowerCase() === 'worker' && scope.workerIds.includes(text(row[id]))))
    || scope.workerIds.includes(relatedId(row, 'workerId'))
    || scope.workerIds.includes(relatedId(row, 'issuedToWorkerId'));
const ownWorker = (row: TeamRow, scope: TeamReadScope) =>
    scope.workerIds.includes(text(row.workerId || row.id));

// Embedded arrays are filtered on the server, before data crosses the account boundary.
export const filterTeamRows = (collection: string, rows: TeamRow[], scope: TeamReadScope): TeamRow[] => {
    if (!scope.teamIds.length) return [];
    if (collection === 'teams') return rows.filter(row => scope.teamIds.includes(row.id));
    if (collection === 'workers') return rows.filter(row => scope.workerIds.includes(row.id));
    if (collection === 'sites') return rows.filter(row => scope.siteIds.includes(row.id));
    // Payroll belongs to the worker. A stale team label must not expose a
    // different team's worker, even when that record mentions an allowed team.
    if (collection === 'advance_payments' || collection === 'advance_requests') {
        return rows.filter(row => scope.workerIds.includes(relatedId(row, 'workerId')));
    }
    if (collection === 'daily_reports') {
        return rows.flatMap(row => {
            const workers = list(row.workers).filter(worker => ownWorker(worker, scope));
            if (!workers.length) return [];
            return [{ ...row, workers,
                totalManDay: workers.reduce((sum, worker) => sum + (Number(worker.manDay) || 0), 0),
                totalAmount: workers.reduce((sum, worker) => sum + (Number(worker.manDay) || 0) * (Number(worker.unitPrice) || 0), 0),
            }];
        });
    }
    if (collection === 'schedule_confirmation_boards' || collection === 'daily_dispatches') {
        return rows.flatMap(row => {
            const assignments = list(row.assignments).flatMap(assignment => {
                const workerIds = list(assignment.workerIds).filter(id => scope.workerIds.includes(text(id)));
                return workerIds.length ? [{ id: assignment.id, siteId: assignment.siteId, siteName: assignment.siteName,
                    siteAddress: assignment.siteAddress, workerIds, vehicleIds: [],
                    teamId: scope.teamIds.includes(text(assignment.teamId)) ? assignment.teamId : undefined,
                    teamName: scope.teamIds.includes(text(assignment.teamId)) ? assignment.teamName : undefined,
                    startTime: assignment.startTime, endTime: assignment.endTime, status: assignment.status }] : [];
            });
            return assignments.length ? [{ id: row.id, date: row.date, status: row.status || 'confirmed', assignments,
                confirmedAt: row.confirmedAt, createdAt: row.createdAt, updatedAt: row.updatedAt }] : [];
        });
    }
    if (collection === 'field_schedule_requests') {
        return rows.flatMap(row => {
            const ownIds = list(row.offDutyWorkerIds).filter(id => scope.workerIds.includes(text(id)));
            if (!belongsToTeam(row, scope) && !ownIds.length) return [];
            return [{ ...row, offDutyWorkerIds: ownIds, offDutyWorkerNames: [],
                memo: row.siteId === '__date_off_duty__' ? '' : row.memo }];
        });
    }
    if (collection === 'materialInbounds' || collection === 'materialOutbounds') return rows.filter(row => scope.siteIds.includes(text(row.siteId)));
    return rows.filter(row => belongsToTeam(row, scope));
};
