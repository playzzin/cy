import {
    collection,
    doc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../config/firebase';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import {
    devOfficeStaff,
    devUsers,
    devWorkers,
    setDevUserPositions,
    updateDevOfficeStaff,
    updateDevUser,
    updateDevWorker,
} from '../utils/devAdminFixtures';
import { stripUndefinedFields } from '../utils/stripUndefinedFields';
import {
    AccountEntitySubType,
    AccountEntityType,
    AccountLink,
    AccountLinkStatus,
    AccountRelationRole,
    AccountType,
    RequestedEntitySnapshot,
    resolveAccountTypeFromCompanyType,
    resolveEntitySubTypeFromCompanyType,
} from '../types/accountLink';

const COLLECTION_NAME = 'account_links';

const normalizeDocId = (value: string): string =>
    value.trim().replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || `link_${Date.now()}`;

const buildLinkId = (uid: string, entityType: AccountEntityType, entityId: string): string =>
    normalizeDocId(`${uid}_${entityType}_${entityId}`);

const sortByUpdatedDesc = (links: AccountLink[]): AccountLink[] =>
    [...links].sort((a, b) => {
        const aMillis = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
        const bMillis = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
        return bMillis - aMillis;
    });

export interface UpsertAccountLinkInput {
    uid: string;
    userEmail?: string | null;
    userDisplayName?: string | null;
    accountType: AccountType;
    entityType: AccountEntityType;
    entityId: string;
    entityName: string;
    entitySubType: AccountEntitySubType;
    relationRole?: AccountRelationRole;
    status?: AccountLinkStatus;
    requestedEntity?: RequestedEntitySnapshot;
    memo?: string;
}

export interface SubmitAccountLinkRequestInput {
    accountType: AccountType;
    entityId?: string;
    entityName?: string;
    companyType?: string;
    relationRole?: AccountRelationRole;
    requestedEntity?: RequestedEntitySnapshot;
    memo?: string;
    workerPhone?: string;
}

export interface SubmitAccountLinkRequestResult {
    linkId: string;
    status: 'pending';
    entityId: string;
    entityName: string;
    accountType: AccountType;
}

export interface MyAccountLinkStatusResult {
    user: {
        uid: string;
        status: 'pending' | 'active' | 'rejected' | 'suspended';
        accountType: AccountType | null;
        requestedAccountType: AccountType | null;
        linkedCompanyIds: string[];
        linkedSiteIds: string[];
    };
    links: AccountLink[];
}

export interface AccountLinkWorkerCandidate {
    id: string;
    name: string;
    teamName: string;
}

export interface AccountLinkCompanyCandidate {
    id: string;
    name: string;
    code: string;
    type: string;
    businessNumber: string;
    ceoName: string;
    phone: string;
}

export interface RevokeUserAccessApprovalResult {
    uid: string;
    status: 'pending';
    requeuedLinks: number;
}

export interface UnlinkAccountConnectionResult {
    uid: string;
    entityType: AccountEntityType;
    entityId: string;
    status: 'pending' | 'active';
    position: string;
    remainingActiveLinkCount: number;
}

export interface LinkAccountConnectionResult {
    uid: string;
    linkId: string;
    entityType: AccountEntityType;
    entityId: string;
    accountType: AccountType;
    position: string;
    status: 'active';
}

export interface UpdateUserAccessResult {
    uid: string;
    role: string;
    position: string;
    additionalPositions: string[];
    status: 'pending' | 'active' | 'rejected' | 'suspended';
}

