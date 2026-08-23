import { httpsCallable } from 'firebase/functions';
import { buildConstructionPlanDraft } from '../domain';
import {
  applyConstructionPlanErpSnapshotFieldsServer,
  getConstructionPlanLatestErpSnapshotServer,
  getConstructionPlanErpRefreshErrorMessage,
  resolveConstructionPlanErpRefreshApplyAttempt,
} from './constructionPlanErpRefreshService';

jest.mock('../../../config/firebase', () => ({ functions: { name: 'test-functions' } }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));

const mockedHttpsCallable = httpsCallable as jest.MockedFunction<typeof httpsCallable>;
const capturedAt = '2026-08-22T00:00:00.000Z';

const snapshot = () => ({
  schemaVersion: 1 as const,
  capturedAt,
  site: {
    source: 'site' as const,
    sourceId: 'site-1',
    capturedAt,
    value: { id: 'site-1', name: '현장', address: '서울' },
  },
  contractorCompany: {
    source: 'company' as const,
    sourceId: 'company-1',
    capturedAt,
    value: { id: 'company-1', name: '시공사', phone: '02-0000-0000' },
  },
});

const plan = (appliedFieldIds: string[] = [], auditEventId = 'erp-refresh-audit-1', reason = '현장 마스터 변경 확인') => ({
  ...buildConstructionPlanDraft('plan-1', {
    siteId: 'site-1',
    siteName: '현장',
    tradeType: 'system-shoring',
    createdBy: 'author-1',
  }, capturedAt),
  erpSnapshot: {
    ...snapshot(),
    ...(appliedFieldIds.length > 0 ? {
      fieldProvenance: Object.fromEntries(appliedFieldIds.map((fieldId) => {
        const site = fieldId.startsWith('site.');
        return [fieldId, {
          source: site ? 'site' : 'company',
          sourceId: site ? 'site-1' : 'company-1',
          capturedAt,
          captureKind: 'refresh',
          sourceMasterHash: 'a'.repeat(64),
          appliedBy: 'author-1',
          appliedAt: capturedAt,
          changeReason: reason,
          auditEventId,
        }];
      })),
    } : {}),
  },
  lockVersion: 8,
  updatedAt: capturedAt,
});

const organizationComparison = () => ({
  current: plan().organizationSnapshot,
  latestWorkers: [],
  changes: [],
  assignmentIssues: [],
  suggestedAdditionalWorkers: [],
  additionalWorkersChanged: false,
  changed: false,
});

