import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { buildDevClaimSyncResult, devUsers } from '../utils/devAdminFixtures';

export interface SyncUserAccessClaimsResult {
  uid: string;
  role: string;
  position: string;
  systemRole: string;
  accountType: string;
  additionalPositions: string[];
  roles: string[];
  erpRoleGroups: string[];
  syncedAt: string;
}

export const userAccessClaimsService = {
  syncUser: async (uid: string): Promise<SyncUserAccessClaimsResult> => {
    const normalizedUid = String(uid || '').trim();
    if (!normalizedUid) {
      throw new Error('uid is required');
    }

    if (isDevAdminSessionEnabled()) {
      return buildDevClaimSyncResult(normalizedUid);
    }

    const callable = httpsCallable<{ uid: string }, SyncUserAccessClaimsResult>(
      functions,
      'syncUserAccessClaims'
    );
    const response = await callable({ uid: normalizedUid });
    return response.data;
  },

  syncAll: async (limit = 100): Promise<{ count: number; limit: number }> => {
    if (isDevAdminSessionEnabled()) {
      return { count: Math.min(devUsers.length, limit), limit };
    }

    const callable = httpsCallable<{ limit: number }, { count: number; limit: number }>(
      functions,
      'syncAllUserAccessClaims'
    );
    const response = await callable({ limit });
    return response.data;
  },
};
