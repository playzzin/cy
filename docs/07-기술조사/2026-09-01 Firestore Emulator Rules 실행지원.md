---
type: research
status: 승인
owner: 고대리_BOT
reviewer: 슈퍼돼지_BOT
implementer: 이과장_BOT
date: 2026-09-01
checked_at: 2026-09-01 KST
superpig_verified_at: 2026-09-02 00:01 KST
next_review: 2026-10-01
tags: [cy, 기술조사, Firebase, Firestore, Emulator, SecurityRules, Java]
privacy: 식별정보·계좌·실제 급여금액·토큰 미포함
source_repo: /home/hermes/cy-rebaseline-candidate
source_mode: read-only
---

# 2026-09-01 Firestore Emulator Rules 실행지원

## 결론

이과장이 급여 Rules 행위 테스트를 돌리려면 **Java JDK 11 이상**, **이미 기동 중인 Firestore Emulator**, **클라이언트 SDK로 allow/deny를 검증**하면 된다. Firebase 공식 Local Emulator Suite 문서는 Java **21을 강제하지 않고 JDK 11+** 이다. `@firebase/rules-unit-testing` 현재 npm latest는 **5.0.2**이며 peer는 `firebase ^12.0.0`이다. CY 후보는 `firebase ^12.6.0`이라 메이저는 맞지만, 이 패키지는 아직 `package.json`에 없다.

상태: **이과장 실행 승인**. 이 문서는 실행 지원이다. 제품 코드·Rules 수정, npm install, 테스트 실행, Java 설치, Firebase 접근, 배포는 고대리가 하지 않는다.

권고 한 줄: **이과장에게 사용자 전용 Java와 격리 Emulator 테스트만 승인됨.** 기존 CY `emulators:exec` 패턴으로 최소 allow/deny 매트릭스를 실행하며 운영 Firebase·배포·Git 원격은 계속 금지한다.

## 조사 범위

- 확인 시각: 2026-09-01 KST
- 읽기 전용 후보: `/home/hermes/cy-rebaseline-candidate`
- 공식 문서 확인일: 2026-09-01 (페이지 Last updated는 2026-08-24 ~ 2026-09-01 UTC)
- 제외: Git add/commit/push, npm install, 테스트 실행, Java 설치, 운영 Firebase 접근, 배포, 이 문서와 인덱스 외 파일 수정
- X·블로그: 핵심 주장의 근거로 사용하지 않음. 커뮤니티 Java 버전 주장은 공식 문서와 충돌하면 버린다.

## 정확한 공식 요구사항

### 1. Firestore Emulator Java 런타임

공식 Local Emulator Suite 설치 문서(Last updated 2026-08-31 UTC):

- 선행 조건: Node.js 16.0 이상, **Java JDK 11 이상**
- Cloud Firestore Emulator는 Java 기반이다
- JVM 플래그는 `JAVA_TOOL_OPTIONS` (예: `export JAVA_TOOL_OPTIONS="-Xmx4g"` 후 `firebase emulators:start`)
- Firebase CLI 8.14.0 이상이 Emulator Suite에 필요

판정:

- CY Rules 테스트에 **Java 21이 공식 필수라는 문구는 Firebase 문서에 없다**
- Java 21은 JDK 11+를 만족하는 선택지일 뿐이다
- gcloud Firestore emulator의 Java 21+ 요구는 Google Cloud SDK 릴리스 노트 계열이며, Firebase CLI Local Emulator Suite 공식 페이지와 **동일 문서가 아니다**. 이과장 작업 경로는 `firebase emulators:*` 이므로 JDK 11+를 충족하면 된다
- Java 21을 사용할 경우 아래 Adoptium 절차로 **이과장_BOT이 사용자 전용 경로에만** 설치할 수 있다. 고대리는 설치하지 않는다

### 2. `@firebase/rules-unit-testing` 권장 버전·Firebase JS 호환

공식 Rules 테스트 문서(Last updated 2026-08-31 UTC)와 npm/소스:

- 공식 권고: **v9(모듈) 테스트 라이브러리**. v8 API는 하위 호환용
- 패키지: `@firebase/rules-unit-testing`
- 2026-09-01 npm latest: **5.0.2**
- `engines.node`: `>=20.0.0`
- `peerDependencies.firebase`: `^12.0.0`
- 5.0.2 `package.json` devDependency 관찰값: `firebase ^12.18.0` (peer 범위 안의 개발 의존. peer 자체를 12.18로 고정하지는 않음)
- 5.0.0 CHANGELOG: Node engines 최소 20, 의존 `firebase@12.0.0`
- 공식 문구: v9 라이브러리는 **항상 에뮬레이터만 인식하고 프로덕션에 닿지 않는다**
- Emulator가 없으면 타임아웃 또는 `ECONNREFUSED`

CY 후보 실측:

- 앱 `package.json`: `firebase ^12.6.0` → peer `^12.0.0`과 메이저 호환
- `@firebase/rules-unit-testing` **미선언**
- 기존 Rules 행위 테스트는 이 라이브러리 없이 `firebase` 클라이언트 + `firebase-admin` + `firebase emulators:exec` 이다

이과장 선택지:

1. 공식 권고: `@firebase/rules-unit-testing@5.0.2` + 기존 `firebase ^12.6.0` (설치는 승인 후, 이번 조사에서 npm install 금지)
2. CY 기존 패턴 유지: Admin으로 시드, 클라이언트로 allow/deny. 이미 `scripts/test-*-rules.mjs`가 이 방식

둘 다 Emulator가 먼저 떠 있어야 한다. 공식은 1을 권한다. CY 회귀 일관성은 2가 이미 검증된 경로다. **새 패키지 추가는 슈퍼돼지 승인 후.**

### 3. Emulator 시작 명령

공식 명령:

```
firebase emulators:start --only firestore
firebase emulators:exec --only firestore "./my-test-script.sh"
```

- 기본 Firestore 포트 8080. `firebase.json` `emulators.firestore.port`로 변경
- `emulators:exec`는 스크립트 종료 후 에뮬레이터를 자동 종료. CI에 더 적합
- 선행: `firebase setup:emulators:firestore` (테스트 문서), 또는 `emulators:start`가 `~/.cache/firebase/emulators/`에 바이너리를 받음
- `firebase.json`에 rules 경로가 없으면 에뮬레이터는 **open rules**로 취급할 수 있다

CY 기존 러너 실측 (`scripts/run-card-lifecycle-rules-test.mjs`):

```
firebase emulators:exec --only firestore,auth --project demo-cy-card-lifecycle node scripts/test-card-lifecycle-rules.mjs
```

급여 Rules 최소 실행(승인 후 이과장용, 이번 세션 미실행):

```
firebase emulators:exec --only firestore,auth --project demo-cy-payroll-rules node scripts/test-monthly-payroll-rules.mjs
```

프로젝트 ID는 `demo-` 접두를 쓴다. 공식 예시도 `demo-project-1234`이다.

### 4. Rules 테스트 격리·cleanup

공식 v9 API (test-rules-emulator / unit-tests, Last updated 2026-08-31 UTC):

| API | 역할 | 주의 |
|---|---|---|
| `initializeTestEnvironment({ projectId, firestore: { rules } })` | 테스트 환경 생성. Emulator 필수 | rules 문자열을 파일에서 읽는다 |
| `withSecurityRulesDisabled(callback)` | 시드 시 Rules 우회 | 콜백 종료 시 컨텍스트 파괴 |
| `authenticatedContext(uid, tokenOptions?)` | 인증된 클라이언트 | 커스텀 클레임 가능 |
| `unauthenticatedContext()` | 비로그인 클라이언트 | `request.auth == null` |
| `assertSucceeds` / `assertFails` | allow / permission-denied |  |
| `clearFirestore()` | 해당 projectId Firestore 데이터 삭제 | **테스트 사이 데이터 리셋은 이것** |
| `cleanup()` | RulesTestContext와 자원 정리 | **에뮬레이터 데이터는 지우지 않는다** |

공식 명시: `cleanup()`은 에뮬레이터 상태를 바꾸지 않는다. 테스트 사이 리셋은 `clearFirestore()` (또는 동등한 클리어).