export const accountLinkService = {
    getLinkId(uid: string, entityType: AccountEntityType, entityId: string): string {
        return buildLinkId(uid, entityType, entityId);
    },

    async getAllLinks(): Promise<AccountLink[]> {
        const snap = await getDocs(collection(db, COLLECTION_NAME));
        return sortByUpdatedDesc(snap.docs.map((item) => ({ id: item.id, ...item.data() } as AccountLink)));
    },

    async getLinksByUid(uid: string): Promise<AccountLink[]> {
        if (auth.currentUser?.uid === uid) {
            return (await accountLinkService.getMyStatus()).links;
        }
        const q = query(collection(db, COLLECTION_NAME), where('uid', '==', uid));
        const snap = await getDocs(q);
        return sortByUpdatedDesc(snap.docs.map((item) => ({ id: item.id, ...item.data() } as AccountLink)));
    },

    async getActiveLinksByUid(uid: string): Promise<AccountLink[]> {
        return (await accountLinkService.getLinksByUid(uid)).filter((link) => link.status === 'active');
    },

    async getPendingLinks(): Promise<AccountLink[]> {
        const q = query(collection(db, COLLECTION_NAME), where('status', '==', 'pending'));
        const snap = await getDocs(q);
        return sortByUpdatedDesc(snap.docs.map((item) => ({ id: item.id, ...item.data() } as AccountLink)));
    },

    async getMyStatus(): Promise<MyAccountLinkStatusResult> {
        const callable = httpsCallable<Record<string, never>, MyAccountLinkStatusResult>(
            functions,
            'getMyAccountLinkStatus'
        );
        const response = await callable({});
        return response.data;
    },

    async getMyWorkerCandidate(params: { phone: string }): Promise<AccountLinkWorkerCandidate | null> {
        const callable = httpsCallable<typeof params, { candidate: AccountLinkWorkerCandidate | null }>(
            functions,
            'getMyAccountLinkCandidate'
        );
        const response = await callable(params);
        return response.data.candidate;
    },

    async searchCompanies(params: {
        accountType: AccountType;
        searchTerm?: string;
        businessNumber?: string;
    }): Promise<AccountLinkCompanyCandidate[]> {
        const callable = httpsCallable<typeof params, { companies: AccountLinkCompanyCandidate[] }>(
            functions,
            'searchAccountLinkCompanies'
        );
        const response = await callable(params);
        return response.data.companies;
    },

    async submitRequest(input: SubmitAccountLinkRequestInput): Promise<SubmitAccountLinkRequestResult> {
        const callable = httpsCallable<SubmitAccountLinkRequestInput, SubmitAccountLinkRequestResult>(
            functions,
            'submitAccountLinkRequest'
        );
        const response = await callable(input);
        return response.data;
    },

    async upsertLink(input: UpsertAccountLinkInput): Promise<string> {
        const entityId = String(input.entityId || '').trim();
        if (!input.uid || !entityId) {
            throw new Error('account-link-invalid-input');
        }

        const id = buildLinkId(input.uid, input.entityType, entityId);
        const docRef = doc(db, COLLECTION_NAME, id);
        const status = input.status || 'active';
        const nowFields = status === 'pending'
            ? { requestedAt: serverTimestamp() }
            : status === 'active'
                ? { approvedAt: serverTimestamp() }
                : {};

        await setDoc(docRef, stripUndefinedFields({
            uid: input.uid,
            userEmail: input.userEmail ?? null,
            userDisplayName: input.userDisplayName ?? null,
            accountType: input.accountType,
            entityType: input.entityType,
            entityId,
            entityName: input.entityName,
            entitySubType: input.entitySubType,
            relationRole: input.relationRole || 'staff',
            status,
            requestedEntity: input.requestedEntity,
            memo: input.memo,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...nowFields,
        }), { merge: true });

        return id;
    },

    async requestOfficeLink(params: {
        uid: string;
        userEmail?: string | null;
        userDisplayName?: string | null;
        officeStaffId?: string;
        staffName?: string;
        address?: string;
        department?: string;
        position?: string;
        phoneNumber?: string;
        employmentType?: string;
        salaryModel?: string;
        unitPrice?: number;
        memo?: string;
    }): Promise<string> {
        const officeEntityName = params.staffName || params.userDisplayName || params.department || '사무실';
        const result = await accountLinkService.submitRequest({
            accountType: 'office',
            entityId: params.officeStaffId,
            entityName: officeEntityName,
            relationRole: 'staff',
            requestedEntity: {
                name: officeEntityName,
                address: params.address,
                department: params.department,
                role: params.position,
                employmentType: params.employmentType,
                salaryModel: params.salaryModel,
                unitPrice: params.unitPrice,
                phone: params.phoneNumber,
                memo: [params.position, params.memo].filter(Boolean).join(' / '),
            },
        });
        return result.linkId;
    },

    async requestWorkerLink(params: {
        entityId?: string;
        name?: string;
        phone?: string;
        identityPhone?: string;
        address?: string;
        memo?: string;
    }): Promise<string> {
        const result = await accountLinkService.submitRequest({
            accountType: 'worker',
            entityId: params.entityId,
            entityName: params.name,
            relationRole: 'staff',
            workerPhone: params.identityPhone,
            requestedEntity: {
                name: params.name,
                phone: params.phone,
                address: params.address,
                memo: params.memo,
            },
        });
        return result.linkId;
    },

    async requestCompanyLink(params: {
        uid: string;
        userEmail?: string | null;
        userDisplayName?: string | null;
        companyId: string;
        companyName: string;
        companyType: string;
        relationRole?: AccountRelationRole;
        memo?: string;
    }): Promise<string> {
        const result = await accountLinkService.submitRequest({
            accountType: resolveAccountTypeFromCompanyType(params.companyType),
            entityId: params.companyId,
            entityName: params.companyName,
            companyType: params.companyType,
            relationRole: params.relationRole || 'staff',
            memo: params.memo,
        });
        return result.linkId;
    },

    async requestNewCompanyLink(params: {
        uid: string;
        userEmail?: string | null;
        userDisplayName?: string | null;
        companyType: string;
        requestedEntity: RequestedEntitySnapshot;
        relationRole?: AccountRelationRole;
        memo?: string;
    }): Promise<string> {
        const result = await accountLinkService.submitRequest({
            accountType: resolveAccountTypeFromCompanyType(params.companyType),
            entityName: params.requestedEntity.name || '신규 회사 요청',
            companyType: params.companyType,
            relationRole: params.relationRole || 'staff',
            requestedEntity: params.requestedEntity,
            memo: params.memo,
        });
        return result.linkId;
    },

    async approveLink(link: AccountLink, actor: { uid?: string; email?: string | null }): Promise<void> {
        if (!link.id) throw new Error('account-link-id-required');
        const callable = httpsCallable<{ linkId: string; siteIds?: string[] }, { status: 'active' }>(
            functions,
            'approveAccountLinkRequest'
        );
        await callable({ linkId: link.id, siteIds: link.siteIds });
    },

    async rejectLink(link: AccountLink, actor: { uid?: string; email?: string | null }, reason?: string): Promise<void> {
        if (!link.id) throw new Error('account-link-id-required');
        const callable = httpsCallable<{ linkId: string; reason?: string }, { status: 'rejected' }>(
            functions,
            'rejectAccountLinkRequest'
        );
        await callable({ linkId: link.id, reason: reason?.trim() || undefined });
    },

    async revokeUserAccessApproval(uid: string): Promise<RevokeUserAccessApprovalResult> {
        const normalizedUid = String(uid || '').trim();
        if (!normalizedUid) throw new Error('uid is required');

        if (isDevAdminSessionEnabled()) {
            const user = devUsers.find((row) => row.uid === normalizedUid);
            updateDevUser(normalizedUid, {
                position: '',
                department: '',
                additionalPositions: [],
                status: 'pending',
                requestedAccountType: user?.accountType,
                linkedSiteIds: [],
            });
            setDevUserPositions(normalizedUid, []);
            return { uid: normalizedUid, status: 'pending', requeuedLinks: 0 };
        }

        const callable = httpsCallable<{ uid: string }, RevokeUserAccessApprovalResult>(
            functions,
            'revokeUserAccessApproval'
        );
        const response = await callable({ uid: normalizedUid });
        return response.data;
    },

    async unlinkConnection(params: {
        uid: string;
        entityType: AccountEntityType;
        entityId: string;
        entityIds?: string[];
    }): Promise<UnlinkAccountConnectionResult> {
        const uid = String(params.uid || '').trim();
        const entityId = String(params.entityId || '').trim();
        if (!uid || !entityId) throw new Error('account-link-target-required');

        const callable = httpsCallable<typeof params, UnlinkAccountConnectionResult>(
            functions,
            'unlinkAccountConnection'
        );
        const response = await callable({
            ...params,
            uid,
            entityId,
            entityIds: Array.from(new Set((params.entityIds || []).map(String).filter(Boolean))),
        });
        return response.data;
    },

    async linkConnection(params: {
        uid: string;
        entityType: AccountEntityType;
        entityId: string;
        relationRole?: AccountRelationRole;
    }): Promise<LinkAccountConnectionResult> {
        const uid = String(params.uid || '').trim();
        const entityId = String(params.entityId || '').trim();
        if (!uid || !entityId) throw new Error('account-link-target-required');

        const callable = httpsCallable<typeof params, LinkAccountConnectionResult>(
            functions,
            'linkAccountConnection'
        );
        const response = await callable({ ...params, uid, entityId });
        return response.data;
    },

    async updateUserAccess(params: {
        uid: string;
        role: string;
        position: string;
        additionalPositions: string[];
        syncLinkedProfiles?: boolean;
    }): Promise<UpdateUserAccessResult> {
        const uid = String(params.uid || '').trim();
        const position = String(params.position || '').trim();
        if (!uid || !position) throw new Error('user-access-target-required');

        if (isDevAdminSessionEnabled()) {
            const user = devUsers.find((row) => row.uid === uid);
            if (!user) throw new Error('user-not-found');
            const additionalPositions = Array.from(new Set(params.additionalPositions.map(String).filter((value) => value && value !== position)));
            updateDevUser(uid, { role: params.role, position, additionalPositions });
            setDevUserPositions(uid, additionalPositions);
            if (params.syncLinkedProfiles) {
                devWorkers.filter((row) => row.uid === uid && row.id).forEach((row) => updateDevWorker(String(row.id), { role: position }));
                devOfficeStaff.filter((row) => row.uid === uid && row.id).forEach((row) => updateDevOfficeStaff(String(row.id), { role: position }));
            }
            return {
                uid,
                role: params.role,
                position,
                additionalPositions,
                status: user.status || 'pending',
            };
        }

        const callable = httpsCallable<typeof params, UpdateUserAccessResult>(
            functions,
            'updateUserAccess'
        );
        const response = await callable({ ...params, uid, position });
        return response.data;
    },

    async deactivateLink(uid: string, entityType: AccountEntityType, entityId: string): Promise<void> {
        const id = buildLinkId(uid, entityType, entityId);
        await updateDoc(doc(db, COLLECTION_NAME, id), {
            status: 'inactive',
            updatedAt: serverTimestamp(),
        });
    },
};
