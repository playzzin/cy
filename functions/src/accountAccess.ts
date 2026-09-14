import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { protectedRegion, requireCallableAdmin, requireCallableAuth } from './auth';
import { refreshAccessClaimsForUid } from './roleClaims';
import {
    buildWorkerPhoneLookupValues,
    normalizeWorkerPhone,
} from './workerIdentity';

type AccountType = 'worker' | 'office' | 'partner_company' | 'construction_company' | 'rental_company';
type EntityType = 'worker' | 'office' | 'company';
type RelationRole = 'owner' | 'manager' | 'staff' | 'viewer';

interface RequestedEntity {
    name?: string;
    businessNumber?: string;
    ceoName?: string;
    phone?: string;
    email?: string;
    address?: string;
    role?: string;
    department?: string;
    employmentType?: string;
    salaryModel?: string;
    unitPrice?: number;
    memo?: string;
}

interface SubmitAccountLinkRequestInput {
    accountType?: unknown;
    entityId?: unknown;
    entityName?: unknown;
    companyType?: unknown;
    relationRole?: unknown;
    requestedEntity?: unknown;
    memo?: unknown;
    workerPhone?: unknown;
}

interface UnlinkAccountConnectionInput {
    uid?: unknown;
    entityType?: unknown;
    entityId?: unknown;
    entityIds?: unknown;
}

interface LinkAccountConnectionInput {
    uid?: unknown;
    entityType?: unknown;
    entityId?: unknown;
    relationRole?: unknown;
}

interface UpdateUserAccessInput {
    uid?: unknown;
    role?: unknown;
    position?: unknown;
    additionalPositions?: unknown;
    syncLinkedProfiles?: unknown;
}

const db = admin.firestore();
const ACCOUNT_TYPES = new Set<AccountType>([
    'worker',
    'office',
    'partner_company',
    'construction_company',
    'rental_company',
]);
const RELATION_ROLES = new Set<RelationRole>(['owner', 'manager', 'staff', 'viewer']);
const BLOCKED_ACCOUNT_STATES = new Set(['suspended']);

const text = (value: unknown, maxLength = 200): string =>
    String(value ?? '').trim().slice(0, maxLength);

const optionalText = (value: unknown, maxLength = 200): string | undefined => {
    const result = text(value, maxLength);
    return result || undefined;
};

const uniqueTexts = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map((entry) => text(entry, 160)).filter(Boolean)));
};

const parseUserMenuPositionMap = (snapshot: admin.firestore.DocumentSnapshot): Record<string, string[]> => {
    const raw = snapshot.data()?.data;
    if (typeof raw !== 'string' || !raw.trim()) return {};
    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return Object.fromEntries(Object.entries(parsed).map(([uid, positions]) => [uid, uniqueTexts(positions)]));
    } catch {
        return {};
    }
};

const removeUserMenuPositions = (
    snapshot: admin.firestore.DocumentSnapshot,
    uid: string
): Record<string, string[]> => {
    const next = parseUserMenuPositionMap(snapshot);
    delete next[uid];
    return next;
};

const normalizeAccountType = (value: unknown): AccountType => {
    const normalized = text(value, 40) as AccountType;
    if (!ACCOUNT_TYPES.has(normalized)) {
        throw new functions.https.HttpsError('invalid-argument', '가입 유형을 확인해 주세요.');
    }
    return normalized;
};

const normalizeRelationRole = (value: unknown): RelationRole => {
    const normalized = text(value, 40) as RelationRole;
    return RELATION_ROLES.has(normalized) ? normalized : 'staff';
};

const accountTypeFromCompanyType = (value: unknown): AccountType => {
    const normalized = text(value, 40);
    if (normalized === '건설사' || normalized === '시공사') return 'construction_company';
    if (normalized === '임대사') return 'rental_company';
    return 'partner_company';
};

const companyTypeFromAccountType = (accountType: AccountType, requested: unknown): string => {
    const requestedType = text(requested, 40);
    if (accountType === 'construction_company') {
        return requestedType === '시공사' ? '시공사' : '건설사';
    }
    if (accountType === 'rental_company') return '임대사';
    return '협력사';
};

const sanitizeRequestedEntity = (value: unknown): RequestedEntity => {
    const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const unitPrice = Number(raw.unitPrice ?? 0);
    return Object.fromEntries(Object.entries({
        name: optionalText(raw.name, 120),
        businessNumber: optionalText(raw.businessNumber, 40),
        ceoName: optionalText(raw.ceoName, 80),
        phone: optionalText(raw.phone, 40),
        email: optionalText(raw.email, 160),
        address: optionalText(raw.address, 240),
        role: optionalText(raw.role, 80),
        department: optionalText(raw.department, 80),
        employmentType: optionalText(raw.employmentType, 40),
        salaryModel: optionalText(raw.salaryModel, 40),
        unitPrice: Number.isFinite(unitPrice) ? Math.max(0, Math.min(unitPrice, 1_000_000_000)) : undefined,
        memo: optionalText(raw.memo, 500),
    }).filter(([, entry]) => entry !== undefined)) as RequestedEntity;
};

const entityMetadata = (accountType: AccountType): { entityType: EntityType; entitySubType: string } => {
    if (accountType === 'worker') return { entityType: 'worker', entitySubType: '작업자' };
    if (accountType === 'office') return { entityType: 'office', entitySubType: '사무실' };
    if (accountType === 'construction_company') return { entityType: 'company', entitySubType: '건설사' };
    if (accountType === 'rental_company') return { entityType: 'company', entitySubType: '임대사' };
    return { entityType: 'company', entitySubType: '협력사' };
};

const normalizeDocPart = (value: string): string =>
    value.trim().replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 500) || 'link';

const buildLinkId = (uid: string, entityType: EntityType, entityId: string): string =>
    normalizeDocPart(`${uid}_${entityType}_${entityId}`);

const findUniqueByEmail = async (
    collectionName: 'workers' | 'office_staff',
    email: string
): Promise<admin.firestore.QueryDocumentSnapshot | null> => {
    if (!email) return null;
    const snapshot = await db.collection(collectionName).where('email', '==', email).limit(2).get();
    return snapshot.size === 1 ? snapshot.docs[0] : null;
};

const findWorkerByPhone = async (phoneValue: unknown): Promise<admin.firestore.QueryDocumentSnapshot> => {
    const normalizedPhone = normalizeWorkerPhone(phoneValue);
    if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            '본인 휴대전화번호를 정확히 입력해 주세요.'
        );
    }

    const lookupValues = buildWorkerPhoneLookupValues(phoneValue);
    const phoneFields = ['contact', 'phone', 'phoneNumber', 'mobile'];
    const snapshots = await Promise.all(phoneFields.flatMap((field) =>
        lookupValues.map((lookupValue) =>
            db.collection('workers').where(field, '==', lookupValue).limit(5).get()
        )
    ));
    const candidates = new Map<string, admin.firestore.QueryDocumentSnapshot>();
    snapshots.forEach((snapshot) => snapshot.docs.forEach((candidate) => {
        candidates.set(candidate.id, candidate);
    }));

    const matches = Array.from(candidates.values()).filter((candidate) => {
        const worker = candidate.data() as Record<string, unknown>;
        const candidatePhone = normalizeWorkerPhone(
            worker.contact ?? worker.phone ?? worker.phoneNumber ?? worker.mobile
        );
        return candidatePhone === normalizedPhone;
    });
    if (matches.length === 0) {
        throw new functions.https.HttpsError(
            'not-found',
            '입력한 전화번호와 일치하는 기존 작업자를 찾을 수 없습니다.'
        );
    }
    if (matches.length > 1) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            '동일한 전화번호의 작업자가 여러 명입니다. 관리자에게 확인해 주세요.'
        );
    }
    return matches[0];
};

