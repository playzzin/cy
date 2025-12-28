import { dailyReportService } from './dailyReportService';
import { supportRateService } from './supportRateService';

// 인력 교류 데이터 타입
export interface LaborExchangeItem {
    date: string;
    siteId: string;
    siteName: string;
    reportTeamId: string;       // 일보 작성팀 (현장 담당팀)
    reportTeamName: string;
    workerTeamId: string;       // 작업자 실제 소속팀
    workerTeamName: string;
    workerId: string;
    workerName: string;
    manDay: number;
    unitPrice: number;
    supportRate: number;
    amount: number;
}

// 팀별 정산 요약
export interface TeamExchangeSummary {
    teamId: string;
    teamName: string;
    yearMonth: string;
    // 일하러 간 곳 (받을 돈)
    outgoing: {
        items: LaborExchangeItem[];
        totalManDay: number;
        totalAmount: number;
    };
    // 일하러 온 곳 (줄 돈)
    incoming: {
        items: LaborExchangeItem[];
        totalManDay: number;
        totalAmount: number;
    };
    // 순정산
    netAmount: number;
}

export const laborExchangeService = {
    /**
     * 특정 월의 인력 교류 데이터 조회
     * 인력 교류 조건: 일보 작성팀(teamId) ≠ 작업자 소속팀(worker.teamId)
     */
    async getExchangeReport(
        year: number,
        month: number,
        teamId?: string
    ): Promise<TeamExchangeSummary[]> {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
        const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

        // 일보 데이터 조회
        const reports = await dailyReportService.getReportsByRange(startDate, endDate);

        // 인력 교류 아이템 추출
        const exchangeItems: LaborExchangeItem[] = [];

        for (const report of reports) {
            if (!report.teamId) continue;

            for (const worker of report.workers) {
                // 일보 작성팀 ≠ 작업자 소속팀 = 인력 교류
                const isExchange = worker.teamId && worker.teamId !== report.teamId;

                if (isExchange) {
                    const workerUnitPrice = worker.unitPrice || 0;
                    const workerTeamId = worker.teamId!;
                    const applicableRate = await supportRateService.getApplicableRate(
                        workerTeamId,
                        report.teamId,
                        workerUnitPrice
                    );

                    exchangeItems.push({
                        date: report.date,
                        siteId: report.siteId,
                        siteName: report.siteName,
                        reportTeamId: report.teamId,
                        reportTeamName: report.teamName || '',
                        workerTeamId: workerTeamId,
                        workerTeamName: '',
                        workerId: worker.workerId,
                        workerName: worker.name,
                        manDay: worker.manDay,
                        unitPrice: workerUnitPrice,
                        supportRate: applicableRate,
                        amount: worker.manDay * applicableRate
                    });
                }
            }
        }

        // 팀별로 그룹화
        const teamIds = new Set<string>();
        exchangeItems.forEach(item => {
            teamIds.add(item.workerTeamId);
            teamIds.add(item.reportTeamId);
        });

        // 특정 팀만 필터링
        const targetTeamIds = teamId ? [teamId] : Array.from(teamIds);

        const summaries: TeamExchangeSummary[] = [];

        for (const tid of targetTeamIds) {
            // 일하러 간 곳: 이 팀 소속 작업자가 다른 팀 현장에서 일함 (받을 돈)
            const outgoingItems = exchangeItems.filter(
                item => item.workerTeamId === tid
            );
            const outgoingManDay = outgoingItems.reduce((sum, i) => sum + i.manDay, 0);
            const outgoingAmount = outgoingItems.reduce((sum, i) => sum + i.amount, 0);

            // 일하러 온 곳: 다른 팀 작업자가 이 팀 현장에서 일함 (줄 돈)
            const incomingItems = exchangeItems.filter(
                item => item.reportTeamId === tid
            );
            const incomingManDay = incomingItems.reduce((sum, i) => sum + i.manDay, 0);
            const incomingAmount = incomingItems.reduce((sum, i) => sum + i.amount, 0);

            // 교류 내역이 있는 경우만 추가
            if (outgoingItems.length > 0 || incomingItems.length > 0) {
                // Find team name from items
                const teamName =
                    outgoingItems.find(i => i.workerTeamId === tid)?.workerTeamName ||
                    incomingItems.find(i => i.reportTeamId === tid)?.reportTeamName ||
                    'Unknown Team';

                summaries.push({
                    teamId: tid,
                    teamName,
                    yearMonth,
                    outgoing: {
                        items: outgoingItems,
                        totalManDay: outgoingManDay,
                        totalAmount: outgoingAmount
                    },
                    incoming: {
                        items: incomingItems,
                        totalManDay: incomingManDay,
                        totalAmount: incomingAmount
                    },
                    netAmount: outgoingAmount - incomingAmount
                });
            }
        }

        return summaries;
    },

    /**
     * 팀 간 정산 매트릭스
     */
    async getExchangeMatrix(year: number, month: number): Promise<{
        teams: { id: string; name: string }[];
        matrix: Record<string, Record<string, number>>;
    }> {
        const summary = await this.getExchangeReport(year, month);

        const teams = summary.map(s => ({ id: s.teamId, name: s.teamName }));
        const matrix: Record<string, Record<string, number>> = {};

        for (const t1 of teams) {
            matrix[t1.id] = {};
            for (const t2 of teams) {
                matrix[t1.id][t2.id] = 0;
            }
        }

        for (const s of summary) {
            for (const item of s.incoming.items) {
                if (!matrix[s.teamId]) matrix[s.teamId] = {};
                matrix[s.teamId][item.workerTeamId] =
                    (matrix[s.teamId][item.workerTeamId] || 0) + item.amount;
            }
        }

        return { teams, matrix };
    }
};
