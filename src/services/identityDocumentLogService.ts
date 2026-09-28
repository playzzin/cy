import { identityBundleLogService, type IdentityLogInput } from './identityBundleLogService';

// Keep logging failures separate from an already completed document operation.
export const recordIdentityDocumentLog = async (input: IdentityLogInput): Promise<void> => {
  try {
    if (await identityBundleLogService.log(input)) return;
  } catch { /* Report through the same warning as a rejected write. */ }
  try {
    const { toast } = await import('../utils/swal');
    void toast.warning('신분증 작업 로그를 저장하지 못했습니다. 로그인과 연결 상태를 확인해 주세요.');
  } catch { console.warn('[IdentityDocumentLog] 작업 로그를 저장하지 못했습니다.'); }
};

type WorkerDocument = { id?: unknown; name?: unknown; fileNameSaved?: unknown };

export const recordWorkerIdentityChange = async (
  before: WorkerDocument | null,
  after: WorkerDocument | null,
): Promise<void> => {
  const previous = String(before?.fileNameSaved || '').trim();
  const next = String(after?.fileNameSaved || '').trim();
  if (previous === next) return;
  await recordIdentityDocumentLog({
    action: !next ? 'document_removed' : previous ? 'document_replaced' : 'document_registered',
    status: 'success',
    workerId: String(after?.id || before?.id || ''),
    personNames: [String(after?.name || before?.name || '')],
    personCount: 1,
    fileCount: 1,
    // Storage paths, URLs and OCR fields are deliberately excluded.
  });
};