const resolveCompany = async (
    entityId: string,
    requested: RequestedEntity,
    accountType: AccountType
): Promise<admin.firestore.DocumentSnapshot | null> => {
    if (entityId) {
        const snapshot = await db.collection('companies').doc(entityId).get();
        if (!snapshot.exists) {
            throw new functions.https.HttpsError('not-found', '선택한 회사를 찾을 수 없습니다.');
        }
        return snapshot;
    }

    const businessNumber = text(requested.businessNumber, 40);
    if (businessNumber) {
        const snapshot = await db.collection('companies').where('businessNumber', '==', businessNumber).limit(2).get();
        if (snapshot.size === 1) return snapshot.docs[0];
    }

    const name = text(requested.name, 120);
    if (name) {
        const snapshot = await db.collection('companies').where('name', '==', name).limit(2).get();
        const matching = snapshot.docs.filter((doc) => accountTypeFromCompanyType(doc.data().type) === accountType);
        if (matching.length === 1) return matching[0];
    }
    return null;
};

const statusPayload = (snapshot: admin.firestore.DocumentSnapshot): Record<string, unknown> => {
    const data = snapshot.data() || {};
    const timestampMillis = (value: unknown): number | null => {
        if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
            return (value as admin.firestore.Timestamp).toMillis();
        }
        return null;
    };
    return {
        id: snapshot.id,
        uid: data.uid,
        accountType: data.accountType,
        entityType: data.entityType,
        entityId: data.entityId,
        entityName: data.entityName,
        entitySubType: data.entitySubType,
        relationRole: data.relationRole,
        status: data.status,
        siteIds: uniqueTexts(data.siteIds),
        requestedAt: timestampMillis(data.requestedAt),
        approvedAt: timestampMillis(data.approvedAt),
        rejectedAt: timestampMillis(data.rejectedAt),
        rejectionReason: optionalText(data.rejectionReason, 500) || null,
    };
};

const positionFromAccountLink = (
    link: Record<string, unknown>,
    entity: Record<string, unknown>
): { position: string; department: string } => {
    const requested = sanitizeRequestedEntity(link.requestedEntity);
    const entityType = text(link.entityType, 40) as EntityType;
    const entitySubType = text(link.entitySubType, 40);

    if (entityType === 'worker') {
        return {
            position: text(requested.role ?? entity.role ?? entity.rank, 80) || '일반',
            department: text(requested.department ?? entity.teamName ?? entity.department, 80),
        };
    }
    if (entityType === 'office') {
        return {
            position: text(requested.role ?? entity.role, 80) || '사무실직원',
            department: text(requested.department ?? entity.department, 80),
        };
    }

    const companyType = text(entity.type ?? entitySubType, 40);
    return {
        position: text(requested.role, 80)
            || (companyType === '건설사' || companyType === '시공사' ? '건설' : companyType),
        department: text(requested.department, 80),
    };
};

const findCompanySiteIds = async (companyId: string): Promise<string[]> => {
    if (!companyId) return [];
    const snapshots = await Promise.all([
        db.collection('sites').where('clientCompanyId', '==', companyId).get(),
        db.collection('sites').where('constructorCompanyId', '==', companyId).get(),
        db.collection('sites').where('companyId', '==', companyId).get(),
        db.collection('sites').where('rentalCompanyId', '==', companyId).get(),
    ]);
    return Array.from(new Set(snapshots.flatMap((snapshot) => snapshot.docs.map((item) => item.id))));
};

