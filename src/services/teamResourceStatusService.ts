import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../config/firebase';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { invalidateWorkerCache } from '../utils/workerCacheRevision';
import { invalidateTeamScopedCache } from './teamScopedReadService';
import { notifyResourceStatusChange, ResourceStatusChange } from '../utils/resourceStatusChange';

export type TeamResourceStatus = 'active' | 'completed' | '재직' | '퇴사';
export type TeamResourceStatusResult = { id: string; status: TeamResourceStatus; isActive?: boolean };
export type TeamResourceStatusRequest = {
    kind: 'site' | 'worker';
    id: string;
    status: TeamResourceStatus;
    expectedStatus: string | null;
    expectedIsActive: boolean | null;
};

export const teamResourceStatusService = {
    async update(input: TeamResourceStatusRequest): Promise<TeamResourceStatusResult> {
        if (isDevAdminSessionEnabled()) throw new Error('개발용 샘플 계정에서는 상태를 변경할 수 없습니다.');
        const user = auth.currentUser;
        if (!user) throw new Error('로그인이 필요합니다.');
        let updated: TeamResourceStatusResult;
        try {
            const result = await httpsCallable<TeamResourceStatusRequest, TeamResourceStatusResult>(functions, 'updateTeamResourceStatus')(input);
            if (auth.currentUser !== user) throw new Error('로그인 계정이 변경되었습니다. 다시 조회해 주세요.');
            updated = result.data;
        } finally {
            invalidateTeamScopedCache();
            if (input.kind === 'worker') invalidateWorkerCache();
        }
        // 성공한 결과만 전달하며, 구독자가 재조회하기 전에 캐시를 먼저 무효화합니다.
        notifyResourceStatusChange({ ...updated, kind: input.kind } as ResourceStatusChange);
        return updated;
    },
};
