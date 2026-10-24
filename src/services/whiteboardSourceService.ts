import { dailyReportService } from './dailyReportService';
import { getTeamScopedRows } from './teamScopedReadService';
import { positiveManDay } from '../utils/manDayPrecision';

export interface WhiteboardSourceReport {
    id: string; date: string; siteId: string; siteName: string; teamId: string; teamName: string;
    totalManDay: number; recordedTotalManDay: number;
    workers: { workerId: string; name: string; teamId: string; teamName: string; manDay: number }[];
}

export async function getWhiteboardSourceReport(reportId: string): Promise<WhiteboardSourceReport> {
    const scoped = await getTeamScopedRows<WhiteboardSourceReport>('whiteboard_source_report', { reportId });
    if (scoped !== null) {
        if (!scoped[0]) throw new Error('원본 일보를 조회할 수 없습니다.');
        return scoped[0];
    }
    // Office/admin reads continue through the existing Firestore authorization.
    const report = await dailyReportService.getReport(reportId);
    if (!report) throw new Error('원본 일보가 삭제되었거나 존재하지 않습니다.');
    const workers = (report.workers || []).map(worker => ({
        workerId: worker.workerId || '', name: worker.name || '이름 미기록',
        teamId: worker.teamId || report.teamId || '', teamName: worker.workerTeamName || report.teamName || '',
        manDay: positiveManDay(worker.manDay),
    }));
    return {
        id: report.id || reportId, date: report.date, siteId: report.siteId, siteName: report.siteName || '',
        teamId: report.teamId, teamName: report.teamName || '', workers,
        totalManDay: positiveManDay(workers.length ? workers.reduce((sum, worker) => sum + worker.manDay, 0) : report.totalManDay),
        recordedTotalManDay: positiveManDay(report.totalManDay),
    };
}
