import { getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth } from '../config/firebase';
import { getTeamScopedRows, invalidateTeamScopedCache } from './teamScopedReadService';

jest.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'leader' } }, db: {}, functions: {} }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
jest.mock('firebase/firestore', () => ({ getDoc: jest.fn(), doc: jest.fn(), Timestamp: { fromMillis: jest.fn(value => ({ millis: value })) } }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
const call = jest.fn();
beforeEach(() => {
    (auth as any).currentUser = { uid: 'leader' };
    (getDoc as jest.Mock).mockResolvedValue({ data: () => ({ role: 'user', position: '팀장', status: 'active' }) });
    (httpsCallable as jest.Mock).mockReturnValue(call);
    call.mockImplementation(async ({ requests }) => ({ data: { results: requests.map(() => ({ rows: [{ id: 'own-worker' }] })) } }));
});
it('팀장 조회는 전체 Firestore 조회 대신 서버 범위 조회를 사용한다', async () => {
    expect(await getTeamScopedRows('workers')).toEqual([{ id: 'own-worker' }]);
    expect(httpsCallable).toHaveBeenCalledWith({}, 'getTeamScopedData');
    expect(call).toHaveBeenCalledWith(expect.objectContaining({ requests: [{ collection: 'workers', filters: {} }] }));
});
it('관리자 조회 경로는 유지한다', async () => {
    (getDoc as jest.Mock).mockResolvedValue({ data: () => ({ role: 'admin', position: '팀장' }) });
    expect(await getTeamScopedRows('workers')).toBeNull();
    expect(call).not.toHaveBeenCalled();
});
it('가불과 신청 내역도 팀 전용 서버로 조회한다', async () => {
    await Promise.all(['advance_payments', 'advance_requests'].map(collection => getTeamScopedRows(collection)));
    expect(call).toHaveBeenCalledWith(expect.objectContaining({ requests: [
        { collection: 'advance_payments', filters: {} }, { collection: 'advance_requests', filters: {} },
    ] }));
});
it('팀 전용 서버 오류를 전체 조회나 빈 정상 결과로 바꾸지 않는다', async () => {
    call.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'functions/permission-denied' }));
    await expect(getTeamScopedRows('workers')).rejects.toThrow('denied');
});
it('요청 중 로그인 계정이 바뀌면 이전 계정 데이터는 버린다', async () => {
    call.mockImplementationOnce(async () => {
        (auth as any).currentUser = { uid: 'other' };
        return { data: { rows: [{ id: 'old-worker' }] } };
    });
    await expect(getTeamScopedRows('workers')).rejects.toThrow('로그인 계정이 변경');
});
it('월 조회 조건을 서버에 전달한다', async () => {
    await getTeamScopedRows('cardTransactions', { yearMonth: '2026-09' });
    expect(call).toHaveBeenCalledWith(expect.objectContaining({ requests: [{ collection: 'cardTransactions', filters: { yearMonth: '2026-09' } }] }));
});

it('동일 계정의 중복 조회를 합치고 완료 후에는 새로 조회한다', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => getTeamScopedRows('workers')));
    expect(call).toHaveBeenCalledTimes(1);
    expect(results.every(rows => rows?.[0].id === 'own-worker')).toBe(true);
    results[0]![0].id = 'changed';
    expect(results[1]![0].id).toBe('own-worker');
    await getTeamScopedRows('workers');
    expect(call).toHaveBeenCalledTimes(2);
    expect(getDoc).toHaveBeenCalledTimes(1);
});

it('팀장 경로만 10초간 재사용하고 만료 후 직책을 다시 확인한다', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(10_000_000);
    try {
        await getTeamScopedRows('workers');
        await getTeamScopedRows('teams');
        expect(getDoc).toHaveBeenCalledTimes(1);
        now.mockReturnValue(10_010_001);
        (getDoc as jest.Mock).mockResolvedValue({ data: () => ({ role: 'admin' }) });
        expect(await getTeamScopedRows('workers')).toBeNull();
        expect(getDoc).toHaveBeenCalledTimes(2);
        expect(call).toHaveBeenCalledTimes(2);
    } finally { now.mockRestore(); }
});

