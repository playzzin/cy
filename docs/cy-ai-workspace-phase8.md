# CY AI 업무 도우미 8차: 정기 보고 설정·실행·보관

작성일: 2026-09-28. 로컬 구현과 합성 자료 검증 기록이며 운영 배포 기록이 아니다.

## 사용 흐름

1. 기존 분석 결과에서 조회 조건과 보고서 구성을 저장한다.
2. AI 업무 도우미의 **정기 보고 열기**에서 저장 분석을 선택한다.
3. 매일·매주·매월과 한국 시간, 요일 또는 날짜를 입력한다. 매월은 1~28일을 지원한다.
4. 기간 방식·대상·금액/상세 포함 여부와 반복 시간을 확인하고 **이 내용으로 예약 저장**을 누른다.
5. 최근 실행 내역에서 완료·부분 결과·실패를 확인하고, 보관된 결과로 PDF 또는 엑셀을 만든다.

계정당 예약은 최대 5개다. 예약 수정·중지·삭제와 중지된 예약의 확인 후 재개를 제공한다. 삭제한 예약의 기존 보고서는 보관 기한까지 남는다. 저장한 분석 자체는 수정하거나 삭제하지 않는다.

“매월 1일 오전 9시에 예약해줘” 같은 자연어 요청은 정기 보고 설정 화면을 안내한다. 모델이 바로 예약을 생성하거나 중지하지 않는다. 일정과 실행 대상은 화면에서 구체적으로 확인한다. 외부 이메일·메신저 발송은 포함하지 않는다.

## 실행과 보관 기준

| 항목 | 구현 기준 |
|---|---|
| 시간대 | `Asia/Seoul`, 월 경계·윤년·연말을 포함한 한국 달력 |
| 자동 실행 | 5분마다 예정 시간이 지난 예약 최대 10개를 순서대로 처리. 실행 시간이 길면 다음 주기로 넘김 |
| 지연 실행 | 밀린 예정 시각 한 회를 실행하고 현재 이후의 다음 일정으로 이동. 누락된 모든 회차를 몰아서 실행하지 않음 |
| 월 자동 변경 | 실제 처리 시각이 아닌 **예정 시각**으로 이번 달/지난달을 계산. 월 경계를 넘긴 재시도에도 같은 기간 유지 |
| 조회 시점 | 해당 회차를 실행하거나 재시도한 시점의 자료 조회. 과거 예정 시각의 원장 상태를 복원하지 않음 |
| 생성물 | 당시 계산한 비공개 분석 결과를 보관. PDF·엑셀 파일은 사용자가 요청할 때 그 결과로 생성 |
| 보관 | 최초 실행 시작 시점부터 7일. 접근 즉시 만료 검사, 주기 작업에서 만료 메타데이터·결과 삭제 |
| 이력 | 계정별 최근 30건 표시. 결과 수치나 전체 원본을 목록 응답에 포함하지 않음 |
| 크기 | 기존 결과 850KB, 다운로드 파일 5MB 제한 유지 |
| 부분 결과 | 완료로 합치지 않고 별도 상태와 경고를 보관·표시 |

일정 안내의 5분 간격은 정시 실행 보장이 아니다. 처리량·서비스 지연·예약 수에 따라 더 늦어질 수 있다. 생성 파일 자체를 Storage에 미리 저장하거나 공개 URL을 발급하지 않는다. 같은 스냅샷의 수치를 내보내며 파일 바이트의 영구 보관·동일성 보장은 이번 범위가 아니다.

## 권한과 변경 처리

