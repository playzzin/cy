import { httpsCallable } from 'firebase/functions';
import { getBlob, getMetadata, ref } from 'firebase/storage';
import { z } from 'zod';
import { functions, storage } from '../../../config/firebase';

export const CONSTRUCTION_PLAN_RECORD_TYPES = [
  'equipment_daily_inspection',
  'material_receiving_inspection',
  'installation_inspection',
  'pre_pour_inspection',
  'pre_dismantling_inspection',
  'daily_safety_log',
  'photo_sheet',
  'final_handover',
] as const;

export const CONSTRUCTION_PLAN_RECORD_TYPE_LABELS: Record<ConstructionPlanRecordType, string> = {
  equipment_daily_inspection: '장비 일일점검',
  material_receiving_inspection: '자재 반입검수',
  installation_inspection: '설치 검측',
  pre_pour_inspection: '타설·사용 전 최종검측',
  pre_dismantling_inspection: '해체 전 점검',
  daily_safety_log: '일일 안전점검일지',
  photo_sheet: '현장 사진대지',
  final_handover: '최종 인수인계',
};

export const LIST_CONSTRUCTION_PLAN_RECORDS_CALLABLE = 'listConstructionPlanRecordsServer';
export const GET_CONSTRUCTION_PLAN_RECORD_CALLABLE = 'getConstructionPlanRecordServer';
export const CREATE_CONSTRUCTION_PLAN_RECORD_CALLABLE = 'createConstructionPlanRecordServer';
export const UPDATE_CONSTRUCTION_PLAN_RECORD_CALLABLE = 'updateConstructionPlanRecordServer';
export const CONFIRM_CONSTRUCTION_PLAN_RECORD_CALLABLE = 'confirmConstructionPlanRecordServer';
export const CREATE_CONSTRUCTION_PLAN_RECORD_CORRECTION_CALLABLE = 'createConstructionPlanRecordCorrectionServer';
export const GENERATE_CONSTRUCTION_PLAN_RECORD_APPENDIX_PDF_CALLABLE = 'generateConstructionPlanRecordAppendixPdfServer';

const IdSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const GenerationSchema = z.string().regex(/^\d+$/);
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
  (value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
  '유효한 날짜가 아닙니다.',
);
const DateTimeSchema = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  '유효한 일시가 아닙니다.',
);
const IdempotencyKeySchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);

export const ConstructionPlanRecordTypeSchema = z.enum(CONSTRUCTION_PLAN_RECORD_TYPES);
export const ConstructionPlanRecordStatusSchema = z.enum(['draft', 'incomplete', 'confirmed']);
export const ConstructionPlanChecklistResultSchema = z.enum(['pass', 'fail', 'not_applicable']);

export const ConstructionPlanRecordQuestionSchema = z.object({
  id: z.string().min(1).max(120),
  category: z.string().min(1).max(120),
  text: z.string().min(1).max(1000),
  required: z.literal(true),
  allowNotApplicable: z.boolean(),
  measuredValueLabel: z.string().min(1).max(200).optional(),
}).strict();

export const ConstructionPlanRecordActionSchema = z.object({
  description: z.string().min(1).max(1000),
  owner: z.string().min(1).max(200),
  due: DateSchema,
  status: z.enum(['open', 'resolved']),
  resolution: z.string().min(1).max(1000).optional(),
}).strict().superRefine((action, context) => {
  if (action.status === 'resolved' && !action.resolution) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['resolution'], message: '완료 조치에는 결과가 필요합니다.' });
  }
});

export const ConstructionPlanRecordResponseSchema = z.object({
  questionId: z.string().min(1).max(120),
  result: ConstructionPlanChecklistResultSchema.optional(),
  note: z.string().min(1).max(1000).optional(),
  measuredValue: z.string().min(1).max(300).optional(),
  action: ConstructionPlanRecordActionSchema.optional(),
}).strict();

