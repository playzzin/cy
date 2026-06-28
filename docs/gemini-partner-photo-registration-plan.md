# Gemini 기반 사진 인식형 거래처 등록 MVP 구현 설계

## 1. 목표

사진으로 받은 명함, 업체자료, 참석자 명단, 연락처 화면을 업로드하면 Gemini API가 회사/담당자 정보를 구조화하고, 결과를 기존 통합 DB의 `companies` 컬렉션 회사와 매칭한 뒤 검수 후 등록한다.

MVP의 핵심 원칙은 다음과 같다.

- 회사 마스터는 새로 중복 생성하지 않는다. 추출된 회사는 기존 `companies` 문서에 연결한다.
- 자동 인식 결과는 바로 확정 저장하지 않는다. 반드시 검수 상태를 거친다.
- Gemini API 키는 프론트에 노출하지 않는다. 사진 인식은 Firebase Functions에서 처리한다.
- 엑셀 대량등록은 MVP 범위에서 제외한다. 대량등록은 사진 다중 업로드 기반으로 구현한다.

참고 공식 문서:

- Gemini 이미지 입력: https://ai.google.dev/gemini-api/docs/image-understanding
- Gemini 구조화 출력: https://ai.google.dev/gemini-api/docs/structured-output
- Gemini Files API: https://ai.google.dev/gemini-api/docs/files
- Gemini Batch API: https://ai.google.dev/gemini-api/docs/batch-api

## 2. 현재 프로젝트 연결 지점

현재 앱은 React, Firebase Auth, Firestore, Storage, Functions 구조다.

- 회사 통합 DB: `companies` 컬렉션
- 회사 타입 스키마: `src/types/zod/companySchema.ts`
- 회사 CRUD 서비스: `src/services/companyService.ts`, `src/services/companyFirestoreService.ts`
- 마스터 데이터 컨텍스트: `src/contexts/MasterDataContext.tsx`
- 기존 Gemini REST 호출 참고: `src/services/geminiService.ts`
- Functions 리전: `asia-northeast3`
- 기존 DB 라우트: `src/App.tsx`의 `/database/*`

새 기능의 MVP 라우트는 다음으로 추가한다.

```txt
/database/partner-photo-registration
/database/business-card-contacts
```

## 3. MVP 사용자 흐름

1. 사용자가 `사진 거래처 등록` 화면에서 사진 여러 장을 업로드한다.
2. 클라이언트가 이미지 용량을 줄이고 Firebase Storage에 저장한다.
3. 클라이언트가 `partnerRecognitionJobs` 작업 문서를 만들고 Functions에 분석을 요청한다.
4. Functions가 Storage 이미지를 읽어 Gemini API로 구조화 추출한다.
5. Functions가 추출 결과별로 기존 `companies` 목록과 매칭 후보를 계산한다.
6. 화면은 결과를 표로 보여준다.
7. 사용자는 회사 매칭, 담당자 정보, 제외 여부를 검수한다.
8. 사용자가 `확정 등록`을 누르면 담당자, 명함 이미지, 선택한 거래처 관계가 저장된다.
9. 미매칭 항목은 회사 신규 등록 요청 또는 보류 상태로 남긴다.

## 4. Firestore 데이터 모델

### 4.1 `partnerRecognitionJobs`

사진 업로드 묶음 단위다.

```ts
type PartnerRecognitionJobStatus =
  | 'draft'
  | 'uploading'
  | 'queued'
  | 'analyzing'
  | 'reviewing'
  | 'committing'
  | 'completed'
  | 'failed';

interface PartnerRecognitionJob {
  id: string;
  title: string;
  status: PartnerRecognitionJobStatus;
  createdByUid: string;
  createdByName?: string;
  baseCompanyId?: string;
  baseCompanyName?: string;
  defaultRelationshipType?: CompanyRelationshipType;
  defaultSiteId?: string;
  totalImages: number;
  processedImages: number;
  totalItems: number;
  autoMatchedItems: number;
  needsReviewItems: number;
  noMatchItems: number;
  excludedItems: number;
  committedItems: number;
  errorItems: number;
  errorMessage?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
}
```

### 4.2 `partnerRecognitionImages`

업로드된 원본 이미지 단위다.

