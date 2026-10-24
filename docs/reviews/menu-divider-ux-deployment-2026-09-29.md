# 메뉴 구분선 UX 운영 배포 기록 — 2026-09-29

- 운영 화면: https://cyee-9c1e4.web.app/admin/menu-manager
- 배포 대상: Firebase 프로젝트·Hosting 사이트 `cyee-9c1e4`, Hosting만 배포.
- 기준 운영 커밋: `5ddba6c21de335619de869607ddb10c339e75df5`.
- 배포 커밋: `43d61eb8acbbdccc786ba60c0caf724c68eb1477`.
- 배포 작업 폴더: `C:/Users/playz/cy/tmp/menu-divider-ux-release`.
- 브랜치: `codex/menu-divider-ux-release`.
- 운영 버전을 기준으로 구분선 관련 구현 및 테스트 14개 파일만 반영했다. 업로드 직전 변경 그룹은 `hosting`뿐이고 Git 상태는 깨끗했다.

## 변경 내용

- 선택한 메뉴 아래에 구분선 추가, 추가 위치로 자동 스크롤, 구분선 드래그 표시.
- 전용 설정에서 실선·점선과 간격 3단계, 표시·숨김 및 사이드바 미리보기 제공.
- 사이드바와 하위 메뉴·펼침 패널에서 이동 링크 대신 실제 선으로 표시.
- 구분선 모양·간격 저장 유지, 기존 구분선의 고유 ID 생성 및 중복 정리 시 구분선 보존.

## 검증 및 배포

- 변경 범위 ESLint, 전체 TypeScript 검사 및 Functions 빌드 통과.
- 전체 테스트 364개 파일 통과: 2,157개 성공, 기존 제외 2개.
- 최초 전체 병렬 검사에서 기존 차량 대장 테스트의 비동기 로딩 대기 단언이 한 번 실패했다. 해당 파일 단독 재검사 및 전체 순차 재검사는 모두 통과했으며 차량 코드나 테스트는 수정하지 않았다.
- 기본 Firebase Hosting 사전 절차인 운영 빌드, 빌드 파일 검증 및 운영 대상 검사 모두 통과 후 배포 성공.
- `npm run release:verify` 성공: 운영 커밋·소스 지문·정적 파일 목록이 배포본과 일치했다.
- 운영 브라우저 새로고침 후 `구분선 추가`, `구분선 바로 추가` 버튼과 추가 위치 안내가 표시됐고 가로 넘침이 없음을 확인했다.
- 운영 메뉴 데이터 저장·삭제, 서버 기능·권한 규칙 배포, Git push는 수행하지 않았다. 구분선 설정 저장과 실행 취소는 모의 저장소 테스트에서 검증했다.

## 실행 기록

- `artifacts/menu-divider-release-lint.log`
- `artifacts/menu-divider-production-deploy.log` — 최초 전체 검사 및 중단 원인.
- `artifacts/menu-divider-release-retest.log`
- `artifacts/menu-divider-release-tests.log`
- `artifacts/menu-divider-release-functions.log`
- `artifacts/menu-divider-hosting-deploy.log`
- `artifacts/menu-divider-production-verify.log`