export const ConstructionPlanRecordPhotoSchema = z.object({
  id: IdSchema,
  storagePath: z.string().regex(/^construction-plan-records\/[^/]+\/[^/]+\/[^/]+\/photos\/[^/]+\/[a-f0-9]{64}\.(?:jpg|png)$/),
  storageGeneration: GenerationSchema,
  sha256: Sha256Schema,
  sizeBytes: z.number().int().positive().max(12 * 1024 * 1024),
  mimeType: z.enum(['image/jpeg', 'image/png']),
  caption: z.string().min(1).max(500),
  takenAt: DateTimeSchema,
  zone: z.string().min(1).max(200),
  uploadedBy: z.string().min(1).max(200),
  uploadedByName: z.string().min(1).max(200).optional(),
  uploadedAt: DateTimeSchema,
}).strict();

const PlanBindingSchema = z.object({
  planId: IdSchema,
  siteId: z.string().min(1).max(200),
  seriesId: z.string().min(1).max(200),
  revision: z.number().int().nonnegative(),
  planStatusAtCreation: z.enum(['issued', 'superseded']),
  issuedExportId: z.string().min(1).max(200),
  issuedExportSha256: Sha256Schema,
  tradeType: z.enum(['system-shoring', 'system-scaffold']),
  templateId: z.string().min(1).max(200),
  templateVersion: z.string().min(1).max(100),
  documentNo: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  siteName: z.string().min(1).max(300),
}).strict();

const ActualWorkerSchema = z.object({
  workerId: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(120),
  role: z.string().min(1).max(120).optional(),
}).strict();

const ActualEquipmentSchema = z.object({
  equipmentId: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(160),
  model: z.string().min(1).max(160).optional(),
  registrationNo: z.string().min(1).max(120).optional(),
  operatorName: z.string().min(1).max(120).optional(),
}).strict();

const RecordResourceCandidatesSchema = z.object({
  source: z.literal('issued-plan-snapshot'),
  workers: z.array(z.object({
    workerId: z.string().min(1).max(200),
    name: z.string().min(1).max(120),
    role: z.string().min(1).max(120).optional(),
  }).strict()).max(100),
  equipment: z.array(z.object({
    equipmentId: z.string().min(1).max(200),
    name: z.string().min(1).max(160),
    model: z.string().min(1).max(160).optional(),
    registrationNo: z.string().min(1).max(120).optional(),
    operatorWorkerId: z.string().min(1).max(200).optional(),
    operatorName: z.string().min(1).max(120).optional(),
  }).strict()).max(50),
  confirmers: z.array(z.object({
    uid: z.string().min(1).max(200),
    name: z.string().min(1).max(200),
    role: z.enum(['author', 'reviewer', 'approver']),
  }).strict()).max(50),
}).strict();

const CorrectionLineageSchema = z.object({
  supersedesRecordId: IdSchema,
  sourceConfirmationHash: Sha256Schema,
  reason: z.string().min(5).max(500),
  actorId: z.string().min(1).max(200),
  actorName: z.string().min(1).max(200).optional(),
  createdAt: DateTimeSchema,
}).strict();

