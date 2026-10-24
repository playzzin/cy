# 거래대장 운영 배포 기록 — 2026-09-29

## 대상과 범위

- 운영 사이트: `https://cyee-9c1e4.web.app/payroll/workbook-ledger`
- 배포 대상: Firebase 프로젝트·Hosting 사이트 `cyee-9c1e4`, Hosting만 배포.
- 기준 운영 커밋: `bb9748b16345cce31dbec95caea5d2e4e15dc2d1`.
- 배포 커밋: `c4176dc89f17a7019a7419b05fd5a4167aeec143`.
- 배포용 체크아웃: `C:/Users/playz/cy/tmp/workbook-ledger-reliability-release`.
- 브랜치: `codex/workbook-ledger-reliability-release`.
- 거래대장 화면·모델·입력 컴포넌트·저장 서비스·계산·검증·테스트 10개 파일만 반영했다. 페이지 내부 계산 코드를 모델로 분리한 변경을 포함한다.
- 작업 폴더의 다른 미커밋 변경은 포함하지 않았다. 서버 기능, Firestore 규칙·색인, Storage 규칙 및 배포 설정의 지문은 기존 운영 버전과 동일함을 확인했다.

## 배포본 검증

- 전체 TypeScript 검사 통과.
- 관련 10개 TypeScript/TSX 파일의 ESLint 통과.
- 전체 테스트 360개 파일 통과: 2,134개 성공, 기존 제외 2개.
- Firebase Functions 빌드 통과. Functions는 배포하지 않았다.
- 설정 JSON 구문, 운영 Firebase 연결 설정, 깨끗한 Git 상태와 기존 운영 기준 버전을 확인했다.
- 기본 Hosting 사전 검사(운영용 빌드, 빌드 파일 검사, 운영 대상 검사)를 유지한 배포 명령을 실행했다.

## 배포 결과

- Firebase Hosting 배포 성공. 기본 사전 검사인 빌드, 빌드 파일 검증, 운영 Firebase 대상 검사가 모두 통과했다.
- `check-release.cjs` 성공: 운영 `release.json`의 커밋이 `c4176dc89f17a7019a7419b05fd5a4167aeec143`이고, 배포 지문 및 정적 파일 목록이 로컬 배포본과 일치했다.
- 실제 Chrome에서 운영 주소를 새로고침한 뒤 입력폼, DB, 거래장, 전체 조회, 분기 부가세 화면을 확인했다.
- 거래장의 이월액·선수금 설명, DB의 일부 조회 안내와 `미매핑 필터 해제` 버튼이 운영 화면에 표시됐다.
- 전체 조회에서 이력 검증 중 내보내기·화면 복사·인쇄 버튼이 비활성화되고, 검증 완료 후 활성화되는 것을 확인했다. 오류 알림 없이 부가세 표도 표시됐다.
- 확인 후 입력폼으로 돌아와 작성 0건을 확인했다. 데이터 등록·수정·삭제 작업은 실행하지 않았다.

## 검증 로그

- `artifacts/workbook-ledger-release-typecheck.log`
- `artifacts/workbook-ledger-release-tests.log`
- `artifacts/workbook-ledger-release-functions-build.log`
- `artifacts/workbook-ledger-production-deploy.log`

이 작업에서 실제 거래 데이터 등록·수정·삭제, 송금 또는 지급 처리, Git push는 수행하지 않았다.
