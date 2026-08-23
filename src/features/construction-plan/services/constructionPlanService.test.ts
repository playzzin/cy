import { deleteField, getDoc, getDocs, runTransaction } from 'firebase/firestore';
import { auth } from '../../../config/firebase';
import { buildConstructionPlanDraft } from '../domain';
import {
  createConstructionPlanDraftServer,
  getConstructionPlanLineageServer,
  listConstructionPlansServer,
} from './constructionPlanWorkflowApi';
import {
  ConstructionPlanConflictError,
  acquireConstructionPlanLock,
  createConstructionPlan,
  getConstructionPlan,
  getConstructionPlanLineage,
  getConstructionPlanLocalStorageKey,
  heartbeatConstructionPlanLock,
  listConstructionPlans,
  listConstructionPlanWorkflowEvents,
  releaseConstructionPlanLock,
  subscribeConstructionPlans,
  updateConstructionPlan,
} from './constructionPlanService';

jest.mock('../../../config/firebase', () => ({
  db: { name: 'test-db' },
  auth: { currentUser: null },
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  deleteField: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  runTransaction: jest.fn(),
  where: jest.fn(),
}));

jest.mock('./constructionPlanWorkflowApi', () => ({
  createConstructionPlanDraftServer: jest.fn(),
  getConstructionPlanLineageServer: jest.fn(),
  listConstructionPlansServer: jest.fn(),
}));

