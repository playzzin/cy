# Autonomous Development Plan

## 목표

Smart Construction ERP를 기능 추가가 가능한 상태에서 운영 안정성, 보안, 테스트, 성능, 유지보수성을 순차적으로 끌어올린다. 각 단계는 작은 변경 단위로 진행하고, 기존 작업트리의 사용자 변경을 되돌리지 않는다.

## 현재 기준선

- `npx tsc --noEmit` 통과
- `npm --prefix functions run build` 통과
- `npm test -- --watchAll=false` 통과: 34 suites, 133 tests
- `npm audit --omit=dev` 기준 루트 패키지 취약점 존재
- `npm --prefix functions audit --omit=dev` 기준 Functions 취약점 존재
- `npm --prefix server audit --omit=dev` 기준 로컬 Barobill 서버 취약점 존재
- Java 미설치로 Firestore/Storage emulator 기반 rules 검증은 로컬에서 미실행

## 진행 원칙

1. 먼저 검증 체계를 고정한 뒤 리팩터링한다.
2. 운영 보안과 데이터 권한을 기능 개발보다 우선한다.
3. 대형 화면은 계산 로직, 데이터 IO, UI 상태, 렌더링을 나눠 테스트 가능한 단위로 축소한다.
4. 변경마다 `typecheck`, `test:ci`, `functions:build`를 통과시킨다.
5. audit 실패 항목은 무리한 `--force` 업그레이드 대신 원인 패키지별로 분리 처리한다.

## Phase 0 - 기준선과 자동 검증

- [x] 프로젝트 고도화 로드맵 작성
- [x] `typecheck`, `test:ci`, `functions:build`, `verify:project` 스크립트 추가
- [x] GitHub Actions 품질 게이트 초안 추가
- [ ] Java 설치 또는 CI emulator 환경에서 rules 문법 검증 추가
- [x] `npm audit` 결과를 취약점 유형별 backlog로 분류

## Phase 1 - 보안과 권한

- [ ] `server/` Barobill 로컬 서버의 운영 사용 여부 결정
- [x] 개발 전용 기본값으로 loopback bind와 CORS allowlist 적용
- [x] production 실행 시 API token 필수화
- [ ] 운영 경로라면 rate limit과 요청 schema 검증 추가
- [ ] Firestore fallback 규칙을 컬렉션 allowlist 기반으로 축소
- [ ] Storage fallback write 규칙을 업무 경로별 정책으로 세분화
- [ ] `devAdminSession`이 production build에서 완전히 비활성화되는지 테스트 보강

## Phase 2 - 취약점과 의존성

- [ ] 루트 `firebase-admin` 의존성을 프론트 앱 런타임에서 분리
- [ ] Functions `firebase-admin`, `firebase-functions`, transitive gRPC/protobuf 취약점 업그레이드 검토
- [ ] `xlsx` 취약점 대체 전략 수립: `exceljs` 전환, 업로드 격리, 파일 크기/형식 제한
- [ ] `react-scripts` 계층 취약점은 CRA 유지/탈출 비용을 비교해 결정
- [ ] `server/` 패키지 취약점 정리

## Phase 3 - 테스트 확대

- [ ] 권한 정책 단위 테스트를 문자열 포함 검사에서 정책 행위 테스트로 확장
- [ ] 핵심 업무 흐름 E2E 추가: 로그인, 일일보고, 급여/정산, 세금계산서, 자산 배정
- [ ] Firestore repository/cache 계층 테스트 확대
- [ ] 대형 화면에서 추출한 계산 로직에 회귀 테스트 추가
- [ ] React Testing Library deprecation 경고 정리

## Phase 4 - 대형 화면 분리

우선순위:

1. `src/pages/taxinvoice/WorkbookLedgerPage.tsx`
2. `src/pages/payroll/SupportClientSitePage.tsx`
3. `src/pages/payroll/MonthlyWageDraftPage.tsx`
4. `src/pages/payroll/ProgressClaimPage.tsx`
5. `src/pages/payroll/SupportTeamPaymentPage.tsx`

분리 순서:

- 계산/정규화 함수 추출
- Firestore IO 서비스 또는 repository로 이동
- table/grid configuration 분리
- modal/form 상태 reducer 또는 hook으로 분리
- 추출 단위별 테스트 추가

## Phase 5 - 성능

- [ ] chunk size budget을 정의하고 CI에서 추적
- [ ] Excel/grid/chart 라이브러리 지연 로딩 범위 확대
- [ ] 대시보드와 목록 화면의 Firestore 구독 수 점검
- [ ] 큰 테이블의 virtualization, pagination, deferred rendering 점검
- [ ] PWA cache update/recovery 시나리오 테스트 추가

## Phase 6 - 관측성

- [x] Sentry DSN과 sample rate를 환경 변수화
- [ ] 주요 업무 실패에 `captureException` context 추가
- [ ] Functions에는 `functions.logger` 기반 구조화 로그 적용
- [ ] 사용자에게 보이는 오류 메시지와 내부 로그를 분리
- [ ] 배포 후 smoke check 절차 문서화

## Phase 7 - 저장소 정리와 문서화

- [ ] tracked `recovery/` 스냅샷 보존 정책 결정
- [ ] 루트 로그, 임시 산출물, 스크린샷 tracked 파일 정리
- [ ] 환경 변수 문서 최신화
- [ ] 배포 runbook 작성
- [ ] 장애 대응 runbook 작성

## 완료 기준

각 단계는 다음 조건을 만족해야 완료로 본다.

- 코드 변경이 있으면 타입체크, 테스트, 관련 빌드를 통과한다.
- 보안/권한 변경은 실패 케이스 테스트를 포함한다.
- 대형 화면 분리는 사용자 동작 변화 없이 진행한다.
- 운영 설정 변경은 rollback 방법을 남긴다.
