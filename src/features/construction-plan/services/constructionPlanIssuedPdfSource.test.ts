import type { ConstructionPlan, ConstructionPlanSnapshotPointer } from '../types';
import { loadApprovedConstructionPlanPdfSource } from './constructionPlanIssuedPdfSource';

jest.mock('./constructionPlanReviewService', () => ({
  downloadVerifiedConstructionPlanSnapshotContent: jest.fn(),
  getConstructionPlanSnapshotPointer: jest.fn(),
  materializeConstructionPlanSnapshot: jest.fn(),
}));

describe('loadApprovedConstructionPlanPdfSource', () => {
  const current = {
    id: 'plan-1', approvedSnapshotId: 'snapshot-1', approvedSnapshotHash: 'a'.repeat(64),
    approvedSnapshotStoragePath: `construction-plans/site-1/plan-1/snapshots/${'a'.repeat(64)}.json`,
  } as ConstructionPlan;
  const pointer: ConstructionPlanSnapshotPointer = {
    planId: 'plan-1', snapshotId: 'snapshot-1', contentHash: 'a'.repeat(64),
    storagePath: current.approvedSnapshotStoragePath!,
  };

  it('downloads, verifies and materializes the approved snapshot before rendering', async () => {
    const verifiedContent = { planId: 'plan-1', title: '승인된 본문' } as never;
    const materialized = { ...current, title: '승인된 본문' };
    const dependencies = {
      getPointer: jest.fn(() => pointer),
      downloadVerifiedContent: jest.fn(async () => verifiedContent),
      materialize: jest.fn(() => materialized),
    };
    const result = await loadApprovedConstructionPlanPdfSource(current, dependencies);
    expect(dependencies.getPointer).toHaveBeenCalledWith(current, 'approved');
    expect(dependencies.downloadVerifiedContent).toHaveBeenCalledWith(pointer);
    expect(dependencies.materialize).toHaveBeenCalledWith(current, verifiedContent);
    expect(result.plan).toEqual(expect.objectContaining({
      title: '승인된 본문', approvedSnapshotId: 'snapshot-1', approvedSnapshotHash: 'a'.repeat(64),
    }));
  });

  it('never falls back to the live plan when snapshot verification fails', async () => {
    const dependencies = {
      getPointer: jest.fn(() => pointer),
      downloadVerifiedContent: jest.fn(async () => { throw new Error('snapshot-hash-mismatch'); }),
      materialize: jest.fn(),
    };
    await expect(loadApprovedConstructionPlanPdfSource(current, dependencies)).rejects.toThrow('snapshot-hash-mismatch');
    expect(dependencies.materialize).not.toHaveBeenCalled();
  });
});