describe('constructionPlanService local fallback', () => {
  const originalSource = process.env.REACT_APP_CONSTRUCTION_PLAN_DATA_SOURCE;

  beforeEach(() => {
    process.env.REACT_APP_CONSTRUCTION_PLAN_DATA_SOURCE = 'local';
    (auth as unknown as { currentUser: { uid: string } | null }).currentUser = null;
    window.localStorage.setItem(getConstructionPlanLocalStorageKey(), '[]');
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (originalSource === undefined) delete process.env.REACT_APP_CONSTRUCTION_PLAN_DATA_SOURCE;
    else process.env.REACT_APP_CONSTRUCTION_PLAN_DATA_SOURCE = originalSource;
  });

  it('creates, lists, gets and version-checks a local draft through the public API', async () => {
    const created = await createConstructionPlan({
      siteId: 'site-1',
      siteName: '오프라인 현장',
      createdBy: 'author-1',
      authorName: '작성자',
    });

    expect(await getConstructionPlan(created.id)).toEqual(created);
    expect(await listConstructionPlans({ siteId: 'site-1' })).toHaveLength(1);

    const updated = await updateConstructionPlan(created.id, {
      title: '수정된 시공계획서',
      updatedBy: 'author-1',
      expectedLockVersion: 0,
    });
    expect(updated.title).toBe('수정된 시공계획서');
    expect(updated.lockVersion).toBe(1);

    await expect(updateConstructionPlan(created.id, {
      title: '오래된 편집본',
      updatedBy: 'author-1',
      expectedLockVersion: 0,
    })).rejects.toBeInstanceOf(ConstructionPlanConflictError);
  });

  it('merges project scope without replacing ERP-derived visible fields', async () => {
    const created = await createConstructionPlan({
      siteId: 'site-project-scope',
      siteName: '원천 현장명',
      createdBy: 'author-1',
      projectSnapshot: {
        siteName: '원천 현장명',
        address: '서울시 원천로 1',
        clientName: '원천 발주처',
        contractorName: '원천 시공사',
        constructionPeriod: { startDate: '2026-01-01', endDate: '2026-12-31' },
        buildings: ['101동'],
        floors: ['1층'],
        zones: ['A구간'],
        sitePhotos: ['https://storage.invalid/site.jpg?token=private-token'],
      },
    });

    const updated = await updateConstructionPlan(created.id, {
      updatedBy: 'author-1',
      expectedLockVersion: created.lockVersion,
      projectSnapshot: {
        buildings: ['102동'],
        floors: ['3층'],
        zones: ['B구간'],
        emergencyContactsComplete: true,
      },
    });

    expect(updated.projectSnapshot).toEqual(expect.objectContaining({
      siteName: '원천 현장명',
      address: '서울시 원천로 1',
      clientName: '원천 발주처',
      contractorName: '원천 시공사',
      constructionPeriod: { startDate: '2026-01-01', endDate: '2026-12-31' },
      buildings: ['102동'],
      floors: ['3층'],
      zones: ['B구간'],
      emergencyContactsComplete: true,
      sitePhotos: [],
    }));
    expect(JSON.stringify(updated.projectSnapshot)).not.toContain('private-token');

    await expect(updateConstructionPlan(updated.id, {
      updatedBy: 'author-1',
      projectSnapshot: { siteName: '브라우저 위조 현장명' } as never,
    })).rejects.toThrow();
  });

  it('enforces lock ownership across acquire, heartbeat and release', async () => {
    const created = await createConstructionPlan({
      siteId: 'site-lock',
      siteName: '잠금 현장',
      createdBy: 'author-1',
    });
    const acquired = await acquireConstructionPlanLock(created.id, { id: 'author-1', name: '작성자' });
    const rejected = await acquireConstructionPlanLock(created.id, { id: 'author-2', name: '다른 작성자' });

    expect(acquired.acquired).toBe(true);
    expect(acquired.lock?.expiresAtEpochMs).toBeGreaterThan(Date.now());
    expect(rejected).toEqual(expect.objectContaining({ acquired: false, reason: 'held_by_other' }));
    await expect(updateConstructionPlan(created.id, {
      title: '침범 수정',
      updatedBy: 'author-2',
    })).rejects.toBeInstanceOf(ConstructionPlanConflictError);

    const heartbeat = await heartbeatConstructionPlanLock(created.id, 'author-1');
    expect(heartbeat.acquired).toBe(true);
    expect(heartbeat.plan.lockVersion).toBeGreaterThan(acquired.plan.lockVersion);

    await releaseConstructionPlanLock(created.id, 'author-2');
    expect((await getConstructionPlan(created.id))?.editLock?.userId).toBe('author-1');
    await releaseConstructionPlanLock(created.id, 'author-1');
    expect((await getConstructionPlan(created.id))?.editLock).toBeUndefined();
  });

  it('writes only lock control fields for remote acquire, heartbeat and release', async () => {
    delete process.env.REACT_APP_CONSTRUCTION_PLAN_DATA_SOURCE;
    const base = buildConstructionPlanDraft('remote-lock-plan', {
      siteId: 'site-lock-remote',
      siteName: '원격 잠금 현장',
      createdBy: 'author-1',
    }, '2026-08-21T00:00:00.000Z');
    const activeLock = {
      userId: 'author-1',
      userName: '작성자',
      acquiredAt: '2026-08-22T00:00:00.000Z',
      heartbeatAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
      expiresAtEpochMs: Date.now() + 120_000,
    };
    const transactionUpdates = [jest.fn(), jest.fn(), jest.fn()];
    const plans = [base, { ...base, editLock: activeLock, lockVersion: 4 }, { ...base, editLock: activeLock, lockVersion: 5 }];
    const mockedRunTransaction = runTransaction as unknown as jest.Mock;
    plans.forEach((plan, index) => {
      mockedRunTransaction.mockImplementationOnce(async (
        _database: unknown,
        handler: (transaction: unknown) => Promise<unknown>,
      ) => handler({
        get: jest.fn().mockResolvedValue({
          id: plan.id,
          exists: () => true,
          data: () => plan,
        }),
        update: transactionUpdates[index],
      }));
    });
    const deleteSentinel = { methodName: 'deleteField' };
    (deleteField as unknown as jest.Mock).mockReturnValue(deleteSentinel);

    const acquired = await acquireConstructionPlanLock(base.id, { id: 'author-1', name: '작성자' });
    const heartbeat = await heartbeatConstructionPlanLock(base.id, 'author-1');
    await releaseConstructionPlanLock(base.id, 'author-1');

    expect(acquired.acquired).toBe(true);
    expect(heartbeat.acquired).toBe(true);
    expect(transactionUpdates[0]).toHaveBeenCalledTimes(1);
    expect(transactionUpdates[1]).toHaveBeenCalledTimes(1);
    expect(transactionUpdates[2]).toHaveBeenCalledTimes(1);
    expect(Object.keys(transactionUpdates[0].mock.calls[0][1]).sort()).toEqual([
      'editLock', 'lockVersion', 'updatedAt', 'updatedBy',
    ]);
    expect(Object.keys(transactionUpdates[1].mock.calls[0][1]).sort()).toEqual([
      'editLock', 'lockVersion', 'updatedAt', 'updatedBy',
    ]);
    expect(transactionUpdates[2].mock.calls[0][1]).toEqual(expect.objectContaining({
      editLock: deleteSentinel,
      lockVersion: 6,
      updatedBy: 'author-1',
    }));
    expect(Object.keys(transactionUpdates[2].mock.calls[0][1]).sort()).toEqual([
      'editLock', 'lockVersion', 'updatedAt', 'updatedBy',
    ]);
  });

  it('publishes same-window local changes to list subscribers', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeConstructionPlans(listener);

    await createConstructionPlan({
      siteId: 'site-subscribe',
      siteName: '구독 현장',
      createdBy: 'author-1',
    });

    expect(listener).toHaveBeenLastCalledWith([
      expect.objectContaining({ siteId: 'site-subscribe' }),
    ]);
    unsubscribe();
  });

  it('subscribes remotely through the server-scoped list callable and supports teardown', async () => {
    delete process.env.REACT_APP_CONSTRUCTION_PLAN_DATA_SOURCE;
    const plan = buildConstructionPlanDraft('remote-subscription-plan', {
      siteId: 'site-subscription',
      siteName: '구독 현장',
      createdBy: 'author-1',
    }, '2026-08-21T02:30:00.000Z');
    const mockedList = listConstructionPlansServer as jest.MockedFunction<
      typeof listConstructionPlansServer
    >;
    mockedList.mockResolvedValueOnce([plan]);
    const listener = jest.fn();
    const errorListener = jest.fn();

    const unsubscribe = subscribeConstructionPlans(
      listener,
      { siteId: plan.siteId },
      errorListener,
    );
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockedList).toHaveBeenCalledWith({ siteId: plan.siteId });
    expect(listener).toHaveBeenCalledWith([plan]);
    expect(errorListener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('returns a stable singleton lineage for an existing legacy local plan', async () => {
    const created = await createConstructionPlan({
      siteId: 'site-lineage',
      siteName: '계보 현장',
      createdBy: 'author-1',
    });

    const lineage = await getConstructionPlanLineage(created.id);

    expect(lineage.plans).toEqual([expect.objectContaining({ id: created.id, revision: 0 })]);
    expect(lineage.currentIndex).toBe(0);
    expect(lineage.previous).toBeUndefined();
    expect(lineage.next).toBeUndefined();
  });

  it('scopes local fallback data by authenticated uid', async () => {
    const authState = auth as unknown as { currentUser: { uid: string } | null };
    authState.currentUser = { uid: 'user-a' };
    window.localStorage.setItem(getConstructionPlanLocalStorageKey(), '[]');
    await createConstructionPlan({ siteId: 'site-a', createdBy: 'user-a' });

    authState.currentUser = { uid: 'user-b' };
    window.localStorage.setItem(getConstructionPlanLocalStorageKey(), '[]');
    expect(await listConstructionPlans()).toEqual([]);
    await createConstructionPlan({ siteId: 'site-b', createdBy: 'user-b' });

    authState.currentUser = { uid: 'user-a' };
    expect((await listConstructionPlans()).map((plan) => plan.siteId)).toEqual(['site-a']);
  });

  it('surfaces remote-mode failures instead of reporting a local success', async () => {
    delete process.env.REACT_APP_CONSTRUCTION_PLAN_DATA_SOURCE;
    const mockedList = listConstructionPlansServer as jest.MockedFunction<
      typeof listConstructionPlansServer
    >;
    mockedList.mockRejectedValueOnce(new Error('permission-denied'));

    await expect(listConstructionPlans()).rejects.toThrow('permission-denied');
  });

  it('normalizes a legacy remote plan without participants from its createdBy owner', async () => {
    delete process.env.REACT_APP_CONSTRUCTION_PLAN_DATA_SOURCE;
    const plan = buildConstructionPlanDraft('legacy-get-plan', {
      siteId: 'legacy-site',
      siteName: '기존 현장',
      createdBy: 'legacy-creator',
    }, '2026-08-21T00:00:00.000Z');
    const { participants: _participants, ...legacyPlan } = plan;
    const mockedGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
    mockedGetDoc.mockResolvedValueOnce({
      id: plan.id,
      exists: () => true,
      data: () => legacyPlan,
    } as never);

    await expect(getConstructionPlan(plan.id)).resolves.toEqual(expect.objectContaining({
      participants: {
        authorIds: ['legacy-creator'],
        reviewerIds: [],
        approverIds: [],
      },
    }));
  });

  it('normalizes legacy action/createdAt workflow events for the history UI', async () => {
    delete process.env.REACT_APP_CONSTRUCTION_PLAN_DATA_SOURCE;
    const mockedGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
    mockedGetDocs.mockResolvedValueOnce({
      docs: [{
        id: 'event-1',
        data: () => ({
          planId: 'plan-1',
          action: 'approve',
          actorId: 'approver-1',
          fromStatus: 'review_completed',
          toStatus: 'approved_pending_issue',
          approvedSnapshotHash: 'a'.repeat(64),
          createdAt: '2026-08-21T03:00:00.000Z',
        }),
      }],
    } as never);

    await expect(listConstructionPlanWorkflowEvents('plan-1')).resolves.toEqual([{
      id: 'event-1',
      planId: 'plan-1',
      type: 'approve',
      actorId: 'approver-1',
      fromStatus: 'review_completed',
      toStatus: 'approved_pending_issue',
      at: '2026-08-21T03:00:00.000Z',
      metadata: { approvedSnapshotHash: 'a'.repeat(64) },
    }]);
  });

  it('does not silently create an unsynced local mode from navigator offline state', async () => {
    delete process.env.REACT_APP_CONSTRUCTION_PLAN_DATA_SOURCE;
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    const mockedCreate = createConstructionPlanDraftServer as jest.MockedFunction<
      typeof createConstructionPlanDraftServer
    >;
    mockedCreate.mockRejectedValueOnce(new Error('network-unavailable'));

    await expect(createConstructionPlan({
      siteId: 'offline-site',
      createdBy: 'author-1',
    })).rejects.toThrow('network-unavailable');
    process.env.REACT_APP_CONSTRUCTION_PLAN_DATA_SOURCE = 'local';
    expect(await listConstructionPlans()).toEqual([]);
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
  });

  it('forwards only plan scope data and leaves organization/participants to the server', async () => {
    delete process.env.REACT_APP_CONSTRUCTION_PLAN_DATA_SOURCE;
    const mockedCreate = createConstructionPlanDraftServer as jest.MockedFunction<
      typeof createConstructionPlanDraftServer
    >;
    const mockedGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
    const serverPlan = buildConstructionPlanDraft('remote-plan-id', {
      siteId: 'site-create',
      siteName: '생성 현장',
      createdBy: 'server-author',
      projectSnapshot: { buildings: ['101동'], floors: ['3층'], zones: ['A구간'] },
    }, '2026-08-21T01:00:00.000Z');
    mockedCreate.mockResolvedValueOnce({
      planId: serverPlan.id,
      seriesId: 'series-create',
      revisionNo: 0,
      documentNo: serverPlan.documentNo,
      idempotent: false,
    });
    mockedGetDoc.mockResolvedValueOnce({
      id: serverPlan.id,
      exists: () => true,
      data: () => serverPlan,
    } as never);

    const created = await createConstructionPlan({
      siteId: 'site-create',
      siteName: '생성 현장',
      title: '현장 시공계획서',
      documentNo: 'CP-SAFE-001',
      createdBy: 'client-actor-is-not-trusted',
      idempotencyKey: 'create-safe-request-1',
      projectSnapshot: { buildings: ['101동'], floors: ['3층'], zones: ['A구간'] },
      organizationSnapshot: serverPlan.organizationSnapshot,
      participants: { reviewerIds: ['reviewer-1'] },
    });

    expect(created.id).toBe('remote-plan-id');
    expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({
      siteId: 'site-create',
      title: '현장 시공계획서',
      documentNo: 'CP-SAFE-001',
      idempotencyKey: 'create-safe-request-1',
      projectSnapshot: expect.objectContaining({ buildings: ['101동'] }),
    }));
    expect(mockedCreate.mock.calls[0]?.[0]).not.toHaveProperty('createdBy');
    expect(mockedCreate.mock.calls[0]?.[0]).not.toHaveProperty('siteName');
    expect(mockedCreate.mock.calls[0]?.[0]).not.toHaveProperty('organizationSnapshot');
    expect(mockedCreate.mock.calls[0]?.[0]).not.toHaveProperty('participants');
  });

  it('uses server-scoped list and lineage callables in remote mode', async () => {
    delete process.env.REACT_APP_CONSTRUCTION_PLAN_DATA_SOURCE;
    const mockedList = listConstructionPlansServer as jest.MockedFunction<
      typeof listConstructionPlansServer
    >;
    const mockedLineage = getConstructionPlanLineageServer as jest.MockedFunction<
      typeof getConstructionPlanLineageServer
    >;
    const plan = buildConstructionPlanDraft('remote-history-plan', {
      siteId: 'site-history',
      siteName: '계보 현장',
      createdBy: 'author-1',
    }, '2026-08-21T02:00:00.000Z');
    mockedList.mockResolvedValueOnce([plan]);
    mockedLineage.mockResolvedValueOnce({
      series: {
        id: 'legacy-remote-history-plan',
        siteId: plan.siteId,
        documentNo: plan.documentNo,
        documentNoKey: plan.documentNo.replace(/\s+/g, '').toUpperCase(),
        tradeType: 'system-shoring',
        latestRevisionNo: 0,
        latestPlanId: plan.id,
      },
      plans: [plan],
      currentIndex: 0,
    });

    await expect(listConstructionPlans({ siteId: 'site-history', limit: 20 })).resolves.toEqual([plan]);
    await expect(getConstructionPlanLineage(plan.id)).resolves.toEqual(expect.objectContaining({
      currentIndex: 0,
      plans: [expect.objectContaining({ id: plan.id })],
    }));
    expect(mockedList).toHaveBeenCalledWith({ siteId: 'site-history', limit: 20 });
    expect(mockedLineage).toHaveBeenCalledWith({ planId: plan.id });
  });

  it('does not convert a remote edit failure into a local update', async () => {
    const local = await createConstructionPlan({ siteId: 'site-remote-edit', createdBy: 'author-1' });
    delete process.env.REACT_APP_CONSTRUCTION_PLAN_DATA_SOURCE;
    const mockedRunTransaction = runTransaction as jest.MockedFunction<typeof runTransaction>;
    mockedRunTransaction.mockRejectedValueOnce(new Error('remote-edit-failed'));

    await expect(updateConstructionPlan(local.id, {
      title: 'must-not-be-local-only',
      updatedBy: 'author-1',
    })).rejects.toThrow('remote-edit-failed');
    process.env.REACT_APP_CONSTRUCTION_PLAN_DATA_SOURCE = 'local';
    expect((await getConstructionPlan(local.id))?.title).not.toBe('must-not-be-local-only');
  });
});
