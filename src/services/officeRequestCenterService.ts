import { advanceRequestService, type AdvanceRequest, type AdvanceRequestStatus } from './advanceRequestService';
import {
    FIELD_REQUEST_OFF_DUTY_SITE_ID,
    fieldScheduleRequestService,
    isOffDutyOnlyFieldScheduleRequest,
    type FieldScheduleRequest,
} from './fieldScheduleRequestService';
import { teamExpenseLedgerService } from './teamExpenseLedgerService';
import type { TeamExpenseClaim } from '../types/teamExpenseLedger';

export type OfficeRequestType = 'advance' | 'offDuty' | 'fieldSchedule' | 'expense';

export interface OfficeRequestListOptions {
    type?: OfficeRequestType | 'all';
    status?: string | 'all' | 'pending';
    search?: string;
    limit?: number;
}

export interface OfficeRequestItem {
    requestId: string;
    type: OfficeRequestType;
    typeLabel: string;
    title: string;
    requester: string;
    requesterId?: string;
    teamName?: string;
    amount?: number;
    headcount?: number;
    date?: string;
    status: string;
    statusLabel: string;
    sourcePath: string;
    createdAt?: unknown;
    updatedAt?: unknown;
    raw: AdvanceRequest | FieldScheduleRequest | TeamExpenseClaim;
}

export interface OfficeRequestSummary {
    total: number;
    pending: number;
    advancePending: number;
    offDutyPending: number;
    fieldSchedulePending: number;
    expenseDraft: number;
}

const TYPE_LABELS: Record<OfficeRequestType, string> = {
    advance: '가불',
    offDuty: '휴무',
    fieldSchedule: '인원 요청',
    expense: '경비',
};

const STATUS_LABELS: Record<string, string> = {
    requested: '접수',
    approved: '승인',
    rejected: '반려',
    paid: '지급완료',
    cancelled: '취소',
    assigning: '배정중',
    assigned: '배정완료',
    confirmed: '확정',
    draft: '작성중',
    charged: '청구반영',
    settled: '정산완료',
};

const normalizeText = (value: unknown) => String(value ?? '').trim();

const toMillis = (value: unknown): number => {
    if (!value) return 0;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = new Date(value).getTime();
        return Number.isFinite(parsed) ? parsed : 0;
    }
    if (typeof value === 'object') {
        const record = value as { toMillis?: () => number; toDate?: () => Date; seconds?: number; _seconds?: number };
        if (typeof record.toMillis === 'function') return record.toMillis();
        if (typeof record.toDate === 'function') return record.toDate().getTime();
        const seconds = typeof record.seconds === 'number' ? record.seconds : record._seconds;
        if (typeof seconds === 'number') return seconds * 1000;
    }
    return 0;
};

const statusLabel = (status: unknown, type?: OfficeRequestType) => {
    const normalizedStatus = normalizeText(status);
    if ((type === 'offDuty' || type === 'fieldSchedule') && normalizedStatus === 'cancelled') {
        return '반려';
    }
    return STATUS_LABELS[normalizedStatus] || normalizedStatus || '미정';
};

const mapAdvanceRequest = (request: AdvanceRequest): OfficeRequestItem => ({
    requestId: request.id || '',
    type: 'advance',
    typeLabel: TYPE_LABELS.advance,
    title: `${request.workerName || '작업자'} 가불 신청`,
    requester: request.requesterName || request.workerName || request.requesterEmail || '요청자 미상',
    requesterId: request.requesterUid || request.workerId,
    teamName: request.teamName,
    amount: request.requestedAmount,
    date: request.periodStart && request.periodEnd ? `${request.periodStart} ~ ${request.periodEnd}` : request.yearMonth,
    status: request.status,
    statusLabel: statusLabel(request.status, 'advance'),
    sourcePath: '/payroll/advance-payment',
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    raw: request,
});

const mapFieldScheduleRequest = (request: FieldScheduleRequest): OfficeRequestItem => {
    const isOffDuty = isOffDutyOnlyFieldScheduleRequest(request);
    const workerNames = request.offDutyWorkerNames.join(', ');
    const type: OfficeRequestType = isOffDuty ? 'offDuty' : 'fieldSchedule';

    return {
        requestId: request.id || `${request.date}_${request.siteId || FIELD_REQUEST_OFF_DUTY_SITE_ID}`,
        type,
        typeLabel: TYPE_LABELS[type],
        title: isOffDuty
            ? `휴무 신청${workerNames ? `: ${workerNames}` : ''}`
            : `${request.siteName || '현장'} 인원 요청`,
        requester: request.requestedByName || workerNames || request.siteManagerName || '요청자 미상',
        requesterId: request.requestedById || request.siteManagerId,
        teamName: request.responsibleTeamName,
        headcount: request.requestedHeadcount,
        date: request.date,
        status: request.status,
        statusLabel: statusLabel(request.status, type),
        sourcePath: isOffDuty ? '/assignment/off-duty-request' : '/assignment/field-request',
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        raw: request,
    };
};

const mapExpenseClaim = (claim: TeamExpenseClaim): OfficeRequestItem => ({
    requestId: claim.id,
    type: 'expense',
    typeLabel: TYPE_LABELS.expense,
    title: claim.description || '경비 요청',
    requester: claim.payerTeamName || claim.chargeToTeamName || '요청자 미상',
    requesterId: claim.payerTeamId,
    teamName: claim.payerTeamName || claim.chargeToTeamName,
    amount: claim.amount,
    date: claim.date,
    status: claim.status,
    statusLabel: statusLabel(claim.status, 'expense'),
    sourcePath: '/support/expense-claims',
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
    raw: claim,
});

