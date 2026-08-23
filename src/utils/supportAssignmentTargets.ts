import type { Team } from '../services/teamService';
import type { OfficeStaff } from '../services/officeStaffService';
import type { AccommodationBillingTargetType } from '../types/accommodationBillingTarget';

export const OFFICE_ASSIGNMENT_TEAM_ID = '__office__';
export const OFFICE_ASSIGNMENT_TEAM_NAME = '사무실';

export interface OfficeStaffAssignmentOption {
    id: string;
    name: string;
    teamId: string;
    teamName: string;
    source: 'office_staff';
    detail?: string;
}

const normalizeTargetText = (value: unknown): string => (
    String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '')
);

export const isOfficeAssignmentReference = (
    teamId?: unknown,
    teamName?: unknown
): boolean => (
    normalizeTargetText(teamId) === normalizeTargetText(OFFICE_ASSIGNMENT_TEAM_ID) ||
    normalizeTargetText(teamName) === normalizeTargetText(OFFICE_ASSIGNMENT_TEAM_NAME)
);

export const officeAssignmentReferencesMatch = (
    leftTeamId: unknown,
    leftTeamName: unknown,
    rightTeamId: unknown,
    rightTeamName: unknown
): boolean => (
    isOfficeAssignmentReference(leftTeamId, leftTeamName) &&
    isOfficeAssignmentReference(rightTeamId, rightTeamName)
);

export const isOfficeBillingTargetForSelectedTeam = (
    selectedTeamId: unknown,
    selectedTeamName: unknown,
    targetType: AccommodationBillingTargetType
): boolean => (
    isOfficeAssignmentReference(selectedTeamId, selectedTeamName) &&
    (targetType === 'office' || targetType === 'office_staff')
);

export const isOfficeAssignmentTeam = (
    team: Pick<Team, 'id' | 'legacyId' | 'name'> | null | undefined
): boolean => {
    const id = String(team?.id ?? '').trim();
    const legacyId = String(team?.legacyId ?? '').trim();
    const name = normalizeTargetText(team?.name);

    return (
        isOfficeAssignmentReference(id, name) ||
        isOfficeAssignmentReference(legacyId, name)
    );
};

const createOfficeAssignmentTeam = (): Team => ({
    id: OFFICE_ASSIGNMENT_TEAM_ID,
    legacyId: OFFICE_ASSIGNMENT_TEAM_ID,
    name: OFFICE_ASSIGNMENT_TEAM_NAME,
    type: OFFICE_ASSIGNMENT_TEAM_NAME,
    companyName: OFFICE_ASSIGNMENT_TEAM_NAME,
    status: 'active',
    color: '#64748b',
    icon: 'fa-building',
    iconKey: 'fa-building',
    memberCount: 0,
    memberIds: [],
    memberNames: [],
    siteIds: [],
    siteNames: [],
    assignedWorkers: []
});

export const appendOfficeAssignmentTeam = (teams: Team[], sourceTeams: Team[] = teams): Team[] => {
    if (teams.some(isOfficeAssignmentTeam)) return teams;

    const existingOfficeTeam = sourceTeams.find(isOfficeAssignmentTeam);
    return [...teams, existingOfficeTeam ?? createOfficeAssignmentTeam()];
};

export const getOfficeStaffAssignmentId = (staff: OfficeStaff): string => (
    String(staff.id ?? '').trim() ||
    String(staff.legacyId ?? '').trim() ||
    String(staff.uid ?? '').trim() ||
    String(staff.name ?? '').trim()
);

export const getOfficeStaffAssignmentKeys = (staff: OfficeStaff): string[] => (
    Array.from(new Set([
        getOfficeStaffAssignmentId(staff),
        String(staff.id ?? '').trim(),
        String(staff.legacyId ?? '').trim(),
        String(staff.uid ?? '').trim(),
        String(staff.name ?? '').trim()
    ].filter(Boolean)))
);

export const isOfficeStaffAssignmentReference = (
    officeStaffRows: OfficeStaff[],
    assigneeId?: unknown,
    assigneeName?: unknown
): boolean => {
    const normalizedReferences = [
        normalizeTargetText(assigneeId),
        normalizeTargetText(assigneeName)
    ].filter(Boolean);

    if (normalizedReferences.length === 0) return false;

    return officeStaffRows.some((staff) => (
        getOfficeStaffAssignmentKeys(staff)
            .map((key) => normalizeTargetText(key))
            .some((key) => normalizedReferences.includes(key))
    ));
};

export const buildOfficeStaffAssignmentOptions = (officeStaffRows: OfficeStaff[]): OfficeStaffAssignmentOption[] => (
    officeStaffRows
        .filter((staff) => staff.isActive !== false)
        .map((staff): OfficeStaffAssignmentOption | null => {
            const id = getOfficeStaffAssignmentId(staff);
            const name = String(staff.name ?? '').trim();
            if (!id || !name) return null;

            return {
                id,
                name,
                teamId: OFFICE_ASSIGNMENT_TEAM_ID,
                teamName: OFFICE_ASSIGNMENT_TEAM_NAME,
                source: 'office_staff',
                detail: String(staff.department || staff.role || '').trim() || undefined
            };
        })
        .filter((staff): staff is OfficeStaffAssignmentOption => staff !== null)
        .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'))
);
