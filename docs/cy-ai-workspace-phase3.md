# CY AI 업무 도우미 3차: 연결 청구서 대사

작성일: 2026-09-28. 로컬 구현·검증 기록이며 운영 배포 완료를 뜻하지 않는다.

후속 진행: 조회 조건·보고서 구성 저장과 재실행은 [4차 구현 기록](./cy-ai-workspace-phase4.md)에 정리했다. 아래 다음 순서는 3차 완료 당시의 기록이다.

## 구현한 범위

확정 팀 정산에 이미 연결된 카드·숙소·차량 청구서를 읽고, 정산 반영액과 현재 청구액·확정 상태를 비교한다. 예시 요청:

- “지난달 확정 정산에 연결된 카드·숙소·차량 청구서를 대사해줘.”
- “그 결과를 상세 포함한 PDF와 엑셀로 만들어줘.”
- “금액을 제외해줘.”

`dataset=settlementAudit`, 정산팀 기준, 완전한 한 달, 팀 이름 정렬을 사용한다. 전월 비교나 다른 지표의 요청을 조용히 무시하지 않고 지원 범위를 확인한다. 기존 확정 정산 조회에서 대사로 전환하면 새로 읽고, 대사 결과를 파일로 바꿀 때는 저장된 결과를 사용한다.

## 비교 기준과 권한

| 대상 | 읽는 위치 | 금액 기준 |
|---|---|---|
| 정산 | `system_configs/team_settlement_YYYY-MM__팀ID` | 유효한 저장 확정 문서의 차감 내역 |
| 카드 청구 | `cardBillings` | 내역 합계가 양수이면 해당 합계, 아니면 저장 총액, 원 단위 반올림 |
| 차량 청구 | `vehicle_billing_documents` | 내역 합계 → 고정비+변동비 → 저장 총액의 기존 우선순위, 원 단위 반올림 |
| 숙소 청구 | `accommodation_billing_documents`, `accommodation_billing_line_items` | 취소되지 않은 연결 내역 합계, 원 단위 반올림 |

기준은 현재 `teamSettlementService.ts`의 청구서 차감 계산과 `accommodationBillingService.ts`의 유효 내역 필터를 읽어 확인했다. 브라우저 서비스를 서버로 import하거나 조회 중 저장하는 함수를 호출하지 않는다.

차감 항목의 `origin:월:청구서ID` 참조를 허용된 세 컬렉션의 정확한 문서 ID로만 해석한다. 자동 생성 항목만 직접 연결하며 수동 항목·`ledger` 합산 항목·잘못된 ID는 별도로 표시한다. 이름 추정이나 전체 원장 스캔으로 연결을 만들지 않는다.

정산 문서가 현재 계정의 범위에 속하는지 검증한 뒤, 청구서의 팀 ID/레거시 ID·월·수신 대상이 같은 팀 청구인지 다시 확인한다. 숙소 하위 내역은 부모 청구서 검증을 통과한 경우에만 읽는다. 충돌하는 중첩 부모 ID가 있으면 다른 청구서 내역을 끌어오지 않는다. 다른 팀·다른 월·개인 청구서의 금액·이름·메모는 반환하지 않는다.

| 결과 | 처리 |
|---|---|
| 일치 | 유효한 확정/납부/연체 청구액과 정산 반영액이 같음 |
| 금액 차이 | 현재 청구액 − 정산 반영액을 표시. 변경 원인·과오납을 단정하지 않음 |
| 청구 미확정 | 현재 상태가 확정/납부/연체가 아니므로 금액 비교에서 제외 |
| 원본 확인 불가 | 접근 가능한 동일 팀·동일 월의 청구서를 찾지 못함. 삭제와 권한 밖을 구분해 누설하지 않음 |
| 중복 연결 | 동일 팀에서 같은 청구서를 여러 차감 항목이 참조. 모든 복제 행을 금액 비교에서 제외 |
| 개별 연결 없음 | 수동 입력 또는 원장 합산 등 직접 연결 근거가 없음 |
| 금액 형식 오류 | 숫자 형식·중복 청구 내역 등의 오류. 0원으로 대체하지 않음 |

비교 불가 금액은 `null`로 유지하고 화면·파일에는 ‘비교 불가’로 표시한다. 일치/금액 차이 행만 비교 합계에 포함하며, 차이 합계는 상쇄를 막기 위해 절댓값 합계를 사용한다. 불가 행이 있으면 부분 결과다. 정산·청구서 원본은 변경하지 않는다.

한 번에 최대 500개 차감 항목을 대사한다. 숙소 하위 내역은 기존 조회 도구의 5,000개 한도를 따른다. 기존 결과 크기·파일 크기·접근 만료·권한 재검사 제한을 유지한다. 계약 버전은 `workspace-v3`다.

## 화면과 출력

일치·차이·비교 불가 건수, 상태별 그래프, 행별 반영액·청구액·차이·확인 사항을 제공한다. 근거 화면에는 정산 문서·차감 항목·허용된 청구서 ID가 표시된다. 첫 50행은 화면에서 보고 전체 내역은 파일에서 확인한다.

