export interface DailyReportListSummaryMetrics {
    rowCount: number;
    workerCount: number;
    siteCount: number;
    dateCount: number;
    totalManDay: number;
    totalAmount: number;
}

export interface DailyReportSummaryRow {
    date?: string;
    siteId?: string;
    siteName?: string;
    workerId?: string;
    workerName?: string;
    workerTeamId?: string;
    workerTeamName?: string;
    manDay?: number;
    amount?: number;
    isEmptyReport?: boolean;
}

const normalizeKeyPart = (value: unknown): string => String(value ?? '').trim().replace(/\s+/g, '').toLowerCase();

export const buildDailyReportListSummary = (rows: readonly DailyReportSummaryRow[]): DailyReportListSummaryMetrics => {
    const workerKeys = new Set<string>();
    const siteKeys = new Set<string>();
    const dates = new Set<string>();
    let totalManDay = 0;
    let totalAmount = 0;

    rows.forEach((row) => {
        const date = String(row.date ?? '').trim();
        if (date) dates.add(date);

        const siteKey = normalizeKeyPart(row.siteId) || normalizeKeyPart(row.siteName);
        if (siteKey) siteKeys.add(siteKey);

        if (!row.isEmptyReport) {
            const workerId = normalizeKeyPart(row.workerId);
            const workerName = normalizeKeyPart(row.workerName);
            const workerTeam = normalizeKeyPart(row.workerTeamId) || normalizeKeyPart(row.workerTeamName);
            const workerKey = workerId || (workerName ? `${workerName}::${workerTeam}` : '');
            if (workerKey) workerKeys.add(workerKey);
        }

        totalManDay += Number.isFinite(row.manDay) ? Number(row.manDay) : 0;
        totalAmount += Number.isFinite(row.amount) ? Number(row.amount) : 0;
    });

    return {
        rowCount: rows.length,
        workerCount: workerKeys.size,
        siteCount: siteKeys.size,
        dateCount: dates.size,
        totalManDay,
        totalAmount,
    };
};
