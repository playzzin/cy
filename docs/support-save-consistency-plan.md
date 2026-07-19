# 지원자산 저장 일관성 개선 계획

## 목적

지원자산 화면의 저장 로직에서 일부 저장 실패, 중복 실행, 확정 문서 덮어쓰기, 권한 누락, 동시 수정으로 원장/청구/정산 데이터가 서로 불일치할 수 있는 지점을 정리하고, 코드 동작 변경 없이 순차 개선 계획을 정의한다.

대상 업무 흐름은 차량, 카드, 숙소, 후청구 저장이다. 최우선 목표는 기능 추가가 아니라 저장 실패 시 기존 데이터가 유실되지 않도록 만드는 것이다.

## 분석 대상

- `src/components/vehicle/VehicleMonthlyLedger.tsx`
- `src/components/card/CardMonthlyLedger.tsx`
- `src/components/accommodation/UtilityLedger.tsx`
- `src/services/vehicleBillingService.ts`
- `src/services/cardBillingService.ts`
- `src/services/accommodationBillingService.ts`
- `src/services/teamExpenseLedgerService.ts`

관련 권한/컬렉션 확인 대상:

- `firestore.rules`
- `src/security/erpAccessPolicy.ts`
- `src/constants/collectionConfig.ts`

## 현재 저장 흐름 요약

### 차량 월원장

`VehicleMonthlyLedger`의 `handleSave`는 현재 화면에 보이는 차량/기간 범위의 기존 지출을 삭제한 뒤 새 지출을 생성하고, 이어서 관련 청구문서를 저장 또는 삭제한다.

주요 흐름:

1. `originalExpensesRef.current`에서 보이는 범위의 지출을 골라 삭제한다.
2. 현재 행의 금액을 기준으로 새 지출을 생성한다.
3. 기존 청구문서와 새 청구문서를 비교해 저장/삭제 작업을 만든다.
4. `Promise.all`로 청구문서 저장과 삭제를 한 번에 실행한다.

문제 지점:

- `deleteExpense` 실패는 `catch`로 경고만 남기고 저장을 계속한다.
- 기존 지출 삭제 후 새 지출 생성이 실패하면 지출 원장이 부분 유실될 수 있다.
- 청구문서 저장/삭제가 원장 저장과 원자적으로 묶이지 않는다.
- 청구문서 삭제 후 새 문서 저장 실패 또는 반대 순서 실패 시 원장과 청구문서가 불일치할 수 있다.
- `CONFIRMED`, `PAID`, `OVERDUE` 문서를 일반 월원장 저장으로 덮어쓰거나 삭제할 수 있는 구조다.

### 카드 월원장

`CardMonthlyLedger`의 `handleSave`는 기존 카드 거래를 전부 삭제하고 현재 행 기준으로 새 거래를 생성한 뒤, 카드 청구문서를 동기화한다.

주요 흐름:

1. `originalTxsRef.current`의 기존 거래를 삭제한다.
2. 현재 행의 카테고리 금액을 기준으로 새 거래를 생성한다.
3. 관련 청구문서를 저장하거나 삭제한다.

문제 지점:

- 기존 거래 삭제 후 새 거래 생성 중 실패하면 카드 거래 원장이 부분 유실될 수 있다.
- 거래 저장과 청구문서 저장이 별도 작업이다.
- `saveCardLedgerBillingDocument`는 새 청구문서를 저장한 뒤 stale 문서를 삭제한다. stale 삭제 실패 시 중복 청구문서가 남을 수 있다.
- 확정 청구문서 보호가 서비스 레벨에 없다.

### 숙소 공과금 원장

`UtilityLedger`는 공과금 원장 자체는 `accommodationService.saveUtilityRecords` 또는 `saveUtilityRecord`로 저장하고, 청구 처리 시 숙소 청구문서를 upsert하거나 삭제한다.

주요 흐름:

1. 원장 행 저장.
2. 원장 행의 금액을 line item으로 변환.
3. 같은 행에서 파생된 기존 line item을 다른 문서에서 제거.
4. 새 문서 또는 기존 문서에 line item을 병합해 upsert.
5. 확정 시 `confirmAndPostToAdvancePayment`로 선지급/공제에 반영.

문제 지점:

