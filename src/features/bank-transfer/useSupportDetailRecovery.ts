import { useEffect, useRef, useState } from 'react';
import { loadSupportTransferCandidates } from './transferSources';
import { isSupportTransferDetail } from './supportTransferDetail';
import type { SupportTransferDetail, TransferCandidate, TransferLoadResult } from './types';

export interface SupportDetailLoadState { loading: boolean; error?: string }
const keyOf = (row: TransferCandidate) => JSON.stringify([row.period, row.sourceId]);
const makeScope = (key: string) => ({ key, pending: new Set<string>(), requests: new Map<string, Promise<TransferLoadResult>>() });

/** A missing snapshot is reconstructed from that row's month, without replacing transfer fields. */
export function useSupportDetailRecovery(scopeKey: string, onRecovered: (row: TransferCandidate, detail: SupportTransferDetail) => void) {
    const activeScope = useRef(makeScope(scopeKey));
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    if (activeScope.current.key !== scopeKey) activeScope.current = makeScope(scopeKey);
    const [state, setState] = useState<{ scope: typeof activeScope.current; rows: Record<string, SupportDetailLoadState> }>({ scope: activeScope.current, rows: {} });

    const recover = async (row: TransferCandidate) => {
        if (row.source !== 'support' || isSupportTransferDetail(row.supportDetail)) return;
        const scope = activeScope.current;
        const key = keyOf(row);
        if (scope.pending.has(key)) return;
        scope.pending.add(key);
        const update = (value: SupportDetailLoadState) => {
            if (!mounted.current || activeScope.current !== scope) return;
            setState(previous => ({ scope, rows: { ...(previous.scope === scope ? previous.rows : {}), [key]: value } }));
        };
        update({ loading: true });
        try {
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period)) throw new Error('저장된 항목에 조회월이 없습니다. 외부지원비 탭에서 해당 월의 항목을 새로 담아 주세요.');
            let request = scope.requests.get(row.period);
            if (!request) {
                request = loadSupportTransferCandidates(row.period);
                scope.requests.set(row.period, request);
                // A failed read must be retried rather than reused as an empty result.
                void request.then(result => {
                    if (!result.candidates.length) scope.requests.delete(row.period);
                }, () => { scope.requests.delete(row.period); });
            }
            const result = await request;
            if (!mounted.current || activeScope.current !== scope) return;
            const matches = result.candidates.filter(candidate => candidate.source === 'support' && candidate.period === row.period && candidate.sourceId === row.sourceId);
            if (matches.length !== 1 || !isSupportTransferDetail(matches[0].supportDetail)) {
                scope.requests.delete(row.period);
                throw new Error(result.warnings.join(' · ') || '해당 월·팀의 지원 상세내역을 찾지 못했습니다. 외부지원온곳 원본을 확인한 뒤 다시 시도해 주세요.');
            }
            onRecovered(row, { ...matches[0].supportDetail, restoredFromSource: true });
            update({ loading: false });
        } catch (error) {
            update({ loading: false, error: error instanceof Error ? error.message : '상세내역을 불러오지 못했습니다. 다시 시도해 주세요.' });
        } finally {
            scope.pending.delete(key);
        }
    };

    return {
        recover,
        stateFor: (row: TransferCandidate): SupportDetailLoadState | undefined => state.scope === activeScope.current ? state.rows[keyOf(row)] : undefined,
    };
}
