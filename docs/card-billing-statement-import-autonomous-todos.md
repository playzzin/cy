# 국민은행 카드 청구 PDF 일괄등록 자율개발 TODO

## 목표

`/support/cards`에서 매월 내려받은 국민은행 카드 청구 PDF 여러 장을 한 번에 업로드하고, `/settings/ai`에 저장된 서버용 Gemini API Key로 분석한 뒤, 카드별 월원장과 카드 청구문서에 검수 후 저장한다.

완성 기준은 다음과 같다.

- PDF 여러 장을 한 번에 등록할 수 있다.
- 분석 결과가 등록된 카드와 자동 매칭된다.
- 사용자 검수 전에는 원장/청구문서에 반영하지 않는다.
- 카드별 합계, 파일별 합계, 전체 총액, 미매칭 금액, 오류 건수가 표시된다.
- `CONFIRMED`, `PAID`, `OVERDUE` 카드 청구문서는 자동 덮어쓰기 되지 않는다.
- 같은 PDF를 다시 올려도 중복 거래/중복 청구가 생기지 않는다.
- 서버 Gemini API Key는 클라이언트에 노출하지 않는다.

## 현재 코드 기준점

- 라우트: `/support/cards`
  - `src/pages/support/SupportManagerPage.tsx`
  - `src/pages/support/CardManagerPage.tsx`
  - `src/components/card/CardMonthlyLedger.tsx`
- 기존 카드 청구 수동/단건 분석 UI:
  - `src/components/card/CardBillingManager.tsx`
  - 이 컴포넌트는 `analyzeCardBillingStatement` Cloud Function을 호출하지만, 현재 `functions/src/index.ts`에는 해당 함수 export가 없다.
- 카드 저장 서비스:
  - `src/services/cardService.ts`
  - `src/services/cardBillingService.ts`
  - `src/services/cardMonthlyLedgerMutationService.ts`
  - `src/services/cardFirestoreService.ts`
- 타입/스키마:
  - `src/types/card.ts`
  - `src/types/cardBilling.ts`
  - `src/types/zod/cardSchema.ts`
- AI 설정:
  - `src/pages/settings/AISettingsPage.tsx`
  - `src/services/aiSettingsService.ts`
  - `src/services/serverAiSettingsService.ts`
  - `functions/src/serverAiSettings.ts`
- 참고 서버 Gemini 구현:
  - `functions/src/partnerRecognition.ts`

## 비범위

- 국민은행 사이트 자동 로그인/자동 다운로드는 이번 범위에 넣지 않는다.
- AI가 분석 결과를 즉시 확정 저장하는 흐름은 만들지 않는다.
- 확정/지급/연체 청구문서를 자동 수정하지 않는다.
- 모든 카드사 양식 대응은 하지 않는다. MVP는 국민은행 PDF 기준으로 만든다.

## 핵심 UX

`/support/cards`의 카드 월원장 탭 상단에 `PDF 일괄등록` 버튼을 추가한다.

모달은 3단계로 구성한다.

1. 업로드
   - 선택 월 표시
   - PDF 다중 선택 또는 드래그앤드롭
   - 파일별 업로드 상태
   - PDF 외 파일 차단
   - 파일 크기 제한 안내

2. AI 분석 결과 검수
   - 전체 요약: 총 파일 수, 분석 완료 수, 전체 청구액, 반영 예정액, 미매칭 금액, 오류 건수
   - 파일별 요약: 파일명, 청구월, PDF 총액, 분석 상태, 경고
   - 카드별 그룹: 카드명, 뒤 4자리, 매칭 카드, 청구액, 거래 건수, 신뢰도
   - 거래 상세: 사용일자, 가맹점, 금액, 분류, 메모, 신뢰도
   - 매칭 실패 항목은 사용자가 카드 선택 가능
   - 낮은 신뢰도/합계 불일치 항목은 저장 전 확인 필요

3. 저장
   - 저장 전 최종 검증 결과 표시
   - 저장 대상/스킵 대상/오류 대상 분리
   - 저장 후 생성/갱신된 거래 수, 청구문서 수, 스킵 수 표시

