import { applyMemoRule, validateTransferRow } from './transferModel';
import type { TransferRow, TransferSource } from './types';

// Deliberately isolated from auth, services, browser storage and file writers.
// All mutations below are immutable, in-memory training state only.
// @guide-sync 실제 기능을 바꾸면 transferGuideContent.ts의 같은 단계, DEMO_SCRIPTS,
// reduceDemo/initialDemo/demoGoals 및 TransferGuideSimulator.tsx를 함께 갱신한다.
// 기능별 원본 파일과 검증 순서는 transferGuideContent.ts 상단에 정리되어 있다.
export type DemoStage = 'pick' | 'review' | 'preview' | 'results';
export type DemoRow = TransferRow & { retired?: boolean };
type Snapshot = { title: string; rows: DemoRow[] };
export type ResultColumn = 'bank' | 'account' | 'amount' | 'status';
export interface DemoState {
    source: TransferSource; stage: DemoStage; query: string; team: string; hideRetired: boolean;
    payrollLoaded: boolean; period: string; amountBasis: string; candidateSelection: string[];
    rows: DemoRow[]; rowSelection: string[]; detailId: string; basketQuery: string;
    title: string; receiver: string; memoRule: string; notice: string; error: string;
    reviewed: boolean; compared: boolean; saved: Snapshot | null; backup: Snapshot | null;
    pendingRestore: boolean; history: Snapshot[]; resultLoaded: boolean;
    columns: Record<ResultColumn, string>; matched: boolean; resultsSelected: boolean;
    resultsApplied: boolean; facts: string[];
}
export type DemoAction =
    | { type: 'source'; value: TransferSource }
    | { type: 'stage'; value: DemoStage }
    | { type: 'query' | 'team' | 'period' | 'amountBasis' | 'basketQuery' | 'title' | 'receiver' | 'memoRule'; value: string }
    | { type: 'hideRetired'; value: boolean }
    | { type: 'candidateSelect' | 'rowSelect' | 'add' | 'remove' | 'detail' | 'correctAccount'; id: string }
    | { type: 'editAmount'; id: string; value: number }
    | { type: 'editReason'; id: string; value: string }
    | { type: 'resultColumn'; key: ResultColumn; value: string }
    | { type: 'loadPayroll' | 'addSelected' | 'applyMemo' | 'compare' | 'save' | 'restore' | 'confirmRestore' | 'cancelRestore' | 'backup' | 'restoreBackup' | 'review' | 'export' | 'loadResults' | 'matchResults' | 'selectResults' | 'applyResults' | 'retry' | 'noop' };

const copyRows = (rows: DemoRow[]) => rows.map(row => ({ ...row }));
const snapshot = (state: DemoState): Snapshot => ({ title: state.title, rows: copyRows(state.rows) });
const toggle = (ids: string[], id: string) => ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id];
const mark = (state: DemoState, fact: string) => Array.from(new Set([...state.facts, fact]));
const fixture = (source: TransferSource, suffix: string, name: string, amount: number, patch: Partial<DemoRow> = {}): DemoRow => ({
    id: `${source}-${suffix}`, rowId: `${source}-${suffix}`, sourceId: `training-${suffix}`, source,
    category: source === 'support' ? 'team' : source === 'rent' ? 'other' : 'worker',
    name, groupName: '연습 A팀', bankCode: '004', bankName: '국민은행',
    accountNumber: suffix === 'a' ? '000000000001' : suffix === 'b' ? '000000000002' : '000000000003',
    accountHolder: name, amount, originalAmount: source === 'account' ? undefined : amount,
    period: source === 'account' ? '' : '2026-10', detail: '설명서 전용 가상 자료',
    receiverDisplay: '연습 회사', senderMemo: name, ...patch,
});
export const demoFixtures = (source: TransferSource, period = '2026-10', amountBasis = 'net'): DemoRow[] => {
    if (source === 'rent') return [fixture('rent', 'house', '연습 숙소 101호', 500000, { groupName: '연습 숙소', period })];
    if (source === 'support') return [fixture('support', 'team', '가상 지원팀', 310000, { groupName: '외부팀', period })];
    const payroll = source === 'payroll';
    return [
        fixture(source, 'a', '가상 작업자 A', payroll ? amountBasis === 'advance' ? 20000 : 100000 : 0, { period: payroll ? period : '' }),
        fixture(source, 'b', '가상 작업자 B', payroll ? amountBasis === 'advance' ? 10000 : 90000 : 0, { retired: true, period: payroll ? period : '' }),
        ...(!payroll ? [fixture(source, 'c', '가상 작업자 C', 0, { groupName: '연습 B팀' })] : []),
    ];
};
export const demoCandidates = (state: DemoState) => {
    if (state.source === 'payroll' && !state.payrollLoaded) return [];
    const q = state.query.replace(/[\s-]/g, '').toLowerCase();
    return demoFixtures(state.source, state.period, state.amountBasis).filter(row =>
        (state.team === 'all' || row.groupName === state.team) && (!state.hideRetired || !row.retired)
        && `${row.name}${row.groupName}${row.bankName}${row.accountNumber}`.replace(/[\s-]/g, '').toLowerCase().includes(q));
};
export const demoErrors = (state: DemoState) => [...state.rows.flatMap(row => validateTransferRow(row)), ...(!Number.isSafeInteger(demoTotal(state.rows)) ? ['총 이체금액을 정확하게 계산할 수 없습니다.'] : [])];
export const demoTotal = (rows: DemoRow[]) => rows.reduce((total, row) => total + row.amount, 0);
export const demoDirty = (state: DemoState) => JSON.stringify(snapshot(state)) !== JSON.stringify(state.saved);