- 저장·조회·다운로드는 별도 인증 callable `aiWorkspaceReports`를 사용한다.
- 예약에 계정과 현재 접근 범위, 저장 분석의 ID·버전을 묶는다. 외부 입력의 계정 ID나 역할을 실행 권한으로 사용하지 않는다.
- 예약 실행 전과 결과 보관 직전에 Auth 계정 활성 상태와 현재 프로필/팀 연결을 검사한다. 권한 범위가 바뀌면 예약을 중지하며 자동으로 더 넓거나 좁은 범위에 재승인하지 않는다.
- 저장 분석의 수정·삭제와 필터 대상 접근 실패도 예약 중지 사유다. 현재 저장 조건을 확인하고 예약을 다시 저장해야 한다.
- 생성 중 예약을 수정·중지·삭제하면 늦게 도착한 결과를 폐기한다. 생성 직전 저장 분석의 버전도 다시 확인한다.
- 보관 결과 다운로드 전후에 계정·권한·만료 상태를 검사한다. 과거 관리자 보고서를 권한이 축소된 계정으로 받을 수 없다.
- 대화의 1시간 결과와 정기 보고를 분리한다. 예약 실행이 대화 결과나 실행 잠금을 덮어쓰지 않는다.
- 일보·정산·지원비 등의 업무 원본과 저장 분석은 읽기만 한다. 자동 실행은 Gemini 호출 없이 기존 결정적 계산기를 사용한다.

## 중복 실행과 실패

예약 ID·버전·예정 시각으로 회차 ID를 만들고 Firestore 트랜잭션에서 실행권을 잡는다. 같은 스케줄러 이벤트가 동시에 도착해도 같은 회차를 중복 생성하지 않는다. 진행 중 실행에는 10분 유효 시간을 둔다. 응답이 사라진 실행은 다음 점검에서 실패로 전환하고 자동으로 재생성하지 않는다.

일시적 오류만 실행 내역에서 수동 재시도할 수 있다. 회차당 최초 실행을 포함해 최대 3회이며 원래 예정 시각·조회 기간을 유지한다. 이미 완료한 회차, 만료·권한 변경·예약 버전 변경·삭제된 회차는 재시도하지 않는다. 세 번째 실패에는 수동 재시도 버튼을 숨기고 다음 정기 실행을 안내한다. 프로바이더 오류 원문이나 개인정보를 실패 메시지에 저장하지 않는다.

수동 재시도는 성공·실패·응답 중단에 관계없이 별도로 기다리던 다음 정기 일정을 유지한다. 과거 회차의 재시도 때문에 이미 도래한 새 회차가 건너뛰어지지 않도록 실행권에 복귀 시간을 기록한다.

## 구현 위치

- `functions/src/aiWorkspace/execution.ts`: 대화 실행과 예약 실행이 공유하는 조회·집계 경로.
- `reportSchedule.ts`: 주기 검증, 한국 시간 다음 실행 계산, 회차 ID와 안전한 실패 분류.
- `scheduledReports.ts`: 예약/이력 callable, 트랜잭션 실행권, 권한 재검사, 결과 보관·만료 정리.
- `src/features/ai-workspace/ScheduledReports.tsx`: 저장 전 확인, 예약 목록·수정·중지·삭제, 결과 다운로드·재시도.
- 양쪽 `contract.ts`: `workspace-v8`, 정기 보고 계약. 기존 분석과 저장 항목을 계속 읽을 수 있다.

데이터는 기존 클라이언트 접근 금지 공간 `server_settings/ai_workspace` 아래의 `ai_report_schedules`, `ai_report_runs`, `ai_report_results`, `report_owners`에 보관한다. 계정별 예약 수 제한은 소유자 문서에서 직렬화한다. Firestore Rules나 Storage Rules 권한을 넓히지 않았다. `ai_report_runs`의 `uid ASC, createdAt DESC` 복합 인덱스 한 개만 추가했다.

## 검증 기록

