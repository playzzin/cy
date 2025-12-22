export interface DailyReport {
    id: string;
    date: string; // YYYY-MM-DD
    team: string;
    site: string;
    weather?: string;
    workers: DailyReportWorker[];
    status: 'draft' | 'submitted' | 'approved';
    createdAt?: any;
}

export interface DailyReportWorker {
    workerId: string;
    name: string;
    role: string;
    gongsu: number; // e.g., 1.0, 0.5
    unitPrice: number;
    amount: number; // gongsu * unitPrice
    workDescription?: string;
}
