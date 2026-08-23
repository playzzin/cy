# 시공계획서 생성 페이지 최초 기획 대조 감사

작성일: 2026-08-22  
기준 문서: `docs/system-shoring-construction-plan-builder.md` v2.1 및 사용자의 최신 복원 지시  
성격: 코드 수정 전 감사 기준선(Source of Truth 추적표)

## 판정 기준

- **완료**: 실제 데이터 흐름과 저장·검증·출력까지 구현되어 자동 테스트 또는 산출물로 확인됨.
- **부분 구현**: 핵심 경로 일부는 작동하지만 최초 기획의 범위·데이터·UX·검증 중 하나 이상이 부족함.
- **잘못 구현**: 현재 동작이 최초 기획의 불변식 또는 명시 요구와 충돌함.
- **미구현**: 사용자 경로와 영속화 계약이 없음. 타입 선언이나 빈 화면만 있는 경우도 포함함.
- **동작 확인 필요**: 코드와 단위 테스트는 있으나 실제 브라우저 사용자 시나리오가 아직 검증되지 않음.

## 전체 요구사항 체크리스트

| # | 최초 기획 요구사항 | 상태 | 현재 근거 및 문제점 |
|---:|---|---|---|
| 1 | 최초 기획 문서를 단일 기준으로 관리 | 완료 | `docs/system-shoring-construction-plan-builder.md` v2.1이 존재하고 단계·불변식·수용조건을 포함한다. |
| 2 | 참고 PDF는 내용 모델로만 사용하고 레이아웃 결함을 복제하지 않음 | 완료 | 기획 문서 2.2에 REV 꼬리글, 잘림·겹침, 예시도·승인값 오용 방지 기준이 기록되어 있다. |
| 3 | 시스템동바리 표준 문서 매니페스트 | 완료 | `domain/templateManifest.ts`의 42쪽 매니페스트와 섹션 기본값이 존재한다. |
| 4 | 표준 목차·페이지의 버전 고정 | 완료 | 템플릿 ID/버전과 1~42 페이지 exact-once 검증이 `domain/validation.ts`에 있다. |
| 5 | 시스템비계 표준 문서 구조 | 미구현 | 타입·템플릿·서버 생성·PDF 모두 시스템동바리만 지원한다. |
| 6 | 생성 단계에서 시공계획서 종류 선택 | 잘못 구현 | `ConstructionPlanCreatePage.tsx`가 `system-shoring`과 템플릿 1.0.0을 고정한다. |
| 7 | 여러 버전의 템플릿 레지스트리 | 미구현 | 단일 코드 상수만 있고 `constructionPlanTemplates` 조회/선택 서비스가 없다. |
| 8 | 템플릿 관리 화면과 작성→검토→게시→폐기 수명주기 | 미구현 | `/construction-plan-templates` 라우트·메뉴·페이지·서버 API가 없다. |
| 9 | 게시 템플릿 불변성과 구버전 재현 | 부분 구현 | 코드 상수와 renderer bundle hash는 있으나 게시 레코드/immutable templateHash가 별도 영속되지 않는다. |
| 10 | PDF에 템플릿/렌더러 번들 해시 바인딩 | 완료 | `fieldUsePdfRenderer.ts`와 서버 발행 job이 template/build/content hash를 보존한다. |
| 11 | 최신 템플릿 여부 표시와 선택적 업그레이드 | 미구현 | `releaseReadiness.latestTemplate` 계산·비교·업그레이드 UI가 없다. |
| 12 | 계획서에 templateId/templateVersion 고정 | 부분 구현 | 필드는 저장되지만 현재는 한 템플릿 상수만 선택 가능하다. |
| 13 | 현장 선택 | 완료 | 생성 마법사가 ERP 현장 목록을 불러오고 선택한다. |
| 14 | 활성/예정 현장 중심 필터 | 완료 | 생성 페이지에서 현장 상태를 기준으로 후보를 제한한다. |
| 15 | 서버 권위 현장 스냅샷 | 완료 | callable이 현장 문서를 다시 읽고 canonical draft를 만든다. |
| 16 | 원청/협력사 ERP 데이터 자동 표시 | 부분 구현 | 생성 UI는 회사 목록과 현장 연결값을 표시하지만 서버 스냅샷의 법인 상세로 이어지지 않는다. |
| 17 | 회사 ID로 회사 마스터를 서버에서 조회 | 미구현 | callable은 site 문서의 문자열만 사용하고 `companies/{id}`를 canonical source로 읽지 않는다. |
| 18 | 원청/협력사 정보의 canonical snapshot | 잘못 구현 | 회사 마스터가 아닌 현장 문서의 오래된 이름 문자열이 최종 PDF 원천이 될 수 있다. |
| 19 | 담당 팀 ERP 자동 표시 | 부분 구현 | 생성 화면은 팀 후보를 읽지만 계획서 스냅샷/서버 생성에 팀 마스터가 반영되지 않는다. |
| 20 | 팀 ID·명칭·책임자 snapshot | 미구현 | `ProjectSnapshot`과 서버 builder에 팀 스냅샷 계약이 없다. |
| 21 | 작업자 안전필드 전용 서버 projection | 완료 | safe-worker directory callable이 이름·직책·팀 등 허용 필드만 투영한다. |
| 22 | 현장/팀 범위 작업자 후보 | 완료 | 참여자·현장 경계 조회와 권한 검증이 서버에서 수행된다. |
| 23 | 작업자 기반 조직도 자동 생성 | 완료 | 초안 생성 시 역할/추가 작업자 snapshot이 자동 배치된다. |
| 24 | ERP 필드별 출처·문서ID·버전·수집시각·수정사유 | 미구현 | `SourcedValueSchema` 선언은 있으나 실제 프로젝트/회사/팀/작업자 필드에 사용되지 않는다. |
| 25 | 스냅샷 수집시각 기록 | 완료 | project/organization snapshot과 계획서 감사 메타데이터에 시각이 저장된다. |
| 26 | 원천 ERP 변경 비교와 선택적 갱신 | 미구현 | 최신 원천과 스냅샷 diff, 사용자 선택 갱신, 수정사유 UI/API가 없다. |
| 27 | 건물·층·구역·공종 범위 구조화 | 완료 | 생성 마법사와 scope schema가 반복 가능한 구조 데이터로 저장한다. |
| 28 | 조직 역할·작업자 구조화 | 완료 | 역할, 추가 작업자, 중복 경고, snapshot 저장이 구현되어 있다. |
| 29 | 구조/설계 기준값과 출처·Rev·쪽·적용구간 구조화 | 완료 | engineering value 전용 패널과 검증이 존재한다. |
| 30 | D-01~D-06 도면 적용성 결정 | 완료 | 승인/예시/해당없음과 근거를 구조화하고 검토 전 차단한다. |
| 31 | 도면 원본·페이지·승인·Rev 메타데이터 | 완료 | `PlanDrawing`과 drawing panel이 이를 구조화한다. |
| 32 | 장비계획 전체 분류(양중·운반·고소·조립·계측) | 잘못 구현 | 스키마는 분류를 갖지만 UI는 lifting만 필터·추가한다. |
| 33 | 장비 계획단계·통제조치 구조화 편집 | 미구현 | 필드는 타입에 있으나 편집 UI에서 입력할 수 없다. |
| 34 | 자재 반입·적치·검수 계획 구조화 | 미구현 | 일반 section의 scope/summary/body 자유 텍스트로만 작성한다. |
| 35 | 신호수·유도원·통제 계획 구조화 | 미구현 | 역할·구간·신호체계·통제조건 전용 폼이 없다. |
| 36 | 설치 순서·간격·검사·Hold Point 구조화 | 미구현 | 설치 섹션이 자유 텍스트 패널이다. |
| 37 | 콘크리트 타설 순서·속도·하중·중지조건 구조화 | 미구현 | 콘크리트 섹션이 자유 텍스트 패널이다. |
| 38 | 해체 순서·잔존강도·반출·통제 구조화 | 미구현 | 해체 섹션이 자유 텍스트 패널이다. |
| 39 | 존치·재검토·변경관리 계획 구조화 | 미구현 | 전용 데이터 계약과 폼이 없다. |
| 40 | 비상연락망·대피·구조·보고체계 구조화 | 미구현 | 비상 섹션이 자유 텍스트 패널이다. |
| 41 | 위험성평가 구조화 | 부분 구현 | 단계·위험·대책·잔여등급은 있으나 가능성×중대성 수치, 허용기준, 재검토 트리거가 부족하다. |
| 42 | 표준문구 편집 시 원문/변경/사유·diff·복원 | 잘못 구현 | 편집 경고만 있고 원문 보존, 변경사유, diff, 원문 복원, 자동 재검토 무효화가 없다. |
| 43 | PDF/PNG/JPEG 도면 업로드 | 완료 | 에디터와 Storage MIME/크기 검증이 지원한다. |
| 44 | 도면 SHA-256·Storage generation 불변 바인딩 | 완료 | 원본·preview·snapshot·release preflight에서 재검증한다. |
| 45 | 업로드 staging 후 검사·finalize | 잘못 구현 | 브라우저가 canonical drawing final 경로에 직접 create한다. |
| 46 | 업로드 세션·만료·고립 객체 정리 | 미구현 | `constructionPlanUploadSessions` API/상태/cleanup job이 없다. |
| 47 | PDF 전 페이지 자동 preview | 완료 | 서버 callable이 1~50쪽을 순차 rasterize하고 immutable manifest를 만든다. |
| 48 | CropBox·회전·페이지 fingerprint | 완료 | 좌표 변환과 canonical fingerprint가 클라이언트/서버에서 검증된다. |
| 49 | 설치·해체·장비·적치·통제·위험 등 8개 레이어 | 완료 | DrawingStudio 레이어와 흑백 범례가 있다. |
| 50 | 좌표 기반 정규화 주석 저장 | 완료 | geometry가 0~1 normalized 좌표로 저장·복원된다. |
| 51 | 사각형·다각형·화살표·마커·텍스트·타원 도구 | 부분 구현 | 도메인은 풍부하지만 에디터 도구는 선택/사각형/다각형/화살표만 제공한다. |
| 52 | 모든 주석 타입의 무손실 편집 round-trip | 잘못 구현 | adapter가 rich annotation을 rect/polygon/arrow로 축소해 구버전·import 데이터의 geometry/style 손실 위험이 있다. |
| 53 | 선/채움/투명도/색상/폰트 스타일 편집 | 미구현 | 스타일 도구와 속성 패널이 없다. |
| 54 | redo·복제·잠금·숨김·z-order | 미구현 | undo와 삭제만 있고 해당 편집 기능이 없다. |
| 55 | 구역코드·라벨 편집 | 완료 | 선택 객체의 label/zoneCode를 수정할 수 있다. |
| 56 | 저장 후 PlanDrawing 재접속·복원 | 완료 | embedded drawing과 authoritative preview를 resolver/adapter로 다시 구성한다. |
| 57 | 계획서 목록·검색·상태 필터 | 완료 | 목록 페이지와 서버 목록 callable이 있다. |
| 58 | 현장→종류→자동데이터→범위 생성 마법사 | 부분 구현 | 현장/범위는 있으나 종류·템플릿 선택이 없고 ERP 세부 스냅샷이 불완전하다. |
| 59 | 최초 기획의 선형 작업 흐름 | 부분 구현 | 주요 화면은 연결됐으나 현장별 구조화 폼 다수가 자유 텍스트이고 도면 재사용 경로가 없다. |
| 60 | 자동저장·명시 저장 상태 | 완료 | edit lock과 lockVersion을 포함한 debounce autosave 상태가 표시된다. |
| 61 | 협업 편집 잠금·heartbeat·만료 | 완료 | service, rules, UI가 소유권과 TTL을 강제한다. |
| 62 | 새로고침 후 전체 데이터 복원 | 동작 확인 필요 | Firestore 조회/파싱 경로와 단위 테스트는 있으나 실제 브라우저 E2E 재접속을 아직 수행하지 않았다. |
| 63 | 마지막 작성 섹션·스크롤 위치 복원 | 미구현 | 선택 섹션이 URL/사용자 상태에 영속되지 않아 재진입 시 첫 섹션으로 돌아간다. |
| 64 | `/drawings/:drawingId` 직접 진입 | 잘못 구현 | 라우트는 있으나 Editor가 `drawingId` param을 읽어 해당 도면/섹션을 선택하지 않는다. |
| 65 | 검토요청→검토완료/수정요청→승인→발행 상태머신 | 완료 | 서버 callable과 rules가 권한·검증·snapshot을 강제한다. |
| 66 | immutable 검토 snapshot·댓글·답글·diff | 완료 | cycle/package/comment 서버 권위 모델과 UI 비교 화면이 있다. |
| 67 | 검토함 | 완료 | `/construction-plan-reviews` 페이지와 메뉴가 있다. |
| 68 | 발행함·이력·다운로드 | 완료 | 발행 목록과 immutable PDF 재검증 다운로드가 있다. |
| 69 | 문서 series·개정·복제·supersede | 완료 | 서버 transaction과 UI 파생 흐름이 구현되어 있다. |
| 70 | 작성/미리보기/검토 모드 전환 | 미구현 | 편집기 내 명시적 3-mode UX와 모드별 읽기전용 경계가 없다. |
| 71 | 승인 snapshot만을 서버 발행 원천으로 사용 | 완료 | PREPARE/FINALIZE가 immutable snapshot과 approval evidence를 검증한다. |
| 72 | 실제 A4 규격 | 완료 | 최종 PDF 42쪽 모두 595.28×841.89pt로 검증했다. |
| 73 | 검색 가능한 한글·폰트 포함 | 완료 | Noto Sans KR 검색층, pypdf/pdfplumber 추출을 확인했다. |
| 74 | 선명한 도면 | 완료 | 원본 PDF/이미지를 2400px verified raster로 렌더하고 좌표 주석을 합성한다. |
| 75 | 머리글·꼬리글·페이지 번호 | 완료 | 서버 렌더러 전 페이지에서 고정 계약을 적용한다. |
| 76 | 회사 로고 | 미구현 | 저장된 로고 자산은 있으나 서버 field-use PDF에 삽입되지 않는다. |
| 77 | 회사명·원청·협력사 법인정보 | 부분 구현 | 명칭 일부만 나오며 사업자/대표/주소/연락처 등 canonical 회사 master projection이 없다. |
| 78 | 작성·검토·승인자 정보 | 부분 구현 | workflow evidence는 있으나 표지/결재란의 사람 이름·직책 표시가 완전하지 않다. |
| 79 | 시스템동바리 필수 시공계획 내용 | 완료 | 42쪽 전용 renderer와 도면/구조/장비/위험/양식 페이지가 있다. |
| 80 | 시스템비계 필수 시공계획 내용 | 미구현 | 비계 템플릿과 renderer가 없다. |
| 81 | 표 자동 분할·continuation 페이지 | 잘못 구현 | 8/12/16/10행 등의 고정 capacity를 넘으면 validation이 발행을 막는다. |
| 82 | PDF bookmark/outline | 미구현 | 페이지 제목은 있으나 PDF outline tree 생성 코드가 없다. |
| 83 | `[기입]`·예시 수치·미승인 도면 발행 차단 | 완료 | validation/audit가 placeholder와 미승인·pending drawing을 fail-closed한다. |
| 84 | PDF 실제 열기·추출·육안 검수 | 완료 | candidate/issued 42쪽, A4, 한글, 보안 구조와 p1/p2/p7/p9/p17/p21/p22/p26/p27/p28/p36/p39/p41/p42를 시각 확인했다. |
| 85 | 단계별 진행 상태 | 완료 | 생성 wizard와 editor progress/section navigator가 있다. |
| 86 | 현재 작성 위치 | 완료 | 섹션 navigator와 현재 페이지 표시가 있다. |
| 87 | 누락 필수항목과 클릭 이동 | 완료 | 단계별 validation panel과 target 이동이 있다. |
| 88 | 저장 상태 | 완료 | 대기/저장중/저장됨/오류/오프라인 상태가 노출된다. |
| 89 | PDF 생성 가능 여부 | 완료 | release readiness와 blocking validation을 표시한다. |
| 90 | 도면 등록/preview/승인 상태 | 부분 구현 | 상태는 보이지만 도면 라이브러리, 업로드 진행률, staging 검사 단계가 없다. |
| 91 | 기존 ERP 디자인 시스템과 일관성 | 완료 | 공통 layout/menu/token을 사용하고 전용 전문 문서 UI CSS를 확장했다. |
| 92 | 참여자/중앙권한 최소권한 접근 | 완료 | Firestore/Storage rules와 server callable이 participant 경계를 강제한다. |
| 93 | 작업자 개인정보 최소화 | 완료 | 서버 safe projection과 계획서 allowlist가 급여·계좌·신분정보를 제외한다. |
| 94 | 장기 bearer download URL 미저장 | 완료 | storagePath/generation/SHA만 저장하고 런타임 Blob을 사용한다. |
| 95 | 승인 snapshot·발행 artifact create-only | 완료 | Storage/Firestore/transaction에서 불변성과 overwrite 금지를 강제한다. |
| 96 | 멱등성·경합·감사 이벤트 | 완료 | 요청 ID, series transaction, cycle counters, issue job, terminal retry 검증이 있다. |
| 97 | 템플릿관리·실행기록 라우트 | 미구현 | 현재 App/menu에는 목록·생성·편집·검토·발행만 있고 records/templates가 없다. |
| 98 | production build | 완료 | 감사 기준선 작성 전 root build와 Functions TypeScript build를 수행했으며 재검증 단계에서 다시 실행한다. |
| 99 | 단위·통합·규칙 회귀 테스트 | 완료 | 클라이언트 27 suites/141, Functions 75/75, Firestore/Storage rules assertion이 통과했다. |
| 100 | 실제 브라우저 전체 사용자 시나리오 | 미구현 | Playwright/Cypress나 수동 E2E 증적이 없고 콘솔·네트워크·새로고침 흐름이 미검증이다. |

