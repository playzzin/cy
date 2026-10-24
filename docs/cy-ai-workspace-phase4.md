# CY AI 업무 도우미 4차: 저장한 분석 재실행

작성일: 2026-09-28. 로컬 구현·검증 기록이며 운영 배포 완료를 뜻하지 않는다.

후속 진행: 정산 미연결 청구서 점검은 [5차 구현 기록](./cy-ai-workspace-phase5.md)에 정리했다. 아래 다음 순서는 4차 완료 당시의 기록이다.

## 사용 흐름

1. 자연어로 자료를 조회하고 PDF·엑셀 형식, 금액 포함, 상세 내역, 그룹별 시트를 정한다.
2. 대화 영역의 **현재 조건·보고서 저장**을 열고 이름과 기간 방식을 선택한다.
3. **조건 저장**으로 새 항목을 만들거나, 기존 항목을 선택해 **현재 결과로 덮어쓰기**한다.
4. **저장한 분석 → 다시 실행**을 누르면 현재 계정 권한으로 자료를 새로 조회한다. PDF·엑셀 생성 설정도 적용한다.
5. 삭제는 항목의 **삭제 → 삭제 확인**으로 실행한다. 원본 업무 자료에는 영향을 주지 않는다.

계정당 최대 20개다. 저장 이름은 1~60자이며, 사용자별 서버 저장이므로 새로고침 후에도 목록을 불러온다. 이번 단계의 저장·관리·재실행 진입은 화면 버튼이다. 자연어 관리 명령과 정기 실행은 구현하지 않았다.

## 저장과 재실행 기준

| 항목 | 동작 |
|---|---|
| 저장 내용 | 해석·대상 선택이 끝난 조회 조건, 보고서 구성, 이름, 기간 방식, 항목 ID·수정 버전·시각 |
| 저장하지 않는 내용 | 원본 질문, 분석 행·합계, 업무 원본, 파일 내용, 모델 키 |
| 저장한 기간 유지 | 원래 시작·종료일과 비교 기간으로 최신 데이터를 다시 읽음 |
| 실행 시 이번 달 / 지난달 | 한국 시간 기준 해당 월 1일~말일. 한 달 전체 집계에서만 선택 가능 |
| 비교 기간 | 기존 비교가 정확한 전월 전체일 때만 월 자동 변경 허용. 재실행 시 다시 전월로 계산 |
| 마스터 검색 | 기간 자동 변경 없이 현재 마스터를 다시 조회 |
| 제목 | 저장한 문구 유지. 제목에 직접 적은 날짜를 자동 치환하지 않음 |
| 출력 | 재실행 결과의 새 ID로 생성. 저장된 형식이 `none`이면 화면만 조회 |

기존 결과의 접근 만료는 1시간이다. 저장 조건에는 이 만료를 적용하지 않으며, 재실행은 이전 결과 ID나 Gemini 호출에 의존하지 않는다. 한 번 저장한 보고서가 과거 수치의 보관함이 되는 것은 아니다. 과거 결과 보관·공유·예약·외부 발송은 별도 범위다.

## 서버 저장·권한·동시 수정

`server_settings/ai_workspace/saved_analyses/{uid}`에 `{ version: 1, items: [...] }`를 저장한다. 새로운 최상위 컬렉션이나 직접 클라이언트 접근 권한을 추가하지 않았다. 기존 `server_settings` 차단 정책을 그대로 따르며, `aiWorkspace` callable이 로그인 UID의 문서만 읽고 쓴다.

지원 액션은 `saved-list`, `saved-save`, `saved-delete`, `saved-run`이다. 저장은 클라이언트가 보낸 계획 대신 해당 계정의 현재 유효한 서버 분석 결과에서 조건을 가져온다. 분석 진행 중에는 저장을 거부한다. 수정과 삭제는 항목 ID·수정 버전을 확인하고 트랜잭션으로 반영한다. 여러 창의 오래된 값으로 덮어쓰거나 삭제하지 않는다.

재실행은 기존 분석과 같은 요청 잠금·분당 10회 제한·범위 제한·원본 조회·결과 크기·파일 크기 제한을 적용한다. 실행 전과 결과 반환 전에 현재 권한을 확인하고, 결과 저장 시 저장 항목이 중간에 수정·삭제되었는지도 확인한다. 저장 시 특정 팀·현장·작업자로 선택한 대상 ID를 유지하며, 삭제되거나 접근할 수 없으면 실패한다. 이름을 다시 추정하거나 필터를 제거해 전체 조회하지 않는다. 필터가 없는 저장 분석은 실행 시점의 허용된 전체 범위를 사용한다.

