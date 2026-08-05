import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { waitFor } from '@testing-library/react';

let mockCurrentUser: { uid: string; email: string } | null = null;
const mockGetUser = jest.fn();

jest.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({ currentUser: mockCurrentUser }),
}));

jest.mock('../services/userService', () => ({
    userService: { getUser: (...args: unknown[]) => mockGetUser(...args) },
}));

import {
    type WorkerAccessScope,
    useWorkerAccessScope,
    workerAccessMatchesSchedule,
    workerAccessMatchesSite,
} from './useWorkerAccessScope';
import type { Team } from '../services/teamService';
import type { Worker } from '../services/manpowerService';

const makeScope = (overrides: Partial<WorkerAccessScope>): WorkerAccessScope => ({
    loading: false,
    mode: 'self',
    label: '홍길동',
    profile: null,
    viewerWorker: null,
    workerIds: ['worker-1'],
    workerUids: [],
    workerNames: ['홍길동'],
    workerNameKeys: ['홍길동'],
    teamIds: ['team-a'],
    teamNames: ['A팀'],
    teamNameKeys: ['a팀'],
    teamWorkerIds: ['worker-1', 'worker-2'],
    teamWorkerNameKeys: ['홍길동', '김팀원'],
    ...overrides,
});

const renderWorkerScope = async (workers: Worker[], teams: Team[]) => {
    const container = document.createElement('div');
    const root: Root = createRoot(container);
    let currentScope: WorkerAccessScope | null = null;

    const ScopeProbe = () => {
        currentScope = useWorkerAccessScope(workers, teams);
        return null;
    };

    await act(async () => {
        root.render(createElement(ScopeProbe));
    });

    return {
        get current() {
            if (!currentScope) throw new Error('worker access scope was not rendered');
            return currentScope;
        },
        async unmount() {
            await act(async () => root.unmount());
        },
    };
};

describe('worker access scope', () => {
    beforeEach(() => {
        mockCurrentUser = { uid: 'viewer-1', email: 'viewer@example.com' };
        mockGetUser.mockReset();
    });

    it('팀장과 반장은 자기 팀 일정만 볼 수 있다', () => {
        const scope = makeScope({ mode: 'team', label: 'A팀' });

        expect(workerAccessMatchesSchedule(scope, {
            responsibleTeamId: 'team-a',
            workerIds: ['worker-9'],
        })).toBe(true);
        expect(workerAccessMatchesSchedule(scope, {
            responsibleTeamId: 'team-b',
            workerIds: ['worker-2'],
        })).toBe(true);
        expect(workerAccessMatchesSchedule(scope, {
            responsibleTeamId: 'team-b',
            workerIds: ['worker-9'],
        })).toBe(false);
    });

    it('작업자는 본인이 배정된 일정만 볼 수 있다', () => {
        const scope = makeScope({ mode: 'self' });

        expect(workerAccessMatchesSchedule(scope, {
            teamId: 'team-a',
            workerIds: ['worker-1', 'worker-2'],
        })).toBe(true);
        expect(workerAccessMatchesSchedule(scope, {
            teamId: 'team-a',
            workerIds: ['worker-2'],
        })).toBe(false);
    });

    it('작업자는 팀 현장 마스터 전체가 아니라 배정된 일정에서만 현장을 얻는다', () => {
        const scope = makeScope({ mode: 'self' });
        const teamScope = makeScope({ mode: 'team' });

        expect(workerAccessMatchesSite(scope, { responsibleTeamId: 'team-a' })).toBe(false);
        expect(workerAccessMatchesSite(teamScope, { responsibleTeamId: 'team-a' })).toBe(true);
        expect(workerAccessMatchesSite(teamScope, { responsibleTeamId: 'team-b' })).toBe(false);
    });

    it('연결되지 않은 팀장 계정은 전체 범위로 확대되지 않는다', async () => {
        mockGetUser.mockResolvedValue({
            uid: 'viewer-1',
            email: 'viewer@example.com',
            position: '팀장',
            accountType: 'worker',
        });

        const rendered = await renderWorkerScope([], []);

        await waitFor(() => expect(rendered.current.loading).toBe(false));
        expect(rendered.current.mode).toBe('self');
        expect(rendered.current.workerIds).toEqual([]);
        await rendered.unmount();
    });

    it('연결된 팀장 계정은 자신의 팀 범위를 받는다', async () => {
        mockGetUser.mockResolvedValue({
            uid: 'viewer-1',
            email: 'viewer@example.com',
            position: '팀장',
            accountType: 'worker',
            linkedWorkerIds: ['worker-1'],
        });
        const workers = [{
            id: 'worker-1',
            uid: 'viewer-1',
            name: '홍길동',
            role: '팀장',
            teamId: 'team-a',
            teamName: 'A팀',
        }] as Worker[];
        const teams = [{ id: 'team-a', name: 'A팀', type: 'regular', status: 'active' }] as Team[];

        const rendered = await renderWorkerScope(workers, teams);

        await waitFor(() => expect(rendered.current.loading).toBe(false));
        expect(rendered.current.mode).toBe('team');
        expect(rendered.current.teamIds).toContain('team-a');
        await rendered.unmount();
    });
});
