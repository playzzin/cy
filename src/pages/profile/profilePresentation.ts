import type { Worker } from '../../services/manpowerService';
import type { OfficeStaff } from '../../services/officeStaffService';

export const getWorkerTeamName = (worker: Worker): string => {
    const teamName = String(worker.teamName || '').trim();
    if (teamName) return teamName;

    const teamId = String(worker.teamId || '').trim();
    return teamId || '팀 미배정';
};

export const getWorkerPositionName = (worker: Worker): string => {
    const rank = String(worker.rank || '').trim();
    if (rank) return rank;

    return String(worker.role || '').trim();
};

export const toManDayNumber = (value: unknown): number => {
    const numericValue = Number(value ?? 0);
    return Number.isFinite(numericValue) ? numericValue : 0;
};

export const formatManDay = (value: number): string =>
    value.toLocaleString('ko-KR', {
        minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
        maximumFractionDigits: 1,
    });

export const toText = (value: unknown): string => String(value ?? '').trim();

export const formatCurrency = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '';
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return String(value);
    return `${numericValue.toLocaleString('ko-KR')}원`;
};

export const formatDateLike = (value: unknown): string => {
    if (!value) return '';
    let date: Date | null = null;
    if (value instanceof Date) date = value;
    else if (typeof value === 'string') date = new Date(value);
    else if (typeof value === 'object') {
        const timestamp = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
        if (typeof timestamp.toDate === 'function') date = timestamp.toDate();
        else if (typeof (timestamp.seconds ?? timestamp._seconds) === 'number') {
            date = new Date((timestamp.seconds ?? timestamp._seconds!) * 1000);
        }
    }
    return date && Number.isFinite(date.getTime()) ? date.toLocaleString('ko-KR') : '';
};

export interface ProfileDraft { displayName: string; phoneNumber: string }
export type ProfileErrors = Partial<Record<keyof ProfileDraft, string>>;
export const validateProfileDraft = (draft: ProfileDraft): ProfileErrors => {
    const errors: ProfileErrors = {};
    const name = draft.displayName.trim();
    const phone = draft.phoneNumber.trim();
    if (!name) errors.displayName = '이름을 입력해 주세요.';
    else if (name.length > 50) errors.displayName = '이름은 50자 이내로 입력해 주세요.';
    if (phone && (!/^\+?[\d\s()-]+$/.test(phone) || !/^\d{7,15}$/.test(phone.replace(/\D/g, '')) || phone.length > 30)) {
        errors.phoneNumber = '연락처는 숫자 7~15자리로 입력해 주세요. 공백과 하이픈을 사용할 수 있습니다.';
    }
    return errors;
};

export const profileStatus = (status: string | undefined) => {
    switch (status) {
        case 'active': return { label: '계정 활성', tone: 'active' };
        case 'pending': return { label: '승인 대기', tone: 'pending' };
        case 'rejected': return { label: '반려', tone: 'rejected' };
        case 'suspended': return { label: '사용 중지', tone: 'suspended' };
        default: return { label: '상태 확인 필요', tone: 'unknown' };
    }
};

export const personalDetailLabels = new Set(['주민번호', '주소', '혈액형', '급여유형', '단가', '은행', '계좌번호', '예금주']);

export const formatEmploymentStatus = (record: { status?: unknown; isActive?: unknown }): string => {
    if (record.isActive === false) return '퇴사';

    const status = toText(record.status).toLowerCase();
    if (!status) return record.isActive === true ? '재직중' : '';

    if (['inactive', 'resigned', 'retired', '퇴사', '퇴사자', '출입금지'].includes(status)) {
        return '퇴사';
    }

    if (['active', 'employed', 'working', '재직', '재직중', '근무', '미배정'].includes(status)) {
        return '재직중';
    }

    return toText(record.status);
};

export const buildWorkerDetails = (worker: Worker): Array<{ label: string; value: string }> => {
    const details = [
        { label: '작업자명', value: toText(worker.name) },
        { label: '주민번호', value: toText(worker.idNumber) },
        { label: '작업자 연락처', value: toText(worker.contact) },
        { label: '작업자 이메일', value: toText(worker.email) },
        { label: '주소', value: toText(worker.address) },
        { label: '팀 유형', value: toText(worker.teamType) },
        { label: '회사', value: toText(worker.companyName || worker.companyId) },
        { label: '현장', value: toText(worker.siteName || worker.siteId) },
        { label: '직무', value: toText(worker.role) },
        { label: '고용형태', value: toText(worker.employmentType) },
        { label: '급여유형', value: toText(worker.salaryModel || worker.payType) },
        { label: '단가', value: formatCurrency(worker.unitPrice) },
        { label: '누적공수', value: `${formatManDay(toManDayNumber(worker.totalManDay))}공수` },
        { label: '은행', value: toText(worker.bankName) },
        { label: '계좌번호', value: toText(worker.accountNumber) },
        { label: '예금주', value: toText(worker.accountHolder) },
        { label: '상태', value: formatEmploymentStatus(worker) },
        { label: '혈액형', value: toText(worker.bloodType) },
        { label: '등록일', value: formatDateLike(worker.createdAt) },
        { label: '수정일', value: formatDateLike(worker.updatedAt) },
    ];

    return details.filter((item) => item.value);
};

export const buildOfficeStaffDetails = (staff: OfficeStaff): Array<{ label: string; value: string }> => {
    const details = [
        { label: '사무실 직원명', value: toText(staff.name) },
        { label: '주민번호', value: toText(staff.idNumber) },
        { label: '사무실 연락처', value: toText(staff.contact) },
        { label: '사무실 이메일', value: toText(staff.email) },
        { label: '주소', value: toText(staff.address) },
        { label: '부서', value: toText(staff.department) },
        { label: '직책', value: toText(staff.role) },
        { label: '고용형태', value: toText(staff.employmentType) },
        { label: '급여유형', value: toText(staff.salaryModel || staff.payType) },
        { label: '단가', value: formatCurrency(staff.unitPrice) },
        { label: '은행', value: toText(staff.bankName) },
        { label: '계좌번호', value: toText(staff.accountNumber) },
        { label: '예금주', value: toText(staff.accountHolder) },
        { label: '입사일', value: toText(staff.joinDate) },
        { label: '상태', value: formatEmploymentStatus(staff) },
        { label: '메모', value: toText(staff.memo) },
        { label: '등록일', value: formatDateLike(staff.createdAt) },
        { label: '수정일', value: formatDateLike(staff.updatedAt) },
    ];

    return details.filter((item) => item.value);
};


