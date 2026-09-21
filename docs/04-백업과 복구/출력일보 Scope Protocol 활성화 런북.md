# 출력일보 Scope Protocol 활성화 런북

> 상태: **운영 실행 금지 — 코드 후보만 준비됨**
> 작성일: 2026-09-01
> 관련 문서: [[CY 운영 안정화 실행 로드맵]], [[2026-09-01 Phase 2 출력일보 P0 안정화 검증]], [[백업 및 복구 원칙]]

## 목적

출력일보를 저장할 때 `daily_reports`와 날짜별 `daily_report_scopes`의 `revision`·`reportCount`를 함께 갱신하고, 화면이 성공적으로 조회한 전체 원본과 실제 표시된 삭제 대상만 exact transaction으로 교체한다.

이 절차는 운영 Firestore를 직접 수정하는 절차다. **백업·Rules 검증·유지보수 창·사장님 승인 없이 실행하지 않는다.**

## 현재 운영 실행 차단 사유

- 실제 운영 Firestore 백업과 격리 복원 검증이 아직 완료되지 않았다.
- Java가 없어 Firestore Rules Emulator 검증이 차단돼 있다.
- `canWriteOperations` 권한 사용자가 scope 문서를 단독으로 변조하는 상황까지 Rules에서 완전하게 결합 검증하지 못한다. 운영 활성화 전 서버 소유 mutation 경계 또는 명시적 위험 승인이 필요하다.
- 실제 배포와 scope activation은 수행하지 않았다.

## 준비된 안전장치

- marker: `daily_report_scope_protocol/active`
- 활성 marker의 정확한 공개 형태:

```json
{"version":1,"status":"active"}
```

- 날짜 scope: `daily_report_scopes/{YYYY-MM-DD}`
- 일반 writer와 exact overwrite는 marker·source·scope를 먼저 읽고 모든 검증 뒤에만 transaction write를 등록한다.
- malformed·missing·overflow·stale source는 쓰기 0회로 중단한다.
- 한 client atomic write의 영향 날짜는 Rules 접근 예산을 고려해 최대 8개다.
- 레거시 import·restore·reset·migration·broad overwrite 경로는 fail-closed 상태다.

## 사전 승인 게이트

다음 항목이 모두 충족돼야 한다.

- [ ] 운영 Firestore export 백업 완료
- [ ] Storage 백업 완료
- [ ] 별도 격리 프로젝트에서 Firestore·Storage 복원 검증 완료
- [ ] 복원 건수·샘플 무결성 검증 완료
- [ ] Firestore Rules Emulator allow/deny 테스트 완료
- [ ] maintenance window와 사용자 공지 준비
- [ ] 배포 전 rollback 소스와 절차 확인
- [ ] `canWriteOperations` scope 단독 변조 위험 해결 또는 사장님 명시 승인
- [ ] 사장님 운영 실행 승인

## 명령

격리 후보 경로에서만 실행한다.

```bash
cd /home/hermes/cy-rebaseline-candidate
```

### 1. 읽기 전용 계획 확인

```bash
npm run audit:cy-phase2-scopes
```

필수 동작:

- 기대 프로젝트 `cyee-9c1e4`와 Admin project가 다르면 첫 조회 전 중단
- Emulator 환경변수가 있으면 중단
- `daily_reports` 읽기만 수행
- 출력은 `checkType`, `count` 키만 사용
- ID·이름·현장·작업자·금액을 출력하지 않음

### 2. Rules로 쓰기 동결

운영 승인 후 새 Rules를 먼저 배포해 marker가 없거나 `initializing`인 동안 client의 `daily_reports` 쓰기를 거부한다.

- 기존 client 쓰기가 실제로 거부되는지 확인한다.
- 이 단계부터 새 client 배포 완료까지 출력일보 쓰기 유지보수 창이다.
- Rules 배포·검증 전에는 `--writes-frozen`을 선언하면 안 된다.

### 3. Scope 생성·검증·활성화

```bash
npm run apply:cy-phase2-scopes -- --writes-frozen
```

이 명령의 `--writes-frozen`은 Rules로 실제 쓰기가 동결됐다는 운영자 선언이다.

순서:

1. marker를 `initializing`으로 기록
2. 전체 일보 scan 1
3. 날짜별 scope를 최대 400개 batch로 기록
4. 전체 일보 scan 2
5. 두 scan의 ID·날짜·raw fingerprint 집합 비교
6. 이전 실패에서 남은 stale scope 정리
7. scope readback 검증
8. 마지막 단일 write로 exact active marker 기록

scan이 달라지거나 scope 검증이 실패하면 active marker를 쓰지 않는다.

### 4. 활성 상태 재검증

```bash
npm run audit:cy-phase2-scopes
```

적용 명령의 idempotent validation도 별도로 확인한다. 운영 결과에는 유형별 건수만 보존한다.

### 5. 호환 client 배포

- Grid, DragDrop, FieldSchedulePlanner가 exact API를 사용하는 버전만 배포한다.
- broad overwrite 경로는 제거돼 있어야 한다.
- 날짜별 조회·빈 조회·delete-only·동시편집 conflict를 smoke test한다.

## 실패·중단 시 대응

### active marker 기록 전 실패

- marker를 `initializing`으로 유지한다.
- client 쓰기 동결 Rules를 유지한다.
- 원인을 수정한 뒤 activation을 재실행한다.
- marker를 수동으로 `active`로 바꾸지 않는다.

### scan 불일치

- 운영 쓰기 동결이 실제로 유지되는지 확인한다.
- 활성화하지 않는다.
- report count나 ID를 로그로 출력하지 말고 유형별 건수만 기록한다.

### active 기록 후 client 배포 실패

- old client는 scope 결합 Rules를 통과하지 못하므로 그대로 되돌리지 않는다.
- 유지보수 모드를 유지하고 호환 client를 수정·재배포한다.
- 데이터 rollback은 검증된 격리 복원 절차와 사장님 승인 후에만 수행한다.

## 배포 후 검증

- [ ] 날짜 A 성공 후 날짜 B pending/reject 저장 차단
- [ ] URL 날짜 race 저장 차단
- [ ] stale 응답 무시
- [ ] hidden/unrenderable 문서 보존
- [ ] delete-only exact 저장
- [ ] 같은 날짜 동시수정 conflict
- [ ] scope revision/count와 실제 날짜 query count 일치
- [ ] 통계·알림 실패가 core commit 실패로 보이지 않음
- [ ] 로그·보고에 개인정보·ID·금액 없음

## 금지 사항

- 기존 `restore-firestore.js`, `delete_daily_reports.js`, `migrate-daily-reports.js` 실행
- transfer/compat/UI legacy restore·reset 우회
- marker 수동 활성화
- 450건 초과 destructive replace 분할
- Rules 검증 없이 운영 활성화
- 운영 백업 없이 배포 또는 activation