export const linkAccountConnection = protectedRegion.https.onCall(async (data, context) => {
    const actor = await requireCallableAdmin(context);
    const input = (data || {}) as LinkAccountConnectionInput;
    const uid = text(input.uid, 160);
    const entityType = text(input.entityType, 40) as EntityType;
    const entityId = text(input.entityId, 180);
    const relationRole = normalizeRelationRole(input.relationRole);
    if (!uid || !['worker', 'office', 'company'].includes(entityType) || !entityId) {
        throw new functions.https.HttpsError('invalid-argument', '연결할 사용자와 대상을 확인해 주세요.');
    }

    const collectionName = entityType === 'worker'
        ? 'workers'
        : entityType === 'office'
            ? 'office_staff'
            : 'companies';
    const companySiteIds = entityType === 'company' ? await findCompanySiteIds(entityId) : [];
    const userRef = db.collection('users').doc(uid);
    const entityRef = db.collection(collectionName).doc(entityId);
    const linkId = buildLinkId(uid, entityType, entityId);
    const linkRef = db.collection('account_links').doc(linkId);
    const entityLinksQuery = db.collection('account_links').where('entityId', '==', entityId);
    const auditRef = db.collection('audit_logs').doc();
    let resultAccountType: AccountType = 'worker';
    let resultPosition = '';

    await db.runTransaction(async (transaction) => {
        const [userSnapshot, entitySnapshot, entityLinksSnapshot] = await Promise.all([
            transaction.get(userRef),
            transaction.get(entityRef),
            transaction.get(entityLinksQuery),
        ]);
        if (!userSnapshot.exists) {
            throw new functions.https.HttpsError('not-found', '연결할 사용자 계정을 찾을 수 없습니다.');
        }
        if (!entitySnapshot.exists) {
            throw new functions.https.HttpsError('not-found', '연결할 대상 정보를 찾을 수 없습니다.');
        }

        const user = userSnapshot.data() || {};
        const entity = entitySnapshot.data() || {};
        if (text(user.status, 40) === 'suspended') {
            throw new functions.https.HttpsError('failed-precondition', '정지된 계정에는 대상을 연결할 수 없습니다.');
        }
        const currentEntityUid = text(entity.uid, 160);
        if (entityType !== 'company' && currentEntityUid && currentEntityUid !== uid) {
            throw new functions.https.HttpsError('already-exists', '이미 다른 계정에 연결된 대상입니다.');
        }
        const isLinkedToOtherUser = entityLinksSnapshot.docs.some((item) => {
            const link = item.data() || {};
            return text(link.entityType, 40) === entityType
                && text(link.status, 40) === 'active'
                && text(link.uid, 160) !== uid;
        });
        if (entityType !== 'company' && isLinkedToOtherUser) {
            throw new functions.https.HttpsError('already-exists', '이미 다른 계정에 활성 연결된 대상입니다.');
        }

        const companyType = text(entity.type, 40);
        const accountType: AccountType = entityType === 'worker'
            ? 'worker'
            : entityType === 'office'
                ? 'office'
                : accountTypeFromCompanyType(companyType);
        const entitySubType = entityType === 'worker'
            ? '작업자'
            : entityType === 'office'
                ? '사무실'
                : companyType || '협력사';
        const entityName = text(entity.name, 120)
            || (entityType === 'worker' ? '작업자' : entityType === 'office' ? '사무실 직원' : '회사');
        const requestedEntity = sanitizeRequestedEntity({
            name: entityName,
            role: entityType === 'company'
                ? (companyType === '건설사' || companyType === '시공사' ? '건설' : companyType)
                : entity.role ?? entity.rank,
            department: entityType === 'worker' ? entity.teamName ?? entity.department : entity.department,
            phone: entity.contact ?? entity.phone,
            email: entity.email,
        });
        const profile = positionFromAccountLink({ entityType, entitySubType, requestedEntity }, entity);
        const existingTargetLink = entityLinksSnapshot.docs.find((item) => item.id === linkId);
        const linkedWorkerIds = uniqueTexts(user.linkedWorkerIds);
        const linkedOfficeStaffIds = uniqueTexts(user.linkedOfficeStaffIds);
        const linkedCompanyIds = uniqueTexts(user.linkedCompanyIds);
        if (entityType === 'worker') linkedWorkerIds.push(entityId);
        if (entityType === 'office') linkedOfficeStaffIds.push(entityId);
        if (entityType === 'company') linkedCompanyIds.push(entityId);
        const now = admin.firestore.FieldValue.serverTimestamp();

        transaction.set(linkRef, {
            uid,
            userEmail: text(user.email, 160) || null,
            userDisplayName: text(user.displayName, 120) || null,
            accountType,
            entityType,
            entityId,
            entityName,
            entitySubType,
            relationRole,
            status: 'active',
            requestedEntity,
            siteIds: companySiteIds,
            approvalMode: 'admin_direct',
            approvedBy: actor!.uid,
            approvedByEmail: text(actor?.token?.email, 160) || null,
            approvedAt: now,
            updatedAt: now,
            ...(existingTargetLink ? {} : { createdAt: now }),
        }, { merge: true });
        transaction.update(userRef, {
            accountType,
            requestedAccountType: admin.firestore.FieldValue.delete(),
            status: 'active',
            primaryLinkId: linkId,
            linkedWorkerIds: Array.from(new Set(linkedWorkerIds)),
            linkedOfficeStaffIds: Array.from(new Set(linkedOfficeStaffIds)),
            linkedCompanyIds: Array.from(new Set(linkedCompanyIds)),
            linkedSiteIds: Array.from(new Set([...uniqueTexts(user.linkedSiteIds), ...companySiteIds])),
            position: profile.position,
            department: profile.department,
            updatedAt: now,
        });
        if (entityType !== 'company') {
            transaction.update(entityRef, { uid, updatedAt: now });
        }
        transaction.create(auditRef, {
            action: 'LINK_ACCOUNT_CONNECTION',
            category: 'AUTH',
            actorId: actor!.uid,
            actorEmail: text(actor?.token?.email, 160) || null,
            targetId: uid,
            linkId,
            entityType,
            entityId,
            accountType,
            position: profile.position,
            createdAt: now,
        });
        resultAccountType = accountType;
        resultPosition = profile.position;
    });

    await refreshAccessClaimsForUid(uid).catch((error) => {
        functions.logger.warn('[accountAccess] Linked user claim refresh failed.', { uid, error });
    });

    return {
        uid,
        linkId,
        entityType,
        entityId,
        accountType: resultAccountType,
        position: resultPosition,
        status: 'active',
    };
});

export const updateUserAccess = protectedRegion.https.onCall(async (data, context) => {
    const actor = await requireCallableAdmin(context);
    const input = (data || {}) as UpdateUserAccessInput;
    const uid = text(input.uid, 160);
    const role = text(input.role, 80) || 'user';
    const position = text(input.position, 80);
    const additionalPositions = uniqueTexts(input.additionalPositions)
        .filter((value) => value !== position)
        .slice(0, 30);
    const syncLinkedProfiles = input.syncLinkedProfiles === true;
    if (!uid || !position) {
        throw new functions.https.HttpsError('invalid-argument', '사용자와 기본 직책을 확인해 주세요.');
    }

    const [positionByName, positionById] = await Promise.all([
        db.collection('positions').where('name', '==', position).limit(1).get(),
        db.collection('positions').doc(position).get(),
    ]);
    if (positionByName.empty && !positionById.exists) {
        throw new functions.https.HttpsError('failed-precondition', '등록되지 않은 직책은 부여할 수 없습니다.');
    }

    const userRef = db.collection('users').doc(uid);
    const menuPositionsRef = db.collection('system_configs').doc('user_menu_positions');
    const workerQuery = db.collection('workers').where('uid', '==', uid);
    const officeQuery = db.collection('office_staff').where('uid', '==', uid);
    const auditRef = db.collection('audit_logs').doc();
    let resultStatus = 'pending';

    await db.runTransaction(async (transaction) => {
        const [userSnapshot, menuPositionsSnapshot, workerSnapshot, officeSnapshot] = await Promise.all([
            transaction.get(userRef),
            transaction.get(menuPositionsRef),
            transaction.get(workerQuery),
            transaction.get(officeQuery),
        ]);
        if (!userSnapshot.exists) {
            throw new functions.https.HttpsError('not-found', '사용자 계정을 찾을 수 없습니다.');
        }

        const user = userSnapshot.data() || {};
        resultStatus = text(user.status, 40) || 'pending';
        if (resultStatus === 'suspended') {
            throw new functions.https.HttpsError('failed-precondition', '정지된 계정의 권한은 변경할 수 없습니다.');
        }
        const menuPositionMap = parseUserMenuPositionMap(menuPositionsSnapshot);
        if (additionalPositions.length > 0) menuPositionMap[uid] = additionalPositions;
        else delete menuPositionMap[uid];
        const now = admin.firestore.FieldValue.serverTimestamp();

        transaction.update(userRef, {
            role,
            position,
            additionalPositions,
            updatedAt: now,
        });
        transaction.set(menuPositionsRef, {
            id: 'user_menu_positions',
            data: JSON.stringify(menuPositionMap),
            updatedAt: now,
        }, { merge: true });
        if (syncLinkedProfiles) {
            workerSnapshot.docs.forEach((item) => transaction.update(item.ref, { role: position, updatedAt: now }));
            officeSnapshot.docs.forEach((item) => transaction.update(item.ref, { role: position, updatedAt: now }));
        }
        transaction.create(auditRef, {
            action: 'UPDATE_USER_ACCESS',
            category: 'AUTH',
            actorId: actor!.uid,
            actorEmail: text(actor?.token?.email, 160) || null,
            targetId: uid,
            before: {
                role: text(user.role, 80),
                position: text(user.position, 80),
                additionalPositions: uniqueTexts(user.additionalPositions),
            },
            after: { role, position, additionalPositions },
            syncLinkedProfiles,
            createdAt: now,
        });
    });

    await refreshAccessClaimsForUid(uid);
    return { uid, role, position, additionalPositions, status: resultStatus };
});

