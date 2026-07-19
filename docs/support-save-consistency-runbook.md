# 지원자산 저장 안정화 검증 Runbook

## 목적

지원자산 저장 중 일부 단계가 실패해도 기존 데이터가 유실되지 않는지 확인하고, 실패 원인과 영향 문서를 `support_write_operations`에서 추적한다.

## 공통 추적 기준

- 컬렉션: `support_write_operations`
- 문서 ID: `{domain}__{operationId}` 형식의 deterministic id
- 필수 필드: `domain`, `yearMonth`, `operationId`, `status`, `affectedDocumentIds`, `errorMessage`, `actor`, `createdAt`
- 상태:
  - `success`: 저장 서비스가 정상 완료됨
  - `failed`: 저장 서비스가 실패했고 사용자는 같은 화면에서 재시도 가능
- 사용자 메시지는 재시도 안내만 표시한다.
- 내부 원인은 `errorMessage`, `affectedDocumentIds`, console/Sentry context에서 확인한다.

## 검증 시나리오

### 1. 차량 월원장 저장 중 청구문서 저장 실패

절차:

1. `saveVehicleMonthlyLedgerMutation`에서 `applyExpenseChanges`는 성공하게 둔다.
2. `saveBilling`을 실패하도록 주입한다.
3. 같은 `operationId`로 다시 저장한다.

기대 결과:

- 기존 차량 지출은 삭제되지 않고 deterministic id upsert/cancel 상태만 남는다.
- 실패 로그가 `domain=vehicle`, `status=failed`로 기록된다.
- `affectedDocumentIds`에 지출 id와 시도한 청구문서 id가 포함된다.
- 재시도 시 같은 지출/청구문서 id를 사용해 중복 생성되지 않는다.

### 2. 카드 월원장 저장 중 거래 일부 실패

절차:

1. `saveCardMonthlyLedgerMutation`에서 `applyTransactionChanges`가 실패하도록 주입한다.
2. 청구문서 저장 호출 여부를 확인한다.

기대 결과:

- 거래 batch가 실패하면 청구문서 저장은 실행되지 않는다.
- 실패 로그가 `domain=card`, `status=failed`로 기록된다.
- `affectedDocumentIds`에 시도한 거래 upsert/cancel id가 포함된다.
- 사용자는 같은 화면에서 재시도할 수 있는 메시지만 본다.

### 3. 숙소 청구 line item 일부 변경

절차:

1. 기존 line item 여러 개를 둔다.
2. 일부 항목의 금액만 변경한다.
3. 새 항목 생성 실패를 주입한다.

기대 결과:

- 관련 없는 기존 line item은 삭제되지 않는다.
- 새 항목 생성 실패 시 기존 항목을 cancelled로 바꾸지 않는다.
- 실패 로그가 `domain=accommodation`, `status=failed`로 기록된다.
- 성공 시 `affectedDocumentIds`에 청구서 id와 line item id가 포함된다.

### 4. confirmed 문서가 포함된 일괄 저장

절차:

1. 차량/카드 월원장에 `CONFIRMED`, `PAID`, `OVERDUE` 청구문서를 포함한다.
2. 같은 배치에 DRAFT 문서 행도 포함한다.

기대 결과:

- posted 문서가 있는 행은 skipped로 반환된다.
- 안전한 행은 저장된다.
- operation log `metadata.skippedBillingRows`에서 skipped 행과 문서 id를 확인할 수 있다.
- posted 문서의 금액과 line item은 변경되지 않는다.

### 5. 후청구 권한 정책

절차:

1. ERP access policy에서 `team_expense_claims`를 조회한다.
2. Firestore rules의 지원자산 컬렉션 목록에 포함됐는지 확인한다.
3. 일반 사용자와 지원/사무/관리 역할의 접근 결과를 비교한다.

기대 결과:

- `team_expense_claims`는 support collection으로 분류된다.
- 일반 사용자는 읽기/쓰기 불가다.
- admin, office, support 역할은 쓰기 가능하다.
- `team_expense_ledgers`는 레거시 정책 명칭으로만 남는다.

### 6. 같은 저장 요청 재실행

절차:

1. 차량/카드 월원장을 같은 `operationId`로 2회 저장한다.
2. 후청구 `saveClaim`을 같은 `operationId`로 2회 저장한다.

기대 결과:

- 차량 지출 id, 카드 거래 id, 후청구 문서 id가 동일하다.
- `support_write_operations`는 같은 operation 문서를 merge/upsert한다.
- 중복 지출/거래/후청구 문서가 생성되지 않는다.

## 남은 리스크와 대응

| 리스크 | 영향 | 운영 대응 |
| --- | --- | --- |
| 클라이언트에서 여러 컬렉션을 순차 저장 | 일부 단계 성공 후 후속 단계 실패 가능 | `support_write_operations`에서 `failed`와 `affectedDocumentIds` 확인 후 같은 화면에서 재시도 |
| operation log 저장 자체 실패 | 본 저장은 성공했지만 추적 문서가 없을 수 있음 | console/Sentry context 확인, 필요 시 동일 조건 재저장으로 log 재생성 |
| 숙소 확정/선지급 공제는 여전히 다단계 | 확정 성공 후 선지급 반영 실패 가능 | `docs/accommodation-billing-server-mutation-candidates.md`의 Cloud Function mutation으로 이관 |
| 수동 후청구가 operationId 없이 완전히 같은 내용으로 2건 필요 | fingerprint id가 같은 문서로 합쳐질 수 있음 | UI에서 form 생성 시 operationId를 명시적으로 생성해 전달 |
| 권한 정책은 문자열/단위 테스트 중심 | 실제 Firebase emulator 검증은 별도 필요 | 배포 전 emulator rules test 또는 staging 계정으로 smoke test |

## 운영 조회 예시

- 특정 작업 확인: `support_write_operations/{domain}__{operationId}`
- 월별 실패 확인: `domain`, `yearMonth`, `status=failed` 조건으로 조회
- 영향 문서 확인: `affectedDocumentIds`
- 사용자 안내: 화면에는 재시도 메시지만 표시하고, 내부 원인은 `errorMessage`와 Sentry/console context로 확인

## 현재 자동 검증

- 차량 월원장: deterministic id, 실패 시 청구 저장 차단, posted 문서 skip, operation log success/failed
- 카드 월원장: deterministic id, 거래 batch 실패 시 청구 저장 차단, posted 문서 skip, operation log success/failed
- 숙소 청구: line item diff, 실패 시 기존 항목 보존, confirmed 수정 차단
- 후청구: `team_expense_claims` 권한 정책, posted 상태 수정/삭제 차단, operationId deterministic id