- `accommodationBillingService.upsertBillingDocument`가 청구문서 저장 후 기존 line item 전체를 삭제하고 새로 생성한다.
- line item 삭제와 생성이 트랜잭션이 아니므로 중간 실패 시 청구서 본문은 저장됐지만 상세 항목이 비거나 일부만 남을 수 있다.
- `confirmAndPostToAdvancePayment`는 청구 확정과 선지급 공제 생성/수정이 여러 단계로 나뉘어 있어 중간 실패 시 확정 상태와 공제 반영 상태가 어긋날 수 있다.
- `cancelConfirmation`은 공제 되돌림 후 청구문서를 draft로 돌린다. 되돌림 실패를 완전히 원자적으로 막지 못한다.
- 확정 숙소 청구서에 대한 일반 upsert 차단이 약하다.

### 후청구 저장

`teamExpenseLedgerService`는 `team_expense_claims` 컬렉션에 `setDoc(..., { merge: true })`로 후청구를 저장한다.

문제 지점:

- `team_expense_claims`는 실제 서비스에서 사용하지만 Firestore rules와 ERP 접근 정책에는 `team_expense_ledgers`만 등록되어 있다.
- `saveClaim`은 `merge: true`라서 상태별 수정 제한 없이 필드가 덮어써질 수 있다.
- `deleteClaim`은 물리 삭제다. 정산 반영 또는 첨부 삭제 중 일부 실패 시 복구 단서가 부족하다.
- `updateClaimStatus`는 상태 변경 이력은 남기지만, 기존 상태와 허용 전이 검증이 없다.

## 위험도 순위

### 1. 데이터 유실

가장 높은 위험이다.

대표 케이스:

- 차량 월원장에서 기존 지출 삭제 후 새 지출 생성 실패.
- 카드 월원장에서 기존 거래 삭제 후 새 거래 생성 실패.
- 숙소 청구서 line item 전체 삭제 후 새 line item 생성 실패.
- 후청구 삭제 시 첨부 삭제와 문서 삭제 중 일부만 성공.

영향:

- 원장 금액이 사라지거나 일부만 남는다.
- 청구문서 합계와 원장 합계가 맞지 않는다.
- 정산서가 잘못 생성될 수 있다.

개선 방향:

- 삭제 후 재생성 금지.
- upsert + soft delete/cancel 처리로 전환.
- 저장 전 전체 검증, 저장 후 결과 검증 추가.
- 업무 단위 mutation service에서 한 번에 처리.

### 2. 중복 생성

두 번째 위험이다.

대표 케이스:

- 저장 버튼 중복 클릭.
- 네트워크 재시도.
- 청구문서 저장 성공 후 stale 문서 삭제 실패.
- deterministic id가 없는 지출/거래 생성.

영향:

- 같은 비용이 두 번 청구된다.
- 경비내역 합계가 실제보다 커진다.
- 정산 문서와 세금계산 원장까지 오염될 수 있다.

개선 방향:

- `operationId` 도입.
- 원장 행/기간/카테고리 기반 deterministic id 도입.
- 중복 실행 시 같은 문서를 upsert하도록 변경.
- 저장 작업 로그에 operation 상태 기록.

### 3. 확정문서 덮어쓰기

세 번째 위험이다.

대표 케이스:

- 월원장 저장이 기존 `CONFIRMED`, `PAID`, `OVERDUE` 청구문서의 금액/lineItems를 다시 계산해 덮어씀.
- 미청구 처리에서 확정 청구문서를 바로 삭제.
- 숙소 확정 문서를 일반 `upsertBillingDocument`로 수정.

영향:

- 이미 정산 반영된 금액이 silently 변경된다.
- 로그는 남을 수 있어도 업무상 승인 흐름이 깨진다.
- 월마감 이후 과거 정산이 바뀔 수 있다.

개선 방향:

- 서비스 레벨에서 posted 문서 수정/삭제 차단.
- 확정 취소 전용 API만 허용.
- 취소 사유, 작업자, 시간, before/after 로그 필수화.
- 일괄 저장 중 확정문서 충돌 시 전체 차단 또는 행별 skipped 정책 명시.

### 4. 권한 오류

네 번째 위험이다.

대표 케이스:

- `teamExpenseLedgerService`는 `team_expense_claims`를 쓰지만 권한 정책은 `team_expense_ledgers`를 지원 컬렉션으로 등록한다.
- 운영 환경에서 후청구 저장/조회가 fallback 규칙에 의존하거나 차단될 수 있다.

영향:

