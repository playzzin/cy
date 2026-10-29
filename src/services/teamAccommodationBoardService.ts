import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import type { TeamAccommodationBoard, TeamAccommodationChange, TeamAccommodationRoomChange } from '../types/teamAccommodationBoard';

function requireRealSession() {
    if (isDevAdminSessionEnabled()) throw new Error('실제 계정으로 로그인한 뒤 숙소를 배정해 주세요.');
}

export const teamAccommodationBoardService = {
    async load(teamId?: string): Promise<TeamAccommodationBoard> {
        requireRealSession();
        const response = await httpsCallable<{ teamId?: string }, TeamAccommodationBoard>(functions, 'getTeamAccommodationBoard')({ ...(teamId ? { teamId } : {}) });
        return response.data;
    },
    async save(board: TeamAccommodationBoard, changes: TeamAccommodationChange[], roomChanges: TeamAccommodationRoomChange[] = []): Promise<void> {
        requireRealSession();
        await httpsCallable(functions, 'saveTeamAccommodationBoard')({ teamId: board.teamId, revision: board.revision, changes, ...(roomChanges.length ? { roomChanges } : {}) });
    },
};
