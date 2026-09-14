import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRight,
    faArrowsRotate,
    faBuilding,
    faCheckCircle,
    faEnvelope,
    faHardHat,
    faHourglassHalf,
    faIdBadge,
    faLink,
    faSearch,
    faSpinner,
    faUser,
    faXmark
} from '@fortawesome/free-solid-svg-icons';
import { userService, UserData } from '../../services/userService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { companyService, Company } from '../../services/companyService';
import { officeStaffService, OfficeStaff } from '../../services/officeStaffService';
import { accountLinkService } from '../../services/accountLinkService';
import {
    AccountLink,
    AccountRelationRole,
    ACCOUNT_RELATION_ROLE_LABELS,
    getAccountRelationRoleLabel,
} from '../../types/accountLink';
import { findBusinessPartnerPositionDefinition } from '../../constants/businessPartnerPositions';
import { summarizeAccountConnections, userStatusLabel } from '../../utils/userManagementPresentation';
import '../../pages/admin/UserManagementPage.css';

interface AccountLinkManagerProps {
    users?: UserData[];
    workers?: Worker[];
    loading?: boolean;
    selectedUserId?: string;
    lockedUserId?: string;
    onSelectUser?: (uid: string) => void;
    onChanged?: () => void | Promise<void>;
    actorEmail?: string;
    embedded?: boolean;
    className?: string;
    onManageAccess?: (uid: string) => void;
    previewData?: { companies: Company[]; officeStaff: OfficeStaff[]; links: AccountLink[] };
}

type LinkTab = 'worker' | 'office' | 'company' | 'pending';
type CompanyFilter = 'all' | '협력사' | '건설사' | '임대사';
type PendingReviewMode = 'approve' | 'reject';

const toText = (value: unknown): string => String(value ?? '').trim();

const getTimestampMillis = (value: unknown): number => {
    if (!value || typeof value !== 'object') return 0;
    const timestamp = value as { toMillis?: () => number; seconds?: number };
    if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
    if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000;
    return 0;
};

const formatLastLogin = (value: unknown): string => {
    const millis = getTimestampMillis(value);
    if (!millis) return '-';
    return new Date(millis).toLocaleString();
};

const getUserLabel = (user?: UserData | null): string => {
    if (!user) return '-';
    return user.displayName || user.email || user.uid;
};

const getErrorMessage = (error: unknown): string => {
    const code = toText((error as { code?: unknown })?.code);
    const message = error instanceof Error ? error.message : String(error);
    if (code === 'functions/unauthenticated') return '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.';
    if (code === 'functions/permission-denied') return '계정 연결·승인 권한이 없습니다. 관리자 권한을 확인해 주세요.';
    if (code === 'functions/not-found') return '계정 연결 서버 기능을 찾을 수 없습니다. Functions 배포 상태를 확인해 주세요.';
    if (code === 'functions/failed-precondition') return message || '현재 상태에서는 처리할 수 없는 요청입니다.';
    if (code === 'functions/internal') return '서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    if (message === 'worker-not-found') return '작업자 정보를 찾을 수 없습니다.';
    if (message === 'company-not-found') return '회사 정보를 찾을 수 없습니다.';
    if (message === 'office-staff-not-found') return '사무실 직원 정보를 찾을 수 없습니다.';
    if (message === 'worker-already-managed') return '이미 다른 계정에 연결된 작업자입니다.';
    if (message === 'office-staff-already-managed') return '이미 다른 계정에 연결된 사무실 직원입니다.';
    if (message === 'account-link-invalid-input') return '연결 정보가 올바르지 않습니다.';
    return message || '처리 중 오류가 발생했습니다.';
};

const isConstructionType = (type: unknown): boolean => {
    const value = toText(type);
    return value === '건설사' || value === '시공사';
};

const matchesCompanyFilter = (company: Company, filter: CompanyFilter): boolean => {
    if (filter === 'all') return true;
    if (filter === '건설사') return isConstructionType(company.type);
    return company.type === filter;
};

const relationRoleOptions: AccountRelationRole[] = ['owner', 'manager', 'staff', 'viewer'];

const getCompanyPositionName = (company: Pick<Company, 'type'>): string =>
    findBusinessPartnerPositionDefinition(company.type, company.type)?.name || '';

const getAccountLinkPositionName = (link: AccountLink): string =>
    toText(link.requestedEntity?.role) || findBusinessPartnerPositionDefinition(link.entitySubType, link.entitySubType)?.name || '';

