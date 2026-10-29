import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import type { TeamAccommodationBoard, TeamAccommodationChange } from '../types/teamAccommodationBoard';

let sample: TeamAccommodationBoard | null = null;
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function sampleBoard(teamId = '__all__'): TeamAccommodationBoard {
    if (!sample) sample = {
        canManageAll: true, teamId: '__all__', teams: [{ id: 'sample-team', name: '샘플 시공팀' }, { id: 'sample-team-b', name: '샘플 지원팀' }],
        date: new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10), revision: 'sample-0',
        rooms: [
            { id: 'sample-one', name: '햇살빌라 201호', address: '샘플 주소 · 현장 도보 5분', type: 'OneRoom' },
            { id: 'sample-two', name: '푸른하우스 302호', address: '샘플 주소 · 현장 도보 10분', type: 'TwoRoom' },
            { id: 'sample-three', name: '나무빌라 401호', address: '샘플 주소 · 현장 차량 5분', type: 'ThreeRoom' },
        ],
        workers: [
            { id: 'sample-w1', name: '샘플 작업자 가', role: '기공', teamId: 'sample-team', teamName: '샘플 시공팀', accommodationId: null },
            { id: 'sample-w2', name: '샘플 작업자 나', role: '조공', teamId: 'sample-team-b', teamName: '샘플 지원팀', accommodationId: null },
            { id: 'sample-w3', name: '샘플 작업자 다', role: '기공', teamId: 'sample-team', teamName: '샘플 시공팀', accommodationId: 'sample-one' },
            { id: 'sample-w4', name: '샘플 작업자 라', role: '조공', teamId: 'sample-team-b', teamName: '샘플 지원팀', accommodationId: 'sample-two' },
            { id: 'sample-w5', name: '샘플 작업자 마', role: '기공', teamId: 'sample-team', teamName: '샘플 시공팀', accommodationId: 'sample-two' },
            { id: 'sample-w6', name: '샘플 작업자 바', role: '조공', teamName: '소속 미지정', accommodationId: 'sample-three' },
        ],
    };
    return copy({ ...sample, teamId, workers: sample.workers.filter(worker => teamId === '__all__' || worker.teamId === teamId) });
}

export const teamAccommodationBoardService = {
    async load(teamId?: string): Promise<TeamAccommodationBoard> {
        if (isDevAdminSessionEnabled()) return sampleBoard(teamId);
        const response = await httpsCallable<{ teamId?: string }, TeamAccommodationBoard>(functions, 'getTeamAccommodationBoard')({ ...(teamId ? { teamId } : {}) });
        return response.data;
    },
    async save(board: TeamAccommodationBoard, changes: TeamAccommodationChange[]): Promise<void> {
        if (isDevAdminSessionEnabled()) {
            const current = sampleBoard();
            if (current.revision !== board.revision) throw new Error('샘플 배정이 변경되었습니다. 새로고침해 주세요.');
            sample = { ...current, revision: `sample-${Date.now()}`, workers: current.workers.map(worker => {
                const change = changes.find(item => item.workerId === worker.id);
                return change ? { ...worker, accommodationId: change.accommodationId } : worker;
            }) };
            return;
        }
        await httpsCallable(functions, 'saveTeamAccommodationBoard')({ teamId: board.teamId, revision: board.revision, changes });
    },
};
