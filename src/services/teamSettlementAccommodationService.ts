import { accommodationBillingService } from './accommodationBillingService';
import { accommodationBillingTargetService } from './accommodationBillingTargetService';
import { accommodationAssignmentService } from './accommodationAssignmentService';
import { accommodationService } from './accommodationService';
import { teamService } from './teamService';
import { filterTeamSettlementAccommodationBillings } from '../utils/teamSettlementAccommodationScope';

export async function getTeamSettlementAccommodationBillings(yearMonth: string) {
  const documents = await accommodationBillingService.getBillingDocuments({ teamId: 'all', yearMonth, strict: true });
  if (!documents.length) return [];
  // Do not substitute an empty target list when a source read fails.
  const [targets, assignments, rooms, teams] = await Promise.all([
    accommodationBillingTargetService.listTargets(), accommodationAssignmentService.getAllAssignments(),
    accommodationService.getAccommodations(), teamService.getTeams()
  ]);
  return filterTeamSettlementAccommodationBillings(documents, { targets, assignments, rooms, teams });
}
