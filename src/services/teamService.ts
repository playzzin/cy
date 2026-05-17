import { teamFirestoreService } from './teamFirestoreService';
import { databaseLogService } from './databaseLogService';
import { TeamZod as Team } from '../types/zod/teamSchema';
import { db } from '../config/firebase';
import { doc, updateDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';

export type { Team };

const snapshotTeam = (id: string, data: Record<string, unknown>): Record<string, unknown> => ({
    id,
    ...stripUndefinedFields(data),
});

const logTeamChange = async (
    action: 'created' | 'updated' | 'deleted',
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    source = 'teamService'
): Promise<void> => {
    await databaseLogService.safeCreateLog({
        action,
        entityType: 'team',
        before,
        after,
        source,
    });
};

export const teamService = {
    addTeam: async (team: Team): Promise<string> => {
        const normalizedTeam: Team = { ...team };
        if (typeof normalizedTeam.iconKey !== 'string') {
            normalizedTeam.iconKey = '';
        }
        if (!normalizedTeam.iconKey && typeof (normalizedTeam as any).icon === 'string') {
            normalizedTeam.iconKey = (normalizedTeam as any).icon;
        }

        const id = await teamFirestoreService.addTeam(normalizedTeam as any);
        await logTeamChange('created', null, snapshotTeam(id, normalizedTeam as Record<string, unknown>), 'teamService.addTeam');
        return id;
    },

    updateTeam: async (id: string, team: Partial<Team>): Promise<void> => {
        const existing = await teamFirestoreService.getTeam(id);
        const nameChanged = team.name && existing && existing.name !== team.name;
        const colorChanged = team.color && existing && existing.color !== team.color;

        const normalizedUpdates: Partial<Team> = { ...team };
        if (typeof normalizedUpdates.iconKey !== 'string' && normalizedUpdates.iconKey !== undefined) {
            delete normalizedUpdates.iconKey;
        }
        if (!normalizedUpdates.iconKey && typeof (normalizedUpdates as any).icon === 'string') {
            normalizedUpdates.iconKey = (normalizedUpdates as any).icon;
        }

        await teamFirestoreService.updateTeam(id, normalizedUpdates);
        await logTeamChange(
            'updated',
            existing ? snapshotTeam(id, existing as Record<string, unknown>) : null,
            snapshotTeam(id, { ...(existing ? existing as Record<string, unknown> : {}), ...stripUndefinedFields(normalizedUpdates as Record<string, unknown>) }),
            'teamService.updateTeam'
        );

        // Sync team name to workers
        if (nameChanged && team.name) {
            try {
                const { manpowerService } = await import('./manpowerService');
                await manpowerService.updateWorkersTeamName(id, team.name);
            } catch (e) {
                console.error("Failed to sync team name to workers:", e);
            }
        }

        if (colorChanged && team.color) {
            try {
                const [{ manpowerService }, { siteService }] = await Promise.all([
                    import('./manpowerService'),
                    import('./siteService')
                ]);
                await Promise.all([
                    manpowerService.updateWorkersTeamColor(id, team.color),
                    siteService.updateSitesColorByResponsibleTeam(id, team.color, team.name || existing?.name)
                ]);
            } catch (e) {
                console.error("Failed to sync team color:", e);
            }
        }
    },

    deleteTeam: async (id: string): Promise<void> => {
        const existing = await teamFirestoreService.getTeam(id);
        await teamFirestoreService.deleteTeam(id);
        await logTeamChange(
            'deleted',
            existing ? snapshotTeam(id, existing as Record<string, unknown>) : null,
            null,
            'teamService.deleteTeam'
        );
    },

    getTeams: async (): Promise<Team[]> => {
        return teamFirestoreService.getTeams();
    },

    getTeamByName: async (name: string): Promise<Team | null> => {
        const teams = await teamFirestoreService.getTeams();
        return teams.find(t => t.name === name) || null;
    },

    getTeam: async (id: string): Promise<Team | null> => {
        return teamFirestoreService.getTeam(id);
    },

    getTeamsPaginated: async (limitCount: number, lastDoc: any = null): Promise<{ teams: Team[], lastDoc: any }> => {
        const { query, collection, orderBy, limit, startAfter, getDocs } = await import('firebase/firestore');
        let q = query(collection(db, 'teams'), orderBy('createdAt', 'desc'), limit(limitCount));
        if (lastDoc) {
            q = query(collection(db, 'teams'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(limitCount));
        }
        const snap = await getDocs(q);
        return {
            teams: snap.docs.map(d => ({ id: d.id, ...d.data() } as Team)),
            lastDoc: snap.docs[snap.docs.length - 1]
        };
    },

    incrementManDay: async (teamId: string, amount: number): Promise<void> => {
        await teamFirestoreService.incrementManDay(teamId, amount);
    },

    updateTeamsBatch: async (ids: string[], updates: Partial<Team>): Promise<void> => {
        const beforeRows = await Promise.all(ids.map(async (id) => {
            const team = await teamFirestoreService.getTeam(id);
            return team ? snapshotTeam(id, team as Record<string, unknown>) : null;
        }));
        const cleanedUpdates = stripUndefinedFields(updates as Record<string, unknown>);
        const updatedAt = Timestamp.now();
        const batch = writeBatch(db);
        ids.forEach(id => {
            const docRef = doc(db, 'teams', id);
            batch.update(docRef, {
                ...cleanedUpdates,
                updatedAt
            });
        });
        await batch.commit();
        await Promise.all(beforeRows.map((before) =>
            before
                ? logTeamChange(
                    'updated',
                    before,
                    { ...before, ...cleanedUpdates, updatedAt },
                    'teamService.updateTeamsBatch'
                )
                : Promise.resolve()
        ));
    }
};
