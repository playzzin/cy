export type FreelancerTaxExcelDetailRow = [number, string, string, number];

export interface FreelancerTaxExcelTeamSummary {
    teamName: string;
    startIndex: number;
    endIndex: number;
    total: number;
}

export interface FreelancerTaxExcelReport {
    detailRows: FreelancerTaxExcelDetailRow[];
    teamSummaries: FreelancerTaxExcelTeamSummary[];
    grandTotal: number;
}

interface BuildFreelancerTaxExcelRowsOptions {
    allRows: any[];
    currentTeamRows?: any[];
    selectedTeamId: string | null;
    monthKey: string;
    normalizeTeamId: (teamId?: string | null) => string;
    sortFreelancers: (left: any, right: any) => number;
    toFiniteAmount: (value: unknown) => number;
}

const formatResidentNumber = (value: unknown): string => {
    const raw = String(value ?? '').trim();
    const digits = raw.replace(/\D/g, '');
    return digits.length === 13
        ? `${digits.slice(0, 6)}-${digits.slice(6)}`
        : raw;
};

export const buildFreelancerTaxExcelRows = ({
    allRows,
    currentTeamRows,
    selectedTeamId,
    monthKey,
    normalizeTeamId,
    sortFreelancers,
    toFiniteAmount,
}: BuildFreelancerTaxExcelRowsOptions): FreelancerTaxExcelReport => {
    const sourceRows = selectedTeamId && currentTeamRows
        ? [
            ...allRows.filter((row) => normalizeTeamId(row.teamId) !== selectedTeamId),
            ...currentTeamRows,
        ]
        : allRows;
    const groupedRows = new Map<string, { teamName: string; rows: any[] }>();

    sourceRows
        .filter((row) => row && toFiniteAmount(row[monthKey]) > 0)
        .forEach((row) => {
            const teamId = normalizeTeamId(row.teamId);
            const teamName = String(row.teamName ?? '').trim() || '팀 미지정';
            const teamKey = teamId || `name:${teamName}`;
            const group = groupedRows.get(teamKey) || { teamName, rows: [] };
            group.rows.push(row);
            groupedRows.set(teamKey, group);
        });

    let detailNumber = 1;
    const detailRows: FreelancerTaxExcelDetailRow[] = [];
    const teamSummaries: FreelancerTaxExcelTeamSummary[] = [];

    Array.from(groupedRows.values())
        .sort((left, right) => left.teamName.localeCompare(right.teamName, 'ko'))
        .forEach(({ teamName, rows }) => {
            const sortedRows = [...rows].sort(sortFreelancers);
            const startIndex = detailRows.length;

            sortedRows.forEach((item) => {
                detailRows.push([
                    detailNumber++,
                    String(item.name ?? '').trim(),
                    formatResidentNumber(item.residentNumber),
                    toFiniteAmount(item[monthKey]),
                ]);
            });

            const teamTotal = sortedRows.reduce(
                (sum, item) => sum + toFiniteAmount(item[monthKey]),
                0
            );

            teamSummaries.push({
                teamName,
                startIndex,
                endIndex: detailRows.length - 1,
                total: teamTotal,
            });
        });

    return {
        detailRows,
        teamSummaries,
        grandTotal: detailRows.reduce((sum, row) => sum + row[3], 0),
    };
};