- 특정 역할에서 후청구 저장이 실패한다.
- 개발 환경에서는 되지만 운영 배포 후 실패할 수 있다.
- 실패 시 사용자는 저장 실패만 보고 원인을 알기 어렵다.

개선 방향:

- `team_expense_claims`를 Firestore rules, ERP 접근 정책, collection config에 명시.
- `team_expense_ledgers`와의 관계를 정리한다.
- 보안 정책 테스트에 실제 컬렉션명을 포함한다.

### 5. 동시수정 충돌

다섯 번째 위험이다.

대표 케이스:

- 두 사용자가 같은 월원장 또는 같은 청구문서를 동시에 편집.
- 나중 저장이 먼저 저장된 내용을 덮어씀.
- `updatedAt`은 저장하지만 읽은 버전과 현재 버전 비교가 없다.

영향:

- 한 사용자의 수정이 사라진다.
- 청구문서 lineItems가 오래된 화면 상태로 되돌아간다.

개선 방향:

- 저장 요청에 `baseUpdatedAt` 또는 revision을 포함한다.
- 현재 문서 revision과 다르면 conflict 결과를 반환한다.
- 충돌 시 UI에서 새로고침/병합/강제저장 선택을 분리한다.

## 개선 원칙

1. 화면 컴포넌트는 저장 순서를 직접 제어하지 않는다.
2. 업무 단위 mutation service가 검증, next state 계산, 저장, 로그, 결과 반환을 책임진다.
3. 기존 데이터는 먼저 삭제하지 않는다.
4. 물리 삭제는 마지막 선택지로 두고, 가능한 경우 `cancelled`, `inactive`, `deletedAt` 등으로 soft delete한다.
5. 확정/정산 반영 문서는 일반 저장 경로에서 수정하지 않는다.
6. 저장 작업은 `operationId`로 추적하고 같은 요청을 재실행해도 결과가 중복되지 않아야 한다.
7. 실패 결과는 `processed`, `skipped`, `failed`, `conflicts`처럼 데이터로 반환한다.
8. 화면은 성공/실패 건수를 사용자에게 보여주고, 내부 로그에는 원인과 문서 ID를 남긴다.

## 목표 저장 아키텍처

### Mutation service 구조

도메인별로 다음 형태의 mutation service를 둔다.

```ts
saveVehicleMonthlyLedgerMutation({
  yearMonth,
  rows,
  visibleScope,
  actor,
  operationId,
  baseSnapshotVersion
})
```

서비스 내부 순서:

1. 입력 정규화.
2. 기존 원장/청구문서/상태 조회.
3. 저장 전 검증.
4. desired state 계산.
5. 변경 계획 생성.
6. 확정문서 충돌 검사.
7. batch/transaction 또는 순차 커밋 전략 실행.
8. operation log 기록.
9. 결과 반환.

결과 타입 예시:

```ts
type SupportSaveResult = {
  operationId: string;
  status: 'committed' | 'partial' | 'failed' | 'blocked';
  processedCount: number;
  skippedCount: number;
  failedCount: number;
  conflictCount: number;
  messages: string[];
  affectedDocumentIds: string[];
};
```

### Operation log

저장 작업 단위 로그 컬렉션을 둔다. 새 컬렉션을 만들지 않기로 하면 기존 시스템 로그에 같은 구조를 넣는다.

권장 필드:

```ts
{
  id: operationId,
  domain: 'vehicle' | 'card' | 'accommodation' | 'expenseClaim',
  yearMonth,
  action,
  status: 'pending' | 'committed' | 'partial' | 'failed' | 'blocked',
  affectedDocumentIds,
  skippedDocumentIds,
  errorMessage,
  actorId,
  actorName,
  createdAt,
  updatedAt
}
```

## Phase별 구현 순서

### Phase 0. 기준선 문서화와 테스트 설계

범위:

- 이 문서를 기준으로 저장 불일치 개선 범위 확정.
- 현재 위험 구간에 대한 테스트 설계 작성.
- 코드 동작 변경 없음.

완료 기준:

- 위험도 순위가 문서화되어 있다.
- 차량, 카드, 숙소, 후청구별 개선 Phase가 정의되어 있다.
- 후속 작업이 독립 PR 또는 자율개발 작업으로 나뉘어 있다.

검증:

- 문서 변경만 있으므로 타입체크는 필수는 아니다.
- 후속 코드 작업부터 `npm run typecheck`와 관련 테스트를 실행한다.

