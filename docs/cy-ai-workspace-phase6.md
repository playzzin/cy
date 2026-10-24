# CY AI 업무 도우미 6차: 일보·지원비 저장 근거 점검

작성일: 2026-09-28. 로컬 구현과 검증 결과이며 운영 배포 완료를 뜻하지 않는다.

## 사용할 수 있는 요청

- “지난달 확정 정산에 저장된 일보·지원비 근거를 점검해줘.”
- “지난달 저장된 지원비 상세 합계와 확정 정산 금액을 비교해줘.”
- “금액 제외하고 상세 근거 포함한 PDF와 팀별 시트 엑셀로 만들어줘.”
- 화면에서 조건을 저장하고 현재 권한으로 다시 실행한다.

`dataset=settlementEvidence`, 계약 버전 `workspace-v6`를 추가했다. 정산팀 기준 한 달 전체, 팀 이름 정렬을 지원한다. 여러 달 누적·기간 비교·현장별 정산은 지원하지 않는다. 현재 일보와 정산의 전체 금액 대사 요청은 제한을 설명하는 확인 질문으로 반환한다. 기존 데이터셋과 저장 조건은 계속 사용할 수 있다.

## 원본 조사에서 확인한 제약

`src/types/teamSettlement.ts`와 `src/services/teamSettlementService.ts`를 기준으로 구현했다. 확정 문서의 `sourceSnapshot.dailyReports`에는 일보 ID·날짜·당시 팀/현장 정보가 있으나 작업자별 공수·단가·금액은 없다. 따라서 과거 일보 금액을 재현하거나 현재 원장 금액과 비교해 확정 차이로 표시하지 않는다. 유효한 목록 건수만 표시하고 금액은 `null` 및 **비교 근거 부족**으로 남긴다.

`sourceSnapshot.supportDetails`에는 당시 지원 방향·현장·상대팀·공수·단가·금액이 저장되어 있다. 이 상세와 저장 정산 항목 사이의 일관성은 점검할 수 있다. 저장 근거의 진위나 현재 원장 전체의 완전성을 보장하는 기능은 아니다. `capturedAt`을 정산 확정 시각으로 바꾸어 표현하지 않는다.

## 비교와 보류 기준

| 상태 | 기준 |
|---|---|
| 저장 근거 일치 | 지원 방향·현장 ID·상대팀 ID로 한 개의 자동 항목에 연결되고 공수·금액이 일치 |
| 금액 차이 | 같은 연결과 공수 조건을 충족하지만 저장 근거 합계와 정산 반영액이 다름 |
| 비교 근거 부족 | 일보 금액 근거 없음, 지원 상세 미저장·지원 버전 불명, 비교 대상이 없음 |
| 판단 보류 | 수동·수정·구형 지원 항목, ID 누락, 중복 그룹, 한쪽 연결 없음, 공수 차이, 근거가 확정 후 저장됨 |
| 확정 정산 확인 불가 | 미저장·미확정·형식 오류 등으로 유효한 확정 정산을 확인하지 못함 |
| 근거 형식 오류 | 지원 상세의 중복 ID·잘못된 날짜·다른 월·음수/비수치·공수×단가 계산 불일치 |

지원비 대상은 `내부지원간곳`, `외부지원간곳`, `내부지원온곳`, `외부지원온곳`이다. `support_fee_outgoing/incoming`과 기타 지원 종류의 수동·알 수 없는 항목은 자동 비교를 보류한다. 기존 계산과 같이 `support_outgoing/incoming` 원본 행은 중복 합산하지 않는다. `support_client_site` 매출, 도급·직영·급여·차감 전체 재계산은 이번 비교에 포함하지 않는다.

지원 근거 행 금액은 기존 함수와 동일하게 `round(공수 × round(단가))`인지 검사한다. 행별 금액을 합산하며 정산 공수는 기존 방식대로 합계를 소수 첫째 자리에서 표현한다. 차이는 **저장 근거 합계 − 정산 반영액**이고, 총 차이는 비교 가능한 항목의 절댓값 합계다. 공수가 다르면 금액 비교를 보류한다. 보류·확인 불가를 금액 0 또는 일치로 처리하지 않는다.

저장 지원 상세의 한 행이라도 형식 검증에 실패하면 해당 정산의 지원비 비교 전체를 제외한다. 식별 불명·수동 항목이 다른 그룹과 겹칠 가능성이 있으면 해당 정산의 지원비 비교 전체를 보류한다. 이름을 이용해 임의로 연결하지 않는다. 정상 연결 뒤 한 그룹에만 중복·공수 차이가 있으면 해당 그룹만 보류한다.

## 데이터·권한·출력

기존 권한 확인을 거쳐 이미 읽은 `system_configs/team_settlement_YYYY-MM__팀ID`만 사용한다. 추가 원장 조회, 현재 단가·작업자 마스터로의 보완, 자동 정산 저장은 하지 않는다. 새 Firestore 인덱스와 권한 변경이 필요하지 않다. 기존 5차 기능의 미배포 인덱스 요구사항은 별도로 남아 있다.