CY 기존 스크립트는 `clearFirestore()`를 호출하지 않고, `emulators:exec`로 프로세스 수명 동안만 에뮬레이터를 띄운다. 한 프로세스 안에 여러 케이스를 넣으면 문서 ID를 고유하게 하거나 클리어가 필요하다.

Admin SDK로 시드하는 CY 패턴은 `withSecurityRulesDisabled`와 같은 목적이다. 공식 라이브러리를 쓰면 Admin 시드 대신 `withSecurityRulesDisabled`가 문서화된 방법이다.

### 5. `getAfter()` · access-call 제한

공식 conditions 문서(Last updated 2026-09-01 UTC)와 quotas/rules-structure(Last updated 2026-08-31 UTC):

- `getAfter(path)`: 트랜잭션/배치 쓰기가 **완료된 뒤, 커밋 전** 문서 예상 상태
- `get()`과 같이 **완전 지정 문서 경로**만 받는다
- 함께 일어나야 하는 쓰기를 강제할 때 사용
- access-call 한도 (`exists` / `get` / `getAfter`):
  - 단건 요청·쿼리: **10**
  - 다중 문서 읽기·트랜잭션·batched write 전체: **20**
  - 배치의 각 연산에도 단건 한도 10이 따로 적용
  - 초과 시 **permission denied**
  - 캐시된 접근은 한도에 미포함
- 이 함수들은 실제 읽기를 수행하므로 규칙이 거절해도 과금된다 (프로덕션). Emulator는 과금하지 않음
- 표현식 평가 한도: 요청당 **1,000**
- ruleset 소스 256KB, 컴파일 250KB

CY `monthly_payroll_settlements` 전용 match는 `getAfter()`를 쓰지 않는다. `canAccessMonthlyPayroll()` → `userProfile()` → `get(users/{uid})` 한 번이 전형적인 access-call이다. 클라이언트가 상태 전이를 배치로 묶어도 Rules가 전이를 거절하므로, 이 경로에서 `getAfter` 한도 초과를 재현할 필요는 최소 매트릭스에 넣지 않는다.

### 6. Admin SDK와 클라이언트 Rules 경계

공식 insecure-rules (Last updated 2026-08-31 UTC)와 connect_firestore:

- 모바일/웹 **클라이언트 라이브러리** 요청만 Security Rules로 평가된다. 하나라도 deny면 전체 요청 실패
- **Firebase Admin SDK와 Cloud Functions는 Rules를 우회**하고 데이터베이스에 접근한다
- closed rules(`allow read, write: if false`)여도 Admin/Functions는 접근 가능. 서버 전용 백엔드 패턴
- Admin SDK는 `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`이면 에뮬레이터에 붙는다
- Auth 에뮬레이터는 `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`
- 공식: 프로덕션에서 이 환경 변수를 설정하지 말 것

CY 실측:

- `functions/src/monthlyPayrollStatusTransition.ts`가 Admin으로 `reviewed` / `confirmed` / `paid` 전이를 수행한다
- Rules는 클라이언트 `create`/`delete` 금지, 클라이언트 `update`는 **draft→draft 내용만**
- 따라서 클라이언트 allow 테스트로 상태 전이가 성공하면 **버그**다. 전이는 Functions+Admin 경로의 몫이다

겹치는 match 공식 규칙(rules-structure): 문서가 여러 `match`에 걸리면 **어느 한쪽 allow가 true여도 허용**된다. 그래서 payroll 전용 deny가 있어도 generic wildcard가 true면 뚫린다. CY는 이 구멍을 `isLockedCollection`과 finance wildcard 제외로 막아 두었다. 테스트가 이 겹침을 반드시 확인해야 한다.

## CY 적용 파일 (읽기 전용 실측)

| 파일 | 역할 | 이번 조사에서 한 일 |
|---|---|---|
| `firestore.rules` | 급여 전용 match + generic fallback | 읽기만 |
| `firebase.json` | `firestore.rules`, emulator 포트 8080/9099 | 읽기만 |
| `firebase.construction-rules-test.json` | 격리 포트 18080/19099 | 읽기만 |
| `package.json` | `firebase ^12.6.0`, rules-unit-testing 없음 | 읽기만 |
| `functions/package.json` | `firebase-admin ^11.8.0`, Node 22 | 읽기만 |
| `src/security/firebaseRules.test.ts` | 문자열 회귀. Emulator 없음 | 읽기만 |
| `scripts/test-*-rules.mjs`, `scripts/run-*-rules-test.mjs` | 기존 Emulator 행위 테스트 패턴 | 읽기만 |
| `functions/src/monthlyPayrollStatusTransition.ts` | Admin 상태 전이 | 읽기만 |

