import type { Worker } from '../services/manpowerService';
import type { Team } from '../services/teamService';
import type { Company } from '../services/companyService';
import { buildTeamIdsByAffiliation, classifyWorkerAffiliation, isCheongyeonEngCompanyName } from './cheongyeonTeams';

const key = (value: unknown) => String(value ?? '').trim();

export const isCurrentVehicleDriver = (person: { status?: string; isActive?: boolean }): boolean => (
    person.isActive !== false && !['퇴사', 'inactive', 'retired', 'terminated', '출입금지'].includes(key(person.status).toLowerCase())
);

/** Filter selection candidates only; keep the full worker directory for past assignments. */
export function getEligibleVehicleDrivers(workers: Worker[], teams: Team[], companies: Company[]): Worker[] {
    const companyIds = new Set(companies
        .filter(company => isCheongyeonEngCompanyName(company.name) || isCheongyeonEngCompanyName(company.code))
        .flatMap(company => [key(company.id), key(company.legacyId)]).filter(Boolean));
    const teamIds = buildTeamIdsByAffiliation(teams, companies, 'cheongyeon');
    return workers.filter(worker => {
        if (!isCurrentVehicleDriver(worker)) return false;
        const affiliation = classifyWorkerAffiliation(worker, companyIds);
        if (affiliation === 'cheongyeon') return true;
        if (affiliation === 'external') return false;
        // Older workers may carry a team reference without a company snapshot.
        return Boolean(key(worker.teamId) && teamIds.has(key(worker.teamId)));
    }).sort((left, right) => key(left.name).localeCompare(key(right.name), 'ko-KR'));
}
