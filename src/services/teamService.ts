import { db } from '../config/firebase';
import { toast } from '../utils/swal';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, Timestamp, query, orderBy, increment, limit, startAfter, where, getDoc } from 'firebase/firestore';

export interface Team {
    id?: string;
    name: string;
    type: string;
    leaderId: string; // Worker ID
    leaderName: string; // Denormalized
    companyId?: string; // 소속 회사 ID
    companyName?: string; // 회사명
    parentTeamId?: string; // 상위 팀 ID (새끼팀일 경우)
    parentTeamName?: string; // 상위 팀명
    memberCount?: number;
    assignedWorkers?: string[]; // 배정된 작업자 ID 배열 (Legacy)
    memberIds?: string[]; // 팀원 IDs
    memberNames?: string[]; // 팀원 이름들
    assignedSiteId?: string; // 배정된 현장 ID (Legacy)
    assignedSiteName?: string; // 배정된 현장명 (Legacy)
    siteIds?: string[]; // 배정된 현장 IDs
    siteNames?: string[]; // 배정된 현장 이름들
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    totalManDay?: number; // 누적 공수
    status?: 'active' | 'waiting' | 'closed'; // 협업중 | 대기 | 폐업
    supportRate?: number; // 지원비 단가
    supportModel?: 'man_day' | 'fixed'; // 지원비 방식 (공수제 | 고정급)
    supportDescription?: string; // 지원비 비고
    serviceRate?: number; // 용역비 단가
    serviceModel?: 'man_day' | 'fixed'; // 용역비 방식 (공수제 | 고정급)
    serviceDescription?: string; // 용역비 비고
    defaultSalaryModel?: string; // 팀 기본 급여방식/지급구분
    color?: string; // 팀 식별용 색상 (HEX)
    icon?: string; // 팀 아이콘 (FontAwesome 아이콘명)
    iconKey?: string;
    role?: string; // 직종 (e.g., 목수, 철근)
}

const COLLECTION_NAME = 'teams';

export const teamService = {
    addTeam: async (team: Team): Promise<string> => {
        const normalizedTeam: Team = { ...team };
        if (typeof normalizedTeam.iconKey !== 'string') {
            normalizedTeam.iconKey = '';
        }
        if (!normalizedTeam.iconKey && typeof normalizedTeam.icon === 'string') {
            normalizedTeam.iconKey = normalizedTeam.icon;
        }

        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...normalizedTeam,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
        toast.saved('팀', 1);
        return docRef.id;
    },

    updateTeam: async (id: string, team: Partial<Team>): Promise<void> => {
        const docRef = doc(db, COLLECTION_NAME, id);

        const normalizedUpdates: Partial<Team> = { ...team };
        if (typeof normalizedUpdates.iconKey !== 'string') {
            delete normalizedUpdates.iconKey; // undefined 대신 삭제
        }
        if (!normalizedUpdates.iconKey && typeof normalizedUpdates.icon === 'string') {
            normalizedUpdates.iconKey = normalizedUpdates.icon;
        }

        // 1. Check if name is changing
        // To be strictly safe and avoid extra reads if not needed, we could just check if 'team.name' exists.
        // But comparing with old name is better to avoid redundant batch writes.
        let nameChanged = false;
        if (team.name) {
            const snap = await getDoc(docRef);
            if (snap.exists() && snap.data().name !== team.name) {
                nameChanged = true;
            }
        }

        // undefined 필드 제거
        const cleanUpdates: any = {};
        Object.keys(normalizedUpdates).forEach(key => {
            const value = (normalizedUpdates as any)[key];
            if (value !== undefined) {
                cleanUpdates[key] = value;
            }
        });

        await updateDoc(docRef, {
            ...cleanUpdates,
            updatedAt: Timestamp.now()
        });
        toast.updated('팀');

        // 2. Sync
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
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        toast.deleted('팀', 1);
    },

    getTeams: async (): Promise<Team[]> => {
        const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Team));
    },

    // 팀명으로 조회
    getTeamByName: async (name: string): Promise<Team | null> => {
        const q = query(collection(db, COLLECTION_NAME), where('name', '==', name), limit(1));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return null;
        return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Team;
    },

    // Get teams (Paginated)
    getTeamsPaginated: async (limitCount: number, lastDoc: any = null): Promise<{ teams: Team[], lastDoc: any }> => {
        try {
            let q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(limitCount));
            if (lastDoc) {
                q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(limitCount));
            }
            const querySnapshot = await getDocs(q);
            const teams = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Team));
            return {
                teams,
                lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1]
            };
        } catch (error) {
            console.error("Error fetching teams paginated:", error);
            throw error;
        }
    },

    // Increment total man-day for a team
    incrementManDay: async (teamId: string, amount: number): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, teamId);
            await updateDoc(docRef, {
                totalManDay: increment(amount),
                updatedAt: Timestamp.now()
            });
        } catch (error) {
            console.error(`Error incrementing man-day for team ${teamId}:`, error);
        }
    },

    // Update multiple teams
    updateTeamsBatch: async (ids: string[], updates: Partial<Team>): Promise<void> => {
        try {
            const { writeBatch } = await import('firebase/firestore');
            const batch = writeBatch(db);
            ids.forEach(id => {
                const docRef = doc(db, COLLECTION_NAME, id);
                batch.update(docRef, {
                    ...updates,
                    updatedAt: Timestamp.now()
                });
            });
            await batch.commit();
            toast.updated('팀');
        } catch (error) {
            console.error("Error updating teams batch:", error);
            throw error;
        }
    }
};