const matchesSearch = (item: OfficeRequestItem, search?: string) => {
    const keyword = normalizeText(search).toLowerCase();
    if (!keyword) return true;

    return [
        item.typeLabel,
        item.title,
        item.requester,
        item.teamName,
        item.statusLabel,
        item.date,
        item.requestId,
    ].some((value) => normalizeText(value).toLowerCase().includes(keyword));
};

const sortRequests = (items: OfficeRequestItem[]) =>
    [...items].sort((left, right) => {
        const rightTime = toMillis(right.createdAt || right.updatedAt || right.date);
        const leftTime = toMillis(left.createdAt || left.updatedAt || left.date);
        if (rightTime !== leftTime) return rightTime - leftTime;
        return normalizeText(right.date).localeCompare(normalizeText(left.date), 'ko-KR');
    });

const buildSummary = (items: OfficeRequestItem[]): OfficeRequestSummary => ({
    total: items.length,
    pending: items.filter((item) => item.status === 'requested' || item.status === 'draft').length,
    advancePending: items.filter((item) => item.type === 'advance' && item.status === 'requested').length,
    offDutyPending: items.filter((item) => item.type === 'offDuty' && item.status === 'requested').length,
    fieldSchedulePending: items.filter((item) => item.type === 'fieldSchedule' && item.status === 'requested').length,
    expenseDraft: items.filter((item) => item.type === 'expense' && item.status === 'draft').length,
});

export const officeRequestCenterService = {
    typeLabels: TYPE_LABELS,
    statusLabels: STATUS_LABELS,

    async listRequests(options: OfficeRequestListOptions = {}): Promise<OfficeRequestItem[]> {
        const [advanceRequests, fieldRequests, expenseClaims] = await Promise.all([
            advanceRequestService.listAll(),
            fieldScheduleRequestService.listAll(),
            teamExpenseLedgerService.listAllClaims(),
        ]);

        let items = [
            ...advanceRequests.map(mapAdvanceRequest),
            ...fieldRequests.map(mapFieldScheduleRequest),
            ...expenseClaims.map(mapExpenseClaim),
        ].filter((item) => item.requestId);

        if (options.type && options.type !== 'all') {
            items = items.filter((item) => item.type === options.type);
        }

        if (options.status === 'pending') {
            items = items.filter((item) => item.status === 'requested' || item.status === 'draft');
        } else if (options.status && options.status !== 'all') {
            items = items.filter((item) => item.status === options.status);
        }

        if (options.search) {
            items = items.filter((item) => matchesSearch(item, options.search));
        }

        const sorted = sortRequests(items);
        return typeof options.limit === 'number' ? sorted.slice(0, options.limit) : sorted;
    },

    async getSummary(): Promise<OfficeRequestSummary> {
        const items = await officeRequestCenterService.listRequests();
        return buildSummary(items);
    },

    approveAdvanceRequest: (
        requestId: string,
        reviewer: { uid?: string; name?: string; memo?: string }
    ): Promise<void> =>
        advanceRequestService.reviewRequest(requestId, {
            decision: 'approved',
            reviewedById: reviewer.uid,
            reviewedByName: reviewer.name,
            reviewMemo: reviewer.memo,
        }),

    rejectAdvanceRequest: (
        requestId: string,
        reviewer: { uid?: string; name?: string; memo?: string }
    ): Promise<void> =>
        advanceRequestService.reviewRequest(requestId, {
            decision: 'rejected',
            reviewedById: reviewer.uid,
            reviewedByName: reviewer.name,
            reviewMemo: reviewer.memo,
        }),

    markAdvancePaid: (
        requestId: string,
        actor: { uid?: string; name?: string; memo?: string }
    ): Promise<void> =>
        advanceRequestService.markPaid(requestId, {
            paidById: actor.uid,
            paidByName: actor.name,
            reviewMemo: actor.memo,
        }),

    confirmFieldRequest: (
        requestId: string,
        actor: { uid?: string; name?: string; memo?: string }
    ): Promise<void> =>
        fieldScheduleRequestService.updateRequestStatus(requestId, 'confirmed', {
            actorId: actor.uid,
            actorName: actor.name,
            memo: actor.memo,
        }),

    cancelFieldRequest: (
        requestId: string,
        actor: { uid?: string; name?: string; memo?: string }
    ): Promise<void> =>
        fieldScheduleRequestService.updateRequestStatus(requestId, 'cancelled', {
            actorId: actor.uid,
            actorName: actor.name,
            memo: actor.memo,
        }),

    chargeExpenseClaim: (
        requestId: string,
        actor: { uid?: string; name?: string; memo?: string }
    ): Promise<void> =>
        teamExpenseLedgerService.updateClaimStatus(requestId, 'charged', {
            actorId: actor.uid,
            actorName: actor.name,
            memo: actor.memo,
        }),

    settleExpenseClaim: (
        requestId: string,
        actor: { uid?: string; name?: string; memo?: string }
    ): Promise<void> =>
        teamExpenseLedgerService.updateClaimStatus(requestId, 'settled', {
            actorId: actor.uid,
            actorName: actor.name,
            memo: actor.memo,
        }),
};
