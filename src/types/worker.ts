export interface Worker {
    id: string;
    name: string;
    team: string; // Team ID or Name
    role: string; // e.g., '팀장', '기능공'
    payType?: string; // 급여 방식 (일급, 월급 등)
    unitPrice: number;
    residentNumber?: string;
    phone?: string;
    address?: string;
    bankAccount?: string;
    bankName?: string;
    joinDate?: string;
    isActive?: boolean;
}
