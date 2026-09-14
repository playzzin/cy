import { userFirestoreService } from './userFirestoreService';
import { User } from 'firebase/auth';
import { UserRole } from '../types/roles';
import { Timestamp } from 'firebase/firestore';
import {
    AccountRelationRole,
    AccountType,
    resolveAccountTypeFromCompanyType,
} from '../types/accountLink';
import { findBusinessPartnerPositionDefinition } from '../constants/businessPartnerPositions';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import {
    devOfficeStaff,
    devUsers,
    devWorkers,
    updateDevOfficeStaff,
    updateDevUser,
    updateDevWorker,
} from '../utils/devAdminFixtures';

// In-memory cache for user data
const userCache = new Map<string, { data: UserData; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes cache

export interface UserData {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    lastLogin: Timestamp;
    linkedWorkerIds?: string[]; // Array of linked worker IDs
    linkedCompanyIds?: string[]; // Array of linked company IDs
    linkedOfficeStaffIds?: string[]; // Array of linked office staff IDs
    linkedSiteIds?: string[]; // Explicit company/site access scope
    accountType?: AccountType;
    requestedAccountType?: AccountType;
    status?: 'pending' | 'active' | 'rejected' | 'suspended';
    primaryLinkId?: string;
    role?: UserRole | string; // Allow string for legacy roles (e.g. '사장') or new UserRole enum
    department?: string;
    position?: string;
    phoneNumber?: string;
    additionalPositions?: string[]; // 추가 직책 (메뉴 권한 확장용)
    updatedAt?: Timestamp;
}

const parseLinkedWorkerIds = (raw?: any): string[] => {
    if (Array.isArray(raw)) return raw.map(String);
    const value = raw ? String(raw) : '';
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((v) => String(v)).filter(Boolean);
    } catch {
        return [];
    }
};

const serializeLinkedWorkerIds = (ids: string[]): string[] => {
    return Array.from(new Set(ids.map((v) => String(v)).filter(Boolean)));
};

const buildDevUnlinkUserPatch = (
    existing: UserData,
    updates: Pick<UserData, 'linkedWorkerIds' | 'linkedOfficeStaffIds' | 'linkedCompanyIds'>,
    removedLinkId: string
): Partial<UserData> => {
    const hasRemainingLink = [
        ...(updates.linkedWorkerIds || []),
        ...(updates.linkedOfficeStaffIds || []),
        ...(updates.linkedCompanyIds || []),
    ].length > 0;

    return {
        ...updates,
        primaryLinkId: existing.primaryLinkId === removedLinkId ? '' : existing.primaryLinkId,
        ...(hasRemainingLink ? {} : {
            position: '',
            department: '',
            status: 'pending',
            primaryLinkId: '',
            linkedSiteIds: [],
            requestedAccountType: existing.accountType,
        }),
    };
};

const deriveExistingAccountDefaults = (existing: UserData | null | undefined): Partial<UserData> => {
    if (!existing) return {};

    const role = String(existing.role || '').trim().toLowerCase();
    const linkedWorkerIds = parseLinkedWorkerIds(existing.linkedWorkerIds);
    const linkedCompanyIds = parseLinkedWorkerIds(existing.linkedCompanyIds);
    const linkedOfficeStaffIds = parseLinkedWorkerIds(existing.linkedOfficeStaffIds);
    const adminLikeRoles = ['admin', 'administrator', '관리자', '사장', '실장', 'manager', '매니저', '메니저'];
    const updates: Partial<UserData> = {};

    if (!existing.accountType) {
        if (linkedWorkerIds.length > 0) {
            updates.accountType = 'worker';
        } else if (linkedOfficeStaffIds.length > 0) {
            updates.accountType = 'office';
        } else if (linkedCompanyIds.length > 0) {
            updates.accountType = 'partner_company';
        } else if (adminLikeRoles.includes(role)) {
            updates.accountType = 'office';
        }
    }

    if (!existing.status && updates.accountType) {
        updates.status = 'active';
    }

    return updates;
};

const getWorkerLinkKeys = (workerId: string, worker?: { id?: string | null; legacyId?: string | null } | null): string[] => {
    return Array.from(new Set([
        String(workerId || '').trim(),
        String(worker?.id || '').trim(),
        String(worker?.legacyId || '').trim()
    ].filter(Boolean)));
};

