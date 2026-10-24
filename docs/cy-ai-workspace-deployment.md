# CY AI 업무 도우미 운영 반영 기록

2026-09-28. 9차 로컬 검증 이후 사용자의 다음 단계 진행 요청에 따른 운영 전환 기록이다. 실제 배포·활성화 여부는 아래 결과를 기준으로 본다.

## 출시 범위

- 최초 기준 `b90a8cbf`에서 분리한 `codex/ai-workspace-release` 브랜치. 첫 검증 커밋 `cf7d37a6` 이후 실제 운영 커밋 `7adfed75`를 합친 최종 배포 버전은 `499123fe`다.
- 배포 작업 폴더: `C:\Users\playz\cy\tmp\ai-workspace-release`.
- 포함: 자연어 조회·통계·저장 분석·PDF/엑셀·정기 보고, 운영 중지/시범 계정 제한, 관련 경로·통계 화면 진입점, 공통 팀 조회 함수 재사용, ExcelJS 서버 의존성, 조회 인덱스와 검증 도구.
- 다른 작업의 미배포 알림센터·대시보드·지원 원장 변경은 포함하지 않았다. 운영 사이트에 이미 반영된 Gemini 모델 개선 `7adfed75`는 합쳐 보존한다. 원래 작업 폴더의 기타 변경을 함께 배포하지 않는다.
- 원래 작업 폴더의 변경은 보존했다. 분리된 브랜치에 로컬 커밋을 만들었으며 원격 push는 수행하지 않았다.

## 운영 변경과 검증

| 항목 | 상태 |
|---|---|
| 인덱스 추가 계획 검토 | 운영 목록을 읽고 필요한 11개만 누락됨을 확인 |
| 인덱스 생성 요청 | 11개 추가 요청 성공, 삭제 0개·업무 문서 쓰기 0건 |
| 인덱스 준비 상태 | 12:37 KST에 11개 모두 `READY` 확인 |
| AI 전용 소스의 전체 출시 검사 | 통합 버전 `499123fe`가 13:07 KST에 8개 단계 모두 통과. 검사 중 소스 변경 없음 |
| 서버 함수 3개 | 통합 버전 갱신 성공. 13:13 KST 최종 점검에서 모두 `ACTIVE`, 두 callable 모두 비인증 요청 `401 UNAUTHENTICATED` 확인 |
| Cloud Scheduler | `us-central1`, `every 5 minutes`, `Asia/Seoul`, `ENABLED` 확인 |
| 예약 함수의 중지 상태 호출 | 13:15 KST 로그 점검에서 정상 종료 5건·오류 0건. 최종 버전 반영 뒤 13:15 호출도 `ok`. 업무 보고서 생성 검증은 아님 |
| Hosting UI | 배포 성공. 13:13 KST에 공개 버전 `499123fe` 및 정적 파일 목록·지문이 최종 로컬 산출물과 일치 |
| 운영 설정 | 기존 설정 문서 없음. 코드의 기본 정책으로 전체 중지 |
| 시범 계정 | 사용자 선택 대기. 미선택 상태에서 전체 공개로 전환하지 않음 |
| 운영 브라우저 | 기존 로그인 세션에서 새 화면 표시 확인. 저장한 분석·정기 보고 모두 운영 중지 안내, 예약 내용 확인 버튼 비활성화 확인 |
| 검색 결과·PDF/엑셀·원본 대조·예약 생성 | 시범 계정을 열지 않아 실제 운영 자료를 이용한 전 과정은 미검증 |

최초 `.tmp` 경로에서 Windows 테스트 경로의 점 문자 처리 때문에 테스트가 발견되지 않아, 일반 `tmp` 경로로 작업 폴더를 이동했다. 테스트 인식 후 전체 검사를 다시 실행했고 테스트 없음 허용이나 검사 생략으로 우회하지 않았다.

최종 출시 소스에서 앱 테스트 344개 묶음·2,038개 사례 통과(기존 제외 2개), 타입 검사·린트·서버 빌드 통과, 서버·파일 생성·출시 도구 검사 104개 통과, 조회/권한 34개와 예약 보고서 20개 통합 시나리오 통과, 운영 화면 빌드·출시 기록·Hosting 파일 검사 통과를 확인했다. 9차의 원래 작업 폴더 검사 수와 다른 것은 다른 작업의 미배포 변경을 출시 소스에서 제외했기 때문이다. 최종 증거는 배포 작업 폴더의 `.tmp/ai-workspace-qa/release-gate/summary.json`과 각 단계 기록이다. 통합 전 첫 후보에서도 8개 검사 단계가 모두 통과했지만, 운영 변경을 합친 뒤 이 전체 검사를 다시 수행했다.

