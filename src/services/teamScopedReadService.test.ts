import { getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth } from '../config/firebase';
import { hostedReadUrl } from '../config/teamScopedReadEndpoint';
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
it('운영 Hosting 도메인에서만 같은 주소의 팀 조회 함수를 사용한다', () => {
    for (const host of ['cyee-9c1e4.web.app', 'cyee-9c1e4.firebaseapp.com']) {
        expect(hostedReadUrl(new URL(`https://${host}/dashboard`), 'getTeamScopedData')).toBe(`https://${host}/api/getTeamScopedData`);
    }
    for (const origin of ['https://cy-erp-staging-9c1e4.web.app', 'http://localhost:3000', 'https://cyee-9c1e4.web.app.example.test']) {
        expect(hostedReadUrl(new URL(origin), 'getTeamScopedData')).toBeUndefined();
    }
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
it('작업자 계정도 전체 목록 조회 대신 서버의 본인 범위 조회를 사용한다', async () => {
    (getDoc as jest.Mock).mockResolvedValue({ data: () => ({ role: 'user', accountType: 'worker', position: '작업자', status: 'active' }) });
    await getTeamScopedRows('workers');
    expect(httpsCallable).toHaveBeenCalledWith({}, 'getTeamScopedData');
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

it('지원 온 팀 조회는 선택 월과 팀을 서버에 전달한다', async () => {
    await getTeamScopedRows('team_settlement_incoming', { yearMonth: '2026-09', teamId: 'own-team' });
    expect(call).toHaveBeenCalledWith(expect.objectContaining({ requests: [{ collection: 'team_settlement_incoming', filters: { yearMonth: '2026-09', teamId: 'own-team' } }] }));
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

it('이전 페이지의 느린 월간 일보와 겹쳐도 팀·작업자 목록은 먼저 응답한다', async () => {
    let finishReport!: (value: unknown) => void;
    const reportResponse = new Promise(resolve => { finishReport = resolve; });
    call.mockImplementation(({ requests }: { requests: Array<{ collection: string }> }) =>
        requests.some(request => request.collection === 'daily_reports') ? reportResponse
            : Promise.resolve({ data: { results: requests.map(request => ({ rows: [{ id: request.collection }] })) } }));
    let reportFinished = false;
    const reportRead = getTeamScopedRows('daily_reports', { startDate: '2026-10-01', endDate: '2026-10-31' })
        .then(rows => { reportFinished = true; return rows; });
    expect(await Promise.all([getTeamScopedRows('workers'), getTeamScopedRows('teams')]))
        .toEqual([[{ id: 'workers' }], [{ id: 'teams' }]]);
    expect(reportFinished).toBe(false);
    expect(call).toHaveBeenCalledTimes(2);
    expect(call.mock.calls[0][0].requests.map((request: { collection: string }) => request.collection)).toEqual(['workers', 'teams']);
    finishReport({ data: { results: [{ rows: [{ id: 'month-report' }] }] } });
    expect(await reportRead).toEqual([{ id: 'month-report' }]);
});

it('메뉴 설정을 기다리는 동안에도 선택월 현장일보를 현장 목록과 함께 전송한다', async () => {
    let finishMenu!: (response: unknown) => void;
    const menuResponse = new Promise(resolve => { finishMenu = resolve; });
    let menuStarted!: () => void;
    const menuDispatched = new Promise<void>(resolve => { menuStarted = resolve; });
    const reportFilters = { startDate: '2026-10-01', endDate: '2026-10-31' };
    call.mockImplementation(({ requests }: { requests: Array<{ collection: string }> }) => {
        if (requests[0].collection === 'system_configs') {
            menuStarted();
            return menuResponse;
        }
        return Promise.resolve({ data: { results: requests.map(({ collection }) => ({ rows: [{ id: collection }] })) } });
    });

    const menu = getTeamScopedRows('system_configs', { configId: 'permissions' });
    await menuDispatched;
    const overview = Promise.all([
        ...['sites', 'teams', 'workers'].map(collection => getTeamScopedRows(collection)),
        getTeamScopedRows('site_work_reports', reportFilters, { withSiteDirectory: true }),
    ]);
    const background = getTeamScopedRows('site_work_reports', { startDate: '2026-09-01', endDate: '2026-09-30' });
    try {
        expect(await overview).toEqual(['sites', 'teams', 'workers', 'site_work_reports'].map(id => [{ id }]));
        expect(call.mock.calls[1][0].requests).toEqual([
            ...['sites', 'teams', 'workers'].map(collection => ({ collection, filters: {} })),
            { collection: 'site_work_reports', filters: reportFilters },
        ]);
        await background;
        expect(call.mock.calls[2][0].requests).toHaveLength(1);
    } finally {
        finishMenu({ data: { results: [{ rows: [] }] } });
        await menu;
    }
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

it('현장과 업체의 범위 조회가 끝나기 전에 입고 자재를 반환한다', async () => {
    let finishDirectory!: () => void;
    const directory = new Promise<void>(resolve => { finishDirectory = resolve; });
    call.mockImplementation(async ({ requests }: { requests: Array<{ collection: string }> }) => {
        if (requests.some(request => request.collection === 'sites')) await directory;
        return { data: { results: requests.map(({ collection }) => ({ rows: [{ id: collection }] })) } };
    });
    const sites = getTeamScopedRows('sites');
    const companies = getTeamScopedRows('companies');
    try {
        expect(await getTeamScopedRows('materials')).toEqual([{ id: 'materials' }]);
        expect(call.mock.calls.map(([data]) => data.requests.map((r: { collection: string }) => r.collection)))
            .toEqual([['materials'], ['sites', 'companies']]);
    } finally { finishDirectory(); }
    expect(await Promise.all([sites, companies])).toEqual([[{ id: 'sites' }], [{ id: 'companies' }]]);
});

it('계정 확인은 권한을 다시 읽고 직전 카탈로그 변경의 갱신 요청을 보존한다', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
    try {
        await getTeamScopedRows('materials');
        invalidateTeamScopedCache({ catalogChanged: false });
        await getTeamScopedRows('materials');
        expect(getDoc).toHaveBeenCalledTimes(2);
        expect(call).toHaveBeenLastCalledWith(expect.objectContaining({ requests: [{ collection: 'materials', filters: {} }] }));
        invalidateTeamScopedCache();
        invalidateTeamScopedCache({ catalogChanged: false });
        await getTeamScopedRows('materials');
        expect(call).toHaveBeenLastCalledWith(expect.objectContaining({ requests: [{ collection: 'materials', filters: { bypassCache: true } }] }));
    } finally {
        now.mockRestore();
        invalidateTeamScopedCache();
    }
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