const AccountLinkManager: React.FC<AccountLinkManagerProps> = ({
    users,
    workers,
    loading: externalLoading = false,
    selectedUserId,
    lockedUserId,
    onSelectUser,
    onChanged,
    actorEmail = 'system',
    embedded = false,
    className = '',
    onManageAccess,
    previewData,
}) => {
    const isControlledUserWorkerData = Array.isArray(users) && Array.isArray(workers);

    const [internalUsers, setInternalUsers] = useState<UserData[]>([]);
    const [internalWorkers, setInternalWorkers] = useState<Worker[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [officeStaffRows, setOfficeStaffRows] = useState<OfficeStaff[]>([]);
    const [accountLinks, setAccountLinks] = useState<AccountLink[]>([]);
    const [internalLoading, setInternalLoading] = useState(!isControlledUserWorkerData);
    const [metaLoading, setMetaLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userSearch, setUserSearch] = useState('');
    const [connectionFilter, setConnectionFilter] = useState<'all' | 'linked' | 'unlinked' | 'pending'>('all');
    const [targetSearch, setTargetSearch] = useState('');
    const [activeTab, setActiveTab] = useState<LinkTab>('worker');
    const [companyFilter, setCompanyFilter] = useState<CompanyFilter>('all');
    const [companyRelationRole, setCompanyRelationRole] = useState<AccountRelationRole>('staff');
    const [internalSelectedUserId, setInternalSelectedUserId] = useState('');
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [selectedOfficeStaffId, setSelectedOfficeStaffId] = useState('');
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [pendingReview, setPendingReview] = useState<{ linkId: string; mode: PendingReviewMode } | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [processingLinkId, setProcessingLinkId] = useState('');
    const [didOpenPendingTab, setDidOpenPendingTab] = useState(false);

    const effectiveUsers = users ?? internalUsers;
    const effectiveWorkers = workers ?? internalWorkers;
    const loading = externalLoading || internalLoading || metaLoading;
    const activeSelectedUserId = lockedUserId ?? selectedUserId ?? internalSelectedUserId;
    const visibleUsers = useMemo(
        () => lockedUserId ? effectiveUsers.filter((user) => user.uid === lockedUserId) : effectiveUsers,
        [effectiveUsers, lockedUserId]
    );

    const fetchInternalUserWorkerData = useCallback(async () => {
        if (isControlledUserWorkerData) return;
        setInternalLoading(true);
        try {
            const [usersData, workersData] = await Promise.all([
                userService.getAllUsers(),
                manpowerService.getWorkers(true)
            ]);
            setInternalUsers(usersData);
            setInternalWorkers(workersData);
        } finally {
            setInternalLoading(false);
        }
    }, [isControlledUserWorkerData]);

    const fetchMetaData = useCallback(async () => {
        setMetaLoading(true);
        try {
            if (previewData) {
                setCompanies(previewData.companies);
                setOfficeStaffRows(previewData.officeStaff);
                setAccountLinks(previewData.links);
                return;
            }
            const [companyRows, officeRows, linkRows] = await Promise.all([
                companyService.getCompanies(),
                officeStaffService.getOfficeStaff(true),
                accountLinkService.getAllLinks()
            ]);
            setCompanies(companyRows);
            setOfficeStaffRows(officeRows);
            setAccountLinks(linkRows);
        } catch {
            setError('연결 정보를 불러오지 못했습니다. 새로고침을 눌러 다시 시도해 주세요.');
        } finally {
            setMetaLoading(false);
        }
    }, [previewData]);

    useEffect(() => {
        void fetchInternalUserWorkerData();
    }, [fetchInternalUserWorkerData]);

    useEffect(() => {
        void fetchMetaData();
    }, [fetchMetaData]);

    const reloadAfterChange = async () => {
        if (onChanged) await onChanged();
        await Promise.all([
            fetchInternalUserWorkerData(),
            fetchMetaData(),
        ]);
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        setError(null);
        try {
            await reloadAfterChange();
        } finally {
            setRefreshing(false);
        }
    };

    const userByUid = useMemo(() => {
        const map = new Map<string, UserData>();
        effectiveUsers.forEach((user) => map.set(user.uid, user));
        return map;
    }, [effectiveUsers]);

    const workerById = useMemo(() => {
        const map = new Map<string, Worker>();
        effectiveWorkers.forEach((worker) => {
            if (worker.id) map.set(String(worker.id), worker);
            if (worker.legacyId) map.set(String(worker.legacyId), worker);
        });
        return map;
    }, [effectiveWorkers]);

    const companyById = useMemo(() => {
        const map = new Map<string, Company>();
        companies.forEach((company) => {
            if (company.id) map.set(String(company.id), company);
            if (company.legacyId) map.set(String(company.legacyId), company);
        });
        return map;
    }, [companies]);

    const officeStaffById = useMemo(() => {
        const map = new Map<string, OfficeStaff>();
        officeStaffRows.forEach((staff) => {
            if (staff.id) map.set(String(staff.id), staff);
            if (staff.legacyId) map.set(String(staff.legacyId), staff);
        });
        return map;
    }, [officeStaffRows]);

    const ownerByWorkerId = useMemo(() => {
        const map = new Map<string, string>();

        effectiveUsers.forEach((user) => {
            (user.linkedWorkerIds || []).forEach((rawId) => {
                const worker = workerById.get(String(rawId));
                const keys = [rawId, worker?.id, worker?.legacyId].map(toText).filter(Boolean);
                keys.forEach((key) => map.set(key, user.uid));
            });
        });

        effectiveWorkers.forEach((worker) => {
            const uid = toText(worker.uid);
            if (!uid) return;
            [worker.id, worker.legacyId].map(toText).filter(Boolean).forEach((key) => {
                if (!map.has(key)) map.set(key, uid);
            });
        });

        accountLinks
            .filter((link) => link.entityType === 'worker' && link.status === 'active')
            .forEach((link) => {
                if (link.entityId && !map.has(link.entityId)) map.set(link.entityId, link.uid);
            });

        return map;
    }, [accountLinks, effectiveUsers, effectiveWorkers, workerById]);

    const linkedWorkersByUserId = useMemo(() => {
        const map = new Map<string, Worker[]>();

        effectiveUsers.forEach((user) => {
            const workerMap = new Map<string, Worker>();
            (user.linkedWorkerIds || []).forEach((rawId) => {
                const worker = workerById.get(String(rawId));
                if (worker?.id) workerMap.set(String(worker.id), worker);
            });
            effectiveWorkers.forEach((worker) => {
                if (worker.uid === user.uid && worker.id) workerMap.set(String(worker.id), worker);
            });
            accountLinks
                .filter((link) => link.uid === user.uid && link.entityType === 'worker' && link.status === 'active')
                .forEach((link) => {
                    const worker = workerById.get(link.entityId);
                    if (worker?.id) workerMap.set(String(worker.id), worker);
                });
            map.set(user.uid, Array.from(workerMap.values()));
        });

        return map;
    }, [accountLinks, effectiveUsers, effectiveWorkers, workerById]);

    const ownerByOfficeStaffId = useMemo(() => {
        const map = new Map<string, string>();

        effectiveUsers.forEach((user) => {
            (user.linkedOfficeStaffIds || []).forEach((rawId) => {
                const staff = officeStaffById.get(String(rawId));
                const keys = [rawId, staff?.id, staff?.legacyId].map(toText).filter(Boolean);
                keys.forEach((key) => map.set(key, user.uid));
            });
        });

        officeStaffRows.forEach((staff) => {
            const uid = toText(staff.uid);
            if (!uid) return;
            [staff.id, staff.legacyId].map(toText).filter(Boolean).forEach((key) => {
                if (!map.has(key)) map.set(key, uid);
            });
        });

        accountLinks
            .filter((link) => link.entityType === 'office' && link.status === 'active' && link.entityId !== 'office')
            .forEach((link) => {
                if (link.entityId && !map.has(link.entityId)) map.set(link.entityId, link.uid);
            });

        return map;
    }, [accountLinks, effectiveUsers, officeStaffById, officeStaffRows]);

    const linkedOfficeStaffByUserId = useMemo(() => {
        const map = new Map<string, OfficeStaff[]>();

        effectiveUsers.forEach((user) => {
            const staffMap = new Map<string, OfficeStaff>();
            (user.linkedOfficeStaffIds || []).forEach((rawId) => {
                const staff = officeStaffById.get(String(rawId));
                if (staff?.id) staffMap.set(String(staff.id), staff);
            });
            officeStaffRows.forEach((staff) => {
                if (staff.uid === user.uid && staff.id) staffMap.set(String(staff.id), staff);
            });
            accountLinks
                .filter((link) => link.uid === user.uid && link.entityType === 'office' && link.status === 'active' && link.entityId !== 'office')
                .forEach((link) => {
                    const staff = officeStaffById.get(link.entityId);
                    if (staff?.id) staffMap.set(String(staff.id), staff);
                });
            map.set(user.uid, Array.from(staffMap.values()));
        });

        return map;
    }, [accountLinks, effectiveUsers, officeStaffById, officeStaffRows]);

    const companyLinksByUserId = useMemo(() => {
        const map = new Map<string, AccountLink[]>();
        effectiveUsers.forEach((user) => map.set(user.uid, []));
        accountLinks
            .filter((link) => link.entityType === 'company' && link.status !== 'inactive' && link.status !== 'rejected')
            .forEach((link) => {
                const rows = map.get(link.uid) || [];
                rows.push(link);
                map.set(link.uid, rows);
            });
        return map;
    }, [accountLinks, effectiveUsers]);

    const connectionSummaries = useMemo(() => new Map(effectiveUsers.map((user) => [user.uid,
        summarizeAccountConnections(user, effectiveWorkers, officeStaffRows, companies, accountLinks),
    ])), [effectiveUsers, effectiveWorkers, officeStaffRows, companies, accountLinks]);

    const filteredUsers = useMemo(() => {
        const queryText = userSearch.trim().toLowerCase();
        const matchingUsers = visibleUsers.filter((user) => {
            const links = connectionSummaries.get(user.uid) || [];
            const active = links.some((link) => link.status === 'active');
            if (connectionFilter === 'linked') return active;
            if (connectionFilter === 'unlinked') return !active;
            if (connectionFilter === 'pending') return user.status === 'pending' || links.some((link) => link.status === 'pending');
            return true;
        });
        const list = queryText
            ? matchingUsers.filter((user) => {
                const linkedWorkers = linkedWorkersByUserId.get(user.uid) || [];
                const linkedOfficeStaff = linkedOfficeStaffByUserId.get(user.uid) || [];
                const linkedCompanies = companyLinksByUserId.get(user.uid) || [];
                const text = [
                    user.displayName,
                    user.email,
                    user.role,
                    user.position,
                    user.accountType,
                    user.status,
                    ...(connectionSummaries.get(user.uid) || []).map((link) => link.name),
                    ...linkedWorkers.map((worker) => worker.name),
                    ...linkedOfficeStaff.map((staff) => staff.name),
                    ...linkedCompanies.map((link) => link.entityName)
                ].map(toText).join(' ').toLowerCase();
                return text.includes(queryText);
            })
            : matchingUsers;

        return [...list].sort((a, b) => {
            const aHasLinks = (linkedWorkersByUserId.get(a.uid)?.length || 0) + (linkedOfficeStaffByUserId.get(a.uid)?.length || 0) + (companyLinksByUserId.get(a.uid)?.length || 0) > 0;
            const bHasLinks = (linkedWorkersByUserId.get(b.uid)?.length || 0) + (linkedOfficeStaffByUserId.get(b.uid)?.length || 0) + (companyLinksByUserId.get(b.uid)?.length || 0) > 0;
            if (aHasLinks !== bHasLinks) return aHasLinks ? 1 : -1;
            return getTimestampMillis(b.lastLogin) - getTimestampMillis(a.lastLogin);
        });
    }, [companyLinksByUserId, linkedOfficeStaffByUserId, linkedWorkersByUserId, userSearch, visibleUsers, connectionSummaries, connectionFilter]);

    useEffect(() => {
        if (visibleUsers.length === 0) {
            if (!selectedUserId) setInternalSelectedUserId('');
            return;
        }
        if (!activeSelectedUserId || !visibleUsers.some((user) => user.uid === activeSelectedUserId)) {
            const nextUid = visibleUsers[0].uid;
            if (!lockedUserId) {
                if (onSelectUser) onSelectUser(nextUid);
                else setInternalSelectedUserId(nextUid);
            }
        }
    }, [activeSelectedUserId, visibleUsers, lockedUserId, onSelectUser, selectedUserId]);

    useEffect(() => {
        setSelectedWorkerId(''); setSelectedOfficeStaffId(''); setSelectedCompanyId('');
    }, [activeSelectedUserId]);

    const selectedUser = activeSelectedUserId ? userByUid.get(activeSelectedUserId) || null : null;
    const linkedWorkers = selectedUser ? linkedWorkersByUserId.get(selectedUser.uid) || [] : [];
    const linkedOfficeStaff = selectedUser ? linkedOfficeStaffByUserId.get(selectedUser.uid) || [] : [];
    const linkedCompanyLinks = selectedUser ? companyLinksByUserId.get(selectedUser.uid) || [] : [];
    const hasSelectedUserConnections = linkedWorkers.length + linkedOfficeStaff.length + linkedCompanyLinks.length > 0;

    const filteredWorkers = useMemo(() => {
        const queryText = targetSearch.trim().toLowerCase();
        const list = queryText
            ? effectiveWorkers.filter((worker) => {
                const owner = worker.id ? userByUid.get(ownerByWorkerId.get(String(worker.id)) || '') : null;
                const text = [
                    worker.name,
                    worker.idNumber,
                    worker.contact,
                    worker.email,
                    worker.role,
                    worker.teamName,
                    owner?.displayName,
                    owner?.email
                ].map(toText).join(' ').toLowerCase();
                return text.includes(queryText);
            })
            : effectiveWorkers;

        return [...list].sort((a, b) => {
            const aOwner = a.id ? ownerByWorkerId.get(String(a.id)) : '';
            const bOwner = b.id ? ownerByWorkerId.get(String(b.id)) : '';
            if (aOwner !== bOwner) return aOwner ? 1 : -1;
            return toText(a.name).localeCompare(toText(b.name), 'ko');
        });
    }, [effectiveWorkers, ownerByWorkerId, targetSearch, userByUid]);

    const filteredCompanies = useMemo(() => {
        const queryText = targetSearch.trim().toLowerCase();
        const list = companies.filter((company) => {
            if (!matchesCompanyFilter(company, companyFilter)) return false;
            if (!queryText) return true;
            const text = [
                company.name,
                company.code,
                company.type,
                company.businessNumber,
                company.ceoName,
                company.phone,
                company.email,
            ].map(toText).join(' ').toLowerCase();
            return text.includes(queryText);
        });
        return [...list].sort((a, b) => toText(a.name).localeCompare(toText(b.name), 'ko'));
    }, [companies, companyFilter, targetSearch]);

    const filteredOfficeStaffRows = useMemo(() => {
        const queryText = targetSearch.trim().toLowerCase();
        const list = queryText
            ? officeStaffRows.filter((staff) => {
                const owner = staff.id ? userByUid.get(ownerByOfficeStaffId.get(String(staff.id)) || '') : null;
                const text = [
                    staff.name,
                    staff.idNumber,
                    staff.contact,
                    staff.email,
                    staff.role,
                    staff.department,
                    staff.status,
                    owner?.displayName,
                    owner?.email
                ].map(toText).join(' ').toLowerCase();
                return text.includes(queryText);
            })
            : officeStaffRows;

        return [...list].sort((a, b) => {
            const aOwner = a.id ? ownerByOfficeStaffId.get(String(a.id)) : '';
            const bOwner = b.id ? ownerByOfficeStaffId.get(String(b.id)) : '';
            if (aOwner !== bOwner) return aOwner ? 1 : -1;
            return toText(a.name).localeCompare(toText(b.name), 'ko');
        });
    }, [officeStaffRows, ownerByOfficeStaffId, targetSearch, userByUid]);

    const pendingLinks = useMemo(() => {
        return accountLinks.filter((link) => link.status === 'pending');
    }, [accountLinks]);

    useEffect(() => {
        if (didOpenPendingTab || metaLoading || pendingLinks.length === 0 || selectedUserId || lockedUserId) return;
        setActiveTab('pending');
        setTargetSearch('');
        setDidOpenPendingTab(true);
    }, [didOpenPendingTab, metaLoading, pendingLinks.length, selectedUserId, lockedUserId]);

    const summary = useMemo(() => {
        const linkedUsers = visibleUsers.filter((user) =>
            (linkedWorkersByUserId.get(user.uid)?.length || 0) + (linkedOfficeStaffByUserId.get(user.uid)?.length || 0) + (companyLinksByUserId.get(user.uid)?.length || 0) > 0
        ).length;
        const linkedWorkersCount = effectiveWorkers.filter((worker) => {
            const key = toText(worker.id || worker.legacyId);
            return key ? ownerByWorkerId.has(key) : false;
        }).length;
        const linkedOfficeStaffCount = officeStaffRows.filter((staff) => {
            const key = toText(staff.id || staff.legacyId);
            return key ? ownerByOfficeStaffId.has(key) : false;
        }).length;
        return {
            users: visibleUsers.length,
            linkedUsers,
            workers: effectiveWorkers.length,
            unlinkedWorkers: Math.max(effectiveWorkers.length - linkedWorkersCount, 0),
            officeStaff: officeStaffRows.length,
            unlinkedOfficeStaff: Math.max(officeStaffRows.length - linkedOfficeStaffCount, 0),
            companies: companies.length,
            pending: pendingLinks.length,
        };
    }, [companies.length, companyLinksByUserId, effectiveWorkers, linkedOfficeStaffByUserId, linkedWorkersByUserId, officeStaffRows, ownerByOfficeStaffId, ownerByWorkerId, pendingLinks.length, visibleUsers]);

    const selectUser = (uid: string) => {
        setError(null);
        setSelectedWorkerId('');
        setSelectedOfficeStaffId('');
        setSelectedCompanyId('');
        if (lockedUserId) return;
        if (onSelectUser) onSelectUser(uid);
        else setInternalSelectedUserId(uid);
    };

    const handleWorkerLink = async () => {
        if (previewData) return;
        if (!selectedUser || !selectedWorkerId) return;
        const worker = workerById.get(selectedWorkerId);
        if (!worker?.id) return;

        const label = `${getUserLabel(selectedUser)} 계정에 ${worker.name} 작업자를 연결하시겠습니까?${worker.role ? `\n연결과 동시에 기본 직책이 '${worker.role}'으로 적용됩니다.` : ''}`;
        if (!window.confirm(label)) return;

        setBusy(true);
        setError(null);
        try {
            await userService.linkUserToWorker(selectedUser.uid, worker.id, actorEmail);
            setSelectedWorkerId('');
            await reloadAfterChange();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const handleWorkerUnlink = async (worker: Worker) => {
        if (previewData) return;
        if (!selectedUser || !worker.id) return;
        if (!window.confirm(`${getUserLabel(selectedUser)} 계정에서 ${worker.name} 작업자 연결을 해제하시겠습니까?\n마지막 연결이면 직책과 접근 권한도 함께 제거됩니다.`)) return;

        setBusy(true);
        setError(null);
        try {
            await userService.unlinkUserFromWorker(selectedUser.uid, worker.id, actorEmail);
            if (selectedWorkerId === worker.id) setSelectedWorkerId('');
            await reloadAfterChange();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const handleOfficeStaffLink = async () => {
        if (previewData) return;
        if (!selectedUser || !selectedOfficeStaffId) return;
        const staff = officeStaffById.get(selectedOfficeStaffId);
        if (!staff?.id) return;

        const label = `${getUserLabel(selectedUser)} 계정에 ${staff.name} 사무실 직원을 연결하시겠습니까?${staff.role ? `\n연결과 동시에 기본 직책이 '${staff.role}'으로 적용됩니다.` : ''}`;
        if (!window.confirm(label)) return;

        setBusy(true);
        setError(null);
        try {
            await userService.linkUserToOfficeStaff(selectedUser.uid, staff.id, actorEmail, 'staff', 'active');
            setSelectedOfficeStaffId('');
            await reloadAfterChange();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const handleOfficeStaffUnlink = async (staff: OfficeStaff) => {
        if (previewData) return;
        if (!selectedUser || !staff.id) return;
        if (!window.confirm(`${getUserLabel(selectedUser)} 계정에서 ${staff.name} 사무실 직원 연결을 해제하시겠습니까?\n마지막 연결이면 직책과 접근 권한도 함께 제거됩니다.`)) return;

        setBusy(true);
        setError(null);
        try {
            await userService.unlinkUserFromOfficeStaff(selectedUser.uid, staff.id, actorEmail);
            if (selectedOfficeStaffId === staff.id) setSelectedOfficeStaffId('');
            await reloadAfterChange();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const handleCompanyLink = async () => {
        if (previewData) return;
        if (!selectedUser || !selectedCompanyId) return;
        const company = companyById.get(selectedCompanyId);
        if (!company?.id) return;

        const linkedPosition = getCompanyPositionName(company);
        const label = `${getUserLabel(selectedUser)} 계정에 ${company.name} ${company.type || '회사'}를 연결하시겠습니까?${linkedPosition ? `\n연결과 동시에 기본 직책이 '${linkedPosition}'으로 적용됩니다.` : ''}`;
        if (!window.confirm(label)) return;

        setBusy(true);
        setError(null);
        try {
            await userService.linkUserToCompany(selectedUser.uid, company, actorEmail, companyRelationRole, 'active');
            setSelectedCompanyId('');
            await reloadAfterChange();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const handleCompanyUnlink = async (link: AccountLink) => {
        if (previewData) return;
        if (!selectedUser || !link.entityId) return;
        if (!window.confirm(`${getUserLabel(selectedUser)} 계정에서 ${link.entityName} 연결을 해제하시겠습니까?\n마지막 연결이면 직책과 접근 권한도 함께 제거됩니다.`)) return;

        setBusy(true);
        setError(null);
        try {
            await userService.unlinkUserFromCompany(selectedUser.uid, link.entityId, actorEmail);
            if (selectedCompanyId === link.entityId) setSelectedCompanyId('');
            await reloadAfterChange();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const handleCleanupOrphanedAccess = async () => {
        if (previewData) return;
        if (!selectedUser || hasSelectedUserConnections || !selectedUser.position) return;
        if (!window.confirm(`${getUserLabel(selectedUser)} 계정은 연결 대상 없이 '${selectedUser.position}' 직책만 남아 있습니다. 남은 직책과 접근 권한을 정리할까요?`)) return;

        setBusy(true);
        setError(null);
        try {
            await accountLinkService.revokeUserAccessApproval(selectedUser.uid);
            await reloadAfterChange();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const handleApproveLink = async (link: AccountLink) => {
        if (previewData) return;
        const user = userByUid.get(link.uid);
        if (!link.id) {
            setError('승인할 연결 요청 번호가 없습니다.');
            return;
        }
        if (!user && !link.userEmail) setError('요청 사용자 정보가 일부 누락되었습니다. 이메일과 UID를 확인해 주세요.');
        else setError(null);
        setRejectionReason('');
        setPendingReview({ linkId: link.id, mode: 'approve' });
    };

    const handleRejectLink = async (link: AccountLink) => {
        if (previewData) return;
        if (!link.id) {
            setError('반려할 연결 요청 번호가 없습니다.');
            return;
        }
        setError(null);
        setRejectionReason('');
        setPendingReview({ linkId: link.id, mode: 'reject' });
    };

    const handleConfirmPendingReview = async (link: AccountLink) => {
        if (previewData) return;
        if (!link.id || pendingReview?.linkId !== link.id) return;

        const nextStatus = pendingReview.mode === 'approve' ? 'active' : 'rejected';
        setProcessingLinkId(link.id);
        setError(null);
        try {
            if (pendingReview.mode === 'approve') {
                await accountLinkService.approveLink(link, { email: actorEmail });
            } else {
                await accountLinkService.rejectLink(link, { email: actorEmail }, rejectionReason.trim());
            }

            setAccountLinks((current) => current.map((item) => (
                item.id === link.id ? { ...item, status: nextStatus, rejectionReason: rejectionReason.trim() || undefined } : item
            )));
            setPendingReview(null);
            setRejectionReason('');

            try {
                await reloadAfterChange();
            } catch (refreshError) {
                console.error('[AccountLinkManager] Review succeeded but refresh failed.', refreshError);
                setError(`${pendingReview.mode === 'approve' ? '승인' : '반려'} 처리는 완료됐지만 목록 새로고침에 실패했습니다. 새로고침 버튼을 눌러 주세요.`);
            }
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setProcessingLinkId('');
        }
    };

    const containerClass = embedded
        ? `bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden ${className}`
        : `h-full bg-white flex flex-col overflow-hidden ${className}`;

    const targetPlaceholder = activeTab === 'worker'
        ? '작업자 검색'
        : activeTab === 'office'
            ? '사무실 직원 검색'
            : activeTab === 'company'
                ? '회사 검색'
                : '승인 요청 검색';

    const renderUserList = () => (
        <div className="flex min-h-0 flex-col border-b border-slate-200 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-100 p-3">
                <div className="relative">
                    <input
                        value={userSearch}
                        onChange={(event) => setUserSearch(event.target.value)}
                        placeholder="계정 또는 연결 대상 검색" aria-label="계정 또는 연결 대상 검색"
                        className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-xs text-slate-400" />
                </div>
                <div className="um-filters" aria-label="계정 연결 상태 필터">
                    {([['all', '전체'], ['linked', '연결됨'], ['unlinked', '미연결'], ['pending', '승인 대기']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={connectionFilter === value} onClick={() => setConnectionFilter(value)}>{label}</button>)}
                </div>
            </div>
            <div className="um-link-scroll flex-1 overflow-y-auto p-2">
                {filteredUsers.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-400">검색된 계정이 없습니다.</div>
                ) : (
                    filteredUsers.map((user) => {
                        const isSelected = user.uid === activeSelectedUserId;
                        const userLinkedWorkers = linkedWorkersByUserId.get(user.uid) || [];
                        const userLinkedOfficeStaff = linkedOfficeStaffByUserId.get(user.uid) || [];
                        const userCompanyLinks = companyLinksByUserId.get(user.uid) || [];
                        return (
                            <button
                                type="button"
                                key={user.uid}
                                aria-pressed={isSelected}
                                disabled={busy || Boolean(processingLinkId)}
                                onClick={() => selectUser(user.uid)}
                                className={`mb-2 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${isSelected
                                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                                    : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50'
                                    }`}
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-slate-500">
                                    {user.photoURL ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" /> : <FontAwesomeIcon icon={faUser} />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="truncate font-bold text-slate-800">{user.displayName || '이름 없음'}</div>
                                        {user.status && (
                                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${user.status === 'active' ? 'bg-emerald-100 text-emerald-700' : user.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {userStatusLabel(user.status)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="truncate text-xs text-slate-500">{user.email || user.uid}</div>
                                    <div className="mt-1 text-xs text-slate-600"><b>{user.position || '직책 미지정'}</b></div>
                                    <div className="mt-1 text-xs leading-5 text-slate-500">
                                        <FontAwesomeIcon icon={faLink} className="mr-1 text-emerald-500" />
                                        {(connectionSummaries.get(user.uid) || []).length > 0
                                            ? (connectionSummaries.get(user.uid) || []).map((link) => `${link.label} ${link.name}${link.status === 'pending' ? ' (승인 대기)' : ''}`).join(' · ')
                                            : '연결된 대상 없음'}
                                    </div>
                                </div>
                                {isSelected && <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-600" />}
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );

    const renderSelectedUserLinks = () => selectedUser && (
        <div className="border-b border-slate-100 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="min-w-0"><div className="text-[11px] font-bold text-slate-400">선택한 로그인 계정</div><div className="text-sm font-extrabold text-slate-900">{getUserLabel(selectedUser)}</div><div className="text-xs text-slate-500 break-all">{selectedUser.email || '이메일 없음'}</div></div>
                <div className="flex flex-wrap items-center gap-2"><span className={`um-badge ${selectedUser.status === 'active' ? 'um-good' : 'um-warning'}`}>{userStatusLabel(selectedUser.status)}</span><span className="um-badge">{selectedUser.position || '직책 미지정'}</span>{onManageAccess && <button type="button" className="um-text-button" onClick={() => onManageAccess(selectedUser.uid)}>직책·권한 설정 →</button>}</div>
            </div>
            <div className="mb-2 text-xs font-bold text-slate-500">현재 연결된 인원·회사</div>
            <div className="um-connection-list">
                {(connectionSummaries.get(selectedUser.uid) || []).map((link) => {
                    const entityId = link.key.slice(link.type.length + 1);
                    const worker = link.type === 'worker' ? workerById.get(entityId) : undefined;
                    const staff = link.type === 'office' ? officeStaffById.get(entityId) : undefined;
                    const companyLink = link.type === 'company' ? linkedCompanyLinks.find((item) => (companyById.get(item.entityId)?.id || item.entityId) === entityId) : undefined;
                    const unlink = worker ? () => handleWorkerUnlink(worker) : staff ? () => handleOfficeStaffUnlink(staff) : companyLink ? () => handleCompanyUnlink(companyLink) : undefined;
                    return <div key={link.key} className="um-connection"><span className="um-badge">{link.label}</span><div><strong>{link.name}</strong><small>{link.detail}</small></div><span className={`um-badge ${link.status === 'pending' || link.missing ? 'um-warning' : 'um-good'}`}>{link.status === 'pending' ? '승인 대기' : link.missing ? '대상 확인 필요' : '연결됨'}</span>{unlink && link.status === 'active' && <button type="button" onClick={unlink} disabled={busy || Boolean(previewData)} className="text-xs text-slate-400 hover:text-rose-600" aria-label={`${link.name} 연결 해제`}>해제</button>}</div>;
                })}
                {(connectionSummaries.get(selectedUser.uid) || []).length === 0 && <p className="text-xs text-slate-500">연결된 대상이 없습니다. 아래에서 연결할 인원이나 회사를 선택하세요.</p>}
            </div>
            {!hasSelectedUserConnections && selectedUser.position && <details className="mt-3 text-xs text-slate-500"><summary className="cursor-pointer">연결 대상 없이 부여된 직책·권한</summary><p className="py-2">직접 승인된 계정일 수 있습니다. 접근 승인을 해제해야 할 때만 정리해 주세요.</p><button type="button" onClick={() => void handleCleanupOrphanedAccess()} disabled={busy || Boolean(previewData)} className="um-button">직책·접근 승인 해제</button></details>}
        </div>
    );
    const renderWorkerTargets = () => (
        <div className="um-link-scroll flex-1 overflow-y-auto p-2">
            {!selectedUser ? (
                <div className="p-6 text-center text-sm text-slate-400">먼저 계정을 선택하세요.</div>
            ) : filteredWorkers.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">검색된 작업자가 없습니다.</div>
            ) : (
                filteredWorkers.map((worker) => {
                    const workerId = toText(worker.id || worker.legacyId);
                    const ownerUid = workerId ? ownerByWorkerId.get(workerId) : '';
                    const owner = ownerUid ? userByUid.get(ownerUid) : null;
                    const isLinkedToSelected = ownerUid === selectedUser.uid;
                    const isLinkedToOther = Boolean(ownerUid && ownerUid !== selectedUser.uid);
                    const isSelectedWorker = selectedWorkerId === workerId;
                    const canSelect = Boolean(worker.id && !isLinkedToSelected && !isLinkedToOther);

                    return (
                        <button
                            type="button"
                            key={worker.id || worker.legacyId || worker.name}
                            onClick={() => canSelect && setSelectedWorkerId(worker.id!)}
                            disabled={!canSelect}
                            className={`mb-2 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${isSelectedWorker
                                ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                                : isLinkedToSelected
                                    ? 'border-emerald-200 bg-emerald-50/60'
                                    : isLinkedToOther
                                        ? 'border-slate-200 bg-slate-50 opacity-70'
                                        : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50'
                                }`}
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                                <FontAwesomeIcon icon={faHardHat} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="truncate font-bold text-slate-800">{worker.name}</div>
                                    {isLinkedToSelected && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">현재 계정</span>}
                                    {isLinkedToOther && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">다른 계정</span>}
                                </div>
                                <div className="truncate text-xs text-slate-500">
                                    {[worker.role || '직책 없음', worker.teamName || '팀 미배정', worker.idNumber || '식별번호 없음'].join(' · ')}
                                </div>
                                {owner && <div className="mt-0.5 truncate text-[11px] text-slate-400">연결 계정: {getUserLabel(owner)} · {owner.email || '이메일 없음'}</div>}
                            </div>
                            {isSelectedWorker && <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-600" />}
                        </button>
                    );
                })
            )}
        </div>
    );

    const renderOfficeTargets = () => (
        <div className="um-link-scroll flex-1 overflow-y-auto p-2">
            {!selectedUser ? (
                <div className="p-6 text-center text-sm text-slate-400">먼저 계정을 선택하세요.</div>
            ) : filteredOfficeStaffRows.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">검색된 사무실 직원이 없습니다.</div>
            ) : (
                filteredOfficeStaffRows.map((staff) => {
                    const staffId = toText(staff.id || staff.legacyId);
                    const ownerUid = staffId ? ownerByOfficeStaffId.get(staffId) : '';
                    const owner = ownerUid ? userByUid.get(ownerUid) : null;
                    const isLinkedToSelected = ownerUid === selectedUser.uid;
                    const isLinkedToOther = Boolean(ownerUid && ownerUid !== selectedUser.uid);
                    const isSelectedStaff = selectedOfficeStaffId === staffId;
                    const canSelect = Boolean(staff.id && !isLinkedToSelected && !isLinkedToOther);

                    return (
                        <button
                            type="button"
                            key={staff.id || staff.legacyId || staff.name}
                            onClick={() => canSelect && setSelectedOfficeStaffId(staff.id!)}
                            disabled={!canSelect}
                            className={`mb-2 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${isSelectedStaff
                                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                                : isLinkedToSelected
                                    ? 'border-indigo-200 bg-indigo-50/60'
                                    : isLinkedToOther
                                        ? 'border-slate-200 bg-slate-50 opacity-70'
                                        : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50'
                                }`}
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                                <FontAwesomeIcon icon={faIdBadge} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="truncate font-bold text-slate-800">{staff.name}</div>
                                    {staff.status && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{staff.status}</span>}
                                    {isLinkedToSelected && <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">현재 계정</span>}
                                    {isLinkedToOther && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">다른 계정</span>}
                                </div>
                                <div className="truncate text-xs text-slate-500">
                                    {[staff.role || '직책 없음', staff.department || '부서 미지정', staff.idNumber || staff.contact || '식별정보 없음'].join(' · ')}
                                </div>
                                {owner && <div className="mt-0.5 truncate text-[11px] text-slate-400">연결 계정: {getUserLabel(owner)} · {owner.email || '이메일 없음'}</div>}
                            </div>
                            {isSelectedStaff && <FontAwesomeIcon icon={faCheckCircle} className="text-indigo-600" />}
                        </button>
                    );
                })
            )}
        </div>
    );

    const renderCompanyTargets = () => (
        <div className="um-link-scroll flex-1 overflow-y-auto p-2">
            {!selectedUser ? (
                <div className="p-6 text-center text-sm text-slate-400">먼저 계정을 선택하세요.</div>
            ) : filteredCompanies.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">검색된 회사가 없습니다.</div>
            ) : (
                filteredCompanies.map((company) => {
                    const companyId = toText(company.id || company.legacyId);
                    const linkedToSelected = (connectionSummaries.get(selectedUser.uid) || []).some((link) => link.key === `company:${companyId}`);
                    const companyAccounts = effectiveUsers.filter((user) => (connectionSummaries.get(user.uid) || []).some((link) => link.key === `company:${companyId}` && link.status === 'active'));
                    const isSelectedCompany = selectedCompanyId === companyId;
                    const canSelect = Boolean(company.id && !linkedToSelected);
                    const linkedPosition = getCompanyPositionName(company);

                    return (
                        <button
                            type="button"
                            key={company.id || company.legacyId || company.name}
                            onClick={() => canSelect && setSelectedCompanyId(company.id!)}
                            disabled={!canSelect}
                            className={`mb-2 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${isSelectedCompany
                                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                                : linkedToSelected
                                    ? 'border-blue-200 bg-blue-50/60'
                                    : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                                }`}
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                                <FontAwesomeIcon icon={faBuilding} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="truncate font-bold text-slate-800">{company.name}</div>
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{company.type || '미지정'}</span>
                                    {linkedPosition && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">직책: {linkedPosition}</span>}
                                    {linkedToSelected && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">현재 계정</span>}
                                </div>
                                <div className="truncate text-xs text-slate-500">
                                    {[company.businessNumber || '사업자번호 없음', company.ceoName || '대표자 없음', company.phone || '연락처 없음'].join(' · ')}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">연결 계정: {companyAccounts.length ? companyAccounts.map((user) => `${getUserLabel(user)} · ${user.email || '이메일 없음'}`).join(' / ') : '없음'}</div>
                            </div>
                            {isSelectedCompany && <FontAwesomeIcon icon={faCheckCircle} className="text-blue-600" />}
                        </button>
                    );
                })
            )}
        </div>
    );

    const renderPendingTargets = () => {
        const queryText = targetSearch.trim().toLowerCase();
        const visiblePendingLinks = queryText
            ? pendingLinks.filter((link) => {
                const user = userByUid.get(link.uid);
                const text = [
                    link.entityName,
                    link.entitySubType,
                    link.userEmail,
                    link.userDisplayName,
                    link.requestedEntity?.businessNumber,
                    link.requestedEntity?.idNumber,
                    link.requestedEntity?.role,
                    link.requestedEntity?.department,
                    link.requestedEntity?.phone,
                    user?.displayName,
                    user?.email,
                ].map(toText).join(' ').toLowerCase();
                return text.includes(queryText);
            })
            : pendingLinks;

        return (
            <div className="um-link-scroll flex-1 overflow-y-auto p-2">
                {visiblePendingLinks.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-400">승인 대기 요청이 없습니다.</div>
                ) : (
                    visiblePendingLinks.map((link) => {
                        const user = userByUid.get(link.uid);
                        const isNewCompanyRequest = link.entityType === 'company' && !companyById.has(link.entityId);
                        const isOfficePlaceholderRequest = link.entityType === 'office' && link.entityId.startsWith('new_');
                        const requesterName = user?.displayName || link.userDisplayName || '이름 미등록';
                        const requesterEmail = user?.email || link.userEmail || '이메일 미등록';
                        const linkId = link.id || '';
                        const isReviewing = pendingReview?.linkId === linkId;
                        const processingThisLink = processingLinkId === linkId;
                        return (
                            <div key={link.id || `${link.uid}-${link.entityId}`} className={`mb-3 overflow-hidden rounded-xl border bg-white shadow-sm transition ${isReviewing ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200 hover:border-amber-300'}`}>
                                <div className="p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold text-amber-800">승인 대기</span>
                                            <span className="rounded bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{link.entitySubType}</span>
                                            {isNewCompanyRequest && <span className="rounded bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-700">신규 회사 생성</span>}
                                            {isOfficePlaceholderRequest && <span className="rounded bg-indigo-100 px-2 py-1 text-[11px] font-bold text-indigo-700">신규 직원 생성</span>}
                                        </div>
                                        <span className="text-[11px] font-medium text-slate-400">요청 {formatLastLogin(link.requestedAt)}</span>
                                    </div>

                                    <div className="mt-3 grid items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                                        <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3">
                                            <div className="flex items-center gap-2 text-[11px] font-bold text-blue-600">
                                                <FontAwesomeIcon icon={faUser} /> 요청한 사용자
                                            </div>
                                            <div className="mt-2 truncate text-sm font-extrabold text-slate-900">{requesterName}</div>
                                            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-bold text-blue-700">
                                                <FontAwesomeIcon icon={faEnvelope} className="shrink-0" />
                                                <span className="truncate" title={requesterEmail}>{requesterEmail}</span>
                                            </div>
                                            <div className="mt-1 truncate text-[10px] text-slate-400" title={link.uid}>UID {link.uid}</div>
                                        </div>

                                        <div className="hidden items-center justify-center px-1 text-slate-300 sm:flex">
                                            <FontAwesomeIcon icon={faArrowRight} />
                                        </div>

                                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
                                            <div className="text-[11px] font-bold text-emerald-700">연결할 대상</div>
                                            <div className="mt-2 truncate text-sm font-extrabold text-slate-900">{link.entityName}</div>
                                            <div className="mt-1 text-xs font-semibold text-slate-600">
                                                {link.entitySubType} · {getAccountRelationRoleLabel(link.relationRole, link.entityType)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                        {link.requestedEntity && (
                                            <div className="min-w-0 flex-1 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs text-slate-600">
                                                <div>식별번호: {link.requestedEntity.businessNumber || link.requestedEntity.idNumber || '-'}</div>
                                                <div>대표자/직책: {link.requestedEntity.ceoName || link.requestedEntity.role || '-'}</div>
                                                <div>연락처: {link.requestedEntity.phone || '-'}</div>
                                                {link.requestedEntity.department && <div>부서: {link.requestedEntity.department}</div>}
                                                {link.requestedEntity.memo && <div>메모: {link.requestedEntity.memo}</div>}
                                            </div>
                                        )}
                                        <div className="grid shrink-0 grid-cols-2 gap-2">
                                        <button type="button" onClick={() => void handleApproveLink(link)} disabled={busy || Boolean(processingLinkId) || Boolean(previewData)} className="min-h-10 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                                            승인하고 연결
                                        </button>
                                        <button type="button" onClick={() => void handleRejectLink(link)} disabled={busy || Boolean(processingLinkId) || Boolean(previewData)} className="min-h-10 rounded-lg bg-white px-4 py-2 text-xs font-extrabold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50">
                                            반려하기
                                        </button>
                                        </div>
                                    </div>
                                </div>

                                {isReviewing && (
                                    <div className={`border-t px-4 py-4 ${pendingReview.mode === 'approve' ? 'border-emerald-100 bg-emerald-50' : 'border-rose-100 bg-rose-50'}`}>
                                        <div className="text-sm font-extrabold text-slate-900">
                                            {pendingReview.mode === 'approve'
                                                ? `${requesterEmail} 계정을 ${link.entityName}에 연결합니다.`
                                                : `${requesterEmail} 계정의 요청을 반려합니다.`}
                                        </div>
                                        {pendingReview.mode === 'reject' && (
                                            <label className="mt-3 block text-xs font-bold text-rose-700">
                                                반려 사유 <span className="font-medium text-rose-500">(사용자에게 표시됩니다)</span>
                                                <textarea
                                                    value={rejectionReason}
                                                    onChange={(event) => setRejectionReason(event.target.value.slice(0, 500))}
                                                    rows={3}
                                                    autoFocus
                                                    placeholder="예: 등록된 전화번호를 확인해 다시 요청해 주세요."
                                                    className="mt-1.5 w-full resize-none rounded-lg border border-rose-200 bg-white p-2.5 text-sm font-medium text-slate-700 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                                                />
                                            </label>
                                        )}
                                        <div className="mt-3 flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPendingReview(null);
                                                    setRejectionReason('');
                                                }}
                                                disabled={processingThisLink}
                                                className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
                                            >
                                                취소
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleConfirmPendingReview(link)}
                                                disabled={processingThisLink}
                                                className={`min-w-28 rounded-lg px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60 ${pendingReview.mode === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                                            >
                                                {processingThisLink && <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />}
                                                {processingThisLink ? '처리 중' : pendingReview.mode === 'approve' ? '연결 확정' : '반려 확정'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {isNewCompanyRequest && (
                                    <div className="border-t border-blue-100 bg-blue-50 px-4 py-2 text-[11px] font-semibold text-blue-700">
                                        승인하면 회사 DB 생성과 계정 연결이 한 번에 처리됩니다.
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        );
    };

    return (
        <div className={containerClass}>
            <div className="um-link-stats">
                <strong>계정 연결·승인</strong>
                <span>전체 <b>{summary.users}</b></span>
                <span>연결됨 <b>{visibleUsers.filter((user) => (connectionSummaries.get(user.uid) || []).some((link) => link.status === 'active')).length}</b></span>
                <button type="button" onClick={() => { setActiveTab('pending'); setTargetSearch(''); }}>전체 승인 요청 <b>{summary.pending}</b></button>
                <button type="button" onClick={handleRefresh} disabled={refreshing || loading || busy} aria-label="계정 연결 정보 새로고침"><FontAwesomeIcon icon={refreshing ? faSpinner : faArrowsRotate} spin={refreshing} /></button>
            </div>
            {previewData && <div className="px-3 py-2 text-xs text-sky-800 bg-sky-50">샘플 연결 정보입니다. 연결·승인 변경은 실제 로그인 후 사용할 수 있습니다.</div>}
            {error && (
                <div className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm font-bold text-rose-700">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex min-h-[320px] items-center justify-center text-slate-500">
                    <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                    계정 연결 정보를 불러오는 중...
                </div>
            ) : (
                <div className="um-link-layout">
                    {renderUserList()}

                    <div className="flex min-h-0 min-w-0 flex-col">{renderSelectedUserLinks()}
                        <div className="border-b border-slate-100 p-3 space-y-3">
                            <div className="grid grid-cols-4 rounded-lg bg-slate-100 p-1 text-xs font-bold">
                                {([
                                    ['worker', '작업자', faHardHat],
                                    ['office', '사무실', faIdBadge],
                                    ['company', '회사', faBuilding],
                                    ['pending', `전체 승인 ${pendingLinks.length}`, faHourglassHalf],
                                ] as const).map(([tab, label, icon]) => (
                                    <button
                                        key={tab}
                                        type="button"
                                        aria-pressed={activeTab === tab}
                                        disabled={busy || Boolean(processingLinkId)}
                                        onClick={() => {
                                            setActiveTab(tab);
                                            setSelectedWorkerId('');
                                            setSelectedOfficeStaffId('');
                                            setSelectedCompanyId('');
                                            setTargetSearch('');
                                        }}
                                        className={`rounded-md px-3 py-2 ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <FontAwesomeIcon icon={icon} className="mr-2" />
                                        {label}
                                    </button>
                                ))}
                            </div>

                            <div className="relative">
                                <input
                                    value={targetSearch}
                                    onChange={(event) => setTargetSearch(event.target.value)}
                                    placeholder={targetPlaceholder}
                                    className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                                <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-xs text-slate-400" />
                            </div>

                            {activeTab === 'company' && (
                                <div className="flex flex-wrap items-center gap-2">
                                    {(['all', '협력사', '건설사', '임대사'] as CompanyFilter[]).map((filter) => (
                                        <button
                                            key={filter}
                                            type="button"
                                            onClick={() => setCompanyFilter(filter)}
                                            className={`rounded-full px-3 py-1 text-xs font-bold ${companyFilter === filter ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                        >
                                            {filter === 'all' ? '전체' : filter}
                                        </button>
                                    ))}
                                    <select
                                        aria-label="회사 연결 권한"
                                        value={companyRelationRole}
                                        onChange={(event) => setCompanyRelationRole(event.target.value as AccountRelationRole)}
                                        className="ml-auto rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600"
                                    >
                                        {relationRoleOptions.map((role) => (
                                            <option key={role} value={role}>{ACCOUNT_RELATION_ROLE_LABELS[role]}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>



                        {activeTab === 'worker' && renderWorkerTargets()}
                        {activeTab === 'office' && renderOfficeTargets()}
                        {activeTab === 'company' && renderCompanyTargets()}
                        {activeTab === 'pending' && renderPendingTargets()}

                        {activeTab !== 'pending' && (
                            <div className="sticky bottom-0 border-t border-slate-200 bg-white p-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0 text-sm text-slate-600">
                                        <span className="font-bold text-slate-800">{selectedUser ? getUserLabel(selectedUser) : '계정 미선택'}</span>
                                        <FontAwesomeIcon icon={faArrowRight} className="mx-2 text-emerald-500" />
                                        <span className="font-bold text-slate-800">
                                            {activeTab === 'worker'
                                                ? (selectedWorkerId ? workerById.get(selectedWorkerId)?.name : '작업자 미선택')
                                                : activeTab === 'office'
                                                    ? (selectedOfficeStaffId ? officeStaffById.get(selectedOfficeStaffId)?.name : '사무실 직원 미선택')
                                                    : (selectedCompanyId ? companyById.get(selectedCompanyId)?.name : '회사 미선택')}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={activeTab === 'worker' ? handleWorkerLink : activeTab === 'office' ? handleOfficeStaffLink : handleCompanyLink}
                                        disabled={!selectedUser || (activeTab === 'worker' ? !selectedWorkerId : activeTab === 'office' ? !selectedOfficeStaffId : !selectedCompanyId) || busy || Boolean(previewData)}
                                        className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                    >
                                        <FontAwesomeIcon icon={busy ? faSpinner : faLink} spin={busy} className="mr-2" />
                                        연결
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccountLinkManager;
