# 정산 누락/이상금액 경고센터 자율개발 TODO

## 목적

`/support`, `/payroll`, `/taxinvoice`에 흩어진 지원공수, 차량, 숙소, 카드, 경비, 미수금 데이터를 한 화면에서 점검하는 읽기 전용 경고센터를 단계적으로 만든다.

이 문서는 `/todo`에 작업을 순서대로 등록하거나, 각 TODO의 "자율개발 프롬프트"를 Codex 작업 지시문으로 사용할 수 있게 작성했다.

## 공통 원칙

- 정산, 청구서, 세금계산서, 미수금 원본 데이터는 자동 수정하지 않는다.
- 경고센터는 읽기 전용 분석과 경고 상태 저장만 담당한다.
- 사용자가 할 수 있는 변경은 경고의 `확인`, `보류`, `해결` 상태 저장뿐이다.
- 기존 사용자 변경사항을 되돌리지 않는다.
- 기능은 작은 단위로 완료하고, 각 단계마다 타입체크와 관련 테스트를 확인한다.

## 추천 진행 순서

1. `SCA-01` 경고센터 뼈대
2. `SCA-02` 미수금/과입금 경고
3. `SCA-03` 경비 후청구 경고
4. `SCA-04` 차량/카드/숙소 미확정 청구 경고
5. `SCA-06` 경고 상태 저장
6. `SCA-08` UI 마감/대시보드 연결
7. `SCA-05` 지원공수/지원청구 이슈 경고
8. `SCA-07` 청구서 미생성 추정 경고

`SCA-05`, `SCA-07`은 오탐 가능성이 높으므로 기본 경고센터가 안정화된 뒤 진행한다.

---

## SCA-01 - 경고센터 뼈대 만들기

### 목표

정산 경고센터의 타입, 라우트, 빈 화면, 기본 UI 골격을 만든다. 실제 정산 데이터 계산은 아직 하지 않는다.

### 주요 파일

- `src/App.tsx`
- `src/constants/menuPaths.ts`
- `src/features/settlement-alerts/settlementAlertTypes.ts`
- `src/pages/settlement/SettlementAlertCenterPage.tsx`

### 자율개발 프롬프트

```text
현재 프로젝트 C:\Users\playz\cy 에 “정산 누락/이상금액 경고센터”의 뼈대만 구현해줘.

범위:
- 실제 정산 데이터 계산은 아직 하지 않는다.
- 타입, 라우트, 빈 화면, 기본 UI 골격만 만든다.
- 원본 정산/청구/미수금 데이터는 절대 수정하지 않는다.

구현:
- src/features/settlement-alerts/settlementAlertTypes.ts 생성
- SettlementAlert, SettlementAlertState 타입 정의
- src/pages/settlement/SettlementAlertCenterPage.tsx 생성
- /settlement/alerts 라우트 추가
- src/constants/menuPaths.ts에 “정산 경고센터”, “누락 정산”, “이상금액 경고” alias 추가
- 화면에는 월 선택, 요약 카드 자리, 필터 자리, 빈 테이블만 표시

UI:
- 업무 ERP 화면처럼 밀도 있게 구성한다.
- 마케팅형 랜딩 페이지나 과한 장식은 만들지 않는다.
- 모바일에서 텍스트가 겹치지 않게 한다.

검증:
- 가능한 경우 npm run typecheck 실행
- 수정 파일과 검증 결과를 보고한다.
```

### 완료 기준

- `/settlement/alerts`로 접근 가능한 빈 경고센터 화면이 있다.
- 타입 정의가 이후 단계에서 재사용 가능하다.
- `npm run typecheck`가 통과하거나, 실패 시 기존 오류와 신규 오류를 구분해 보고한다.

---

## SCA-02 - 미수금/과입금 경고

### 목표

`receivableService.getReceivables()`를 사용해 미수금과 과입금 경고를 경고센터에 표시한다.

### 주요 파일

- `src/services/receivableService.ts`
- `src/features/settlement-alerts/settlementAlertRules.ts`
- `src/features/settlement-alerts/settlementAlertRules.test.ts`
- `src/services/settlementAlertService.ts`
- `src/pages/settlement/SettlementAlertCenterPage.tsx`

### 자율개발 프롬프트