### Phase 1. 차량 월원장 저장 로직 서비스 분리

범위:

- `VehicleMonthlyLedger`의 `handleSave`에서 저장 세부 절차를 제거한다.
- `vehicleMonthlyLedgerMutationService`를 만든다.
- 처음에는 기존 동작을 최대한 유지하고 구조만 분리한다.

완료 기준:

- 화면 컴포넌트는 mutation service를 호출하고 결과를 표시한다.
- 기존 UX와 저장 결과가 바뀌지 않는다.
- 저장 입력/결과 타입이 명확하다.
- 차량 저장 로직 단위 테스트를 추가할 수 있는 구조가 된다.

검증:

- `npm run typecheck`
- 차량 월원장 저장 관련 단위 테스트 또는 기존 관련 테스트.

### Phase 2. 차량 delete-create 제거와 idempotent 저장

범위:

- 차량 지출 저장을 삭제 후 생성에서 upsert + soft delete로 전환한다.
- 원장 행, 차량, 기간, 카테고리를 기준으로 deterministic id를 검토한다.
- `operationId`를 저장 경로에 추가한다.
- 청구문서 저장/삭제도 desired state 기반 upsert/cancel로 바꾼다.

완료 기준:

- 저장 중 실패해도 기존 지출이 먼저 사라지지 않는다.
- 같은 저장 요청을 두 번 실행해도 중복 지출/청구문서가 생기지 않는다.
- 필터 밖 데이터는 보존된다.
- 삭제 대상은 물리 삭제 대신 취소/비활성 처리된다.

검증:

- 기존 데이터가 있는 상태에서 생성 실패를 주입해도 기존 데이터가 보존되는 테스트.
- 같은 mutation을 2회 실행해도 문서 수가 늘지 않는 테스트.
- 필터 밖 데이터 보존 테스트.

### Phase 3. 차량 확정 청구문서 보호

범위:

- `vehicleBillingService.saveBilling`에서 posted 문서 수정 정책을 강제한다.
- `deleteBilling`은 posted 문서 삭제를 기본 차단한다.
- 확정 취소 전용 action 또는 API를 분리한다.

완료 기준:

- `CONFIRMED`, `PAID`, `OVERDUE` 문서는 일반 저장으로 금액/lineItems가 바뀌지 않는다.
- 확정 취소는 사유와 actor를 요구한다.
- 월원장 저장 중 posted 문서 충돌이 결과에 `skipped` 또는 `blocked`로 표현된다.

검증:

- posted 문서 수정 차단 테스트.
- draft 문서 정상 수정 테스트.
- 일괄 저장 중 posted 문서 충돌 처리 테스트.

### Phase 4. 카드 월원장에 차량 패턴 적용

범위:

- `CardMonthlyLedger`의 삭제 후 생성 저장을 제거한다.
- `cardMonthlyLedgerMutationService`를 만든다.
- 카드 거래와 카드 청구문서 모두 idempotent 저장으로 전환한다.
- 카드 청구문서 posted 보호를 서비스 레벨에 추가한다.

완료 기준:

- 카드 거래 저장 중 일부 실패로 기존 거래가 유실되지 않는다.
- stale 청구문서는 물리 삭제보다 cancel/비활성 처리를 우선한다.
- 차량과 카드의 mutation 결과 타입이 일관된다.

검증:

- 거래 생성 실패 주입 테스트.
- 중복 실행 방지 테스트.
- posted 카드 청구문서 보호 테스트.

### Phase 5. 숙소 청구 line item diff 저장

범위:

- `accommodationBillingService.upsertBillingDocument`의 line item 전체 삭제 후 재생성을 제거한다.
- 기존 line item과 다음 line item을 비교해 create/update/delete 또는 cancel 대상을 계산한다.
- 관련 없는 line item은 보존한다.
- 확정 청구문서에 대한 일반 upsert를 차단한다.

완료 기준:

- 특정 원장 행의 line item만 변경해도 다른 행/문서의 line item이 보존된다.
- line item 저장 중 실패해도 기존 상세 항목이 먼저 비워지지 않는다.
- confirmed 숙소 청구서는 전용 취소 절차 없이는 수정되지 않는다.

검증:

- line item 일부 변경 테스트.
- 저장 실패 시 기존 항목 보존 테스트.
- confirmed 문서 수정 차단 테스트.

