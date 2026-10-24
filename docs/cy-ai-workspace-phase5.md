# CY AI 업무 도우미 5차: 정산 미연결 청구서 점검

작성일: 2026-09-28. 로컬 구현·검증 기록이며 운영 배포 완료를 뜻하지 않는다.

## 사용 흐름과 범위

- “지난달 정산에 연결되지 않은 카드·숙소·차량 청구서를 찾아줘.”
- “그중 검증팀만 보여줘.”
- “금액 제외하고 상세 포함한 PDF와 팀별 엑셀 시트로 만들어줘.”
- 화면의 **현재 조건·보고서 저장**으로 저장하고 이후 최신 자료로 다시 실행한다.

`dataset=settlementMissing`을 추가했다. 기존 `settlementAudit`는 정산 차감 항목에서 연결 청구서를 찾아 금액을 비교한다. 이번 점검은 반대로 현재 확정 청구서에서 같은 팀·같은 월의 정산 ID 연결을 찾는다. 미연결이라는 사실만으로 실제 누락·미지급·오류를 확정하지 않는다.

카드·숙소·차량 세 종류를 함께 점검한다. 특정 종류만 제한하는 요청, 여러 달 누적, 전월 비교, 금액순 정렬은 아직 지원하지 않아 조건을 생략하지 않고 확인하도록 했다. 정산팀 기준 한 달 전체·이름 정렬이며, 기존 지원비 정산 적용 시작일 `2026-01-01` 이후를 지원한다.

일보·지원비·급여 원장 전체 대사, 미확정 청구서·개인 청구서, 팀 이름만 있고 ID가 없는 청구서, 정산 문서의 다른 ID 형식, 과거 청구서 버전 복원은 범위 밖이다. 현재 청구서가 정산 이후 생성·확정되었거나 의도적으로 제외되었을 수 있다.

## 분류 기준

| 상태 | 기준 |
|---|---|
| 연결 확인 | 유효한 확정 정산의 자동 차감 항목 한 건이 정확한 청구서 ID를 참조. 금액 일치는 별도 연결 대사에서 확인 |
| 미연결 후보 | 유효한 확정 정산에 직접 참조가 없고, 현재 청구액이 양수이며, 수동·원장 합산·중복·자산 식별의 모호함이 없음 |
| 판단 보류 | 중복 참조, 수동·출처 불명 차감, 같은 종류의 원장 합산 차감, 동일 자산의 여러 청구서 또는 자산 ID 불명 |
| 확정 정산 확인 불가 | 미저장·미확정·형식 오류 등으로 유효한 저장 확정 정산을 확인하지 못함 |
| 금액 형식 오류 | 금액·청구 내역을 해석할 수 없음. 금액을 0으로 대체하지 않음 |
| 후보 제외 | 직접 연결되지 않은 현재 청구액이 양수 기준에 해당하지 않음 |

알 수 없는 수동 차감은 팀 전체의 미연결 판단을 보류한다. 특정 청구 종류의 수동·원장 합산 차감은 해당 종류를 보류한다. 동일 자산의 여러 문서는 분할 청구·대체 문서·중복 여부를 임의로 결정하지 않는다. 숙소는 팀 단위 청구 문서가 여러 개면 보류한다. 실제 정산 화면의 문서 선택·금액 계산 코드를 읽고 이 기준을 정했으며, 더 넓은 자동 연결을 추정하지 않는다.

합계에는 **미연결 후보의 현재 청구액**만 더한다. 연결 확인·보류·정산 확인 불가·형식 오류 금액은 후보 합계에서 제외한다. 후보 합계를 정산 계산액에 자동 합산하지 않는다. 원본 정산·청구서·청구 내역은 수정하지 않는다.

## 조회·권한·제한

| 자료 | 위치 |
|---|---|
| 정산 | 기존 `system_configs/team_settlement_YYYY-MM__팀ID` |
| 카드 | `cardBillings` |
| 숙소 | `accommodation_billing_documents`, `accommodation_billing_line_items` |
| 차량 | `vehicle_billing_documents` |

청구서는 `yearMonth`와 현재 허용된 팀 ID/레거시 ID를 쿼리 조건으로 함께 제한한다. `team.id`, `teamId`, `assignedTeamId` 후보를 조회하고, 중첩 ID 우선순위·월·팀 청구 대상 여부를 다시 검증한다. 충돌하는 팀 별칭은 임의로 귀속하지 않는다. 단순 월 전체 또는 전체 컬렉션 조회로 재시도하지 않는다.

현재 `CONFIRMED`, `PAID`, `OVERDUE` 및 기존 한글 `확정` 상태만 점검한다. 접근 가능한 미확정·취소 등 문서는 제외 건수만 표시한다. 다른 팀·다른 월·개인 청구의 금액·메모를 반환하지 않는다. 숙소 내역은 부모의 팀·월 검증 후 조회하고 상충하는 부모 참조를 제외한다.

- 최대 50개 팀, 월·팀 쿼리로 읽은 고유 청구서 최대 500개. 미확정·취소 문서도 읽기 한도에 포함한다.
- 숙소 하위 내역은 기존 공통 조회 한도 5,000개를 따른다.
- 상한 초과는 명시적 오류다. 잘린 결과로 전체 누락 점검이 끝났다고 표시하지 않는다.
- 기존 분석 잠금·권한 재검사·저장 결과 접근 만료·파일 크기 제한을 유지한다.
- 결과 계약 버전은 `workspace-v5`다. 기존 저장 조건은 계속 읽을 수 있다.