```text
SCA-01 결과 위에서 정산 경고센터에 미수금/과입금 경고를 붙여줘.

범위:
- receivableService.getReceivables()만 사용한다.
- 차량, 숙소, 카드, 경비, 지원공수는 아직 구현하지 않는다.
- 미수금 원본 데이터는 수정하지 않는다.

구현:
- src/features/settlement-alerts/settlementAlertRules.ts 생성 또는 확장
- 미수금 규칙 함수 작성
  - status가 미수, 부분수납이면 receivable 경고
  - status가 과입금이거나 outstandingAmount < 0이면 overpaid 경고
  - outstandingAmount가 큰 경우 high 또는 critical
  - 오래된 미수는 high 또는 critical
- src/services/settlementAlertService.ts 생성
  - getAlerts({ yearMonth })에서 미수금 경고 반환
- SettlementAlertCenterPage에서 실제 경고 목록 표시
- actionUrl은 기존 미수금 관리 화면으로 연결

타입:
- SettlementAlert.direction은 receivable 또는 payable 또는 neutral 중 하나를 사용한다.
- 미수금은 receivable, 과입금은 payable 또는 neutral 중 기존 화면 문맥에 맞는 값으로 둔다.
- alert id는 deterministic 해야 한다.

테스트:
- settlementAlertRules.test.ts 작성
- 미수, 부분수납, 과입금 변환 테스트
- deterministic id 테스트

검증:
- 관련 테스트 실행
- 가능한 경우 npm run typecheck 실행
- 작업 결과를 한국어로 보고한다.
```

### 완료 기준

- 경고센터에서 미수금/과입금 경고가 보인다.
- 금액, 업체명, 상태, 원본 화면 이동 링크가 표시된다.
- 경고 id가 재계산해도 안정적으로 유지된다.

---

## SCA-03 - 경비 후청구 경고

### 목표

`team_expense_claims` 기반으로 경비 후청구 미확정, 청구 대상 누락, 금액 이상 경고를 추가한다.

### 주요 파일

- `src/services/teamExpenseLedgerService.ts`
- `src/types/teamExpenseLedger.ts`
- `src/features/settlement-alerts/settlementAlertRules.ts`
- `src/services/settlementAlertService.ts`
- `src/pages/settlement/SettlementAlertCenterPage.tsx`

### 자율개발 프롬프트

```text
SCA-02 결과 위에서 정산 경고센터에 경비 후청구 경고를 추가해줘.

범위:
- team_expense_claims 기반 경고만 추가한다.
- 기존 경비 데이터를 수정하지 않는다.
- 미수금 경고는 그대로 유지한다.

구현:
- teamExpenseLedgerService 또는 기존 Firestore 조회 방식을 확인한다.
- yearMonth 기준 team_expense_claims를 조회한다.
- draft 상태는 unconfirmed_billing 경고로 만든다.
- chargeToTeamId가 필요한 유형인데 비어 있으면 data_gap 경고로 만든다.
- amount가 0 또는 비정상 값이면 amount_anomaly 경고로 만든다.
- actionUrl은 /support/expense-claims 로 연결한다.
- 기존 미수금 경고와 합쳐서 표시한다.

테스트:
- draft 경비가 경고로 변환되는지 테스트
- 청구 대상 누락 경고가 생성되는지 테스트
- amount 이상값 경고 테스트

검증:
- 관련 테스트 실행
- 가능한 경우 npm run typecheck 실행
- 작업 결과를 한국어로 보고한다.
```

### 완료 기준

- 경비 후청구 draft와 데이터 누락이 경고센터에 나타난다.
- 원본 경비 화면으로 이동할 수 있다.
- 기존 미수금 경고가 깨지지 않는다.

---

## SCA-04 - 차량/카드/숙소 미확정 청구 경고

### 목표

이미 존재하는 차량, 카드, 숙소 청구 문서 중 미확정 상태를 경고로 표시한다.

### 주요 파일

- `src/services/vehicleBillingService.ts`
- `src/services/cardBillingService.ts`
- `src/services/accommodationBillingService.ts`
- `src/types/vehicleBilling.ts`
- `src/types/cardBilling.ts`
- `src/types/accommodationBilling.ts`
- `src/features/settlement-alerts/settlementAlertRules.ts`
- `src/services/settlementAlertService.ts`

### 자율개발 프롬프트

```text
SCA-03 결과 위에서 정산 경고센터에 차량, 카드, 숙소의 “기존 청구 문서 미확정” 경고를 추가해줘.

중요:
- 이번 단계에서는 “청구서 미생성 추정”은 하지 않는다.
- 이미 존재하는 청구 문서 중 draft/unconfirmed 상태만 경고한다.
- 원본 청구 문서는 수정하지 않는다.

구현:
- vehicleBillingService, cardBillingService, accommodationBillingService의 문서 조회 방식을 확인한다.
- yearMonth 기준 청구 문서를 조회한다.
- confirmed, paid, overdue 계열 상태가 아니면 unconfirmed_billing 경고 생성
- domain은 vehicle, card, accommodation을 사용한다.
- actionUrl:
  - vehicle: /support/vehicles/logs
  - card: /support/cards/logs
  - accommodation: /support/accommodation/logs
- totalAmount가 있으면 amount에 표시한다.
- 기존 미수금, 경비 경고와 합쳐서 표시한다.

테스트:
- draft 차량 청구 문서 경고
- draft 카드 청구 문서 경고
- draft 숙소 청구 문서 경고

검증:
- 관련 테스트 실행
- 가능한 경우 npm run typecheck 실행
- 작업 결과를 한국어로 보고한다.
```

