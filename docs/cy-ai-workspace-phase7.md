# CY AI 업무 도우미 7차: 저장한 분석의 자연어 검색·실행

작성일: 2026-09-28. 로컬 구현·검증 기록이며 운영 배포 완료를 뜻하지 않는다.

## 사용할 수 있는 요청

- “내가 저장한 분석 목록 보여줘.”
- “저장한 월간 현장 보고 찾아줘.”
- “저장한 월간 현장 보고를 그대로 실행해줘.”
- 검색 후 “그 분석 다시 실행해줘.”

`savedFind`, `savedRun` 해석과 `saved: {query, usePrevious}`를 추가했다. 계약 버전은 `workspace-v7`이다. 저장 목록·이름·조건을 Gemini에게 전달해 대상을 고르게 하지 않는다. 모델은 사용자 문장에서 검색어와 실행 의도만 추출하고, 서버가 현재 계정의 저장 목록에서 이름을 찾는다. 기존 저장 조건은 그대로 읽을 수 있다.

## 선택과 실행 기준

| 요청·결과 | 처리 |
|---|---|
| 목록 조회 또는 이름 검색 | 조건 카드를 표시하고 업무 원본을 새로 집계하지 않음 |
| 실행 요청 + 정확한 이름 한 건 | 저장한 조건으로 최신 자료 조회 |
| 부분 이름·빈 검색어·같은 이름 여러 건 | 후보와 기간·대상·출력 설정을 표시하고 버튼 선택을 기다림 |
| 이전 검색 결과 한 건을 가리키는 실행 | 서버에 보관한 후보 ID·버전으로 실행 |
| 이전 후보 여러 건 | 임의로 첫 항목을 실행하지 않고 선택을 요구 |
| 0건 | 빈 검색 결과와 목록 전체 조회 안내 |
| 순서 지정·일괄 실행·조건 변경을 섞은 실행 | 지원 범위를 설명하는 확인 질문 |

이름은 Unicode NFKC·공백 제거·대소문자 정규화 후 비교한다. 정확히 같은 이름이 여러 개면 그대로 후보로 남긴다. 부분 일치는 단순 문자열 포함 검색이며 정규식이나 모델 추측으로 실행 대상을 고르지 않는다.

실행 시 저장된 기간 방식·필터·보고서 구성을 유지한다. 월 자동 변경은 기존 한국 시간 기준 규칙을 따른다. 기간·대상·금액 제외·파일 형식을 바꾸려면 먼저 실행하고 후속 분석/출력 요청을 한다. 저장 목록만 조회한 상태의 PDF 요청은 먼저 실행하도록 안내한다.

자연어로 새 조건 저장·덮어쓰기·삭제·이름 변경·공유하는 기능은 이번 범위에 포함하지 않는다. 기존 화면에서 조건 저장·덮어쓰기·삭제가 가능하다. 타인 목록 조회나 일괄 실행도 추가하지 않았다.

## 권한·변경·만료 처리

- 기존 `server_settings/ai_workspace/saved_analyses/{uid}`에서 현재 계정 목록만 읽는다. 최대 20개 제한은 동일하다.
- 검색 결과 선택은 기존 서버 세션에 임의 토큰·후보 ID/버전·접근 범위 해시·1시간 만료만 기록한다. 원문 질문이나 새로운 분석 결과를 저장하지 않는다.
- 후속 실행은 토큰·계정 권한·현재 항목 버전을 확인한다. 만료·다른 계정·새 검색에 의해 교체된 선택·수정/삭제된 항목은 다시 찾도록 한다.
- 정확한 이름 실행도 기존 재실행 경로를 사용한다. 현재 대상 접근 권한, 실행 잠금, 분당 한도, 완료 직전 항목 버전과 권한을 다시 확인한다.
- 정상 분석 완료 시 이전 검색 선택을 지운다. 후보 검색만 했을 때는 기존 서버 결과를 덮어쓰지 않는다.
- 화면에 남은 이전 분석 결과가 만료되어도 새로운 저장 목록 검색과 재실행은 가능하다. 만료·접근 불가 결과의 계획을 모델 문맥으로 보내지 않으며 일반 후속 분석과 출력은 기존 검증을 유지한다.
- 저장 목록 검색과 실행은 저장 조건 및 일보·정산 원본을 수정하지 않는다. Firestore 규칙·인덱스·외부 발송 권한은 변경하지 않았다.

검색 결과 카드는 기존 저장 목록과 같은 요약을 사용한다. 후보 번호는 화면에서 구분하는 접근성 이름이며 서버가 순서로 실행하는 명령이 아니다. 확인 질문에서 후보 선택을 안내할 때는 기존 카드와 선택 문맥을 유지한다. 새 대화·늦은 응답 무시·계정 변경 시 결과 폐기 규칙도 유지한다.