export const ConstructionPlanRecordSchema = z.object({
  schemaVersion: z.literal(1),
  id: IdSchema,
  rootRecordId: IdSchema,
  recordRevision: z.number().int().nonnegative(),
  supersedesRecordId: IdSchema.optional(),
  correctionReason: z.string().min(5).max(500).optional(),
  supersededConfirmationHash: Sha256Schema.optional(),
  correctionLineage: CorrectionLineageSchema.optional(),
  planId: IdSchema,
  siteId: z.string().min(1).max(200),
  seriesId: z.string().min(1).max(200),
  planBinding: PlanBindingSchema,
  recordType: ConstructionPlanRecordTypeSchema,
  catalogVersion: z.string().min(1).max(100),
  catalogHash: Sha256Schema,
  questions: z.array(ConstructionPlanRecordQuestionSchema).min(1).max(100),
  resourceCandidates: RecordResourceCandidatesSchema,
  workDate: DateSchema,
  building: z.string().min(1).max(120),
  floor: z.string().min(1).max(120),
  zone: z.string().min(1).max(200),
  actualWorkers: z.array(ActualWorkerSchema).max(100),
  actualEquipment: z.array(ActualEquipmentSchema).max(50),
  responses: z.array(ConstructionPlanRecordResponseSchema).max(100),
  photos: z.array(ConstructionPlanRecordPhotoSchema).max(40),
  designatedConfirmerId: z.string().min(1).max(200).optional(),
  designatedConfirmerName: z.string().min(1).max(200).optional(),
  status: ConstructionPlanRecordStatusSchema,
  version: z.number().int().positive(),
  confirmationHash: Sha256Schema.optional(),
  confirmedBy: z.string().min(1).max(200).optional(),
  confirmedByName: z.string().min(1).max(200).optional(),
  confirmedAt: DateTimeSchema.optional(),
  createdBy: z.string().min(1).max(200),
  createdByName: z.string().min(1).max(200).optional(),
  createdAt: DateTimeSchema,
  updatedBy: z.string().min(1).max(200),
  updatedByName: z.string().min(1).max(200).optional(),
  updatedAt: DateTimeSchema,
}).strict().superRefine((record, context) => {
  if (record.planId !== record.planBinding.planId || record.siteId !== record.planBinding.siteId
    || record.seriesId !== record.planBinding.seriesId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['planBinding'], message: '계획서 불변 바인딩이 일치하지 않습니다.' });
  }
  const questionIds = new Set(record.questions.map((question) => question.id));
  const responseIds = new Set<string>();
  record.responses.forEach((response, index) => {
    if (!questionIds.has(response.questionId) || responseIds.has(response.questionId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['responses', index, 'questionId'], message: '서버 문항과 응답이 일치하지 않습니다.' });
    }
    responseIds.add(response.questionId);
  });
  if (record.status === 'confirmed') {
    if (!record.confirmationHash || !record.confirmedBy || !record.confirmedByName || !record.confirmedAt) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmationHash'], message: '확인 완료 기록의 불변 확인 정보가 없습니다.' });
    }
  } else if (record.confirmationHash || record.confirmedBy || record.confirmedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['status'], message: '미확인 기록에 확인 정보가 포함되었습니다.' });
  }
  if (record.recordRevision > 0 && (!record.supersedesRecordId || !record.correctionReason
    || !record.supersededConfirmationHash || !record.correctionLineage
    || record.correctionLineage.supersedesRecordId !== record.supersedesRecordId
    || record.correctionLineage.sourceConfirmationHash !== record.supersededConfirmationHash
    || record.correctionLineage.reason !== record.correctionReason
    || record.correctionLineage.actorId !== record.createdBy
    || record.correctionLineage.createdAt !== record.createdAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['recordRevision'], message: '정정 기록의 계보 정보가 없습니다.' });
  }
});

const MutationResponseSchema = z.object({
  schemaVersion: z.literal(1),
  record: ConstructionPlanRecordSchema,
  idempotent: z.boolean(),
}).strict();

const ListResponseSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: DateTimeSchema,
  records: z.array(ConstructionPlanRecordSchema).max(200),
}).strict();

const GetResponseSchema = z.object({
  schemaVersion: z.literal(1),
  record: ConstructionPlanRecordSchema,
}).strict();

export const ConstructionPlanRecordAppendixExportSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1).max(200),
  kind: z.literal('record_appendix'),
  status: z.literal('ready'),
  immutable: z.literal(true),
  recordId: IdSchema,
  rootRecordId: IdSchema,
  recordRevision: z.number().int().nonnegative(),
  planId: IdSchema,
  siteId: z.string().min(1).max(200),
  issuedExportId: z.string().min(1).max(200),
  issuedExportSha256: Sha256Schema,
  storagePath: z.string().regex(/^construction-plan-records\/[^/]+\/[^/]+\/[^/]+\/appendices\/rev-\d+\/[a-f0-9]{64}\/[a-f0-9]{64}\.pdf$/),
  storageGeneration: GenerationSchema,
  sha256: Sha256Schema,
  sizeBytes: z.number().int().positive(),
  pageCount: z.number().int().positive(),
  fileName: z.string().min(1).max(255),
  rendererVersion: z.string().min(1).max(100),
  rendererBuildHash: Sha256Schema,
  sourceRecordHash: Sha256Schema,
  renderInputHash: Sha256Schema,
  generatedBy: z.string().min(1).max(200),
  generatedByName: z.string().min(1).max(200).optional(),
  generatedAt: DateTimeSchema,
}).strict();

