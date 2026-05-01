import {
    faCheckCircle,
    faClock,
    faForward,
    faBan,
    faFileSignature,
} from '@fortawesome/free-solid-svg-icons';

export type IssueStatus = 'ready' | 'issued' | 'pending' | 'deferred';

export const STATUS_CONFIG: Record<IssueStatus, { label: string; color: string; icon: any; bg: string; border: string }> = {
    ready: {
        label: '준비', color: 'text-violet-700', icon: faFileSignature,
        bg: 'bg-white', border: 'border-violet-200',
    },
    issued: {
        label: '완료', color: 'text-green-700', icon: faCheckCircle,
        bg: 'bg-green-50', border: 'border-green-200',
    },
    pending: {
        label: '대기', color: 'text-amber-700', icon: faClock,
        bg: 'bg-amber-50', border: 'border-amber-200',
    },
    deferred: {
        label: '이월', color: 'text-blue-700', icon: faForward,
        bg: 'bg-blue-50', border: 'border-blue-200',
    },
};

export interface TaxInvoiceIssue {
    id?: string;
    yearMonth: string;         // e.g. "2026-03"
    no: number;                // 순번
    isNew: string;             // 신규/입력/다원 상태
    issueDate: string;         // 발행일 (YYYY-MM-DD)
    recipient: string;         // 공급받는자 (업체명)
    item: string;              // 품목
    supplyAmount: number;      // 공급가 (음수 가능)
    note: string;              // 비고
    manDays: number;           // 공수
    teamName?: string;         // 현장담당팀
    remark?: string;           // 특이사항
    issueStatus: IssueStatus;  // issued/pending/deferred/cancelled
    scanCompleted: boolean;    // 스캔 완료 여부
    siteId?: string;           // 현장 ID (추적용)
    siteName?: string;         // 현장명 (추적용)
    siteType?: string;         // 현장구분: 지원/도급/직영
    paymentType?: string;      // 결제구분: 계산서/노무
    createdAt?: any;
    updatedAt?: any;
}

export interface SiteWorkSummary {
    siteId: string;            // 현장 ID
    siteName: string;          // 현장명
    manDays: number;           // 공수
    teamName: string;          // 현장담당팀 (responsibleTeamName)
    companyName: string;       // 발주사명 (= 공급받는자)
    siteType: string;          // 현장구분: 지원/도급/직영
    paymentType: string;       // 결제구분: 계산서/노무
    note: string;
}
