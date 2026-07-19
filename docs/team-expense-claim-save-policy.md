# 후청구 저장/권한 정책

## 컬렉션 기준

- 실제 저장 컬렉션은 `team_expense_claims`이다.
- `team_expense_ledgers`는 기존 ERP 접근 정책에서 쓰던 레거시 명칭으로만 유지한다.
- 신규 저장, 조회, 상태 변경 로직은 `team_expense_claims`만 사용한다.
- Firestore rules, ERP access policy, collection config는 `team_expense_claims`를 지원자산 컬렉션으로 명시한다.

## 저장 ID 전략

- 호출자가 `id`를 넘기면 기존 문서 편집으로 간주하고 해당 ID를 유지한다.
- 호출자가 `operationId`를 넘기면 `team-expense-claim__op__{operationId}` 형식의 deterministic id를 사용한다.
- `operationId`가 없고 자동 생성 근거가 있는 경우 source 기반 deterministic id를 사용한다.
- 그래도 근거가 없으면 주요 업무 필드의 fingerprint로 `team-expense-claim__auto__{hash}` ID를 만든다.
- 반복 저장이 같은 ID를 사용하므로 네트워크 재시도나 버튼 중복 클릭이 새 문서를 추가 생성하지 않는다.

## 상태별 수정/삭제 정책

| 상태 | 일반 saveClaim | updateClaimStatus | deleteClaim |
| --- | --- | --- | --- |
| `draft` | 업무 필드 수정 가능 | `charged`, `settled`로 전진 가능 | 물리 삭제 가능 |
| `charged` | 업무 필드 수정 금지. 동일 payload 재저장만 허용 | `settled`로 전진 가능 | 삭제 금지 |
| `settled` | 업무 필드 수정 금지. 동일 payload 재저장만 허용 | 동일 상태 재기록만 허용 | 삭제 금지 |

업무 필드는 월, 일자, 청구 유형, 지급/청구 대상, 현장, 카드 라벨, 구분, 설명, 금액, 메모, 첨부, 자동 생성 source 필드를 포함한다.

## 실패 안정성

- `saveClaim`은 입력 검증과 posted 상태 보호 검사를 통과한 뒤에만 Firestore `setDoc`을 호출한다.
- `charged` 또는 `settled` 문서의 금액/첨부/대상 변경 시 쓰기 전에 실패하므로 기존 문서는 보존된다.
- `charged` 또는 `settled` 문서 삭제는 쓰기 전에 차단한다.
- 상태 변경은 `updateClaimStatus`에서만 처리하며, 상태는 뒤로 되돌리지 않는다.

## 남은 개선 후보

- 수동 입력 UI가 form 생성 시점의 `operationId`를 명시적으로 전달하면 내용이 완전히 같은 별도 청구 2건이 fingerprint ID로 합쳐질 가능성을 더 줄일 수 있다.
- 첨부 파일 삭제와 청구 문서 삭제를 하나의 서버 mutation 또는 보상 작업으로 묶으면 파일/문서 불일치를 더 줄일 수 있다.
- `team_expense_ledgers`를 실제로 쓰는 레거시 데이터가 발견되면 읽기 전용 마이그레이션 또는 별도 alias 조회 정책을 추가한다.
