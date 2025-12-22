export interface Worker {
    id: string;
    name: string;
    team: string; // Team ID or Name
    role: string; // e.g., '팀장', '기능공'
    unitPrice: number;
    residentNumber?: string;
    phone?: string;
    address?: string;
    bankAccount?: string;
    bankName?: string;
    joinDate?: string;
    isActive?: boolean;
}
