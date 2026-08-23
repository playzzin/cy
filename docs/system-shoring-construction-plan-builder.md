# 시스템동바리 시공계획서 빌더 PRD

> 문서 버전: 2.1  
> 기획 상태: 최초 기획 복원·운영 분리 배포·인증 E2E 검증 완료  
> 기준 문서: 청연이엔지 시스템동바리 시공계획서 REV.5, A4 42페이지  
> 제품 범위: 현장 데이터 연결, 조직도 생성, 도면 구간 표시, 검토·승인, 규격 PDF 발행

## 구현 현황 (2026-08-22)

- 계획서 목록, 4단계 생성 마법사, 3패널 편집기와 자동저장·편집 잠금을 구현했다.
- 최초 초안·복제·개정본은 서버가 문서 시리즈와 Rev.를 원자 배정하며, 동일 요청 재시도·동시 개정·기존 발행본 대체 이력을 서버 권한으로 처리한다.
- 일반 현장 사용자는 자신이 작성자·검토자·승인자로 참여한 계획서만 조회·편집하고, Firestore와 Storage가 같은 참여자·중앙권한 기준을 사용한다.
- 현장별 42쪽 고정 매니페스트, 조직도, 도면 적용성, 구조 검토값, 장비계획, 위험성평가, 체크리스트, 사진대지와 인수인계 양식을 연결했다.
- 설치·해체·존치·통제·동선 등 정규화 좌표 주석과 PDF/PNG/JPG 불변 원본 보존, PDF 전 페이지 서버 PNG 미리보기와 페이지 선택·재접속·출력 흐름을 구현했다.
- 검토요청·수정요청·검토완료·최종승인·발행을 서버 권한으로 분리하고 승인 스냅샷 hash와 불변 PDF 발행 기록을 연결했다.
- 검토요청마다 불변 제출 package를 만들고, 같은 본문은 content-addressed snapshot을 재사용하되 검토 회차와 이전 제출본 diff는 별도로 보존한다.
- 섹션·안정 필드·도면 페이지에 고정되는 의견, 답변 스레드, `미처리 → 조치됨 → 해결` 상태와 필수의견 승계·승인차단을 서버 검토 주기 counter로 구현했다.
- 검토·승인함, 제출본 비교 패널, 계획서별·전체 PDF 발행이력 화면을 연결했다. 최종 승인 후 서버가 승인 스냅샷 v2와 승인 증적, 원본 도면 bytes·generation·SHA-256을 직접 읽어 42쪽 승인 후보를 생성한다.
- 현장사용본은 `PREPARE → 후보본 다운로드·무결성 확인 → 사용자 육안검수 → FINALIZE`로 발행한다. FINALIZE는 후보본을 승격하지 않고 동일 page model로 현장사용본을 서버에서 다시 렌더링하며, 두 산출물의 공통 provenance와 서로 다른 profile·SHA를 검증한다.
- 전체 TypeScript 검사, 클라이언트·Functions 단위 및 상태전이 테스트, Firestore/Storage 규칙 에뮬레이터, 42쪽 A4 실렌더·한글 추출·PNG 시각검수와 프로덕션 빌드를 통과하는 것을 배포 게이트로 둔다.
- 운영에는 시공계획서 Functions 49개, Firestore/Storage 규칙, 인덱스 3개와 전용 Hosting rewrite만 분리 배포했다. 기존 ERP Hosting 파일은 배포 전 기준 hash와 비교해 보존했고, 최종 운영 Hosting 버전은 `4ff5aac6e7c59ad8`이다.
- PDF 도면은 서버가 불변 원본의 Storage generation·SHA-256·magic bytes를 확인하고 물리 1~50페이지를 순차 PNG로 변환한다. 서버 전용 manifest와 산출물 generation·SHA-256·페이지 지문을 제출·검토완료·승인·발행 단계마다 다시 검증하며, 브라우저가 `ready` 상태나 경로를 위조해도 통과하지 않는다.
- 기존 `server-a4-shadow-v1` 실험 렌더러는 계속 `releaseEligible: false`로 격리한다. 정식 현장사용 경로는 별도의 `field-use-a4-v2` 렌더러만 사용하고 shadow 산출물을 발행 API가 받을 수 없다.
- `field-use-a4-v2`는 승인 스냅샷의 모든 leaf를 페이지·표시방식·감사/제어 disposition에 한 번씩 귀속한 zero-omission 원장과 42쪽 page manifest를 만든다. 원본 PDF/PNG/JPEG를 직접 검증·합성하고 D-01~D-06 선택 페이지, CropBox, 회전, 구간 주석, 조직·장비·구조값·위험성평가와 빈 실행양식을 전용 A4 페이지로 출력한다.
- 서버 PDF는 한글 검색층, A4 page box, 템플릿 번들·렌더러 build·입력·콘텐츠·누락방지·도면 바인딩 hash를 기록한다. 상세 provenance는 2쪽 문서관리표와 PDF metadata, job/export/Storage metadata에 고정하고, 매 페이지에는 사람이 읽을 수 있는 짧은 profile·snapshot·payload footer만 둔다.
- `조치됨(addressed)`은 계획서 작성자가 남긴 답변을 서버 `authorReplyCount`로 확인하며, 검토자 답변만으로 상태를 바꿀 수 없다. `조치됨`은 계속 미해결로 집계되어 해결 전 검토완료·승인을 차단한다.
- 의견·답변은 작성 시도마다 새 request ID를 만들고 전송 실패 재시도에만 같은 ID를 유지한다. 응답 유실은 멱등 회수하고, 성공 후 같은 문구를 다시 등록하면 별도 의견·답변으로 저장한다.

## 0. 한 줄 정의

현장을 선택하고 승인도면에 설치·해체 구간을 표시하면, 표준 시공계획서 템플릿과 현장·조직·장비 데이터를 결합하여 검토 가능한 초안과 변경 불가능한 배포본 PDF를 생성하는 문서 업무 시스템이다.

## 1. 기획 결론

이 제품은 한글·워드처럼 페이지를 자유롭게 꾸미는 편집기가 아니다. 다음 4개의 데이터 계층을 조립하는 **현장 문서 생성기**로 설계한다.

1. 버전이 고정된 공법별 표준 템플릿
2. 현장·회사·팀·작업자 마스터 데이터
3. 장비·구간·위험요인·승인자 등 현장별 구조화 데이터
4. 원본 도면과 그 위에 쌓이는 설치·해체·동선 주석 레이어

핵심 정책은 다음과 같다.

- 승인·배포된 계획서는 수정하지 않고 개정본으로 복제한다.
- 조직도와 현장정보는 검토요청·승인·발행 시점별 스냅샷으로 고정한다.
- 모든 예시도면과 현장 승인도면을 명확히 구분한다.
- 승인 전 문서는 모든 페이지에 DRAFT를 표시한다.
- 최종 승인과 PDF 배포완료를 분리한다. 승인됐지만 PDF 검사가 실패한 문서는 `발행대기`이며 현장 배포본이 아니다.
- 계획서 안의 빈 점검양식과 실제 현장 수행기록을 분리한다.
- 최종 PDF 후보는 승인 스냅샷만으로 전용 A4 렌더러가 생성하고, 서버가 42쪽·SHA-256·페이지별 감사 마커·승인 snapshot hash를 재검증한 뒤에만 발행한다.
- 구조 안전성·설치 적합성 판단은 시스템이 대신하지 않는다. 담당 전문가의 확인 사실과 근거 문서를 기록한다.

## 2. 참고 문서 활용 원칙과 품질 관찰

참고 PDF는 **내용 구성과 업무 항목의 기준**으로 사용하고, 출력 레이아웃을 그대로 복제하지 않는다.

전체 42페이지를 확인했을 때 새 제품이 반복해서는 안 되는 품질 문제가 있다.

- 화면에 보이는 REV.5와 추출 텍스트 안의 REV.4·29페이지 꼬리글이 혼재해 검색 내용과 시각 내용이 다를 가능성
- 일부 표·안내 박스·서명 영역의 잘림 또는 겹침
- D-01만 TEMPLATE로 표시됐지만 D-02-D-06도 현장 승인치가 아닌 예시도 성격
- `[기입]`, 빈 연락망·서명란·승인란이 남아 있음
- 1/500, 350mm 등 예시 수치가 현장 승인값으로 오인될 위험

따라서 새 시스템은 다음을 강제한다.

- 예시도면 또는 예시 수치가 한 건이라도 남으면 배포본 발행 차단
- PDF 시각검사와 텍스트 추출검사를 모두 수행
- 화면에 보이지 않는 과거 Rev. 텍스트와 중복 객체 검사
- 구조검토 기준, 설치도면, 수치의 출처·Rev.·적용 동/층/구간 스냅샷 저장
- 최종 승인 후에도 PDF 생성·검사를 통과해야 `현장사용 발행본`으로 전환

## 3. 배경과 문제 정의

### 3.1 현재 문제

- 현장마다 표지, 공사개요, 조직도, 장비정보를 반복 입력한다.
- 팀·작업자 정보가 바뀌면 조직도를 다시 그려야 한다.
- 설치도, 해체계획, 장비동선이 여러 파일과 메신저에 흩어진다.
- 표준 문구를 복사하는 과정에서 목차·페이지 번호·Rev.가 어긋난다.
- 예시도면이 실제 시공도면처럼 배포될 위험이 있다.
- 승인 후 원본 데이터가 바뀌면 당시 문서가 무엇이었는지 추적하기 어렵다.
- 계획서 양식과 실제 점검·사진·서명 기록이 섞여 완료 여부가 불분명하다.

### 3.2 해결하려는 일

- 현장별 시공계획서 작성 시간을 줄인다.
- 작성자가 빠뜨린 필수 항목을 발행 전에 찾는다.
- 조직도와 현장 정보를 기존 데이터에서 안전하게 가져온다.
- 설치·해체·존치·동선을 한 도면에서 레이어로 관리한다.
- 초안, 제출본, 승인본, 발행본, 개정본의 상태와 변경 이력을 보존한다.
- 동일한 A4 규격과 품질로 PDF를 반복 생성한다.

### 3.3 하지 않는 일

첫 출시에서는 다음을 제품 목표로 삼지 않는다.