엑셀은 요약·분석 결과·대사 상세·기준과 선택적인 팀별 시트를 만든다. PDF는 요약·범위·상태 그래프·금액 비교표·원본 참조를 포함한다. 금액 제외 시 보고서 전체에서 금액을 제거하고 대사 상태는 유지한다.

## 검증

| 항목 | 결과 |
|---|---|
| 서버·회귀·기존 화면 계산 대조 테스트 | 49개 통과. 직접 대사 경계 10개 포함 |
| 프런트 테스트 | 14개 통과 |
| Auth/Firestore 에뮬레이터 | 15개 시나리오 통과 |
| 실제 Gemini | 합성 질문 16/16 통과. 대사 전환·파일 전환·미지원 원장 대사 확인 포함 |
| 타입·lint·빌드 | 전체 typecheck와 AI 범위 타입 검사, Functions 빌드, 수정 영역 ESLint, 앱 프로덕션 빌드 및 호스팅 산출물 검증 통과 |
| 브라우저 | 실제 React 컴포넌트 + 합성 클라이언트에서 상태·차이·모바일 그래프·PDF/XLSX 다운로드 링크 확인. 390px 가로 넘침과 콘솔 경고·오류 없음 |
| 파일 | 합성 PDF 3페이지 렌더링 검수. 엑셀 숫자·비교 불가·분리 시트 및 양식 전체의 금액 제외 검증 |
| 운영 읽기 전용 확인 | 2026-08 정식 문서 ID 형식의 68건을 상한 잘림 없이 확인. 모두 미확정. 이름·금액·ID를 출력하거나 저장하지 않음 |

에뮬레이터에서는 다른 팀 청구서 및 중첩 부모 ID가 다른 숙소 내역의 금액 유출 차단, 원본 `updateTime` 불변, 분석 이후 청구액 변경 시 기존 다운로드 값 유지, 재분석 시 차이 갱신, 다른 사용자의 결과 출력 차단을 검증했다.

이전 단계의 ‘팀 평균 경비’ 타입 오류는 이번 작업 시작 시 다른 변경에서 수정되어 있었다. 해당 파일을 수정하지 않고 검사와 빌드를 다시 실행했다.

## 남은 한계와 다음 순서

- 이번 기능은 **연결된 청구서의 대사**다. 정산에 아예 연결되지 않은 신규 청구서 누락 탐색, 카드 승인 내역, 일보·지원비·급여 전체 대사는 아직 포함하지 않는다.
- 정산 당시 청구서 전체 버전이 저장되어 있지 않아 현재 청구서와 비교한다. 여러 문서를 하나의 거래 시점으로 읽는 스냅샷은 아니며, 조회 중 수정 가능성을 배제하지 않는다.
- 운영에서 확인한 8월 자료가 모두 미확정이므로 실제 확정 금액과의 대조는 여전히 미완료다. 다른 ID 형식·다른 월의 확정 유무까지 판단한 결과는 아니다.
- 브라우저 검증은 격리된 합성 클라이언트이며 운영 로그인→배포된 callable 전체 경로 검증은 남아 있다.
- 다음 개발 순서는 조회 조건·보고서 구성 저장과 현재 권한에 따른 재실행이다. 이후 누락 청구서 탐색 및 일보·지원비 대사를 각 지표 기준으로 확장한다.

배포·Git push·운영 데이터 수정·외부 발송은 실행하지 않았다. 출시 전에는 현재 작업 트리의 다른 변경과 함께 전체 `verify:project`를 실행해야 한다.

## 재현 명령

```text
npm run functions:build
node --test functions/lib/aiWorkspace/domain.test.js functions/lib/aiWorkspace/planner.test.js functions/lib/aiWorkspace/artifacts.test.js functions/lib/aiWorkspace/settlements.test.js functions/lib/aiWorkspace/reconciliation.test.js functions/lib/teamReadPolicy.test.js functions/lib/teamScopedQuery.test.js scripts/test-ai-workspace-reference.cjs
npm run test:ci -- --runTestsByPath src/features/ai-workspace/AiWorkspace.test.tsx src/features/ai-workspace/service.test.ts src/features/ai-workspace/SettlementResults.test.tsx src/features/ai-workspace/ReconciliationResults.test.tsx --runInBand
node scripts/run-ai-workspace-tests.mjs
node scripts/evaluate-ai-workspace-live.cjs --live
node scripts/audit-ai-workspace-settlements.cjs 2026-08 --limit=200
npm run typecheck -- --pretty false
node node_modules/eslint/bin/eslint.js src/features/ai-workspace functions/src/aiWorkspace
npm run build
npm run verify:hosting-build
```

실제 모델 평가는 비용이 발생하며 기존 인증·서버 설정을 사용한다. 원본 업무 자료를 모델에 전송하지 않는다. 운영 대조 스크립트는 기본 50건, `--limit`으로 최대 500건까지 검사하며 상한 판정용으로 1건을 추가 읽는다. 결과에는 건수만 기록한다.