## 감사 기준선 집계

| 상태 | 개수 | 가중치 |
|---|---:|---:|
| 완료 | 54 | 54.0 |
| 부분 구현 | 11 | 5.5 |
| 잘못 구현 | 8 | 0 |
| 미구현 | 26 | 0 |
| 동작 확인 필요 | 1 | 0 |
| 합계 | 100 | 59.5 |

감사 기준선 충족률은 **59.5% (표시값 60%)**이다. 부분 구현은 0.5점, 완료는 1점으로 계산했으며 잘못 구현·미구현·동작 확인 필요는 완료 점수에 포함하지 않았다.

## 현재 검증 증적

- 클라이언트 시공계획서 테스트: 27 suites / 141 tests 통과.
- Functions constructionPlans 테스트: 75 / 75 통과.
- root TypeScript와 Functions build 통과.
- Firestore/Storage 규칙 assertion 통과.
- 실제 issued PDF: 42쪽, 전 페이지 A4, 검색 가능한 한글, Noto Sans KR, 암호화·첨부·JS·OpenAction 없음.
- issued PDF SHA-256: `5a7c206499e7c90343a87df18022a1bf542944964c157597bfac8220ceaff020`.
- 시각 검수 표본에서 잘림·겹침·도면 왜곡의 P0/P1은 없었으나, 회사 로고·자동 분할·시스템비계·ERP 법인정보는 요구와 불일치한다.