- 구조계산서 자동 작성 또는 구조 안전성 자동 판정
- DWG 원본 편집
- 범용 워드프로세서 수준의 자유 배치
- 안전 관련 법령의 자동 적합 판정
- 외부 전자결재·전자서명 플랫폼과의 법적 서명 연동
- 발행본 원문을 사용자가 직접 덮어쓰기

## 4. 성공 기준

### 4.1 사용자 성공 기준

- 기존 현장정보가 정상인 경우 10분 안에 기본 골격을 만든다.
- 도면 업로드 후 설치·해체 구간 표시까지 별도 CAD 도구 없이 완료한다.
- 검토자는 PDF를 열기 전에도 누락·변경·승인대상을 파악한다.
- 승인자는 어떤 현장·도면·템플릿 버전으로 생성됐는지 확인할 수 있다.
- 발행 이후 현장 마스터 데이터가 바뀌어도 기존 발행본은 변하지 않는다.

### 4.2 제품 KPI

핵심 지표는 `새 계획서 생성부터 오류 0인 첫 DRAFT까지 걸린 시간`이다.

| 지표 | 파일럿 목표 | 측정 방법 |
|---|---:|---|
| 기본 골격 생성시간 | 중앙값 10분 이하 | 생성 시작부터 첫 골격 저장 |
| 첫 유효 DRAFT 완성시간 | 중앙값 45분 이하 | 생성 시작부터 오류 0 DRAFT |
| 필수필드 자동 채움률 | 70% 이상 | 자동 연결 필드 / 전체 필수필드 |
| 1차 검토 통과율 | 70% 이상 | 수정요청 없는 제출본 / 전체 제출본 |
| 누락정보 반려 감소 | 기존 대비 50% | 파일럿 전후 비교 |
| PDF 생성 성공률 | 98% 이상 | ready job / 전체 export job |
| PDF 레이아웃 결함률 | 1% 미만 | 잘림·겹침·폰트·페이지 오류 |
| 목차·페이지 불일치 | 0건 | 자동 PDF 검사 |
| 발행본 스냅샷 무결성 오류 | 0건 | snapshot hash 검증 |
| 개정 사유 기록률 | 100% | Rev. 1 이상 문서 검사 |

파일럿 첫 2주는 목표 판정이 아니라 현재 수작업 기준선을 측정하는 기간으로 둔다.

## 5. 사용자와 역할

| 사용자 | 주 환경 | 핵심 목표 | 주요 권한 |
|---|---|---|---|
| 계획서 작성자 | Windows PC | 기존 데이터를 재입력하지 않고 초안 완성 | 생성, 편집, 도면 주석, 검토요청 |
| 현장책임자/공사담당 | PC·태블릿 | 실제 현장과 계획서 일치 확인 | 검토, 의견, 수정요청 |
| 안전·품질 검토자 | PC | 장비·위험·Hold Point·도면 검증 | 섹션/도면 의견, 검토완료 |
| 최종 승인자 | PC·태블릿 | 완결성과 근거 확인 후 승인 | 최종승인, 발행상태 조회 |
| 템플릿 관리자 | PC | 표준 문구와 양식 통제 | 작성, 검토, 발행, 폐기 |
| 현장 기록자 | 모바일 | 점검·사진·조치 기록 | 실행기록 작성 |
| 조회자 | PC·모바일 | 최신 발행본 즉시 확인 | 조회, 다운로드 |

### 5.1 권한표

| 기능 | 작성자 | 검토자 | 승인자 | 템플릿 관리자 | 기록자 | 조회자 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| 초안 생성·편집 | O | 제한 | 제한 | O | - | - |
| 도면 업로드·주석 | O | 의견 | 제한 | - | - | - |
| 검토요청 | O | - | - | - | - | - |
| 수정요청·검토완료 | - | O | O | - | - | - |
| 최종승인 | - | - | O | - | - | - |
| 템플릿 발행 | - | - | - | O | - | - |
| 현장 수행기록 | - | 조회 | 조회 | - | O | 조회 |
| 발행본 다운로드 | O | O | O | O | O | O |

실제 권한은 기존 인증·역할 체계와 결합하되, 계획서 참여자 목록으로 한 번 더 제한한다.

## 6. Jobs-to-be-Done

- 현장 착수 시 기존 현장·회사·인력 데이터로 40페이지 이상의 계획서 골격을 빠르게 만들고 싶다.
- 도면이 변경되면 전체 문서를 다시 만들지 않고 관련 도면과 구간만 개정하고 싶다.
- 작업자가 바뀌어도 기존 발행본은 보존하고 새 초안에만 변경사항을 선택 반영하고 싶다.
- 검토할 때 필수 누락과 이전 제출본 대비 변경점을 바로 찾고 싶다.
- CAD 지식 없이 설치·해체·존치 구간을 표시하고 화면과 PDF에 같은 위치로 출력하고 싶다.
- 발행 후 누가 어떤 내용과 도면을 승인했는지 변경 불가능한 형태로 증명하고 싶다.
- 표준 문구가 개정돼도 과거 발행본은 그대로 두고 신규 문서에만 새 버전을 적용하고 싶다.

## 7. 핵심 사용자 시나리오

### 시나리오 A. 신규 현장 초안 생성

1. 작성자가 `새 계획서`를 선택한다.
2. 활성 현장과 발행된 시스템동바리 템플릿을 선택한다.
3. 시스템이 현장, 발주사, 원청, 담당팀, 공사기간을 초안 스냅샷으로 가져온다.
4. 누락값은 임의 생성하지 않고 `미등록`으로 표시한다.
5. 작성자가 동·층·구간과 공법정보를 입력한다.
6. planId가 생성되고 표지·공사개요·기본 조직도가 보인다.

### 시나리오 B. 조직도 확정

1. 현장 담당팀과 활성 작업자가 후보로 나타난다.
2. 역할·직급·team leader 정보로 담당자를 추천한다.
3. 작성자가 현장책임자, 공사, 안전, 품질, 작업반장을 확정한다.
4. 겸임 또는 현장 외 인원을 추가하면 사유를 입력한다.
5. 조직도 A4 미리보기가 즉시 갱신된다.

### 시나리오 C. 도면 업로드와 구간 표시

1. 현장 도면 PDF 또는 이미지를 업로드한다.
2. 파일 검사 후 페이지 썸네일과 원본 hash가 생성된다.
3. 도면번호, Rev., 동, 층, 구간, 승인상태와 승인근거를 입력한다.
4. 설치, 해체, 존치, 장비동선, 보행동선, 양중반경, 출입통제, 적치장을 표시한다.
5. 구간코드, 순서, 예정일, 설명을 부여한다.
6. 범례와 도면목록이 자동 생성된다.

### 시나리오 D. 검토·수정·재제출

1. 검토요청 순간 제출 스냅샷이 생성되고 본문이 잠긴다.
2. 검토자는 필드·섹션·도면 객체에 의견을 남긴다.
3. 수정요청은 최소 1개의 의견 또는 사유가 필요하다.
4. 작성자가 수정 시작을 선택하면 초안 편집이 다시 열린다.
5. 의견을 처리하고 재제출한다.
6. 검토자는 이전 제출본 대비 변경사항만 필터링한다.

### 시나리오 E. 최종 승인과 현장사용 발행

1. 모든 필수 검토가 완료되면 `검토완료` 상태가 된다.
2. 승인자는 검증결과, 승인도면, 미해결 의견, 구조검토 근거를 확인한다.
3. 승인 시 승인 스냅샷과 hash가 생성되고 `승인-발행대기`가 된다.
4. 서버가 PDF를 생성하고 시각·텍스트·hash 품질검사를 수행한다.
5. 검사 성공 시에만 `현장사용 발행` 상태가 된다.
6. 검사 실패 시 승인 스냅샷은 유지하되 현장 배포는 차단하고 재생성한다.

### 시나리오 F. 발행본 개정

1. 발행본에서 `개정본 만들기`를 선택한다.
2. 변경 사유와 변경유형을 입력한다.
3. 승인 스냅샷을 복제한 새 초안과 다음 Rev.를 만든다.
4. 현재 마스터와 비교해 바뀐 항목을 제안한다.
5. 사용자가 필드별 반영 여부를 선택한다.
6. 새 Rev. 발행 시 이전 발행본은 `대체됨`이지만 계속 조회할 수 있다.

### 시나리오 G. 원천 데이터 변경

- 초안 작성 중 현장기간·담당팀·작업자가 바뀌어도 자동 덮어쓰지 않는다.
- `원천 데이터 변경됨`에서 이전값과 현재값을 비교한다.
- 필드별 적용, 섹션 전체 적용, 기존값 유지를 선택한다.
- 검토 중·승인대기·발행된 문서에는 원천 변경을 적용하지 않는다.

### 시나리오 H. 현장 실행기록

1. 기록자가 발행된 계획서에서 오늘의 점검양식을 연다.
2. 장비점검, 설치검측, 타설 전 검측, 해체 전 점검 등을 선택한다.
3. 모바일에서 결과, 조치, 사진, 확인자를 기록한다.
4. 계획서 본문과 분리된 record로 저장한다.
5. 완료기록 부록 PDF를 생성할 수 있다.

## 8. 정보 구조와 화면 목록

### 8.1 메뉴

- 시공계획서
  - 계획서 목록
  - 새 계획서
  - 검토·승인함
  - 현장 실행기록
  - PDF 발행이력
  - 표준 템플릿 관리

### 8.2 라우트

```text
/construction-plans
/construction-plans/new
/construction-plans/:planId
/construction-plans/:planId/drawings/:drawingId
/construction-plans/:planId/compare/:snapshotId
/construction-plans/:planId/exports
/construction-plan-approvals
/construction-plan-reviews        # approvals 별칭
/construction-plan-exports

# 후속 범위
/construction-plan-records
/construction-plan-templates
```

### 8.3 화면 인벤토리

