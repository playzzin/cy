import { teamFirestoreService } from './teamFirestoreService';
import { TeamZod as Team } from '../types/zod/teamSchema';
import { db } from '../config/firebase';
import { doc, updateDoc, Timestamp, writeBatch } from 'firebase/firestore';

export type { Team };

export const teamService = {
    addTeam: async (team: Team): Promise<string> => {
        const normalizedTeam: Team = { ...team };
        if (typeof normalizedTeam.iconKey !== 'string') {
            normalizedTeam.iconKey = '';
        }
        if (!normalizedTeam.iconKey && typeof (normalizedTeam as any).icon === 'string') {
            normalizedTeam.iconKey = (normalizedTeam as any).icon;
        }

        return teamFirestoreService.addTeam(normalizedTeam as any);
    },

    updateTeam: async (id: string, team: Partial<Team>): Promise<void> => {
        const existing = await teamFirestoreService.getTeam(id);
        const nameChanged = team.name && existing && existing.name !== team.name;

        const normalizedUpdates: Partial<Team> = { ...team };
        if (typeof normalizedUpdates.iconKey !== 'string' && normalizedUpdates.iconKey !== undefined) {
            delete normalizedUpdates.iconKey;
        }
        if (!normalizedUpdates.iconKey && typeof (normalizedUpdates as any).icon === 'string') {
            normalizedUpdates.iconKey = (normalizedUpdates as any).icon;
        }

        await teamFirestoreService.updateTeam(id, normalizedUpdates);

        // Sync team name to workers
        if (nameChanged && team.name) {
            try {
                const { manpowerService } = await import('./manpowerService');
                await manpowerService.updateWorkersTeamName(id, team.name);
            } catch (e) {
                console.error("Failed to sync team name to workers:", e);
            }
        }
    },

    deleteTeam: async (id: string): Promise<void> => {
        return teamFirestoreService.deleteTeam(id);
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
        const batch = writeBatch(db);
        ids.forEach(id => {
            const docRef = doc(db, 'teams', id);
            batch.update(docRef, {
                ...updates,
                updatedAt: Timestamp.now()
            });
        });
        await batch.commit();
    }
};
