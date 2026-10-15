import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowRight, Check, Copy, FolderOpen, GripVertical, Landmark, Plus, RefreshCw, Save, Search, X } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { useAuth } from '../../contexts/AuthContext';
import { useIssueNavigationGuard } from '../../pages/taxinvoice/useIssueNavigationGuard';
import { loadAccountTransferCandidates, loadRentTransferCandidates, loadSupportTransferCandidates } from './transferSources';
import { addTransferCandidates, applyMemoRule, buildTransferWorkbook, CATEGORY_LABELS, SOURCE_LABELS, validateTransferRow } from './transferModel';
import { deleteTransferDraft, getTransferDraftStorageKey, loadTransferDrafts, saveTransferDraft } from './transferDraftStorage';
import { clearTransferHandoff, readTransferHandoff } from './transferHandoff';
import type { AccountCategory, AccountTeamAffiliation, TransferCandidate, TransferDraft, TransferLoadResult, TransferRow, TransferSource } from './types';
import './BankTransferPage.css';
import './BankTransferTheme.css';
import PayrollTransferDetails from './PayrollTransferDetails';
import SupportTransferDetails from './SupportTransferDetails';
import { useSupportDetailRecovery } from './useSupportDetailRecovery';
import { isSupportTransferDetail } from './supportTransferDetail';
import type { SupportTransferDetail } from './types';
import { isPayrollTransferDetail } from './payrollTransferDetail';
import { usePayrollDetailRecovery } from './usePayrollDetailRecovery';
import type { PayrollDetailRecoveryResult } from './payrollDetailRecovery';
import { buildTransferReview } from './transferReview';
import TransferPreview from './TransferPreview';
import TransferExportHistory from './TransferExportHistory';
import TransferBackupPanel from './TransferBackupPanel';
import TransferSourceCheckPanel from './TransferSourceCheckPanel';
import { useTransferSourceComparison } from './useTransferSourceComparison';
import { createExportRecord, originalTransferAmount, transferSignature, transferTotals, workflowState } from './transferWorkflow';
import TransferListReview, { emptyListFilters, filterTransferList, ListFilters } from './TransferListReview';
import RentTransferDetails from './RentTransferDetails';
import { mergeTransferResults } from './transferResults';
import { BANK_CODES } from '../../pages/payroll/constants/payroll.constants';
import type { TransferResult } from './types';
import type { WorkerEmployment } from './types';
import { getWorkerEmployment } from './workerEmployment';
import WorkerEmploymentBadge from './WorkerEmploymentBadge';
import TransferGuide from './TransferGuide';

const PayrollTransferPicker = lazy(() => import('../../pages/payroll/MonthlyWageDraftPage'));

