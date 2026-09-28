# CY AI 업무 도우미 2차 구현·검증 기록

작성일: 2026-09-28. 로컬 구현 결과이며 운영 배포 완료를 뜻하지 않는다.

후속 진행: [3차 구현 기록](./cy-ai-workspace-phase3.md)에 연결 청구서 대사, 실제 Gemini 16문항 평가, 이전 전체 빌드 오류 해소 및 운영 8월 68건 확인 결과를 정리했다. 아래는 2차 작업 당시 기록이다.

## 이번 단계의 결과

기존 일보·인력 검색에 **저장된 월별 확정 팀 정산과 정산에 반영된 차감 비용**을 추가했다. `/reports/ai-workspace`에서 다음 요청을 처리한다.

- “지난달 팀별 확정 정산과 차감 비용을 보여줘.”
- “7월 확정 정산과 비교해줘.”
- “같은 결과를 PDF와 엑셀로 만들어줘.”
- “금액 열을 제외해줘.”

실제 Gemini `gemini-3.8-flash`로 대표 합성 질문 12개를 평가해 12개 모두 통과했다. 월 해석, 대상 축소, 이전 대상 유지, 비교, PDF·엑셀 전환, 금액 제외, 계좌 등록 여부 검색, 비공개 정보·수정 요청 거절, 확정 정산, 여러 달 누적 정산의 확인 요청을 포함한다. 이것은 소규모 평가 결과이며 기획의 120문항 정확도 목표를 달성했다는 뜻은 아니다.

키는 기존 서버 설정에서 메모리로만 읽었다. 질문은 합성 내용만 사용했고 원본 정산·금액·실명·메모는 Gemini에 전달하지 않았다. 설정 변경이나 운영 데이터 쓰기는 하지 않았다.

## 정산 기준

기존 `TeamSettlementStatisticsPage.tsx`의 `buildTeamStats`와 `teamSettlementService.ts`의 `stripSupportOriginalLines`를 원본으로 확인했다.

```text
정산 계산액 = 매출 - 매입 - 차감 + 추가 + 전월 이월 + 입금/정산조정
```

읽기 대상은 `system_configs/team_settlement_YYYY-MM__팀ID`의 저장된 `data`다. `confirmedAt`이 있는 확정 자료만 포함하고, UI 서비스의 조회 중 자동 재집계·저장 기능은 호출하지 않는다. 현재 계정이 조회할 수 있는 팀의 정확한 문서 ID만 읽으며 팀은 최대 500개로 제한한다.

레거시 지원 원본(`sales.support_outgoing`, `purchases.support_incoming`)은 기존 서비스와 동일하게 제외한다. 차감의 `origin`으로 카드·숙소·차량·급여·기타를 나눈다. 원장 지출을 정산 차감에 다시 더하지 않는다. 레거시 수동 차감 중 원인 정보가 없는 것은 기타로 분류한다.

정산 계산액은 실지급액이나 회계상 순이익과 다르다. 여러 팀 합계는 내부거래 제거 전 단순 합계다. 이월을 여러 달 더하는 오류를 막기 위해 조회 기간과 비교 기간은 각각 완전한 한 달로 제한한다. 원장 대사, 현장별 정산, 실제 지급액, 여러 달 누적 정산은 이번 범위에 포함하지 않는다.

미확정 자료는 제외 사실을 알린다. 잘못된 금액·중복 내역 ID·문서 ID와 본문 불일치는 문서 전체를 제외하고 부분 결과로 표시한다. 현재 기간에 없는 전기 팀도 비교표에 남긴다. 음수 정산 계산액과 증감은 그대로 표시한다. 상세는 현재 기간에만 해당하며 비교 기간은 팀별 합계로 제공한다.

## 화면과 파일

확정 건수·정산 계산액·차감 합계, 팀별 전월 비교, 매출/매입/차감/추가/이월/입금 구성, 비용 종류별 표·그래프, 원본 문서 ID·확정 시각을 표시한다.

PDF는 정산 요약·계산 기준·비용 그래프·비교표·팀별 구성·상세를 포함한다. 엑셀은 요약·분석 결과·차감 비용·정산 구성·정산 상세·기준 및 선택적인 팀별 시트를 만든다. 금액 제외 시 모든 시트와 PDF에서 숫자 금액을 제거한다. 재출력 요청은 저장된 결과를 사용하며 안내 문구에도 이전 금액을 반복하지 않는다.

기존 최신 결과 1시간 접근 만료, 출력 직전 권한 재확인, 파일 5MB, PDF 상세 2,000행 제한을 유지한다. 정산 전체 상세는 10,000행 한도다. 계약 버전은 `workspace-v2`이며 서버/프런트 계약 일치를 테스트한다.