export const unlinkAccountConnection = protectedRegion.https.onCall(async (data, context) => {
    const actor = requireCallableAuth(context);
    const input = (data || {}) as UnlinkAccountConnectionInput;
    const uid = text(input.uid, 160) || actor!.uid;
    const entityType = text(input.entityType, 40) as EntityType;
    const entityId = text(input.entityId, 180);
    if (!['worker', 'office', 'company'].includes(entityType) || !entityId) {
        throw new functions.https.HttpsError('invalid-argument', '해제할 계정 연결을 확인해 주세요.');
    }
    if (uid !== actor!.uid) {
        await requireCallableAdmin(context);
    }

    const entityIds = new Set([...uniqueTexts(input.entityIds), entityId]);
    const userRef = db.collection('users').doc(uid);
    const linksQuery = db.collection('account_links').where('uid', '==', uid);
    const menuPositionsRef = db.collection('system_configs').doc('user_menu_positions');
    const auditRef = db.collection('audit_logs').doc();
    let remainingActiveLinkCount = 0;
    let nextStatus = 'pending';
    let nextPosition = '';

    await db.runTransaction(async (transaction) => {
        const [userSnapshot, linksSnapshot, menuPositionsSnapshot] = await Promise.all([
            transaction.get(userRef),
            transaction.get(linksQuery),
            transaction.get(menuPositionsRef),
        ]);
        if (!userSnapshot.exists) {
            throw new functions.https.HttpsError('not-found', '사용자 계정을 찾을 수 없습니다.');
        }

        const user = userSnapshot.data() || {};
        const expectedLinkId = buildLinkId(uid, entityType, entityId);
        const targetLinkSnapshot = linksSnapshot.docs.find((linkSnapshot) => {
            const link = linkSnapshot.data() || {};
            return linkSnapshot.id === expectedLinkId || (
                text(link.entityType, 40) === entityType
                && entityIds.has(text(link.entityId, 180))
            );
        });
        const targetLinkId = targetLinkSnapshot?.id || expectedLinkId;
        const remainingLinks = linksSnapshot.docs
            .filter((linkSnapshot) => {
                const link = linkSnapshot.data() || {};
                const isTarget = linkSnapshot.id === targetLinkId || (
                    text(link.entityType, 40) === entityType
                    && entityIds.has(text(link.entityId, 180))
                );
                return !isTarget && text(link.status, 40) === 'active';
            })
            .sort((left, right) => Number(right.data().updatedAt?.toMillis?.() || 0) - Number(left.data().updatedAt?.toMillis?.() || 0));
        const preferredLinkSnapshot = remainingLinks.find((linkSnapshot) => linkSnapshot.id === text(user.primaryLinkId, 500))
            || remainingLinks[0]
            || null;
        const preferredLink = preferredLinkSnapshot?.data() || {};

        let preferredEntity: Record<string, unknown> = {};
        if (preferredLinkSnapshot) {
            const preferredEntityType = text(preferredLink.entityType, 40) as EntityType;
            const preferredEntityId = text(preferredLink.entityId, 180);
            const collectionName = preferredEntityType === 'worker'
                ? 'workers'
                : preferredEntityType === 'office'
                    ? 'office_staff'
                    : 'companies';
            if (preferredEntityId && !preferredEntityId.startsWith('new_')) {
                const preferredEntitySnapshot = await transaction.get(db.collection(collectionName).doc(preferredEntityId));
                preferredEntity = preferredEntitySnapshot.data() || {};
            }
        }

        const targetCollectionName = entityType === 'worker'
            ? 'workers'
            : entityType === 'office'
                ? 'office_staff'
                : null;
        const targetEntitySnapshot = targetCollectionName
            ? await transaction.get(db.collection(targetCollectionName).doc(entityId))
            : null;

        const linkedWorkerIds = uniqueTexts(user.linkedWorkerIds).filter((id) =>
            entityType !== 'worker' || !entityIds.has(id)
        );
        const linkedOfficeStaffIds = uniqueTexts(user.linkedOfficeStaffIds).filter((id) =>
            entityType !== 'office' || !entityIds.has(id)
        );
        const linkedCompanyIds = uniqueTexts(user.linkedCompanyIds).filter((id) =>
            entityType !== 'company' || !entityIds.has(id)
        );
        const linkedSiteIds = Array.from(new Set(remainingLinks.flatMap((linkSnapshot) =>
            uniqueTexts(linkSnapshot.data()?.siteIds)
        )));
        const now = admin.firestore.FieldValue.serverTimestamp();
        remainingActiveLinkCount = remainingLinks.length;
        nextStatus = remainingLinks.length > 0 ? 'active' : 'pending';

        let nextDepartment = '';
        let nextAccountType = text(user.accountType, 40);
        if (preferredLinkSnapshot) {
            const preferredLinkType = text(preferredLink.accountType, 40) as AccountType;
            if (ACCOUNT_TYPES.has(preferredLinkType)) nextAccountType = preferredLinkType;
            const derivedProfile = positionFromAccountLink(preferredLink, preferredEntity);
            nextPosition = derivedProfile.position;
            nextDepartment = derivedProfile.department;
        }

        if (targetLinkSnapshot) {
            transaction.update(targetLinkSnapshot.ref, {
                status: 'inactive',
                accessRevokedAt: now,
                accessRevokedBy: actor!.uid,
                accessRevokedByEmail: text(actor?.token?.email, 160) || null,
                updatedAt: now,
            });
        }
        if (targetEntitySnapshot?.exists && text(targetEntitySnapshot.data()?.uid, 160) === uid) {
            transaction.update(targetEntitySnapshot.ref, { uid: '', updatedAt: now });
        }
        transaction.update(userRef, {
            linkedWorkerIds,
            linkedOfficeStaffIds,
            linkedCompanyIds,
            linkedSiteIds,
            primaryLinkId: preferredLinkSnapshot?.id || '',
            status: nextStatus,
            position: nextPosition,
            department: nextDepartment,
            ...(preferredLinkSnapshot
                ? {
                    accountType: nextAccountType,
                    requestedAccountType: admin.firestore.FieldValue.delete(),
                }
                : {
                    additionalPositions: [],
                    requestedAccountType: nextAccountType || admin.firestore.FieldValue.delete(),
                }),
            updatedAt: now,
        });
        if (!preferredLinkSnapshot) {
            transaction.set(menuPositionsRef, {
                id: 'user_menu_positions',
                data: JSON.stringify(removeUserMenuPositions(menuPositionsSnapshot, uid)),
                updatedAt: now,
            }, { merge: true });
        }
        transaction.create(auditRef, {
            action: 'UNLINK_ACCOUNT_CONNECTION',
            category: 'AUTH',
            actorId: actor!.uid,
            actorEmail: text(actor?.token?.email, 160) || null,
            targetId: uid,
            linkId: targetLinkId,
            entityType,
            entityId,
            remainingActiveLinkCount,
            createdAt: now,
        });
    });

    await refreshAccessClaimsForUid(uid).catch((error) => {
        functions.logger.warn('[accountAccess] Unlinked user claim refresh failed.', { uid, error });
    });

    return {
        uid,
        entityType,
        entityId,
        status: nextStatus,
        position: nextPosition,
        remainingActiveLinkCount,
    };
});

