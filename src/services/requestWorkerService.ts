import { manpowerService, type Worker } from './manpowerService';
import { getTeamScopedRows } from './teamScopedReadService';

export async function getRequestWorkers(): Promise<{ workers: Worker[]; canRequestForTeam: boolean }> {
    const scoped = await getTeamScopedRows<Worker>('workers');
    if (scoped !== null) return { workers: scoped, canRequestForTeam: true };
    return { workers: await manpowerService.getWorkers(true), canRequestForTeam: false };
}