화면에서는 재실행을 시작할 때 기존 결과와 다운로드 링크를 제거한다. 실패해도 이전 결과를 새 조회 결과처럼 보여주지 않는다. 로그인 UID별 페이지 재생성과 기존 서비스의 응답 계정 검사를 유지한다.

## 검증

| 항목 | 결과 |
|---|---|
| 서버·기존 계산 회귀 테스트 | 55개 통과. 저장 조건·윤년·한국 시간 월 경계·수정 버전·20개 제한 포함 |
| 프런트 테스트 | 20개 통과. 저장·덮어쓰기·삭제 확인·재실행·새 결과 파일 생성·실패 시 기존 결과 제거 포함 |
| Auth/Firestore 에뮬레이터 | 22개 시나리오 통과. 신규 저장 기능 7개 포함 |
| 타입 검사 | 전체 `npm run typecheck -- --pretty false` 통과 |
| Functions 빌드 / lint | Functions 빌드와 AI 기능 범위 ESLint 통과 |
| 앱 빌드 | 프로덕션 빌드와 `verify:hosting-build` 통과 |
| 브라우저 | 실제 React 화면과 합성 서버에서 저장→새로고침→재실행→PDF/XLSX 링크 생성 확인. 덮어쓰기·삭제 확인 동작, 390px 모바일 입력 폼 확인. 가로 넘침과 콘솔 경고·오류 없음 |

에뮬레이터는 합성 데이터와 `demo-` 프로젝트만 사용한다. 다른 계정의 목록·실행·수정·삭제 차단, 관리자 포함 Firestore 직접 접근 차단, 만료된 결과와 독립적인 재실행, 원본 금액 변경 반영, 원본 수정 없음, 대상 삭제, 관리자→팀장 역할 변경, 비활성 계정, 동시 수정 충돌을 확인했다.

브라우저 검증용 서버는 실제 저장·기간 계산 함수를 쓰는 합성 데이터 환경이다. Firestore 저장과 권한은 별도 에뮬레이터 시나리오에서 검증했다. 운영 로그인부터 배포된 callable까지 이어지는 전체 경로를 검증한 것은 아니다.

Gemini 해석 경로는 이번에 변경하지 않았다. 저장한 분석은 구조화된 조건으로 재실행하므로 이번 검증에서는 실제 Gemini 호출을 추가하지 않았다. 운영 계정의 저장·로그인·배포 callable 경로와 실제 확정 정산 금액 대조는 미검증이다. 운영 데이터 변경·배포·Git push·외부 발송은 실행하지 않았다.

## 주요 파일과 재현

- `functions/src/aiWorkspace/savedAnalyses.ts`: 저장 조건 검증, 버전 충돌, 월 계산.
- `functions/src/aiWorkspace/index.ts`: 사용자별 저장과 현재 권한 재실행.
- `src/features/ai-workspace/SavedAnalyses.tsx`: 목록·저장·덮어쓰기·삭제.
- `src/features/ai-workspace/AiWorkspace.tsx`: 재실행 결과와 파일 생성 연결.
- 서버·프런트 `contract.ts`: 저장 계약과 월 범위 의미 공유. 일치 검사 포함.

```text
npm run functions:build
node --test functions/lib/aiWorkspace/domain.test.js functions/lib/aiWorkspace/planner.test.js functions/lib/aiWorkspace/artifacts.test.js functions/lib/aiWorkspace/settlements.test.js functions/lib/aiWorkspace/reconciliation.test.js functions/lib/aiWorkspace/savedAnalyses.test.js functions/lib/teamReadPolicy.test.js functions/lib/teamScopedQuery.test.js scripts/test-ai-workspace-reference.cjs
npm run test:ci -- --runTestsByPath src/features/ai-workspace/AiWorkspace.test.tsx src/features/ai-workspace/service.test.ts src/features/ai-workspace/SettlementResults.test.tsx src/features/ai-workspace/ReconciliationResults.test.tsx --runInBand
node scripts/run-ai-workspace-tests.mjs
npm run typecheck -- --pretty false
node node_modules/eslint/bin/eslint.js src/features/ai-workspace functions/src/aiWorkspace
npm run build
npm run verify:hosting-build
```

다음 확장 순서는 미연결 청구서 누락 탐색과 일보·지원비 대사의 업무 기준 확정이다. 정기 보고는 저장 항목의 소유자·현재 권한·중복 실행·실패 이력 기준을 마련한 뒤 별도로 구현한다. 출시 전에는 현재 작업 트리의 다른 변경과 함께 전체 `verify:project`를 실행해야 한다.