| ID | 화면 | 핵심 기능 | 반드시 정의할 상태 |
|---|---|---|---|
| P01 | 계획서 목록 | 검색, 필터, 최신 발행본, 개정 | 빈 화면, 결과없음, 로딩, 실패 |
| P02 | 생성 마법사 | 현장·템플릿·적용범위 | 현장없음, 템플릿없음, 데이터누락 |
| P03 | 계획서 편집기 | 목차, 입력, A4 미리보기 | 저장중, 실패, 잠금, 원천변경 |
| P04 | 조직도 편집 | 역할 슬롯과 인원배정 | 공석, 중복, 비활성, A4 초과 |
| P05 | 도면 스튜디오 | 업로드, 주석, 범례 | 업로드·검사·변환·실패 |
| P06 | 검증센터 | 오류·경고·직접이동 | 오류없음, 서버검증실패 |
| P07 | 비교·검토 | 변경점, 의견, 결정 | 배정없음, 처리됨, 새 제출본 |
| P08 | 승인·발행 | 최종검사, PDF job | 대기, 렌더, 검사, 완료, 실패 |
| P09 | 실행기록 | 체크리스트, 사진, 조치 | 임시저장, 미완료, 확인완료 |
| P10 | 템플릿 관리 | 버전, 테스트, 발행 | 작성, 검토, 발행, 폐기 |

## 9. 상세 화면 명세

### 9.1 P01 계획서 목록

- 필터: 검색, 상태, 현장, 공법, 담당자, 기간
- 열: 현장명, 문서번호, 공법, Rev., 상태, 검토진행, 수정자, 수정일, 최신 PDF
- 동작: 열기, 개정본 만들기, 발행본 보기, 이력, 복제
- `승인-발행대기`, `현장사용 발행`, `대체됨`, `폐기`를 시각적으로 구분
- 계획서가 없으면 첫 계획서 만들기, 필터 결과가 없으면 필터 초기화 제공

### 9.2 P02 새 계획서 마법사

1. 활성 현장 검색·선택
2. 공법과 최신 발행 템플릿 선택
3. 자동 연결 필드 검토
4. 동·층·구간·기간 입력
5. 생성 요약과 누락항목 확인

필드 상태는 `자동연결`, `미등록`, `충돌`, `직접입력`으로 표시한다. 현장, 템플릿, 문서제목, 적용구간이 없으면 완료할 수 없다.

### 9.3 P03 계획서 편집기

```text
┌──────────────┬──────────────────────────────┬──────────────────┐
│ 목차/진행률   │ A4 출력 미리보기             │ 섹션 데이터      │
│ ✓ 표지       │ 확대/축소·페이지 이동         │ 데이터 출처      │
│ ! 조직도     │ 선택 위치 강조               │ 구조화 입력      │
│ ! 도면       │ 도면은 전용 작업공간 진입     │ 오류·경고        │
│ ○ 안전계획   │                              │ 변경 이력        │
└──────────────┴──────────────────────────────┴──────────────────┘
상단: 현장 / 문서번호 / Rev. / 편집잠금 / 저장상태 / DRAFT / 검토요청
```

- 좌·우 패널 접기 지원
- 42페이지 동시 렌더 금지, 현재 페이지 주변만 지연 렌더
- `작성`, `미리보기`, `검토` 모드 분리
- A4 중앙 미리보기는 직접 편집 캔버스가 아니며 클릭 시 우측 대응 필드로 이동
- 필수 섹션은 삭제 불가, `해당 없음`은 사유 필수
- 표준 문구 수정 시 원문/수정문/사유 표시

#### 저장·편집잠금

- P0는 계획서당 한 명만 편집 가능
- 편집자, 잠금 시작시각, 마지막 heartbeat 표시
- 다른 사용자는 조회 전용과 잠금 해제 요청만 가능
- 입력 후 1초 debounce, 필드 이탈 시 즉시 저장
- `저장중`, `저장됨 14:32`, `저장실패`, `오프라인`을 항상 표시
- 서버 `lockVersion` 불일치 시 조용히 덮어쓰지 않음
- 관리자 강제해제는 사유와 감사로그 필수
- 실시간 공동편집은 후속 범위

### 9.4 P04 조직도 편집

#### 역할 슬롯

- 현장책임자
- 공사담당
- 안전담당
- 품질/검측
- 작업반장
- 작업자
- 선택: 장비운전원, 신호수/유도자

#### 추천 소스

- `siteManagerId`, `siteManagerName`
- `responsibleTeamId`, `responsibleTeamName`
- 팀 `leaderId`, `leaderName`
- 작업자 `role`, `rank`, `teamId`, `siteId`

추천은 자동 확정하지 않는다. 동일인 겸임은 사유를 받고 역할마다 겸임을 표시한다. 비활성·퇴사·출입금지 인원은 신규 후보에서 제외한다. 조직도 핵심인원이 12명을 넘으면 글자를 축소하지 않고 작업반 인원표를 다음 페이지로 분리한다.

### 9.5 P05 도면 스튜디오

```text
상단: 파일/페이지 · 선택/이동/도형 · 실행취소 · 확대 · 저장
좌측: 페이지 썸네일과 필수 레이어 상태
중앙: 도면 캔버스
우측: 레이어·객체 목록·선택 객체 속성
하단: 좌표·확대율·변환/저장 상태
```

#### 지원 파일과 상태

- MVP: PDF, PNG, JPG
- SVG 직접 업로드 제외
- DWG는 PDF 변환 안내, 서버 변환은 후속

```text
선택됨 → 업로드중 → 검사중 → 미리보기 생성 → 메타데이터 입력 → 사용가능
                         └→ 암호화 / 손상 / 형식위장 / 제한초과
```

초기 운영 제한은 파일당 50MB·PDF 50페이지·계획서당 도면 20개로 두고 성능시험 후 조정한다.

#### 도구

- 선택·이동, 다각형, 사각형, 선/화살표, 원, 점, 텍스트
- 실행취소·다시실행, 복제·삭제·잠금·숨김, 앞/뒤 순서
- Space+드래그 이동, Shift 방향 제한, Escape 취소, Delete 삭제
- 3점 미만 다각형과 도면 밖 좌표 저장 금지

#### 레이어

| 레이어 | 표현 | 필수 속성 |
|---|---|---|
| 설치구간 | 파란 반투명 면 + 실선 | 구간코드, 순서 |
| 해체구간 | 주황 반투명 면 + 점선 | 구간코드, 순서/예정일 |
| 존치/해체금지 | 붉은 사선 해칭 | 사유, 해제조건 |
| 장비동선 | 파란 화살표 | 장비종류, 방향 |
| 보행동선 | 녹색 화살표 | 출입구/도착지 |
| 양중반경 | 황색 점선 원 | 장비, 반경 |
| 출입통제 | 붉은 점선 | 통제시간/담당자 |
| 적치장 | 녹색 박스 | 자재종류 |

표준 스타일은 사용자가 임의 변경하지 못한다. 좌표는 원본 회전 전 페이지 기준 0-1 정규화 좌표로 저장하고 회전정보를 별도 보관한다. 도면 교체 시 크기·페이지가 다르면 주석을 자동 이식하지 않는다.

### 9.6 P06 검증센터

- 오류: 배포본 발행 차단
- 경고: 사유 확인 후 진행 가능
- 안내: 권장사항

각 항목은 장, 절, 필드, 해결방법, 담당 역할을 표시하고 클릭 시 정확한 필드 또는 도면 객체로 이동한다.

### 9.7 P07 비교·검토

- 기준: 직전 제출본 또는 직전 발행본
- 텍스트 인라인 diff
- 구조화 필드 전/후 표
- 도면 주석 추가·삭제·변경 강조
- 섹션·안정 필드·도면 page fingerprint에 고정된 의견과 답변 스레드
- 의견 상태: 미처리(open) → 조치됨(addressed) → 해결(resolved)
- 과거 제출본 비교는 해당 round까지의 의견만 보여주며 읽기 전용으로 동작
- 검토완료 또는 수정요청
- 수정요청은 최소 1개 미해결 의견/사유 필수

### 9.8 P08 승인·발행

한 화면에 다음을 표시한다.

- 문서번호, Rev., 템플릿/renderer 버전
- 현장 스냅샷 시각
- 도면번호·Rev.·승인상태·근거
- 필수검증과 미해결 의견
- 검토단계 완료 여부
- 예상 페이지 수와 파일명
- PDF job 단계: 서버 후보 준비 → 후보 generation·SHA 검증 → 육안검수 → 서버 최종 렌더 → 원자 발행

초안 PDF는 클라이언트의 A4 미리보기 렌더러가 생성할 수 있다. 승인 후보와 현장사용 발행본은 클라이언트가 생성하거나 업로드하지 않는다. 서버가 불변 승인 스냅샷과 원본 도면에서 후보본을 만들고, 권한 있는 사용자가 정확한 candidate SHA를 육안 확인한 후 FINALIZE를 요청하면 서버가 issued profile로 다시 렌더링한다. 최종 Storage bytes·generation·SHA-256·42쪽 A4·한글 검색·감사 metadata와 plan/job/export/series 전이가 모두 일치할 때만 `issued`가 된다.

### 9.9 P09 실행기록

- 장비 일일점검
- 자재 반입검수
- 설치 중 검측
- 타설 전 최종검측
- 해체 전 점검
- 일일점검일지
- 사진대지
- 최종 인수인계

계획서 문항 버전을 참조하지만 결과는 별도 record로 저장한다.

## 10. 빈 화면·오류·복구

| 상황 | 표시 | 복구 행동 |
|---|---|---|
| 계획서 없음 | 첫 계획서 안내 | 새 계획서 만들기 |
| 필터 결과 없음 | 적용 필터 | 필터 초기화 |
| 현장정보 누락 | 누락필드·출처 | 계획서 보완/현장정보 열기 |
| 템플릿 없음 | 생성 불가 이유 | 관리자 요청 |
| 저장 실패 | 마지막 성공시각 | 재시도·변경내용 복사 |
| 다른 사용자 편집 | 편집자·시각 | 조회전용·해제요청 |
| 원천 데이터 변경 | 전/후 요약 | 선택 적용 |
| 도면 업로드 | 파일별 진행률 | 취소 |
| 변환 실패 | 암호·손상·용량 원인 | 파일 교체 |
| PDF 생성 | 현재 job 단계 | 화면 이탈 가능 |
| 생성본 오래됨 | 생성 후 변경됨 | 새 PDF 생성 |
| 권한 회수 | 읽기전용 이유 | 변경내용 복사 |
| 문서 대체됨 | 최신 Rev. | 최신 발행본 열기 |

## 11. 문서 구성 모델