고대리는 위 파일을 수정하지 않았다.

### `monthly_payroll_settlements` 현재 Rules (실측)

위치: `firestore.rules` 약 1755–1772행.

- `allow read: if canAccessMonthlyPayroll()`
- `allow create, delete: if false`
- `allow update: if canAccessMonthlyPayroll() && isValidPayrollSettlementUpdate()`
- `isValidPayrollSettlementUpdate()`: `beforeStatus == 'draft' && afterStatus == 'draft'` 등. 클라이언트 상태 전이 없음
- `canAccessMonthlyPayroll()`: `hasCurrentPayrollProfileRole(adminRoles() || financeRoles() || ['payroll_manager'])` 이고 `userProfile().status == 'active'`
- 토큰 클레임만으로 통과하는 `hasTokenRole` 경로는 문자열 테스트가 없음을 이미 고정

`isFinanceCollection`에 `'monthly_payroll_settlements'`가 들어 있다 (약 637행).

finance generic match (약 1775행대):

- `collectionId != 'monthly_payroll_settlements'` 로 **전용 match와 겹쳐 열리지 않게** 제외

generic wildcard (약 1965–1967행):

```
match /{collectionId}/{docId} {
  allow read, write: if hasActiveUserProfile() && !isLockedCollection(collectionId);
}
```

`isLockedCollection`은 `isFinanceCollection`을 포함하므로 `monthly_payroll_settlements`는 잠긴 컬렉션이다. 활성 일반 사용자가 wildcard로 급여 문서를 읽거나 쓰면 안 된다.

## 최소 allow/deny 테스트 매트릭스

대상 경로: `monthly_payroll_settlements/{settlementId}`. 시드는 Admin 또는 `withSecurityRulesDisabled`. 검증은 **클라이언트 SDK만**.

| ID | 주체 | 동작 | 기대 | 이유 |
|---|---|---|---|---|
| P1 | unauthenticated | get | deny | `canAccessMonthlyPayroll`는 활성 프로필 역할 필요 |
| P2 | unauthenticated | update draft 내용 | deny | 동일 |
| P3 | authenticated, 역할 없음/office/support, active | get | deny | payroll/admin/finance 아님 |
| P4 | authenticated, `payroll_manager` 또는 finance/admin, active | get | allow | 전용 read |
| P5 | P4와 동일 | create | deny | `allow create: if false` |
| P6 | P4와 동일 | delete | deny | `allow delete: if false` |
| P7 | P4와 동일 | update, `runStatus` draft 유지, 허용 필드만 | allow | `isValidPayrollSettlementUpdate` |
| P8 | P4와 동일 | update `draft` → `reviewed` | deny | 클라이언트 전이 금지. Functions+Admin 몫 |
| P9 | P4와 동일 | update `reviewed` → `confirmed` | deny | 동일 |
| P10 | P4와 동일 | update `confirmed` → `paid` | deny | 동일 |
| P11 | P4와 동일 | update에 `runStatus` 신설/변경 시도 | deny | Rules가 `runStatus` 키를 거부하는 경로 |
| P12 | authenticated active, 일반 역할 | get/update via generic collection path | deny | `isLockedCollection` + finance 제외 |
| P13 | Admin SDK | set/update 임의 상태 | 성공 (Rules 미적용) | 경계 확인. 클라이언트 allow로 기록하지 말 것 |
| P14 | inactive payroll 프로필 | get | deny | `userProfile().status == 'active'` |

P7의 “허용 필드”는 `isValidPayrollSettlementUpdate()` 본문을 그대로 따른다. 추측으로 필드를 넓히지 말 것.

P13은 allow 시나리오가 아니다. Admin 우회가 클라이언트 권한으로 오인되면 안 된다.

기존 `src/security/firebaseRules.test.ts`는 문자열 존재만 본다. **P1–P14를 대체하지 못한다.**