export const getMyAccountLinkCandidate = protectedRegion.https.onCall(async (data, context) => {
    const auth = requireCallableAuth(context);
    const input = (data || {}) as { phone?: unknown };
    const candidate = await findWorkerByPhone(input.phone);
    const worker = candidate.data();
    if (text(worker.uid, 160) && text(worker.uid, 160) !== auth?.uid) {
        throw new functions.https.HttpsError('already-exists', '이미 다른 계정에 연결된 작업자입니다.');
    }
    return {
        candidate: {
            id: candidate.id,
            name: text(worker.name, 120),
            teamName: text(worker.teamName, 120),
        },
    };
});

export const searchAccountLinkCompanies = protectedRegion.https.onCall(async (data, context) => {
    requireCallableAuth(context);
    const input = (data || {}) as { accountType?: unknown; searchTerm?: unknown; businessNumber?: unknown };
    const accountType = normalizeAccountType(input.accountType);
    if (!['partner_company', 'construction_company', 'rental_company'].includes(accountType)) {
        throw new functions.https.HttpsError('invalid-argument', '회사 가입 유형이 아닙니다.');
    }
    const searchTerm = text(input.searchTerm, 120).toLowerCase();
    const businessNumber = text(input.businessNumber, 40);
    if (!searchTerm && !businessNumber) return { companies: [] };

    const snapshot = businessNumber
        ? await db.collection('companies').where('businessNumber', '==', businessNumber).limit(10).get()
        : await db.collection('companies').where('name', '>=', searchTerm).where('name', '<=', `${searchTerm}\uf8ff`).limit(10).get();

    const companies = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Record<string, unknown> & { id: string }))
        .filter((company) => accountTypeFromCompanyType(company.type) === accountType)
        .filter((company) => !searchTerm || text(company.name, 120).toLowerCase().includes(searchTerm))
        .map((company) => ({
            id: company.id,
            name: text(company.name, 120),
            code: text(company.code, 80),
            type: text(company.type, 40),
            businessNumber: text(company.businessNumber, 40),
            ceoName: text(company.ceoName, 80),
            phone: text(company.phone, 40),
        }));
    return { companies };
});

export const submitAccountLinkRequest = protectedRegion.https.onCall(async (data, context) => {
    const auth = requireCallableAuth(context);
    const input = (data || {}) as SubmitAccountLinkRequestInput;
    const accountType = normalizeAccountType(input.accountType);
    const requestedEntity = sanitizeRequestedEntity(input.requestedEntity);
    const metadata = entityMetadata(accountType);
    const email = text(auth?.token?.email, 160).toLowerCase();
    const displayName = text(auth?.token?.name, 120) || text(requestedEntity.name, 120) || email;
    let entityId = text(input.entityId, 180);
    let entityName = text(input.entityName, 120) || text(requestedEntity.name, 120) || displayName;
    let entitySubType = metadata.entitySubType;
    let mergedRequestedEntity: RequestedEntity = { ...requestedEntity };

    const userSnapshot = await db.collection('users').doc(auth!.uid).get();
    if (BLOCKED_ACCOUNT_STATES.has(text(userSnapshot.data()?.status, 40))) {
        throw new functions.https.HttpsError('permission-denied', '정지된 계정은 새 연결 요청을 제출할 수 없습니다.');
    }

    if (metadata.entityType === 'worker') {
        const hasWorkerPhone = Boolean(text(input.workerPhone, 40));
        const verifiedCandidate = hasWorkerPhone
            ? await findWorkerByPhone(input.workerPhone)
            : null;
        if (entityId && verifiedCandidate && verifiedCandidate.id !== entityId) {
            throw new functions.https.HttpsError('failed-precondition', '본인확인한 작업자 정보와 승인 요청 대상이 일치하지 않습니다.');
        }
        const candidate = verifiedCandidate
            || (entityId ? await db.collection('workers').doc(entityId).get() : null);
        if (candidate?.exists) {
            const worker = candidate.data() || {};
            const linkedUid = text(worker.uid, 160);
            if (linkedUid && linkedUid !== auth!.uid) {
                throw new functions.https.HttpsError('already-exists', '이미 다른 계정에 연결된 작업자입니다.');
            }
            const isSelfLinked = linkedUid === auth!.uid;
            const isEmailMatched = Boolean(email) && text(worker.email, 160).toLowerCase() === email;
            if (!verifiedCandidate && !isSelfLinked && !isEmailMatched) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    '기존 작업자 연결에는 본인 휴대전화번호 확인이 필요합니다.'
                );
            }
            entityId = candidate.id;
            entityName = text(worker.name, 120) || entityName;
            mergedRequestedEntity = {
                ...mergedRequestedEntity,
                name: entityName,
                role: optionalText(worker.role, 80) || mergedRequestedEntity.role,
                department: optionalText(worker.teamName, 80) || mergedRequestedEntity.department,
            };
        } else if (entityId) {
            throw new functions.https.HttpsError('not-found', '선택한 작업자 정보를 찾을 수 없습니다.');
        } else {
            entityId = `new_${auth!.uid}_worker`;
        }
    } else if (metadata.entityType === 'office') {
        const candidate = entityId
            ? await db.collection('office_staff').doc(entityId).get()
            : await findUniqueByEmail('office_staff', email);
        if (candidate?.exists) {
            const staff = candidate.data() || {};
            const linkedUid = text(staff.uid, 160);
            if (linkedUid && linkedUid !== auth!.uid) {
                throw new functions.https.HttpsError('already-exists', '이미 다른 계정에 연결된 사무실 직원입니다.');
            }
            entityId = candidate.id;
            entityName = text(staff.name, 120) || entityName;
            mergedRequestedEntity = {
                ...mergedRequestedEntity,
                name: entityName,
                role: optionalText(staff.role, 80) || mergedRequestedEntity.role,
                department: optionalText(staff.department, 80) || mergedRequestedEntity.department,
            };
        } else if (entityId) {
            throw new functions.https.HttpsError('not-found', '선택한 사무실 직원 정보를 찾을 수 없습니다.');
        } else {
            entityId = `new_${auth!.uid}_office`;
        }
    } else {
        const company = await resolveCompany(entityId, requestedEntity, accountType);
        if (company?.exists) {
            const companyData = company.data() || {};
            const resolvedAccountType = accountTypeFromCompanyType(companyData.type);
            if (resolvedAccountType !== accountType) {
                throw new functions.https.HttpsError('failed-precondition', '선택한 회사 유형이 가입 유형과 일치하지 않습니다.');
            }
            entityId = company.id;
            entityName = text(companyData.name, 120) || entityName;
            entitySubType = text(companyData.type, 40) || entitySubType;
            mergedRequestedEntity = {
                ...mergedRequestedEntity,
                name: entityName,
                businessNumber: optionalText(companyData.businessNumber, 40) || mergedRequestedEntity.businessNumber,
            };
        } else {
            if (!text(requestedEntity.name, 120) || !text(requestedEntity.businessNumber, 40)) {
                throw new functions.https.HttpsError('invalid-argument', '신규 회사는 회사명과 사업자번호가 필요합니다.');
            }
            entityId = `new_${auth!.uid}_company`;
            entitySubType = companyTypeFromAccountType(accountType, input.companyType);
        }
    }

    const linkId = buildLinkId(auth!.uid, metadata.entityType, entityId);
    const linkRef = db.collection('account_links').doc(linkId);
    const userRef = db.collection('users').doc(auth!.uid);
    const auditRef = db.collection('audit_logs').doc();
    const now = admin.firestore.FieldValue.serverTimestamp();

    await db.runTransaction(async (transaction) => {
        const [existingLink, existingUser] = await Promise.all([
            transaction.get(linkRef),
            transaction.get(userRef),
        ]);
        if (text(existingLink.data()?.status, 40) === 'active') {
            throw new functions.https.HttpsError('already-exists', '이미 활성화된 연결입니다.');
        }
        const currentUser = existingUser.data() || {};
        const currentStatus = text(currentUser.status, 40);
        const remainsActive = currentStatus === 'active';
        transaction.set(linkRef, {
            uid: auth!.uid,
            userEmail: email || null,
            userDisplayName: displayName || null,
            accountType,
            entityType: metadata.entityType,
            entityId,
            entityName,
            entitySubType,
            relationRole: normalizeRelationRole(input.relationRole),
            status: 'pending',
            siteIds: [],
            requestedEntity: mergedRequestedEntity,
            memo: optionalText(input.memo, 500) || optionalText(mergedRequestedEntity.memo, 500) || null,
            requestedAt: now,
            updatedAt: now,
            ...(existingLink.exists ? {} : { createdAt: now }),
        }, { merge: true });
        transaction.set(userRef, {
            uid: auth!.uid,
            email: email || null,
            displayName: displayName || null,
            photoURL: optionalText(auth?.token?.picture, 500) || currentUser.photoURL || null,
            lastLogin: now,
            role: currentUser.role || 'user',
            linkedWorkerIds: uniqueTexts(currentUser.linkedWorkerIds),
            linkedCompanyIds: uniqueTexts(currentUser.linkedCompanyIds),
            linkedOfficeStaffIds: uniqueTexts(currentUser.linkedOfficeStaffIds),
            linkedSiteIds: uniqueTexts(currentUser.linkedSiteIds),
            status: remainsActive ? 'active' : 'pending',
            requestedAccountType: accountType,
            primaryLinkId: remainsActive ? currentUser.primaryLinkId || '' : linkId,
            updatedAt: now,
        }, { merge: true });
        transaction.create(auditRef, {
            action: 'SUBMIT_ACCOUNT_LINK_REQUEST',
            category: 'AUTH',
            actorId: auth!.uid,
            targetId: linkId,
            entityType: metadata.entityType,
            entityId,
            accountType,
            createdAt: now,
        });
    });

    return { linkId, status: 'pending', entityId, entityName, accountType };
});