### 11.1 참고 PDF 매핑

| 구간 | 내용 | 데이터 전략 |
|---|---|---|
| 1 | 표지 | 현장·문서·회사·승인 자동/입력 |
| 2 | 문서관리·개정이력 | plan·approval·revision 자동 |
| 3-4 | 목차 | 실제 렌더 페이지로 자동 |
| 5 | 일반사항 | template text + 허용 override |
| 6 | 공사개요 | site snapshot + scope |
| 7 | 조직·책임 | organization snapshot |
| 8 | 자재 반입·보관 | material plan |
| 9-14 | 장비·동선·양중·점검 | equipment + drawing + record template |
| 15-21 | 구성·부품·치수·설치·접합 | method template version |
| 22 | 도면목록·공통주의 | drawings + notes |
| 23-27 | 평면·입면·단면·상세 | actual drawing or blocked example |
| 28 | 타설 전 Hold Point | validation + approval |
| 29 | 구조관리 | structural reference + snapshot |
| 30-33 | 설치·타설·해체 | method + scope + annotations |
| 34-38 | 품질·안전·위험·비상·환경 | standard + site inputs |
| 39-42 | 검측·일지·사진·인수인계 | blank template or separate result |

### 11.2 섹션 유형

```ts
type SectionKind =
  | 'cover'
  | 'document-control'
  | 'toc'
  | 'static-content'
  | 'structured-form'
  | 'organization-chart'
  | 'equipment-plan'
  | 'drawing-register'
  | 'drawing-page'
  | 'risk-assessment'
  | 'checklist-template'
  | 'photo-sheet'
  | 'approval-sheet';
```

각 섹션은 입력 스키마, 검증 스키마, 편집 컴포넌트, PDF renderer, 페이지 분할 규칙을 가진다.

## 12. 데이터 출처와 스냅샷

모든 자동 연결 필드는 세 값을 구분한다.

1. `sourceValue`: 현재 마스터 데이터
2. `snapshotValue`: 계획서에 저장된 값
3. `overrideValue`: 사용자가 계획서에서 재정의한 값

화면과 PDF는 `overrideValue ?? snapshotValue`를 사용한다. 마스터가 바뀌어도 자동 덮어쓰지 않는다.

```ts
type SourcedValue<T> = {
  value: T;
  source: 'site' | 'company' | 'team' | 'worker' | 'template' | 'manual';
  sourceId?: string;
  sourceUpdatedAt?: string;
  capturedAt: string;
  overridden?: boolean;
};
```

### 12.1 기존 데이터 연결

| 데이터 | 기존 소스 | 사용 필드 |
|---|---|---|
| 현장 | `siteService`, `sites` | 이름, 코드, 주소, 기간, 담당팀, 회사 |
| 회사 | `companyService`, `companies` | 발주·원청·시공사 명칭 |
| 팀 | `teamService`, `teams` | 팀명, leader, 담당현장 |
| 작업자 | `manpowerService`, `workers` | 이름, 역할, 직급, 팀, 현장, 사진 |
| 파일 | `storageService` | 원본 경로와 메타데이터 |

작업자 계획서 DTO는 이름, 역할, 직급, 팀, 상태, 선택적 사진·연락처만 노출한다. 주민번호, 계좌, 급여, 주소는 쿼리·로그·스냅샷에서 제외한다.

## 13. 데이터 모델

### 13.1 컬렉션

```text
constructionPlanTemplates/{templateId}
constructionPlanSeries/{seriesId}
constructionPlans/{planId}
constructionPlans/{planId}/snapshots/{snapshotId}
constructionPlans/{planId}/reviewCycles/{cycleId}
constructionPlans/{planId}/reviewPackages/{packageId}
constructionPlans/{planId}/approvals/{approvalId}
constructionPlans/{planId}/comments/{commentId}
constructionPlans/{planId}/comments/{commentId}/messages/{messageId}
constructionPlans/{planId}/workflowEvents/{eventId}
constructionPlans/{planId}/exports/{exportId}
constructionPlanExportJobs/{jobId}
constructionPlanRecords/{recordId}
constructionPlanAuditLogs/{logId}
```

현재 MVP는 섹션·도면·주석을 계획서 문서의 정규화 배열로 함께 저장한다. 검토 snapshot/package/cycle, 의견·답변, 승인 증적과 workflow event는 불변성·권한·집계를 위해 하위 컬렉션으로 분리한다. 의견과 답변 본문은 브라우저가 Firestore에서 직접 읽거나 쓰지 않고, 가시성 필터를 적용하는 callable을 통해서만 전달한다.

### 13.2 계획서

```ts
type PlanStatus =
  | 'draft'
  | 'in_review'
  | 'changes_requested'
  | 'review_completed'
  | 'approved_pending_issue'
  | 'issued'
  | 'superseded'
  | 'archived'
  | 'void';

type ConstructionPlan = {
  id: string;
  siteId: string;
  title: string;
  tradeType: 'system-shoring';
  documentNo: string;
  revision: number;
  status: PlanStatus;

  templateId: string;
  templateVersion: string;
  rendererVersion: string;
  schemaVersion: number;

  projectSnapshot: ProjectSnapshot;
  organizationSnapshot: OrganizationSnapshot;
  sectionOrder: string[];
  validationSummary: { errors: number; warnings: number; checkedAt: string };

  lockVersion: number;
  editLock?: { userId: string; userName: string; acquiredAt: string; heartbeatAt: string };
  activeReviewSnapshotId?: string;
  approvedSnapshotId?: string;
  issuedExportId?: string;
  supersedesPlanId?: string;

  participants: { authorIds: string[]; reviewerIds: string[]; approverIds: string[] };
  createdBy: string;
  createdAt: unknown;
  updatedBy: string;
  updatedAt: unknown;
};
```

### 13.3 도면과 주석

```ts
type PlanDrawing = {
  id: string;
  planId: string;
  storagePath: string;
  sourceSha256: string;
  sourceGeneration: string;
  originalFileName: string;
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg';
  sizeBytes: number;
  pageCount: number;
  drawingNo: string;
  title: string;
  revision: string;
  approvalStatus: 'example' | 'draft' | 'reviewed' | 'approved' | 'superseded';
  approvalReference?: string;
  building?: string;
  floor?: string;
  zone?: string;
  scaleText?: string;
  previewStatus: 'pending' | 'processing' | 'ready' | 'failed';
  previewPaths: string[];
  pages: Array<{
    pageIndex: number;
    mediaBoxPt: PdfBox;
    cropBoxPt: PdfBox;
    rotation: 0 | 90 | 180 | 270;
    pageFingerprint: string;
    previewPath: string;
    previewGeneration: string;
    previewSha256: string;
  }>;
  uploadedBy: string;
  uploadedAt: unknown;
};

type DrawingAnnotation = {
  id: string;
  pageIndex: number;
  pageFingerprint: string;
  layer: 'install' | 'dismantle' | 'retain' | 'equipment' | 'pedestrian' | 'lifting' | 'restricted' | 'storage';
  shape: 'polygon' | 'rect' | 'line' | 'circle' | 'marker' | 'text';
  points: Array<{ x: number; y: number }>;
  label: string;
  zoneCode?: string;
  sequence?: number;
  startDate?: string;
  endDate?: string;
  reason?: string;
  styleVersion: number;
  locked: boolean;
  createdBy: string;
  updatedAt: unknown;
};
```

### 13.4 스냅샷과 발행

```ts
type PlanSnapshot = {
  id: string;
  planId: string;
  reason: 'review_request' | 'approval' | 'export';
  content: unknown;
  contentHash: string;
  templateHash: string;
  drawingHashes: Record<string, string>;
  createdBy: string;
  createdAt: unknown;
};

type ReviewPackage = {
  id: string;
  cycleId: string;
  roundNo: number;
  previousPackageId?: string;
  reviewSnapshotId: string;
  reviewSnapshotHash: string;
  reviewSnapshotStoragePath: string;
  reviewSnapshotLockVersion: number;
  diffSummary: Record<string, unknown>;
  unresolvedAtSubmit: number;
  currentUnresolved: number;
};

type ReviewComment = {
  id: string;
  cycleId: string;
  originPackageId: string;
  originSnapshotId: string;
  status: 'open' | 'addressed' | 'resolved';
  required: boolean;
  visibility: 'participants' | 'reviewers_and_approvers' | 'central_only';
  anchor: PlanAnchor | SectionAnchor | StableFieldAnchor | DrawingPageAnchor;
  version: number;
};

type PlanExport = {
  id: string;
  planId: string;
  snapshotId: string;
  kind: 'draft' | 'issued' | 'record_appendix';
  status: 'queued' | 'rendering' | 'validating' | 'ready' | 'failed';
  storagePath?: string;
  fileSha256?: string;
  pageCount?: number;
  fileSize?: number;
  rendererVersion: string;
  validationReport?: Record<string, unknown>;
  generatedBy: string;
  generatedAt?: unknown;
};

type PlanExportJob = {
  id: string;
  authority: 'server';
  status: 'READY_FOR_VISUAL_CHECK' | 'ISSUED';
  approvedSnapshotId: string;
  approvedSnapshotHash: string;
  approvedSnapshotStorageGeneration: string;
  approvalEvidenceHash: string;
  authoritativeDrawingPreviewBindingHash: string;
  candidateArtifact: ImmutableServerPdfArtifact;
  issuedArtifact?: ImmutableServerPdfArtifact;
  visualCheckedBy?: string;
  visualCheckedAt?: string;
};
```

### 13.5 Storage 경로

```text
construction-plans/{siteId}/{planId}/drawings/{drawingId}/{drawingRevisionId}/source.{ext}
construction-plans/{siteId}/{planId}/previews/{drawingId}/{sourceSha256}/page-{page}.png
construction-plans/{siteId}/{planId}/snapshots/{snapshotSha256}.json
construction-plans/{siteId}/{planId}/server-exports/candidate/rev-{revision}/{rendererVersion}/{snapshotSha256}/{outputSha256}.pdf
construction-plans/{siteId}/{planId}/server-exports/issued/rev-{revision}/{rendererVersion}/{snapshotSha256}/{outputSha256}.pdf
construction-plan-records/{siteId}/{planId}/{recordId}/photos/{safeFileName}
```

