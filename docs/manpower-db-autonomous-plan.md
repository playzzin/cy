# 통합 DB 자율개발 기획

대상 화면: `/database/manpower-db`

## 현재 확인한 문제

- 일보 집계 API(`getCountFromServer`)가 실패하면 통합 DB 현황 로딩 전체가 실패할 수 있었다.
- 최근 30일 기준 날짜를 UTC 기준으로 만들고 있어 한국 시간 새벽에는 조회 범위가 하루 어긋날 수 있었다.
- `?tab=reports`는 파싱되지만 실제 탭 화면이 없어 빈 본문이 될 수 있었다.
- 탭 클릭이 URL을 갱신하지 않아 공유 링크, 뒤로가기, 새로고침 후 상태 복원이 약했다.

## 이번에 반영한 개선

- 일보 통계는 이미 로드하는 전체 일보 데이터에서 계산하도록 바꿔 Firestore 집계 실패 영향을 제거했다.
- 최근 30일 범위와 오늘/이번 달 통계를 브라우저 로컬 날짜 기준으로 계산한다.
- `?tab=reports`, `?tab=daily-reports` 요청은 `/reports/daily?tab=list-v2`로 리디렉션한다.
- 통합 DB 탭/요약 카드 이동은 `?tab=` 쿼리와 동기화한다.
- 일보 데이터 로딩만 실패한 경우 마스터 데이터 현황은 유지하고, 제외된 범위를 화면 경고로 표시한다.
- Overview 데이터 로딩은 `useIntegratedDatabaseOverview` 훅으로 분리했다.
- 일보 통계, 최근 일보 범위, 마스터 통계 계산은 `manpowerDatabaseOverview` 순수 함수로 분리하고 단위 테스트를 추가했다.

## 자율개발 로드맵

### Phase 1. 안정화

- [x] 통합 DB Overview의 데이터 로딩을 `useIntegratedDatabaseOverview` 훅으로 분리한다.
- [x] `buildReportStats`, `filterReportsByDateRange`, 마스터 통계 계산 로직에 단위 테스트를 추가한다.
- [ ] 데이터 무결성 계산 로직을 순수 함수로 분리하고 단위 테스트를 추가한다.
- 개별 데이터 소스 실패 시 어느 카드가 불완전한지 카드 단위 경고 상태를 표시한다.

### Phase 2. 성능

- 전체 일보를 매번 불러오는 구조를 `overview stats`, `integrity scan` 두 단계로 나눈다.
- 초기 화면은 마스터 통계와 핵심 리스크만 먼저 표시하고, 일보 무결성은 백그라운드로 계산한다.
- 작업자/팀/현장/회사 목록 탭은 진입 시점에 필요한 데이터만 로드하도록 lazy loading 상태를 점검한다.

### Phase 3. 운영 자동화

- 무결성 항목마다 “담당 화면 이동”, “필터 자동 적용”, “수정 완료 후 재검사” 흐름을 만든다.
- 중복 작업자, 계좌 누락, 신분증 누락은 CSV/엑셀 다운로드와 일괄 처리 큐를 제공한다.
- 매일 오전 자동 점검 결과를 관리자 대시보드 또는 알림 센터에 요약한다.

### Phase 4. 회귀 방지

- `/database/manpower-db`, `?tab=workers`, `?tab=offices`, `?tab=settlement-targets`, `?tab=reports`에 대한 브라우저 smoke test를 추가한다.
- Firestore 집계 실패, 일보 로딩 실패, 빈 데이터셋을 모킹한 테스트 케이스를 유지한다.
- 주요 수치 계산 기준을 문서화하고 카드별 산식 변경 시 테스트를 먼저 갱신한다.

## 다음 작업 단위

1. `ManpowerDatabase.tsx`에서 Overview 계산 로직을 훅과 순수 함수로 분리한다.
2. 분리한 순수 함수에 테스트를 추가한다.
3. 일보 무결성 계산을 백그라운드 상태로 분리하고 로딩 표시를 추가한다.
4. 무결성 상세에서 선택한 항목이 대상 탭의 필터로 바로 이어지게 한다.

## 완료 기준

- `npm run typecheck -- --pretty false` 통과.
- `/database/manpower-db` 진입 시 콘솔에 화면 자체 오류가 없어야 한다.
- 모든 지원 탭 URL이 새로고침 후 같은 탭을 복원해야 한다.
- 지원하지 않는 탭 값은 빈 화면을 만들지 않고 올바른 화면으로 이동해야 한다.