describe('construction plan ERP refresh service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads a strictly safe latest snapshot using only the plan id', async () => {
    const invoke = jest.fn().mockResolvedValue({
      data: {
        planId: 'plan-1',
        status: 'draft',
        lockVersion: 8,
        current: snapshot(),
        latest: {
          ...snapshot(),
          capturedAt: '2026-08-23T00:00:00.000Z',
          site: { ...snapshot().site, value: { ...snapshot().site.value, address: '서울 강남구' } },
        },
        changedFieldIds: ['site.address'],
        organizationComparison: organizationComparison(),
        capturedAt: '2026-08-23T00:00:00.000Z',
      },
    });
    mockedHttpsCallable.mockReturnValueOnce(invoke as never);

    await expect(getConstructionPlanLatestErpSnapshotServer('plan-1')).resolves.toMatchObject({
      planId: 'plan-1',
      changedFieldIds: ['site.address'],
    });
    expect(mockedHttpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      'getConstructionPlanLatestErpSnapshotServer',
    );
    expect(invoke).toHaveBeenCalledWith({ planId: 'plan-1' });
    expect(invoke.mock.calls[0][0]).not.toHaveProperty('latest');
  });

  it('rejects a latest response that contains excluded private master fields', async () => {
    mockedHttpsCallable.mockReturnValueOnce(jest.fn().mockResolvedValue({
      data: {
        planId: 'plan-1',
        status: 'draft',
        lockVersion: 8,
        latest: {
          ...snapshot(),
          site: {
            ...snapshot().site,
            value: { ...snapshot().site.value, imageUrl: 'https://private.example/site.jpg' },
          },
        },
        changedFieldIds: [],
        capturedAt,
      },
    }) as never);

    await expect(getConstructionPlanLatestErpSnapshotServer('plan-1'))
      .rejects.toThrow('invalid-response:latest');
  });

  it('rejects field provenance whose source kind is not bound to the field slot', async () => {
    mockedHttpsCallable.mockReturnValueOnce(jest.fn().mockResolvedValue({
      data: {
        planId: 'plan-1',
        status: 'draft',
        lockVersion: 8,
        latest: {
          ...snapshot(),
          fieldProvenance: {
            'site.address': {
              source: 'company',
              sourceId: 'site-1',
              capturedAt,
            },
          },
        },
        changedFieldIds: [],
        capturedAt,
      },
    }) as never);

    await expect(getConstructionPlanLatestErpSnapshotServer('plan-1'))
      .rejects.toThrow('invalid-response:latest');
  });

  it('rejects a latest source whose value identity is not bound to its envelope', async () => {
    mockedHttpsCallable.mockReturnValueOnce(jest.fn().mockResolvedValue({
      data: {
        planId: 'plan-1',
        status: 'draft',
        lockVersion: 8,
        latest: {
          ...snapshot(),
          site: {
            ...snapshot().site,
            sourceId: 'site-other',
          },
        },
        changedFieldIds: [],
        capturedAt,
      },
    }) as never);

    await expect(getConstructionPlanLatestErpSnapshotServer('plan-1'))
      .rejects.toThrow('invalid-response:latest');
  });

  it('rejects private worker fields in the latest organization directory', async () => {
    mockedHttpsCallable.mockReturnValueOnce(jest.fn().mockResolvedValue({
      data: {
        planId: 'plan-1', status: 'draft', lockVersion: 8,
        current: snapshot(), latest: snapshot(), changedFieldIds: [],
        organizationComparison: {
          ...organizationComparison(),
          latestWorkers: [{
            id: 'worker-1', name: '김작업', status: 'active',
            contact: '010-0000-0000', payrollAccount: 'private',
          }],
          changes: [{
            id: 'worker.worker-1.new', kind: 'new', workerId: 'worker-1',
            after: { id: 'worker-1', name: '김작업', status: 'active' }, assignmentIds: [],
          }],
          suggestedAdditionalWorkers: [{ id: 'worker-1', name: '김작업', status: 'active' }],
          additionalWorkersChanged: true,
          changed: true,
        },
        capturedAt,
      },
    }) as never);

    await expect(getConstructionPlanLatestErpSnapshotServer('plan-1'))
      .rejects.toThrow('invalid-response:latest');
  });

  it('applies sorted field ids and never submits a client-authored latest payload', async () => {
    const invoke = jest.fn().mockResolvedValue({
      data: {
        planId: 'plan-1',
        plan: plan(['contractorCompany.name', 'site.address']),
        appliedFieldIds: ['contractorCompany.name', 'site.address'],
        remainingFieldIds: ['site.name'],
        appliedOrganizationChangeIds: [],
        remainingOrganizationChangeIds: [],
        auditEventId: 'erp-refresh-audit-1',
        idempotent: false,
      },
    });
    mockedHttpsCallable.mockReturnValueOnce(invoke as never);

    await expect(applyConstructionPlanErpSnapshotFieldsServer({
      planId: 'plan-1',
      expectedLockVersion: 7,
      fieldIds: ['site.address', 'contractorCompany.name'],
      reason: '현장 마스터 변경 확인',
      idempotencyKey: 'erp-refresh-key-1',
    })).resolves.toMatchObject({ auditEventId: 'erp-refresh-audit-1' });

    expect(invoke).toHaveBeenCalledWith({
      planId: 'plan-1',
      expectedLockVersion: 7,
      fieldIds: ['contractorCompany.name', 'site.address'],
      reason: '현장 마스터 변경 확인',
      idempotencyKey: 'erp-refresh-key-1',
    });
    expect(invoke.mock.calls[0][0]).not.toHaveProperty('latest');
    expect(invoke.mock.calls[0][0]).not.toHaveProperty('current');
  });

  it('fails closed when the server claims different applied fields', async () => {
    mockedHttpsCallable.mockReturnValueOnce(jest.fn().mockResolvedValue({
      data: {
        planId: 'plan-1',
        plan: plan(),
        appliedFieldIds: ['site.name'],
        remainingFieldIds: [],
        appliedOrganizationChangeIds: [],
        remainingOrganizationChangeIds: [],
        auditEventId: 'erp-refresh-audit-1',
        idempotent: false,
      },
    }) as never);

    await expect(applyConstructionPlanErpSnapshotFieldsServer({
      planId: 'plan-1',
      expectedLockVersion: 7,
      fieldIds: ['site.address'],
      reason: '현장 마스터 변경 확인',
      idempotencyKey: 'erp-refresh-key-1',
    })).rejects.toThrow('applied-fields');
  });

  it('applies an explicit organization selection without sending a client-authored directory', async () => {
    const reason = '비활성 안전담당자 명시 재배정';
    const auditEventId = 'erp-refresh-audit-org-1';
    const appliedPlan = plan();
    appliedPlan.organizationSnapshot = {
      ...appliedPlan.organizationSnapshot,
      workerDirectoryProvenance: {
        captureKind: 'refresh', sourceSiteId: 'site-1', capturedAt,
        sourceMasterHash: 'b'.repeat(64), sourceWorkerIds: ['worker-new'],
        appliedBy: 'author-1', appliedAt: capturedAt, changeReason: reason, auditEventId,
      },
    };
    const invoke = jest.fn().mockResolvedValue({ data: {
      planId: 'plan-1', plan: appliedPlan,
      appliedFieldIds: [], remainingFieldIds: [],
      appliedOrganizationChangeIds: ['organization.assignment.assignment-safety'],
      remainingOrganizationChangeIds: [], auditEventId, idempotent: false,
    } });
    mockedHttpsCallable.mockReturnValueOnce(invoke as never);

    await expect(applyConstructionPlanErpSnapshotFieldsServer({
      planId: 'plan-1', expectedLockVersion: 7, fieldIds: [], reason,
      idempotencyKey: 'erp-refresh-key-org-1',
      organizationSelection: {
        refreshAssignedWorkers: false,
        refreshAdditionalWorkers: false,
        reassignments: [{ assignmentId: 'assignment-safety', workerId: 'worker-new' }],
      },
    })).resolves.toMatchObject({ auditEventId });

    expect(invoke.mock.calls[0][0]).toEqual({
      planId: 'plan-1', expectedLockVersion: 7, fieldIds: [], reason,
      idempotencyKey: 'erp-refresh-key-org-1',
      organizationSelection: {
        refreshAssignedWorkers: false,
        refreshAdditionalWorkers: false,
        reassignments: [{ assignmentId: 'assignment-safety', workerId: 'worker-new' }],
      },
    });
    expect(invoke.mock.calls[0][0]).not.toHaveProperty('latestWorkers');
  });

  it('reuses the exact version and key only for a response-loss retry of the same intent', () => {
    const first = resolveConstructionPlanErpRefreshApplyAttempt({
      planId: 'plan-1',
      currentLockVersion: 7,
      fieldIds: ['site.address', 'contractorCompany.name'],
      reason: '  ERP 변경 확인 후 선택 반영  ',
    });
    const retry = resolveConstructionPlanErpRefreshApplyAttempt({
      planId: 'plan-1',
      currentLockVersion: 99,
      fieldIds: ['contractorCompany.name', 'site.address'],
      reason: 'ERP 변경 확인 후 선택 반영',
    }, first);

    expect(retry).toBe(first);
    expect(retry.expectedLockVersion).toBe(7);
    expect(retry.fieldIds).toEqual(['contractorCompany.name', 'site.address']);

    const changedIntent = resolveConstructionPlanErpRefreshApplyAttempt({
      planId: 'plan-1',
      currentLockVersion: 99,
      fieldIds: ['site.address'],
      reason: 'ERP 변경 확인 후 선택 반영',
    }, first);
    expect(changedIntent).not.toBe(first);
    expect(changedIntent.expectedLockVersion).toBe(99);
    expect(changedIntent.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it('gives a precise recovery instruction for relational selection and lock failures', () => {
    expect(getConstructionPlanErpRefreshErrorMessage({
      code: 'functions/failed-precondition',
      message: '원천 연결이 바뀐 ERP 항목은 해당 그룹을 전체 선택해야 합니다.',
    })).toContain('전체를 함께 선택');
    expect(getConstructionPlanErpRefreshErrorMessage({
      code: 'functions/failed-precondition',
      message: '유효한 편집 잠금을 먼저 획득하세요.',
    })).toContain('편집 잠금');
  });
});