## 이과장 체크리스트 (승인됨)

구현 전:

- [x] 슈퍼돼지가 사용자 전용 Java 설치와 격리 Rules 테스트 범위를 승인함 (2026-09-02 00:01 KST)
- [ ] 작업 대상이 격리 후보 저장소인가. 운영 프로젝트 ID를 쓰지 않는가
- [ ] `java -version`이 11+인가. 없으면 이과장이 아래 Adoptium 절차로 `/home/hermes/.cache/cy-tools/` 아래에만 설치. sudo·시스템 전역 설치 금지
- [ ] 로컬에서 이미 8080/9099를 쓰는 에뮬레이터가 있으면 포트 충돌. 기존 `firebase.construction-rules-test.json`처럼 격리 포트 검토
- [ ] npm install / firebase deploy / 운영 자격 증명 / Git push 금지 범위 확인

테스트 작성:

- [ ] `demo-cy-payroll-rules` 같은 `demo-` 프로젝트 ID
- [ ] `firestore.rules`를 Emulator에 로드 (`firebase.json` 또는 `initializeTestEnvironment`)
- [ ] 시드와 검증 SDK를 분리 (Admin/disabled vs client)
- [ ] 테스트 사이 `clearFirestore()` 또는 고유 문서 ID + `emulators:exec` 1회 수명
- [ ] 마지막에 `cleanup()` (공식 라이브러리 사용 시). 데이터 리셋으로 착각하지 말 것
- [ ] P1–P14를 모두 실행. P8–P10 deny가 핵심
- [ ] generic wildcard(P12)를 빼먹지 말 것. 겹치는 match가 더 넓게 allow하면 전용 deny는 무효
- [ ] 클라이언트 테스트에 Admin 성공을 allow로 적지 말 것

실행 (승인 후, 고대리 미실행):

```
firebase emulators:exec --only firestore,auth --project demo-cy-payroll-rules <test-command>
```

또는 기존 CY 러너처럼 `scripts/run-*-rules-test.mjs`가 `emulators:exec`를 감싼다.

Windows에서 Java를 못 찾으면 기존 카드 러너는 Android Studio JBR을 `JAVA_HOME`으로 쓴다. 사용자 전용 Temurin 21을 쓸 경우 `JAVA_HOME`을 그 JDK로 둔다.

금지:

- [ ] 제품 `firestore.rules`를 테스트 통과만을 위해 완화하지 말 것
- [ ] 프로덕션 프로젝트에 Emulator 테스트를 붙이지 말 것
- [ ] `FIRESTORE_EMULATOR_HOST`를 프로덕션 셸에 남기지 말 것

## Java 21 사용자 전용 설치 (고대리는 조사만, 이과장은 승인 범위에서 실행)

Firebase 공식 요구는 JDK 11+이다. Java 21은 선택이다. 아래는 이과장이 **사용자 전용 경로에만** 받을 때의 공식 Adoptium/Temurin 위치와 checksum 검증이다. 고대리는 다운로드·설치하지 않았다.

공식 메타데이터 (2026-09-01 확인, Adoptium API `vendor=eclipse`, release `jdk-21.0.12.1+1`, 갱신 2026-08-19/21 UTC):

| 대상 | 다운로드 URL | SHA-256 (API `checksum`) |
|---|---|---|
| Windows x64 JDK MSI | https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jdk_x64_windows_hotspot_21.0.12.1_1.msi | `454cfd334b9ca91c96dd8c2de97fcef6b9f1f98be9172ff076711f1c6b44e4e0` |
| Windows x64 JDK ZIP | https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jdk_x64_windows_hotspot_21.0.12.1_1.zip | `f9d6e191ab098c0d416e7d588a24420a8621cd2f4720dab2459b8b7b2d2d8b4e` |
| Linux x64 JDK tar.gz | https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jdk_x64_linux_hotspot_21.0.12.1_1.tar.gz | `ce79869e1307ed8ee1e2baa86a412b1eb5b75d10a01006d788a6f968bcfaee94` |

API:

- https://api.adoptium.net/v3/assets/latest/21/hotspot?os=windows&architecture=x64&image_type=jdk
- https://api.adoptium.net/v3/assets/latest/21/hotspot?os=linux&architecture=x64&image_type=jdk
- 릴리스 페이지: https://adoptium.net/temurin/releases/?version=21
- 릴리스 태그: https://github.com/adoptium/temurin21-binaries/releases/tag/jdk-21.0.12.1%2B1

동반 checksum 파일 (API `checksum_link`):

- `.../OpenJDK21U-jdk_x64_windows_hotspot_21.0.12.1_1.msi.sha256.txt`
- `.../OpenJDK21U-jdk_x64_windows_hotspot_21.0.12.1_1.zip.sha256.txt`
- `.../OpenJDK21U-jdk_x64_linux_hotspot_21.0.12.1_1.tar.gz.sha256.txt`

이과장 검증 절차 (설치 전·후 증거 필수):

1. Adoptium API 또는 GitHub `temurin21-binaries` 릴리스에서만 받는다. 미러·임의 블로그 링크 금지
2. 바이너리와 `.sha256.txt`를 같이 받는다
3. Windows: `certutil -hashfile <파일> SHA256`
4. Linux/WSL: `sha256sum <파일>`
5. 출력 해시를 위 표 및 `.sha256.txt`와 대소문자 무시 비교한다. 불일치 시 설치하지 않는다
6. 선택: 같은 릴리스의 `.sig`와 Adoptium 공개키. 이번 조사는 서명 키를 검증하지 않음 → 미검증
7. 설치는 사용자 계정 범위만. 시스템 전역 강제 금지. 설치 후 `java -version`이 21인지 확인
8. `JAVA_HOME`을 해당 JDK로 두고 `firebase emulators:exec` 전에 `java -version`을 재확인

이번 세션은 바이너리를 받지 않았고, `.sha256.txt` 원문 바이트는 Firecrawl 장애로 재열람하지 못했다. 해시 값은 **Adoptium API JSON `binary.installer.checksum` / `binary.package.checksum`** 이다.

## 미검증 사항

- 이 세션에서 Emulator·Rules 테스트를 **실행하지 않음**. P1–P14는 현재 rules 텍스트 해석이지 런타임 증거가 아니다
- `@firebase/rules-unit-testing@5.0.2`를 CY `firebase ^12.6.0`과 함께 설치해 본 적 없음. peer 범위는 맞지만 런타임 호환은 미실행
- Java 21 + 현재 `firebase-tools`(CY `^14.27.0`) 조합을 이 머신에서 기동하지 않음
- `.sha256.txt` 파일 원문을 API 해시와 바이트 단위로 재대조하지 못함 (도구 장애)
- Adoptium `.sig` 서명 검증 미실시
- gcloud Firestore emulator Java 21+ 요구를 Firebase CLI에 그대로 적용할 수 있는지 **공식 Firebase 문서로 확인되지 않음**
- 공식 test-rules-emulator 본문에 v8 잔재(`initializeTestApp`)가 남아 있다. v9를 쓰라는 권고와 혼재. 신규 테스트는 v9 API만 권고
- X 게시물·비공식 블로그의 “Java 21 필수” 주장은 공식 교차검증 실패로 채택하지 않음
- `firestore.rules` 표현식 1,000개 한도 근접 여부는 이번 카드에서 재측정하지 않음. 기존 주석은 construction-plan short-circuit이 그 한도 때문이라고 한다

## 상태

**승인 — 이과장 실행 중**

- 승인 범위: 사용자 전용 Java 21 설치, checksum 검증, 격리 `demo-` 프로젝트 Rules Emulator 테스트, 필요한 최소 devDependency
- 계속 금지: 운영 Firebase, 원본 저장소 수정, Git add·commit·push·merge, 배포, Phase 2 및 후속 카드 혼입
- 고대리는 제품 코드를 수정하지 않았다.

## 공식 출처 표

문서 확인일: 2026-09-01 KST. Last updated는 열람 시 페이지 표기.

