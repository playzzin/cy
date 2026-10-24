# CY AI 업무 도우미 1차 구현 기록

작성일: 2026-09-28. 로컬 구현과 합성 자료 검증 기록이며 운영 출시 완료를 의미하지 않는다.

후속 단계에서 실제 Gemini 12문항 평가와 확정 정산·차감 비용 확장을 진행했다. 최신 검증 결과와 전체 빌드의 외부 범위 오류는 [2차 구현 기록](./cy-ai-workspace-phase2.md)을 따른다. 아래 검증은 1차 작업 시점의 기록이다.

## 구현한 사용자 흐름

일보 통계 화면의 **AI 업무 도우미 · 대화와 보고서** 링크에서 `/reports/ai-workspace`로 이동한다.

1. 일보의 공수·산출액·고유 작업자 수를 현장, 현장 담당팀, 작업자 소속팀, 작업자, 일자로 집계한다.
2. 이전 기간과 비교하고 현재 기간에 사라진 그룹도 표시한다. 기준값이 0이면 증감률을 숫자로 만들지 않는다.
3. 현재 작업자·팀·현장·회사 마스터를 검색한다. 검색 결과에는 계좌번호 등 원문 대신 허용된 이름·상태·계좌 등록 여부만 담는다.
4. 후속 요청은 이전 결과의 기간과 대상을 참조한다. 이름이 겹치면 ID가 구분된 후보 선택을 요청한다.
5. 표·그래프·집계 기준·일보 근거를 확인하고 같은 결과로 PDF와 엑셀을 만든다. 제목, 금액 표시, 상세 포함, 그룹별 시트 구성을 지정할 수 있다.

Gemini는 요청을 제한된 조회 계획으로 해석한다. 조회·계산·파일 생성은 서버 코드가 수행한다. 원본 행, 계좌번호, 단가·합계는 모델에 보내지 않는다. 후속 요청의 DB에서 해석된 이름과 ID도 서버 참조로 바꿔 전달한다. 사용자가 질문에 직접 입력한 내용은 Gemini로 전송된다.

## 구성

| 위치 | 역할 |
|---|---|
| `functions/src/aiWorkspace/contract.ts`, `src/features/ai-workspace/contract.ts` | 별도 서버/브라우저 빌드가 사용하는 동일 계약. 일치 여부를 테스트 |
| `functions/src/aiWorkspace/planner.ts` | 서버 Gemini 설정, 구조화 출력, 한국 날짜, 허용 범위 설명, 응답 검증 |
| `functions/src/aiWorkspace/domain.ts` | 기간·조건 검증, 이름 해석, ID별 결정적 집계, 비교, 안전한 검색 결과 |
| `functions/src/aiWorkspace/data.ts` | 현재 계정·역할·팀 권한, 필요한 마스터와 기간 제한 일보 조회 |
| `functions/src/aiWorkspace/index.ts` | `aiWorkspace` callable, 계정별 실행 제한, 최신 결과 보관, 재출력 권한 검증 |
| `functions/src/aiWorkspace/artifacts.ts` | ExcelJS 엑셀, 한글 폰트가 포함된 PDFKit 보고서 |
| `src/features/ai-workspace/AiWorkspace.tsx` | 대화·후속 조건·후보 선택·표·비교·그래프·근거·파일 UI |
| `src/features/ai-workspace/service.ts` | 인증된 서버 호출과 오류 안내. 브라우저 API 키 사용 없음 |
| `src/pages/report/AiWorkspacePage.tsx` | 로그인 계정 변경 시 대화 상태 분리 |

기존 `teamScopedRead.ts`의 본문을 `readTeamScopedData`로 추출해 서버 내부에서도 동일한 제한을 사용한다. 기존 callable은 이 함수를 그대로 감싼다. 기존 AI 통계·인력 검색 기능은 이관하지 않았다. Functions에 ExcelJS 4.4.0을 직접 의존성으로 등록했다.

## 지표와 접근 기준

