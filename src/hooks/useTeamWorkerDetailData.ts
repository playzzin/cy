import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dailyReportService, type DailyReportWorkerRow } from '../services/dailyReportService';
import { manpowerService, type Worker } from '../services/manpowerService';
import { teamService, type Team } from '../services/teamService';

type LoadStatus = 'loading' | 'ready' | 'failed';
type MasterState = { key: string; status: LoadStatus; teams: Team[]; workers: Worker[]; error: string };
type OutputState = { key: string; status: LoadStatus; rows: DailyReportWorkerRow[]; error: string };

const EMPTY_TEAMS: Team[] = [];
const EMPTY_WORKERS: Worker[] = [];
const EMPTY_ROWS: DailyReportWorkerRow[] = [];

/** Keep the worker directory usable while the larger monthly report is loading. */
export function useTeamWorkerDetailData({ startDate, endDate }: { startDate: string; endDate: string }) {
    const { currentUser } = useAuth();
    const uid = currentUser?.uid || '';
    const accountScope = useRef({ uid, generation: 0 });
    if (accountScope.current.uid !== uid) {
        accountScope.current = { uid, generation: accountScope.current.generation + 1 };
    }
    const [revision, setRevision] = useState(0);
    const masterKey = JSON.stringify([uid, accountScope.current.generation, revision]);
    const outputKey = JSON.stringify([uid, accountScope.current.generation, revision, startDate, endDate]);
    const currentKeys = useRef({ masterKey, outputKey });
    currentKeys.current = { masterKey, outputKey };
    const [master, setMaster] = useState<MasterState>({ key: '', status: 'loading', teams: [], workers: [], error: '' });
    const [output, setOutput] = useState<OutputState>({ key: '', status: 'loading', rows: [], error: '' });

    useEffect(() => {
        if (!uid) return;
        let active = true;
        setMaster({ key: masterKey, status: 'loading', teams: [], workers: [], error: '' });
        void Promise.all([teamService.getTeams(), manpowerService.getWorkers(true)]).then(([teams, workers]) => {
            if (active && currentKeys.current.masterKey === masterKey) {
                setMaster({ key: masterKey, status: 'ready', teams, workers, error: '' });
            }
        }).catch(() => {
            if (active && currentKeys.current.masterKey === masterKey) {
                setMaster({ key: masterKey, status: 'failed', teams: [], workers: [], error: '팀/작업자 데이터를 불러오지 못했습니다.' });
            }
        });
        return () => { active = false; };
    }, [uid, masterKey]);

    const currentMaster = master.key === masterKey;
    const masterReady = !!uid && currentMaster && master.status === 'ready';
    const masterFailed = !!uid && currentMaster && master.status === 'failed';

    useEffect(() => {
        if (!masterReady) return;
        let active = true;
        setOutput({ key: outputKey, status: 'loading', rows: [], error: '' });
        // Starting after the directory resolves prevents one callable batch from
        // making the small master reads wait for the entire monthly report.
        void dailyReportService.getWorkerRows({ startDate, endDate }).then(rows => {
            if (active && currentKeys.current.outputKey === outputKey) {
                setOutput({ key: outputKey, status: 'ready', rows, error: '' });
            }
        }).catch(() => {
            if (active && currentKeys.current.outputKey === outputKey) {
                setOutput({ key: outputKey, status: 'failed', rows: [], error: '출력 상세 데이터를 불러오지 못했습니다.' });
            }
        });
        return () => { active = false; };
    }, [masterReady, outputKey, startDate, endDate]);

    const refresh = useCallback(() => { setRevision(value => value + 1); }, []);
    const updateWorkerSignature = useCallback((id: string, url: string) => {
        setMaster(value => value.key === masterKey && currentKeys.current.masterKey === masterKey
            ? { ...value, workers: value.workers.map(worker => String(worker.id ?? '') === id ? { ...worker, signatureUrl: url } : worker) }
            : value);
    }, [masterKey]);
    const updateWorkerStatus = useCallback((id: string, status: string, isActive: boolean) => {
        setMaster(value => value.key === masterKey && currentKeys.current.masterKey === masterKey
            ? { ...value, workers: value.workers.map(worker => String(worker.id ?? '') === id ? { ...worker, status, isActive } : worker) }
            : value);
    }, [masterKey]);

    // Hide stale data during render, before effects start the next request. A new
    // month must never temporarily expose the old month as a printable result.
    const currentOutput = masterReady && output.key === outputKey;
    return {
        teams: masterReady ? master.teams : EMPTY_TEAMS,
        workers: masterReady ? master.workers : EMPTY_WORKERS,
        outputRows: currentOutput && output.status === 'ready' ? output.rows : EMPTY_ROWS,
        loadingMaster: !!uid && !masterReady && !masterFailed,
        loadingOutput: !!uid && !masterFailed && (!currentOutput || output.status === 'loading'),
        masterError: masterFailed ? master.error : '',
        outputError: currentOutput && output.status === 'failed' ? output.error : '',
        refresh,
        updateWorkerSignature,
        updateWorkerStatus,
    };
}