```ts
type PartnerRecognitionImageStatus =
  | 'uploaded'
  | 'analyzing'
  | 'completed'
  | 'failed';

interface PartnerRecognitionImage {
  id: string;
  jobId: string;
  storagePath: string;
  downloadUrl?: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  status: PartnerRecognitionImageStatus;
  resultCount: number;
  errorMessage?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 4.3 `partnerRecognitionResults`

Gemini가 추출한 명함/담당자/업체 후보 1건 단위다. 한 사진에서 여러 건이 나올 수 있다.

```ts
type PartnerRecognitionResultStatus =
  | 'extracted'
  | 'auto_matched'
  | 'needs_review'
  | 'no_match'
  | 'excluded'
  | 'committed'
  | 'failed';

interface ExtractedPartnerContact {
  sourceKind: 'business_card' | 'company_document' | 'contact_screen' | 'participant_list' | 'unknown';
  companyName: string;
  companyNameAliases: string[];
  businessNumber: string;
  personName: string;
  department: string;
  position: string;
  mobile: string;
  phone: string;
  fax: string;
  email: string;
  address: string;
  website: string;
  businessCategories: string[];
  companyTypeGuess: Array<'건설사' | '협력사' | '임대사' | '자재사' | '설계' | '감리' | '기타'>;
  memo: string;
  overallConfidence: number;
  warnings: string[];
  rawText: string;
}

interface CompanyMatchCandidate {
  companyId: string;
  companyName: string;
  companyType?: string;
  businessNumber?: string;
  phone?: string;
  address?: string;
  score: number;
  reasons: string[];
}

