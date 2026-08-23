import { httpsCallable } from 'firebase/functions';
import {
  INITIALIZE_CONSTRUCTION_PLAN_TEMPLATE_CALLABLE,
  LIST_CONSTRUCTION_PLAN_TEMPLATES_CALLABLE,
  TRANSITION_CONSTRUCTION_PLAN_TEMPLATE_CALLABLE,
  getConstructionPlanTemplateUpgradeProposal,
  initializeConstructionPlanTemplateServer,
  listConstructionPlanTemplatesServer,
  loadConstructionPlanCreationTemplateCatalog,
  transitionConstructionPlanTemplateLifecycleServer,
  type ConstructionPlanTemplateListItem,
} from './constructionPlanTemplateService';

jest.mock('../../../config/firebase', () => ({ functions: { name: 'test-functions' } }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));

const template = (
  overrides: Partial<ConstructionPlanTemplateListItem> = {},
): ConstructionPlanTemplateListItem => ({
  schemaVersion: 1,
  id: `tpl_${'a'.repeat(40)}`,
  key: 'system-shoring:system-shoring-standard@1.0.0',
  name: '시스템동바리 시공계획서 표준',
  tradeType: 'system-shoring',
  templateId: 'system-shoring-standard',
  templateVersion: '1.0.0',
  rendererVersion: 'field-use-a4-v3',
  pageCount: 42,
  manifestHash: 'b'.repeat(64),
  templateBundleHash: 'c'.repeat(64),
  initialized: true,
  lifecycle: 'published',
  lifecycleVersion: 3,
  isLatest: true,
  selectableForNewPlan: true,
  createdAt: '2026-08-22T00:00:00.000Z',
  createdBy: 'admin-1',
  updatedAt: '2026-08-22T01:00:00.000Z',
  updatedBy: 'admin-1',
  publishedAt: '2026-08-22T01:00:00.000Z',
  publishedBy: 'admin-1',
  lastTransitionReason: '현장 적용을 위한 표준 게시',
  ...overrides,
});