## 실제 검증

| 항목 | 결과 |
|---|---|
| 서버·기존 계산 회귀 | 전체 82개 통과. 이후 확인 질문 정규화 회귀 1개를 추가하고 영향 범위 26개 재통과: 고유 사례 총 83개 |
| 프런트 | 최종 32개 통과. 목록 표시·후속 토큰·후보 선택·중복 이름·0건·초기화·확인 후 후보 유지 포함 |
| Auth/Firestore 에뮬레이터 | 31개 시나리오 통과. 신규 4개는 자연어 검색/실행·계정 격리·원본 불변·만료/변경/중복·권한 축소 검사 |
| 실제 Gemini | 최종 합성 질문 35/35 통과 (`gemini-3.8-flash`) |
| 타입·lint·빌드 | 전체 typecheck 및 마지막 UI 변경 후 범위 타입 검사, Functions 빌드, AI 범위 ESLint 통과. 최종 앱 빌드·호스팅 산출물 검증 통과 |
| 문서 출력 | 기존 PDF·엑셀 회귀 통과. 자연어 재실행 결과의 금액 제외 설정과 XLSX 내용 일치 확인 |
| 브라우저 | 실제 React 컴포넌트와 합성 서버에서 목록·부분 이름·다중 후보 보류·후속 실행·후보 버튼·확인 후 후보 유지·엑셀 링크 확인. 390px 설정에서 문서 폭과 스크롤 폭 375px 일치 |

초기 모델 시험에서 세 확인 질문이 검색 이름을 함께 반환해 계획 검증에서 거절됐다. 확인 질문에 남은 이름은 형식을 검사한 뒤 버리고 실행 명령으로 취급하지 않도록 보완했다. 새 테스트로 확인 질문이 조회·실행을 허용하지 않는다는 것을 검증했고 최종 모델 시험은 모두 통과했다.

모델 평가는 고정된 합성 질문만 사용했다. 진단 파일도 합성 모델 응답만 기록하며 요청 헤더·비밀키·업무 원본은 기록하지 않는다. 에뮬레이터 종료 경고가 한 번 있었으나 종료 후 시험용 Auth/Firestore 포트가 닫힌 것을 확인했다.

운영 로그인→배포 callable 흐름, 실제 사용자 저장 항목, 운영 부하·지연시간은 미검증이다. 실제 Gemini 사례 한 건의 응답이 약 33.5초 걸렸으므로 이번 평가만으로 응답 속도 목표 충족을 주장하지 않는다. 배포·Git push·업무 원본 수정은 수행하지 않았다. 출시 전 전체 `verify:project`와 다른 작업 변경의 통합 점검은 남아 있다.

재현 명령:

```text
npm run functions:build
node --test functions/lib/aiWorkspace/domain.test.js functions/lib/aiWorkspace/planner.test.js functions/lib/aiWorkspace/artifacts.test.js functions/lib/aiWorkspace/settlements.test.js functions/lib/aiWorkspace/reconciliation.test.js functions/lib/aiWorkspace/savedAnalyses.test.js functions/lib/aiWorkspace/missingBilling.test.js functions/lib/aiWorkspace/settlementEvidence.test.js functions/lib/aiWorkspace/savedCommands.test.js functions/lib/teamReadPolicy.test.js functions/lib/teamScopedQuery.test.js scripts/test-ai-workspace-reference.cjs
npm run test:ci -- --runTestsByPath src/features/ai-workspace/AiWorkspace.test.tsx src/features/ai-workspace/service.test.ts src/features/ai-workspace/SettlementResults.test.tsx src/features/ai-workspace/ReconciliationResults.test.tsx src/features/ai-workspace/MissingBillingResults.test.tsx src/features/ai-workspace/EvidenceResults.test.tsx --runInBand
node scripts/run-ai-workspace-tests.mjs
node scripts/evaluate-ai-workspace-live.cjs --live
npm run typecheck -- --pretty false
node node_modules/eslint/bin/eslint.js src/features/ai-workspace functions/src/aiWorkspace
npm run build
npm run verify:hosting-build
```

## 다음 순서

8차는 제품 안의 정기 보고 기능이다. 저장 분석의 예약 설정, 실행 시 최신 권한, 중복 실행 방지, 결과 보관과 만료, 실패 기록·재실행을 함께 설계하고 구현해야 한다. 외부 메일·메신저 발송은 별도 범위다. 9차는 전체 통합 점검·실제 계정 검증·운영 설정과 출시 준비로 묶는다. 과거 일보 금액 복원은 당시 근거가 없어 별도 확장 과제로 남긴다.

후속 구현: [8차 정기 보고 기록](./cy-ai-workspace-phase8.md).
