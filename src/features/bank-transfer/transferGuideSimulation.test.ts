import { DEMO_SCRIPTS, demoAtStep, demoCandidates, demoErrors, demoGoals, initialDemo, reduceDemo } from './transferGuideSimulation';

it.each(DEMO_SCRIPTS.map((script, chapter) => [chapter, script.length] as const))('시연 %i의 모든 장면을 재생하면 미션을 완료한다', (chapter, length) => {
    const result = demoAtStep(chapter, length - 1);
    expect(result.error).toBe('');
    expect(demoGoals(chapter, result).every(goal => goal.done)).toBe(true);
});

it('퇴사자 숨김·검색은 이미 담은 내역을 제외하지 않고 같은 대상을 두 번 담지 않는다', () => {
    let state = reduceDemo(initialDemo(0), { type: 'add', id: 'account-b' });
    state = reduceDemo(state, { type: 'add', id: 'account-b' });
    expect(state.error).toContain('중복');
    expect(state.rows).toHaveLength(1);
    state = reduceDemo(state, { type: 'hideRetired', value: true });
    expect(demoCandidates(state).some(row => row.retired)).toBe(false);
    expect(state.rows[0].retired).toBe(true);
    state = reduceDemo(state, { type: 'query', value: '없는 이름' });
    expect(demoCandidates(state)).toHaveLength(0);
    expect(state.rows).toHaveLength(1);
});

it('오류가 있으면 생성하지 않고 수정 후 검토를 해제하며 이전 파일 내용을 유지한다', () => {
    let state = reduceDemo(initialDemo(2), { type: 'export' });
    expect(state.history).toHaveLength(0);
    expect(demoErrors(state).length).toBeGreaterThan(0);
    state = reduceDemo(state, { type: 'editAmount', id: 'payroll-b', value: 90000 });
    state = reduceDemo(state, { type: 'review' });
    state = reduceDemo(state, { type: 'export' });
    expect(state.history).toHaveLength(1);
    state = reduceDemo(state, { type: 'editAmount', id: 'payroll-a', value: 95000 });
    expect(state.reviewed).toBe(false);
    expect(state.history[0].rows[0].amount).toBe(100000);
    expect(reduceDemo(state, { type: 'export' }).history).toHaveLength(1);
});

it('검색에서 가려진 선택은 메모 적용 대상이고 출력은 전체 목록이다', () => {
    let state = reduceDemo(initialDemo(3), { type: 'rowSelect', id: 'payroll-a' });
    state = reduceDemo(state, { type: 'basketQuery', value: '작업자 B' });
    state = reduceDemo(state, { type: 'memoRule', value: '{이름} 10월급여' });
    state = reduceDemo(state, { type: 'applyMemo' });
    expect(state.rows[0].senderMemo).toBe('가상 작업자 A 10월급여');
    expect(state.rows[1].senderMemo).toBe('가상 작업자 B');
    state = reduceDemo(reduceDemo(state, { type: 'review' }), { type: 'export' });
    expect(state.history[0].rows).toHaveLength(2);
});

it('저장·백업은 깊이 분리되어 이후 수정과 불러오기 취소에 영향을 받지 않는다', () => {
    let state = reduceDemo(initialDemo(4), { type: 'save' });
    state = reduceDemo(state, { type: 'editAmount', id: 'payroll-a', value: 80000 });
    state = reduceDemo(state, { type: 'backup' });
    state = reduceDemo(state, { type: 'restore' });
    expect(state.pendingRestore).toBe(true);
    state = reduceDemo(state, { type: 'cancelRestore' });
    expect(state.rows[0].amount).toBe(80000);
    state = reduceDemo(state, { type: 'confirmRestore' });
    expect(state.rows[0].amount).toBe(100000);
    state = reduceDemo(state, { type: 'restoreBackup' });
    expect(state.rows[0].amount).toBe(80000);
    expect(state.saved?.rows[0].amount).toBe(100000);
});

it('잘못 연결한 결과 열은 반영되지 않고 실패 건만 재처리한다', () => {
    let state = reduceDemo(initialDemo(6), { type: 'loadResults' });
    state = reduceDemo(state, { type: 'resultColumn', key: 'bank', value: 'amount' });
    state = reduceDemo(state, { type: 'matchResults' });
    expect(state.matched).toBe(false);
    expect(state.error).toContain('열을 맞춰');
    expect(reduceDemo(state, { type: 'applyResults' }).resultsApplied).toBe(false);
    state = demoAtStep(6, DEMO_SCRIPTS[6].length - 1);
    expect(state.rows.map(row => row.id)).toEqual(['payroll-b']);
    expect(state.history[0].rows).toHaveLength(2);
    expect(state.rows[0].accountNumber).toBe('000000000009');
    expect(state.rows[0].retryContext?.failureReason).toBe('계좌 확인 필요');
});