- 공수: 유효한 일보 작업자 행의 공수 합계, 최종 소수 1자리 반올림.
- 일보 산출액: 당시 공수 × 단가 합계, 최종 원 단위 반올림. 확정 정산액·실지급액과 다르다.
- 고유 작업자: 조건을 만족하는 ID의 중복 제거 수. 여러 그룹에 투입된 작업자는 그룹마다 포함될 수 있으므로 그룹 인원 합계가 전체 고유 인원과 다를 수 있다.
- 현장 담당팀: 일보의 `responsibleTeamId`, 없으면 일보의 `teamId`. 현재 현장 소속으로 과거 귀속을 바꾸지 않는다.
- 작업자 소속팀: 일보 작업자 행의 `teamId`. 누락 시 미지정과 참고 문구를 표시한다.
- 잘못된 공수·단가·작업자 ID, 일보 내부 중복 작업자는 제외하고 부분 결과로 표시한다. 빈 결과는 정상적인 0건 결과다.
- 첫 버전의 사용자 범위는 활성 관리자 및 본인 작업자가 연결된 팀장이다. 관리 권한은 현재 프로필에서 판정하며 오래된 토큰의 관리자 표시만으로 전체 조회를 허용하지 않는다.
- 팀장 결과는 기존 서버 팀 범위를 따르며, 한 일보에 다른 팀 작업자가 섞여 있어도 해당 행과 금액을 제거한다.
- 검색의 기간 조건은 적용하지 않는다. 현재 마스터 검색과 과거 일보 분석을 구분해 표시한다.

## 제한과 데이터 보관

한 조회 기간 최대 366일, 일보 최대 5,000개, 현재·비교 작업자 행 합계 최대 10,000개, 저장 결과 JSON 최대 850KB, 반환 파일 최대 5MB다. 마스터 조회도 기존 5,000개 상한을 따른다. 초과하면 조건을 좁히도록 안내하며 임의로 잘라 전체 결과인 것처럼 보여주지 않는다.

PDF 상세는 최대 2,000행, 그룹별 엑셀 시트는 최대 30개다. 화면은 첫 50행, 그래프는 첫 10개 그룹을 보여주고 파일은 허용 범위의 전체 결과를 사용한다. PDF의 긴 표 텍스트는 240자로 제한하고 안내한다.

`server_settings/ai_workspace/sessions/{uid}`에 계정별 최신 결과를 저장한다. 기존 `server_settings` 규칙에 의해 직접 클라이언트 읽기·쓰기가 차단된다. 분석 시작은 분당 10회, 동시 분석은 계정별 1개다. 파일을 반환하기 직전에 현재 계정 권한과 최신 결과 ID를 다시 확인한다.

최신 결과의 출력 가능 시간은 생성 후 1시간이다. **1시간은 접근 만료이며 물리적 자동 삭제가 아니다.** 다음 분석 성공 시 이전 결과를 덮어쓴다. 과거 결과 보관·저장 분석·TTL 삭제 정책은 후속 범위다. 이미 다운로드한 파일은 권한 변경으로 회수할 수 없다.

응답 표시 중지는 브라우저에서 늦은 결과를 버린다. 서버 작업 자체를 취소하는 기능은 아니다. 대용량 비동기 작업 큐, 사용자별 금액 예산, 내보내기 전용 속도 제한도 후속 운영 과제다.

## 실제 검증

모든 자료·계정·ID는 합성 자료를 사용했다. 운영 DB와 실제 Gemini를 호출하지 않았다.

