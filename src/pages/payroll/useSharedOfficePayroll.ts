import { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from '../../config/firebase';
import { officeStaffPayrollService, validatePayrollMonth } from '../../services/officeStaffPayrollService';
import { describeCorporateTaxLoadError } from '../tax/corporateTaxLoadError';
import { STORAGE_KEY, StoredMonthData } from './officeStaffPayrollModel';

export const payrollDraftKey = (month: string) => `cy-office-payroll-draft:${auth.currentUser?.uid || 'anonymous'}:${month}`;
interface MonthState { month: string; data: StoredMonthData; revision: number; dirty: boolean; ready: boolean }
export function useSharedOfficePayroll(month: string) {
    const [state, setState] = useState<MonthState>({ month, data: {}, revision: 0, dirty: false, ready: false });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const generation = useRef(0);

    const load = useCallback(async (reload = false) => {
        const token = ++generation.current;
        setLoading(true); setError(''); setMessage('');
        try {
            const saved = await officeStaffPayrollService.loadMonth(month);
            if (token !== generation.current) return;
            let data = saved.data || {}, dirty = false, notice = saved.data ? '공용 저장 자료를 불러왔습니다.' : '공용 저장 자료가 없습니다. 급여 확인 후 공용 저장해 주세요.';
            try {
                const rawDraft = !reload && localStorage.getItem(payrollDraftKey(month));
                const draft = rawDraft ? JSON.parse(rawDraft) : null;
                if (draft && draft.revision === saved.revision) {
                    data = validatePayrollMonth(draft.data); dirty = true;
                    notice = '이 브라우저의 미저장 입력을 복원했습니다. 공용 저장 전에는 법인세에 반영되지 않습니다.';
                } else if (draft) {
                    notice = '다른 화면의 최신 공용 자료를 불러왔습니다. 이전 임시 입력은 브라우저에 보관되어 있습니다.';
                } else if (!saved.data && !reload) {
                    const rawLegacy = localStorage.getItem(STORAGE_KEY);
                    const legacy = rawLegacy ? JSON.parse(rawLegacy)?.[month] : null;
                    if (legacy) {
                        data = validatePayrollMonth(legacy); dirty = true;
                        notice = '기존 브라우저 자료를 불러왔습니다. 금액을 확인하고 공용 저장하면 다른 PC와 법인세 관리에 반영됩니다.';
                    }
                }
                if (reload) localStorage.removeItem(payrollDraftKey(month));
            } catch {
                notice += ' 브라우저 임시 자료를 읽지 못했습니다. 기존 브라우저 자료는 변경하지 않았습니다.';
            }
            setState({ month, data, revision: saved.revision, dirty, ready: true }); setMessage(notice);
        } catch (cause) {
            if (token === generation.current) setError(`공용 급여 조회 실패: ${describeCorporateTaxLoadError(cause)}`);
        } finally { if (token === generation.current) setLoading(false); }
    }, [month]);

    useEffect(() => { void load(); return () => { generation.current++; }; }, [load]);
    useEffect(() => {
        if (!state.dirty || !state.ready) return;
        try { localStorage.setItem(payrollDraftKey(state.month), JSON.stringify({ data: state.data, revision: state.revision })); }
        catch { setError('브라우저 임시 보관에 실패했습니다. 화면을 닫기 전에 공용 저장해 주세요.'); }
    }, [state]);
    useEffect(() => {
        if (!state.dirty) return;
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [state.dirty]);

    const update = (change: (previous: StoredMonthData) => StoredMonthData) => {
        if (loading || saving) return;
        setState(previous => previous.ready && previous.month === month ? { ...previous, data: change(previous.data), dirty: true } : previous);
        setMessage('미저장 입력이 있습니다. 공용 저장 후 다른 PC와 법인세 관리에 반영됩니다.');
    };
    const save = async (data: StoredMonthData) => {
        if (!state.ready || state.month !== month || loading || saving) return;
        const token = generation.current;
        setSaving(true); setError('');
        try {
            const revision = await officeStaffPayrollService.saveMonth(month, data, state.revision);
            if (token !== generation.current) return;
            setState({ month, data, revision, ready: true, dirty: false });
            setMessage('공용 저장했습니다. 다른 PC와 법인세 관리에서 같은 급여를 조회합니다.');
            try { localStorage.removeItem(payrollDraftKey(month)); }
            catch { setMessage('공용 저장했습니다. 브라우저 임시 자료 정리는 실패했습니다.'); }
        } catch (cause) {
            if (token === generation.current) setError(cause instanceof Error ? cause.message : '공용 저장에 실패했습니다. 입력은 유지됩니다.');
        } finally { setSaving(false); }
    };
    const reload = () => {
        if (state.dirty && !window.confirm('미저장 입력을 버리고 최신 공용 자료를 불러오시겠습니까?')) return;
        void load(true);
    };
    return { ...state, ready: state.ready && state.month === month, loading, saving, message, error, update, save, reload };
}