## 검증 결과와 한계

| 검증 | 결과 |
|---|---|
| 실제 Gemini 합성 질문 | 12/12 통과 |
| 서버 단위·기존 권한 회귀·원본 계산 대조 | 38/38 통과. 기존 화면 계산 함수를 실제 추출한 3개 사례 포함 |
| 프런트 테스트 | 11/11 통과 |
| Auth/Firestore 에뮬레이터 | 13/13 통과. 팀장 다른 팀 차단, 관리자 범위, 원본 정산 변경 없음, 파일 출력 및 권한 회수 포함 |
| 정적 검사 | Functions 빌드, AI 프런트 범위 타입 검사, 수정 범위 ESLint 통과 |
| 브라우저 | 실제 React 화면 + 합성 클라이언트. 610,000원 합계, 310,000원 차감, 전기 전용 팀 -610,000원 증감, 모바일 그래프, PDF/XLSX 링크 확인. 390px 화면 넘침 없음. 콘솔 경고·오류 없음 |
| PDF·엑셀 | 최종 합성 PDF 3페이지를 Poppler로 렌더링해 한글·표·상세·페이지 번호 확인. 엑셀 숫자 타입·합계·팀별 시트·금액 제외 검증 |
| 운영 자료 읽기 전용 확인 | 2026-08 첫 50건이 모두 미확정. 조회 상한에 도달했으므로 전체 월의 확정 유무는 알 수 없고, 실제 확정 금액 대조는 미완료 |
| 프로젝트 전체 typecheck/build | 이번 작업 밖 `src/features/team-expense-average/`에서 타입 오류로 실패. 전체 검증 통과 또는 출시 가능 상태로 보고하지 않음 |

전체 타입 검사에는 `teamExpenseAverage.ts`의 작업자 `teamName` 필드 오류 2건이 나왔다. 프로덕션 빌드에서는 같은 기능 테스트의 `teamId: null` 타입 오류가 보고됐다. 해당 영역은 다른 변경이 진행 중인 파일이므로 수정하지 않았다. 프로덕션 빌드가 실패해 후속 호스팅 빌드 검증은 실행하지 않았다.

브라우저 검증은 앱 전체 로그인·전역 제공자·배포된 callable을 통과하는 운영 검증과 다르다. 기존 Firebase 권한 경로는 에뮬레이터에서 검증했다. 운영 자료에서 확정값이 확인되지 않은 것을 0원 또는 정확도 통과로 해석하지 않는다.

## 재현

```text
npm run functions:build
node --test functions/lib/aiWorkspace/domain.test.js functions/lib/aiWorkspace/planner.test.js functions/lib/aiWorkspace/artifacts.test.js functions/lib/aiWorkspace/settlements.test.js functions/lib/teamReadPolicy.test.js functions/lib/teamScopedQuery.test.js scripts/test-ai-workspace-reference.cjs
npm run test:ci -- --runTestsByPath src/features/ai-workspace/AiWorkspace.test.tsx src/features/ai-workspace/service.test.ts src/features/ai-workspace/SettlementResults.test.tsx --runInBand
node scripts/run-ai-workspace-tests.mjs
node node_modules/eslint/bin/eslint.js src/features/ai-workspace functions/src/aiWorkspace
node scripts/evaluate-ai-workspace-live.cjs --live
node scripts/audit-ai-workspace-settlements.cjs 2026-08
```

마지막 두 명령은 기존 Google 인증과 네트워크를 사용한다. `--live` 평가는 실제 Gemini 요청 비용이 발생한다. 읽기 전용 대조는 한 달 최대 51개를 읽어 첫 50개만 검사하고 이름·금액·ID·메모를 출력하지 않는다. 대조 결과는 건수만 저장한다. 실제 모델 평가 결과도 합성 질문과 구조화된 계획만 저장한다.

## 다음 순서

1. 전체 프로젝트의 다른 변경에서 발생한 타입 오류가 해결된 뒤 최종 빌드·호스팅 검증을 다시 실행한다.
2. 승인된 확정 정산 샘플과 실제 로그인 계정으로 기존 정산 화면·AI·다운로드 금액을 대조한다.
3. 일보·정산·지원 원장을 연결하는 대사 기능을 추가한다. 현재 원장 중복 합산을 피하는 것은 대사 기능 완성과 다르다.
4. 조회 조건·보고서 구성을 저장하고 현재 권한으로 재실행하는 기능을 추가한다.
5. 실행 이력·비용·실패 처리가 갖춰진 뒤 정기 보고를 연결한다.

이번 단계에서 배포, Git push, 운영 데이터 수정, 외부 메시지 발송은 하지 않았다.