`server-exports/**`는 브라우저 쓰기를 전면 거부한다. candidate는 발행 권한자만 읽고, issued는 발행 트랜잭션 완료 후 계획서 참여자가 읽는다. 동일 hash 재시도는 create-only 객체와 exact metadata가 모두 같을 때만 재사용한다.

기존 `construction-plans/{planId}/drawings/**` 객체는 참여자·중앙권한에 한해 읽기만 허용하며 신규 생성·덮어쓰기·삭제는 금지한다.

## 14. 템플릿 관리

```text
작성중 → 검토중 → 발행 → 폐기
```

- 발행된 템플릿은 직접 수정하지 않고 새 버전을 생성한다.
- 신규 계획서는 최신 발행 버전을 기본 선택한다.
- 기존 발행본은 당시 템플릿 스냅샷을 사용한다.
- 폐기 버전으로 신규 계획서를 만들 수 없다.
- 샘플 계획서는 모든 페이지에 SAMPLE을 표시한다.

템플릿은 문서 테마, 로고, 페이지 규격, 장/절, 정적 문구, 입력·검증 스키마, 조직도 레이아웃, 부품 카탈로그, 설치·타설·해체 절차, 위험성평가, 체크리스트, renderer 버전을 포함한다.

표준 문구를 현장에서 수정하면 수정사유, 원문/수정문 diff, 검토자 확인을 강제한다.

## 15. 장비·위험성·Hold Point

### 15.1 장비계획

```ts
type EquipmentPlanItem = {
  category: 'lifting' | 'transport' | 'work-at-height' | 'assembly' | 'measurement';
  equipmentName: string;
  model?: string;
  registrationNo?: string;
  ratedCapacity?: string;
  workRadius?: string;
  inspectionValidUntil?: string;
  operatorWorkerId?: string;
  signalerWorkerId?: string;
  workZones: string[];
  plannedStages: string[];
  controlMeasures: string[];
};
```

### 15.2 위험성평가

- 작업단계, 위험요인, 가능성, 중대성, 초기 위험도
- 저감대책, 담당자, 조치 후 가능성·중대성·잔여 위험도, 확인자

위험도 계산식과 허용기준은 템플릿 설정으로 관리한다. 시스템은 공학적 적합을 보증하지 않고 미입력, 계산불일치, 고위험 미조치만 검증한다.

### 15.3 Hold Point

- 도면 승인
- 자재 검수
- 기초·바닥 상태
- 1단 조립
- 가새·수평재
- 상부 지지
- 타설 전 검측
- 타설 승인
- 해체 승인

각 단계는 요구 증빙, 담당 역할, 완료조건, 결정시각, 의견을 가진다.

## 16. 문서 상태와 승인 흐름

```text
작성중 → 검토중 → 수정요청 → 작성중
              └→ 검토완료 → 승인-발행대기 → 현장사용 발행
현장사용 발행 → 새 Rev. 발행 시 대체됨 → 보관
```

| 현재 | 동작 | 다음 | 수행자 |
|---|---|---|---|
| draft | 검토요청 | in_review | 작성자 |
| in_review | 수정요청 | changes_requested | 검토자/승인자 |
| changes_requested | 재검토요청 | in_review | 작성자 |
| in_review | 필수검토 완료 | review_completed | 검토자 |
| review_completed | 최종승인 | approved_pending_issue | 승인자 |
| approved_pending_issue | PDF 검사 성공 | issued | 서버 |
| approved_pending_issue | PDF 검사 실패 | 동일상태 | 서버/운영자 재시도 |
| issued | 개정본 생성 | 새 draft | 작성자 |
| issued | 새 Rev. 발행 | superseded | 서버 |

- 검토요청 순간 제출 스냅샷 생성
- 검토중·검토완료·승인대기에서는 본문 수정 불가
- 검토결정 전 작성자는 요청 회수 가능
- 자기 승인 허용 여부는 회사 정책으로 확정, 권장은 금지
- `폐기`, `대체됨`, `보관`은 서로 다른 의미
- 승인/발행 이력은 삭제하지 않고 취소·대체 이벤트 추가

## 17. 검증 규칙

### 17.1 현장사용 발행 차단

- 현장, 문서번호, Rev., 작성일 누락
- 현장책임자, 공사담당, 안전담당 누락
- 동·층·구간 누락
- 예시도면이 본문 도면으로 포함됨
- 승인도면 또는 승인근거 미연결
- 도면번호·Rev.·적용구간 누락
- 설치구간 누락
- 해체구간 또는 존치계획 누락
- 구조검토 근거의 출처·Rev.·적용구간 누락
- 예시 수치 또는 `[기입]` placeholder 잔존
- 양중장비 모델·정격능력·작업반경·검사기간 누락
- 고위험 항목의 저감대책·담당자 누락
- 필수 검토단계 미완료
- 미해결 필수 의견 존재
- 스냅샷, 템플릿, 도면 hash 불일치
- PDF 시각·텍스트 검사 실패

### 17.2 경고

- 현장사진 미첨부
- 비상연락망 일부 누락
- 동일인 역할 겸임
- 현장 마스터와 스냅샷 불일치
- 표준 문구 직접 수정
- 도면 축척 미입력
- 레이어 라벨 누락
- 장비 검사만료 임박
- 흑백 범례 식별성 낮음
- `해당 없음` 사유가 모호함

### 17.3 안내

- 최신 템플릿 존재
- 최신 승인도면 Rev. 존재
- 담당팀·작업자 갱신 가능
- 완료기록 부록 추가 가능

## 18. PDF 생성 설계

### 18.1 출력 규격

- MVP 모든 페이지 A4 세로, 595.28 x 841.89pt
- 도면은 안전영역 안에 비율 유지 배치
- 혼합 가로 페이지는 후속 단계
- 머리글: 장 번호, 제목, 영문 보조제목, 로고
- 꼬리글: 문서명, 현장명, 회사명, Rev., 현재/전체 페이지
- 한글 폰트 내장·임베딩, 본문 검색·복사 가능
- PDF 메타데이터: 제목, 현장명, 문서번호, Rev.
- 장별 북마크 생성
- 표 헤더 반복, 행 중간 분할 금지
- 도면 주석 SVG 합성
- DRAFT 모든 페이지 워터마크

### 18.2 아키텍처

```text
클라이언트
  → PREPARE(planId, approvedSnapshotHash)
서버
  → 승인 snapshot v2·approval evidence·권위 도면 manifest 재검증
  → 원본 도면 bytes/generation/SHA-256 직접 로드
  → candidate profile 42쪽 결정적 렌더
  → PDF 구조·A4·한글·page manifest·hash 검사
  → server-exports/candidate create-only 저장 및 READY job 생성
클라이언트
  → candidate bytes·generation·SHA를 다시 검증하고 육안 확인
  → FINALIZE(planId, jobId, candidateSha, approvedSnapshotHash, true)
서버
  → candidate와 최신 승인 pointer 재검증
  → issued profile을 동일 page model로 다시 렌더
  → server-exports/issued create-only 저장
  → plan/job/export/series/이전 Rev. 대체/event를 한 transaction으로 확정
```

현재 구현은 1GiB·300초의 전용 Cloud Function 경계에서 동작하며, PDF 원본은 선택된 페이지만 순차 래스터화한다. 운영 p95·동시성·파일크기가 Function 한도를 넘으면 동일 renderer/job 계약을 유지한 채 Cloud Run worker로 이동한다.

### 18.3 고정 논리 매니페스트와 물리 페이지 자동 분할

1. 승인 스냅샷의 템플릿 ID·버전과 **논리 1~42 페이지** 매니페스트를 대조한다.
2. 3쪽은 논리 5~23쪽, 4쪽은 논리 24~42쪽을 각각 정확히 19개씩 출력한다.
3. 논리 페이지의 표·조직·장비·위험성평가·현장별 구조화 데이터가 A4 본문 높이를 넘으면 해당 논리 페이지 바로 뒤에 `계속 1`, `계속 2` 물리 페이지를 자동 생성한다.
4. 표는 행 중간에서 자르지 않고, 연속 페이지마다 표 헤더와 논리 페이지 제목을 반복한다. 고정 서명·빈 실행양식·도면 패널은 임의 분할하지 않는다.
5. 물리 page manifest에는 `physicalPageNumber`, `logicalPageNumber`, `continuationIndex`, `payloadHash`, `coveragePaths`를 기록한다. 머리글·꼬리글의 현재/전체 쪽수는 물리 페이지 기준이며, 목차에는 각 논리 페이지의 실제 시작 물리 쪽수를 표시한다.
6. 논리 페이지 누락·중복·순서변경, 미분류 데이터, 잘린 행, 빈 continuation 또는 물리 200쪽 초과가 있으면 렌더를 실패시킨다.
7. candidate와 issued는 profile 표식 외에 동일한 논리/물리 page manifest와 content coverage를 가져야 한다.

### 18.4 파일명

```text
{현장코드}_{문서번호}_REV-{revision}_{DRAFT|ISSUED}_{YYYYMMDD}.pdf
```

### 18.5 PDF 품질검사

- 파일 열기와 암호화 여부
- 모든 페이지 A4 규격
- 예상/실제 페이지 수
- 목차와 장 시작 페이지 일치
- 머리글·꼬리글·페이지번호 존재
- 한글 폰트 임베딩과 추출 가능성
- 화면에 없는 과거 Rev.·중복 텍스트 부재
- 빈 페이지·잘림·겹침·검은 사각형·깨진 이미지 부재
- 이미지 0바이트·저해상도 경고
- 도면 주석과 범례 수 일치
- 예시도·placeholder·예시 수치 부재
- 승인 snapshot hash와 issued export hash는 서로 다른 의미로 각각 기록
- candidate/issued의 콘텐츠·템플릿·도면 provenance는 같고 profile·renderInput·파일 SHA는 다름
- PDF 본문에 숨은 과거 Rev., raw JSON, Storage bearer URL, leaf 감사경로가 없음
- 본문·표·도면 callout의 최소 인쇄 글자크기 준수

PDF 페이지를 PNG로 렌더링해 시각검사하고, 별도로 텍스트 추출·메타데이터·페이지 박스·폰트·hash를 검사한다.

## 19. 파일 보안과 접근제어

### 19.1 업로드 검사