const resolveWorkerForLinking = async (workerId: string) => {
    const { manpowerService } = await import('./manpowerService');
    let worker = await manpowerService.getWorker(workerId);
    if (!worker) {
        const workers = await manpowerService.getWorkers(true);
        worker = workers.find((item) => item.id === workerId || item.legacyId === workerId) || null;
    }
    return { manpowerService, worker };
};

const getOfficeStaffLinkKeys = (staffId: string, staff?: { id?: string | null; legacyId?: string | null } | null): string[] => {
    return Array.from(new Set([
        String(staffId || '').trim(),
        String(staff?.id || '').trim(),
        String(staff?.legacyId || '').trim()
    ].filter(Boolean)));
};

const resolveOfficeStaffForLinking = async (staffId: string) => {
    const { officeStaffService } = await import('./officeStaffService');
    let staff = await officeStaffService.getOfficeStaffMember(staffId);
    if (!staff) {
        const rows = await officeStaffService.getOfficeStaff(true);
        staff = rows.find((item) => item.id === staffId || item.legacyId === staffId) || null;
    }
    return { officeStaffService, staff };
};

/**
 * UserService (Facade)
 * Completely migrated to Firestore-only operations.
 */
export const userService = {
    // Save or update user on login
    saveUser: async (user: User): Promise<void> => {
        if (isDevAdminSessionEnabled()) {
            return;
        }

        try {
            const existing = await userFirestoreService.getUser(user.uid);
            const now = new Date();

            const userData: Partial<UserData> = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                lastLogin: Timestamp.fromDate(now),
            };

            if (!existing) {
                userData.role = 'user';
                userData.linkedWorkerIds = [];
                userData.linkedCompanyIds = [];
                userData.linkedOfficeStaffIds = [];
                userData.linkedSiteIds = [];
                userData.status = 'pending';
            } else {
                Object.assign(userData, deriveExistingAccountDefaults(existing));
            }

            await userFirestoreService.saveUser(user.uid, userData);
            userCache.delete(user.uid); // Invalidate cache
        } catch (error) {
            console.error("Error saving user:", error);
            throw error;
        }
    },

    // Get a single user by UID
    getUser: async (uid: string, forceRefresh = false): Promise<UserData | null> => {
        if (isDevAdminSessionEnabled()) {
            return devUsers.find((user) => user.uid === uid) || null;
        }

        const now = Date.now();
        const cached = userCache.get(uid);
        if (!forceRefresh && cached && (now - cached.timestamp < CACHE_TTL)) {
            return cached.data;
        }

        const user = await userFirestoreService.getUser(uid);
        if (user) {
            userCache.set(uid, { data: user, timestamp: now });
        }
        return user;
    },

    // Get all users
    getAllUsers: async (): Promise<UserData[]> => {
        if (isDevAdminSessionEnabled()) {
            return [...devUsers].sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''));
        }

        return userFirestoreService.getAllUsers();
    },

    // Link a user to a worker
    linkUserToWorker: async (uid: string, workerId: string, _actorEmail: string = 'system'): Promise<void> => {
        try {
            const { worker } = await resolveWorkerForLinking(workerId);
            if (!worker?.id) {
                throw new Error('worker-not-found');
            }
            const workerKeys = getWorkerLinkKeys(workerId, worker);
            const { accountLinkService } = await import('./accountLinkService');

            if (isDevAdminSessionEnabled()) {
                const alreadyLinked = devUsers.find((user) =>
                    user.uid !== uid
                    && parseLinkedWorkerIds(user.linkedWorkerIds).some((id) => workerKeys.includes(id))
                );
                if (alreadyLinked || (worker.uid && worker.uid !== uid)) throw new Error('worker-already-managed');
                const existing = devUsers.find((user) => user.uid === uid);
                if (!existing) throw new Error('user-not-found');
                updateDevUser(uid, {
                    linkedWorkerIds: serializeLinkedWorkerIds([...parseLinkedWorkerIds(existing.linkedWorkerIds), worker.id]),
                    accountType: 'worker',
                    status: 'active',
                    primaryLinkId: accountLinkService.getLinkId(uid, 'worker', worker.id),
                    position: worker.role || '일반',
                    department: worker.teamName || '',
                });
                updateDevWorker(worker.id, { uid });
                return;
            }

            await accountLinkService.linkConnection({
                uid,
                entityType: 'worker',
                entityId: worker.id,
                relationRole: 'staff',
            });
            userCache.delete(uid);
        } catch (error) {
            console.error("Error linking user to worker:", error);
            throw error;
        }
    },

    // Unlink a user from a worker
    unlinkUserFromWorker: async (uid: string, workerId: string, _actorEmail: string = 'system'): Promise<void> => {
        try {
            const { worker } = await resolveWorkerForLinking(workerId);
            const workerKeys = getWorkerLinkKeys(workerId, worker);
            const { accountLinkService } = await import('./accountLinkService');
            const canonicalWorkerId = worker?.id || workerId;

            if (isDevAdminSessionEnabled()) {
                const existing = devUsers.find((user) => user.uid === uid);
                if (!existing) return;
                const linkedWorkerIds = parseLinkedWorkerIds(existing.linkedWorkerIds)
                    .filter((id) => !workerKeys.includes(id));
                updateDevUser(uid, buildDevUnlinkUserPatch(existing, {
                    linkedWorkerIds,
                    linkedOfficeStaffIds: parseLinkedWorkerIds(existing.linkedOfficeStaffIds),
                    linkedCompanyIds: parseLinkedWorkerIds(existing.linkedCompanyIds),
                }, accountLinkService.getLinkId(uid, 'worker', canonicalWorkerId)));
                const devWorker = devWorkers.find((row) => workerKeys.includes(String(row.id || '')));
                if (devWorker?.id && devWorker.uid === uid) updateDevWorker(devWorker.id, { uid: '' });
                return;
            }

            await accountLinkService.unlinkConnection({
                uid,
                entityType: 'worker',
                entityId: canonicalWorkerId,
                entityIds: workerKeys,
            });
            userCache.delete(uid);
        } catch (error) {
            console.error("Error unlinking user from worker:", error);
            throw error;
        }
    },

    // Cleanup invalid links
    cleanupInvalidLinks: async (users: UserData[], allWorkerIds: string[]): Promise<void> => {
        try {
            const workerIdSet = new Set(allWorkerIds);
            for (const user of users) {
                const currentLinks = parseLinkedWorkerIds(user.linkedWorkerIds);
                const validLinks = currentLinks.filter(id => workerIdSet.has(id));

                if (validLinks.length !== currentLinks.length) {
                    await userFirestoreService.updateUser(user.uid, { linkedWorkerIds: validLinks });
                }
            }
        } catch (error) {
            console.error("Error cleaning up invalid links:", error);
        }
    },

    // Update user role
    updateUserRole: async (uid: string, role: string): Promise<void> => {
        if (isDevAdminSessionEnabled()) {
            updateDevUser(uid, { role });
            return;
        }

        await userFirestoreService.updateUser(uid, { role } as any);
        userCache.delete(uid); // Invalidate cache
    },

    // Update user profile
    updateUserProfile: async (uid: string, updates: Partial<UserData>): Promise<void> => {
        if (isDevAdminSessionEnabled()) {
            updateDevUser(uid, updates);
            return;
        }

        await userFirestoreService.updateUser(uid, updates);
        userCache.delete(uid); // Invalidate cache
    },

    linkUserToOfficeStaff: async (
        uid: string,
        staffId: string,
        _actorEmail: string = 'system',
        relationRole: AccountRelationRole = 'staff',
        _status: 'pending' | 'active' = 'active'
    ): Promise<void> => {
        const { staff } = await resolveOfficeStaffForLinking(staffId);
        if (!staff?.id) {
            throw new Error('office-staff-not-found');
        }
        const staffKeys = getOfficeStaffLinkKeys(staffId, staff);
        const { accountLinkService } = await import('./accountLinkService');

        if (isDevAdminSessionEnabled()) {
            const alreadyLinked = devUsers.find((user) =>
                user.uid !== uid
                && parseLinkedWorkerIds(user.linkedOfficeStaffIds).some((id) => staffKeys.includes(id))
            );
            if (alreadyLinked || (staff.uid && staff.uid !== uid)) throw new Error('office-staff-already-managed');
            const existing = devUsers.find((user) => user.uid === uid);
            if (!existing) throw new Error('user-not-found');
            updateDevUser(uid, {
                linkedOfficeStaffIds: serializeLinkedWorkerIds([
                    ...parseLinkedWorkerIds(existing.linkedOfficeStaffIds),
                    staff.id,
                ]),
                accountType: 'office',
                status: 'active',
                primaryLinkId: accountLinkService.getLinkId(uid, 'office', staff.id),
                position: staff.role || '사무실직원',
                department: staff.department || '',
            });
            updateDevOfficeStaff(staff.id, { uid });
            return;
        }

        await accountLinkService.linkConnection({
            uid,
            entityType: 'office',
            entityId: staff.id,
            relationRole,
        });
        userCache.delete(uid);
    },

    unlinkUserFromOfficeStaff: async (uid: string, staffId: string, _actorEmail: string = 'system'): Promise<void> => {
        const { staff } = await resolveOfficeStaffForLinking(staffId);
        const staffKeys = getOfficeStaffLinkKeys(staffId, staff);
        const { accountLinkService } = await import('./accountLinkService');
        const canonicalStaffId = staff?.id || staffId;

        if (isDevAdminSessionEnabled()) {
            const existing = devUsers.find((user) => user.uid === uid);
            if (!existing) return;
            const linkedOfficeStaffIds = parseLinkedWorkerIds(existing.linkedOfficeStaffIds)
                .filter((id) => !staffKeys.includes(id));
            updateDevUser(uid, buildDevUnlinkUserPatch(existing, {
                linkedWorkerIds: parseLinkedWorkerIds(existing.linkedWorkerIds),
                linkedOfficeStaffIds,
                linkedCompanyIds: parseLinkedWorkerIds(existing.linkedCompanyIds),
            }, accountLinkService.getLinkId(uid, 'office', canonicalStaffId)));
            const devStaff = devOfficeStaff.find((row) => staffKeys.includes(String(row.id || '')));
            if (devStaff?.id && devStaff.uid === uid) updateDevOfficeStaff(devStaff.id, { uid: '' });
            return;
        }

        await accountLinkService.unlinkConnection({
            uid,
            entityType: 'office',
            entityId: canonicalStaffId,
            entityIds: staffKeys,
        });
        userCache.delete(uid);
    },

    linkUserToCompany: async (
        uid: string,
        company: { id?: string | null; name?: string | null; type?: string | null },
        _actorEmail: string = 'system',
        relationRole: AccountRelationRole = 'staff',
        _status: 'pending' | 'active' = 'active'
    ): Promise<void> => {
        const companyId = String(company.id || '').trim();
        if (!companyId) throw new Error('company-not-found');
        const { accountLinkService } = await import('./accountLinkService');

        if (isDevAdminSessionEnabled()) {
            const existing = devUsers.find((user) => user.uid === uid);
            if (!existing) throw new Error('user-not-found');
            const accountType = resolveAccountTypeFromCompanyType(company.type);
            const position = findBusinessPartnerPositionDefinition(company.type, company.type)?.name
                || String(company.type || '협력사');
            updateDevUser(uid, {
                linkedCompanyIds: serializeLinkedWorkerIds([
                    ...parseLinkedWorkerIds(existing.linkedCompanyIds),
                    companyId,
                ]),
                accountType,
                status: 'active',
                primaryLinkId: accountLinkService.getLinkId(uid, 'company', companyId),
                position,
            });
            return;
        }

        await accountLinkService.linkConnection({
            uid,
            entityType: 'company',
            entityId: companyId,
            relationRole,
        });
        userCache.delete(uid);
    },

    unlinkUserFromCompany: async (uid: string, companyId: string, _actorEmail: string = 'system'): Promise<void> => {
        const { accountLinkService } = await import('./accountLinkService');
        if (isDevAdminSessionEnabled()) {
            const existing = devUsers.find((user) => user.uid === uid);
            if (!existing) return;
            updateDevUser(uid, buildDevUnlinkUserPatch(existing, {
                linkedWorkerIds: parseLinkedWorkerIds(existing.linkedWorkerIds),
                linkedOfficeStaffIds: parseLinkedWorkerIds(existing.linkedOfficeStaffIds),
                linkedCompanyIds: parseLinkedWorkerIds(existing.linkedCompanyIds).filter((id) => id !== companyId),
            }, accountLinkService.getLinkId(uid, 'company', companyId)));
            return;
        }

        await accountLinkService.unlinkConnection({ uid, entityType: 'company', entityId: companyId });
        userCache.delete(uid);
    }
};
