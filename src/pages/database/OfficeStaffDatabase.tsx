import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBriefcase,
    faBuilding,
    faCheckCircle,
    faEdit,
    faIdCard,
    faLink,
    faPlus,
    faArrowsRotate,
    faSearch,
    faSpinner,
    faTrash,
    faUser,
    faUserTie,
    faWallet,
    faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { officeStaffService, OfficeStaff } from '../../services/officeStaffService';
import { userService, UserData } from '../../services/userService';
import { accountLinkService } from '../../services/accountLinkService';
import { AccountLink } from '../../types/accountLink';
import { positionService, Position } from '../../services/positionService';

interface OfficeStaffDatabaseProps {
    hideHeader?: boolean;
    highlightedId?: string | null;
}

type OfficeStaffFormState = {
    name: string;
    idNumber: string;
    contact: string;
    email: string;
    address: string;
    department: string;
    role: string;
    employmentType: string;
    status: string;
    salaryModel: string;
    unitPrice: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    joinDate: string;
    memo: string;
};

const EMPTY_FORM: OfficeStaffFormState = {
    name: '',
    idNumber: '',
    contact: '',
    email: '',
    address: '',
    department: '',
    role: '',
    employmentType: '정규직',
    status: '재직',
    salaryModel: '월급제',
    unitPrice: '',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    joinDate: '',
    memo: '',
};

const SALARY_MODEL_OPTIONS = ['월급제', '일급제', '고정급', '기타'];
const STATUS_OPTIONS = ['재직', '퇴사'];
const EMPLOYMENT_TYPE_OPTIONS = ['정규직', '프리랜서', '기타'];

const toText = (value: unknown): string => String(value ?? '').trim();

const normalizeStatus = (value: unknown): string => {
    const status = toText(value);
    return STATUS_OPTIONS.includes(status) ? status : '재직';
};

const normalizeEmploymentType = (value: unknown): string => {
    const employmentType = toText(value);
    return EMPLOYMENT_TYPE_OPTIONS.includes(employmentType) ? employmentType : '정규직';
};

const formatCurrency = (value: unknown): string => {
    const numberValue = Number(value || 0);
    if (!numberValue) return '-';
    return new Intl.NumberFormat('ko-KR').format(numberValue);
};

const getUserLabel = (user?: UserData | null): string => {
    if (!user) return '-';
    return user.displayName || user.email || user.uid;
};

const getErrorMessage = (error: unknown): string => {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'office-staff-not-found') return '사무실 직원 정보를 찾을 수 없습니다.';
    if (message === 'office-staff-already-managed') return '이미 다른 유저 계정에 연동된 사무실 직원입니다.';
    return message || '처리 중 오류가 발생했습니다.';
};

const buildFormState = (staff?: Partial<OfficeStaff> | null): OfficeStaffFormState => ({
    name: toText(staff?.name),
    idNumber: toText(staff?.idNumber),
    contact: toText(staff?.contact),
    email: toText(staff?.email),
    address: toText(staff?.address),
    department: toText(staff?.department),
    role: toText(staff?.role),
    employmentType: normalizeEmploymentType(staff?.employmentType),
    status: normalizeStatus(staff?.status),
    salaryModel: toText(staff?.salaryModel || staff?.payType) || '월급제',
    unitPrice: staff?.unitPrice ? String(staff.unitPrice) : '',
    bankName: toText(staff?.bankName),
    accountNumber: toText(staff?.accountNumber),
    accountHolder: toText(staff?.accountHolder),
    joinDate: toText(staff?.joinDate),
    memo: toText(staff?.memo),
});

const statusClassName = (status: string): string => {
    return normalizeStatus(status) === '퇴사'
        ? 'bg-slate-100 text-slate-500'
        : 'bg-emerald-100 text-emerald-700';
};