## 구현 우선순위

1. **P0-1 템플릿/종류 복원**: 시스템동바리와 시스템비계 선택, 버전 레지스트리, 계획서 생성·검증·PDF의 템플릿 분기.
2. **P0-2 ERP canonical snapshot**: 현장에 연결된 회사/원청/협력사/팀을 서버에서 다시 조회하고 출처 메타데이터와 함께 저장.
3. **P0-3 구조화 현장 입력**: 자재·신호/통제·설치·타설·해체·존치·비상·품질/안전/환경을 자유 텍스트가 아닌 전용 schema/form/validation으로 교체; 모든 장비 분류 지원.
4. **P0-4 도면 워크플로**: staging/finalize, rich annotation 무손실 round-trip, 빠진 도구·style·redo/lock/hide/order, direct drawing deep-link.
5. **P0-5 문서 출력**: 회사 로고·법인정보·작성/검토자, 자동 continuation page, bookmark, 시스템비계 field-use renderer.
6. **P1 운영 화면**: 템플릿 관리, 원천 갱신 비교, 실행기록, 명시적 작성/미리보기/검토 모드, 마지막 위치 복원.
7. **검증 게이트**: 실제 브라우저 1→14 사용자 시나리오, 새로고침 복원, 콘솔/네트워크, 실제 PDF 재렌더·육안 QA, 최초 기획 100항목 재채점.