export function initialDemo(chapter: number): DemoState {
    const rows = chapter >= 2 ? demoFixtures('payroll') : [];
    if (chapter === 2) rows[1] = { ...rows[1], amount: 0 };
    const state: DemoState = {
        source: chapter === 1 ? 'payroll' : 'account', stage: chapter === 5 ? 'preview' : chapter === 6 ? 'results' : chapter >= 2 ? 'review' : 'pick',
        query: '', team: 'all', hideRetired: false, payrollLoaded: false, period: '2026-10', amountBasis: 'net',
        candidateSelection: [], rows, rowSelection: [], detailId: '', basketQuery: '',
        title: '10월 1차 급여 · 연습', receiver: '연습 회사', memoRule: '{이름}', notice: '', error: '',
        reviewed: false, compared: false, saved: null, backup: null, pendingRestore: false, history: [],
        resultLoaded: false, columns: { bank: '', account: '', amount: '', status: '' },
        matched: false, resultsSelected: false, resultsApplied: false, facts: [],
    };
    if (chapter === 6) state.history = [snapshot(state)];
    return state;
}

function updateRows(state: DemoState, rows: DemoRow[]): DemoState {
    const changed = JSON.stringify(rows) !== JSON.stringify(state.rows);
    return { ...state, rows, reviewed: changed ? false : state.reviewed, compared: changed ? false : state.compared,
        facts: changed && state.reviewed ? mark(state, 'reviewInvalidated') : state.facts };
}
export function reduceDemo(previous: DemoState, action: DemoAction): DemoState {
    const state = { ...previous, error: '', notice: '' };
    switch (action.type) {
        case 'noop': return state;
        case 'source': return { ...state, source: action.value, query: '', team: 'all', candidateSelection: [], payrollLoaded: false };
        case 'stage': return { ...state, stage: action.value };
        case 'query': case 'team': return { ...state, [action.type]: action.value, candidateSelection: [] };
        case 'period': case 'amountBasis': return { ...state, [action.type]: action.value, payrollLoaded: false, candidateSelection: [] };
        case 'basketQuery': case 'title': case 'receiver': case 'memoRule': return { ...state, [action.type]: action.value };
        case 'hideRetired': return { ...state, hideRetired: action.value, candidateSelection: [], notice: action.value ? '대상 찾기에서만 숨깁니다. 이미 담은 퇴사자는 송금 목록에 남습니다.' : '대상 찾기에 퇴사자를 다시 표시합니다.' };
        case 'candidateSelect': return { ...state, candidateSelection: toggle(state.candidateSelection, action.id) };
        case 'rowSelect': return { ...state, rowSelection: toggle(state.rowSelection, action.id) };
        case 'loadPayroll': return { ...state, payrollLoaded: true, facts: mark(state, 'payrollLoaded'), notice: '급여 2건을 불러왔습니다. 지급 대상과 금액 기준을 확인한 뒤 담으세요.' };
        case 'add': case 'addSelected': {
            const picked = demoCandidates(state).filter(row => action.type === 'add' ? row.id === action.id : state.candidateSelection.includes(row.id));
            const additions = picked.filter(row => !state.rows.some(existing => existing.id === row.id));
            if (!additions.length) return { ...state, error: '새로 담을 대상을 선택하세요. 이미 담긴 항목은 중복 추가하지 않습니다.' };
            return { ...updateRows(state, [...state.rows, ...additions.map(row => ({ ...row, receiverDisplay: state.receiver, senderMemo: applyMemoRule(state.memoRule, row.name) }))]), candidateSelection: [], facts: mark(state, 'added'), notice: `${additions.length}건을 송금 목록에 담았습니다.` };
        }
        case 'remove': return { ...updateRows(state, state.rows.filter(row => row.id !== action.id)), rowSelection: state.rowSelection.filter(id => id !== action.id), notice: '목록에서 제외했습니다. 원본 자료는 유지됩니다.' };
        case 'editAmount': return updateRows(state, state.rows.map(row => row.id === action.id ? { ...row, amount: action.value } : row));
        case 'editReason': return { ...state, rows: state.rows.map(row => row.id === action.id ? { ...row, adjustmentReason: action.value } : row) };
        case 'correctAccount': {
            const next = updateRows(state, state.rows.map(row => row.id === action.id ? { ...row, bankCode: '004', bankName: '국민은행', accountNumber: '000000000009' } : row));
            return { ...next, notice: '연습용 대체 계좌로 변경했습니다. 등록 계좌 원본은 바뀌지 않습니다.', facts: mark(next, 'accountCorrected') };
        }
        case 'detail': return { ...state, detailId: state.detailId === action.id ? '' : action.id, facts: mark(state, `detail:${action.id.split('-')[0]}`) };
        case 'applyMemo': {
            if (!state.rowSelection.length) return { ...state, error: '메모를 적용할 송금 건을 먼저 선택하세요.' };
            const next = updateRows(state, state.rows.map(row => state.rowSelection.includes(row.id) ? { ...row, receiverDisplay: state.receiver, senderMemo: applyMemoRule(state.memoRule, row.name) } : row));
            return { ...next, facts: mark(next, 'memoApplied'), notice: `선택 ${state.rowSelection.length}건에만 통장 표시와 메모를 적용했습니다.` };
        }
        case 'compare': return { ...state, compared: true, notice: '원본과 비교했습니다. 차이만 표시하며 현재 송금액을 자동 변경하지 않습니다.' };
        case 'save': return { ...state, saved: snapshot(state), facts: mark(state, 'saved'), notice: '연습용 목록을 기억했습니다. 실제 브라우저 저장소에는 기록하지 않습니다.' };
        case 'restore': return state.saved ? { ...state, pendingRestore: demoDirty(state), ...(!demoDirty(state) ? { notice: '저장한 목록과 현재 내용이 같습니다.' } : {}) } : { ...state, error: '먼저 목록 저장을 눌러 연습용 저장본을 만드세요.' };
        case 'confirmRestore': return state.saved ? { ...updateRows(state, copyRows(state.saved.rows)), title: state.saved.title, pendingRestore: false, rowSelection: [], facts: mark(state, 'restored'), notice: '저장 당시 금액을 불러왔습니다. 저장하지 않았던 수정은 취소되었습니다.' } : state;
        case 'cancelRestore': return { ...state, pendingRestore: false };
        case 'backup': return { ...state, backup: snapshot(state), facts: mark(state, 'backedUp'), notice: '현재 편집 내용을 연습용 백업으로 보관했습니다. 실제 파일은 내려받지 않습니다.' };
        case 'restoreBackup': return state.backup ? { ...updateRows(state, copyRows(state.backup.rows)), title: state.backup.title, facts: mark(state, 'backupRestored'), notice: '연습용 백업 내용을 화면에 복원했습니다.' } : { ...state, error: '먼저 현재 목록 백업을 실행하세요.' };
        case 'review': return state.rows.length && !demoErrors(state).length ? { ...state, reviewed: true, facts: mark(state, 'reviewed'), notice: '검토 완료. 이제 엑셀 생성 버튼을 사용할 수 있습니다.' } : { ...state, error: '대상을 담고 계좌·금액 오류를 먼저 해결하세요.' };
        case 'export': return !state.rows.length || demoErrors(state).length || !state.reviewed ? { ...state, error: '파일 오류를 해결하고 내용 확인 후 검토 완료를 눌러 주세요.' } : { ...state, history: [snapshot(state), ...state.history], saved: snapshot(state), facts: mark(state, 'exported'), notice: `연습 파일 생성 완료 · 전체 ${state.rows.length}건, ${demoTotal(state.rows).toLocaleString('ko-KR')}원. 실제 파일 다운로드와 은행 이체는 실행되지 않았습니다.` };
        case 'loadResults': return { ...state, resultLoaded: true, columns: { bank: '', account: '', amount: '', status: '' }, matched: false, resultsSelected: false, notice: '예시 은행 결과 2건을 준비했습니다. 열을 지정한 뒤 연결 결과를 확인하세요.' };
        case 'resultColumn': return { ...state, columns: { ...state.columns, [action.key]: action.value }, matched: false, resultsSelected: false };
        case 'matchResults': return ['bank', 'account', 'amount', 'status'].every(key => state.columns[key as ResultColumn] === key) ? { ...state, matched: true, notice: '은행·계좌·금액이 일치하는 2건입니다. 성공·실패를 확인한 뒤 선택하세요.' } : { ...state, error: '은행코드·계좌번호·이체금액·처리결과 열을 맞춰 주세요. 다른 열을 지정하면 결과를 연결할 수 없습니다.' };
        case 'selectResults': return { ...state, resultsSelected: !state.resultsSelected };
        case 'applyResults': return state.matched && state.resultsSelected ? { ...state, resultsApplied: true, facts: mark(state, 'resultsApplied'), notice: '성공 1건·실패 1건을 이력에 기록했습니다. 원본 급여의 지급 상태는 유지됩니다.' } : { ...state, error: '연결 결과를 확인하고 반영할 행을 선택하세요.' };
        case 'retry': return state.resultsApplied ? { ...updateRows(state, copyRows(state.history[0].rows.filter(row => row.id === 'payroll-b')).map(row => ({ ...row, retryContext: { exportFileName: '국민은행_연습.xlsx', failureReason: '계좌 확인 필요' } }))), title: '실패 1건 재처리 · 연습', stage: 'review', rowSelection: [], facts: mark(state, 'retried'), notice: '실패한 가상 작업자 B만 새 목록에 담았습니다. 은행 성공 여부와 실패 사유를 다시 확인하세요.' } : { ...state, error: '은행 결과를 먼저 확인·반영하세요.' };
    }
}