기존의 현재 권한 재검사·요청 잠금·계정별 최신 결과·1시간 출력 만료를 유지한다. 지원 상세 최대 10,000건, 결과 최대 500행이며 초과하면 오류로 종료한다. 전체 파일 크기와 저장 결과 크기 제한도 유지한다. 작업자 이름·ID가 포함될 수 있는 지원 상세 ID와 원문 메모는 결과에 복사하지 않는다.

화면은 상태별 건수, 표, 그래프, 저장 시각과 정산 문서/항목 ID를 제공한다. 50행 초과 내역은 파일에서 확인한다. PDF·엑셀은 동일한 서버 결과를 사용하고, 금액 제외는 요약·표·모든 시트에 적용한다. 엑셀은 선택적으로 상세와 팀별 시트를 만든다. 지원 상세 원문 전체를 내보내는 기능은 아니다.

저장한 분석을 다시 실행하면 당시의 현재 권한으로 정산·근거를 새로 읽는다. 재실행 전 기존 결과의 다운로드는 기존 값을 유지한다. 자연어 저장/삭제 관리와 정기 보고는 아직 후속 범위다.

## 실제 검증

| 검증 | 결과 |
|---|---|
| 서버·기존 계산 회귀 | 75개 통과. 과거 근거 부족·지원 비교·불량/중복/수동 자료·정렬/기간/상한·권한 검사 포함 |
| 최종 보수적 검증 보강 | 수동 지원 종류·일보 날짜 검사 보강 후 근거/기존 함수 대조 12개 재통과 |
| 프런트 | 26개 통과. 새 화면 연결·근거 부족·금액 제외·출처·그래프 포함 |
| Auth/Firestore 에뮬레이터 | 27개 시나리오 통과. 다른 팀 차단, 원본 updateTime 불변, 저장 근거 재실행과 과거 출력 유지 확인 |
| 실제 Gemini | 개인정보 없는 합성 질문 25/25 통과 (`gemini-3.8-flash`) |
| 타입·lint·빌드 | 전체 typecheck, Functions 빌드, AI 범위 ESLint, 앱 빌드, 호스팅 산출물 검증 통과 |
| PDF·엑셀 | 한글 PDF 3쪽 전부 렌더링 검수. 숫자·비교 불가·ID 근거·팀별 시트·금액 제외 검사 통과 |
| 브라우저 | 실제 React 컴포넌트 + 합성 서버에서 표·근거·모바일 그래프·저장·재실행·금액 제외·XLSX 다운로드 링크 확인. 390px 설정에서 문서 폭/스크롤 폭 375px 일치, 콘솔 경고·오류 없음 |

Gemini에는 합성 질문과 조회 조건만 전송했고 실제 업무 원본·비밀키를 로그나 문서에 기록하지 않았다. 브라우저는 운영 로그인이나 배포된 callable을 사용하지 않았다. 운영 확정 정산의 지원 근거 보유율, 실제 계정 권한별 흐름, 운영 규모의 부하·응답 시간은 미검증이다. `verify:project` 전체 출시 점검·운영 배포·Git push는 실행하지 않았다.

재현 명령:

```text
npm run functions:build
node --test functions/lib/aiWorkspace/domain.test.js functions/lib/aiWorkspace/planner.test.js functions/lib/aiWorkspace/artifacts.test.js functions/lib/aiWorkspace/settlements.test.js functions/lib/aiWorkspace/reconciliation.test.js functions/lib/aiWorkspace/savedAnalyses.test.js functions/lib/aiWorkspace/missingBilling.test.js functions/lib/aiWorkspace/settlementEvidence.test.js functions/lib/teamReadPolicy.test.js functions/lib/teamScopedQuery.test.js scripts/test-ai-workspace-reference.cjs
npm run test:ci -- --runTestsByPath src/features/ai-workspace/AiWorkspace.test.tsx src/features/ai-workspace/service.test.ts src/features/ai-workspace/SettlementResults.test.tsx src/features/ai-workspace/ReconciliationResults.test.tsx src/features/ai-workspace/MissingBillingResults.test.tsx src/features/ai-workspace/EvidenceResults.test.tsx --runInBand
node scripts/run-ai-workspace-tests.mjs
node scripts/evaluate-ai-workspace-live.cjs --live
npm run typecheck -- --pretty false
node node_modules/eslint/bin/eslint.js src/features/ai-workspace functions/src/aiWorkspace
npm run build
npm run verify:hosting-build
```

## 다음 순서

다음 구현은 저장한 분석을 자연어로 찾고 실행하는 관리 흐름으로 이어갈 수 있다. 일보 금액 대사를 확장하려면 미래 정산에 보존할 근거 항목·버전·보관 및 접근 규칙부터 설계해야 한다. 기존 과거 정산을 현재 원장 값으로 소급 보완해서는 안 된다. 정기 보고는 실행 시 권한 재검사·중복 실행 방지·결과 보관·실패 처리까지 설계한 뒤 별도 단계로 진행한다.

후속 구현: [7차 자연어 검색·실행](./cy-ai-workspace-phase7.md)에서 저장 목록 검색, 후보 선택, 이전 검색 참조 실행을 구현하고 검증했다.