- 확장자와 실제 MIME signature 검사
- PDF/PNG/JPEG만 허용
- 암호화·손상·JavaScript·첨부파일 포함 PDF 제한 또는 정화
- 파일명 정규화
- SHA-256 중복검사
- 업로드 완료 전 문서 연결 금지

### 19.2 권한

- Firestore는 참여자와 역할 claim 모두 확인
- Storage는 siteId/planId 범위 확인
- 발행본은 서버만 쓰기 가능
- 발행본에서 참조 중인 원본 도면 삭제 차단
- 장기 공개 URL 대신 필요 시 제한시간 URL

### 19.3 개인정보

- 조직도는 이름, 역할, 소속, 선택적 연락처·사진만 포함
- 주민번호, 계좌, 급여, 주소는 접근하지 않음
- 사진·서명은 권한·동의 확인 시에만 사용
- 감사로그에 민감한 원문 복제 금지

## 20. 감사로그

다음 이벤트를 기록한다.

- 계획서 생성·복제·폐기·보관
- 마스터 동기화
- 표준 문구 수정
- 조직 역할 변경
- 도면 업로드·교체·상태변경
- 주석 생성·변경·삭제
- 검토요청·수정요청·검토완료·승인·발행·취소
- 스냅샷 생성
- PDF 생성·실패·다운로드
- 실행기록 작성·수정·확인

로그는 actorId, actorNameSnapshot, action, entity, before/after 요약, reason, timestamp, requestId를 가진다.

## 21. 접근성·반응형·온보딩

- 작성 UI WCAG 2.2 AA 목표
- 공식 P0 환경: Windows Chrome·Edge 최신 2개 버전, 최소 1280px
- 1024px에서는 우측 패널 drawer
- 모바일은 발행본 조회·검토·실행기록, 정밀 도면편집 제외
- 색상만으로 상태·레이어 구분 금지
- 최소 클릭영역 44x44px 권장
- 캔버스 옆 텍스트형 객체 목록 제공
- 키보드로 객체 선택·삭제·잠금·속성편집 가능
- 스크린리더용 오류요약·저장상태 알림
- 첫 진입 체크리스트: 현장 연결 → 조직 확정 → 도면 표시
- 도면 첫 사용 시 다각형 연습, 건너뛰기 가능
- DWG 업로드 시 PDF 변환 방법 안내

## 22. 비기능 요구사항

| 항목 | MVP 목표 |
|---|---|
| 목록 첫 표시 | 일반 데이터 2초 이내 |
| 편집기 골격 | 3초 이내 |
| 자동저장 | 입력 종료 1초 후 시작, 정상망 3초 이내 완료 |
| 도면 줌·이동 | 일반 노트북 체감 30fps 이상 |
| PDF 생성 | 42페이지·도면 20개 p95 120초 이하 목표 |
| PDF 재시도 | 같은 snapshot에 멱등 |
| 데이터 복구 | section·annotation 단위 복원 |
| 감사성 | 승인·발행 이벤트 100% 기록 |

수치는 실제 현장 도면으로 베이스라인 후 확정한다.

## 23. 테스트 전략

### 23.1 단위

- section validation
- source/snapshot/override 병합
- 상태전이·Rev. 계산
- 정규화 좌표와 회전 변환
- 위험도 계산
- 파일명·Storage path
- 목차 page map

### 23.2 통합

- Firebase Emulator CRUD·권한
- 편집잠금·heartbeat·강제해제
- 승인 후 수정 차단
- 도면 교체·주석 참조
- export job 멱등·재시도
- Storage 접근규칙

### 23.3 E2E

1. 현장 선택·초안 생성
2. 조직도 확정
3. PDF 업로드
4. 설치·해체 구간 작성
5. 오류 해결
6. 검토·수정·재제출
7. 승인·PDF 검사·발행
8. 개정본 생성

### 23.4 PDF 골든 테스트

- 42페이지 기준 샘플
- 긴 현장명·회사명
- 조직도 최소/12명/초과
- 위험성평가 1행/다페이지
- 한글·영문·숫자 혼합
- 고해상도/저해상도 도면
- 빈 체크리스트/완료기록
- DRAFT/ISSUED
- 숨은 과거 Rev. 텍스트
- 표·안내·서명영역 경계 겹침

### 23.5 보안

- 다른 현장 planId 접근
- 발행본 path 직접 쓰기
- 위장 MIME·악성 파일명
- 승인 도중 snapshot 변경
- 만료되지 않는 URL 노출

## 24. 관측성과 운영

### 로그

- requestId, userId, planId, snapshotId, jobId
- export 단계별 시간, 페이지 수, 파일크기
- 도면 변환 실패 원인
- 검증 오류 코드

### 알림

- PDF 생성 실패
- queue 장기대기
- 승인 hash 불일치
- Storage 원본 누락
- 특정 템플릿 반복 오류

### 운영도구

- 같은 snapshot export 재시도
- 실패 validation report 조회
- 템플릿 비활성화
- 감사사유 기반 잠금 강제해제
- 발행본 직접수정 금지, 재발행 이벤트 사용

## 25. 구현 모듈

### 프론트엔드

```text
src/features/construction-plan/
  pages/
  components/editor/
  components/organization/
  components/drawings/
  components/validation/
  components/preview/
  components/approvals/
  sections/
  services/
  types/
  schemas/
  utils/
```

### 서버·렌더러

```text
functions/src/constructionPlans/
  index.ts
  callables.ts
  domain.ts
  domain.test.ts

renderer/
  templates/
  sections/
  assets/fonts/
  buildHtml.ts
  renderPdf.ts
  validatePdf.ts
```

### 기존 코드 연결

- `siteService.getSites()`와 `SiteSchema`
- `companyService`, `teamService`, `manpowerService`
- `useOrganizationTree`의 회사-팀-작업자 관계
- `storageService.uploadFileInfo()`
- `App.tsx`, `defaultMenu.ts`, `menuPaths.ts`
- 기존 print/html2canvas 페이지는 미리보기 UX 참고만 사용

`CheongyeonOrgChartPage`를 캡처하지 않고 동일 데이터 소스를 쓰는 A4 전용 조직도 renderer를 만든다.

## 26. 구현 단계와 일정

프로덕션 품질 MVP는 약 30-46 인주로 본다. 프론트엔드 2명, 백엔드/플랫폼 1명, QA 0.5명, 현장 도메인 담당자 파트타임이 병렬로 참여하면 P50 약 12주, P90 약 16주가 현실적이다.

### Phase 0. 정책·기술 Spike - 2주

- 실제 승인도면 3종
- 작성·검토·승인·발행 정책
- 템플릿 REV.1
- PDF 규격·로고·폰트
- 개인정보 정책
- 회전·CropBox PDF 좌표 실험
- 한글·원본도면 벡터 보존 PDF 실험
- Firestore/Storage 보안규칙 선배포

### Phase 1. 계약·문서 골격 - 3주

- 목록·마법사·편집기
- 현장·회사·팀·작업자 연결
- 조직도
- 템플릿·섹션 데이터화
- 편집잠금·자동저장·검증센터

### Phase 2. 도면 스튜디오 - 4-6주

- PDF/이미지 업로드·검사
- 페이지 미리보기
- 주석·레이어·범례
- 도면목록·hash·교체이력

### Phase 3. 검토·승인·PDF - 4-6주

- 검토·수정·검토완료·승인
- 스냅샷 잠금
- 서버 renderer·2-pass 목차
- 시각·텍스트 PDF 검사
- 현장사용 발행·이력

### Phase 4. 통합·파일럿 - 2주

- 실제 현장 1곳 shadow 발행
- 기존 수작업 PDF와 내용·품질 비교
- 5개 현장 canary
- 성능·파일 제한·운영절차 확정

### Phase 5. 현장 실행기록 - 별도 6-9주

- 모바일 점검표
- 사진대지
- Hold Point
- 기록 부록 PDF

단일 개발자가 전부 구현하는 경우 30-46주 이상의 순수 개발공수와 도메인 검수기간이 필요하므로, 도면과 PDF 렌더링을 별도 기술축으로 병렬화하는 편이 좋다.

## 27. 범위 우선순위

### P0 / Must

- 시스템동바리 단일 템플릿
- 현장·조직 연동·출처·스냅샷
- 역할 슬롯 조직도
- PDF/PNG/JPG 도면과 설치·해체·존치 주석
- 단일 편집자 잠금·자동저장
- 검증센터
- 검토·승인·발행·개정 이력
- 서버 A4 PDF와 DRAFT
- 권한·감사로그·발행본 불변성

### P1 / Should

- 필드·도면 객체 의견과 해결상태
- 이전 제출본/Rev. diff
- 템플릿 관리 UI
- 모바일 검토·승인
- 장비·검측·일일점검 기록
- 사진대지·부록
- 알림·기한·위임
- 원본 PDF 도면의 vector 보존 합성(현재 현장사용 renderer는 검증된 선택 페이지를 2400px raster로 합성)
- 현장 실행사진의 불변 업로드·서명·실행기록 부록(현재 발행본에는 `미실시·승인증적 아님` 빈 양식만 포함)
- 오래된 READY candidate·고아 create-only 객체 정리 작업

### P2 / Could

- DWG 변환
- AI 도면 구간 후보
- 실시간 공동편집
- 오프라인 기록
- 법적 전자서명
- 외부 포털
- 다공법·다국어

### MVP 제외

- 구조 안전 자동판정
- 자유형 페이지 디자인
- 발행본 덮어쓰기
- 법규 적합성 자동보증

## 28. 위험과 대응

| 위험 | 영향 | 대응 |
|---|---|---|
| 예시도·예시수치 오인 | 매우 큼 | 명시적 example 상태·발행 차단 |
| 승인본이 현장변경으로 변형 | 큼 | 스냅샷·hash |
| 화면/추출텍스트 불일치 | 큼 | 시각+텍스트 PDF 검사 |
| 표·서명란 겹침 | 큼 | 페이지 골든 테스트 |
| 42페이지 브라우저 메모리 | 큼 | 도면 지연로드·순차 렌더·Blob URL 즉시 회수·고정 출력 한도 |
| 도면 좌표 어긋남 | 큼 | 정규화좌표·회전모델·회귀테스트 |
| 한글 폰트 깨짐 | 큼 | 서버폰트·추출검사 |
| 동시수정 덮어쓰기 | 중간 | P0 편집잠금·lockVersion |
| 대용량/손상 PDF | 중간 | 검사·제한·비동기 변환 |
| 점검 전 완료 오인 | 매우 큼 | 계획서와 실행기록 분리 |
| 규정변경 | 중간 | 템플릿 버전·관리자 발행 |
| 렌더 비용 | 중간 | queue·cache·hash 재사용 |

