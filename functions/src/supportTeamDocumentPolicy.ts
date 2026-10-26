import { isTeamLeader, TeamRow, text } from './teamReadPolicy';

const officeRoles = new Set(['admin', 'administrator', 'superadmin', 'owner', 'dev', 'developer', 'systemadmin', '관리자', '사장', '대표', 'ceo', '실장', '개발자', 'office', 'officestaff', '사무실', '사무실직원', '사무직원', '사무', 'manager', 'manager1', 'manager2', 'manager3', '매니저', '메니저', 'payrollmanager', 'finance', 'accounting', '회계', '재무', '경리']);
export const supportDocumentOfficeRole = (value: string) => officeRoles.has(value.toLowerCase().replace(/[\s_-]/g, ''));
export const activeDocumentWorker = (row: TeamRow) => row.isActive !== false
    && !['퇴사', '출입금지', 'inactive', 'retired', 'archived', 'deleted'].includes(text(row.status).toLowerCase());
export const documentRowIds = (row: TeamRow) => [row.id, text(row.legacyId)].filter(Boolean);

export type SupportDocumentPerson = {
    id: string; name: string; teamId: string; teamName: string; role: string;
    relation: 'own' | 'other';
    hasIdentity: boolean; hasBank: boolean; hasDirectPayBank: boolean;
};
type DocumentScope = {
    ownTeamIds: string[]; allowedTeamIds: string[]; office: boolean; teams: TeamRow[]; workers: TeamRow[];
};

export function supportDocumentPeople(input: DocumentScope): SupportDocumentPerson[] {
    const { ownTeamIds, allowedTeamIds, office, teams, workers } = input;
    const byTeam = new Map(teams.flatMap(team => documentRowIds(team).map(id => [id, team] as const)));
    return workers.filter(activeDocumentWorker).flatMap(worker => {
        if (!office && !allowedTeamIds.includes(text(worker.teamId))) return [];
        const own = ownTeamIds.includes(text(worker.teamId));
        const team = byTeam.get(text(worker.teamId));
        const linkedLeader = team && documentRowIds(worker).includes(text(team.leaderId));
        return [{ id: worker.id, name: text(worker.name), teamId: team?.id || text(worker.teamId),
            teamName: text(team?.name) || text(worker.teamName) || '소속 미지정',
            role: linkedLeader || isTeamLeader(worker.role) ? '팀장' : text(worker.role),
            relation: own ? 'own' as const : 'other' as const,
            hasIdentity: Boolean(text(worker.fileNameSaved)), hasBank: Boolean(text(worker.bankPhotoId)),
            hasDirectPayBank: Boolean(text(worker.directPayBankPhotoId)) }];
    });
}