`firestore.indexes.json`에 세 청구 컬렉션 × 세 팀 필드의 월·팀 복합 인덱스 9개를 추가했다. 기존 인덱스와 다른 작업의 변경은 유지했다. 운영 인덱스를 배포하지 않았으므로 출시 전 해당 인덱스 생성 완료를 확인해야 한다. Firestore Rules나 클라이언트 원본 접근 권한은 넓히지 않았다.

## 화면·저장·보고서

화면에는 후보·연결·판단 불가 건수, 상태 그래프, 청구서별 금액·이유, 팀별 정산 확인 범위를 표시한다. 청구서가 없는 팀도 범위 표에 남겨, 확정 정산을 확인하지 못한 상태를 빈 결과와 구분한다. 처음 50건만 화면에 표시하고 전체 내역은 파일에 반영한다.

엑셀은 요약·분석 결과·점검 범위·선택적 연결 점검 상세·팀별 시트를 만든다. PDF는 요약·기준·상태 그래프·청구서 표·팀별 범위·선택적 ID 근거를 제공한다. 금액 제외는 모든 시트와 PDF 요약·표에 적용된다.

4차 저장 분석 기능과 연결했다. 재실행 시 원본의 연결 변경을 새로 읽으며, 이미 생성된 이전 결과의 다운로드는 그때의 결과를 유지한다. 분석 저장은 과거 원본 전체를 보관하는 기능이 아니다.

## 검증

| 항목 | 결과 |
|---|---|
| 서버·기존 계산 회귀 | 65개 통과. 미연결 분류·보류·권한·날짜·상한·인덱스 구성 검사 포함 |
| 프런트 | 23개 통과. 후보/판단 불가 표시·범위·금액 제외·그래프 포함 |
| Auth/Firestore 에뮬레이터 | 25개 시나리오 통과. 신규 3개 포함 |
| 실제 Gemini | 단일 종류 제한 확인을 보강한 최종 합성 질문 21/21 통과 (`gemini-3.8-flash`) |
| 타입·lint·빌드 | 전체 타입 검사, Functions 빌드, AI 수정 범위 ESLint, 앱 빌드, 호스팅 산출물 검증 통과 |
| PDF·엑셀 | 합성 PDF 3페이지 렌더링 검수 완료. 엑셀 숫자·범위·시트와 모든 출력의 금액 제외 검사 통과 |
| 브라우저 | 합성 클라이언트에서 후보/보류·팀별 범위·390px 모바일 그래프·금액 제외·PDF/XLSX 다운로드 링크 확인. 가로 넘침과 콘솔 경고·오류 없음 |

에뮬레이터는 다른 팀·상충하는 중첩 팀·개인 청구 금액 차단, 숙소 하위 내역의 부모 충돌 차단, 원본 `updateTime` 불변, 저장 조건 재실행 시 새 연결 반영, 과거 다운로드 값 유지, 다른 계정 출력 차단을 확인했다. 해당 월 밖의 501건은 읽기 범위를 벗어나고, 범위 안의 상한 초과는 오류를 반환하고 실행 잠금을 해제한다.

모델 평가에는 합성 질문만 사용하고 기존 서버 설정을 메모리에서 읽었다. 업무 원본을 모델로 보내거나 비밀키를 기록하지 않았다. 브라우저는 실제 React 컴포넌트와 합성 서버를 사용하며 운영 로그인→배포된 callable 검증을 뜻하지 않는다. 에뮬레이터는 운영 인덱스 준비 상태를 검증하지 않는다.

운영 청구서·실제 확정 정산의 대응 결과, 운영 인덱스, 운영 로그인 흐름은 아직 검증하지 않았다. 배포·Git push·운영 원본 수정·외부 발송은 실행하지 않았다. 출시 전에는 현재 작업 트리의 다른 변경과 함께 전체 `verify:project`를 실행해야 한다.

## 재현과 다음 단계

```text
npm run functions:build
node --test functions/lib/aiWorkspace/domain.test.js functions/lib/aiWorkspace/planner.test.js functions/lib/aiWorkspace/artifacts.test.js functions/lib/aiWorkspace/settlements.test.js functions/lib/aiWorkspace/reconciliation.test.js functions/lib/aiWorkspace/savedAnalyses.test.js functions/lib/aiWorkspace/missingBilling.test.js functions/lib/teamReadPolicy.test.js functions/lib/teamScopedQuery.test.js scripts/test-ai-workspace-reference.cjs
npm run test:ci -- --runTestsByPath src/features/ai-workspace/AiWorkspace.test.tsx src/features/ai-workspace/service.test.ts src/features/ai-workspace/SettlementResults.test.tsx src/features/ai-workspace/ReconciliationResults.test.tsx src/features/ai-workspace/MissingBillingResults.test.tsx --runInBand
node scripts/run-ai-workspace-tests.mjs
node scripts/evaluate-ai-workspace-live.cjs --live
npm run typecheck -- --pretty false
node node_modules/eslint/bin/eslint.js src/features/ai-workspace functions/src/aiWorkspace
npm run build
npm run verify:hosting-build
```

다음 순서는 일보·지원비와 정산을 비교할 수 있는 기준·근거 범위를 정하는 것이다. 과거 확정 스냅샷에 없는 항목은 현재 원장 값과 섞어 확정 차이로 표현하지 않아야 한다. 정기 보고와 자연어 저장 관리 명령은 별도 후속 범위다.

후속 구현: [6차 저장 근거 점검](./cy-ai-workspace-phase6.md)에서 지원비 상세 비교와 일보 금액 근거 부족 표시를 구현하고 검증했다. 현재 원장 전체 대사는 포함하지 않는다.