export const getMyAccountLinkStatus = protectedRegion.https.onCall(async (_data, context) => {
    const auth = requireCallableAuth(context);
    const [userSnapshot, linksSnapshot] = await Promise.all([
        db.collection('users').doc(auth!.uid).get(),
        db.collection('account_links').where('uid', '==', auth!.uid).get(),
    ]);
    const user = userSnapshot.data() || {};
    const links = linksSnapshot.docs
        .sort((a, b) => Number(b.data().requestedAt?.toMillis?.() || 0) - Number(a.data().requestedAt?.toMillis?.() || 0))
        .map(statusPayload);
    return {
        user: {
            uid: auth!.uid,
            status: text(user.status, 40) || 'pending',
            accountType: text(user.accountType, 40) || null,
            requestedAccountType: text(user.requestedAccountType, 40) || null,
            linkedCompanyIds: uniqueTexts(user.linkedCompanyIds),
            linkedSiteIds: uniqueTexts(user.linkedSiteIds),
        },
        links,
    };
});

export const revokeUserAccessApproval = protectedRegion.https.onCall(async (data, context) => {
    const actor = await requireCallableAdmin(context);
    const input = (data || {}) as { uid?: unknown };
    const uid = text(input.uid, 160);
    if (!uid) throw new functions.https.HttpsError('invalid-argument', '승인을 해제할 사용자가 필요합니다.');
    if (uid === actor!.uid) {
        throw new functions.https.HttpsError('failed-precondition', '현재 로그인한 관리자 자신의 승인은 해제할 수 없습니다.');
    }

    const userRef = db.collection('users').doc(uid);
    const linksQuery = db.collection('account_links').where('uid', '==', uid);
    const menuPositionsRef = db.collection('system_configs').doc('user_menu_positions');
    const auditRef = db.collection('audit_logs').doc();
    let requeuedLinks = 0;

    await db.runTransaction(async (transaction) => {
        const [userSnapshot, linksSnapshot, menuPositionsSnapshot] = await Promise.all([
            transaction.get(userRef),
            transaction.get(linksQuery),
            transaction.get(menuPositionsRef),
        ]);
        if (!userSnapshot.exists) {
            throw new functions.https.HttpsError('not-found', '사용자 계정을 찾을 수 없습니다.');
        }

        const user = userSnapshot.data() || {};
        if (text(user.status, 40) === 'suspended') {
            throw new functions.https.HttpsError('failed-precondition', '정지된 계정은 승인 해제 대신 계정 상태를 먼저 변경해 주세요.');
        }

        const now = admin.firestore.FieldValue.serverTimestamp();
        const activeLinkSnapshots = linksSnapshot.docs.filter((linkSnapshot) =>
            text(linkSnapshot.data()?.status, 40) === 'active'
        );
        requeuedLinks = activeLinkSnapshots.length;
        activeLinkSnapshots.forEach((linkSnapshot) => {
            transaction.update(linkSnapshot.ref, {
                status: 'pending',
                requestedAt: now,
                accessRevokedAt: now,
                accessRevokedBy: actor!.uid,
                accessRevokedByEmail: text(actor?.token?.email, 160) || null,
                updatedAt: now,
            });
        });

        const accountType = text(user.accountType, 40);
        transaction.update(userRef, {
            position: '',
            department: '',
            additionalPositions: [],
            status: 'pending',
            requestedAccountType: accountType || admin.firestore.FieldValue.delete(),
            linkedSiteIds: [],
            updatedAt: now,
        });
        transaction.set(menuPositionsRef, {
            id: 'user_menu_positions',
            data: JSON.stringify(removeUserMenuPositions(menuPositionsSnapshot, uid)),
            updatedAt: now,
        }, { merge: true });
        transaction.create(auditRef, {
            action: 'REVOKE_USER_ACCESS_APPROVAL',
            category: 'AUTH',
            actorId: actor!.uid,
            actorEmail: text(actor?.token?.email, 160) || null,
            targetId: uid,
            requeuedLinks,
            createdAt: now,
        });
    });

    await refreshAccessClaimsForUid(uid).catch((error) => {
        functions.logger.warn('[accountAccess] Revoked user claim refresh failed.', { uid, error });
    });

    return { uid, status: 'pending', requeuedLinks };
});

const siteBelongsToCompany = (
    siteId: string,
    site: Record<string, unknown>,
    companyId: string,
    companySiteIds: string[]
): boolean => companySiteIds.includes(siteId) || [
    site.clientCompanyId,
    site.constructorCompanyId,
    site.companyId,
    site.rentalCompanyId,
].map((value) => text(value, 180)).includes(companyId);