| 검증 | 결과 |
|---|---|
| 서버 단위 테스트 | 신규 21개와 기존 팀 정책/조회 회귀 7개, 합계 28개 통과 |
| 프런트 테스트 | 대화·선택·늦은 응답·두 파일 생성·오류·계정 변경 등 8개 통과 |
| Auth/Firestore 에뮬레이터 | 12개 시나리오 통과. 다른 팀 차단, 혼합 일보 필터, 직접 저장소 읽기/위조 차단, 만료·권한 변경·과거 ID 출력 차단 포함 |
| TypeScript | 프런트 typecheck 및 Functions 빌드 통과 |
| ESLint | 신규 프런트/서버 영역, 변경한 페이지·라우트·서버 진입점 통과 |
| 프로덕션 빌드 | `npm run build` 및 `npm run verify:hosting-build` 통과. 운영 배포는 실행하지 않음 |
| 실제 브라우저 | 실제 React 컴포넌트를 합성 클라이언트로 실행. 데스크톱 비교표와 모바일 보고서, PDF/XLSX 링크 확인. 모바일 문서 너비 초과 없음, 콘솔 경고·오류 없음 |
| PDF | 실제 생성 파일을 페이지 이미지로 렌더링. 한글·비교표·상세·페이지 번호 검수. 본문 2페이지에 불필요한 빈 페이지가 생기지 않는 회귀 테스트 포함 |
| Excel | 숫자 셀·합계·상세 전체 행·분리 시트 확인. 원본 문자열이 수식으로 실행되지 않음 |

검증 과정에서 Firestore 객체의 키 순서 차이로 재출력이 거부되는 문제와 PDF 페이지 번호가 빈 페이지를 추가하는 문제를 수정하고 회귀 검증했다.

재현 명령:

```text
npm run functions:build
node --test functions/lib/aiWorkspace/domain.test.js functions/lib/aiWorkspace/planner.test.js functions/lib/aiWorkspace/artifacts.test.js functions/lib/teamReadPolicy.test.js functions/lib/teamScopedQuery.test.js
npm run test:ci -- --runTestsByPath src/features/ai-workspace/AiWorkspace.test.tsx src/features/ai-workspace/service.test.ts --runInBand
node scripts/run-ai-workspace-tests.mjs
npm run typecheck -- --pretty false
node node_modules/eslint/bin/eslint.js src/features/ai-workspace src/pages/report/AiWorkspacePage.tsx src/App.tsx src/pages/report/DailyReportStatisticsPage.tsx
node node_modules/eslint/bin/eslint.js functions/src/aiWorkspace functions/src/teamScopedRead.ts functions/src/index.ts
npm run build
npm run verify:hosting-build
```

에뮬레이터 스크립트는 `demo-` 프로젝트와 Auth/Firestore 에뮬레이터 변수가 모두 없으면 거부한다. Windows에서는 기존 Android Studio의 Java가 있으면 사용한다. CLI 설정은 `.tmp/ai-workspace-emulator-config`에 분리한다.

## 운영 연결 전에 남은 확인

1. 격리된 검증 환경의 서버 AI 설정에서 사용할 Gemini 모델·키·한도를 확인하고 `aiWorkspace`만 연결한다. 키를 프런트에 추가하지 않는다.
2. 대표 한국어 질문으로 실제 모델의 날짜 해석·모호함 확인·3회 이상 후속 질문·출력 전환을 평가한다. 현재 테스트의 모델 응답은 가짜 응답이므로 자연어 정확도를 입증하지 않는다.
3. 관리자와 팀장 계정으로 실제 로그인·라우트·설정 제한·네트워크 호출을 확인한다. 브라우저 검증은 앱의 인증/전역 제공자를 제외한 실제 컴포넌트 검증이다.
4. 승인된 검증 자료로 일반 통계 화면과 대조한다. 잘못된 단가를 제외하는 처리와 동명이인 ID 집계 때문에 기존 화면의 이름 기반 합계와 차이가 날 수 있으므로 출시 전에 대조해야 한다.
5. 실제 데이터 크기와 레거시 일보 형식을 확인한다. 현재 제한을 넘는 고객·기간은 집계 저장소 또는 비동기 작업으로 확장해야 한다.
6. 배포 직전 현재 작업 트리의 다른 변경과 분리해 검토하고 전체 `verify:project`, 최종 빌드·호스팅 검증을 수행한다. 이번 작업은 배포·Git push·운영 데이터 변경을 수행하지 않았다.

첫 출시 이후에는 기획안의 순서대로 정산·지원비 대사, 카드·숙소·차량, 저장 분석·정기 보고로 확장한다. 이 단계들은 아직 구현되지 않았으며 현재 도우미가 해당 요청을 받으면 미지원 범위를 설명하도록 설계했다.
