import { TeamRow, text } from './teamReadPolicy';

/** Current assignment wins over billing and historical assignment records. */
export function projectTeamVehicleOil(vehicles: TeamRow[], workers: TeamRow[], teams: TeamRow[], metrics: any) {
    const byId = (rows: TeamRow[], id: unknown) => rows.find(row => [row.id, text(row.legacyId)].filter(Boolean).includes(text(id)));
    const distance = (value: unknown, fallback = 0) => {
        const number = Number(value ?? fallback);
        return Number.isFinite(number) && number >= 0 ? number : fallback;
    };
    return vehicles.flatMap(vehicle => {
        if (vehicle.status === 'DISPOSED') return [];
        const type = text(vehicle.currentAssigneeType || vehicle.billingTargetType).toUpperCase();
        const id = vehicle.currentAssigneeType ? vehicle.currentAssigneeId : vehicle.billingTargetId;
        const teamId = type === 'TEAM' ? id : type === 'WORKER' ? byId(workers, id)?.teamId : undefined;
        const team = byId(teams, teamId);
        if (!team) return [];
        const metric = metrics?.[vehicle.id];
        return [{
            id: vehicle.id,
            plate: text(vehicle.licensePlate) || '-',
            team: text(team.name),
            teamColor: /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(text(team.color)) ? text(team.color) : '#94a3b8',
            currentKm: distance(metric?.currentKm),
            lastOilKm: distance(metric?.lastOilKm),
            cycleKm: distance(metric?.cycleKm, 10000) || 10000,
        }];
    });
}