interface PartnerRecognitionResult {
  id: string;
  jobId: string;
  imageId: string;
  status: PartnerRecognitionResultStatus;
  extracted: ExtractedPartnerContact;
  reviewed: Partial<ExtractedPartnerContact>;
  selectedCompanyId?: string;
  selectedCompanyName?: string;
  matchScore?: number;
  matchReasons: string[];
  candidates: CompanyMatchCandidate[];
  excludeReason?: string;
  committedContactId?: string;
  committedCardImageId?: string;
  committedRelationshipId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 4.4 `businessContacts`

통합DB 회사에 연결되는 담당자 마스터다.

```ts
interface BusinessContact {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  department?: string;
  position?: string;
  mobile?: string;
  phone?: string;
  email?: string;
  memo?: string;
  tags: string[];
  source: 'photo_recognition' | 'manual' | 'migration';
  sourceJobId?: string;
  sourceResultId?: string;
  createdByUid: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

중복 기준:

- 같은 `companyId` + 같은 `mobile`
- 같은 `email`
- 같은 `companyId` + 같은 `name` + 같은 `position`

MVP에서는 등록 단계에서 자동 병합하지 않는다. 확정 후 `명함/담당자 관리` 화면에서 중복 후보를 확인하고 사용자가 직접 병합한다.

### 4.5 `businessCardImages`

명함/자료 이미지와 담당자 연결 정보다.

```ts
interface BusinessCardImage {
  id: string;
  companyId: string;
  contactId?: string;
  jobId: string;
  imageId: string;
  resultId: string;
  storagePath: string;
  downloadUrl?: string;
  extractedRawText?: string;
  createdByUid: string;
  createdAt: Timestamp;
}
```

### 4.6 `businessContactHistories`

담당자별 통화, 미팅, 견적, 계약, 클레임, 메모 이력을 저장한다.

```ts
interface BusinessContactHistory {
  id: string;
  contactId: string;
  companyId: string;
  type: 'call' | 'meeting' | 'quote' | 'contract' | 'claim' | 'memo' | 'other';
  title: string;
  note?: string;
  happenedAt: Timestamp;
  createdByUid?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 4.7 `businessContactFollowUps`

담당자별 재연락/후속 처리 일정을 저장한다.

```ts
interface BusinessContactFollowUp {
  id: string;
  contactId: string;
  companyId: string;
  title: string;
  dueDate: string;
  status: 'open' | 'done' | 'canceled';
  memo?: string;
  createdByUid?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
}
```

### 4.8 `companyRelationships`

거래처 연결은 `companies` 문서끼리 연결한다.

```ts
type CompanyRelationshipType =
  | '원청'
  | '하도급'
  | '협력사'
  | '임대'
  | '납품'
  | '설계'
  | '감리'
  | '발주'
  | '소개'
  | '견적'
  | '계약중'
  | '거래중단'
  | '기타';

interface CompanyRelationship {
  id: string;
  sourceCompanyId: string;
  sourceCompanyName: string;
  targetCompanyId: string;
  targetCompanyName: string;
  relationshipType: CompanyRelationshipType;
  tradeCategory?: string;
  siteId?: string;
  siteName?: string;
  status: 'active' | 'inactive' | 'ended';
  sourceJobId?: string;
  sourceResultId?: string;
  memo?: string;
  createdByUid: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 4.7 `companyMasterRequests`

통합DB에 없는 회사 후보는 바로 `companies`에 넣지 않고 요청 큐로 보낸다.

```ts
interface CompanyMasterRequest {
  id: string;
  jobId: string;
  resultId: string;
  requestedCompanyName: string;
  extracted: ExtractedPartnerContact;
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  approvedCompanyId?: string;
  reviewedByUid?: string;
  createdByUid: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## 5. Storage 경로

```txt
partner-recognition/{jobId}/original/{imageId}.{ext}
partner-recognition/{jobId}/preview/{imageId}.jpg
business-cards/{companyId}/{contactIdOrResultId}/{imageId}.{ext}
```

MVP에서는 원본만 저장해도 된다. 단, 클라이언트에서 1600px 이하, 2MB 이하로 리사이즈한 파일을 업로드하는 것을 기본값으로 한다.

## 6. Gemini 추출 설계

### 6.1 요청 방식

MVP에서는 사진 1장당 Gemini `generateContent` 1회 호출을 기본으로 한다.

- 이유: 실패 재시도, 진행률, 부분 성공 처리가 단순하다.
- 한 사진에 여러 명함이 있으면 `items` 배열로 여러 건을 반환하게 한다.
- 수백 장 이상 비실시간 처리는 2차에서 Batch API로 분리한다.

### 6.2 Gemini 응답 스키마

Functions에서 `generationConfig.responseMimeType = 'application/json'`와 구조화 스키마를 사용한다.

```ts
const PARTNER_RECOGNITION_SCHEMA = {
  type: 'object',
  properties: {
    imageQuality: { type: 'string' },
    warnings: { type: 'array', items: { type: 'string' } },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sourceKind: { type: 'string' },
          companyName: { type: 'string' },
          companyNameAliases: { type: 'array', items: { type: 'string' } },
          businessNumber: { type: 'string' },
          personName: { type: 'string' },
          department: { type: 'string' },
          position: { type: 'string' },
          mobile: { type: 'string' },
          phone: { type: 'string' },
          fax: { type: 'string' },
          email: { type: 'string' },
          address: { type: 'string' },
          website: { type: 'string' },
          businessCategories: { type: 'array', items: { type: 'string' } },
          companyTypeGuess: { type: 'array', items: { type: 'string' } },
          memo: { type: 'string' },
          overallConfidence: { type: 'number' },
          warnings: { type: 'array', items: { type: 'string' } },
          rawText: { type: 'string' }
        },
        required: [
          'sourceKind',
          'companyName',
          'companyNameAliases',
          'businessNumber',
          'personName',
          'department',
          'position',
          'mobile',
          'phone',
          'fax',
          'email',
          'address',
          'website',
          'businessCategories',
          'companyTypeGuess',
          'memo',
          'overallConfidence',
          'warnings',
          'rawText'
        ]
      }
    }
  },
  required: ['imageQuality', 'warnings', 'items']
};
```

### 6.3 Gemini 프롬프트 핵심

```txt
You extract Korean B2B construction partner information from the attached image.
The image may contain one business card, multiple business cards, a company document,
a participant list, or a phone contact screenshot.

Rules:
- Return only JSON matching the schema.
- Do not invent values. Use empty string when a field is not visible.
- If multiple business cards or contacts are visible, return one item per person/company.
- Normalize nothing in the output except phone number spacing; preserve visible Korean text.
- For companyTypeGuess, choose from 건설사, 협력사, 임대사, 자재사, 설계, 감리, 기타.
- If confidence is low, add warnings.
```

## 7. 회사 매칭 알고리즘

### 7.1 정규화

```ts
function normalizeCompanyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(주\)|㈜|주식회사|유한회사|합자회사|합명회사/g, '')
    .replace(/[^\p{Script=Hangul}a-z0-9]/gu, '')
    .trim();
}

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function normalizeEmailDomain(value: string): string {
  const [, domain = ''] = value.toLowerCase().split('@');
  return domain.trim();
}
```

### 7.2 점수

```txt
사업자번호 완전일치: +100
대표전화/휴대폰 숫자 완전일치: +35
이메일 도메인 일치: +15
회사명 정규화 완전일치: +45
회사명 한쪽 포함: +30
회사명 유사도: 최대 +30
주소 시/군/구 일부 일치: +10
회사 타입 추정 일치: +5
```

자동 매칭 기준:

```txt
topScore >= 85 && topScore - secondScore >= 15 => auto_matched
topScore >= 55 => needs_review
topScore < 55 => no_match
```

후보는 상위 5개만 `partnerRecognitionResults.candidates`에 저장한다.

## 8. 구현 파일 TODO

### 8.1 타입

새 파일:

```txt
src/types/partnerRecognition.ts
src/types/zod/partnerRecognitionSchema.ts
```

할 일:

- 위 Firestore 모델의 TypeScript 타입 정의
- 상태값 union 정의
- 클라이언트 검수 폼에서 쓰는 `PartnerRecognitionReviewPatch` 정의
- Zod 스키마는 저장 전 검증용으로 최소 필수 필드만 적용

### 8.2 클라이언트 서비스

새 파일:

```txt
src/services/partnerRecognitionService.ts
```

필수 함수:

```ts
createJob(input: {
  title: string;
  baseCompanyId?: string;
  defaultRelationshipType?: CompanyRelationshipType;
  defaultSiteId?: string;
}): Promise<string>;

uploadJobImages(jobId: string, files: File[]): Promise<PartnerRecognitionImage[]>;

startAnalysis(jobId: string, imageIds?: string[]): Promise<void>;

subscribeJob(jobId: string, callback: (job: PartnerRecognitionJob | null) => void): () => void;

subscribeResults(jobId: string, callback: (items: PartnerRecognitionResult[]) => void): () => void;

updateResultReview(resultId: string, patch: PartnerRecognitionReviewPatch): Promise<void>;

excludeResult(resultId: string, reason: string): Promise<void>;

commitResults(input: {
  jobId: string;
  resultIds: string[];
  createRelationships: boolean;
}): Promise<{ committed: number; skipped: number; failed: number }>;
```

구현 방식:

- Firestore 작업/결과 조회는 클라이언트에서 직접 수행
- 분석/확정 등록은 `httpsCallable(functions, 'analyzePartnerRecognitionJob')`, `httpsCallable(functions, 'commitPartnerRecognitionResults')` 사용
- 업로드 전 이미지 압축 함수 `resizeImageForRecognition(file)` 구현

### 8.3 Functions

새 파일:

```txt
functions/src/partnerRecognition.ts
```

내보낼 callable:

```ts
export const analyzePartnerRecognitionJob = functions
  .runWith({ timeoutSeconds: 300, memory: '1GB', maxInstances: 3 })
  .region('asia-northeast3')
  .https.onCall(async (data, context) => {});

export const commitPartnerRecognitionResults = functions
  .runWith({ timeoutSeconds: 120, memory: '512MB', maxInstances: 5 })
  .region('asia-northeast3')
  .https.onCall(async (data, context) => {});

export const rematchPartnerRecognitionResult = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB', maxInstances: 10 })
  .region('asia-northeast3')
  .https.onCall(async (data, context) => {});
```

`functions/src/index.ts`에 추가:

```ts
export {
  analyzePartnerRecognitionJob,
  commitPartnerRecognitionResults,
  rematchPartnerRecognitionResult,
} from './partnerRecognition';
```

Functions 내부 함수:

```ts
getGeminiApiKey(): string;
downloadStorageFileAsBase64(storagePath: string): Promise<{ base64: string; mimeType: string }>;
callGeminiPartnerRecognition(input): Promise<GeminiPartnerRecognitionOutput>;
loadCompanyCandidates(): Promise<CompanyCandidate[]>;
buildMatchCandidates(extracted, companies): CompanyMatchCandidate[];
decideResultStatus(candidates): PartnerRecognitionResultStatus;
findDuplicateContact(companyId, extracted): Promise<BusinessContact | null>;
commitOneResult(result, options): Promise<CommitResult>;
```

환경변수:

```txt
GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-flash
```

현재 Functions v1 패턴을 유지한다면 단기적으로 다음도 허용한다.

```txt
firebase functions:config:set gemini.api_key="..."
firebase functions:config:set gemini.model="gemini-2.5-flash"
```

단, 실제 운영에서는 Secret Manager 기반으로 전환한다.

### 8.4 화면

새 파일:

```txt
src/pages/database/PartnerPhotoRegistrationPage.tsx
```

화면 구성:

- 상단: 작업 제목, 기준 회사 선택, 기본 관계유형, 현장 선택
- 좌측: 사진 드래그 앤 드롭, 업로드 목록, 분석 시작 버튼
- 중앙: 인식 결과 표
- 우측 또는 모달: 선택 결과 상세 검수

표 컬럼:

```txt
상태
사진 미리보기
추출 회사명
매칭 회사
담당자
직책
휴대폰
이메일
신뢰도
경고
작업
```

행 액션:

- 회사 후보 선택
- 수동 회사 검색
- 담당자 정보 수정
- 제외
- 미매칭 회사 등록 요청
- 확정 등록 대상 체크

라우트 추가:

```tsx
const PartnerPhotoRegistrationPage = React.lazy(
  () => import('./pages/database/PartnerPhotoRegistrationPage')
);

<Route
  path="partner-photo-registration"
  element={<PartnerPhotoRegistrationPage />}
/>
```

### 8.5 메뉴

기존 메뉴 관리 방식에 따라 `settings/menus_v12` 또는 메뉴 시드 로직에 다음 항목을 추가한다.

```txt
라벨: 사진 거래처 등록
경로: /database/partner-photo-registration
상위: 통합 DB 또는 거래처 DB
```

### 8.6 인덱스

`firestore.indexes.json`에 필요한 쿼리:

```txt
partnerRecognitionImages: jobId asc, createdAt asc
partnerRecognitionResults: jobId asc, status asc, createdAt asc
businessContacts: companyId asc, name asc
businessContacts: companyId asc, mobile asc
companyRelationships: sourceCompanyId asc, targetCompanyId asc
```

## 9. MVP 구현 순서

### Step 1. 데이터 타입과 컬렉션 준비

- `src/types/partnerRecognition.ts` 추가
- `src/types/zod/partnerRecognitionSchema.ts` 추가
- 컬렉션명 상수 정의
- Firestore 저장/읽기 컨버터는 기존 `createConverter` 패턴을 따른다.

완료 기준:

- TypeScript에서 `PartnerRecognitionJob`, `PartnerRecognitionResult`, `BusinessContact`, `CompanyRelationship` 타입 사용 가능

### Step 2. 클라이언트 업로드 서비스

- `partnerRecognitionService.createJob`
- `partnerRecognitionService.uploadJobImages`
- 이미지 리사이즈 유틸 구현
- Storage 업로드 후 `partnerRecognitionImages` 문서 생성

완료 기준:

- 사진 여러 장 업로드 시 Storage와 Firestore에 작업/이미지 문서가 생성됨

### Step 3. Gemini 분석 Function

- `analyzePartnerRecognitionJob` 구현
- Storage 이미지 다운로드
- Gemini 구조화 JSON 호출
- 결과를 `partnerRecognitionResults`에 저장
- 작업 진행률 업데이트

완료 기준:

- 업로드된 사진 1장으로 `partnerRecognitionResults` 문서가 생성됨
- 실패한 이미지는 전체 작업을 죽이지 않고 해당 이미지만 `failed` 처리

### Step 4. 회사 매칭 Function

- 기존 `companies` 전체 또는 활성 회사만 로드
- 정규화/점수화 알고리즘 적용
- 결과 상태를 `auto_matched`, `needs_review`, `no_match`로 결정

완료 기준:

- 추출 회사명과 기존 회사가 후보 점수와 함께 표시됨
- 기준 점수 이상이면 자동 매칭됨

### Step 5. 검수 화면

- `/database/partner-photo-registration` 페이지 추가
- 작업 생성, 사진 업로드, 분석 시작 연결
- 결과 실시간 구독
- 표에서 검수값 수정
- 회사 검색/후보 선택 기능 추가

완료 기준:

- 사용자가 인식 결과를 수정하고 `selectedCompanyId`를 지정할 수 있음
- 제외 처리와 미매칭 요청 처리가 가능함

### Step 6. 확정 등록 Function

- `commitPartnerRecognitionResults` 구현
- 검수 완료 결과만 처리
- 담당자 중복 의심 검사
- `businessContacts` 생성 또는 기존 담당자 연결
- `businessCardImages` 생성
- 선택 시 `companyRelationships` 생성
- 결과 상태를 `committed`로 변경

완료 기준:

- 검수된 결과가 담당자/명함/관계 데이터로 확정 저장됨
- 같은 결과를 두 번 확정해도 중복 생성되지 않음

### Step 7. 회사 상세 연결

MVP에서는 기존 회사 상세 화면을 크게 뜯지 않고, 최소 탭/섹션만 추가한다.

- 담당자 목록: `businessContacts` by `companyId`
- 명함 이미지 목록: `businessCardImages` by `companyId`
- 연결 거래처: `companyRelationships` by `sourceCompanyId` 또는 `targetCompanyId`

완료 기준:

- 통합DB 회사 화면에서 사진 등록으로 생성된 담당자와 명함을 확인할 수 있음

### Step 8. 명함/담당자 관리 화면

사진 인식으로 확정된 담당자를 별도 화면에서 관리한다.

- 담당자 전체 목록과 회사/이름/연락처 검색
- 회사 필터
- 담당자 상세 수정
- 명함 이미지 확인
- 통화/미팅/견적/계약/클레임/메모 이력 등록
- 재연락 예정일 등록 및 완료 처리
- 같은 회사의 전화번호/이메일/이름 기반 중복 후보 탐지
- 선택 담당자로 중복 병합

완료 기준:

- `/database/business-card-contacts`에서 담당자 검색, 수정, 이력, 후속 일정, 중복 병합이 가능함

### Step 9. 검증

필수 테스트 케이스:

- 명함 1장, 회사 자동 매칭
- 명함 1장, 후보 여러 개라 확인 필요
- 명함 1장, 통합DB 미매칭
- 사진 1장에 명함 여러 개
- 흐린 사진 실패 처리
- 같은 결과 확정 버튼 2회 클릭 시 중복 방지
- 같은 회사/휴대폰 담당자 중복 경고
- 권한 없는 사용자의 callable 호출 차단

빌드:

```txt
npm --prefix functions run build
npm run build
```

## 10. MVP에서 일부러 제외할 것

- Gemini Batch Files API 기반 2GB JSONL 초대량 처리
- 명함 영역 자동 크롭/회전 편집기
- 회사 관계도 그래프
- 자동 회사 신규 생성
- 카카오톡/이메일 연동
- AI 자연어 검색

## 11. 2차 고도화 TODO

### 11.1 대량 처리 고도화

- Gemini Files API + Batch API JSONL 파일 방식으로 수백~수천 장 비실시간 분석
- 작업 큐 분리: `queued`, `processing`, `partial_failed`, `completed`
- 비용/토큰/이미지 수 집계
- 실패 이미지만 재분석

### 11.2 이미지 전처리

- 한 사진 속 여러 명함 자동 crop 후보 생성
- 회전/기울기 보정
- HEIC/HEIF 변환
- 저화질 사전 경고
- 사용자가 crop 영역을 직접 수정하는 UI

### 11.3 매칭 정확도

- `companyAliases` 컬렉션 추가
- 회사명 별칭 자동 학습
- 사업자번호/전화번호/주소 기반 더 강한 매칭
- 기존 거래 이력 기반 우선순위
- 회사명 유사도 알고리즘을 trigram 또는 검색 엔진으로 교체

### 11.4 담당자 관리

- 이직/소속 변경 이력
- 이전 명함/최신 명함 구분
- 담당자별 권한/공유 범위 설정

### 11.5 거래처 관계 고도화

- D3 기반 관계도
- 현장 중심 관계 보기
- 원청-협력사-임대사 다단계 연결
- 관계 기간, 계약 상태, 공종, 평가 등급

### 11.6 검색/AI

- 자연어 검색: "작년에 부산 현장에서 장비 빌렸던 업체"
- Gemini 임베딩 또는 별도 검색 엔진 연동
- 회사/담당자/현장/관계 통합 검색

### 11.7 보안/감사

- Storage rules를 `partner-recognition/{uid}/...` 또는 job owner 기준으로 세분화
- 관리자/팀장/일반 사용자 권한 분리
- 인식 결과 원문과 수정 이력 감사 로그
- 개인정보 보존 기간 정책

## 12. MVP 최종 완료 기준

아래가 모두 되면 MVP 완료로 본다.

- 사진 여러 장 업로드 가능
- Gemini가 사진에서 회사/담당자 정보를 구조화 추출
- Gemini Batch inline 요청으로 비실시간 대량 분석 예약 및 결과 동기화 가능
- 추출 결과를 기존 `companies` 회사 목록과 자동/수동 매칭
- 사용자가 표에서 검수/수정/제외/보류 가능
- 확정 시 `businessContacts`, `businessCardImages`, 선택적 `companyRelationships` 저장
- 통합DB 회사 상세에서 등록된 담당자/명함/관계 확인 가능
- 명함/담당자 관리 화면에서 검색, 수정, 이미지 확인, 이력, 후속 일정, 중복 병합 가능
- 미매칭 회사는 `companyMasterRequests`로 보류
- Functions와 프론트 빌드 통과