## 데이터 모델

### `cardStatementImportJobs`

```ts
type CardStatementImportJobStatus =
  | 'draft'
  | 'uploading'
  | 'queued'
  | 'analyzing'
  | 'reviewing'
  | 'committing'
  | 'completed'
  | 'failed';

interface CardStatementImportJob {
  id: string;
  yearMonth: string;
  status: CardStatementImportJobStatus;
  bankName: 'KB국민은행' | string;
  totalFiles: number;
  uploadedFiles: number;
  analyzedFiles: number;
  totalCards: number;
  matchedCards: number;
  needsReviewCards: number;
  totalTransactions: number;
  committedTransactions: number;
  totalAmount: number;
  matchedAmount: number;
  unconfirmedAmount: number;
  errorCount: number;
  warningCount: number;
  createdByUid?: string;
  createdByName?: string;
  errorMessage?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
}
```

### `cardStatementImportFiles`

```ts
type CardStatementImportFileStatus =
  | 'uploaded'
  | 'analyzing'
  | 'completed'
  | 'failed';

interface CardStatementImportFile {
  id: string;
  jobId: string;
  yearMonth: string;
  storagePath: string;
  originalFileName: string;
  mimeType: 'application/pdf';
  size: number;
  sha256?: string;
  status: CardStatementImportFileStatus;
  statementMonth?: string;
  grandTotalAmount?: number;
  cardCount: number;
  transactionCount: number;
  warnings: string[];
  errorMessage?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `cardStatementImportResults`

```ts
type CardStatementImportResultStatus =
  | 'matched'
  | 'needs_review'
  | 'excluded'
  | 'committed'
  | 'failed';

