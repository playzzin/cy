# 시공계획서 운영·복구 런북

이 문서는 `cyee-9c1e4`의 시공계획서 템플릿, 승인 스냅샷, 발행 PDF와 도면 원본을 운영하는 절차다. 승인 스냅샷과 발행 산출물은 불변 자료이므로 장애 대응 중에도 덮어쓰거나 삭제하지 않는다.

## 1. 책임과 접근 원칙

- 현장 작성자: 초안 수정, 검토 제출, 발행본 열람
- 본사 검토자·승인자: 검토 완료, 승인, candidate PDF 육안 검수, 발행
- 템플릿 관리자: 템플릿 작성·검토·게시·폐기
- Firebase 운영 관리자: 백업·복원, 장애 조사, 예약 정리 작업과 경보 확인
- 운영 관리자는 사용자 계정을 대신해 승인하거나 발행하지 않는다. 긴급 복구 뒤에도 실제 승인자가 새 개정본을 검토·발행한다.

## 2. 보존 대상

Firestore에서 다음 컬렉션과 모든 하위 컬렉션을 함께 보존한다.

- `constructionPlans`
- `constructionPlanSeries`
- `constructionPlanTemplates`
- `constructionPlanExportJobs`
- `constructionPlanPdfRenderOperations`
- `constructionPlanUploadSessions`
- `constructionPlanDrawingReuseJobs`
- `constructionPlanRecordUploadSessions`
- `constructionPlanRecords`
- `constructionPlanLockRequests`
- `constructionPlanLifecycleMutationReceipts`
- `constructionPlanPdfDownloadReceipts`
- `constructionPlanPdfDownloadGrants`
- `constructionPlanAuditEvents`

Storage에서는 다음 prefix를 보존한다.

- `construction-plans/{siteId}/{planId}/review-snapshots/`
- `construction-plans/{siteId}/{planId}/drawings/`
- `construction-plans/{siteId}/{planId}/previews/`
- `construction-plans/{siteId}/{planId}/server-exports/`
- `construction-plan-records/{siteId}/{planId}/`

`staging/` 객체는 복구 기준 자료가 아니다. 예약 정리 대상이며, canonical 객체와 혼동해 백업 복구에 사용하지 않는다.

## 3. 정기 백업과 검증

1. 운영 프로젝트와 다른 보존 버킷에 Firestore managed export와 Storage object versioning을 구성한다.
2. 매일 KST 03:00에 Firestore export를 실행한다. 보존은 일간 35일, 월간 13개월로 한다.
3. Storage 버킷은 객체 버전 관리와 35일 noncurrent-version 보존을 사용한다. 승인 snapshot 및 issued export prefix에는 lifecycle delete 규칙을 적용하지 않는다.
4. 백업 완료 뒤 export metadata 존재, 총 객체 수, 총 바이트 수, 실패 개수를 기록한다.
5. 매월 격리된 복구 프로젝트에서 하나의 게시 템플릿, 하나의 승인 snapshot, 하나의 issued PDF를 복원해 SHA-256과 Storage generation을 원본 감사 레코드와 대조한다.
6. 복구 검증 결과에는 검사자, 시각, 원본/복구 프로젝트, plan ID, export ID, SHA-256, 페이지 수를 남긴다.

백업 실패 또는 복구 SHA 불일치는 배포 차단 사유다. 승인 snapshot이나 issued PDF를 재생성해 불일치를 숨기지 않는다.

## 4. 복원 절차

1. 사고 범위와 마지막 정상 시각을 확정하고 시공계획서 신규 발행 기능을 닫는다.
2. Firestore와 Storage의 현재 상태를 별도 사고 보존 위치에 먼저 복제한다.
3. 격리 프로젝트에 해당 시점의 Firestore export를 복원한다.
4. Storage의 정확한 object generation을 복원한다. 동일 경로에 새 세대만 생성해 기존 세대를 보존한다.
5. 템플릿 레코드의 `templateHash`, `manifestHash`, `templateBundleHash`, `templateBindingHash`를 재검증한다.
6. 승인 snapshot JSON의 canonical byte SHA-256, Firestore의 `contentHash`, Storage metadata의 `sha256`가 모두 같은지 확인한다.
7. issued export의 byte 길이, SHA-256, A4 페이지 수, PDF magic header, 텍스트 추출, 매 페이지 provenance를 확인한다.
8. `constructionPlanSeries.latestPlanId`, `latestIssuedPlanId`, `latestRevisionNo`와 계획서 계보를 대조한다.
9. 격리 프로젝트에서 목록 조회, 발행본 다운로드, 새 개정본 생성까지 확인한다.
10. 복원 결과를 승인한 뒤에만 운영 데이터에 적용하고 발행 기능을 다시 연다.

복원 과정에서 불변 문서의 ID, Storage path, generation 또는 SHA-256 중 하나라도 달라지면 복원을 중지한다.

## 5. 예약 정리 작업

배포 후 다음 Functions export가 실제 스케줄에 등록되어 있어야 한다.