const OfficeStaffDatabase: React.FC<OfficeStaffDatabaseProps> = ({ hideHeader = false, highlightedId }) => {
    const [staffRows, setStaffRows] = useState<OfficeStaff[]>([]);
    const [users, setUsers] = useState<UserData[]>([]);
    const [accountLinks, setAccountLinks] = useState<AccountLink[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('active');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentStaff, setCurrentStaff] = useState<OfficeStaff | null>(null);
    const [formData, setFormData] = useState<OfficeStaffFormState>(EMPTY_FORM);
    const [linkingStaff, setLinkingStaff] = useState<OfficeStaff | null>(null);
    const [selectedUserUid, setSelectedUserUid] = useState('');
    const [linkUserSearch, setLinkUserSearch] = useState('');

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [staffData, userData, linkData, positionData] = await Promise.all([
                officeStaffService.getOfficeStaff(true),
                userService.getAllUsers(),
                accountLinkService.getAllLinks(),
                positionService.getPositions(true),
            ]);
            setStaffRows(staffData);
            setUsers(userData);
            setAccountLinks(linkData);
            setPositions(positionData);
        } catch (err) {
            console.error(err);
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchData();
    }, []);

    const userByUid = useMemo(() => {
        const map = new Map<string, UserData>();
        users.forEach((user) => map.set(user.uid, user));
        return map;
    }, [users]);

    const officeLinksByStaffId = useMemo(() => {
        const map = new Map<string, AccountLink[]>();
        accountLinks
            .filter((link) => link.entityType === 'office' && link.entityId !== 'office' && link.status !== 'inactive' && link.status !== 'rejected')
            .forEach((link) => {
                const rows = map.get(link.entityId) || [];
                rows.push(link);
                map.set(link.entityId, rows);
            });
        return map;
    }, [accountLinks]);

    const ownerByStaffId = useMemo(() => {
        const map = new Map<string, string>();
        staffRows.forEach((staff) => {
            if (staff.id && staff.uid) map.set(staff.id, staff.uid);
            if (staff.legacyId && staff.uid) map.set(staff.legacyId, staff.uid);
        });
        accountLinks
            .filter((link) => link.entityType === 'office' && link.status === 'active' && link.entityId !== 'office')
            .forEach((link) => map.set(link.entityId, link.uid));
        return map;
    }, [accountLinks, staffRows]);

    const filteredStaffRows = useMemo(() => {
        const queryText = searchTerm.trim().toLowerCase();
        return staffRows
            .filter((staff) => {
                const status = normalizeStatus(staff.status);
                if (statusFilter === 'active' && status === '퇴사') return false;
                if (statusFilter !== 'all' && statusFilter !== 'active' && status !== statusFilter) return false;

                if (!queryText) return true;
                const owner = staff.id ? userByUid.get(ownerByStaffId.get(staff.id) || '') : null;
                const text = [
                    staff.name,
                    staff.idNumber,
                    staff.contact,
                    staff.email,
                    staff.address,
                    staff.department,
                    staff.role,
                    staff.bankName,
                    staff.accountNumber,
                    owner?.displayName,
                    owner?.email,
                ].map(toText).join(' ').toLowerCase();
                return text.includes(queryText);
            })
            .sort((a, b) => {
                const aOwner = a.id ? ownerByStaffId.get(a.id) : '';
                const bOwner = b.id ? ownerByStaffId.get(b.id) : '';
                if (aOwner !== bOwner) return aOwner ? 1 : -1;
                return toText(a.name).localeCompare(toText(b.name), 'ko');
            });
    }, [ownerByStaffId, searchTerm, staffRows, statusFilter, userByUid]);

    const summary = useMemo(() => {
        const activeRows = staffRows.filter((staff) => normalizeStatus(staff.status) !== '퇴사');
        const linkedCount = staffRows.filter((staff) => staff.id && ownerByStaffId.has(staff.id)).length;
        return {
            total: staffRows.length,
            active: activeRows.length,
            resigned: staffRows.filter((staff) => normalizeStatus(staff.status) === '퇴사').length,
            noAccount: staffRows.filter((staff) => !staff.accountNumber).length,
            linked: linkedCount,
        };
    }, [ownerByStaffId, staffRows]);

    const openCreateModal = () => {
        setCurrentStaff(null);
        setFormData(EMPTY_FORM);
        setIsModalOpen(true);
    };

    const openEditModal = (staff: OfficeStaff) => {
        setCurrentStaff(staff);
        setFormData(buildFormState(staff));
        setIsModalOpen(true);
    };

    const handleInputChange = (field: keyof OfficeStaffFormState, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const formToStaffPayload = (): Partial<OfficeStaff> => {
        const unitPrice = Number(String(formData.unitPrice || '').replace(/,/g, '')) || 0;
        return {
            name: formData.name.trim(),
            idNumber: formData.idNumber.trim(),
            contact: formData.contact.trim(),
            email: formData.email.trim(),
            address: formData.address.trim(),
            department: formData.department.trim(),
            role: formData.role.trim(),
            employmentType: normalizeEmploymentType(formData.employmentType),
            status: normalizeStatus(formData.status),
            salaryModel: formData.salaryModel,
            payType: formData.salaryModel,
            unitPrice,
            bankName: formData.bankName.trim(),
            accountNumber: formData.accountNumber.trim(),
            accountHolder: formData.accountHolder.trim(),
            joinDate: formData.joinDate,
            memo: formData.memo.trim(),
            isActive: formData.status !== '퇴사',
        };
    };

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!formData.name.trim()) {
            setError('이름은 필수입니다.');
            return;
        }
        if (!formData.role.trim()) {
            setError('직책을 선택해주세요.');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const payload = formToStaffPayload();
            if (currentStaff?.id) {
                await officeStaffService.updateOfficeStaff(currentStaff.id, payload);
            } else {
                await officeStaffService.addOfficeStaff(payload);
            }
            setIsModalOpen(false);
            await fetchData();
        } catch (err) {
            console.error(err);
            setError(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (staff: OfficeStaff) => {
        if (!staff.id) return;
        if (!window.confirm(`${staff.name} 사무실 직원 정보를 삭제하시겠습니까?`)) return;

        setSaving(true);
        setError(null);
        try {
            const ownerUid = ownerByStaffId.get(staff.id);
            if (ownerUid) {
                await userService.unlinkUserFromOfficeStaff(ownerUid, staff.id, 'office-staff-page').catch(() => undefined);
            }
            await officeStaffService.deleteOfficeStaff(staff.id);
            await fetchData();
        } catch (err) {
            console.error(err);
            setError(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const openLinkModal = (staff: OfficeStaff) => {
        const ownerUid = staff.id ? ownerByStaffId.get(staff.id) || '' : '';
        setLinkingStaff(staff);
        setSelectedUserUid(ownerUid);
        setLinkUserSearch('');
        setError(null);
    };

    const handleLinkUser = async () => {
        if (!linkingStaff?.id || !selectedUserUid) return;
        const user = userByUid.get(selectedUserUid);
        if (!user) return;
        if (!window.confirm(`${linkingStaff.name} 사무실 직원을 ${getUserLabel(user)} 계정에 연결하시겠습니까?`)) return;

        setSaving(true);
        setError(null);
        try {
            await userService.linkUserToOfficeStaff(user.uid, linkingStaff.id, user.email || 'office-staff-page', 'staff', 'active');
            setLinkingStaff(null);
            await fetchData();
        } catch (err) {
            console.error(err);
            setError(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const handleUnlinkUser = async (staff: OfficeStaff) => {
        if (!staff.id) return;
        const ownerUid = ownerByStaffId.get(staff.id);
        if (!ownerUid) return;
        const user = userByUid.get(ownerUid);
        if (!window.confirm(`${staff.name} 사무실 직원과 ${getUserLabel(user)} 계정 연동을 해제하시겠습니까?`)) return;

        setSaving(true);
        setError(null);
        try {
            await userService.unlinkUserFromOfficeStaff(ownerUid, staff.id, user?.email || 'office-staff-page');
            setLinkingStaff(null);
            await fetchData();
        } catch (err) {
            console.error(err);
            setError(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const filteredUsers = useMemo(() => {
        const queryText = linkUserSearch.trim().toLowerCase();
        const rows = queryText
            ? users.filter((user) => {
                const text = [user.displayName, user.email, user.role, user.position, user.department].map(toText).join(' ').toLowerCase();
                return text.includes(queryText);
            })
            : users;
        return [...rows].sort((a, b) => getUserLabel(a).localeCompare(getUserLabel(b), 'ko'));
    }, [linkUserSearch, users]);

    const positionOptions = useMemo(() => {
        const names = Array.from(new Set(positions.map((position) => toText(position.name)).filter(Boolean)));
        const currentRole = toText(formData.role);
        if (currentRole && !names.includes(currentRole)) return [currentRole, ...names];
        return names;
    }, [formData.role, positions]);

    const inputClassName = 'w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm py-1.5 px-3 shadow-sm placeholder:text-slate-300';
    const selectClassName = 'w-full border-slate-200 rounded text-sm py-1.5 px-3 font-medium cursor-pointer focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white';

    const renderTextControl = (
        field: keyof OfficeStaffFormState,
        placeholder: string,
        type: string = 'text',
        required: boolean = false
    ) => (
        <input
            type={type}
            value={formData[field]}
            required={required}
            onChange={(event) => handleInputChange(field, event.target.value)}
            className={inputClassName}
            placeholder={placeholder}
        />
    );

    const renderSelectControl = (
        field: keyof OfficeStaffFormState,
        options: string[],
        placeholder?: string,
        required: boolean = false
    ) => (
        <select
            value={formData[field]}
            required={required}
            onChange={(event) => handleInputChange(field, event.target.value)}
            className={selectClassName}
        >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
    );

    const renderLabel = (label: string, required: boolean = false) => (
        <div className="col-span-3 flex items-center border-r border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700 md:col-span-2">
            {label}
            {required && <span className="ml-1 text-red-500">*</span>}
        </div>
    );

    const renderPairRow = (
        leftLabel: string,
        leftControl: React.ReactNode,
        rightLabel: string,
        rightControl: React.ReactNode,
        leftRequired: boolean = false,
        rightRequired: boolean = false
    ) => (
        <div className="col-span-12 grid grid-cols-12">
            {renderLabel(leftLabel, leftRequired)}
            <div className="col-span-9 border-r border-slate-200 p-2 md:col-span-4">{leftControl}</div>
            <div className="col-span-3 flex items-center border-r border-t border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700 md:col-span-2 md:border-t-0">
                {rightLabel}
                {rightRequired && <span className="ml-1 text-red-500">*</span>}
            </div>
            <div className="col-span-9 border-t border-slate-200 p-2 md:col-span-4 md:border-t-0">{rightControl}</div>
        </div>
    );

    const renderFullRow = (
        label: string,
        control: React.ReactNode,
        required: boolean = false
    ) => (
        <div className="col-span-12 grid grid-cols-12">
            {renderLabel(label, required)}
            <div className="col-span-9 p-2 md:col-span-10">{control}</div>
        </div>
    );

    const renderSectionHeader = (
        icon: typeof faIdCard,
        title: string,
        dotClassName: string
    ) => (
        <div className="flex items-center justify-between bg-slate-800 px-4 py-2.5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <span className={`h-2 w-2 rounded-full ${dotClassName}`} />
                <FontAwesomeIcon icon={icon} className="text-xs text-slate-200" />
                {title}
            </h3>
        </div>
    );

    return (
        <div className={hideHeader ? '' : 'min-h-screen bg-slate-50 p-6'}>
            <div className="space-y-5">
                {!hideHeader && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                                <FontAwesomeIcon icon={faBuilding} className="text-indigo-600" />
                                사무실 직원 관리
                            </h1>
                            <p className="mt-1 text-sm text-slate-500">사무실 직원 개인정보, 급여, 계좌, 유저 계정 연동을 관리합니다.</p>
                        </div>
                        <button
                            type="button"
                            onClick={openCreateModal}
                            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
                        >
                            <FontAwesomeIcon icon={faPlus} className="mr-2" />
                            직원 등록
                        </button>
                    </div>
                )}

                {hideHeader && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">사무실 목록</h2>
                            <p className="mt-1 text-sm text-slate-500">직원 정보와 로그인 계정 연동 상태를 한 화면에서 관리합니다.</p>
                        </div>
                        <button
                            type="button"
                            onClick={openCreateModal}
                            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
                        >
                            <FontAwesomeIcon icon={faPlus} className="mr-2" />
                            직원 등록
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="text-xs font-bold text-slate-500">전체 직원</div>
                        <div className="mt-1 text-2xl font-bold text-slate-800">{summary.total}</div>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                        <div className="text-xs font-bold text-emerald-700">재직</div>
                        <div className="mt-1 text-2xl font-bold text-emerald-800">{summary.active}</div>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <div className="text-xs font-bold text-amber-700">퇴사</div>
                        <div className="mt-1 text-2xl font-bold text-amber-800">{summary.resigned}</div>
                    </div>
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                        <div className="text-xs font-bold text-rose-700">계좌 미등록</div>
                        <div className="mt-1 text-2xl font-bold text-rose-800">{summary.noAccount}</div>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                        <div className="text-xs font-bold text-blue-700">계정 연동</div>
                        <div className="mt-1 text-2xl font-bold text-blue-800">{summary.linked}</div>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="relative min-w-0 flex-1">
                            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-xs text-slate-400" />
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="이름, 주민번호, 연락처, 직책, 계좌, 연동 계정 검색"
                                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {(['active', 'all', ...STATUS_OPTIONS] as string[]).map((status) => (
                                <button
                                    type="button"
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusFilter === status ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                    {status === 'active' ? '퇴사 제외' : status === 'all' ? '전체' : status}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={fetchData}
                                disabled={loading}
                                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                            >
                                <FontAwesomeIcon icon={loading ? faSpinner : faArrowsRotate} spin={loading} className="mr-2" />
                                새로고침
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="border-b border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                            {error}
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1680px] text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                <tr>
                                    <th className="px-3 py-3">직원명</th>
                                    <th className="px-3 py-3">상태</th>
                                    <th className="px-3 py-3">주민번호</th>
                                    <th className="px-3 py-3">연락처</th>
                                    <th className="px-3 py-3">이메일</th>
                                    <th className="px-3 py-3">주소</th>
                                    <th className="px-3 py-3">부서</th>
                                    <th className="px-3 py-3">직책</th>
                                    <th className="px-3 py-3">고용형태</th>
                                    <th className="px-3 py-3">입사일</th>
                                    <th className="px-3 py-3">급여구분</th>
                                    <th className="px-3 py-3 text-right">급여/단가</th>
                                    <th className="px-3 py-3">은행</th>
                                    <th className="px-3 py-3">계좌번호</th>
                                    <th className="px-3 py-3">예금주</th>
                                    <th className="px-3 py-3">유저 계정</th>
                                    <th className="px-3 py-3 text-right">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={17} className="px-4 py-10 text-center text-slate-500">
                                            <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                                            사무실 직원 정보를 불러오는 중입니다.
                                        </td>
                                    </tr>
                                ) : filteredStaffRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={17} className="px-4 py-10 text-center text-slate-500">검색된 사무실 직원이 없습니다.</td>
                                    </tr>
                                ) : (
                                    filteredStaffRows.map((staff) => {
                                        const ownerUid = staff.id ? ownerByStaffId.get(staff.id) : '';
                                        const owner = ownerUid ? userByUid.get(ownerUid) : null;
                                        const staffLinks = staff.id ? officeLinksByStaffId.get(staff.id) || [] : [];
                                        const pendingLink = staffLinks.find((link) => link.status === 'pending');
                                        const isHighlighted = highlightedId && (staff.id === highlightedId || staff.legacyId === highlightedId);

                                        return (
                                            <tr key={staff.id || staff.legacyId || staff.name} className={isHighlighted ? 'bg-indigo-50' : 'hover:bg-slate-50'}>
                                                <td className="px-3 py-3 align-middle">
                                                    <div className="flex min-w-[140px] items-center gap-2">
                                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                                                            <FontAwesomeIcon icon={faUserTie} />
                                                        </span>
                                                        <span className="font-bold text-slate-800">{staff.name || '-'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 align-middle">
                                                    <span className={`inline-flex rounded px-2 py-1 text-[11px] font-bold ${statusClassName(staff.status || '재직')}`}>
                                                        {normalizeStatus(staff.status)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 align-middle text-slate-600">{staff.idNumber || '-'}</td>
                                                <td className="px-3 py-3 align-middle text-slate-600">{staff.contact || '-'}</td>
                                                <td className="px-3 py-3 align-middle text-slate-600">
                                                    <div className="max-w-[190px] truncate" title={staff.email || ''}>{staff.email || '-'}</div>
                                                </td>
                                                <td className="px-3 py-3 align-middle text-slate-600">
                                                    <div className="max-w-[260px] truncate" title={staff.address || ''}>{staff.address || '-'}</div>
                                                </td>
                                                <td className="px-3 py-3 align-middle text-slate-600">{staff.department || '부서 미지정'}</td>
                                                <td className="px-3 py-3 align-middle font-semibold text-slate-700">{staff.role || '-'}</td>
                                                <td className="px-3 py-3 align-middle text-slate-600">{normalizeEmploymentType(staff.employmentType)}</td>
                                                <td className="px-3 py-3 align-middle text-slate-600">{staff.joinDate || '-'}</td>
                                                <td className="px-3 py-3 align-middle font-semibold text-slate-700">{staff.salaryModel || staff.payType || '-'}</td>
                                                <td className="px-3 py-3 text-right align-middle tabular-nums text-slate-600">{formatCurrency(staff.unitPrice)}</td>
                                                <td className="px-3 py-3 align-middle text-slate-600">{staff.bankName || '-'}</td>
                                                <td className="px-3 py-3 align-middle text-slate-600">
                                                    <div className="max-w-[180px] truncate" title={staff.accountNumber || ''}>{staff.accountNumber || '-'}</div>
                                                </td>
                                                <td className="px-3 py-3 align-middle text-slate-600">{staff.accountHolder || '-'}</td>
                                                <td className="px-3 py-3 align-middle">
                                                    {owner ? (
                                                        <div className="inline-flex max-w-[260px] items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                                                            <FontAwesomeIcon icon={faCheckCircle} />
                                                            <span className="truncate">{getUserLabel(owner)}</span>
                                                        </div>
                                                    ) : pendingLink ? (
                                                        <div className="inline-flex max-w-[260px] items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                                                            승인 대기: {pendingLink.userEmail || pendingLink.userDisplayName || pendingLink.uid}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">미연동</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 align-middle">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => openLinkModal(staff)}
                                                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-blue-200 text-blue-600 hover:bg-blue-50"
                                                            title="유저 계정 연동"
                                                        >
                                                            <FontAwesomeIcon icon={faLink} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => openEditModal(staff)}
                                                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                                                            title="수정"
                                                        >
                                                            <FontAwesomeIcon icon={faEdit} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(staff)}
                                                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-200 text-rose-600 hover:bg-rose-50"
                                                            title="삭제"
                                                        >
                                                            <FontAwesomeIcon icon={faTrash} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
                    <form onSubmit={handleSave} className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">{currentStaff ? '사무실 직원 수정' : '사무실 직원 등록'}</h2>
                                <p className="mt-1 text-xs text-slate-500">작업자와 동일한 기본 개인정보, 급여, 계좌 정보를 입력합니다.</p>
                            </div>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        </div>

                        <div className="max-h-[72vh] overflow-y-auto p-6">
                            <div className="space-y-6">
                                <section className="overflow-hidden rounded-lg border border-slate-300 shadow-sm">
                                    {renderSectionHeader(faIdCard, '기본 정보 (Basic Information)', 'bg-indigo-400')}
                                    <div className="grid grid-cols-12 divide-y divide-slate-200 text-sm">
                                        {renderPairRow(
                                            '이름',
                                            renderTextControl('name', '이름 입력', 'text', true),
                                            '주민번호',
                                            renderTextControl('idNumber', '000000-0000000'),
                                            true
                                        )}
                                        {renderPairRow(
                                            '연락처',
                                            renderTextControl('contact', '010-0000-0000'),
                                            '이메일',
                                            renderTextControl('email', 'example@email.com', 'email')
                                        )}
                                        {renderFullRow('주소', renderTextControl('address', '주소 입력'))}
                                    </div>
                                </section>

                                <section className="overflow-hidden rounded-lg border border-slate-300 shadow-sm">
                                    {renderSectionHeader(faBriefcase, '근무 정보 (Work Information)', 'bg-blue-500')}
                                    <div className="grid grid-cols-12 divide-y divide-slate-200 text-sm">
                                        {renderPairRow(
                                            '부서',
                                            renderTextControl('department', '부서 입력'),
                                            '직책',
                                            renderSelectControl('role', positionOptions, '직책 선택', true),
                                            false,
                                            true
                                        )}
                                        {renderPairRow(
                                            '고용형태',
                                            renderSelectControl('employmentType', EMPLOYMENT_TYPE_OPTIONS),
                                            '상태',
                                            renderSelectControl('status', STATUS_OPTIONS)
                                        )}
                                        {renderFullRow('입사일', renderTextControl('joinDate', '', 'date'))}
                                    </div>
                                </section>

                                <section className="overflow-hidden rounded-lg border border-slate-300 shadow-sm">
                                    {renderSectionHeader(faWallet, '급여·계좌 정보 (Payroll & Account)', 'bg-emerald-500')}
                                    <div className="grid grid-cols-12 divide-y divide-slate-200 text-sm">
                                        {renderPairRow(
                                            '급여구분',
                                            renderSelectControl('salaryModel', SALARY_MODEL_OPTIONS),
                                            '급여/단가',
                                            renderTextControl('unitPrice', '0', 'number')
                                        )}
                                        {renderPairRow(
                                            '은행',
                                            renderTextControl('bankName', '은행명 입력'),
                                            '계좌번호',
                                            renderTextControl('accountNumber', '계좌번호 입력')
                                        )}
                                        {renderFullRow('예금주', renderTextControl('accountHolder', '예금주 입력'))}
                                    </div>
                                </section>

                                <section className="overflow-hidden rounded-lg border border-slate-300 shadow-sm">
                                    {renderSectionHeader(faIdCard, '메모 (Memo)', 'bg-slate-400')}
                                    <div className="grid grid-cols-12 divide-y divide-slate-200 text-sm">
                                        {renderFullRow(
                                            '메모',
                                            <textarea
                                                value={formData.memo}
                                                rows={3}
                                                onChange={(event) => handleInputChange('memo', event.target.value)}
                                                className={`${inputClassName} min-h-[86px] resize-y`}
                                                placeholder="메모 입력"
                                            />
                                        )}
                                    </div>
                                </section>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
                                취소
                            </button>
                            <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
                                <FontAwesomeIcon icon={saving ? faSpinner : faCheckCircle} spin={saving} className="mr-2" />
                                저장
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {linkingStaff && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
                    <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">유저 계정 연동</h2>
                                <p className="mt-1 text-xs text-slate-500">{linkingStaff.name} 사무실 직원과 로그인 계정을 연결합니다.</p>
                            </div>
                            <button type="button" onClick={() => setLinkingStaff(null)} className="text-slate-400 hover:text-slate-600">
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        </div>

                        <div className="p-6">
                            {linkingStaff.id && ownerByStaffId.get(linkingStaff.id) ? (
                                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                                    <div className="text-sm font-bold text-blue-800">현재 연동 계정</div>
                                    <div className="mt-1 text-sm text-blue-700">{getUserLabel(userByUid.get(ownerByStaffId.get(linkingStaff.id)!))}</div>
                                    <button
                                        type="button"
                                        onClick={() => handleUnlinkUser(linkingStaff)}
                                        disabled={saving}
                                        className="mt-3 rounded-lg bg-white px-3 py-2 text-sm font-bold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-60"
                                    >
                                        연동 해제
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="relative mb-3">
                                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-xs text-slate-400" />
                                        <input
                                            value={linkUserSearch}
                                            onChange={(event) => setLinkUserSearch(event.target.value)}
                                            placeholder="계정 이름, 이메일, 직책 검색"
                                            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div className="max-h-[360px] overflow-y-auto rounded-lg border border-slate-200">
                                        {filteredUsers.map((user) => (
                                            <button
                                                type="button"
                                                key={user.uid}
                                                onClick={() => setSelectedUserUid(user.uid)}
                                                className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 ${selectedUserUid === user.uid ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                                            >
                                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                                    <FontAwesomeIcon icon={faUser} />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate font-bold text-slate-800">{user.displayName || '이름 없음'}</span>
                                                    <span className="block truncate text-xs text-slate-500">{user.email || user.uid}</span>
                                                </span>
                                                {selectedUserUid === user.uid && <FontAwesomeIcon icon={faCheckCircle} className="text-indigo-600" />}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {!(linkingStaff.id && ownerByStaffId.get(linkingStaff.id)) && (
                            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
                                <button type="button" onClick={() => setLinkingStaff(null)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
                                    취소
                                </button>
                                <button type="button" onClick={handleLinkUser} disabled={!selectedUserUid || saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
                                    <FontAwesomeIcon icon={saving ? faSpinner : faLink} spin={saving} className="mr-2" />
                                    계정 연결
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default OfficeStaffDatabase;
