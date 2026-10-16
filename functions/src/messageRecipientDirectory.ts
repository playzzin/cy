import { TeamRow, text } from './teamReadPolicy';

// Messaging needs a contact label and UID, never private account documents.
// Worker links are restricted to workers already visible in the caller's team.
export function messageRecipientDirectoryRow(row: TeamRow, workerIds: string[]) {
    if (row.status !== 'active' || row.isActive === false || !text(row.id)) return null;
    return {
        uid: row.id,
        displayName: text(row.displayName) || text(row.name) || '사용자',
        role: text(row.role),
        position: text(row.position),
        department: text(row.department),
        status: 'active',
        linkedWorkerIds: Array.isArray(row.linkedWorkerIds)
            ? row.linkedWorkerIds.map(text).filter((id: string) => workerIds.includes(id)) : [],
    };
}