| 번호 | 출처 URL | 공식 여부 | 문서·릴리스 날짜 | 확인한 주장 |
|---|---|---|---|---|
| 1 | https://firebase.google.com/docs/emulator-suite/install_and_configure | 공식 | Last updated 2026-08-31 UTC | Node 16+, **JDK 11+**, `emulators:start` / `emulators:exec`, 기본 포트, `JAVA_TOOL_OPTIONS`, CLI 8.14.0+ |
| 2 | https://firebase.google.com/docs/firestore/security/test-rules-emulator | 공식 | Last updated 2026-08-31 UTC | `emulators:start --only firestore`, `emulators:exec`, `@firebase/rules-unit-testing`, v9 권고, clearFirestore vs cleanup, demo project |
| 3 | https://firebase.google.com/docs/rules/unit-tests | 공식 | Last updated 2026-08-31 UTC | v9 권고, 프로덕션 미접촉, ECONNREFUSED, 시드·cleanup 훅 |
| 4 | https://firebase.google.com/docs/rules/emulator-setup | 공식 | Last updated 2026-08-31 UTC | `firebase emulators:start --only firestore` |
| 5 | https://firebase.google.com/docs/emulator-suite/connect_firestore | 공식 | Last updated 2026-08-31 UTC | `FIRESTORE_EMULATOR_HOST`, Admin SDK 연결 |
| 6 | https://firebase.google.com/docs/firestore/security/rules-conditions | 공식 | Last updated 2026-09-01 UTC | `getAfter()`, access-call 10/20, 초과 시 permission denied, 캐시 미포함 |
| 7 | https://firebase.google.com/docs/firestore/quotas | 공식 | Last updated 2026-08-31 UTC | exists/get/getAfter 한도, 표현식 1,000, ruleset 크기 |
| 8 | https://firebase.google.com/docs/firestore/security/rules-structure | 공식 | Last updated 2026-08-31 UTC | 겹치는 match는 **어느 allow든 true면 허용**, access-call 한도 표 |
| 9 | https://firebase.google.com/docs/firestore/security/insecure-rules | 공식 | Last updated 2026-08-31 UTC | closed access여도 **Admin SDK·Cloud Functions는 접근**, 클라이언트만 Rules |
| 10 | https://firebase.google.com/docs/firestore/manage-data/transactions | 공식 | 열람 2026-09-01 | `getAfter()`로 커밋 전 결합, 트랜잭션/배치 access-call 20+각 10 |
| 11 | https://firebase.google.com/docs/reference/emulator-suite/rules-unit-testing/rules-unit-testing | 공식 | Last updated 2026-08-24 UTC | `initializeTestEnvironment`, assertFails/Succeeds |
| 12 | https://www.npmjs.com/package/@firebase/rules-unit-testing | npm 공식 레지스트리 | 페이지 표기 5.0.2, Published 13 days ago (열람 2026-09-01) | latest 5.0.2 |
| 13 | https://unpkg.com/@firebase/rules-unit-testing@5.0.2/package.json | 패키지 게시 원문 | 5.0.2 | peer `firebase ^12.0.0`, engines `node >=20.0.0`, devDep `firebase ^12.18.0` |
| 14 | https://github.com/firebase/firebase-js-sdk/blob/main/packages/rules-unit-testing/CHANGELOG.md | 공식 SDK 저장소 | 5.0.2 / 5.0.0 항목 | 5.0.0 Node 20 + firebase 12. 5.0.2는 devDependency 갱신 |
| 15 | https://api.adoptium.net/v3/assets/latest/21/hotspot?os=windows&architecture=x64&image_type=jdk | Eclipse Adoptium 공식 API | binary.updated_at 2026-08-21T11:43:24Z | Temurin 21.0.12.1+1 Windows MSI/ZIP URL과 SHA-256 |
| 16 | https://api.adoptium.net/v3/assets/latest/21/hotspot?os=linux&architecture=x64&image_type=jdk | Eclipse Adoptium 공식 API | binary.updated_at 2026-08-19T17:13:22Z | Linux x64 tar.gz URL과 SHA-256 |
| 17 | https://adoptium.net/temurin/releases/?version=21&os=windows | Eclipse Adoptium | 페이지 표기 jdk-21.0.12.1+1 (08/21/2026) | 공식 다운로드 UI. checksum 링크 존재 |

관련 문서: [[2026-09-01 CY 기술 스킬 및 최신정보 기준선]], [[CY 기술조사 인덱스]]
