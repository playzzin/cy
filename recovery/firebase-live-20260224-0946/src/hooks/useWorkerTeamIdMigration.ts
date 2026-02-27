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
        const MIGRATION_KEY = 'migration_worker_teamid_202512';

        // 이미 완료된 경우 스킵
        if (localStorage.getItem(MIGRATION_KEY) === 'done') {
            setStatus('done');
            return;
        }

        const runMigration = async () => {
            setStatus('running');
            console.log('[Migration] Starting worker.teamId migration...');

            try {
                // 작업자 마스터 조회
                const workers = await manpowerService.getWorkers();
                const workerMap = new Map<string, { teamId?: string; teamName?: string }>();
                workers.forEach(w => {
                    if (w.id) {
                        workerMap.set(w.id, { teamId: w.teamId, teamName: w.teamName });
                    }
                });

                console.log(`[Migration] Loaded ${workerMap.size} workers from master`);

                // 2025년 1월부터 12월까지 마이그레이션 실행
                const migrationResult = await dailyReportService.migrateWorkerTeamIds(
                    '2025-01-01',
                    '2025-12-31',
                    workerMap
                );

                console.log('[Migration] Result:', migrationResult);
                setResult({ updated: migrationResult.updated, skipped: migrationResult.skipped });

                // 완료 플래그 저장
                localStorage.setItem(MIGRATION_KEY, 'done');
                setStatus('done');

                if (migrationResult.updated > 0) {
                    console.log(`[Migration] ✅ Successfully updated ${migrationResult.updated} reports`);
                }

            } catch (error) {
                console.error('[Migration] Error:', error);
                setStatus('error');
            }
        };

        runMigration();
    }, []);

    return { status, result };
};