it('조회 권한이 거부되면 직책을 다시 확인하며 데이터를 캐시하지 않는다', async () => {
    await getTeamScopedRows('workers');
    call.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'functions/permission-denied' }));
    await expect(getTeamScopedRows('workers')).rejects.toThrow('denied');
    (getDoc as jest.Mock).mockResolvedValue({ data: () => ({ role: 'admin' }) });
    expect(await getTeamScopedRows('workers')).toBeNull();
    expect(getDoc).toHaveBeenCalledTimes(2);
});

it('관리자 판정은 저장하지 않으며 새로고침은 팀장 경로도 다시 확인한다', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce({ data: () => ({ role: 'admin' }) });
    expect(await getTeamScopedRows('workers')).toBeNull();
    await getTeamScopedRows('workers');
    invalidateTeamScopedCache();
    await getTeamScopedRows('workers');
    expect(getDoc).toHaveBeenCalledTimes(3);
});

it('여러 메뉴가 한꺼번에 조회해도 실행 중인 서버 요청은 최대 2개다', async () => {
    let active = 0;
    let peak = 0;
    call.mockImplementation(async ({ requests }) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise(resolve => setTimeout(resolve, 1));
        active -= 1;
        return { data: { results: requests.map(() => ({ rows: [] })) } };
    });
    await Promise.all(Array.from({ length: 45 }, (_, index) => getTeamScopedRows('cardBillings', { yearMonth: `2026-${index}` })));
    expect(call).toHaveBeenCalledTimes(3);
    expect(peak).toBe(2);
});

it.each(['functions/resource-exhausted', 'functions/unavailable', 'functions/internal'])(
    '일시적인 %s 오류는 재시도해 데이터를 복구한다', async code => {
        call.mockRejectedValueOnce(Object.assign(new Error('temporary'), { code }));
        expect(await getTeamScopedRows('workers')).toEqual([{ id: 'own-worker' }]);
        expect(call).toHaveBeenCalledTimes(2);
    }
);

it('권한 오류는 재시도하지 않는다', async () => {
    call.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'functions/permission-denied' }));
    await expect(getTeamScopedRows('workers')).rejects.toThrow('denied');
    expect(call).toHaveBeenCalledTimes(1);
});

it('계정 전환 시 대기 중인 이전 계정 요청을 서버로 보내지 않는다', async () => {
    const releases: Array<() => void> = [];
    call.mockImplementation(({ requests }) => new Promise(resolve => releases.push(() => resolve({ data: { results: requests.map(() => ({ rows: [] })) } }))));
    const requests = Array.from({ length: 45 }, (_, i) => getTeamScopedRows('cardBillings', { yearMonth: `2026-${i}` }));
    const settled = Promise.allSettled(requests);
    while (releases.length < 2) await new Promise(resolve => setTimeout(resolve, 0));
    (auth as any).currentUser = { uid: 'different-user' };
    releases.forEach(release => release());
    expect((await settled).every(result => result.status === 'rejected')).toBe(true);
    expect(call).toHaveBeenCalledTimes(2);
});

it('한 화면의 서로 다른 데이터 요청은 한 번에 전송한다', async () => {
    await Promise.all(['workers', 'teams', 'sites', 'companies'].map(collection => getTeamScopedRows(collection)));
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0][0].requests).toHaveLength(4);
});
it('묶음 안의 권한 오류는 해당 조회에만 전달한다', async () => {
    call.mockResolvedValueOnce({ data: { results: [
        { rows: [{ id: 'own-worker' }] },
        { error: { code: 'permission-denied', message: 'denied' } },
    ] } });
    const results = await Promise.allSettled([getTeamScopedRows('workers'), getTeamScopedRows('cards')]);
    expect(results[0]).toEqual({ status: 'fulfilled', value: [{ id: 'own-worker' }] });
    expect(results[1].status).toBe('rejected');
    expect(call).toHaveBeenCalledTimes(1);
});

