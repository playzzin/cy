# Gemini 사용량·비용 로그

- 페이지: `/admin/gemini-usage-logs`
- 메뉴: CEO → 로그관리 → Gemini 사용량·비용 로그. 저장된 메뉴에도 읽기 시 누락 항목을 보완하며 기존 항목을 보존한다.
- 서버 기록: Gemini 응답의 사용량만 `gemini_usage_logs`에 저장한다. 호출자의 인증 정보는 요청별 비동기 실행 문맥으로 분리한다. 백그라운드 카드 분석은 작업 생성자를 사용한다.
- 브라우저 기록: 인증된 `recordGeminiClientUsage`에 메타데이터만 전달한다. 사용자와 단가는 서버에서 결정하며 `source=browser`로 구분한다. 개발 계정은 브라우저 저장소에만 기록한다.
- API 키, 프롬프트, 문서 내용, 생성 내용은 사용량 로그에 저장하지 않는다. 주소는 쿼리·해시를 제외한다.
- 실패·차단도 기록한다. 재시도는 개별 API 호출로 집계한다. 명함 일괄 처리 결과는 배치 이름과 응답 순번으로 중복 저장을 방지한다. 배치 제출/상태 조회 자체를 토큰 사용 호출로 세지 않는다.
- `listGeminiUsageLogs`는 활성 관리자만 허용한다. Firestore 직접 읽기·쓰기는 차단한다. 한국 날짜 기준 최대 366일, 200건씩 조회하며 화면 합계는 불러온 기록/필터 기준이다.

## 비용 기준

[Google 공식 요금표](https://ai.google.dev/gemini-api/docs/pricing)를 2026-09-29에 확인했다. 유료 표준/배치 토큰 비용의 예상치이며 청구액이 아니다. 무료 할당량, 할인, 세금, 도구 호출, 캐시 보관 비용을 제외한다. 원화 환산은 사용자가 입력한 환율만 적용한다.

[UsageMetadata](https://ai.google.dev/api/generate-content#UsageMetadata)의 입력 토큰에 캐시가 포함되므로 캐시를 빼고 각각의 단가를 적용한다. 출력에는 별도 추론 토큰을 더한다. 이미지 출력은 모달리티별 토큰이 있을 때만 별도 단가를 적용한다. 사용량 미제공·등록되지 않은 모델·불완전한 이미지 사용량은 비용을 null로 남긴다.

Flash 3.8/3.7/3.6은 2026년 말까지의 한시 요금과 2027년 시작 요금을 구분한다. Pro는 20만 입력 토큰 경계를 반영한다. 계산 코드의 브라우저/서버 복사본은 통합 테스트에서 동일성을 확인한다.

## 배포와 확인

프론트엔드 변경만으로 기존 서버의 Gemini 호출이 기록되지는 않는다. 운영 반영 시 Firestore의 `gemini_usage_logs` 차단 규칙, 새 수집·조회 함수, 수집기를 연결한 기존 Gemini 호출 함수, 프론트엔드를 함께 배포해야 한다. 작업 이전의 사용량·비용은 복구하거나 추정해서 채우지 않는다.

수집 연결 범위: 문서/신분증/작업자 서류/영수증, 숙소 공과금, 카드 명세서/감사, 과태료/통행료, 거래처·명함 일반 및 배치 인식, 엑셀 변환/구조, 일보 통계, AI 업무 분석, 브라우저 이미지/도면/세금계산서/인력 검색/AI 도우미 호출.

검증 명령:

```text
npm run typecheck
npm --prefix functions run build
node scripts/run-gemini-usage-tests.cjs
npm test -- --watchAll=false --runInBand --runTestsByPath src/utils/geminiUsage.test.ts src/services/geminiUsageLogService.test.ts src/pages/admin/GeminiUsageLogPage.test.tsx src/services/menuServiceV11.test.ts
npm run build
```

통합 테스트는 demo 프로젝트의 Auth/Firestore 에뮬레이터와 합성 응답만 사용한다. 유료 Gemini 호출이나 운영 데이터 생성은 하지 않는다. 로그 저장은 AI 응답을 실패로 바꾸지 않으며 저장 실패는 서버의 `gemini-usage-log-write-failed` 경고로 확인한다. 브라우저 보고는 서버 측 API 응답을 직접 관측한 기록과 구분하여 해석해야 한다.
