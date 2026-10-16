import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export interface TeamAccountRow {
    linkId: string; workerId: string; name: string; teamId: string; teamName: string; status: 'pending' | 'active';
}
export interface TeamAccountPage { rows: TeamAccountRow[]; teams: Array<{ id: string; name: string }>; nextCursor: string | null }
export interface TeamApprovalResult { linkId: string; status: 'active' | 'failed'; claimsPending?: boolean; reused?: boolean; code?: string; message?: string }
const call = async <T,>(data: unknown): Promise<T> => (await httpsCallable<unknown, T>(functions, 'teamAccountApprovals')(data)).data;
export const teamAccountApprovalService = {
    list: (cursor?: string) => call<TeamAccountPage>({ action: 'list', ...(cursor ? { cursor } : {}) }),
    approve: (linkIds: string[]) => call<{ results: TeamApprovalResult[] }>({ action: 'approve', linkIds }),
};
