import { httpsCallable } from 'firebase/functions';
import { readVerifiedConstructionPlanServerPdf } from './constructionPlanWorkflowApi';
import { fetchAuditedIssuedConstructionPlanPdf } from './constructionPlanIssuedDownloadService';

jest.mock('../../../config/firebase', () => ({ functions: { name: 'test-functions' } }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('./constructionPlanWorkflowApi', () => ({ readVerifiedConstructionPlanServerPdf: jest.fn() }));

describe('fetchAuditedIssuedConstructionPlanPdf', () => {
  const callable = httpsCallable as jest.MockedFunction<typeof httpsCallable>;
  const readVerified = readVerifiedConstructionPlanServerPdf as jest.MockedFunction<typeof readVerifiedConstructionPlanServerPdf>;
  const sha256 = 'a'.repeat(64);
  const artifact = {
    storagePath: `construction-plans/site-1/plan-1/server-exports/issued/rev-01/field-use-a4-v2/${'b'.repeat(64)}/${sha256}.pdf`,
    storageGeneration: '1787360000000001', sha256, sizeBytes: 4, pageCount: 42, fileName: 'issued.pdf',
  };

  beforeEach(() => jest.clearAllMocks());

  it('requires prepare intent, verified bytes and idempotent completion before returning a blob', async () => {
    const prepare = jest.fn().mockResolvedValue({ data: { receiptId: 'receipt-1', artifact, idempotent: false } });
    const complete = jest.fn().mockResolvedValue({ data: { receiptId: 'receipt-1', completed: true, idempotent: false } });
    callable.mockImplementation(((_functions: unknown, name: string) => (
      name === 'prepareConstructionPlanIssuedPdfDownloadServer' ? prepare : complete
    )) as never);
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    readVerified.mockResolvedValue(blob);

    const result = await fetchAuditedIssuedConstructionPlanPdf({
      planId: 'plan-1', expectedSha256: sha256, idempotencyKey: 'download-attempt-1',
    });
    expect(prepare).toHaveBeenCalledWith({ planId: 'plan-1', expectedSha256: sha256, idempotencyKey: 'download-attempt-1' });
    expect(readVerified).toHaveBeenCalledWith(artifact);
    expect(complete).toHaveBeenCalledWith({ receiptId: 'receipt-1', downloadedSha256: sha256, downloadedSizeBytes: blob.size });
    expect(result.blob).toBe(blob);
  });

  it('does not return bytes when completion audit is rejected', async () => {
    callable.mockImplementation(((_functions: unknown, name: string) => jest.fn().mockResolvedValue({ data: name.startsWith('prepare')
      ? { receiptId: 'receipt-1', artifact, idempotent: false }
      : { receiptId: 'receipt-1', completed: false } })) as never);
    readVerified.mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }));
    await expect(fetchAuditedIssuedConstructionPlanPdf({
      planId: 'plan-1', expectedSha256: sha256, idempotencyKey: 'download-attempt-2',
    })).rejects.toThrow('construction-plan-download-invalid-response:complete');
  });
});