export const approveAccountLinkRequest = protectedRegion.https.onCall(async (data, context) => {
    const actor = await requireCallableAdmin(context);
    const input = (data || {}) as { linkId?: unknown; siteIds?: unknown };
    const linkId = text(input.linkId, 500);
    if (!linkId) throw new functions.https.HttpsError('invalid-argument', '승인할 연결 요청이 필요합니다.');
    const explicitlyRequestedSiteIds = uniqueTexts(input.siteIds).slice(0, 100);
    const linkRef = db.collection('account_links').doc(linkId);
    const auditRef = db.collection('audit_logs').doc();
    let targetUid = '';
    let discoveredCompanySiteIds: string[] = [];

    const initialLinkSnapshot = await linkRef.get();
    const initialLink = initialLinkSnapshot.data() || {};
    const initialCompanyId = text(initialLink.entityId, 180);
    if (text(initialLink.entityType, 40) === 'company' && initialCompanyId && !initialCompanyId.startsWith('new_')) {
        const siteSnapshots = await Promise.all([
            db.collection('sites').where('clientCompanyId', '==', initialCompanyId).get(),
            db.collection('sites').where('constructorCompanyId', '==', initialCompanyId).get(),
            db.collection('sites').where('companyId', '==', initialCompanyId).get(),
            db.collection('sites').where('rentalCompanyId', '==', initialCompanyId).get(),
        ]);
        discoveredCompanySiteIds = Array.from(new Set(siteSnapshots.flatMap((snapshot) => snapshot.docs.map((doc) => doc.id))));
    }

    const result = await db.runTransaction(async (transaction) => {
        const linkSnapshot = await transaction.get(linkRef);
        if (!linkSnapshot.exists) throw new functions.https.HttpsError('not-found', '연결 요청을 찾을 수 없습니다.');
        const link = linkSnapshot.data() || {};
        if (text(link.status, 40) === 'active') {
            targetUid = text(link.uid, 160);
            return { linkId, status: 'active', siteIds: uniqueTexts(link.siteIds), reused: true };
        }
        if (text(link.status, 40) !== 'pending') {
            throw new functions.https.HttpsError('failed-precondition', '승인 대기 상태의 요청만 승인할 수 있습니다.');
        }

        const uid = text(link.uid, 160);
        const entityType = text(link.entityType, 40) as EntityType;
        const accountType = normalizeAccountType(link.accountType);
        const requested = sanitizeRequestedEntity(link.requestedEntity);
        const userRef = db.collection('users').doc(uid);
        const userSnapshot = await transaction.get(userRef);
        if (!userSnapshot.exists) throw new functions.https.HttpsError('not-found', '사용자 계정을 찾을 수 없습니다.');
        const user = userSnapshot.data() || {};
        if (text(user.status, 40) === 'suspended') {
            throw new functions.https.HttpsError('failed-precondition', '정지된 계정 요청은 승인할 수 없습니다.');
        }

        let entityId = text(link.entityId, 180);
        let entityName = text(link.entityName, 120);
        let position = text(requested.role, 80);
        let department = text(requested.department, 80);
        let approvedSiteIds: string[] = [];
        let workerRef: admin.firestore.DocumentReference | null = null;
        let officeRef: admin.firestore.DocumentReference | null = null;
        let companyRef: admin.firestore.DocumentReference | null = null;
        let workerData: Record<string, unknown> = {};
        let officeData: Record<string, unknown> = {};
        let companyData: Record<string, unknown> = {};
        let createTarget = false;

        if (entityType === 'worker') {
            workerRef = entityId.startsWith('new_') ? db.collection('workers').doc() : db.collection('workers').doc(entityId);
            const workerSnapshot = entityId.startsWith('new_') ? null : await transaction.get(workerRef);
            if (workerSnapshot && !workerSnapshot.exists) throw new functions.https.HttpsError('not-found', '작업자 정보를 찾을 수 없습니다.');
            workerData = workerSnapshot?.data() || {};
            const linkedUid = text(workerData.uid, 160);
            if (linkedUid && linkedUid !== uid) throw new functions.https.HttpsError('already-exists', '이미 다른 계정에 연결된 작업자입니다.');
            createTarget = !workerSnapshot;
            entityId = workerRef.id;
            entityName = text(workerData.name, 120) || text(requested.name, 120) || entityName;
            position = text(workerData.role, 80) || position || '일반';
            department = text(workerData.teamName, 80) || department;
            approvedSiteIds = explicitlyRequestedSiteIds.length > 0
                ? explicitlyRequestedSiteIds
                : uniqueTexts([workerData.siteId]);
        } else if (entityType === 'office') {
            officeRef = entityId.startsWith('new_') || entityId === 'office'
                ? db.collection('office_staff').doc()
                : db.collection('office_staff').doc(entityId);
            const officeSnapshot = entityId.startsWith('new_') || entityId === 'office' ? null : await transaction.get(officeRef);
            if (officeSnapshot && !officeSnapshot.exists) throw new functions.https.HttpsError('not-found', '사무실 직원 정보를 찾을 수 없습니다.');
            officeData = officeSnapshot?.data() || {};
            const linkedUid = text(officeData.uid, 160);
            if (linkedUid && linkedUid !== uid) throw new functions.https.HttpsError('already-exists', '이미 다른 계정에 연결된 사무실 직원입니다.');
            createTarget = !officeSnapshot;
            entityId = officeRef.id;
            entityName = text(officeData.name, 120) || text(requested.name, 120) || entityName;
            position = createTarget ? '사무실직원' : text(officeData.role, 80) || '사무실직원';
            department = text(officeData.department, 80) || department;
        } else if (entityType === 'company') {
            companyRef = entityId.startsWith('new_') ? db.collection('companies').doc() : db.collection('companies').doc(entityId);
            const companySnapshot = entityId.startsWith('new_') ? null : await transaction.get(companyRef);
            if (companySnapshot && !companySnapshot.exists) throw new functions.https.HttpsError('not-found', '회사 정보를 찾을 수 없습니다.');
            companyData = companySnapshot?.data() || {};
            createTarget = !companySnapshot;
            entityId = companyRef.id;
            entityName = text(companyData.name, 120) || text(requested.name, 120) || entityName;
            position = position || text(link.entitySubType, 40);
            const companySiteIds = Array.from(new Set([
                ...uniqueTexts(companyData.siteIds),
                ...discoveredCompanySiteIds,
            ]));
            approvedSiteIds = explicitlyRequestedSiteIds.length > 0 ? explicitlyRequestedSiteIds : companySiteIds;
            for (const siteId of approvedSiteIds) {
                const siteSnapshot = await transaction.get(db.collection('sites').doc(siteId));
                if (!siteSnapshot.exists || !siteBelongsToCompany(siteId, siteSnapshot.data() || {}, entityId, companySiteIds)) {
                    throw new functions.https.HttpsError('invalid-argument', '선택한 현장이 연결 회사 범위에 포함되지 않습니다.');
                }
            }
        } else {
            throw new functions.https.HttpsError('invalid-argument', '지원하지 않는 연결 대상입니다.');
        }

        if (!position) {
            throw new functions.https.HttpsError('failed-precondition', '승인할 계정의 직책을 확인해 주세요.');
        }

        const now = admin.firestore.FieldValue.serverTimestamp();
        if (workerRef) {
            if (createTarget) {
                transaction.create(workerRef, {
                    name: entityName,
                    email: text(user.email, 160),
                    contact: text(requested.phone, 40),
                    address: text(requested.address, 240),
                    role: position,
                    teamName: department,
                    teamType: '미배정',
                    status: '미배정',
                    unitPrice: 0,
                    uid,
                    createdAt: now,
                    updatedAt: now,
                });
            } else {
                transaction.update(workerRef, {
                    uid,
                    ...(text(workerData.role, 80) ? {} : { role: position }),
                    updatedAt: now,
                });
            }
        }
        if (officeRef) {
            if (createTarget) {
                const salaryModel = text(requested.salaryModel, 40) || '월급제';
                transaction.create(officeRef, {
                    name: entityName,
                    email: text(user.email, 160),
                    contact: text(requested.phone, 40),
                    address: text(requested.address, 240),
                    department,
                    role: position,
                    employmentType: text(requested.employmentType, 40) || '정규직',
                    salaryModel,
                    payType: salaryModel,
                    unitPrice: Number(requested.unitPrice || 0),
                    status: '재직',
                    isActive: true,
                    memo: text(requested.memo, 500),
                    uid,
                    createdAt: now,
                    updatedAt: now,
                });
            } else {
                transaction.update(officeRef, {
                    uid,
                    ...(text(officeData.role, 80) ? {} : { role: position }),
                    updatedAt: now,
                });
            }
        }
        if (companyRef && createTarget) {
            const companyType = companyTypeFromAccountType(accountType, link.entitySubType);
            transaction.create(companyRef, {
                name: entityName,
                code: `REQ-${companyRef.id.slice(0, 8).toUpperCase()}`,
                businessNumber: text(requested.businessNumber, 40),
                ceoName: text(requested.ceoName, 80),
                phone: text(requested.phone, 40),
                email: text(requested.email, 160),
                address: text(requested.address, 240),
                type: companyType,
                siteIds: [],
                siteNames: [],
                status: 'active',
                totalManDay: 0,
                createdAt: now,
                updatedAt: now,
            });
        }

        const linkedWorkerIds = uniqueTexts(user.linkedWorkerIds);
        const linkedOfficeStaffIds = uniqueTexts(user.linkedOfficeStaffIds);
        const linkedCompanyIds = uniqueTexts(user.linkedCompanyIds);
        if (entityType === 'worker') linkedWorkerIds.push(entityId);
        if (entityType === 'office') linkedOfficeStaffIds.push(entityId);
        if (entityType === 'company') linkedCompanyIds.push(entityId);

        transaction.update(linkRef, {
            entityId,
            entityName,
            status: 'active',
            siteIds: approvedSiteIds,
            approvalMode: 'manual',
            approvedBy: actor!.uid,
            approvedByEmail: text(actor?.token?.email, 160) || null,
            approvedAt: now,
            updatedAt: now,
        });
        transaction.update(userRef, {
            accountType,
            requestedAccountType: admin.firestore.FieldValue.delete(),
            status: 'active',
            primaryLinkId: linkId,
            linkedWorkerIds: Array.from(new Set(linkedWorkerIds)),
            linkedOfficeStaffIds: Array.from(new Set(linkedOfficeStaffIds)),
            linkedCompanyIds: Array.from(new Set(linkedCompanyIds)),
            linkedSiteIds: Array.from(new Set([...uniqueTexts(user.linkedSiteIds), ...approvedSiteIds])),
            ...(position ? { position } : {}),
            ...(department ? { department } : {}),
            updatedAt: now,
        });
        transaction.create(auditRef, {
            action: 'APPROVE_ACCOUNT_LINK_REQUEST',
            category: 'AUTH',
            actorId: actor!.uid,
            actorEmail: text(actor?.token?.email, 160) || null,
            targetId: uid,
            linkId,
            entityType,
            entityId,
            siteIds: approvedSiteIds,
            createdAt: now,
        });
        targetUid = uid;
        return { linkId, status: 'active', entityId, entityName, siteIds: approvedSiteIds, reused: false };
    });

    if (targetUid) {
        await refreshAccessClaimsForUid(targetUid).catch((error) => {
            functions.logger.warn('[accountAccess] Access claim refresh will rely on the user write trigger.', { targetUid, error });
        });
    }
    return result;
});