export interface DemoStep { label: string; target: string; action: DemoAction; }
const step = (label: string, target: string, action: DemoAction): DemoStep => ({ label, target, action });
// @guide-sync 배열 순서는 TRANSFER_GUIDE_CHAPTERS와 같다. 장면 추가 시 조작 전 target과
// 조작 후 guideResultTarget이 모두 존재하고 최종 demoGoals가 완료되는지 관련 테스트로 확인한다.
export const DEMO_SCRIPTS: DemoStep[][] = [
    [
        step('왼쪽에서 찾고 오른쪽 목록에 담습니다. 모든 이름과 계좌는 가상 자료입니다.', 'source-account', { type: 'noop' }),
        step('소속 팀을 연습 A팀으로 선택합니다.', 'team', { type: 'team', value: '연습 A팀' }),
        step('이름을 검색하면 필요한 대상만 남습니다.', 'query', { type: 'query', value: '작업자 A' }),
        step('체크한 다음 선택 1건 담기를 누릅니다.', 'candidate-account-a', { type: 'candidateSelect', id: 'account-a' }),
        step('계좌만 담았으므로 금액은 0원입니다. 오른쪽에서 입력합니다.', 'add-selected', { type: 'addSelected' }),
        step('100,000원을 입력하면 금액 오류가 사라집니다.', 'amount-account-a', { type: 'editAmount', id: 'account-a', value: 100000 }),
    ],
    [
        step('조회월·전체 팀·금액 기준을 확인합니다.', 'payroll-load', { type: 'noop' }),
        step('급여 불러오기를 누르면 금액과 함께 조회됩니다.', 'payroll-load', { type: 'loadPayroll' }),
        step('가상 작업자 A의 급여를 담습니다.', 'add-payroll-a', { type: 'add', id: 'payroll-a' }),
        step('급여 상세보기에서 지급액과 공제를 확인합니다.', 'detail-payroll-a', { type: 'detail', id: 'payroll-a' }),
        step('외부지원비 탭으로 전환합니다. 담은 급여는 유지됩니다.', 'source-support', { type: 'source', value: 'support' }),
        step('지원비를 담으면 기존 급여와 한 목록에 모입니다.', 'add-support-team', { type: 'add', id: 'support-team' }),
        step('지원비 상세보기에서 공수·단가·경비를 확인합니다.', 'detail-support-team', { type: 'detail', id: 'support-team' }),
        step('월세 탭에서 숙소 정산 자료를 조회합니다.', 'source-rent', { type: 'source', value: 'rent' }),
        step('월세도 금액과 함께 송금 목록에 담습니다.', 'add-rent-house', { type: 'add', id: 'rent-house' }),
        step('월세 상세에서 지급 근거와 총액을 확인합니다.', 'detail-rent-house', { type: 'detail', id: 'rent-house' }),
    ],
    [
        step('0원인 행은 오류가 표시됩니다. 퇴사자도 이미 담겼다면 목록에 남습니다.', 'amount-payroll-b', { type: 'noop' }),
        step('이번에 지급하지 않을 퇴사자를 목록에서 제외합니다.', 'remove-payroll-b', { type: 'remove', id: 'payroll-b' }),
        step('실제 지급할 금액을 90,000원으로 조정합니다.', 'amount-payroll-a', { type: 'editAmount', id: 'payroll-a', value: 90000 }),
        step('원본과 다른 금액에는 사유를 남깁니다.', 'reason-payroll-a', { type: 'editReason', id: 'payroll-a', value: '10,000원 선지급분 제외' }),
        step('원본과 비교하면 100,000원과 현재 90,000원의 차이를 볼 수 있습니다.', 'compare', { type: 'compare' }),
    ],
    [
        step('일괄 메모는 적용할 행을 먼저 선택합니다.', 'select-payroll-a', { type: 'rowSelect', id: 'payroll-a' }),
        step('받는 사람에게 보일 D열 문구를 입력합니다.', 'receiver', { type: 'receiver', value: '연습 회사 급여' }),
        step('내 통장의 E열에는 이름과 지급 목적을 넣습니다.', 'memo-rule', { type: 'memoRule', value: '{이름} 10월급여' }),
        step('선택한 A만 바뀌고 선택하지 않은 B의 문구는 유지됩니다.', 'apply-memo', { type: 'applyMemo' }),
        step('선택은 1건이어도 엑셀에는 목록 전체 2건이 들어갑니다.', 'stage-preview', { type: 'stage', value: 'preview' }),
    ],
    [
        step('목록 이름을 정하고 저장합니다.', 'save', { type: 'save' }),
        step('저장 뒤 금액을 바꾸면 저장하지 않은 변경이 표시됩니다.', 'amount-payroll-a', { type: 'editAmount', id: 'payroll-a', value: 85000 }),
        step('저장한 목록 불러오기는 현재 수정 내용을 버릴지 확인합니다.', 'restore', { type: 'restore' }),
        step('불러오기를 선택하면 저장 당시 100,000원으로 돌아갑니다.', 'confirm-restore', { type: 'confirmRestore' }),
        step('다른 PC로 이어갈 때는 현재 목록을 백업합니다.', 'backup', { type: 'backup' }),
    ],
    [
        step('미리보기에서 전체 2건과 A~E열을 확인합니다. 검토 전 다운로드는 비활성입니다.', 'review', { type: 'noop' }),
        step('내용 확인 후 검토 완료를 눌러 다운로드를 활성화합니다.', 'review', { type: 'review' }),
        step('연습 파일을 생성합니다. 실제 파일이나 은행 이체는 만들지 않습니다.', 'export', { type: 'export' }),
        step('금액·계좌 검토로 돌아와 수정하는 상황을 재현합니다.', 'stage-review', { type: 'stage', value: 'review' }),
        step('95,000원으로 수정하면 앞서 한 검토가 해제됩니다.', 'amount-payroll-a', { type: 'editAmount', id: 'payroll-a', value: 95000 }),
        step('미리보기의 변경된 총액을 확인하고 다시 검토합니다.', 'stage-preview', { type: 'stage', value: 'preview' }),
        step('새 금액에 대해 검토 완료를 다시 누릅니다.', 'review', { type: 'review' }),
        step('새 파일 이력이 생깁니다. 이전 파일에는 이전 금액이 남습니다.', 'export', { type: 'export' }),
    ],
    [
        step('사용한 파일 이력에서 예시 은행 결과를 불러옵니다.', 'load-results', { type: 'loadResults' }),
        step('은행코드가 있는 열을 지정합니다.', 'column-bank', { type: 'resultColumn', key: 'bank', value: 'bank' }),
        step('계좌번호 열을 지정합니다.', 'column-account', { type: 'resultColumn', key: 'account', value: 'account' }),
        step('이체금액 열을 지정합니다.', 'column-amount', { type: 'resultColumn', key: 'amount', value: 'amount' }),
        step('성공·실패가 적힌 처리결과 열을 지정합니다.', 'column-status', { type: 'resultColumn', key: 'status', value: 'status' }),
        step('연결 결과에서 은행·계좌·금액이 일치하는지 확인합니다.', 'match-results', { type: 'matchResults' }),
        step('연결된 결과를 확인한 뒤 선택합니다.', 'select-results', { type: 'selectResults' }),
        step('성공 1건·실패 1건을 이력에 기록합니다.', 'apply-results', { type: 'applyResults' }),
        step('실패한 B만 새 목록으로 준비합니다. 성공한 A는 포함하지 않습니다.', 'retry', { type: 'retry' }),
        step('실패 사유에 맞게 계좌를 수정하고 은행 결과를 다시 확인하세요.', 'account-payroll-b', { type: 'correctAccount', id: 'payroll-b' }),
    ],
];

