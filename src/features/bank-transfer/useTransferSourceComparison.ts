import { useEffect, useRef, useState } from 'react';
import { compareTransferSources } from './transferSourceComparison';
import type { TransferSourceReport } from './transferSourceComparison';
import type { TransferRow } from './types';

export function useTransferSourceComparison(scope: string, rows: TransferRow[]) {
    const key = JSON.stringify([scope, rows]);
    const active = useRef({ key, sequence: 0 });
    if (active.current.key !== key) active.current = { key, sequence: active.current.sequence + 1 };
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const [state, setState] = useState<{ key: string; loading: boolean; report?: TransferSourceReport; error?: string }>({ key, loading: false });
    const run = async () => {
        if (!rows.length) return;
        const token = ++active.current.sequence;
        setState({ key, loading: true });
        try {
            const report = await compareTransferSources(rows);
            if (mounted.current && active.current.key === key && active.current.sequence === token) setState({ key, loading: false, report });
        } catch {
            if (mounted.current && active.current.key === key && active.current.sequence === token) setState({ key, loading: false, error: '원본 비교를 완료하지 못했습니다. 다시 시도해 주세요.' });
        }
    };
    return { run, ...(state.key === key ? state : { key, loading: false }), stale: state.key !== key && !!state.report };
}