## 29. 수용 기준

### 생성·연동

- 현장·템플릿 선택 후 표지·공사개요·조직 후보와 출처가 표시된다.
- 원천값이 없으면 추정하지 않고 미완료로 표시한다.
- 연동값 수정 시 원래값과 직접수정 상태를 보고 원천값으로 복원한다.

### 저장·복구

- 변경 후 2초 이내 저장상태가 갱신된다.
- 새로고침·재로그인·다른 PC에서 같은 값과 주석이 복원된다.
- 다른 편집자는 조회전용이며 기존 변경을 덮지 못한다.
- 네트워크 실패 시 미저장 변경과 마지막 성공시각을 본다.

### 조직도

- 필수역할 공석이면 검토요청이 차단된다.
- 비활성 인원은 신규 후보에 없고 기존배정 시 경고한다.
- 12명 초과 시 글자 축소 대신 추가 인원표로 분리한다.

### 도면

- PDF·PNG·JPG 진행률과 처리상태를 본다.
- 주석은 확대·새로고침·재접속 후 같은 위치다.
- 설치와 해체/존치 구간은 라벨 또는 구간코드를 가진다.
- 예시도 또는 승인근거 없는 도면은 발행을 막는다.
- 교체 전 원본·주석 이력을 보존한다.
- 흑백에서도 레이어를 선·해칭·라벨로 구분한다.

### 검토·발행

- 검토요청 후 작성자는 본문을 수정하지 못한다.
- 수정요청은 사유 없이 완료되지 않는다.
- 검토완료 전 최종승인이 불가능하다.
- 승인 후 PDF 검사 성공 전까지 현장사용 발행이 아니다.
- 발행 후 API로 데이터를 바꿔도 스냅샷과 PDF가 변하지 않는다.
- 새 Rev. 발행 시 이전본은 대체됨이지만 조회 가능하다.

### PDF

- 모든 페이지가 210x297mm이다.
- 목차와 실제 페이지가 모두 일치한다.
- 한글 폰트가 임베딩되고 검색·복사된다.
- 표·도면·서명영역이 잘리거나 겹치지 않는다.
- 화면에 없는 과거 Rev.·중복텍스트가 없다.
- 빈 페이지·누락·깨진 이미지가 있으면 발행되지 않는다.
- 파일명, 메타데이터, 북마크, hash, 페이지 수, renderer 버전이 기록된다.

## 30. 개발 전 확정 정책

| 결정 | 권장안 |
|---|---|
| 첫 공법 | 시스템동바리 1종 |
| 승인단계 | 공사·안전·품질 검토 후 최종승인 |
| 자기승인 | 금지 |
| 도면형식 | PDF/PNG/JPG, DWG 제외 |
| 페이지방향 | MVP A4 세로 고정 |
| 기록범위 | Phase 4 분리 |
| 연락처 | 기본 미표시 |
| 승인표현 | 사용자·역할·시각·이력, 법적 전자서명 아님 |
| 렌더인프라 | Cloud Run 권장 |
| 편집방식 | P0 단일 편집자 잠금 |
| 예시수치 | 발행본 포함 금지 |
| 원본보존 | 발행본 참조 중 삭제 금지 |

추가로 문서번호·Rev. 규칙, 승인도면 인정 근거, 잠금 만료시간, 도면 보존기간, 템플릿 롤백 책임자를 조직 정책으로 확정해야 한다.

## 31. 첫 스프린트 백로그

1. `ConstructionPlan`, `Section`, `OrganizationSnapshot` Zod 스키마
2. 시스템동바리 template manifest와 42페이지 section mapping
3. 목록 라우트와 권한가드
4. 생성 마법사와 `siteService` 연결
5. 회사·팀·작업자 최소노출 DTO
6. 초안 생성 transaction·감사로그
7. 단일 편집자 lock·heartbeat·lockVersion
8. 3열 editor shell과 A4 page component
9. 표지·공사개요·조직도 renderer
10. validation rule engine과 목차 오류이동

## 32. 완료 정의

### 기능

- 현장을 선택해 표지·공사개요·조직도 초안을 만든다.
- 실제 도면에 설치·해체/존치 구간을 표시한다.
- 오류를 목차·검증센터에서 찾아 해결한다.
- 다른 PC에서 동일 초안과 주석을 복원한다.
- 검토·수정·승인·발행·개정 흐름이 작동한다.
- 발행본은 승인 스냅샷 외 데이터를 읽지 않는다.

### PDF

- 모든 페이지 A4, 목차·머리글·꼬리글·번호 일치
- 한글·표·도면·범례·서명영역 무결성
- 시각검사와 텍스트검사 통과
- DRAFT와 현장사용 발행본 명확히 구분
- hash·페이지 수·renderer 버전 기록

### 운영

- 실패 export를 같은 snapshot으로 재시도
- 권한위반·승인 후 수정이 테스트로 차단
- 템플릿·발행본 복구절차 문서화
- 주요 이벤트에 requestId 기록

## 33. 핵심 제품 권고

첫 배포 목표를 다음 한 문장으로 고정한다.

> 현장을 선택해 조직도와 실제 승인도면이 포함된 시스템동바리 초안을 만들고, 공사·안전·품질 검토와 최종승인, PDF 품질검사를 거쳐 추적 가능한 현장사용 발행본을 만든다.

모바일 점검, 사진대지, DWG 변환, AI 도면분석은 핵심 문서통제와 PDF 품질이 안정된 뒤 확장한다. 구조 검토·도면 승인·해체 조건은 편의를 위해 자동 통과시키지 않고 담당 전문가의 확인과 근거 문서를 남긴다.

## 34. 도면 적용성·구조기준 추적 부록

### 34.1 D-01-D-06 적용성 매트릭스

참고 문서의 표준 도면번호는 각 현장에서 반드시 `적용`, `대체도면`, `해당없음` 중 하나로 확정한다.

| 유형 | 확인 내용 | `해당없음`에 필요한 것 |
|---|---|---|
| D-01 평면배치 | Grid, 지주, 보, 개구부, 설치구간 | 사유, 검토자 |
| D-02 입면·단면 | 층고, 단높이, 이음, 가새, 잭, 멍에 | 사유, 검토자 |
| D-03 슬래브·보 지지 | 하중경로, 보 하부 추가지지, 부재방향 | 사유, 기술검토 |
| D-04 개구부·단차·가장자리 | 지지불가부, 보강상세, 안전난간 | 사유, 기술검토 |
| D-05 접합상세 | 베이스, U-Head, 핀, 가새 접합 | 대체 상세번호 |
| D-06 장비간섭 | 펌프호스, 장비, 적치, 통로 간섭 | 간섭없음 근거 |

현장 적용 동·층·구간 중 하나라도 위 매트릭스로 커버되지 않으면 기술승인과 현장사용 발행을 막는다.

### 34.2 구조 주요값 출처

다음 값은 단순 문자열이 아니라 값·단위·출처·적용구간을 함께 저장한다.

- 층고, 슬래브 두께, 보 폭·깊이
- X/Y 지주 간격, 단높이, 수직재 조합
- 가새 방향·간격·연속구간
- 상·하부 잭 허용범위
- 멍에·장선 규격과 방향
- 개구부·단차·가장자리 보강
- 타설 구간·순서·속도·분할
- 집중 적치·펌프호스·장비하중 조건
- 하부 바닥 또는 구조체 지지조건
- 존치·재동바리·해체조건
- 수직도·레벨 등 검측 허용값

```ts
type VerifiedEngineeringValue = {
  key: string;
  value: number | string;
  unit?: string;
  sourceDocumentId: string;
  sourceRevision: string;
  sourcePageOrSection?: string;
  applicableZones: string[];
  verificationStatus: 'unverified' | 'reviewed' | 'approved';
  verifiedBy?: string;
  verifiedAt?: string;
  manualInputReason?: string;
};
```

지주 간격, 가새, 잭, 부재규격, 설치·존치구간, 타설순서, 집중하중, 도면 Rev., 해체조건이 바뀌면 기존 기술검토 결정을 자동으로 무효화하고 재검토를 요구한다.

### 34.3 계획과 실행기록의 데이터 경계

| 대상 | 계획서 | 현장 실행기록 |
|---|---|---|
| 조직 | 예정 역할·책임자 | 실제 작업일 참여자 |
| 장비 | 예정 제원·구간·통제 | 당일 점검·실제 운전원·이상조치 |
| 자재 | 승인 제품·반입계획 | 로트·수량·검수결과 |
| Hold Point | 선행조건·승인 역할 | 실제 측정값·판정·서명시각 |
| 위험성평가 | 예상 위험·계획대책 | 당일 변경위험·추가조치·TBM |
| 도면 | 계획 설치·해체·존치 | 실제 설치상태·변경·준공표시 |
| 체크리스트 | 문항과 빈 양식 | 적합·부적합·해당없음·조치결과 |

빈 양식에는 `계획서 첨부 양식 / 미실시`를 표시한다. 계획서 승인으로 점검결과나 Hold Point가 자동 합격되지 않는다. 완료기록은 정확한 계획서 Rev., 도면 Rev., 동·층·구간을 참조한다.

## 35. 기술 구현 불변식

다음 규칙은 UI 편의보다 우선한다.

1. 초안 생성은 클라이언트 캐시 조합이 아니라 서버 callable이 현장·팀·작업자를 읽고 safe DTO로 투영한다.
2. 검토·승인·발행은 정확히 같은 snapshot hash를 대상으로 한다.
3. 렌더러는 live Firestore 문서를 읽지 않고 Storage의 canonical release snapshot만 읽는다.
4. 큰 snapshot은 Firestore 1MiB 제한을 피하기 위해 canonical JSON으로 Storage에 저장하고 Firestore에는 경로와 SHA-256만 둔다.
5. published template, drawing revision, release, issued export는 교체하지 않고 새 버전을 만든다.
6. 상태, 승인자, 승인시각, release, export 경로는 클라이언트가 직접 쓰지 못한다.
7. 도면 주석은 UI 라이브러리 JSON이 아닌 순수 geometry 계약으로 저장한다.
8. 원본 파일명과 장기 download token URL을 영속 데이터 키로 사용하지 않는다.
9. 승인 증적과 감사이벤트는 서버 전용 컬렉션에 기록한다.
10. 발행본 PDF는 원본 PDF 도면의 벡터 선을 가능한 한 보존한다.