export const demoAtStep = (chapter: number, index: number) => DEMO_SCRIPTS[chapter].slice(0, index + 1).reduce((state, item) => reduceDemo(state, item.action), initialDemo(chapter));
export const demoGoals = (chapter: number, state: DemoState): Array<{ label: string; done: boolean }> => {
    const has = (fact: string) => state.facts.includes(fact);
    const goals: Array<Array<[string, boolean]>> = [
        [['팀 또는 이름으로 검색하기', state.team !== 'all' || !!state.query], ['대상을 목록에 담기', has('added')], ['1원 이상 금액 입력하기', state.rows.length > 0 && !demoErrors(state).length]],
        [['급여 불러오고 상세 열기', has('detail:payroll')], ['외부지원비 담고 상세 열기', has('detail:support')], ['월세 담고 상세 열기', has('detail:rent')]],
        [['0원 오류 해결 또는 지급 대상 제외', !demoErrors(state).length], ['변경한 금액에 사유 남기기', state.rows.some(row => !!row.adjustmentReason)], ['원본과 비교하기', state.compared]],
        [['적용할 행 선택하기', state.rowSelection.length > 0], ['이름을 넣은 메모 적용하기', has('memoApplied') && state.rows.some(row => row.senderMemo.includes('10월급여'))], ['미리보기에서 전체 출력 범위 확인', state.stage === 'preview']],
        [['목록 저장하기', has('saved')], ['수정 후 저장본 다시 불러오기', has('restored')], ['현재 목록 백업하기', has('backedUp')]],
        [['검토 후 파일 생성하기', has('exported')], ['수정하면 검토가 풀리는지 확인', has('reviewInvalidated')], ['다시 검토하고 새 파일 생성하기', state.history.length >= 2]],
        [['은행 결과 확인 후 반영하기', has('resultsApplied')], ['실패한 건만 새 목록 만들기', has('retried')], ['실패 사유에 맞게 계좌 변경', has('accountCorrected')]],
    ];
    return goals[chapter].map(([label, done]) => ({ label, done }));
};