| 검증 | 결과 |
|---|---|
| 서버 계산·권한·PDF/엑셀 회귀와 일정 단위 테스트 | 88개 통과 |
| 프런트 전체 AI 범위 | 40개 통과. 저장 전 확인, 버전 전달, 중복 클릭, 부분 결과, 오류와 늦은 다운로드 폐기 포함 |
| 기존 Auth/Firestore 통합 회귀 | 31개 시나리오 통과 |
| 정기 보고 Auth/Firestore 통합 | 최종 17개 시나리오 통과. 계정당 동시 생성 한도, 중복 회차, 원본 불변, 파일 일치, 타 계정/직접 접근 차단, 조건·권한 변경, 실행 중 중지, 월 경계 재시도, 재시도/중단 후 다음 정기 일정 보존, 부분 결과, 만료 정리, 3회 한도와 팀장 행 범위 포함 |
| 실제 Gemini | 정기 보고 생성 안내·중지 안내·외부 발송 구분 3/3 통과. 합성 질문만 사용, 기존 35개 전체 모델 평가는 이번 차수에 반복하지 않음 |
| 타입·lint | 전체 앱 typecheck, AI 범위 ESLint, Functions 빌드 통과 |
| 브라우저 | 실제 React + 합성 메모리 서버로 주간 예약 17:30 확인·저장, 중지, 보관 결과 XLSX 생성·링크 확인 |
| 모바일 | 390px 설정에서 문서 폭/스크롤 폭 모두 375px, 예약 폼과 카드 가독성 확인 |
| 앱 배포 산출물 | 최종 앱 빌드·Hosting 산출물 검증 통과 |

브라우저 서버는 실제 DB·Gemini와 연결하지 않았다. 데이터베이스 테스트는 이름이 `demo-`로 시작하고 Auth/Firestore 에뮬레이터가 모두 지정된 환경에서만 실행된다. 원본 수정/삭제는 합성 시험 데이터에만 한정한다. 실제 운영 데이터나 사용자 예약을 등록하지 않았다.

재현 명령:

```text
npm run functions:build
node --test functions/lib/aiWorkspace/*.test.js functions/lib/teamReadPolicy.test.js functions/lib/teamScopedQuery.test.js scripts/test-ai-workspace-reference.cjs
npm run test:ci -- --runTestsByPath src/features/ai-workspace/ScheduledReports.test.tsx src/features/ai-workspace/AiWorkspace.test.tsx src/features/ai-workspace/service.test.ts src/features/ai-workspace/SettlementResults.test.tsx src/features/ai-workspace/ReconciliationResults.test.tsx src/features/ai-workspace/MissingBillingResults.test.tsx src/features/ai-workspace/EvidenceResults.test.tsx --runInBand
node scripts/run-ai-workspace-tests.mjs
node scripts/run-ai-workspace-tests.mjs --reports
node scripts/evaluate-ai-workspace-live.cjs --live --only-reports
npm run typecheck -- --pretty false
node node_modules/eslint/bin/eslint.js src/features/ai-workspace functions/src/aiWorkspace
npm run build
npm run verify:hosting-build
```

## 배포 전 남은 일: 9차

후속 기록: [9차 통합 검증·운영 전환 준비](./cy-ai-workspace-phase9.md)에 서버 운영 중지·시범 계정 설정, 최종 검사와 운영 적용·복구 절차를 정리했다. 아래 내용은 8차 종료 당시의 남은 항목이며 운영 검증 상태는 9차 기록을 따른다.

운영 Auth→callable→Cloud Scheduler 흐름, 실제 계정의 원본 화면과 금액 대조, 부하·비용·지연시간 계측, 보관 정책 운영 승인은 남아 있다. 새로운 인덱스가 준비된 뒤 함수와 UI를 함께 배포해야 한다. 예약 함수 배포는 Scheduler/Pub/Sub 인프라 생성과 비용을 수반하므로 이번 로컬 작업에서는 실행하지 않았다. 스케줄러의 중복 호출 가능성과 1세대 예약 API는 [Firebase 예약 함수 문서](https://firebase.google.com/docs/functions/1st-gen/schedule-functions-1st)와 [중복 실행 주의사항](https://firebase.google.com/docs/functions/schedule-functions)을 참고했다.

출시 전 전체 `verify:project`와 공유 작업 디렉터리의 다른 변경을 통합 점검한다. 운영 중단 시 스케줄러 작업을 중지하고 예약 상태를 검토하는 절차도 9차에서 확정한다. 운영 배포·Git push·외부 발송은 수행하지 않았다.
