# 로컬 전체 앱 업무 검수

실제 React 앱, Firebase 클라이언트 SDK, Auth/Firestore/Storage 에뮬레이터와 실제 서버 callable handler를 사용한다. Functions 실행 환경은 로컬 HTTP 어댑터이므로 운영 Functions·이벤트 트리거 검증은 아니다. 모든 데이터는 `demo-client-workflow`의 합성 계정과 자료이며 외부 요청은 차단한다. `.env` 파일을 읽지 않는다.

## 순서

1. `npm run functions:build`
2. `node scripts/client-workflow-qa/build.cjs`
3. 별도 터미널에서 `node scripts/client-workflow-qa/run.cjs`
4. 준비 메시지 후 `node scripts/client-workflow-qa/flows.cjs`
5. `node scripts/client-workflow-qa/crawl.cjs`
6. 화면 수정·재빌드 후 `node scripts/client-workflow-qa/crawl.cjs --recheck`
7. `node scripts/client-workflow-qa/gallery.cjs`

추가 회귀: `node scripts/client-workflow-qa/cold-grid.cjs`는 새 브라우저에서 4종 표의 실제 행 표시와 모바일 편집 영역을 검사한다. `node scripts/client-workflow-qa/settlement-guard.cjs`는 미저장 월 이동 취소·폐기와 고정 바의 배경을 확인한다.

Java, Firebase CLI, Chrome, `playwright-core` 경로는 이 PC 환경을 기준으로 한다. 다른 PC에서는 `run.cjs`·`browser.cjs`의 런타임 경로를 맞춘다. 에뮬레이터 실행 터미널을 종료하면 합성 데이터는 폐기된다. `flows.cjs`는 자신의 합성 계정·신청 자료만 초기화하며 운영 프로젝트에서는 `state.cjs`의 환경 검증을 통과할 수 없다.

사진 검수는 별도 터미널의 `node scripts/client-mobile-preview.cjs`와 `node scripts/client-workflow-qa/photo.cjs`를 사용한다. 실제 PNG 저장을 확인하며, 공유·취소 API만 대체한다. 실기기 절차는 `docs/android-kakao-photo-qa.md`에 기록했다.

## 증거 해석

출력 위치는 `artifacts/client-workflow-qa/`다. `flow-results.json`은 저장 후 재조회까지 포함하는 업무 흐름, `route-results.json`은 화면 진입·예외·넘침·캡처 결과다. `route-baseline.json`은 수정 전 수치를 보존한다.

전체 경로 캡처는 모든 버튼·모든 데이터 상태·모든 권한을 시험한 결과가 아니다. `unavailable`은 안내 문구에 따른 검토 표시이므로 실제 외부 연동 제한과 일반 설명 문구를 수동으로 구분해야 한다. 상세 문서 ID가 없는 경로는 빈 상태 검수다. 팀장 전용 승인 화면의 관리자 접근 오류는 별도 팀장 업무 흐름 결과와 구분한다.