### Phase 6. 숙소 확정/공제 반영 원자성 개선

범위:

- `confirmAndPostToAdvancePayment`와 `cancelConfirmation`의 중간 실패 가능성을 줄인다.
- 클라이언트에서 안전하게 처리하기 어려운 경우 Cloud Function 또는 서버 mutation으로 이동한다.
- 확정 상태와 `postedAdvancePaymentId`의 불일치 복구 절차를 정의한다.

완료 기준:

- 청구 확정과 선지급 공제 반영의 성공/실패 상태가 operation log에 남는다.
- 공제 반영 실패 시 청구문서가 확정으로 남는지, draft로 되돌리는지 정책이 명확하다.
- 취소 실패 시 복구 가능한 상태와 메시지가 남는다.

검증:

- 공제 생성 실패 주입 테스트.
- 확정 취소 실패 주입 테스트.
- operation log 상태 테스트.

### Phase 7. 후청구 컬렉션/권한/상태 정책 정리

범위:

- `team_expense_claims`를 Firestore rules, ERP access policy, collection config에 반영한다.
- `team_expense_ledgers`와의 관계를 정리한다.
- `saveClaim`, `deleteClaim`, `updateClaimStatus`에 상태별 허용 정책을 추가한다.

완료 기준:

- 실제 사용 컬렉션이 권한 정책에 명시되어 있다.
- `settled` 후청구는 일반 저장/삭제로 수정되지 않는다.
- 상태 전이가 허용된 방향으로만 가능하다.
- 후청구 삭제는 물리 삭제 대신 취소/비활성 처리 가능성을 우선 검토한다.

검증:

- 보안 정책 테스트.
- 상태 전이 테스트.
- settled 문서 수정 차단 테스트.

### Phase 8. 공통 operation log와 재시도 체계

범위:

- 차량/카드/숙소/후청구 저장 mutation에 공통 operation log를 붙인다.
- 저장 실패 시 재시도 가능한 작업과 수동 복구가 필요한 작업을 구분한다.
- UI는 단순 alert 대신 결과 요약을 표시한다.

완료 기준:

- 각 저장 작업이 operationId로 추적된다.
- 실패한 작업의 domain, yearMonth, action, affected ids, error가 남는다.
- 같은 operationId 재실행 시 중복 생성되지 않는다.

검증:

- operation log 생성 테스트.
- 중복 operationId 재실행 테스트.
- partial/failed 상태 표시 테스트.

### Phase 9. 통합 검증과 운영 runbook

범위:

- 저장 안정화 이후 전체 흐름을 검증한다.
- 운영 대응 문서를 작성한다.

완료 기준:

- `docs/support-save-consistency-runbook.md`에 장애 대응 방법이 있다.
- 차량/카드/숙소/후청구 저장 실패 시나리오가 테스트 또는 수동 검증 절차로 정리되어 있다.
- 남은 리스크가 문서화되어 있다.

검증:

- `npm run typecheck`
- 관련 단위 테스트.
- 가능한 경우 `npm test -- --watchAll=false`.

## 우선 작업 큐

1. 차량 월원장 저장 서비스 분리.
2. 차량 지출 delete-create 제거.
3. 차량 청구문서 posted 보호.
4. 카드 월원장에 같은 패턴 적용.
5. 숙소 line item 전체 삭제/재생성 제거.
6. 숙소 확정/공제 반영 원자성 개선.
7. 후청구 컬렉션 권한 정리.
8. operation log와 재시도 체계 추가.
9. 통합 runbook 작성.

## 자율개발 실행 지침

각 Phase는 독립 작업으로 실행한다. 한 작업에서 다음 Phase를 같이 구현하지 않는다.

공통 지침:

- 작업 전 관련 파일을 먼저 읽는다.
- 사용자 변경사항은 되돌리지 않는다.
- 범위 밖 리팩터링은 하지 않는다.
- 저장 로직은 데이터 유실 방지를 최우선으로 한다.
- 코드 변경 후 `npm run typecheck`와 관련 테스트를 실행한다.
- 검증하지 못한 항목은 이유와 남은 리스크를 남긴다.

작업 완료 보고에는 다음을 포함한다.

- 변경 파일.
- 저장 불일치 위험이 어떻게 줄었는지.
- 실패 시 기존 데이터 보존 여부.
- 실행한 검증.
- 다음 Phase에서 해야 할 일.

