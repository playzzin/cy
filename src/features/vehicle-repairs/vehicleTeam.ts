import type { Vehicle } from '../../types/vehicle';
import type { Team } from '../../services/teamService';
import type { Worker } from '../../services/manpowerService';
import type { OfficeStaff } from '../../services/officeStaffService';
import { isOfficeAssignmentTeam, isOfficeStaffAssignmentReference, OFFICE_ASSIGNMENT_TEAM_ID, OFFICE_ASSIGNMENT_TEAM_NAME } from '../../utils/supportAssignmentTargets';
import { findRepairVehicle, type RepairRecord } from './model';

type TeamFields = Pick<RepairRecord, 'teamId' | 'teamName' | 'teamColor' | 'teamIcon'>;
export type RepairTeam = Required<TeamFields>;
export type RepairVehicleLink = RepairTeam & { vehicleId: string };

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export function resolveRepairTeam(ref: TeamFields, teams: Team[]): RepairTeam {
  let team = ref.teamId ? teams.find(item => item.id === ref.teamId || item.legacyId === ref.teamId) : undefined;
  if (!team && ref.teamId === OFFICE_ASSIGNMENT_TEAM_ID) team = teams.find(isOfficeAssignmentTeam);
  if (!ref.teamId && ref.teamName) {
    const matches = teams.filter(item => item.name === ref.teamName);
    if (matches.length === 1) team = matches[0];
  }
  return {
    teamId: team?.id || ref.teamId || '', teamName: team?.name || ref.teamName || '',
    teamColor: text(team ? team.color : ref.teamColor),
    teamIcon: team ? text(team.iconKey) || text(team.icon) : text(ref.teamIcon),
  };
}

export function resolveRepairVehicle(plate: string, vehicles: Vehicle[], teams: Team[], workers: Worker[], officeStaff: OfficeStaff[]): RepairVehicleLink {
  const vehicle = findRepairVehicle(plate, vehicles);
  if (!vehicle) return { vehicleId: '', teamId: '', teamName: '', teamColor: '', teamIcon: '' };
  const linkTeam = (teamId: string, teamName: string) => ({ vehicleId: vehicle.id, ...resolveRepairTeam({ teamId, teamName }, teams) });
  const id = vehicle.currentAssigneeId?.trim() ?? '';
  const name = vehicle.currentAssigneeName?.trim() ?? '';
  let teamId = '', teamName = '';
  if (vehicle.currentAssigneeType === 'TEAM') {
    teamId = id;
    teamName = name;
  } else if (vehicle.currentAssigneeType === 'WORKER') {
    const byId = id ? workers.find(worker => [worker.id, worker.legacyId, worker.uid].includes(id)) : undefined;
    const names = !id && name ? workers.filter(worker => worker.name === name) : [];
    const worker = byId || (names.length === 1 ? names[0] : undefined);
    if (!worker && isOfficeStaffAssignmentReference(officeStaff, id, id ? '' : name)) {
      return linkTeam(OFFICE_ASSIGNMENT_TEAM_ID, OFFICE_ASSIGNMENT_TEAM_NAME);
    }
    teamId = worker?.teamId?.trim() ?? '';
    teamName = worker?.teamName?.trim() ?? '';
    if (!teamId && !teamName) {
      const ids = [id, worker?.id, worker?.legacyId, worker?.uid].filter(Boolean);
      const memberships = teams.filter(team => [team.leaderId, ...(team.memberIds ?? [])].some(key => key && ids.includes(key)));
      if (memberships.length === 1) return linkTeam(memberships[0].id || '', memberships[0].name);
    }
  }
  return linkTeam(teamId, teamName);
}
