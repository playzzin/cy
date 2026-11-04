import type { Vehicle } from '../../types/vehicle';
import type { Team } from '../../services/teamService';
import type { Worker } from '../../services/manpowerService';
import type { OfficeStaff } from '../../services/officeStaffService';
import { isOfficeStaffAssignmentReference, OFFICE_ASSIGNMENT_TEAM_ID, OFFICE_ASSIGNMENT_TEAM_NAME } from '../../utils/supportAssignmentTargets';
import { findRepairVehicle } from './model';

export interface RepairVehicleLink { vehicleId: string; teamId: string; teamName: string }

export function resolveRepairVehicle(plate: string, vehicles: Vehicle[], teams: Team[], workers: Worker[], officeStaff: OfficeStaff[]): RepairVehicleLink {
  const vehicle = findRepairVehicle(plate, vehicles);
  const link = { vehicleId: vehicle?.id ?? '', teamId: '', teamName: '' };
  if (!vehicle) return link;
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
      return { ...link, teamId: OFFICE_ASSIGNMENT_TEAM_ID, teamName: OFFICE_ASSIGNMENT_TEAM_NAME };
    }
    teamId = worker?.teamId?.trim() ?? '';
    teamName = worker?.teamName?.trim() ?? '';
    if (!teamId && !teamName) {
      const ids = [id, worker?.id, worker?.legacyId, worker?.uid].filter(Boolean);
      const memberships = teams.filter(team => [team.leaderId, ...(team.memberIds ?? [])].some(key => key && ids.includes(key)));
      if (memberships.length === 1) return { ...link, teamId: memberships[0].id || '', teamName: memberships[0].name };
    }
  }
  const team = teamId ? teams.find(item => item.id === teamId || item.legacyId === teamId)
    : teamName ? teams.find(item => item.name === teamName) : undefined;
  return { ...link, teamId: team?.id || teamId, teamName: team?.name || teamName };
}