### 완료 기준

- 차량/카드/숙소 미확정 청구가 도메인별로 구분되어 보인다.
- 각 경고는 관련 로그/관리 화면으로 이동할 수 있다.
- 미생성 추정 경고는 아직 만들지 않는다.

---

## SCA-06 - 경고 상태 저장

### 목표

사용자가 경고를 `확인`, `보류`, `해결` 처리할 수 있게 하고, 상태를 `settlement_alert_states`에 저장한다.

### 주요 파일

- `src/services/settlementAlertService.ts`
- `src/pages/settlement/SettlementAlertCenterPage.tsx`
- `firestore.rules`

### 자율개발 프롬프트

```text
SCA-04 결과 위에서 정산 경고센터에 경고 상태 저장 기능을 추가해줘.

목표:
- 사용자가 경고를 확인/보류/해결 처리할 수 있게 한다.
- 원본 정산 데이터는 수정하지 않는다.

구현:
- Firestore 컬렉션 settlement_alert_states 사용
- 상태:
  - open
  - acknowledged
  - snoozed
  - resolved
- settlementAlertService에 추가:
  - getAlertStates(yearMonth)
  - updateAlertState(alertId, patch)
  - 계산된 경고와 저장된 상태 merge
- UI 액션:
  - 확인 처리
  - 보류
  - 해결 처리
- 기본 필터에서는 resolved를 숨기고, “해결됨 포함” 토글 제공
- 상태 변경 시 사용자 이름, uid, updatedAt을 저장한다.

Firestore rules:
- settlement_alert_states 추가
- read: 정산/재무/지원/관리자 권한
- create/update: 정산/재무/지원/관리자 권한
- delete: 관리자만 또는 금지
- 원본 정산 컬렉션 규칙은 건드리지 않는다.

테스트:
- 상태 저장 payload 생성 또는 merge 로직 테스트
- resolved 상태가 기본 목록에서 제외 가능한지 테스트

검증:
- 관련 테스트 실행
- 가능한 경우 npm run typecheck 실행
- 작업 결과를 한국어로 보고한다.
```

### 완료 기준

- 경고별 상태 변경이 가능하다.
- 새로고침 후에도 확인/보류/해결 상태가 유지된다.
- 해결된 경고를 기본 목록에서 숨길 수 있다.

---

## SCA-08 - UI 마감과 대시보드 연결

### 목표

경고센터를 실제 운영자가 반복해서 쓰기 좋은 화면으로 정리하고 대시보드/빠른 실행에서 진입할 수 있게 한다.

### 주요 파일

- `src/pages/settlement/SettlementAlertCenterPage.tsx`
- `src/components/dashboard/*`
- `src/components/dashboard/useQuickMenuActions.ts`
- `src/constants/menuPaths.ts`

### 자율개발 프롬프트

```text
SCA-06 결과 위에서 정산 경고센터 UI를 실제 운영 화면처럼 정리하고 대시보드 진입 링크를 추가해줘.

구현:
- 요약 카드:
  - 전체 경고
  - 받을 돈
  - 내야 할 돈
  - 고위험
  - 미생성/미확정 청구
- 필터:
  - 전체
  - 고위험
  - 받을 돈
  - 내야 할 돈
  - 미생성/미확정
  - 해결됨 포함
  - domain 선택
- 테이블 컬럼:
  - 심각도
  - 구분
  - 제목
  - 현장/팀/업체
  - 금액
  - 상태
  - 액션
- 대시보드 또는 빠른 실행에 “정산 경고센터” 진입 링크 추가
- 모바일에서는 표가 깨지지 않도록 카드형 또는 stacked 레이아웃을 제공한다.

디자인:
- ERP 운영 화면답게 조용하고 밀도 있게 만든다.
- 카드 안에 카드를 중첩하지 않는다.
- 텍스트가 버튼/표 셀 밖으로 넘치지 않게 한다.
- 단일 색상 계열만으로 화면 전체를 채우지 않는다.

검증:
- 가능한 경우 npm run typecheck 실행
- 가능하면 화면을 열어 레이아웃을 수동 확인한다.
- 작업 결과를 한국어로 보고한다.
```

### 완료 기준