const SOURCES: TransferSource[] = ['account', 'payroll', 'rent', 'support'];
const CATEGORY_OPTIONS: AccountCategory[] = ['worker', 'team', 'company', 'purchase', 'other'];
const TEAM_AFFILIATIONS: Array<{ value: AccountTeamAffiliation | 'all'; label: string }> = [
    { value: 'all', label: '전체 팀' }, { value: 'cheongyeon', label: '청연이엔지' },
    { value: 'external', label: '외부팀' }, { value: 'unassigned', label: '소속 미지정' },
];
const SOURCE_LINKS: Record<TransferSource, string> = { account: '/database/account-management', payroll: '/payroll/monthly-wage', rent: '/support/accommodation', support: '/payroll/support-team-incoming' };
const CANDIDATE_DRAG = 'application/x-cy-transfer-candidate';
const ROW_DRAG = 'application/x-cy-transfer-row';
const money = (amount: number) => Number.isFinite(amount) ? amount.toLocaleString('ko-KR') : '확인 필요';
const currentMonth = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(new Date());
const newId = () => crypto.randomUUID();
const makeDraft = (): TransferDraft => ({ version: 1, id: newId(), title: `${currentMonth()} 송금 목록`, period: currentMonth(), receiverDisplay: '㈜다원', memoRule: '{이름}', rows: [], updatedAt: new Date().toISOString() });
const errorMessage = (error: unknown) => error instanceof Error ? error.message : '처리하지 못했습니다. 다시 시도해 주세요.';
const normalizeSearch = (value: string) => value.replace(/[\s-]/g, '').toLocaleLowerCase();
const workerTeamKey = (row: TransferCandidate) => row.accountTeamKey || `name:${row.groupName || '미배정'}`;
const dateTime = (value: string) => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// @guide-sync 기능 변경 시 transferGuideContent.ts 상단의 단계별 매핑을 따라
// 안내문·FAQ·transferGuideSimulation.ts·TransferGuideSimulator.tsx도 같은 변경에서 갱신한다.
export default function BankTransferPage() {
    const { currentUser } = useAuth();
    const userId = currentUser?.uid ?? '';
    const [draft, setDraft] = useState<TransferDraft>(makeDraft);
    const [savedSignature, setSavedSignature] = useState('');
    const [storedDraft, setStoredDraft] = useState<TransferDraft | null>(null);
    const [drafts, setDrafts] = useState<TransferDraft[]>([]);
    const [initializedUser, setInitializedUser] = useState('');
    const [source, setSource] = useState<TransferSource>('account');
    const [candidates, setCandidates] = useState<TransferCandidate[]>([]);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [loadError, setLoadError] = useState('');
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<AccountCategory | 'all'>('all');
    const [group, setGroup] = useState('all');
    const [workerTeam, setWorkerTeam] = useState('all');
    const [teamAffiliation, setTeamAffiliation] = useState<AccountTeamAffiliation | 'all'>('all');
    const [workerEmployment, setWorkerEmployment] = useState<Record<string, WorkerEmployment>>({});
    const [hideRetired, setHideRetired] = useState(false);
    const [candidateSelection, setCandidateSelection] = useState<Set<string>>(new Set());
    const [rowSelection, setRowSelection] = useState<Set<string>>(new Set());
    const [assignTarget, setAssignTarget] = useState<string | null>(null);
    const [notice, setNotice] = useState('');
    const [actionError, setActionError] = useState('');
    const [preview, setPreview] = useState(false);
    const [reviewMode, setReviewMode] = useState(false);
    const [listFilters, setListFilters] = useState<ListFilters>(emptyListFilters);
    const [focusRow, setFocusRow] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const [visibleLimit, setVisibleLimit] = useState(100);
    const [payrollRefresh, setPayrollRefresh] = useState(0);
    const [payrollLoaded, setPayrollLoaded] = useState(false);
    const [supportRecoveryRevision, setSupportRecoveryRevision] = useState(0);
    const [detailTarget, setDetailTarget] = useState<{ id: string; period: string } | null>(null);
    const detailPanel = useRef<HTMLElement>(null);
    const detailTrigger = useRef<HTMLElement | null>(null);
    const requestSequence = useRef(0);
    const employmentRequest = useRef(0);
    const initializedUserRef = useRef<string | null>(null);
    const cache = useRef<Record<string, TransferLoadResult>>({});
    const applyRecoveredSupportDetail = useCallback((target: TransferCandidate, detail: SupportTransferDetail) => {
        const matches = (row: TransferCandidate) => row.source === 'support' && row.period === target.period && row.sourceId === target.sourceId && !isSupportTransferDetail(row.supportDetail);
        setDraft(previous => previous.rows.some(matches) ? { ...previous, rows: previous.rows.map(row => matches(row) ? { ...row, supportDetail: detail } : row) } : previous);
        setCandidates(previous => previous.map(row => matches(row) ? { ...row, supportDetail: detail } : row));
    }, []);
    const supportRecovery = useSupportDetailRecovery(JSON.stringify([userId, initializedUser, draft.id, supportRecoveryRevision]), applyRecoveredSupportDetail);
    const applyRecoveredPayrollDetail = useCallback((target: TransferCandidate, result: PayrollDetailRecoveryResult) => {
        const patch = <T extends TransferCandidate,>(row: T): T => row.source === 'payroll' && row.id === target.id && row.sourceId === target.sourceId
            && row.period === target.period && !isPayrollTransferDetail(row.payrollDetail)
            ? { ...row, payrollDetail: result.detail, ...((row.warning || result.warning) ? { warning: [row.warning, result.warning].filter(Boolean).join(' · ') } : {}) } : row;
        setDraft(previous => ({ ...previous, rows: previous.rows.map(patch) }));
        setCandidates(previous => previous.map(patch));
    }, []);
    const payrollRecovery = usePayrollDetailRecovery(JSON.stringify([userId, initializedUser, draft.id, supportRecoveryRevision]), applyRecoveredPayrollDetail);
    const expandedRow = detailTarget ? [...draft.rows, ...candidates].find(row => row.id === detailTarget.id && row.period === detailTarget.period) : undefined;
    const showDetail = (row: TransferCandidate) => { detailTrigger.current = document.activeElement as HTMLElement; setDetailTarget({ id: row.id, period: row.period }); };
    const closeDetail = () => { setDetailTarget(null); detailTrigger.current?.focus(); };
    useEffect(() => { if (detailTarget) { detailPanel.current?.focus(); detailPanel.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); } }, [detailTarget]);
    const dirty = initializedUser === userId && !!userId && savedSignature !== JSON.stringify(draft);
    useIssueNavigationGuard(dirty, () => window.confirm('송금 목록에 저장하지 않은 변경이 있습니다. 저장하지 않고 이동할까요?'));

    useEffect(() => {
        if (initializedUserRef.current === userId) return;
        initializedUserRef.current = userId;
        setInitializedUser('');
        setDrafts([]); setStoredDraft(null); setAssignTarget(null); setDetailTarget(null); setPreview(false); setReviewMode(false); setListFilters(emptyListFilters); setNotice(''); setActionError('');
        setCandidates([]); setCandidateSelection(new Set()); setRowSelection(new Set());
        setWorkerEmployment({}); setHideRetired(false);
        employmentRequest.current += 1;
        cache.current = {};
        if (!userId) { setDraft(makeDraft()); setDrafts([]); return; }
        let initial = makeDraft();
        let baseline = JSON.stringify(initial);
        try {
            const saved = loadTransferDrafts(userId);
            if (saved.length) initial = saved.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
            setDrafts(saved);
            setStoredDraft(saved.find(item => item.id === initial.id) ?? null);
            baseline = JSON.stringify(initial);
        } catch (error) { setActionError(errorMessage(error)); }
        try {
            const incoming = readTransferHandoff(userId);
            if (incoming?.length) {
                const result = addTransferCandidates(initial.rows, incoming, initial.receiverDisplay, initial.memoRule);
                initial = { ...initial, rows: result.rows };
                clearTransferHandoff(userId);
                setNotice(`급여 미리보기 ${incoming.length - result.duplicateCount}건을 송금 목록에 담았습니다.${result.duplicateCount ? ` 이미 담긴 ${result.duplicateCount}건은 유지했습니다.` : ''}`);
            }
        } catch (error) {
            setActionError(errorMessage(error));
        }
        setSavedSignature(baseline);
        setDraft(initial);
        setInitializedUser(userId);
    }, [userId]);

    useEffect(() => {
        if (!userId || initializedUser !== userId) return;
        const onStorage = (event: StorageEvent) => {
            if (event.storageArea && event.storageArea !== window.localStorage) return;
            if (event.key !== null && event.key !== getTransferDraftStorageKey(userId)) return;
            try { setDrafts(loadTransferDrafts(userId)); setNotice(''); }
            catch (error) { setActionError(errorMessage(error)); }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [userId, initializedUser]);
    const storageChanged = storedDraft !== null && JSON.stringify(drafts.find(item => item.id === storedDraft.id) ?? null) !== JSON.stringify(storedDraft);

    // @guide-sync 01·02: 조회/새로고침/상세 복원 정책은 대상 찾기·급여·월세·지원비 안내와 시연에 반영한다.
    const loadSource = useCallback(async (force = false) => {
        const sequence = ++requestSequence.current;
        setLoading(false);
        setCandidates([]); setWarnings([]); setLoadError(''); setCandidateSelection(new Set()); setVisibleLimit(100);
        if (!userId || initializedUser !== userId) return;
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(draft.period)) { setLoadError('조회월을 선택해 주세요.'); return; }
        if (source === 'payroll') {
            setPayrollLoaded(false);
            if (force) setPayrollRefresh(value => value + 1);
            return;
        }
        setLoading(true);
        const key = `${source}:${source === 'account' ? '' : draft.period}`;
        const employmentSequence = source === 'account' ? ++employmentRequest.current : 0;
        try {
            const result = !force && cache.current[key] ? cache.current[key] : await (
                source === 'account' ? loadAccountTransferCandidates()
                    : source === 'rent' ? loadRentTransferCandidates(draft.period) : loadSupportTransferCandidates(draft.period)
            );
            // Keep the directory lookup usable when the user moves straight to payroll while it loads.
            if (source === 'account' && employmentSequence === employmentRequest.current) setWorkerEmployment(result.workerEmployment ?? {});
            if (sequence !== requestSequence.current) return;
            cache.current[key] = result;
            setCandidates(result.candidates); setWarnings(result.warnings);
        } catch (error) {
            if (source === 'account' && employmentSequence === employmentRequest.current) setWorkerEmployment({});
            if (sequence === requestSequence.current) setLoadError(errorMessage(error));
        } finally { if (sequence === requestSequence.current) setLoading(false); }
    }, [source, draft.period, userId, initializedUser]);
    useEffect(() => { void loadSource(); return () => { requestSequence.current += 1; }; }, [loadSource]);
    useEffect(() => { setCategory('all'); setGroup('all'); setWorkerTeam('all'); setTeamAffiliation('all'); setQuery(''); }, [source]);
    useEffect(() => { setVisibleLimit(100); setCandidateSelection(new Set()); }, [query, category, group, workerTeam, teamAffiliation, hideRetired]);
    const payrollScope = [userId, initializedUser, draft.id, supportRecoveryRevision, source, draft.period, payrollRefresh, preview, reviewMode].join('|');
    const activePayrollScope = useRef({ key: payrollScope, generation: 0 });
    if (activePayrollScope.current.key !== payrollScope) {
        activePayrollScope.current = { key: payrollScope, generation: activePayrollScope.current.generation + 1 };
    }
    const payrollGeneration = activePayrollScope.current.generation;
    const invalidatePayroll = useCallback(() => {
        if (source !== 'payroll' || activePayrollScope.current.generation !== payrollGeneration) return;
        setCandidates([]); setWarnings([]); setCandidateSelection(new Set()); setPayrollLoaded(false);
    }, [source, payrollGeneration]);
    const receivePayroll = useCallback((result: TransferLoadResult) => {
        if (source !== 'payroll' || activePayrollScope.current.generation !== payrollGeneration) return;
        setCandidates(result.candidates); setWarnings(result.warnings); setCandidateSelection(new Set());
        setVisibleLimit(100); setLoadError(''); setPayrollLoaded(true);
        const details = new Map<string, TransferCandidate | null>();
        const detailKey = (row: TransferCandidate) => JSON.stringify([row.id, row.period, row.sourceId]);
        result.candidates.forEach(row => { const key = detailKey(row); details.set(key, details.has(key) ? null : row); });
        setDraft(previous => {
            let changed = false;
            const rows = previous.rows.map(row => {
                const matching = details.get(detailKey(row));
                if (row.source !== 'payroll' || isPayrollTransferDetail(row.payrollDetail) || !matching || !isPayrollTransferDetail(matching.payrollDetail)) return row;
                changed = true;
                return { ...row, payrollDetail: { ...matching.payrollDetail, restoredFromSource: true },
                    ...((row.warning || matching.warning) ? { warning: [row.warning, matching.warning].filter(Boolean).join(' · ') } : {}) };
            });
            return changed ? { ...previous, rows } : previous;
        });
        setNotice(`급여 ${result.candidates.length}건을 불러왔습니다. 아래 목록에서 선택해 송금 목록에 담으세요.`);
    }, [source, payrollGeneration]);
    const payrollPicker = useMemo(() => ({ period: draft.period, onLoad: receivePayroll, onInvalidate: invalidatePayroll }), [draft.period, receivePayroll, invalidatePayroll]);

    // @guide-sync 01: 팀·재직 필터와 선택 범위 변경 시 demoCandidates 및 숨김/송금 제외 안내도 맞춘다.
    const workerTeamFilter = source === 'account' && category === 'worker';
    const categoryCandidates = useMemo(() => candidates.filter(row => (category === 'all' || row.category === category)
        && (source !== 'account' || category !== 'team' || teamAffiliation === 'all' || row.teamAffiliation === teamAffiliation)), [candidates, category, source, teamAffiliation]);
    const workerTeams = useMemo(() => {
        const options = new Map<string, { key: string; label: string; count: number }>();
        candidates.filter(row => row.category === 'worker').forEach(row => {
            const key = workerTeamKey(row);
            const option = options.get(key);
            if (option) option.count += 1;
            else options.set(key, { key, label: row.accountTeamLabel || row.groupName || '미배정', count: 1 });
        });
        return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, 'ko'));
    }, [candidates]);
    const groups = useMemo(() => Array.from(new Set(categoryCandidates.map(row => row.groupName).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko')), [categoryCandidates]);
    useEffect(() => { if (!loading && group !== 'all' && !groups.includes(group)) setGroup('all'); }, [groups, group, loading]);
    useEffect(() => { if (!loading && workerTeam !== 'all' && !workerTeams.some(team => team.key === workerTeam)) setWorkerTeam('all'); }, [workerTeams, workerTeam, loading]);
    const matchingCandidates = useMemo(() => {
        const term = normalizeSearch(query);
        return categoryCandidates.filter(row => (workerTeamFilter ? workerTeam === 'all' || workerTeamKey(row) === workerTeam : group === 'all' || row.groupName === group)
            && (!term || normalizeSearch(`${row.name} ${row.groupName} ${row.accountTeamLabel || ''} ${row.accountHolder} ${row.bankName} ${row.accountNumber} ${row.detail}`).includes(term)));
    }, [categoryCandidates, workerTeamFilter, workerTeam, group, query]);
    const retiredCount = matchingCandidates.filter(row => getWorkerEmployment(row, workerEmployment) === 'retired').length;
    const filtered = useMemo(() => matchingCandidates.filter(row => !hideRetired || getWorkerEmployment(row, workerEmployment) !== 'retired'), [matchingCandidates, hideRetired, workerEmployment]);
    const addedIds = useMemo(() => new Set(draft.rows.map(row => row.id)), [draft.rows]);
    const selectable = filtered.filter(row => !addedIds.has(row.id));
    const errorsByRow = useMemo(() => new Map(draft.rows.map(row => [row.rowId, validateTransferRow(row)])), [draft.rows]);
    const invalidCount = draft.rows.filter(row => errorsByRow.get(row.rowId)?.length).length;
    const total = draft.rows.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0);
    const sourceComparison = useTransferSourceComparison(JSON.stringify([userId, initializedUser, draft.id, supportRecoveryRevision]), draft.rows);
    const sourceNotes = useMemo(() => new Map(sourceComparison.report?.items.map(item => [item.rowId, item.notes]) ?? []), [sourceComparison.report]);
    const review = useMemo(() => buildTransferReview(draft.rows, { draftId: draft.id, savedDrafts: drafts, sourceNotes }), [draft.rows, draft.id, drafts, sourceNotes]);
    const canExport = draft.rows.length > 0 && invalidCount === 0 && Number.isSafeInteger(total) && total > 0;
    const workflow = workflowState(draft);
    const visibleRows = useMemo(() => filterTransferList(draft.rows, listFilters, review.notes), [draft.rows, listFilters, review.notes]);
    const selectedRows = draft.rows.filter(row => rowSelection.has(row.rowId));
    useEffect(() => {
        if (!focusRow || preview) return;
        const element = document.getElementById(`bt-row-${focusRow}`);
        element?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); element?.focus(); setFocusRow('');
    }, [focusRow, preview]);
    const fixRow = (row: TransferRow) => { setPreview(false); setReviewMode(true); setListFilters({ ...emptyListFilters, query: row.name }); setFocusRow(row.rowId); };
    // @guide-sync 03·06: 계좌/금액 수정 범위와 재검토 조건은 시연의 updateRows 및 오류 해결 장면에도 적용한다.
    const editRow = (id: string, change: Partial<TransferRow>) => setDraft(previous => ({ ...previous, rows: previous.rows.map(row => row.rowId === id ? { ...row, ...change } : row) }));
    const add = (items: TransferCandidate[]) => {
        if (!items.length) return;
        setActionError(''); setNotice('');
        try {
            const result = addTransferCandidates(draft.rows, items, draft.receiverDisplay, draft.memoRule);
            setDraft(previous => ({ ...previous, rows: result.rows }));
            setCandidateSelection(new Set());
            setNotice(`${result.rows.length - draft.rows.length}건을 담았습니다.${result.duplicateCount ? ` 중복 ${result.duplicateCount}건은 추가하지 않았습니다.` : ''}`);
        } catch (error) { setActionError(errorMessage(error)); }
    };
    const choose = (candidate: TransferCandidate) => {
        if (assignTarget) {
            editRow(assignTarget, { bankName: candidate.bankName, bankCode: candidate.bankCode, accountNumber: candidate.accountNumber, accountHolder: candidate.accountHolder });
            setAssignTarget(null); setNotice('선택한 송금 건의 입금계좌를 바꿨습니다.');
        } else add([candidate]);
    };
    const reorder = (from: string, to: string) => setDraft(previous => {
        const rows = previous.rows.slice(), fromIndex = rows.findIndex(row => row.rowId === from), toIndex = rows.findIndex(row => row.rowId === to);
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return previous;
        rows.splice(toIndex, 0, rows.splice(fromIndex, 1)[0]);
        return { ...previous, rows };
    });
    // @guide-sync 05: 저장/사본/불러오기 동작 변경 시 저장 위치 FAQ와 저장본 복원 연습을 함께 수정한다.
    const save = (asCopy = false) => {
        setActionError(''); setNotice('');
        try {
            const title = draft.title.trim() || `${draft.period} 송금 목록`;
            const next = { ...draft, ...(asCopy ? { id: newId(), exportHistory: [], review: undefined } : {}), title: asCopy ? `${title.slice(0, 95)} 사본` : title, updatedAt: new Date().toISOString() };
            saveTransferDraft(userId, next, { expectedDraft: asCopy ? null : storedDraft });
            setDraft(next); setStoredDraft(next); setSavedSignature(JSON.stringify(next)); setDrafts(loadTransferDrafts(userId));
            setNotice(`${asCopy ? '별도 사본으로 ' : ''}송금 목록과 상세 내역을 저장했습니다. 다음에는 ‘저장한 목록’에서 열어 이어서 작업하세요.`);
        } catch (error) {
            setActionError(errorMessage(error));
            try { setDrafts(loadTransferDrafts(userId)); } catch { /* Keep the original save error and current edits. */ }
        }
    };
    const replaceDraft = (next: TransferDraft) => {
        if (dirty && !window.confirm('현재 목록의 저장하지 않은 변경을 버리고 다른 목록을 열까요?')) return;
        setSupportRecoveryRevision(value => value + 1);
        setDetailTarget(null);
        setStoredDraft(drafts.find(item => item.id === next.id) ?? null);
        setDraft(next); setSavedSignature(JSON.stringify(next)); setRowSelection(new Set()); setAssignTarget(null); setPreview(false); setReviewMode(false); setListFilters(emptyListFilters); setActionError('');
        setNotice(drafts.some(item => item.id === next.id) ? `‘${next.title}’ 목록을 열었습니다. 저장 당시의 금액과 내역이 표시됩니다.` : '새 송금 목록입니다. 대상을 담고 금액을 확인해 주세요.');
    };
    const deleteCurrentDraft = () => {
        if (!window.confirm(`저장된 ‘${draft.title}’ 목록을 삭제할까요? 현재 송금 목록은 화면에 남습니다.`)) return;
        setActionError(''); setNotice('');
        try {
            deleteTransferDraft(userId, draft.id, { expectedDraft: storedDraft });
            setDrafts(loadTransferDrafts(userId));
            setSavedSignature('');
            setStoredDraft(null);
            setNotice('저장본을 삭제했습니다. 현재 목록은 다시 저장할 수 있습니다.');
        } catch (error) {
            setActionError(errorMessage(error));
            try { setDrafts(loadTransferDrafts(userId)); } catch { /* Preserve the failure message. */ }
        }
    };
    // @guide-sync 06: 출력 대상·검토·생성 이력·저장 실패 처리는 Preview 연습과 엑셀 안내에 함께 반영한다.
    const exportExcel = () => {
        setActionError(''); setNotice('');
        try {
            if (!workflow.reviewed) throw new Error('내용을 확인하고 검토 완료를 눌러 주세요.');
            const workbook = buildTransferWorkbook(draft.rows);
            const createdAt = new Date().toISOString();
            const periodLabel = review.periods.length > 1 ? '여러월' : review.periods[0] || draft.period || '직접입력';
            const stamp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()).replace(/[^\d]/g, '');
            const fileName = `국민은행_송금_${periodLabel}_${stamp}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            const record = createExportRecord(draft.rows, fileName, createdAt);
            const next = { ...draft, title: draft.title.trim() || `${periodLabel} 송금 목록`, updatedAt: createdAt, exportHistory: [record, ...(draft.exportHistory ?? [])].slice(0, 20) };
            setDraft(next);
            try {
                saveTransferDraft(userId, next, { expectedDraft: storedDraft });
                setStoredDraft(next); setSavedSignature(JSON.stringify(next)); setDrafts(loadTransferDrafts(userId));
                setNotice(`${draft.rows.length}건 · ${money(total)}원의 엑셀을 만들고 목록·생성 이력을 저장했습니다.`);
            } catch (error) {
                setNotice(`${draft.rows.length}건 · ${money(total)}원의 엑셀을 만들었습니다.`);
                setActionError(`파일은 생성했지만 목록·이력을 저장하지 못했습니다. ${errorMessage(error)}`);
                try { setDrafts(loadTransferDrafts(userId)); } catch { /* Keep current edits and the storage error. */ }
            }
        } catch (error) { setActionError(errorMessage(error)); }
    };
    const queryPayrollDetail = (row: TransferCandidate) => {
        setPreview(false); setReviewMode(false); setDetailTarget(null); setSource('payroll');
        if (/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period)) setDraft(previous => ({ ...previous, period: row.period }));
        setNotice('급여에서 기존 항목과 같은 월·금액 기준으로 불러오세요. 일치하는 항목은 상세만 연결하고 기존 송금액과 계좌는 유지합니다.');
    };
    // @guide-sync 04: 선택 행 적용 범위와 이름 치환 변경 시 D/E열 설명 및 applyMemo 연습도 갱신한다.
    const updateMemoForRows = () => {
        if (!selectedRows.length) return;
        setDraft(previous => ({ ...previous, rows: previous.rows.map(row => rowSelection.has(row.rowId) ? { ...row, receiverDisplay: previous.receiverDisplay, senderMemo: applyMemoRule(previous.memoRule, row.name) } : row) }));
        setNotice(`선택한 ${selectedRows.length}건에 통장 표시와 메모를 적용했습니다.`);
    };
    // @guide-sync 07: 결과 저장/실패 재처리 변경 시 원본 지급 상태 영향과 성공 건 재송금 방지 안내도 갱신한다.
    const applyResults = (id: string, results: TransferResult[], fileName?: string) => {
        setActionError(''); setNotice('');
        const record = draft.exportHistory?.find(item => item.id === id);
        if (!record) return;
        try {
            const updated = { ...record, results: mergeTransferResults(record, results), resultsUpdatedAt: new Date().toISOString(), resultFileName: fileName?.slice(0, 200) };
            const next = { ...draft, updatedAt: new Date().toISOString(), exportHistory: draft.exportHistory!.map(item => item.id === id ? updated : item) };
            setDraft(next);
            try {
                saveTransferDraft(userId, next, { expectedDraft: storedDraft });
                setStoredDraft(next); setSavedSignature(JSON.stringify(next)); setDrafts(loadTransferDrafts(userId));
                setNotice(`이체 결과 ${results.length}건을 저장했습니다. 원본의 지급 상태는 유지됩니다.`);
            } catch (error) { setActionError(`결과를 화면에 반영했지만 저장하지 못했습니다. 목록 저장 또는 백업으로 보관해 주세요. ${errorMessage(error)}`); }
        } catch (error) { setActionError(errorMessage(error)); }
    };
    const retryFailed = (rows: TransferRow[]) => {
        setActionError('');
        try {
            // Keep edits and recorded results before starting a separate retry list.
            const current = { ...draft, title: draft.title.trim() || '송금 목록', updatedAt: new Date().toISOString() };
            saveTransferDraft(userId, current, { expectedDraft: storedDraft });
            setDrafts(loadTransferDrafts(userId));
            const next = { ...makeDraft(), title: `${current.title.slice(0, 90)} 재송금`, period: draft.period, receiverDisplay: draft.receiverDisplay, memoRule: draft.memoRule, rows: JSON.parse(JSON.stringify(rows)) as TransferRow[] };
            setDraft(next); setStoredDraft(null); setSavedSignature(''); setPreview(false); setReviewMode(true); setListFilters(emptyListFilters);
            setRowSelection(new Set()); setDetailTarget(null); setAssignTarget(null); setSupportRecoveryRevision(value => value + 1);
            setNotice(`실패 ${rows.length}건만 새 목록에 담았습니다. 실패 사유와 계좌를 수정한 뒤 다시 검토하세요.`);
        } catch (error) { setActionError(errorMessage(error)); }
    };

    if (!userId) return <div className="bank-transfer-page"><p role="alert">로그인 후 송금 목록을 작성할 수 있습니다.</p></div>;
    if (initializedUser !== userId) return <div className="bank-transfer-page" role="status">저장한 송금 목록을 준비하고 있습니다…</div>;
    const savePanel = (<section key="draft-management" className="bt-draft-panel" aria-label="송금 목록 저장 및 불러오기">
            <div className="bt-draft-bar">
                <label>목록 이름<input aria-label="송금 목록 이름" placeholder="예: 10월 1차 급여" value={draft.title} maxLength={100} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
                <span className={`bt-save-state ${dirty || storageChanged ? 'is-dirty' : ''}`}>{storageChanged ? '다른 창에서 변경됨' : dirty ? '저장하지 않은 변경' : drafts.some(item => item.id === draft.id) ? '저장 완료' : '아직 저장 전'}</span>
                <button className="bt-save-button" onClick={() => save()} disabled={initializedUser !== userId}><Save size={15} /> 목록 저장</button>
                <button onClick={() => save(true)} disabled={initializedUser !== userId || !draft.rows.length} title="현재 편집 내용을 별도 목록으로 저장"><Copy size={14} /> 사본 저장</button>
                <button onClick={() => replaceDraft(makeDraft())}><Plus size={14} /> 새 목록</button>
            </div>
            <p className="bt-save-help"><strong>목록 저장</strong>으로 계좌·금액·상세내역을 보관합니다. 같은 브라우저·계정에서 이어서 작업할 수 있습니다.</p>
            <div className="bt-draft-tools">
            <TransferExportHistory key={draft.id} records={draft.exportHistory} currentRows={draft.rows} onResults={applyResults} onRetry={retryFailed} />
            <TransferBackupPanel key={userId} userId={userId} current={draft} onRestored={setDrafts} />
            <details className="bt-saved-lists"><summary><FolderOpen size={15} /> 저장한 목록 <span>{drafts.length}</span><small>이어서 작업하기</small></summary>
                {!drafts.length ? <p className="bt-saved-empty">아직 저장한 목록이 없습니다. 대상을 담은 뒤 ‘목록 저장’을 눌러 보세요.</p> : <div className="bt-saved-grid">{drafts.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(item => <article key={item.id} className={item.id === draft.id ? 'is-current' : ''}>
                    <div><strong>{item.title}</strong><span>{item.rows.length}건 · {money(item.rows.reduce((sum, row) => sum + row.amount, 0))}원</span><small>{new Date(item.updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 저장{item.id === draft.id ? ' · 현재 목록' : ''}</small>{item.exportHistory?.length ? <small className="bt-export-status">최근 파일 생성 {dateTime(item.exportHistory[0].createdAt)} · {item.exportHistory[0].rowCount}건 · {money(item.exportHistory[0].totalAmount)}원</small> : <small>파일 생성 이력 없음</small>}</div>
                    <button aria-label={`${item.title} 불러오기`} onClick={() => replaceDraft(item)}>불러오기 <ArrowRight size={14} /></button>
                </article>)}</div>}
                {drafts.some(item => item.id === draft.id) && <button className="bt-delete-saved" onClick={deleteCurrentDraft}>현재 목록의 저장본 삭제</button>}
            </details>
            </div>
        </section>);
    return <div className={`bank-transfer-page ${preview ? 'is-preview' : ''}`}>
        <header className="bt-page-header">
            <div className="bt-title"><span className="bt-logo"><Landmark size={22} /></span><div><h1>국민은행 송금</h1><p>급여·월세·외부지원비를 한 목록에서 준비합니다.</p></div></div>
            <div className="bt-header-actions"><Link to="/database/account-management">등록 계좌 관리 <ArrowRight size={14} /></Link><TransferGuide initialChapter={preview ? 5 : reviewMode ? 2 : 0} /></div>
        </header>
        <nav className="bt-stage-nav" aria-label="송금 파일 준비 순서"><button aria-current={!preview && !reviewMode ? 'step' : undefined} onClick={() => { setPreview(false); setReviewMode(false); }}>① 대상 가져오기</button><button aria-current={!preview && reviewMode ? 'step' : undefined} onClick={() => { setPreview(false); setReviewMode(true); }}>② 금액·계좌 검토</button><button aria-label="엑셀 미리보기" disabled={!draft.rows.length} aria-current={preview ? 'step' : undefined} onClick={() => setPreview(true)}>③ 엑셀 미리보기</button><span className="bt-work-state">{workflow.label}</span></nav>
        {(workflow.needsReview || workflow.changedSinceExport) && <p className="bt-check-warning">{workflow.changedSinceExport ? '최근 파일 생성 이후 목록이 변경되었습니다. 이전 파일은 생성 당시 내역으로 보관됩니다.' : '검토 이후 송금 내용이 변경되었습니다.'} 현재 내용을 다시 검토해 주세요.</p>}
        {!preview && savePanel}
        {notice && <div role="status" className="bt-notice"><Check size={15} />{notice}<button aria-label="안내 닫기" onClick={() => setNotice('')}><X size={14} /></button></div>}
        {actionError && <div role="alert" className="bt-error">{actionError}</div>}
        {!preview && !!draft.rows.length && <TransferSourceCheckPanel rows={draft.rows} loading={sourceComparison.loading} stale={sourceComparison.stale} report={sourceComparison.report} error={sourceComparison.error} crossDraftCount={review.crossDraftCount} onRun={() => { void sourceComparison.run(); }} />}
        {expandedRow && <section className="bt-expanded-detail" aria-label={`${expandedRow.name} 상세내역 전체 보기`} ref={detailPanel} tabIndex={-1} onKeyDown={event => { if (event.key === 'Escape') closeDetail(); }}>
            <div className="bt-section-heading"><div><h2>{expandedRow.name} · 상세내역 <WorkerEmploymentBadge status={getWorkerEmployment(expandedRow, workerEmployment)} /></h2><p>{expandedRow.period} · {SOURCE_LABELS[expandedRow.source]} · 이체금액 {money(expandedRow.amount)}원</p></div><button onClick={closeDetail} aria-label="상세내역 닫기"><X size={15} /> 닫기</button></div>
            <PayrollTransferDetails row={expandedRow} expanded loadState={payrollRecovery.stateFor(expandedRow)} onLoadDetail={() => { void payrollRecovery.recover(expandedRow); }} onQueryPayroll={() => queryPayrollDetail(expandedRow)} />
            <SupportTransferDetails row={expandedRow} expanded loadState={supportRecovery.stateFor(expandedRow)} onLoadDetail={() => { void supportRecovery.recover(expandedRow); }} />
            <RentTransferDetails row={expandedRow} expanded />
        </section>}
        {preview ? <TransferPreview workerEmployment={workerEmployment} rows={draft.rows} total={total} errorsByRow={errorsByRow} review={review} canExport={canExport} onBack={() => { setPreview(false); setReviewMode(true); }} onDetail={showDetail} onExport={exportExcel} reviewed={workflow.reviewed} onReview={() => { if (canExport) setDraft(previous => ({ ...previous, review: { signature: transferSignature(previous.rows), reviewedAt: new Date().toISOString() } })); }} onFix={fixRow} /> : <div className={`bt-workspace ${reviewMode ? 'bt-review-mode' : ''}`}>
            {!reviewMode && <section className="bt-picker" aria-label="송금 대상 찾기">
                <div className="bt-section-heading"><div><h2>대상 불러오기</h2><p>자료를 선택하고 필요한 대상만 담으세요.</p></div><span className="bt-step">01</span></div>
                <div className="bt-source-tabs" role="tablist" aria-label="송금 자료 종류">{SOURCES.map(value => <button key={value} role="tab" aria-selected={source === value} onClick={() => { setSource(value); setAssignTarget(null); }} className={source === value ? 'is-active' : ''}>{SOURCE_LABELS[value]}</button>)}</div>
                <div className="bt-source-controls"><label>조회월<input type="month" aria-label="조회월" value={draft.period} onChange={event => setDraft({ ...draft, period: event.target.value })} /></label><button aria-label="송금 자료 새로고침" disabled={loading} onClick={() => void loadSource(true)}><RefreshCw size={15} /></button><Link to={SOURCE_LINKS[source]}>원본 화면 ↗</Link></div>
                {source === 'payroll' && /^\d{4}-(0[1-9]|1[0-2])$/.test(draft.period) && <div className="bt-payroll-loader">
                    <Suspense fallback={<p className="bt-source-help">급여 조회를 준비하고 있습니다…</p>}>
                        <PayrollTransferPicker key={`${userId}:${draft.period}:${payrollRefresh}`} transferPicker={payrollPicker} />
                    </Suspense>
                </div>}
                {source === 'account' && <p className="bt-source-help">등록 계좌를 담은 뒤 송금액을 직접 입력하세요.</p>}
                {assignTarget && <div className="bt-assign-notice">‘{draft.rows.find(row => row.rowId === assignTarget)?.name}’의 입금계좌를 선택하세요.<button onClick={() => setAssignTarget(null)}>취소</button></div>}
                <div className="bt-search"><Search size={16} /><input aria-label="송금 대상 검색" placeholder="이름, 팀, 회사, 은행, 계좌번호 검색" value={query} onChange={event => setQuery(event.target.value)} />{query && <button aria-label="검색 지우기" onClick={() => setQuery('')}><X size={14} /></button>}</div>
                <div className="bt-filter-row">
                    {source === 'account' && <select aria-label="계좌 종류" value={category} onChange={event => { setCategory(event.target.value as AccountCategory | 'all'); setGroup('all'); setWorkerTeam('all'); setTeamAffiliation('all'); }}><option value="all">모든 계좌</option>{CATEGORY_OPTIONS.map(value => <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>)}</select>}
                    {workerTeamFilter ? <select aria-label="작업자 소속 팀" value={workerTeam} onChange={event => setWorkerTeam(event.target.value)}><option value="all">모든 소속 팀</option>{workerTeams.map(team => <option key={team.key} value={team.key}>{team.label} ({team.count}명)</option>)}</select>
                        : <select aria-label="팀·회사 필터" value={group} onChange={event => setGroup(event.target.value)}><option value="all">{source === 'account' && category === 'team' ? '모든 소속 회사' : '모든 팀·회사'}</option>{groups.map(value => <option key={value}>{value}</option>)}</select>}
                </div>
                {source === 'account' && category === 'team' && <div className="bt-team-affiliation" role="group" aria-label="팀 소속 구분">{TEAM_AFFILIATIONS.map(option => <button key={option.value} aria-pressed={teamAffiliation === option.value} onClick={() => { setTeamAffiliation(option.value); setGroup('all'); }}>{option.label}</button>)}</div>}
                {(source === 'payroll' || (source === 'account' && (category === 'all' || category === 'worker'))) && <div className="bt-employment-filter"><label><input type="checkbox" checked={hideRetired} onChange={event => setHideRetired(event.target.checked)} /> 퇴사자 숨김</label><span>{hideRetired ? '숨긴 퇴사자' : '조회된 퇴사자'} {retiredCount}명</span><small>대상 찾기에서만 숨깁니다. 이미 담은 송금 건은 유지됩니다.</small></div>}
                {!!warnings.length && <details className="bt-source-warnings" open><summary>불러오기 안내 {warnings.length}건</summary>{warnings.map((warning, index) => <p key={index}>{warning}</p>)}</details>}
                {loadError && <div role="alert" className="bt-error">{loadError}<button onClick={() => void loadSource(true)}>다시 불러오기</button></div>}
                <div className="bt-picker-selection"><label><input type="checkbox" aria-label="검색 결과 전체 선택" disabled={!!assignTarget || loading || !selectable.length} checked={selectable.length > 0 && selectable.every(row => candidateSelection.has(row.id))} onChange={event => setCandidateSelection(new Set(event.target.checked ? selectable.map(row => row.id) : []))} /> 검색 결과 {filtered.length}건</label><button disabled={!candidateSelection.size || !!assignTarget || loading} onClick={() => add(filtered.filter(row => candidateSelection.has(row.id)))}>선택 {candidateSelection.size}건 담기 <ArrowRight size={14} /></button></div>
                <div className="bt-candidate-list" aria-busy={loading}>
                    {loading ? <div className="bt-empty">자료를 불러오고 있습니다…</div> : !filtered.length ? <div className="bt-empty"><Search size={28} /><strong>{loadError ? '자료를 불러오지 못했습니다' : source === 'payroll' && !payrollLoaded ? '급여를 바로 불러오세요' : '조회된 대상이 없습니다'}</strong><span>{source === 'payroll' && !payrollLoaded ? '위에서 팀과 금액 기준을 선택한 뒤 급여 불러오기를 누르세요.' : '조회월이나 검색 조건을 바꿔 보세요.'}</span></div> : filtered.slice(0, visibleLimit).map(candidate => {
                        const added = addedIds.has(candidate.id);
                        return <article key={candidate.id} className={`bt-candidate ${added && !assignTarget ? 'is-added' : ''}`} draggable={!added && !assignTarget} onDragStart={event => { event.dataTransfer.setData(CANDIDATE_DRAG, candidate.id); event.dataTransfer.effectAllowed = 'copy'; }}>
                            <label className="bt-candidate-check"><input type="checkbox" aria-label={`${candidate.name} 선택`} disabled={added || !!assignTarget} checked={candidateSelection.has(candidate.id)} onChange={event => { const next = new Set(candidateSelection); event.target.checked ? next.add(candidate.id) : next.delete(candidate.id); setCandidateSelection(next); }} /></label>
                            <div className="bt-candidate-body"><div className="bt-candidate-title"><strong>{candidate.name}</strong><span>{CATEGORY_LABELS[candidate.category]}</span><WorkerEmploymentBadge status={getWorkerEmployment(candidate, workerEmployment)} />{candidate.source !== 'account' && <b>{money(candidate.amount)}원</b>}</div><p>{candidate.groupName || '소속 미지정'}{candidate.period ? ` · ${candidate.period}` : ''}</p><p className="bt-account-number">{candidate.bankName || '은행 미등록'} · {candidate.accountNumber || '계좌 미등록'}</p><p>예금주 {candidate.accountHolder || '미등록'}</p>{candidate.detail && <small>{candidate.detail}</small>}{candidate.warning && <small className="bt-invalid">{candidate.warning}</small>}</div>
                            <button className="bt-add" aria-label={`${candidate.name} ${assignTarget ? '입금계좌로 선택' : '담기'}`} disabled={added && !assignTarget} onClick={() => choose(candidate)}>{added && !assignTarget ? <Check size={16} /> : <Plus size={16} />}<span>{added && !assignTarget ? '담김' : '담기'}</span></button><GripVertical className="bt-drag-hint" size={14} aria-hidden="true" />
                            <PayrollTransferDetails row={candidate} loadState={payrollRecovery.stateFor(candidate)} onLoadDetail={() => { void payrollRecovery.recover(candidate); }} onQueryPayroll={() => queryPayrollDetail(candidate)} onExpand={() => showDetail(candidate)} />
                            <SupportTransferDetails row={candidate} onExpand={() => showDetail(candidate)} loadState={supportRecovery.stateFor(candidate)} onLoadDetail={() => { void supportRecovery.recover(candidate); }} />
                            <RentTransferDetails row={candidate} onExpand={() => showDetail(candidate)} />
                        </article>;
                    })}
                    {filtered.length > visibleLimit && <button className="bt-more" onClick={() => setVisibleLimit(value => value + 100)}>100건 더 보기 ({visibleLimit}/{filtered.length})</button>}
                </div>
            </section>}
            <section className={`bt-basket ${dragOver ? 'is-drag-over' : ''}`} aria-label="송금 목록" onDragOver={event => { if (event.dataTransfer.types.includes(CANDIDATE_DRAG)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDragOver(true); } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(false); }} onDrop={event => { const id = event.dataTransfer.getData(CANDIDATE_DRAG); if (!id) return; event.preventDefault(); setDragOver(false); const candidate = candidates.find(row => row.id === id); if (candidate) choose(candidate); }}>
                <div className="bt-section-heading"><div><h2>송금 목록 <span className="bt-count">{draft.rows.length}</span></h2><p>상세 내역과 계좌를 확인한 뒤 엑셀로 만드세요.</p></div><span className="bt-step">02</span></div>
                {!!draft.rows.length && <TransferListReview rows={draft.rows} visible={visibleRows} selection={rowSelection} filters={listFilters} onChange={setListFilters} notes={review.notes} />}
                <details className="bt-bulk-settings"><summary>통장 표시·메모 일괄 설정 · 선택 {selectedRows.length}건에 적용</summary><div className="bt-memo-settings"><label>받는분통장표시<input aria-label="받는분통장표시 일괄 설정" value={draft.receiverDisplay} onChange={event => setDraft({ ...draft, receiverDisplay: event.target.value })} /><small>D열에 표시할 문구</small></label><label>내통장메모 규칙<input aria-label="내통장메모 규칙" value={draft.memoRule} onChange={event => setDraft({ ...draft, memoRule: event.target.value })} /><small>{'{이름}'}은 각 대상 이름으로 바뀝니다.</small></label><button onClick={updateMemoForRows} disabled={!selectedRows.length}>선택 {selectedRows.length}건에 적용</button></div></details>
                <div className="bt-list-tools"><label><input type="checkbox" aria-label="송금 목록 전체 선택" disabled={!visibleRows.length} checked={visibleRows.length > 0 && visibleRows.every(row => rowSelection.has(row.rowId))} onChange={event => setRowSelection(previous => { const next = new Set(previous); visibleRows.forEach(row => event.target.checked ? next.add(row.rowId) : next.delete(row.rowId)); return next; })} /> 검색 결과 선택 · 총 {selectedRows.length}건 선택</label><button disabled={!selectedRows.length} onClick={() => { setDraft({ ...draft, rows: draft.rows.filter(row => !rowSelection.has(row.rowId)) }); setRowSelection(new Set()); setAssignTarget(null); }}>선택 제외</button><button disabled={!selectedRows.length} onClick={() => setRowSelection(new Set())}>선택 해제</button><span>선택 중인 숨겨진 항목 {selectedRows.filter(row => !visibleRows.some(visible => visible.rowId === row.rowId)).length}건 · 순서 변경은 전체 목록에서 가능합니다.</span></div>
                <div className="bt-transfer-list">
                    {!draft.rows.length ? <div className="bt-empty bt-drop-empty"><span className="bt-drop-icon"><Plus size={30} /></span><strong>송금할 계좌를 여기에 담으세요</strong><span>왼쪽에서 끌어 놓거나 ‘담기’를 누르세요.<br />급여·월세·지원비는 금액도 함께 가져옵니다.</span></div> : !visibleRows.length ? <div className="bt-empty">조건에 맞는 송금 항목이 없습니다.<button onClick={() => setListFilters(emptyListFilters)}>전체 목록 보기</button></div> : visibleRows.map(row => { const index = draft.rows.indexOf(row); return <article id={`bt-row-${row.rowId}`} tabIndex={-1} className={`bt-transfer-row ${errorsByRow.get(row.rowId)?.length ? 'has-error' : ''}`} key={row.rowId} onDragOver={event => { if (event.dataTransfer.types.includes(ROW_DRAG)) event.preventDefault(); }} onDrop={event => { const from = event.dataTransfer.getData(ROW_DRAG); if (from && visibleRows.length === draft.rows.length) { event.preventDefault(); event.stopPropagation(); reorder(from, row.rowId); } }}>
                        <div className="bt-row-heading"><input type="checkbox" aria-label={`${row.name} 송금 선택`} checked={rowSelection.has(row.rowId)} onChange={event => { const next = new Set(rowSelection); event.target.checked ? next.add(row.rowId) : next.delete(row.rowId); setRowSelection(next); }} /><button className="bt-grip" disabled={visibleRows.length !== draft.rows.length} draggable={visibleRows.length === draft.rows.length} onDragStart={event => { event.dataTransfer.setData(ROW_DRAG, row.rowId); event.dataTransfer.effectAllowed = 'move'; }} aria-label={`${row.name} 순서 이동`} title="끌어서 순서를 바꾸세요"><GripVertical size={15} /></button><span className="bt-source-badge">{SOURCE_LABELS[row.source]}</span><strong>{row.name}</strong><WorkerEmploymentBadge status={getWorkerEmployment(row, workerEmployment)} /><span className="bt-row-group">{row.groupName}{row.period ? ` · ${row.period}` : ''}</span><div className="bt-row-actions"><button aria-label={`${row.name} 위로`} disabled={index === 0 || visibleRows.length !== draft.rows.length} onClick={() => reorder(row.rowId, draft.rows[index - 1].rowId)}><ArrowUp size={14} /></button><button aria-label={`${row.name} 아래로`} disabled={index === draft.rows.length - 1 || visibleRows.length !== draft.rows.length} onClick={() => reorder(row.rowId, draft.rows[index + 1].rowId)}><ArrowDown size={14} /></button><button aria-label={`${row.name} 제외`} onClick={() => { setDraft({ ...draft, rows: draft.rows.filter(item => item.rowId !== row.rowId) }); setRowSelection(previous => { const next = new Set(previous); next.delete(row.rowId); return next; }); if (assignTarget === row.rowId) setAssignTarget(null); }}><X size={14} /></button></div></div>
                        <div className="bt-row-fields"><div className="bt-row-account"><strong>{row.bankName || '은행 미등록'} <span className="bt-number">{row.accountNumber || '계좌 미등록'}</span></strong><small>예금주 {row.accountHolder || '미등록'}</small><button onClick={() => { setAssignTarget(row.rowId); setReviewMode(false); setSource('account'); setQuery(''); setCategory('all'); setGroup('all'); }}>계좌 변경</button></div><label>이체금액<input className="bt-money-input" type="number" min="1" step="1" aria-label={`${row.name} 이체금액`} value={Number.isFinite(row.amount) ? row.amount : ''} onChange={event => editRow(row.rowId, { amount: event.target.value === '' ? 0 : Number(event.target.value) })} /></label><label>받는분통장표시<input aria-label={`${row.name} 받는분통장표시`} value={row.receiverDisplay} onChange={event => editRow(row.rowId, { receiverDisplay: event.target.value })} /></label><label>내통장메모<input aria-label={`${row.name} 내통장메모`} value={row.senderMemo} onChange={event => editRow(row.rowId, { senderMemo: event.target.value })} /></label></div>
                        <details className="bt-inline-account"><summary>이 송금 건의 계좌 직접 수정</summary><p>이 목록에만 적용됩니다. 등록 계좌 원본은 유지됩니다.</p><div className="bt-row-fields"><label>은행<select aria-label={`${row.name} 송금 은행`} value={row.bankCode} onChange={event => editRow(row.rowId, { bankCode: event.target.value, bankName: BANK_CODES[event.target.value] || '' })}><option value="">은행 선택</option>{Object.entries(BANK_CODES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label><label>계좌번호<input aria-label={`${row.name} 송금 계좌번호`} inputMode="numeric" value={row.accountNumber} onChange={event => editRow(row.rowId, { accountNumber: event.target.value })} /></label><label>예금주<input aria-label={`${row.name} 송금 예금주`} value={row.accountHolder} onChange={event => editRow(row.rowId, { accountHolder: event.target.value })} /></label></div></details>
                        {((originalTransferAmount(row) !== undefined && originalTransferAmount(row) !== row.amount) || row.adjustmentReason) && <label className="bt-adjustment-reason">금액 변경 사유<input aria-label={`${row.name} 금액 변경 사유`} maxLength={500} value={row.adjustmentReason ?? ''} placeholder="예: 일부 선지급, 식대 추가 정산" onChange={event => editRow(row.rowId, { adjustmentReason: event.target.value })} /></label>}
                        {row.detail && <p className="bt-row-detail">{row.detail}</p>}{!!review.notes.get(row.rowId)?.length && <ul className="bt-row-notes">{review.notes.get(row.rowId)?.map((note, i) => <li key={i}>{note}</li>)}</ul>}{!!errorsByRow.get(row.rowId)?.length && <p className="bt-invalid">{errorsByRow.get(row.rowId)?.join(' · ')}</p>}
                        <PayrollTransferDetails row={row} loadState={payrollRecovery.stateFor(row)} onLoadDetail={() => { void payrollRecovery.recover(row); }} onQueryPayroll={() => queryPayrollDetail(row)} onExpand={() => showDetail(row)} />
                        <SupportTransferDetails row={row} onExpand={() => showDetail(row)} loadState={supportRecovery.stateFor(row)} onLoadDetail={() => { void supportRecovery.recover(row); }} />
                        <RentTransferDetails row={row} onExpand={() => showDetail(row)} />
                    </article>; })}
                </div>
            </section>
        </div>}
        {preview && savePanel}
        {!preview && !!draft.rows.length && <div className="bt-sticky-progress" aria-label="송금 작업 요약"><span>전체 <strong>{draft.rows.length}건 · {money(total)}원</strong></span><span>선택 <strong>{selectedRows.length}건 · {money(transferTotals(selectedRows))}원</strong></span><button onClick={() => { setReviewMode(true); setListFilters({ ...emptyListFilters, issue: 'error' }); document.querySelector('.bt-basket')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); }}>미해결 오류 {invalidCount}건</button><button className="bt-primary" onClick={() => { if (reviewMode) setPreview(true); else setReviewMode(true); }}>{reviewMode ? '엑셀 확인·생성으로' : '금액·계좌 검토로'} <ArrowRight size={15} /></button></div>}
    </div>;
}