export const rejectAccountLinkRequest = protectedRegion.https.onCall(async (data, context) => {
    const actor = await requireCallableAdmin(context);
    const input = (data || {}) as { linkId?: unknown; reason?: unknown };
    const linkId = text(input.linkId, 500);
    const reason = text(input.reason, 500);
    if (!linkId) throw new functions.https.HttpsError('invalid-argument', '반려할 연결 요청이 필요합니다.');
    const linkRef = db.collection('account_links').doc(linkId);
    const auditRef = db.collection('audit_logs').doc();
    let targetUid = '';

    await db.runTransaction(async (transaction) => {
        const linkSnapshot = await transaction.get(linkRef);
        if (!linkSnapshot.exists) throw new functions.https.HttpsError('not-found', '연결 요청을 찾을 수 없습니다.');
        const link = linkSnapshot.data() || {};
        if (text(link.status, 40) !== 'pending') {
            throw new functions.https.HttpsError('failed-precondition', '승인 대기 상태의 요청만 반려할 수 있습니다.');
        }
        const uid = text(link.uid, 160);
        const userRef = db.collection('users').doc(uid);
        const menuPositionsRef = db.collection('system_configs').doc('user_menu_positions');
        const [activeLinks, menuPositionsSnapshot] = await Promise.all([
            transaction.get(db.collection('account_links').where('uid', '==', uid)),
            transaction.get(menuPositionsRef),
        ]);
        const hasOtherActiveLink = activeLinks.docs.some((doc) => doc.id !== linkId && text(doc.data().status, 40) === 'active');
        const now = admin.firestore.FieldValue.serverTimestamp();
        transaction.update(linkRef, {
            status: 'rejected',
            rejectionReason: reason || null,
            rejectedBy: actor!.uid,
            rejectedByEmail: text(actor?.token?.email, 160) || null,
            rejectedAt: now,
            updatedAt: now,
        });
        transaction.update(userRef, {
            status: hasOtherActiveLink ? 'active' : 'rejected',
            ...(hasOtherActiveLink ? {} : {
                primaryLinkId: '',
                position: '',
                department: '',
                additionalPositions: [],
                linkedSiteIds: [],
            }),
            updatedAt: now,
        });
        if (!hasOtherActiveLink) {
            transaction.set(menuPositionsRef, {
                id: 'user_menu_positions',
                data: JSON.stringify(removeUserMenuPositions(menuPositionsSnapshot, uid)),
                updatedAt: now,
            }, { merge: true });
        }
        transaction.create(auditRef, {
            action: 'REJECT_ACCOUNT_LINK_REQUEST',
            category: 'AUTH',
            actorId: actor!.uid,
            actorEmail: text(actor?.token?.email, 160) || null,
            targetId: uid,
            linkId,
            reason: reason || null,
            createdAt: now,
        });
        targetUid = uid;
    });

    if (targetUid) {
        await refreshAccessClaimsForUid(targetUid).catch((error) => {
            functions.logger.warn('[accountAccess] Rejected user claim refresh failed.', { targetUid, error });
        });
    }
    return { linkId, status: 'rejected' };
});