it('수정 또는 새로고침 후 카탈로그 캐시를 우회한다', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    try {
        invalidateTeamScopedCache();
        await getTeamScopedRows('companies');
        expect(call).toHaveBeenCalledWith(expect.objectContaining({ requests: [{ collection: 'companies', filters: { bypassCache: true } }] }));
    } finally { now.mockRestore(); }
});

it('구버전 서버에도 첫 조회를 유효하게 보내고 나머지는 팀 전용 단건 조회로 처리한다', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    call.mockImplementation(async ({ collection }) => ({ data: { rows: [{ id: collection }] } }));
    try {
        const rows = await Promise.all(['workers', 'teams', 'sites'].map(collection => getTeamScopedRows(collection)));
        expect(rows).toEqual([[{ id: 'workers' }], [{ id: 'teams' }], [{ id: 'sites' }]]);
        expect(call).toHaveBeenCalledTimes(3);
        expect(call.mock.calls[0][0]).toEqual({ collection: 'workers', filters: {}, requests: [
            { collection: 'workers', filters: {} }, { collection: 'teams', filters: {} }, { collection: 'sites', filters: {} },
        ] });
        await getTeamScopedRows('workers');
        expect(call.mock.calls[3][0]).toEqual({ collection: 'workers', filters: {} });
    } finally { now.mockRestore(); }
});

it('구버전 서버의 숙소 청구 항목도 선택 월의 허용 청구서만 반환한다', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    call.mockImplementation(async ({ collection }) => ({ data: { rows: collection === 'accommodation_billing_line_items'
        ? [{ id: 'sep-item', billingDocumentId: 'sep' }, { id: 'oct-item', billingDocument: { id: 'oct' } }]
        : [{ id: 'sep', yearMonth: '2026-09' }] } }));
    try {
        expect(await getTeamScopedRows('accommodation_billing_line_items', { yearMonth: '2026-09' }))
            .toEqual([{ id: 'sep-item', billingDocumentId: 'sep' }]);
        expect(call.mock.calls[0][0].filters).toEqual({});
        expect(call.mock.calls[0][0].requests[0].filters).toEqual({ yearMonth: '2026-09' });
        expect(call.mock.calls[1][0]).toEqual({ collection: 'accommodation_billing_documents', filters: { yearMonth: '2026-09' } });
    } finally { now.mockRestore(); }
});

it('구버전 서버 호환 경로에서도 권한 오류를 숨기지 않는다', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(2_000_000);
    call.mockResolvedValueOnce({ data: { rows: [] } });
    call.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'functions/permission-denied' }));
    try {
        const results = await Promise.allSettled([getTeamScopedRows('workers'), getTeamScopedRows('cards')]);
        expect(results[0].status).toBe('fulfilled');
        expect(results[1]).toMatchObject({ status: 'rejected', reason: { code: 'functions/permission-denied' } });
        expect(call).toHaveBeenCalledTimes(2);
    } finally { now.mockRestore(); }
});


it('내부 매니저 역할은 팀장이 함께 지정돼도 전체 조회 경로를 유지한다', async () => {
    (getDoc as jest.Mock).mockResolvedValue({ data: () => ({ role: 'manager1', position: '팀장' }) });
    expect(await getTeamScopedRows('teams')).toBeNull();
    expect(call).not.toHaveBeenCalled();
});
it('동적 직책 ID를 실제 팀장 이름으로 해석한다', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce({ data: () => ({ role: 'user', position: 'pos_custom' }) })
        .mockResolvedValueOnce({ data: () => ({ admin: { positionConfig: [{ id: 'custom', name: '팀장' }] } }) });
    expect(await getTeamScopedRows('teams')).toEqual([{ id: 'own-worker' }]);
});