describe('constructionPlanTemplateService', () => {
  const mockedHttpsCallable = httpsCallable as jest.MockedFunction<typeof httpsCallable>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('strictly parses the server lifecycle catalog', async () => {
    const invoke = jest.fn().mockResolvedValue({
      data: {
        schemaVersion: 1,
        generatedAt: '2026-08-22T02:00:00.000Z',
        canManage: true,
        templates: [template()],
      },
    });
    mockedHttpsCallable.mockReturnValue(invoke as never);

    const response = await listConstructionPlanTemplatesServer();

    expect(mockedHttpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      LIST_CONSTRUCTION_PLAN_TEMPLATES_CALLABLE,
    );
    expect(invoke).toHaveBeenCalledWith({});
    expect(response.templates[0].selectableForNewPlan).toBe(true);
  });

  it('rejects unknown response fields instead of silently trusting server drift', async () => {
    mockedHttpsCallable.mockReturnValue(jest.fn().mockResolvedValue({
      data: {
        schemaVersion: 1,
        generatedAt: '2026-08-22T02:00:00.000Z',
        canManage: true,
        templates: [{ ...template(), arbitraryManifest: {} }],
      },
    }) as never);

    await expect(listConstructionPlanTemplatesServer())
      .rejects.toThrow('construction-plan-template-invalid-response:list');
  });

  it('rejects cross-field identity drift and an ambiguous latest publication', async () => {
    mockedHttpsCallable.mockReturnValue(jest.fn().mockResolvedValue({
      data: {
        schemaVersion: 1,
        generatedAt: '2026-08-22T02:00:00.000Z',
        canManage: true,
        templates: [
          template(),
          template({
            id: `tpl_${'d'.repeat(40)}`,
            key: 'system-shoring:system-shoring-standard@1.1.0',
            templateVersion: '1.0.0',
          }),
        ],
      },
    }) as never);

    await expect(listConstructionPlanTemplatesServer())
      .rejects.toThrow('construction-plan-template-invalid-response:list');
  });

  it('uses only published server records and does not fall back for an empty catalog', async () => {
    mockedHttpsCallable.mockReturnValue(jest.fn().mockResolvedValue({
      data: {
        schemaVersion: 1,
        generatedAt: '2026-08-22T02:00:00.000Z',
        canManage: true,
        templates: [template({
          initialized: false,
          lifecycle: 'uninitialized',
          lifecycleVersion: 0,
          isLatest: false,
          selectableForNewPlan: false,
          createdAt: undefined,
          createdBy: undefined,
          updatedAt: undefined,
          updatedBy: undefined,
          publishedAt: undefined,
          publishedBy: undefined,
          lastTransitionReason: undefined,
        })],
      },
    }) as never);

    const catalog = await loadConstructionPlanCreationTemplateCatalog();

    expect(catalog.source).toBe('server');
    expect(catalog.templates).toEqual([]);
  });

  it('fails closed when the authoritative lifecycle catalog is unavailable', async () => {
    mockedHttpsCallable.mockReturnValue(jest.fn().mockRejectedValue({
      code: 'functions/unavailable',
      message: 'offline',
    }) as never);

    await expect(loadConstructionPlanCreationTemplateCatalog()).rejects.toEqual(
      expect.objectContaining({ code: 'functions/unavailable' }),
    );
  });

  it('explains a missing or failing deployed template callable', async () => {
    const { getConstructionPlanTemplateErrorMessage } = await import('./constructionPlanTemplateService');

    expect(getConstructionPlanTemplateErrorMessage({ code: 'functions/internal' }))
      .toContain('최신 시공계획서 함수 배포');
    expect(getConstructionPlanTemplateErrorMessage({ code: 'functions/not-found' }))
      .toContain('서버 로그 확인');
  });

  it('sends no client manifest during initialize and transition mutations', async () => {
    const invoke = jest.fn()
      .mockResolvedValueOnce({ data: {
        schemaVersion: 1,
        template: template({
          lifecycle: 'draft', lifecycleVersion: 1, isLatest: false,
          selectableForNewPlan: false, publishedAt: undefined, publishedBy: undefined,
        }),
        affectedTemplateKeys: ['system-shoring:system-shoring-standard@1.0.0'],
        idempotent: false,
      } })
      .mockResolvedValueOnce({ data: {
        schemaVersion: 1,
        template: template({
          lifecycle: 'in_review', lifecycleVersion: 2, isLatest: false,
          selectableForNewPlan: false, publishedAt: undefined, publishedBy: undefined,
        }),
        affectedTemplateKeys: ['system-shoring:system-shoring-standard@1.0.0'],
        idempotent: false,
      } });
    mockedHttpsCallable.mockReturnValue(invoke as never);

    await initializeConstructionPlanTemplateServer({
      tradeType: 'system-shoring',
      templateId: 'system-shoring-standard',
      templateVersion: '1.0.0',
      reason: '최초 표준 계약 등록',
      idempotencyKey: 'initialize-1',
    });
    await transitionConstructionPlanTemplateLifecycleServer({
      tradeType: 'system-shoring',
      templateId: 'system-shoring-standard',
      templateVersion: '1.0.0',
      toLifecycle: 'in_review',
      expectedLifecycleVersion: 1,
      reason: '표준 문구 검토 요청',
      idempotencyKey: 'transition-1',
    });

    expect(mockedHttpsCallable.mock.calls.map((call) => call[1])).toEqual([
      INITIALIZE_CONSTRUCTION_PLAN_TEMPLATE_CALLABLE,
      TRANSITION_CONSTRUCTION_PLAN_TEMPLATE_CALLABLE,
    ]);
    expect(invoke.mock.calls[0][0]).not.toHaveProperty('manifest');
    expect(invoke.mock.calls[1][0]).not.toHaveProperty('manifest');
  });

  it('reports the current registered 1.0.0 publication as an explicit upgrade empty state', () => {
    const proposal = getConstructionPlanTemplateUpgradeProposal({
      tradeType: 'system-shoring',
      templateId: 'system-shoring-standard',
      templateVersion: '1.0.0',
      templates: [template()],
    });

    expect(proposal.available).toBe(false);
    expect(proposal.mode).toBe('new-revision-only');
    expect(proposal.latest).toBeUndefined();
    expect(proposal.currentKey).toBe('system-shoring:system-shoring-standard@1.0.0');
  });
});