const AppendixResponseSchema = z.object({
  schemaVersion: z.literal(1),
  recordId: IdSchema,
  export: ConstructionPlanRecordAppendixExportSchema,
  idempotent: z.boolean(),
}).strict();

export type ConstructionPlanRecordType = z.infer<typeof ConstructionPlanRecordTypeSchema>;
export type ConstructionPlanRecordStatus = z.infer<typeof ConstructionPlanRecordStatusSchema>;
export type ConstructionPlanRecordQuestion = z.infer<typeof ConstructionPlanRecordQuestionSchema>;
export type ConstructionPlanRecordResponse = z.infer<typeof ConstructionPlanRecordResponseSchema>;
export type ConstructionPlanRecordAction = z.infer<typeof ConstructionPlanRecordActionSchema>;
export type ConstructionPlanRecordPhoto = z.infer<typeof ConstructionPlanRecordPhotoSchema>;
export type ConstructionPlanRecord = z.infer<typeof ConstructionPlanRecordSchema>;
export type ConstructionPlanRecordAppendixExport = z.infer<typeof ConstructionPlanRecordAppendixExportSchema>;

export type ListConstructionPlanRecordsInput = {
  siteId?: string;
  planId?: string;
  recordType?: ConstructionPlanRecordType;
  status?: ConstructionPlanRecordStatus;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

export type CreateConstructionPlanRecordInput = {
  planId: string;
  recordType: ConstructionPlanRecordType;
  workDate: string;
  building: string;
  floor: string;
  zone: string;
  designatedConfirmerId?: string;
  idempotencyKey: string;
};

export type UpdateConstructionPlanRecordInput = {
  recordId: string;
  expectedVersion: number;
  workDate: string;
  building: string;
  floor: string;
  zone: string;
  actualWorkers: Array<{ workerId?: string; name: string; role?: string }>;
  actualEquipment: Array<{ equipmentId?: string; name: string; model?: string; registrationNo?: string; operatorName?: string }>;
  responses: ConstructionPlanRecordResponse[];
  designatedConfirmerId?: string;
  idempotencyKey: string;
};

const call = async <TInput, TOutput>(
  callableName: string,
  input: TInput,
  schema: z.ZodType<TOutput>,
): Promise<TOutput> => {
  const callable = httpsCallable<TInput, unknown>(functions, callableName);
  const response = await callable(input);
  const parsed = schema.safeParse(response.data);
  if (!parsed.success) {
    throw new Error(`construction-plan-record-invalid-response:${callableName}:${parsed.error.issues.map((issue) => issue.path.join('.')).join(',')}`);
  }
  return parsed.data;
};

export const createConstructionPlanRecordIdempotencyKey = (operation: string): string => {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `cp-record-${operation}-${randomId}`.slice(0, 128);
};

export const listConstructionPlanRecords = async (
  input: ListConstructionPlanRecordsInput = {},
): Promise<ConstructionPlanRecord[]> => (await call(
  LIST_CONSTRUCTION_PLAN_RECORDS_CALLABLE,
  input,
  ListResponseSchema,
)).records;

export const getConstructionPlanRecord = async (recordId: string): Promise<ConstructionPlanRecord> => (
  await call(GET_CONSTRUCTION_PLAN_RECORD_CALLABLE, { recordId }, GetResponseSchema)
).record;

export const createConstructionPlanRecord = async (
  input: CreateConstructionPlanRecordInput,
): Promise<ConstructionPlanRecord> => (await call(
  CREATE_CONSTRUCTION_PLAN_RECORD_CALLABLE, input, MutationResponseSchema,
)).record;

export const updateConstructionPlanRecord = async (
  input: UpdateConstructionPlanRecordInput,
): Promise<ConstructionPlanRecord> => (await call(
  UPDATE_CONSTRUCTION_PLAN_RECORD_CALLABLE, input, MutationResponseSchema,
)).record;

export const confirmConstructionPlanRecord = async (
  input: { recordId: string; expectedVersion: number; idempotencyKey: string },
): Promise<ConstructionPlanRecord> => (await call(
  CONFIRM_CONSTRUCTION_PLAN_RECORD_CALLABLE, input, MutationResponseSchema,
)).record;

export const createConstructionPlanRecordCorrection = async (
  input: { sourceRecordId: string; reason: string; idempotencyKey: string },
): Promise<ConstructionPlanRecord> => (await call(
  CREATE_CONSTRUCTION_PLAN_RECORD_CORRECTION_CALLABLE, input, MutationResponseSchema,
)).record;

export const generateConstructionPlanRecordAppendixPdf = async (
  input: { recordId: string; idempotencyKey: string },
): Promise<ConstructionPlanRecordAppendixExport> => (await call(
  GENERATE_CONSTRUCTION_PLAN_RECORD_APPENDIX_PDF_CALLABLE, input, AppendixResponseSchema,
)).export;

const blobSha256 = async (blob: Blob): Promise<string> => {
  const bytes = await blob.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
};

export const downloadConstructionPlanRecordAppendixPdf = async (
  artifact: ConstructionPlanRecordAppendixExport,
): Promise<Blob> => {
  const objectRef = ref(storage, artifact.storagePath);
  const metadata = await getMetadata(objectRef);
  if (metadata.generation !== artifact.storageGeneration
    || metadata.contentType !== 'application/pdf'
    || Number(metadata.size) !== artifact.sizeBytes
    || metadata.customMetadata?.sha256 !== artifact.sha256
    || metadata.customMetadata?.sourceRecordHash !== artifact.sourceRecordHash) {
    throw new Error('construction-plan-record-appendix-storage-binding-mismatch');
  }
  const blob = await getBlob(objectRef);
  if (blob.size !== artifact.sizeBytes || await blobSha256(blob) !== artifact.sha256) {
    throw new Error('construction-plan-record-appendix-bytes-mismatch');
  }
  return blob;
};

export const downloadConstructionPlanRecordPhoto = async (
  record: ConstructionPlanRecord,
  photo: ConstructionPlanRecordPhoto,
): Promise<Blob> => {
  const objectRef = ref(storage, photo.storagePath);
  const metadata = await getMetadata(objectRef);
  if (metadata.generation !== photo.storageGeneration
    || metadata.contentType !== photo.mimeType
    || Number(metadata.size) !== photo.sizeBytes
    || metadata.customMetadata?.recordId !== record.id
    || metadata.customMetadata?.photoId !== photo.id
    || metadata.customMetadata?.sourceSha256 !== photo.sha256) {
    throw new Error('construction-plan-record-photo-storage-binding-mismatch');
  }
  const blob = await getBlob(objectRef);
  if (blob.size !== photo.sizeBytes || await blobSha256(blob) !== photo.sha256) {
    throw new Error('construction-plan-record-photo-bytes-mismatch');
  }
  return blob;
};

export const getConstructionPlanRecordErrorMessage = (error: unknown): string => {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const code = String(record.code || '').toLowerCase();
  const message = error instanceof Error ? error.message : String(record.message || '');
  if (code.includes('unauthenticated')) return '로그인 세션을 확인한 뒤 다시 시도하세요.';
  if (code.includes('permission-denied')) return '이 현장 실행기록에 접근할 권한이 없습니다.';
  if (code.includes('aborted')) return '다른 사용자가 기록을 변경했습니다. 최신 내용을 불러온 뒤 다시 시도하세요.';
  if (code.includes('failed-precondition')) return message.includes('issues')
    ? '확인 필수항목과 부적합 조치를 모두 작성하세요.'
    : '현재 계획서 또는 실행기록 상태에서는 이 작업을 수행할 수 없습니다.';
  if (code.includes('already-exists')) return '동일 요청 키가 다른 작업에 사용되었습니다. 화면을 새로고침하세요.';
  if (code.includes('data-loss') || message.includes('mismatch') || message.includes('invalid-response')) {
    return '서버 불변 바인딩 검증에 실패했습니다. 관리자에게 문의하세요.';
  }
  return '현장 실행기록을 처리하지 못했습니다. 네트워크 상태를 확인하고 다시 시도하세요.';
};
