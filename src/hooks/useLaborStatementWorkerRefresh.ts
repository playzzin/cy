import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { manpowerService, Worker } from '../services/manpowerService';

type WorkerIdentity = { workerId?: string | null; workerName?: string };

const createWorkerLookup = (workers: Worker[]) => {
    const byId = new Map(workers.filter(worker => worker.id).map(worker => [worker.id, worker]));
    const byName = new Map<string, Worker | null>();
    workers.forEach(worker => {
        const name = worker.name.trim();
        if (name) byName.set(name, byName.has(name) ? null : worker);
    });
    return ({ workerId, workerName }: WorkerIdentity): Worker | undefined =>
        (workerId ? byId.get(workerId) : undefined) ?? byName.get(workerName?.trim() ?? '') ?? undefined;
};

// Applying DB settings is an explicit refresh, including accounts saved in another tab.
export const useLaborStatementWorkerRefresh = () => {
    const [workers, setWorkers] = useState<Worker[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const active = useRef(true);
    const pending = useRef(false);
    useEffect(() => {
        active.current = true;
        return () => { active.current = false; };
    }, []);
    const findWorker = useMemo(() => workers === null ? null : createWorkerLookup(workers), [workers]);
    const refresh = useCallback(async () => {
        if (pending.current) return null;
        pending.current = true;
        setLoading(true);
        setError('');
        try {
            const nextWorkers = await manpowerService.getWorkers(true);
            if (!active.current) return null;
            setWorkers(nextWorkers);
            return createWorkerLookup(nextWorkers);
        } catch {
            if (active.current) setError('작업자 DB의 직불 정보를 불러오지 못했습니다. 다시 적용해 주세요.');
            return null;
        } finally {
            pending.current = false;
            if (active.current) setLoading(false);
        }
    }, []);
    return { workers, findWorker, refresh, loading, error };
};