## 회귀 금지 항목

- 서버 권위 초안/검토 snapshot/승인/발행 및 participant 최소권한.
- 도면 source SHA·generation·preview manifest·annotation binding.
- 발행 후 개정/복제/series/supersede와 과거 PDF 불변 조회.
- 개인정보 safe-worker projection.
- 최종 PDF의 검색 가능한 한글, A4, 머리글/꼬리글/페이지 번호, audit provenance.

## 최종 재감사 (2026-08-22 운영 배포 후)

이 절은 위의 코드 수정 전 감사 기준선을 동일한 100개 요구사항으로 다시 판정한 최종 결과다. 최초 표는 작업 전 상태를 보존하며, 최종 상태는 이 절을 우선한다.

### 재판정 결과

| 상태 | 개수 | 가중치 |
|---|---:|---:|
| 완료 | 99 | 99.0 |
| 부분 구현 | 1 | 0.5 |
| 잘못 구현 | 0 | 0 |
| 미구현 | 0 | 0 |
| 동작 확인 필요 | 0 | 0 |
| 합계 | 100 | 99.5 |

최종 충족률은 **99.5%**다. 작업 전 `부분 구현 / 잘못 구현 / 미구현 / 동작 확인 필요`였던 항목 중 45개는 구현·테스트·운영 검증을 완료했다. 유일한 부분 구현은 **#100 실제 브라우저 전체 사용자 시나리오**다.

