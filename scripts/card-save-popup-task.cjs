// Scope: Todo workflow metadata only. Never writes card or billing collections.
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const taskId = 'wi0AXKBSNSVaNfSFq7xJ';
const runId = 'cy-card-save-popup-20260904';
const phase = process.argv[2];
if (!['claim', 'ready'].includes(phase)) throw new Error('Expected claim or ready');
initializeApp({ projectId: 'cyee-9c1e4', credential: applicationDefault() });
const db = getFirestore();
db.settings({ preferRest: true });
const feedback = '카드 청구서 PDF 저장이 끝나면 확인 팝업이 뜨도록 수정하고 테스트했습니다. 팝업에는 저장한 월, 내역 수와 금액이 표시됩니다. 일부만 저장됐거나 중복으로 저장된 내역이 없는 경우에는 전체 저장 완료로 안내하지 않습니다. 저장이 끝난 내역은 다시 저장 버튼을 누를 수 없게 했습니다.\n\n현재는 배포 승인 대기 상태이며 아직 운영 사이트에 반영되지 않았습니다. 승인 후 반영 확인까지 마친 다음 완료 처리하겠습니다. 실제 카드 금액·청구 내역은 변경하지 않았습니다.';
db.runTransaction(async (transaction) => {
  const ref = db.doc(`tasks/${taskId}`);
  const snapshot = await transaction.get(ref);
  if (!snapshot.exists) throw new Error('Request not found');
  const task = snapshot.data();
  if (task.description !== '카드청구서 pdf 저장후 저장되었다는 확인팝업창이 필요합니다.') throw new Error('Request changed; manual review required');
  if (phase === 'claim') {
    if (task.automation?.runId === runId) return { status: task.status, result: 'already-claimed' };
    if (!['요청', '요청중', '재요청'].includes(task.status) || task.automation?.status === 'in_progress') throw new Error('Request is already being handled');
    transaction.update(ref, { status: '진행', 'automation.runId': runId, 'automation.status': 'in_progress', 'automation.startedAt': new Date().toISOString(), 'automation.feedback': '저장 확인 팝업을 수정·검증 중입니다. 운영 데이터는 변경하지 않습니다.' });
    return { status: '진행', result: 'claimed' };
  }
  if (task.status !== '진행' || task.automation?.runId !== runId) throw new Error('Request ownership or status changed');
  const commentId = 1788508800001;
  if (task.comments?.some((comment) => comment.id === commentId)) return { status: task.status, result: 'already-reported' };
  transaction.update(ref, {
    'automation.feedback': feedback, 'automation.reviewRequired': true, 'automation.reviewReason': '배포 승인 대기',
    'automation.changedFiles': ['src/components/card/CardStatementImportModal.tsx', 'src/components/card/CardStatementImportModal.test.tsx'],
    'automation.verification': ['저장 확인·부분 저장·중복 제외·실패·재저장 방지 테스트', '타입 검사 및 변경 파일 lint', '운영 배포용 프런트 빌드', '가상 데이터로 PC·모바일 브라우저 저장 알림 확인'],
    comments: [...(task.comments || []), { id: commentId, user: 'Codex', text: feedback, time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }), isSystem: true }],
  });
  return { status: '진행', result: 'awaiting-deployment-approval' };
}).then((result) => console.log(JSON.stringify({ taskId, ...result }))).catch((error) => { console.error(error.message); process.exitCode = 1; });
