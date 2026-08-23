import type {
  ConstructionPlan,
  ConstructionPlanSnapshotPointer,
  ConstructionPlanSnapshotRendererContent,
} from '../types';
import {
  downloadVerifiedConstructionPlanSnapshotContent,
  getConstructionPlanSnapshotPointer,
  materializeConstructionPlanSnapshot,
} from './constructionPlanReviewService';

type ApprovedPdfSourceDependencies = {
  getPointer: (plan: ConstructionPlan, source: 'approved') => ConstructionPlanSnapshotPointer;
  downloadVerifiedContent: (pointer: ConstructionPlanSnapshotPointer) => Promise<ConstructionPlanSnapshotRendererContent>;
  materialize: (current: ConstructionPlan, content: ConstructionPlanSnapshotRendererContent) => ConstructionPlan;
};

const defaultDependencies: ApprovedPdfSourceDependencies = {
  getPointer: getConstructionPlanSnapshotPointer,
  downloadVerifiedContent: downloadVerifiedConstructionPlanSnapshotContent,
  materialize: materializeConstructionPlanSnapshot,
};

/**
 * Fail-closed release boundary: an issued-candidate may only render from the
 * content-addressed approved snapshot after Storage SHA-256 and schema checks.
 */
export const loadApprovedConstructionPlanPdfSource = async (
  currentPlan: ConstructionPlan,
  dependencies: ApprovedPdfSourceDependencies = defaultDependencies,
): Promise<{ plan: ConstructionPlan; pointer: ConstructionPlanSnapshotPointer }> => {
  const pointer = dependencies.getPointer(currentPlan, 'approved');
  const content = await dependencies.downloadVerifiedContent(pointer);
  const materialized = dependencies.materialize(currentPlan, content);
  return {
    pointer,
    plan: {
      ...materialized,
      approvedSnapshotId: pointer.snapshotId,
      approvedSnapshotHash: pointer.contentHash,
      approvedSnapshotStoragePath: pointer.storagePath,
    },
  };
};

export default loadApprovedConstructionPlanPdfSource;
