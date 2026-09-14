const cancelled = new Set<string>();
const file = { id: 'fixture-file', jobId: 'fixture-job', yearMonth: '2026-09', originalFileName: '9월에 잘못 등록한 청구서.pdf', status: 'completed', fileIndex: 0, createdAt: { seconds: 1788440400 }, warnings: [] };
const payload = {
  job: { id: 'fixture-job', status: 'completed', analyzedFiles: 1, totalFiles: 1 },
  files: [file], results: [{ id: 'result', fileId: file.id, fileIndex: 0, resultIndex: 0, status: 'excluded', subtotalAmount: 11600, transactionCount: 1, transactions: [], warnings: [], matchCandidates: [], originalFileName: file.originalFileName, exclusionReason: '같은 PDF가 이미 저장되어 중복 반영을 막았습니다.', duplicateSourceOwnerJobId: 'old-job' }],
};
const savePreview = new URLSearchParams(window.location.search).has('save');
const saveResult = { ...payload.results[0], status: 'matched', matchedCardId: 'fixture-card', matchedCardLabel: '테스트 카드', originalFileName: '테스트 청구서.pdf', exclusionReason: undefined, duplicateSourceOwnerJobId: undefined };
const savePayload = { ...payload, ok: true, job: { ...payload.job, yearMonth: '2026-08', status: 'reviewing' }, results: [saveResult] };
const currentPayload = () => savePreview ? savePayload : payload;
const previewOptions = new URLSearchParams(window.location.search);
const historyFiles = previewOptions.has('bulk') ? [
  file,
  { ...file, id: 'fixture-second', originalFileName: '추가 청구서.pdf', fileIndex: 1 },
  { ...file, id: 'fixture-busy', originalFileName: '분석 중인 청구서.pdf', fileIndex: 2, status: 'analyzing' },
] : [file];
export const cardStatementImportService = {
  listUploadHistory: async () => historyFiles.map((item) => ({ ...item, status: cancelled.has(item.id) ? 'cancelled' : item.status })),
  cancelStoredFile: async (fileId: string) => {
    if (previewOptions.has('blocked') || (previewOptions.has('partial') && fileId === 'fixture-second')) throw new Error('저장된 카드 금액이 남아 있습니다. 이 월의 해당 카드 금액을 0으로 바꾸고 전체 저장한 뒤 업로드를 취소해 주세요.');
    cancelled.add(fileId);
  },
  createJobFromFiles: async () => ({ jobId: 'fixture-job' }),
  analyzeJob: async () => currentPayload(),
  commitJob: async () => ({ ...savePayload, job: { ...savePayload.job, status: 'completed' }, results: [{ ...saveResult, status: 'committed' }] }),
  subscribeJob: (_id: string, callback: Function) => { callback(currentPayload().job); return () => {}; },
  subscribeFiles: (_id: string, callback: Function) => { callback(currentPayload().files); return () => {}; },
  subscribeResults: (_id: string, callback: Function) => { callback(currentPayload().results); return () => {}; },
};
