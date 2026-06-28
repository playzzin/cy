import { userFirestoreService } from './userFirestoreService';
import { User } from 'firebase/auth';
import { UserRole } from '../types/roles';
import { Timestamp } from 'firebase/firestore';
import {
    AccountRelationRole,
    AccountType,
    resolveAccountTypeFromCompanyType,
    resolveEntitySubTypeFromCompanyType,
} from '../types/accountLink';

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
    accountType?: AccountType;
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
    getUser: async (uid: string): Promise<UserData | null> => {
        const now = Date.now();
        const cached = userCache.get(uid);
        if (cached && (now - cached.timestamp < CACHE_TTL)) {
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
        return userFirestoreService.getAllUsers();
    },

    // Link a user to a worker
    linkUserToWorker: async (uid: string, workerId: string, actorEmail: string = 'system'): Promise<void> => {
        try {
            const { manpowerService, worker } = await resolveWorkerForLinking(workerId);
            if (!worker?.id) {
                throw new Error('worker-not-found');
            }

            const users = await userFirestoreService.getAllUsers();
            const workerKeys = getWorkerLinkKeys(workerId, worker);

            const alreadyLinked = users.find((u: any) => {
                const ids = parseLinkedWorkerIds(u?.linkedWorkerIds);
                return ids.some((id) => workerKeys.includes(String(id)));
            });

            if (alreadyLinked && alreadyLinked.uid !== uid) {
                throw new Error('worker-already-managed');
            }

            if (worker.uid && worker.uid !== uid) {
                throw new Error('worker-already-managed');
            }

            const existing = await userFirestoreService.getUser(uid);
            const existingLinked = parseLinkedWorkerIds(existing?.linkedWorkerIds);
            const nextLinked = serializeLinkedWorkerIds([...existingLinked, worker.id]);

            const { accountLinkService } = await import('./accountLinkService');
            const linkId = await accountLinkService.upsertLink({
                uid,
                userEmail: existing?.email ?? null,
                userDisplayName: existing?.displayName ?? null,
                accountType: 'worker',
                entityType: 'worker',
                entityId: worker.id,
                entityName: worker.name || '작업자',
                entitySubType: '작업자',
                relationRole: 'staff',
                status: 'active',
            });

            const nextUserData: Partial<UserData> = {
                linkedWorkerIds: nextLinked,
                accountType: 'worker',
                status: 'active',
                primaryLinkId: existing?.primaryLinkId || linkId,
                displayName: existing?.displayName || worker.name,
                phoneNumber: existing?.phoneNumber || worker.contact,
                position: worker.role || existing?.position,
                department: existing?.department || worker.teamName,
            };

            if (existing) {
                await userFirestoreService.updateUser(uid, nextUserData);
            } else {
                await userFirestoreService.saveUser(uid, {
                    uid,
                    email: null,
                    displayName: null,
                    photoURL: null,
                    lastLogin: Timestamp.now(),
                    role: 'user',
                    ...nextUserData,
                });
            }

            await manpowerService.updateWorker(worker.id, { uid });
            userCache.delete(uid); // Invalidate cache

            // Audit Log (Fire and Forget)
            try {
                const { auditService } = await import('./auditService');
                await auditService.log({
                    action: 'LINK_USER_WORKER',
                    category: 'USER',
                    actorId: 'manager',
                    actorEmail: actorEmail,
                    targetId: uid,
                    details: { workerId: worker.id, workerName: worker.name }
                });
            } catch (e) {
                console.warn("Audit log failed", e);
            }
        } catch (error) {
            console.error("Error linking user to worker:", error);
            throw error;
        }
    },

    // Unlink a user from a worker
    unlinkUserFromWorker: async (uid: string, workerId: string, actorEmail: string = 'system'): Promise<void> => {
        try {
            const { manpowerService, worker } = await resolveWorkerForLinking(workerId);
            const workerKeys = getWorkerLinkKeys(workerId, worker);
            const existing = await userFirestoreService.getUser(uid);
            if (!existing) return;

            const current = parseLinkedWorkerIds(existing.linkedWorkerIds);
            const next = current.filter((id) => !workerKeys.includes(String(id)));

            const { accountLinkService } = await import('./accountLinkService');
            await accountLinkService.deactivateLink(uid, 'worker', worker?.id || workerId).catch(() => undefined);

            await userFirestoreService.updateUser(uid, {
                linkedWorkerIds: next,
                primaryLinkId: existing.primaryLinkId === accountLinkService.getLinkId(uid, 'worker', worker?.id || workerId)
                    ? ''
                    : existing.primaryLinkId,
            });
            if (worker?.id && worker.uid === uid) {
                await manpowerService.updateWorker(worker.id, { uid: '' });
            }
            userCache.delete(uid); // Invalidate cache

            try {
                const { auditService } = await import('./auditService');
                await auditService.log({
                    action: 'UNLINK_USER_WORKER',
                    category: 'USER',
                    actorId: 'manager',
                    actorEmail,
                    targetId: uid,
                    details: { workerId: worker?.id || workerId, workerName: worker?.name }
                });
            } catch (e) {
                console.warn("Audit log failed", e);
            }
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
        await userFirestoreService.updateUser(uid, { role } as any);
        userCache.delete(uid); // Invalidate cache
    },

    // Update user profile
    updateUserProfile: async (uid: string, updates: Partial<UserData>): Promise<void> => {
        await userFirestoreService.updateUser(uid, updates);
        userCache.delete(uid); // Invalidate cache
    },

    linkUserToOfficeStaff: async (
        uid: string,
        staffId: string,
        actorEmail: string = 'system',
        relationRole: AccountRelationRole = 'staff',
        status: 'pending' | 'active' = 'active'
    ): Promise<void> => {
        const { officeStaffService, staff } = await resolveOfficeStaffForLinking(staffId);
        if (!staff?.id) {
            throw new Error('office-staff-not-found');
        }

        const users = await userFirestoreService.getAllUsers();
        const staffKeys = getOfficeStaffLinkKeys(staffId, staff);
        const alreadyLinked = users.find((user: any) => {
            const ids = parseLinkedWorkerIds(user?.linkedOfficeStaffIds);
            return ids.some((id) => staffKeys.includes(String(id)));
        });

        if (alreadyLinked && alreadyLinked.uid !== uid) {
            throw new Error('office-staff-already-managed');
        }

        if (staff.uid && staff.uid !== uid) {
            throw new Error('office-staff-already-managed');
        }

        const existing = await userFirestoreService.getUser(uid);
        const linkedOfficeStaffIds = serializeLinkedWorkerIds([
            ...parseLinkedWorkerIds(existing?.linkedOfficeStaffIds),
            staff.id,
        ]);

        const { accountLinkService } = await import('./accountLinkService');
        const linkId = await accountLinkService.upsertLink({
            uid,
            userEmail: existing?.email ?? staff.email ?? null,
            userDisplayName: existing?.displayName ?? staff.name ?? null,
            accountType: 'office',
            entityType: 'office',
            entityId: staff.id,
            entityName: staff.name || '사무실 직원',
            entitySubType: '사무실',
            relationRole,
            status,
        });

        const userPatch: Partial<UserData> = {
            linkedOfficeStaffIds,
            accountType: 'office',
            status: status === 'active' ? 'active' : (existing?.status || 'pending'),
            primaryLinkId: existing?.primaryLinkId || linkId,
            displayName: existing?.displayName || staff.name,
            phoneNumber: existing?.phoneNumber || staff.contact,
            position: staff.role || existing?.position,
            department: existing?.department || staff.department,
        };

        if (existing) {
            await userFirestoreService.updateUser(uid, userPatch);
        } else {
            await userFirestoreService.saveUser(uid, {
                uid,
                email: staff.email ?? null,
                displayName: staff.name ?? null,
                photoURL: null,
                lastLogin: Timestamp.now(),
                role: 'user',
                linkedWorkerIds: [],
                linkedCompanyIds: [],
                ...userPatch,
            });
        }

        if (status === 'active') {
            await officeStaffService.updateOfficeStaff(staff.id, {
                uid,
                email: staff.email || existing?.email || '',
            });
        }
        userCache.delete(uid);

        try {
            const { auditService } = await import('./auditService');
            await auditService.log({
                action: status === 'active' ? 'LINK_USER_OFFICE_STAFF' : 'REQUEST_USER_OFFICE_STAFF_LINK',
                category: 'USER',
                actorId: 'manager',
                actorEmail,
                targetId: uid,
                details: { staffId: staff.id, staffName: staff.name, relationRole }
            });
        } catch (e) {
            console.warn("Audit log failed", e);
        }
    },

    unlinkUserFromOfficeStaff: async (uid: string, staffId: string, actorEmail: string = 'system'): Promise<void> => {
        const { officeStaffService, staff } = await resolveOfficeStaffForLinking(staffId);
        const existing = await userFirestoreService.getUser(uid);
        if (!existing) return;

        const staffKeys = getOfficeStaffLinkKeys(staffId, staff);
        const current = parseLinkedWorkerIds(existing.linkedOfficeStaffIds);
        const next = current.filter((id) => !staffKeys.includes(String(id)));

        const { accountLinkService } = await import('./accountLinkService');
        await accountLinkService.deactivateLink(uid, 'office', staff?.id || staffId).catch(() => undefined);

        await userFirestoreService.updateUser(uid, {
            linkedOfficeStaffIds: next,
            primaryLinkId: existing.primaryLinkId === accountLinkService.getLinkId(uid, 'office', staff?.id || staffId)
                ? ''
                : existing.primaryLinkId,
        });

        if (staff?.id && staff.uid === uid) {
            await officeStaffService.updateOfficeStaff(staff.id, { uid: '' });
        }
        userCache.delete(uid);

        try {
            const { auditService } = await import('./auditService');
            await auditService.log({
                action: 'UNLINK_USER_OFFICE_STAFF',
                category: 'USER',
                actorId: 'manager',
                actorEmail,
                targetId: uid,
                details: { staffId: staff?.id || staffId, staffName: staff?.name }
            });
        } catch (e) {
            console.warn("Audit log failed", e);
        }
    },

    linkUserToCompany: async (
        uid: string,
        company: { id?: string | null; name?: string | null; type?: string | null },
        actorEmail: string = 'system',
        relationRole: AccountRelationRole = 'staff',
        status: 'pending' | 'active' = 'active'
    ): Promise<void> => {
        const companyId = String(company.id || '').trim();
        if (!companyId) throw new Error('company-not-found');

        const existing = await userFirestoreService.getUser(uid);
        const linkedCompanyIds = serializeLinkedWorkerIds([
            ...parseLinkedWorkerIds(existing?.linkedCompanyIds),
            companyId,
        ]);
        const accountType = resolveAccountTypeFromCompanyType(company.type);

        const { accountLinkService } = await import('./accountLinkService');
        const linkId = await accountLinkService.upsertLink({
            uid,
            userEmail: existing?.email ?? null,
            userDisplayName: existing?.displayName ?? null,
            accountType,
            entityType: 'company',
            entityId: companyId,
            entityName: String(company.name || '회사'),
            entitySubType: resolveEntitySubTypeFromCompanyType(company.type),
            relationRole,
            status,
        });

        const userPatch: Partial<UserData> = {
            linkedCompanyIds,
            accountType,
            status: status === 'active' ? 'active' : (existing?.status || 'pending'),
            primaryLinkId: existing?.primaryLinkId || linkId,
        };

        if (existing) {
            await userFirestoreService.updateUser(uid, userPatch);
        } else {
            await userFirestoreService.saveUser(uid, {
                uid,
                email: null,
                displayName: null,
                photoURL: null,
                lastLogin: Timestamp.now(),
                role: 'user',
                linkedWorkerIds: [],
                ...userPatch,
            });
        }
        userCache.delete(uid);

        try {
            const { auditService } = await import('./auditService');
            await auditService.log({
                action: status === 'active' ? 'LINK_USER_COMPANY' : 'REQUEST_USER_COMPANY_LINK',
                category: 'USER',
                actorId: 'manager',
                actorEmail,
                targetId: uid,
                details: { companyId, companyName: company.name, companyType: company.type, relationRole }
            });
        } catch (e) {
            console.warn("Audit log failed", e);
        }
    },

    unlinkUserFromCompany: async (uid: string, companyId: string, actorEmail: string = 'system'): Promise<void> => {
        const existing = await userFirestoreService.getUser(uid);
        if (!existing) return;

        const current = parseLinkedWorkerIds(existing.linkedCompanyIds);
        const next = current.filter((id) => id !== companyId);
        const { accountLinkService } = await import('./accountLinkService');
        await accountLinkService.deactivateLink(uid, 'company', companyId).catch(() => undefined);

        await userFirestoreService.updateUser(uid, {
            linkedCompanyIds: next,
            primaryLinkId: existing.primaryLinkId === accountLinkService.getLinkId(uid, 'company', companyId)
                ? ''
                : existing.primaryLinkId,
        });
        userCache.delete(uid);

        try {
            const { auditService } = await import('./auditService');
            await auditService.log({
                action: 'UNLINK_USER_COMPANY',
                category: 'USER',
                actorId: 'manager',
                actorEmail,
                targetId: uid,
                details: { companyId }
            });
        } catch (e) {
            console.warn("Audit log failed", e);
        }
    }
};