interface CardStatementImportResult {
  id: string;
  jobId: string;
  fileId: string;
  yearMonth: string;
  statementMonth?: string;
  cardLast4?: string;
  cardName?: string;
  holderName?: string;
  matchedCardId?: string;
  matchedCardLabel?: string;
  matchConfidence: number;
  status: CardStatementImportResultStatus;
  subtotalAmount: number;
  transactionCount: number;
  transactions: CardStatementImportedTransaction[];
  warnings: string[];
  errorMessage?: string;
  committedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface CardStatementImportedTransaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  category: 'FUEL' | 'TOLL' | 'MEAL' | 'MATERIAL' | 'OTHER';
  memo?: string;
  confidence: number;
}
```

## Storage 경로

```txt
card-billing-statements/{yearMonth}/imports/{jobId}/{fileId}-{safeFileName}.pdf
```

`cardBillings.statementAttachmentPaths`에는 저장에 반영된 원본 PDF 경로를 추가한다.

## Gemini 분석 스키마

서버 함수는 Gemini structured output을 사용한다.

```ts
interface GeminiKbCardStatementOutput {
  bankName: string;
  statementMonth: string;
  grandTotalAmount: number;
  cards: Array<{
    cardLast4: string;
    cardName?: string;
    holderName?: string;
    subtotalAmount: number;
    transactions: Array<{
      date: string;
      merchant: string;
      amount: number;
      category: 'FUEL' | 'TOLL' | 'MEAL' | 'MATERIAL' | 'OTHER';
      memo?: string;
      confidence: number;
    }>;
    warnings: string[];
    confidence: number;
  }>;
  warnings: string[];
}
```

프롬프트 요구사항:

- 국민은행/KB 카드 청구서 PDF임을 전제로 읽는다.
- 청구월은 `yyyy-MM`으로 반환한다.
- 금액은 원화 정수로 반환하고 쉼표는 제거한다.
- 취소/환불/마이너스 금액은 음수로 반환한다.
- 카드번호는 보이는 마지막 4자리만 반환한다.
- 카드별 subtotal과 거래 합계가 다르면 warning에 남긴다.
- 전체 총액과 카드별 subtotal 합계가 다르면 warning에 남긴다.
- 분류가 애매하면 `OTHER`로 둔다.
- 읽을 수 없는 값은 추측하지 말고 warning에 남긴다.

## 서버 함수 TODO

### KB-CARD-01. 단건 분석 함수 복구

목표: 기존 `CardBillingManager`가 호출하는 `analyzeCardBillingStatement`를 실제로 동작하게 한다.

작업:

- `functions/src/cardBillingStatementAnalysis.ts` 신설
- `functions/src/index.ts`에서 `analyzeCardBillingStatement` export
- `getServerGeminiSettings()` 사용
- Storage PDF 다운로드 후 base64 `inlineData`로 Gemini 호출
- `responseMimeType: 'application/json'` 및 `responseJsonSchema` 사용
- 응답 normalize/sanitize 함수 작성
- 호출자는 관리자 또는 지원/정산 권한 사용자만 허용

완료 기준:

- 기존 `CardBillingManager`의 단건 Gemini 분석 버튼이 더 이상 missing function 오류를 내지 않는다.
- API Key가 없으면 `/settings/ai`에서 서버용 Gemini API Key를 설정하라는 오류가 나온다.
- PDF 분석 결과가 `{ totalAmount, items }` 호환 형태도 함께 반환되어 기존 UI가 깨지지 않는다.

### KB-CARD-02. 배치 분석 함수 추가

목표: 여러 PDF를 한 작업으로 분석한다.

작업:

- `createCardStatementImportJob`
- `analyzeCardStatementImportJob`
- `commitCardStatementImportJob`
- 필요 시 `getCardStatementImportJobStatus`
- job/file/result 문서 생성 및 상태 전이
- 파일별 실패가 전체 작업 실패로 이어지지 않도록 부분 성공 처리

완료 기준:

- 파일 10개 중 1개 실패 시 9개 결과는 검수 가능하다.
- job 문서의 카운트/금액 요약이 result 기준으로 재계산된다.
- 분석 중복 실행 시 같은 file/result를 덮어쓰며 중복 result가 생기지 않는다.

### KB-CARD-03. 카드 자동 매칭

목표: PDF의 카드 뒤 4자리/카드명/소지자명으로 `cards` 문서와 매칭한다.

작업:

- `last4` 정확 일치 우선
- `maskedNumber`에 뒤 4자리 포함 시 후보
- 카드명/메모/현재 배정자명 보조 점수
- 후보가 1개이고 점수 기준 이상이면 `matched`
- 후보가 여러 개이거나 낮은 점수면 `needs_review`

완료 기준:

- 같은 last4 카드가 여러 개면 자동 저장 대상이 아니라 검수 대상으로 남는다.
- 매칭 점수와 매칭 사유가 UI에 표시 가능하도록 result에 저장된다.

### KB-CARD-04. 저장 커밋 함수

목표: 검수 완료된 result를 카드 월원장/청구문서로 반영한다.

작업:

- result별 `matchedCardId` 필수 검증
- `yearMonth`와 `statementMonth` 불일치 시 사용자가 강제 승인한 항목만 저장
- 거래 id는 deterministic id 사용
- 추천 id:
  - `card-statement__{yearMonth}__{cardId}__{fileHashOrFileId}__{transactionIndex}`
- `cardTransactions`에는 상세 거래 또는 카테고리 집계 저장 정책 중 하나를 명확히 선택
- MVP 권장: 상세 거래 저장, `merchant`와 `date` 보존
- `cardBillings`는 기존 `CardMonthlyLedger`의 청구 대상 계산 규칙과 충돌하지 않게 생성
- 확정/지급/연체 청구문서가 있으면 스킵하고 warning 반환
- `statementAttachmentPaths`에 원본 PDF 경로 추가
- result status를 `committed`로 변경

완료 기준:

- 같은 job을 두 번 commit해도 거래 수와 청구문서 수가 늘어나지 않는다.
- posted 청구문서는 수정되지 않고 스킵 목록에 남는다.
- 저장 실패 시 job/result에 오류가 남고 이미 저장된 항목을 추적할 수 있다.

## 클라이언트 TODO

### KB-CARD-05. Import 서비스 추가

파일:

- `src/services/cardStatementImportService.ts`
- `src/types/cardStatementImport.ts`

작업:

- Storage 업로드 함수
- callable wrappers
- job/result 조회 함수
- 금액/상태 요약 helper

완료 기준:

- UI 컴포넌트가 Firebase 세부 구현을 직접 알지 않는다.
- callable 타입이 명시되어 있다.

### KB-CARD-06. PDF 일괄등록 모달

파일:

- `src/components/card/CardStatementImportModal.tsx`
- 필요 시 `src/components/card/CardStatementImportReviewTable.tsx`

작업:

- 3단계 wizard 구현
- 다중 파일 선택
- 업로드 진행률
- 분석 시작/재분석
- 결과 테이블
- 카드 매칭 수동 변경
- 저장 전 경고 확인
- 저장 결과 summary

완료 기준:

- 파일 없이 분석 버튼을 누르면 명확한 안내가 나온다.
- 미매칭 결과가 있으면 저장 버튼이 비활성화되거나 확인 필요 상태로 표시된다.
- 전체 총액/카드별 합계가 항상 화면에 표시된다.

### KB-CARD-07. `/support/cards` 월원장 연결

파일:

- `src/components/card/CardMonthlyLedger.tsx`
- 필요 시 `src/pages/support/CardManagerPage.tsx`

작업:

- 월원장 상단에 `PDF 일괄등록` 버튼 추가
- 현재 `yearMonth`를 import 모달에 전달
- commit 성공 후 `loadData()` 재호출
- 월원장 요약에 PDF 반영 총액 표시

완료 기준:

- 사용자가 월원장 월을 바꾸면 import 모달의 월도 같은 값으로 시작한다.
- commit 후 새로고침 없이 원장 금액과 청구 상태가 갱신된다.

### KB-CARD-08. 기존 `CardBillingManager` 정리

목표: 기존 단건 첨부 분석 UI와 새 배치 기능이 서로 충돌하지 않게 한다.

작업:

- 단건 분석 함수 응답 호환 유지
- 새 배치 기능은 `/support/cards` 중심으로 노출
- 통합 차량/카드 화면에서 `CardBillingManager`를 계속 쓸 경우 단건 분석도 정상 동작하게 유지

완료 기준:

- 기존 단건 청구서 첨부 분석 버튼이 깨지지 않는다.
- 새 배치 저장이 기존 카드 청구 로그에 기록된다.

## 보안/권한 TODO

### KB-CARD-09. Firestore Rules

작업:

- `cardStatementImportJobs`
- `cardStatementImportFiles`
- `cardStatementImportResults`

위 컬렉션을 지원/정산/관리 권한에서 읽고 쓸 수 있게 추가한다.

완료 기준:

- 일반 로그인 사용자가 권한 없이 import 결과를 조작할 수 없다.
- 관리자/허용 역할은 job 생성, 검수 수정, commit 상태 조회가 가능하다.

### KB-CARD-10. Storage Rules

작업:

- `card-billing-statements/{yearMonth}/imports/{jobId}/...`
- PDF만 허용
- 크기 제한
- 인증/권한 확인

완료 기준:

- 비로그인 업로드 불가
- PDF가 아닌 파일 업로드 불가

## 로그/관측성 TODO

### KB-CARD-11. 감사 로그

작업:

- `cardBillingLogService` 또는 별도 import log에 다음 이벤트 기록
  - job created
  - file uploaded
  - analysis completed/failed
  - result manually matched
  - commit completed/failed
- `support_write_operations`에도 commit operationId 기록 검토

완료 기준:

- 어떤 PDF가 어떤 카드/거래/청구문서로 반영됐는지 추적 가능하다.
- 실패한 commit을 operationId로 찾을 수 있다.

## 테스트 TODO

### KB-CARD-12. 순수 로직 테스트

추가 후보:

- `src/services/cardStatementImportService.test.ts`
- `src/utils/cardStatementImportMatching.test.ts`
- `src/utils/cardStatementImportTotals.test.ts`

검증:

- last4 단일 매칭
- last4 중복 후보
- 월 불일치
- subtotal 합계 불일치
- 음수 거래 포함
- 같은 파일 재커밋 idempotent id 생성

### KB-CARD-13. 저장 로직 테스트

검증:

- 신규 카드 거래 생성
- 같은 commit 재실행 시 중복 없음
- posted 청구문서 보호
- 미매칭 result 저장 차단
- 일부 result 실패 시 나머지 성공 결과 보존

### KB-CARD-14. 빌드 검증

필수 명령:

```bash
npm run typecheck
npm --prefix functions run build
npm test -- --watchAll=false --runInBand
```

가능하면 추가:

```bash
npm run build
```

## 구현 순서

1. `cardStatementImport` 타입과 순수 매칭/합계 유틸 작성
2. 단건 `analyzeCardBillingStatement` Cloud Function 복구
3. 배치 job/file/result Cloud Function 작성
4. callable client service 작성
5. import modal UI 작성
6. `/support/cards` 월원장에 모달 연결
7. commit 저장 경로를 기존 카드 mutation 정책과 연결
8. Firestore/Storage rules 추가
9. 로그/테스트 보강
10. Playwright 또는 수동 브라우저 검수

## 자율개발 프롬프트 분할

### 1차 프롬프트

```txt
docs/card-billing-statement-import-autonomous-todos.md의 KB-CARD-01과 KB-CARD-12 일부를 구현해줘.
기존 CardBillingManager의 analyzeCardBillingStatement 호출이 실제 Cloud Function으로 동작해야 하고, 서버 Gemini 설정을 사용해야 해.
아직 배치 UI는 만들지 말고 단건 함수와 normalize/parser 테스트 가능 구조까지만 진행해줘.
```

### 2차 프롬프트

```txt
KB-CARD-02, KB-CARD-03을 구현해줘.
cardStatementImportJobs/files/results 컬렉션 모델과 배치 분석 callable을 만들고, 카드 last4 기반 자동 매칭까지 완료해줘.
기존 저장 데이터는 아직 변경하지 말고 reviewing 상태 결과까지만 만들어줘.
```

### 3차 프롬프트

```txt
KB-CARD-05, KB-CARD-06, KB-CARD-07을 구현해줘.
/support/cards 월원장에 PDF 일괄등록 모달을 연결하고, 업로드/분석/검수 UI와 총액 표시를 완성해줘.
저장은 아직 commit 함수 호출 전까지 막고 preview 중심으로 구현해줘.
```

### 4차 프롬프트

```txt
KB-CARD-04, KB-CARD-11, KB-CARD-13을 구현해줘.
검수 완료 결과를 카드 거래와 카드 청구문서에 idempotent하게 저장하고, posted 청구문서 보호와 로그/테스트를 추가해줘.
```

### 5차 프롬프트

```txt
KB-CARD-09, KB-CARD-10, KB-CARD-14를 완료하고 전체 검증해줘.
Firestore/Storage rules를 추가하고 typecheck, functions build, 테스트를 통과시켜줘.
브라우저에서 /support/cards와 /settings/ai 흐름까지 점검해줘.
```

## 최종 인수 기준

- `/settings/ai` 서버 Gemini API Key가 없으면 분석이 시작되지 않는다.
- `/support/cards`에서 PDF 여러 장을 한 번에 업로드할 수 있다.
- 분석 결과가 파일별/카드별/거래별로 검수 가능하다.
- 전체 총액과 카드별 총액이 눈에 띄게 표시된다.
- 카드 미매칭, 월 불일치, 합계 불일치, 낮은 신뢰도는 저장 전 막거나 경고한다.
- 검수 완료 항목만 저장된다.
- 같은 PDF/job을 다시 저장해도 중복 거래가 생기지 않는다.
- 확정/지급/연체 청구문서는 자동 수정되지 않는다.
- 원본 PDF 경로가 저장되어 나중에 열람 가능하다.
- 카드 청구 로그 또는 import log에서 반영 내역을 추적할 수 있다.
- `npm run typecheck`, `npm --prefix functions run build`, 관련 테스트가 통과한다.