| 작업 | 주기 | 처리 대상 | 정상 확인 |
|---|---:|---|---|
| `cleanupConstructionPlanDrawingUploadsScheduled` | 24시간 | 만료 도면 staging 및 pre-commit canonical orphan | `cleanupAfterEpochMs`가 제거되고 `cleanupCompletedAt` 기록 |
| `cleanupConstructionPlanDrawingReuseScheduled` | 24시간 | 완료·실패·중단된 도면 재사용 job과 orphan | 만료 job이 정리되고 canonical 참조는 보존 |
| `cleanupConstructionPlanRecordPhotoUploadsScheduled` | 30분 | 만료 실행기록 사진 staging 및 orphan | 세션에 `cleanupCompletedAt` 기록 |
| `cleanupExpiredConstructionPlanLocksScheduled` | 15분 | TTL이 지난 edit lock과 잠금해제 요청 | 계획서 lock 제거 및 `expire_unlock` 감사 이벤트 기록 |
| `monitorConstructionPlanPdfRenderOperationsScheduled` | 5분 | heartbeat가 끊긴 renderer와 24시간 넘은 육안검수 대기 candidate | `STALLED` 전이 또는 1회 overdue 경보 기록 |

정리 작업은 한 건의 malformed 세션 때문에 전체 batch를 중단하지 않는다. 다음 로그가 한 번이라도 발생하면 해당 문서 ID와 Storage 경로를 조사한다.

- `[constructionPlanDrawingUpload] malformed cleanup session`
- `[constructionPlanDrawingUpload] staging cleanup failed`
- `[constructionPlanDrawingUpload] canonical orphan cleanup failed`
- `[constructionPlanDrawingReuse] malformed cleanup job`
- `[executionRecordPhoto] malformed cleanup session`
- `[executionRecordPhoto] staging cleanup failed`
- `[executionRecordPhoto] canonical orphan cleanup failed`
- `[constructionPlans] expired lock cleanup failures`

오류가 발생한 canonical 객체는 참조 여부를 Firestore에서 확인하기 전에는 수동 삭제하지 않는다.

## 6. PDF 렌더링 경보와 대응

Cloud Logging 기반 경보를 다음 기준으로 구성한다.

- `prepareConstructionPlanIssuedPdfServer` 또는 `issueConstructionPlanServer`의 timeout/OOM: 5분 동안 1건 이상
- `[constructionPlans] Server field-use PDF audit failed.`: 즉시 1건 이상
- `data-loss` 또는 renderer provenance/SHA/page-count 불일치: 즉시 1건 이상
- 같은 plan에서 PDF 준비 실패가 15분 동안 3회 이상
- `READY_FOR_VISUAL_CHECK` 상태가 24시간 넘게 유지: 일일 운영 점검 대상

대응 순서:

1. plan ID, 승인 snapshot hash, template binding hash, drawing binding hash, renderer build hash를 기록한다.
2. 같은 입력으로 재시도하기 전 승인 snapshot과 모든 도면 원본의 Storage generation/SHA-256을 확인한다.
3. OOM이면 원본 도면의 페이지 수·크기·해상도 제한 위반을 확인한다. 제한을 우회해 메모리만 늘리지 않는다.
4. timeout이면 어떤 렌더 단계에서 중단됐는지 로그를 확인하고, orphan candidate 객체는 예약 정리 대상으로 남긴다.
5. audit/data-loss이면 발행을 중지한다. candidate를 issued 경로로 복사하거나 클라이언트 PDF로 대체하지 않는다.
6. 수정 뒤 동일 승인 snapshot으로 candidate를 다시 만들고 SHA-256, A4 규격, 검색 텍스트, 도면 선명도와 모든 페이지를 육안 검수한다.

## 7. 발행 취소·오발행·긴급교체

발행된 PDF는 취소 버튼으로 삭제하거나 상태를 과거로 되돌리지 않는다.

### 오발행 발견

1. 본사 승인자가 해당 발행본을 `void` 처리하고 사유를 구체적으로 기록한다.
2. 외부 배포 대상에게 문서번호, 개정번호, 발행 SHA-256과 사용 중지 시각을 통지한다.
3. 원본 발행본, 승인 증적, 감사 이벤트와 다운로드 이력은 보존한다.
4. `void` 발행본을 기반으로 직접 재발행하지 않고, 현재 유효한 직전 발행본에서 새 개정 초안을 만든다.

### 긴급교체

1. 긴급 사유와 작업중지/임시통제 조치를 감사 기록에 남긴다.
2. 새 개정본에 변경 사유·영향 범위·교체 대상 revision을 연결한다.
3. 일반 검토·승인·candidate 육안 검수 절차를 생략하지 않는다.
4. 새 개정본 발행 트랜잭션이 성공해 이전 발행본이 `superseded`가 된 것을 확인한다.
5. 현장 배포본의 문서번호·revision·SHA-256을 새 발행본과 대조하고 구본을 회수한다.

### 잘못된 폐기 또는 보관

- 보관은 발행 무효화가 아니다. 보관을 해제해도 승인·발행 상태는 변경하지 않는다.
- 잘못된 `void`는 상태를 되돌려 숨기지 않는다. 사유를 기록한 새 개정본으로 교정한다.
- 관리자 강제 잠금해제는 편집 복구 용도이며 승인 또는 발행 권한을 대신하지 않는다.

## 8. 장애 종료 조건

- Firestore plan/series/template/export job 관계가 일치한다.
- 승인 snapshot과 issued PDF의 Storage generation, 크기, SHA-256이 감사 레코드와 일치한다.
- PDF가 A4이며 검색 가능한 한글 텍스트, 머리글·꼬리글·페이지 번호와 도면 페이지를 유지한다.
- 기존 발행본은 삭제·덮어쓰기 없이 `issued`, `superseded`, `void`, `archived` 의미가 유지된다.
- Firestore/Storage 허용·거부 에뮬레이터 테스트와 전체 시공계획서 회귀 테스트가 통과한다.
- 사고 원인, 영향 문서, 조치자, 조치 시각, 검증 증거와 재발방지 항목을 운영 기록에 남긴다.
