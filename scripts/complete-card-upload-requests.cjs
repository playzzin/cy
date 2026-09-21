// Explicitly scoped completion of the two verified requests, after deployment only.
const fs = require('node:fs');
const path = require('node:path');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const release = path.resolve(__dirname, '../.deploy_card_upload_20260904/build/asset-manifest.json');
const expected = JSON.parse(fs.readFileSync(release, 'utf8')).entrypoints;
const verification = ['프런트엔드 테스트 8건 통과', '서버·Firestore 테스트 9건 통과', '타입 검사·수정 파일 lint·배포 빌드 통과', 'PC 및 모바일 화면 확인', '운영 Hosting 및 관련 서버 함수 배포 확인'];
const common = '\n\n사용 방법: ① 카드 대장에서 2026-09 선택 ② 해당 카드 금액을 0으로 바꾸고 전체 저장(이미 저장했다면 생략) ③ 카드 PDF 옆 [업로드 내역]에서 잘못 올린 파일의 [업로드 취소] 선택 ④ 2026-08로 이동해 PDF를 새로 등록하세요.\n\n금액이 남거나 이미 확정된 청구서는 취소되지 않도록 보호했습니다. 원본 PDF와 취소 기록은 보관합니다. 실제 카드 금액이나 청구 내역은 제가 옮기거나 삭제하지 않았습니다. 테스트용 데이터와 PC·휴대폰 화면으로 확인했으며, 실제 계정에서의 금액 재등록은 담당자가 위 순서대로 진행해 주세요.';
const requests = [
  { id: '7zHyzTFXfwRPkNm6wd1D', text: '수정하고 사이트에 배포했습니다. 금액을 지워도 PDF가 이미 등록된 기록이 남아 있어서 다른 월에 다시 등록되지 않았습니다. 이제 기존 월의 업로드를 취소하면 같은 PDF를 올바른 월에 다시 등록할 수 있습니다. 제외된 이유와 해결 방법도 화면에 표시됩니다.' + common },
  { id: 'zbI8GsNALotRQPZXgGeT', text: '요청하신 [업로드 취소] 기능을 추가하고 배포했습니다. 카드 대장 상단의 [업로드 내역]에서 현재 선택한 월의 청구서 PDF를 확인하고, 잘못 올린 파일만 선택해 취소할 수 있습니다. 취소 전 확인 절차가 있으며, [취소 내역도 보기]로 기록을 확인할 수 있습니다.' + common },
];
async function main() {
  const live = await fetch('https://cyee-9c1e4.web.app/asset-manifest.json', { cache: 'no-store' }).then((res) => { if (!res.ok) throw new Error('Live manifest unavailable'); return res.json(); });
  if (JSON.stringify(live.entrypoints) !== JSON.stringify(expected)) throw new Error('Release is not live; refusing completion.');
  initializeApp({ projectId: 'cyee-9c1e4', credential: applicationDefault() });
  const db = getFirestore();
  for (const [index, request] of requests.entries()) {
    const ref = db.doc(`tasks/${request.id}`);
    const commentId = 1788476400000 + index;
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new Error(`Missing request ${request.id}`);
      const task = snapshot.data();
      if (task.comments?.some((comment) => comment.id === commentId)) return 'already-completed';
      if (!['요청', '요청중', '진행', '진행중', '재요청'].includes(task.status)) throw new Error(`Request status changed: ${request.id}`);
      if (!process.argv.includes('--apply')) return 'ready';
      transaction.update(ref, {
        status: '검토',
        comments: [...(task.comments || []), { id: commentId, user: 'Codex', text: request.text, time: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }), isSystem: true }],
        'automation.status': 'completed', 'automation.reviewRequired': false,
        'automation.feedback': request.text, 'automation.verification': verification,
        'automation.finishedAt': new Date().toISOString(),
      });
      return 'completed';
    });
    console.log(JSON.stringify({ id: request.id, result }));
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
