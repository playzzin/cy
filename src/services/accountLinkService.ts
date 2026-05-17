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
import { db } from '../config/firebase';
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

export const accountLinkService = {
    getLinkId(uid: string, entityType: AccountEntityType, entityId: string): string {
        return buildLinkId(uid, entityType, entityId);
    },

    async getAllLinks(): Promise<AccountLink[]> {
        const snap = await getDocs(collection(db, COLLECTION_NAME));
        return sortByUpdatedDesc(snap.docs.map((item) => ({ id: item.id, ...item.data() } as AccountLink)));
    },

    async getLinksByUid(uid: string): Promise<AccountLink[]> {
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
        idNumber?: string;
        address?: string;
        department?: string;
        position?: string;
        phoneNumber?: string;
        employmentType?: string;
        salaryModel?: string;
        unitPrice?: number;
        bankName?: string;
        accountNumber?: string;
        accountHolder?: string;
        memo?: string;
    }): Promise<string> {
        const officeEntityName = params.staffName || params.userDisplayName || params.department || '사무실';

        return accountLinkService.upsertLink({
            uid: params.uid,
            userEmail: params.userEmail,
            userDisplayName: params.userDisplayName,
            accountType: 'office',
            entityType: 'office',
            entityId: params.officeStaffId || 'office',
            entityName: officeEntityName,
            entitySubType: '사무실',
            relationRole: 'staff',
            status: 'pending',
            requestedEntity: {
                name: officeEntityName,
                idNumber: params.idNumber,
                address: params.address,
                department: params.department,
                role: params.position,
                employmentType: params.employmentType,
                salaryModel: params.salaryModel,
                unitPrice: params.unitPrice,
                bankName: params.bankName,
                accountNumber: params.accountNumber,
                accountHolder: params.accountHolder,
                phone: params.phoneNumber,
                memo: [params.position, params.memo].filter(Boolean).join(' / '),
            },
        });
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
        return accountLinkService.upsertLink({
            uid: params.uid,
            userEmail: params.userEmail,
            userDisplayName: params.userDisplayName,
            accountType: resolveAccountTypeFromCompanyType(params.companyType),
            entityType: 'company',
            entityId: params.companyId,
            entityName: params.companyName,
            entitySubType: resolveEntitySubTypeFromCompanyType(params.companyType),
            relationRole: params.relationRole || 'staff',
            status: 'pending',
            memo: params.memo,
        });
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
        const tempId = `new_${params.uid}_${Date.now()}`;
        return accountLinkService.upsertLink({
            uid: params.uid,
            userEmail: params.userEmail,
            userDisplayName: params.userDisplayName,
            accountType: resolveAccountTypeFromCompanyType(params.companyType),
            entityType: 'company',
            entityId: tempId,
            entityName: params.requestedEntity.name || '신규 회사 요청',
            entitySubType: resolveEntitySubTypeFromCompanyType(params.companyType),
            relationRole: params.relationRole || 'staff',
            status: 'pending',
            requestedEntity: params.requestedEntity,
            memo: params.memo,
        });
    },

    async approveLink(link: AccountLink, actor: { uid?: string; email?: string | null }): Promise<void> {
        if (!link.id) throw new Error('account-link-id-required');
        await updateDoc(doc(db, COLLECTION_NAME, link.id), stripUndefinedFields({
            status: 'active',
            approvedAt: serverTimestamp(),
            approvedBy: actor.uid || 'system',
            approvedByEmail: actor.email ?? null,
            updatedAt: serverTimestamp(),
        }));
    },

    async rejectLink(link: AccountLink, actor: { uid?: string; email?: string | null }): Promise<void> {
        if (!link.id) throw new Error('account-link-id-required');
        await updateDoc(doc(db, COLLECTION_NAME, link.id), stripUndefinedFields({
            status: 'rejected',
            rejectedAt: serverTimestamp(),
            rejectedBy: actor.uid || 'system',
            rejectedByEmail: actor.email ?? null,
            updatedAt: serverTimestamp(),
        }));
    },

    async deactivateLink(uid: string, entityType: AccountEntityType, entityId: string): Promise<void> {
        const id = buildLinkId(uid, entityType, entityId);
        await updateDoc(doc(db, COLLECTION_NAME, id), {
            status: 'inactive',
            updatedAt: serverTimestamp(),
        });
    },
};
