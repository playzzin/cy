import { useEffect, useRef, useState } from 'react';
import { isPayrollTransferDetail } from './payrollTransferDetail';
import { loadPayrollDetailSettlements, recoverSavedPayrollDetail } from './payrollDetailRecovery';
import type { PayrollDetailRecoveryResult } from './payrollDetailRecovery';
import type { TransferCandidate } from './types';

export interface PayrollDetailLoadState { loading: boolean; error?: string }
const keyOf = (row: TransferCandidate) => JSON.stringify([row.period, row.sourceId, row.id]);
const makeScope = (key: string) => ({ key, pending: new Set<string>(), requests: new Map<string, ReturnType<typeof loadPayrollDetailSettlements>>() });

export function usePayrollDetailRecovery(scopeKey: string, onRecovered: (row: TransferCandidate, result: PayrollDetailRecoveryResult) => void) {
    const active = useRef(makeScope(scopeKey));
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    if (active.current.key !== scopeKey) active.current = makeScope(scopeKey);
    const [state, setState] = useState<{ scope: typeof active.current; rows: Record<string, PayrollDetailLoadState> }>({ scope: active.current, rows: {} });
    const recover = async (row: TransferCandidate) => {
        if (row.source !== 'payroll' || isPayrollTransferDetail(row.payrollDetail)) return;
        const scope = active.current, key = keyOf(row);
        if (scope.pending.has(key)) return;
        scope.pending.add(key);
        const update = (value: PayrollDetailLoadState) => {
            if (mounted.current && active.current === scope) setState(previous => ({ scope, rows: { ...(previous.scope === scope ? previous.rows : {}), [key]: value } }));
        };
        update({ loading: true });
        try {
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period)) throw new Error('저장된 항목에 대상 월이 없습니다. 급여에서 해당 월을 다시 조회해 주세요.');
            let request = scope.requests.get(row.period);
            if (!request) { request = loadPayrollDetailSettlements(row.period); scope.requests.set(row.period, request); }
            const result = recoverSavedPayrollDetail(row, await request);
            if (!mounted.current || active.current !== scope) return;
            onRecovered(row, result);
            update({ loading: false });
        } catch (error) {
            scope.requests.delete(row.period);
            update({ loading: false, error: error instanceof Error ? error.message : '상세내역을 불러오지 못했습니다. 다시 시도해 주세요.' });
        } finally { scope.pending.delete(key); }
    };
    return { recover, stateFor: (row: TransferCandidate) => state.scope === active.current ? state.rows[keyOf(row)] : undefined };
}