첫 운영 점검은 Scheduler가 함수 지역에 있고 주제 이름이 `firebase-scheduled-...`라고 가정해 실제 작업을 찾지 못했다. 설치된 Firebase CLI 소스와 실제 API 응답으로 1세대 함수의 예약 작업이 프로젝트 기본 위치(`us-central1`)와 `firebase-schedule-...` 이름을 사용하는 것을 확인했다. 점검 도구를 실제 설정 조회와 정확한 대상 일치로 수정하고 회귀 검사 2개를 추가했다. 수정 후 읽기 전용 운영 점검의 `infrastructureReady`는 `true`다. 이는 시범 계정의 업무 흐름 검증 완료를 뜻하지 않는다.

Hosting 첫 적용 시도는 현재 사이트의 공개 출시 커밋이 `7adfed75`인 것을 확인해 업로드 전에 중단됐다. 해당 운영 커밋을 합치며 AI 설정 테스트의 추가/추가 충돌은 두 검사를 모두 보존해 해결했다. 통합 버전은 기존 운영 모델 개선을 보존하고, Functions 배포 범위는 동일한 AI 함수 3개로 유지한다.

## 최종 확인과 다음 인수 조건

- 접속 주소: [AI 업무 도우미](https://cyee-9c1e4.web.app/reports/ai-workspace). 현재 화면은 제공되지만 서버 운영 정책은 `off`다.
- `node scripts/check-release.cjs`와 `node scripts/check-ai-workspace-production.cjs --read-only`는 최종 출시 작업 폴더에서 모두 성공했다. `infrastructureReady: true`, `sameAssetsAsLocal: true`이며, 실제 업무 전 과정의 인수 완료를 뜻하는 `productionValidated`는 계속 `false`다.
- UI 검증에서는 기존 로그인 세션을 사용했으며 계정 식별자·토큰을 출력하거나 복사하지 않았다. 기능 활성화, 업무 질문 실행, 개인 예약 생성은 하지 않았다.
- 최종 출시 작업 폴더의 Git 상태는 깨끗하다. 원래 작업 폴더의 별도 작업 변경은 보존되어 있다. Firestore/Storage Rules, 다른 서버 함수, 업무 원본 문서는 이번 배포 범위에 포함하지 않았다.
- 다음 인수 조건은 시범 계정 지정 후 해당 계정의 기존 역할·팀 범위에서 검색→원본 대조→PDF/엑셀 다운로드→예약 보고 결과를 확인하는 것이다. 실제 확정 정산 표본과 처리 시간·비용·만료 관찰은 별도로 필요하다.

배포 상태 기록은 원래 작업 폴더의 `.tmp/ai-workspace-qa/deployment-functions.log`, `deployment-hosting.log`에, 최종 자동 점검 결과는 출시 작업 폴더의 `.tmp/ai-workspace-qa/production-preflight.json`에 있다. 예약 실행 로그의 비식별 요약은 원래 작업 폴더의 `.tmp/ai-workspace-qa/scheduler-execution.json`에 있다.

## 적용 방식

인덱스는 `scripts/apply-ai-workspace-indexes.cjs --plan`으로 먼저 검토하고 `--apply`로 생성한다. 정해진 11개 정의만 대상으로 하며 이미 존재하거나 생성 중인 인덱스는 다시 만들지 않는다. 기존 인덱스 삭제·치환 API를 호출하지 않는다. 변경 전 목록과 생성 작업 ID는 배포 작업 폴더의 `.tmp/ai-workspace-qa/index-apply-*.json`에 보관한다. 이 동작은 [Firestore 인덱스 생성 API](https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.collectionGroups.indexes/create)를 사용한다.

서버 배포 대상은 `aiWorkspace`, `aiWorkspaceReports`, `generateScheduledWorkspaceReports` 세 개로 제한한다. 예약 함수 배포 시 해당 예약 작업과 Pub/Sub 주제가 만들어지는 것은 [Firebase 예약 함수 배포 동작](https://firebase.google.com/docs/functions/1st-gen/schedule-functions-1st)에 따른다. 운영 설정을 켜기 전에는 업무 보고서를 자동 생성하지 않는다.

Hosting 적용 직전 기존 운영 릴리스가 기준 커밋에서 바뀌지 않았는지 재검사한다. 다른 배포가 먼저 반영됐다면 중단하고 최신 변경을 통합한다. 기존 빌드·대상 확인 절차를 유지하고, 적용 후 공개 배포 기록과 정적 산출물을 대조한다. CLI 기록은 상태·오류 위주로 제한하고 키·토큰·계정 문자열을 가린다. 서버의 운영 로그는 정상 유지한다.

시범 운영·중지·복구의 설정 구조와 인수 조건은 [9차 운영 절차](./cy-ai-workspace-phase9.md)를 따른다. 배포 성공과 사용자 흐름의 운영 검증 완료는 별도로 기록한다. 현재 확인한 2026-08 정산 68건은 모두 미확정이므로 실제 확정 금액 대조에는 별도 표본이 필요하다.