### 완료로 전환한 주요 범위

- 시스템동바리·시스템비계 독립 템플릿, 공법/목차 선택, 버전 레지스트리와 작성→검토→게시→폐기 수명주기
- 현장·회사·팀·작업자 canonical ERP snapshot, 필드 출처, 원천 diff와 선택 갱신
- 장비·자재·신호/통제·설치·타설·해체·존치·비상·위험성평가 구조화 계약과 전용 편집 UI
- 도면 staging/finalize 업로드 세션, 불변 원본 검증, 도면 라이브러리, 좌표 주석 무손실 round-trip, 전체 도구·스타일·redo·복제·잠금·숨김·z-order
- 마지막 편집 위치/도면 deep-link, 작성·A4 미리보기·검토 모드, 템플릿·실행기록 라우트
- 회사 로고, 시스템비계 전용 문구/도면/점검 내용, 물리 continuation 페이지와 PDF outline
- 검색 가능한 한글 A4 PDF, 머리글·꼬리글·페이지 번호, 승인 증적과 불변 발행 경로

### 운영 검증 증적

- 시공계획서 Functions 49개, Firestore/Storage 규칙, 인덱스 3개, 전용 Hosting을 `cyee-9c1e4`에 분리 배포했다.
- 최종 Hosting 버전 `4ff5aac6e7c59ad8`은 이전 버전 대비 시공계획서 정적 자산 3개 추가와 `construction-plan-app/index.html`만 변경했고 삭제 파일은 0개다.
- 운영 계정으로 현장 선택 → 시스템동바리 템플릿 → 41개 목차 → 초안 저장 → 새로고침 복원 → 42쪽 DRAFT PDF 다운로드를 수행했다.
- 실제 다운로드 PDF는 42쪽 전부 A4, 빈 검색 텍스트 페이지 0, 대체문자 0, 한글 핵심 문구 7개 검색 일치, 총 검색 텍스트 19,994자였다.
- 운영 테스트 초안 `HSWYlYDjYb16LYjsd3lg`에서 D-01 설치구간 좌표 주석 1개를 작성했고 자동저장 후 새로고침하여 동일 섹션·도면 작업공간·주석 1개가 복원됨을 확인했다.
- 최종 운영 브라우저 console warning/error는 0건이다.
- 클라이언트 시공계획서 전체 회귀는 68 suites / 410 tests, Functions는 97 suites / 199 tests를 통과했다. 마지막 현장목록 클릭 결함 수정 후 생성 페이지 11 tests와 운영 브라우저 재검증도 통과했다.

### 남은 부분 구현

- 브라우저 자동화 환경의 Windows 파일 선택창 권한이 만료되어, 운영 브라우저에서 새 도면 파일을 직접 선택해 업로드하는 한 단계는 수행하지 못했다. 동일한 staging→검사→finalize→불변 원본 경로는 클라이언트·Functions 자동 테스트로 검증했고, 운영 브라우저에서는 좌표 주석 저장·복원까지 확인했다.
- 테스트 초안은 현장 사용본이 아니라 누락 항목이 남은 `DRAFT / 현장사용 금지` 문서다. 실제 승인도면과 검토·승인자를 임의 입력해 운영 발행본으로 만들지 않았다.