### 35.1 모듈 경계

```text
packages/construction-plan-contracts/
  schemas/           공용 Zod/JSON Schema
  state-machine/     상태 전이
  validation/        검토·승인·발행 검증
  geometry/          CropBox·회전·주석 좌표
  canonicalize/      스냅샷 정규화·hash

src/features/construction-plan/
  domain/            브라우저 독립 도메인
  application/       생성·저장·제출·개정 use case
  infrastructure/    Firestore·Storage·Functions adapter
  ui/                화면과 컴포넌트
  print-preview/     화면 미리보기

functions/src/constructionPlans/
  auth.ts
  drafts.ts
  uploads.ts
  workflow.ts
  snapshots.ts
  exports.ts
  audit.ts

services/construction-plan-renderer/
  paged-text/
  drawing-compositor/
  fonts/
  renderPdf.ts
  validatePdf.ts
```

의존 방향은 `UI → application → domain/contracts`로 고정한다.

### 35.2 문서번호와 Rev. 경쟁 방지

```text
constructionPlanSeries/{seriesId}
  siteId
  documentNo
  documentNoKey
  tradeType
  latestRevisionNo
  latestPlanId
  latestIssuedPlanId
```

새 개정본은 series document transaction으로 revision을 증가시켜 동일 문서번호에 중복 Rev.가 생기지 않게 한다. `siteId + documentNoKey + revision` 고유성은 서버에서 확인한다.

### 35.3 도면 revision 모델

```text
constructionPlans/{planId}/drawings/{drawingId}
  activeRevisionId, drawingNo, title, applicability

.../drawings/{drawingId}/revisions/{drawingRevisionId}
  storagePath, bucketGeneration, sourceSha256
  mediaType, size, pageCount, processingStatus

.../revisions/{drawingRevisionId}/pages/{pageId}
  pageIndex, mediaBoxPt, cropBoxPt, rotation
  pageFingerprint, previewPath

.../revisions/{drawingRevisionId}/annotations/{annotationId}
  pageFingerprint, geometry, style, contentVersion, deletedAt
```

도면 원본이 바뀌면 새 revision을 만들고 이전 주석·검토결정은 자동 승계하지 않는다. 사용자가 `이전 주석 복사 후 재검토`를 명시적으로 선택한다.

## 36. 업로드·좌표·PDF 상세

### 36.1 업로드 세션

```text
prepareDrawingUpload
  → 격리된 staging 경로·sessionId 발급
클라이언트 resumable upload
  → finalizeDrawingUpload
서버 magic bytes·크기·generation·SHA 검사
  → processing job
페이지 크기·CropBox·회전·페이지 수 추출
preview 생성
  → READY 또는 FAILED
```

```text
construction-plan-staging/{uid}/{sessionId}/source
construction-plans/{siteId}/{planId}/drawings/{drawingRevisionId}/source
construction-plans/{siteId}/{planId}/previews/{drawingId}/{sourceSha256}/page-0001.png
construction-plans/{siteId}/{planId}/snapshots/{snapshotSha256}.json
construction-plans/{siteId}/{planId}/exports/{releaseId}/{rendererVersion}/{outputSha256}.pdf
```

- staging은 검증 전 quarantine으로 취급
- 같은 경로 overwrite 금지
- 서버에서 계산한 SHA-256과 object generation을 진실값으로 사용
- 미완료 세션 TTL 정리
- preview와 export는 서버만 쓰기
- 다운로드는 권한확인 후 5-10분 signed URL

### 36.2 정확한 좌표계

좌표 기준은 `회전 적용 후 CropBox, 좌상단 원점, x/y 0-1 정규화`로 고정한다.

```ts
type AnnotationGeometry =
  | { kind: 'polygon'; vertices: Point[] }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; rotationDeg: number }
  | { kind: 'polyline'; vertices: Point[]; arrowStart: boolean; arrowEnd: boolean }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'marker'; x: number; y: number; markerType: string }
  | { kind: 'text'; x: number; y: number; w: number; h: number; align: 'left' | 'center' | 'right' };

type AnnotationStyle = {
  strokeToken: string;
  fillToken?: string;
  strokeWidthPt: number;
  opacity: number;
  dash: 'solid' | 'dash' | 'dot';
  hatch?: 'none' | 'diagonal' | 'cross';
  fontSizePt?: number;
};
```

CropBox와 0/90/180/270도 회전의 화면→저장→PDF 왕복 변환을 property test로 검증한다.

### 36.3 원본 도면 품질 보존

텍스트 페이지와 도면 페이지의 생성방식을 나눈다.

1. Playwright/Chromium과 고정 버전 paged layout로 텍스트 페이지 생성
2. 2-pass 목차 확정
3. 원본 PDF 도면 페이지를 PDF XObject로 삽입해 벡터 보존
4. 주석을 PDF primitive 또는 SVG path로 합성
5. 이미지 도면은 원본 해상도로 삽입
6. 페이지 manifest 순서로 병합
7. 머리글·꼬리글·워터마크와 북마크 적용
8. PDF 1.7, 폰트 bundle, renderer container digest 기록

PDF/A는 실제 제출처 요구가 확인될 때 별도 export profile로 추가한다.

## 37. 서버 API·작업상태·보안규칙

### 37.1 서버 mutation

- `createConstructionPlanDraft`
- `acquireConstructionPlanEditLock`
- `saveConstructionPlanSection`
- `prepareDrawingUpload`
- `finalizeDrawingUpload`
- `submitConstructionPlanReview`
- `requestConstructionPlanChanges`
- `completeConstructionPlanReview`
- `approveConstructionPlan`
- `createConstructionPlanReviewComment`
- `replyConstructionPlanReviewComment`
- `transitionConstructionPlanReviewComment`
- `listConstructionPlanReviewComments`
- `listConstructionPlanReviewMessages`
- `listConstructionPlanReviewPackages`
- `createConstructionPlanRevision`
- `requestConstructionPlanExport`
- `retryConstructionPlanExport`
- `getConstructionPlanDownloadUrl`

모든 mutation은 requestId 또는 idempotencyKey를 받는다. export idempotency key는 `snapshotSha256 + exportProfile + rendererVersion` 조합으로 만든다.

### 37.2 비동기 job 상태

```text
QUEUED → PROCESSING → SUCCEEDED
                    → FAILED_RETRYABLE
                    → FAILED_FINAL
                    → CANCELLED
```

job에는 attemptCount, leaseExpiresAt, heartbeatAt, progress, errorCode를 둔다. Cloud Tasks가 비공개 Cloud Run endpoint를 OIDC로 호출하는 구조를 권장한다.

### 37.3 Firestore 규칙

새 최상위 컬렉션을 기존 broad fallback에 맡기지 않는다.

- `constructionPlanSeries`
- `constructionPlans`
- `constructionPlanTemplates`
- `constructionPlanExportJobs`
- `constructionPlanUploadSessions`
- `constructionPlanAuditEvents`
- `constructionPlanRecords`

published template, workflow event, review package, release, export, audit는 클라이언트 쓰기를 금지한다. plan status·approvedAt·issuedExportId 직접 변경도 금지한다. query는 participantUids, siteId, status 조건을 강제한다.

Storage의 `construction-plans`와 staging 경로도 명시 보호 top-level로 등록하고, 승인 원본·preview·export는 서버만 쓴다.

### 37.4 예상 인덱스

- plans: `siteId + status + updatedAt desc`
- plans: `participantUids array-contains + updatedAt desc`
- plans: `reviewerUids array-contains + status + submittedAt desc`
- plans: `approverUids array-contains + status + submittedAt desc`
- plans: `seriesId + revisionNo desc`
- annotations collection group: `pageIndex + zIndex`
- export jobs: `status + createdAt`
- records: `planId + type + date desc`
- audit: `planId + occurredAt desc`

검색하지 않는 section content, geometry, audit diff의 single-field index는 비활성화한다.

## 38. 배포·마이그레이션·운영 전환

### 38.1 배포 순서

1. 호환 가능한 공용 계약과 Firestore indexes를 먼저 배포한다.
2. 기존 브라우저 생성 경로를 유지한 상태에서 초안·개정·복제 Functions와 문서시리즈 transaction을 배포한다.
3. feature flag가 꺼진 상태로 서버 생성 API를 사용하는 프론트엔드를 배포하고 smoke test를 통과한다.
4. 마지막으로 security rules를 배포해 브라우저의 plan/series 직접 생성을 차단한다. 이 순서를 바꾸면 구버전 UI의 신규 작성이 즉시 중단된다.
5. 시스템동바리 template 1.0.0 seed·불변 발행을 확인한다.
6. 회전 도면과 벡터 PDF 기술 spike/golden fixture를 확정하고 renderer shadow 비교를 수행한다.
7. 내부 1개 현장 canary 후 5개 현장으로 확대한다.
8. approval과 issued export flag를 별도로 개방한다.

오류 시 feature flag를 닫되 승인 snapshot과 export 이력은 삭제하지 않는다.

### 38.2 기존 PDF

기존 완성 PDF는 억지로 editable 데이터로 변환하지 않는다.

```text
origin: legacyPdf
mode: readOnlyRelease
sourceSha256: ...
```

읽기 전용 legacy release로 등록하고, 다음 개정 시 새 템플릿 기반 초안으로 전환한다.

### 38.3 운영 승인 전 체크

- Firestore·Storage emulator 실제 허용/거부 테스트
- Sentry replay의 작업자명·연락처·도면 영역 masking
- renderer OOM·timeout·stuck heartbeat 알림
- 고아 staging object와 만료 edit lock 정리 job
- 템플릿·release·export 백업과 복원 runbook
- 현장사용 발행 취소·오발행·긴급교체 절차
