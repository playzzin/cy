import { useEffect, useState } from 'react';
import { dailyReportService } from '../services/dailyReportService';
import { manpowerService } from '../services/manpowerService';

/**
 * 일보 데이터의 worker.teamId를 작업자 마스터 기준으로 수정하는 자동 마이그레이션 훅
 * 앱 시작 시 한 번만 실행되며, localStorage에 완료 플래그를 저장
 */
export const useWorkerTeamIdMigration = () => {
    const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
    const [result, setResult] = useState<{ updated: number; skipped: number } | null>(null);

    useEffect(() => {
        /* 
        // 과도한 백엔드 과금이 발생하여 마이그레이션 로직을 긴급 중단합니다.
        const MIGRATION_KEY = 'migration_worker_teamid_202512';

        if (localStorage.getItem(MIGRATION_KEY) === 'done') {
            setStatus('done');
            return;
        }

        const runMigration = async () => {
            setStatus('running');
            console.log('[Migration] Starting worker.teamId migration...');

            try {
                const workers = await manpowerService.getWorkers();
                const workerMap = new Map<string, { teamId?: string; teamName?: string }>();
                workers.forEach(w => {
                    if (w.id) {
                        workerMap.set(w.id, { teamId: w.teamId, teamName: w.teamName });
                    }
                });

                const migrationResult = await dailyReportService.migrateWorkerTeamIds(
                    '2025-01-01',
                    '2025-12-31',
                    workerMap
                );

                localStorage.setItem(MIGRATION_KEY, 'done');
                setStatus('done');
            } catch (error) {
                console.error('[Migration] Error:', error);
                setStatus('error');
            }
        };

        runMigration();
        */
        setStatus('done');
    }, []);

    return { status, result };
};
