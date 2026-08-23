import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../config/firebase';
import type { ConstructionPlan } from '../types';
import {
  readVerifiedConstructionPlanServerPdf,
  type ConstructionPlanServerPdfArtifact,
} from './constructionPlanWorkflowApi';
import { createConstructionPlanControlIdempotencyKey } from './constructionPlanLifecycleControlApi';

export const PREPARE_CONSTRUCTION_PLAN_ISSUED_PDF_DOWNLOAD_CALLABLE = 'prepareConstructionPlanIssuedPdfDownloadServer';
export const COMPLETE_CONSTRUCTION_PLAN_ISSUED_PDF_DOWNLOAD_CALLABLE = 'completeConstructionPlanIssuedPdfDownloadServer';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const nonEmpty = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`construction-plan-download-invalid-response:${field}`);
  return value;
};

const positiveInteger = (value: unknown, field: string): number => {
  if (!Number.isInteger(value) || Number(value) < 1) throw new Error(`construction-plan-download-invalid-response:${field}`);
  return Number(value);
};

const parseArtifact = (value: unknown, expectedSha256: string): ConstructionPlanServerPdfArtifact => {
  if (!isRecord(value)) throw new Error('construction-plan-download-invalid-response:artifact');
  const sha256 = nonEmpty(value.sha256, 'artifact.sha256').toLowerCase();
  const storagePath = nonEmpty(value.storagePath, 'artifact.storagePath');
  const storageGeneration = nonEmpty(value.storageGeneration, 'artifact.storageGeneration');
  const fileName = nonEmpty(value.fileName, 'artifact.fileName');
  const pageCount = positiveInteger(value.pageCount, 'artifact.pageCount');
  if (sha256 !== expectedSha256.toLowerCase() || !/^[a-f0-9]{64}$/.test(sha256)
    || !/^\d+$/.test(storageGeneration)
    || !storagePath.startsWith('construction-plans/') || storagePath.includes('?') || storagePath.includes('#')
    || !fileName.toLowerCase().endsWith('.pdf') || pageCount < 42 || pageCount > 200) {
    throw new Error('construction-plan-download-invalid-response:artifact-binding');
  }
  return {
    storagePath,
    storageGeneration,
    sha256,
    sizeBytes: positiveInteger(value.sizeBytes, 'artifact.sizeBytes'),
    pageCount,
    fileName,
  };
};

export const fetchAuditedIssuedConstructionPlanPdf = async (input: {
  planId: string;
  expectedSha256: string;
  idempotencyKey?: string;
}): Promise<{ blob: Blob; fileName: string; receiptId: string; artifact: ConstructionPlanServerPdfArtifact }> => {
  const idempotencyKey = input.idempotencyKey || createConstructionPlanControlIdempotencyKey();
  const prepare = httpsCallable<Record<string, string>, unknown>(functions, PREPARE_CONSTRUCTION_PLAN_ISSUED_PDF_DOWNLOAD_CALLABLE);
  const prepared = (await prepare({
    planId: input.planId,
    expectedSha256: input.expectedSha256,
    idempotencyKey,
  })).data;
  if (!isRecord(prepared)) throw new Error('construction-plan-download-invalid-response:prepare');
  const receiptId = nonEmpty(prepared.receiptId, 'receiptId');
  const artifact = parseArtifact(prepared.artifact, input.expectedSha256);
  const blob = await readVerifiedConstructionPlanServerPdf(artifact);
  const complete = httpsCallable<Record<string, unknown>, unknown>(functions, COMPLETE_CONSTRUCTION_PLAN_ISSUED_PDF_DOWNLOAD_CALLABLE);
  const completed = (await complete({
    receiptId,
    downloadedSha256: artifact.sha256,
    downloadedSizeBytes: blob.size,
  })).data;
  if (!isRecord(completed) || completed.receiptId !== receiptId || completed.completed !== true) {
    throw new Error('construction-plan-download-invalid-response:complete');
  }
  return { blob, fileName: artifact.fileName, receiptId, artifact };
};

export const fetchAuditedIssuedConstructionPlanPdfForPlan = (
  plan: Pick<ConstructionPlan, 'id' | 'issuedExportSha256'>,
) => {
  if (!plan.issuedExportSha256) throw new Error('construction-plan-issued-pdf-sha256-required');
  return fetchAuditedIssuedConstructionPlanPdf({ planId: plan.id, expectedSha256: plan.issuedExportSha256 });
};