- 운영자가 월별 경고를 필터링하고 처리 상태를 변경할 수 있다.
- 모바일/데스크톱에서 텍스트 겹침 없이 보인다.
- 대시보드 또는 빠른 실행에서 경고센터로 접근할 수 있다.

---

## SCA-05 - 지원공수/지원청구 이슈 경고

### 목표

`supportClaimService` 계산 결과의 `issues`를 정산 경고로 변환한다.

### 주요 파일

- `src/services/supportClaimService.ts`
- `src/utils/supportSettlementBilling.ts`
- `src/features/settlement-alerts/settlementAlertRules.ts`
- `src/services/settlementAlertService.ts`

### 자율개발 프롬프트

```text
SCA-08까지 완료된 상태에서 정산 경고센터에 지원공수/지원청구 이슈 경고를 추가해줘.

범위:
- supportClaimService의 계산 결과와 issues를 경고로 변환한다.
- 실제 청구서 생성/수정은 하지 않는다.
- 오탐 가능성이 있으므로 설명에 근거를 명확히 표시한다.

구현:
- supportClaimService 사용 방식을 확인한다.
- yearMonth 기준 지원청구 결과를 로드한다.
- issues를 SettlementAlert로 변환한다.
  - MISSING_UNIT_PRICE -> high
  - MISSING_COUNTERPARTY -> high
  - MISSING_ID_NUMBER -> medium
  - MISSING_ADDRESS -> medium
- domain: support
- direction: receivable 또는 neutral
- actionUrl: /payroll/support-claim 또는 /support/status
- description에 작업자, 업체, 팀, 현장, 누락 사유를 포함한다.

테스트:
- supportClaim issue가 경고로 변환되는지 테스트
- severity 매핑 테스트
- deterministic id 테스트

검증:
- 관련 테스트 실행
- 가능한 경우 npm run typecheck 실행
- 작업 결과를 한국어로 보고한다.
```

### 완료 기준

- 지원청구 이슈가 경고센터에 표시된다.
- 누락 사유와 연결 화면이 명확하다.
- 오탐 가능성이 있는 항목은 critical로 과장하지 않는다.

---

## SCA-07 - 청구서 미생성 추정 경고

### 목표

사용내역은 있는데 청구 문서가 없는 상황을 추정 경고로 표시한다.

### 주요 파일

- `src/services/vehicleService.ts`
- `src/services/vehicleBillingService.ts`
- `src/services/cardService.ts`
- `src/services/cardBillingService.ts`
- `src/services/accommodationService.ts`
- `src/services/accommodationBillingService.ts`
- `src/features/settlement-alerts/settlementAlertRules.ts`
- `src/services/settlementAlertService.ts`

### 자율개발 프롬프트

```text
SCA-05까지 완료된 상태에서 정산 경고센터에 “청구서 미생성 추정” 경고를 추가해줘.

중요:
- 이 단계는 오탐 가능성이 높으므로 기존 경고센터가 안정화된 뒤 진행한다.
- 실제 청구서 생성은 하지 않는다.
- 데이터가 애매하면 critical이 아니라 medium/data_gap으로 표시한다.
- description에 추정 근거를 반드시 표시한다.

구현:
- 차량:
  - 해당 월 배정/사용/비용 데이터는 있는데 vehicle_billing_documents가 없으면 missing_billing
- 카드:
  - 해당 월 카드 거래내역은 있는데 card billing 문서가 없으면 missing_billing
- 숙소:
  - 해당 월 숙소 배정/라인아이템 후보는 있는데 accommodation billing 문서가 없으면 missing_billing
- 각 도메인별로 dedupeKey를 안정적으로 만든다.
- 청구 문서가 이미 있으면 같은 대상의 missing_billing 경고는 만들지 않는다.

테스트:
- 사용내역 있음 + 청구문서 없음 => missing_billing
- 청구문서 있음 => 경고 없음
- source id 없는 경우도 deterministic id 유지
- 애매한 데이터는 medium/data_gap으로 생성되는지 확인

검증:
- 관련 테스트 실행
- 가능한 경우 npm run typecheck 실행
- 작업 결과를 한국어로 보고한다.
```

### 완료 기준

- 차량/카드/숙소 미생성 추정 경고가 보인다.
- 기존 미확정 경고와 중복되지 않는다.
- 추정 근거가 화면에 표시된다.

---

## 전체 완료 기준

- `/settlement/alerts`에서 월별 경고를 확인할 수 있다.
- 최소 도메인 `tax`, `expense`, `vehicle`, `card`, `accommodation` 경고가 표시된다.
- 경고 상태 저장이 동작한다.
- 원본 정산/청구/미수금 데이터는 자동 수정되지 않는다.
- 관련 테스트와 타입체크 결과가 보고되어 있다.
