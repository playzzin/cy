import type { AccommodationBillingDocument, AccommodationBillingLineItem } from '../types/accommodationBilling';
import type { AccommodationBillingTarget } from '../types/accommodationBillingTarget';
import type { AccommodationAssignment } from '../types/accommodationAssignment';

type Room = { id: string; name: string; legacyId?: string };
type Team = { id?: string; name?: string; legacyId?: string };
type Scope = { targets: AccommodationBillingTarget[]; assignments: AccommodationAssignment[]; rooms: Room[]; teams: Team[] };
const clean = (value: unknown) => String(value ?? '').trim();
const utilityName = /^(.*?)\s+(?:월세|전기세|전기료|가스비|가스요금|수도세|수도요금|인터넷|관리비|기타)(?:\s+\d{4}-\d{2}-\d{2}\s*~\s*\d{4}-\d{2}-\d{2})?$/;

/** Only verified team charges belong in team settlement; personal bills remain in payroll. */
export function filterTeamSettlementAccommodationBillings(documents: AccommodationBillingDocument[], scope: Scope): AccommodationBillingDocument[] {
  const teamKey = (id: unknown, name: unknown): string => {
    const rawId = clean(id);
    const matches = scope.teams.filter(team => rawId ? [team.id, team.legacyId].some(value => clean(value) === rawId)
      : clean(name) && clean(team.name) === clean(name));
    if (matches.length === 1) return clean(matches[0].id);
    return rawId ? `id:${rawId}` : matches.length === 0 && clean(name) ? `name:${clean(name)}` : '';
  };
  const roomForLine = (line: AccommodationBillingLineItem) => {
    const id = clean(line.sourceAccommodationId);
    const name = !id && (line.sourceType === 'utility_ledger' || line.id.startsWith('utility-')) ? utilityName.exec(clean(line.label))?.[1] : '';
    const matches = scope.rooms.filter(room => id ? room.id === id || room.legacyId === id : name && clean(room.name) === name);
    return matches.length === 1 ? matches[0] : undefined;
  };
  const belongsToRoom = (row: { accommodationId: string; accommodationName?: string }, room: Room) => {
    const id = clean(row.accommodationId);
    if (id) return id === room.id || id === room.legacyId;
    return clean(row.accommodationName) === clean(room.name)
      && scope.rooms.filter(item => clean(item.name) === clean(room.name)).length === 1;
  };
  const activeOn = (row: { startDate?: string; endDate?: string }, day: string) =>
    (!row.startDate || row.startDate.slice(0, 10) <= day) && (!row.endDate || row.endDate.slice(0, 10) >= day);

  return documents.filter(bill => ['team', 'team_leader'].includes(clean(bill.issuedToType).toLowerCase())
    && !clean(bill.issuedToWorkerId)).map(bill => {
    const expectedTeam = teamKey(bill.teamId, bill.teamName);
    const [year, month] = bill.yearMonth.split('-').map(Number);
    const days = Array.from({ length: new Date(year, month, 0).getDate() }, (_, index) => `${bill.yearMonth}-${String(index + 1).padStart(2, '0')}`);
    const lineItems = bill.lineItems.filter(line => {
      const room = roomForLine(line);
      if (!room || !expectedTeam) return false;
      const targets = scope.targets.filter(target => belongsToRoom(target, room));
      const assignments = scope.assignments.filter(assignment => belongsToRoom(assignment, room)
        && !(assignment.status === 'ended' && !assignment.endDate));
      const range = /(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})$/.exec(clean(line.label));
      const chargedDays = range ? days.filter(day => day >= range[1] && day <= range[2]) : days;
      return chargedDays.length > 0 && chargedDays.every(day => {
        const activeTargets = targets.filter(target => activeOn(target, day));
        if (activeTargets.length) {
          const latestStart = activeTargets.map(target => clean(target.startDate)).sort().at(-1);
          return activeTargets.filter(target => clean(target.startDate) === latestStart).every(target =>
            target.targetType === 'team' && teamKey(target.teamId, target.teamName) === expectedTeam);
        }
        // The accommodation screen uses the assignment as its target only when no separate target applies.
        const activeAssignments = assignments.filter(assignment => activeOn(assignment, day));
        return activeAssignments.length > 0 && activeAssignments.every(assignment =>
          (!assignment.source || assignment.source === 'team') && teamKey(assignment.teamId, assignment.teamName) === expectedTeam);
      });
    });
    return { ...bill, lineItems };
  }).filter(bill => bill.lineItems.length > 0);
}
