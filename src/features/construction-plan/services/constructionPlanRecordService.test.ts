import { httpsCallable } from 'firebase/functions';
import { getBlob, getMetadata, ref } from 'firebase/storage';
import {
  ConstructionPlanRecordSchema,
  createConstructionPlanRecord,
  listConstructionPlanRecords,
} from './constructionPlanRecordService';

jest.mock('../../../config/firebase', () => ({ functions: {}, storage: {} }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('firebase/storage', () => ({ getBlob: jest.fn(), getMetadata: jest.fn(), ref: jest.fn() }));

const mockedCallable = httpsCallable as jest.MockedFunction<typeof httpsCallable>;

export const buildExecutionRecordFixture = () => ({
  schemaVersion: 1 as const,
  id: 'record-a', rootRecordId: 'record-a', recordRevision: 0,
  planId: 'plan-a', siteId: 'site-a', seriesId: 'series-a',
  planBinding: {
    planId: 'plan-a', siteId: 'site-a', seriesId: 'series-a', revision: 2,
    planStatusAtCreation: 'issued' as const, issuedExportId: 'export-a', issuedExportSha256: 'a'.repeat(64),
    tradeType: 'system-shoring' as const, templateId: 'system-shoring-standard', templateVersion: '1.0.0',
    documentNo: 'CP-SH-001', title: '시스템동바리 시공계획서', siteName: '테스트 현장',
  },
  recordType: 'installation_inspection' as const,
  catalogVersion: 'execution-record-catalog-v1', catalogHash: 'b'.repeat(64),
  questions: [{ id: 'installation-base', category: '기초', text: '기초 상태가 적합하다.', required: true as const, allowNotApplicable: false }],
  resourceCandidates: {
    source: 'issued-plan-snapshot' as const,
    workers: [{ workerId: 'worker-erp-a', name: '김작업', role: '설치팀장' }],
    equipment: [{ equipmentId: 'equipment-plan-a', name: '고소작업대', model: 'CY-20' }],
    confirmers: [{ uid: 'reviewer-a', name: '박검토', role: 'reviewer' as const }],
  },
  workDate: '2026-08-22', building: '101동', floor: '3층', zone: 'A구간',
  actualWorkers: [], actualEquipment: [], responses: [{ questionId: 'installation-base' }], photos: [],
  status: 'draft' as const, version: 1, createdBy: 'author-a', createdByName: '작성자',
  createdAt: '2026-08-22T00:00:00.000Z', updatedBy: 'author-a', updatedByName: '작성자', updatedAt: '2026-08-22T00:00:00.000Z',
});

beforeEach(() => {
  jest.clearAllMocks();
  (ref as jest.Mock).mockReturnValue({});
  (getMetadata as jest.Mock).mockReset();
  (getBlob as jest.Mock).mockReset();
});

test('execution record schema rejects unknown fields and broken immutable binding', () => {
  const fixture = buildExecutionRecordFixture();
  expect(ConstructionPlanRecordSchema.safeParse({ ...fixture, clientQuestion: 'forged' }).success).toBe(false);
  expect(ConstructionPlanRecordSchema.safeParse({ ...fixture, siteId: 'other-site' }).success).toBe(false);
  expect(ConstructionPlanRecordSchema.safeParse({ ...fixture, status: 'confirmed' }).success).toBe(false);
  expect(ConstructionPlanRecordSchema.parse(fixture).id).toBe('record-a');
});

test('list validates every server-owned execution record strictly', async () => {
  mockedCallable.mockReturnValue(jest.fn().mockResolvedValue({
    data: { schemaVersion: 1, generatedAt: '2026-08-22T00:01:00.000Z', records: [buildExecutionRecordFixture()] },
  }) as never);
  await expect(listConstructionPlanRecords({ status: 'draft' })).resolves.toHaveLength(1);
  expect(mockedCallable).toHaveBeenCalledWith(expect.anything(), 'listConstructionPlanRecordsServer');
});

test('mutation forwards only exact structured fields and rejects a malformed response', async () => {
  const callable = jest.fn().mockResolvedValue({
    data: { schemaVersion: 1, record: { ...buildExecutionRecordFixture(), unexpected: true }, idempotent: false },
  });
  mockedCallable.mockReturnValue(callable as never);
  await expect(createConstructionPlanRecord({
    planId: 'plan-a', recordType: 'installation_inspection', workDate: '2026-08-22',
    building: '101동', floor: '3층', zone: 'A구간', idempotencyKey: 'cp-record-create-a',
  })).rejects.toThrow(/invalid-response/);
  expect(callable).toHaveBeenCalledWith(expect.objectContaining({ planId: 'plan-a', recordType: 'installation_inspection' }));
});
