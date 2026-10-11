import type { DelegatedClaim } from './model';
import { getSiteTeam, ReceiptDirectory, validTeamColor } from './teamDirectory';

export interface ReceiptSiteGroup {
    key: string;
    name: string;
    color: string;
    claims: DelegatedClaim[];
}
const normalize = (value: string) => value.normalize('NFKC').replace(/\s+/g, '').toLowerCase();

export function groupClaimsBySite(claims: DelegatedClaim[], directory: ReceiptDirectory): ReceiptSiteGroup[] {
    const groups = new Map<string, ReceiptSiteGroup>();
    for (const claim of claims) {
        const matches = directory.sites.filter(site => normalize(site.name) === normalize(claim.siteName));
        const siteId = claim.siteId || (matches.length === 1 ? matches[0].id : undefined);
        // An explicit site ID wins; ambiguous legacy names stay in a separate group.
        const key = JSON.stringify([claim.month, siteId ? 'id' : 'name', siteId || normalize(claim.siteName)]);
        let group = groups.get(key);
        if (!group) {
            group = { key, name: directory.sites.find(site => site.id === siteId)?.name || claim.siteName, color: validTeamColor(), claims: [] };
            groups.set(key, group);
        }
        group.claims.push(claim);
    }
    return [...groups.values()].map(group => {
        const teams = new Map(group.claims.map(claim => getSiteTeam(claim, directory)).filter(team => team !== undefined).map(team => [team.id, team]));
        // Conflicting team assignments must not borrow an arbitrary team's color.
        const color = teams.size === 1 ? validTeamColor([...teams.values()][0].color) : validTeamColor();
        return { ...group, color, claims: [...group.claims].sort((a, b) => a.workerName.localeCompare(b.workerName, 'ko') || a.id.localeCompare(b.id)) };
    }).sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.key.localeCompare(b.key));
}
