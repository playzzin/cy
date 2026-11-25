# 청연ENG 비공개 개발 검증

9950X 브라우저에서 Cloud Run의 고정 HTTPS 주소를 열면 IAP가 Google 로그인을 처리한다. 공개 설정 조회가 가능한 빌드 머신에서 지정 커밋의 React 앱을 패키징한다. 조회용 함수가 서명된 IAP 사용자와 허용 이메일을 확인하고, 같은 이메일의 활성 Firebase 계정에 대해 15분짜리 본인 조회 세션을 발급한다. 운영 이메일의 인증과 메뉴에 등록된 직책이 필요하다. 화면 상단에서 커밋을 확인할 수 있다. 스테이징에서는 기존대로 시험 자료를 편집한다.

## 최초 연결

1. Google Cloud 관리자가 비공개 Cloud Run 서비스 이름을 `cy-erp-review`, 리전을 `asia-northeast3`로 지정한다. 아래 빌드와 배포 명령으로 서비스를 생성할 수 있다. 웹 서비스의 런타임 서비스 계정에는 운영 Firebase 읽기·쓰기·토큰 서명 역할을 부여할 필요가 없다. IAP 서비스 에이전트에 이 서비스의 Invoker 권한을, 허용할 본인 Google 계정에 이 서비스의 IAP 접근 권한을 지정한다. 조직 외부 Gmail 계정을 쓰면 외부 사용자를 지원하는 OAuth 클라이언트가 필요할 수 있다. [Cloud Run IAP 설정](https://docs.cloud.google.com/run/docs/securing/identity-aware-proxy-cloud-run)
2. IAP에서 해당 서비스의 **Signed Header JWT Audience** 값을 확인한다. Cloud Run과 운영 함수에 같은 `CY_REVIEW_IAP_AUDIENCE`, `CY_REVIEW_EMAIL`을 설정한다. 서명 검증에는 정확한 서비스 audience를 사용한다. 설정이 빠지거나 계정이 일치하지 않으면 HTML과 세션 요청이 거절된다.
3. `cyee-9c1e4`에서 실제 배포된 Firestore·Storage 규칙이 저장소의 조회 사용자 쓰기 차단 규칙과 일치하는지 확인한다. Functions는 `functions/src/entry.ts`의 조회 전용 검사를 거친 버전이어야 한다. 먼저 합성 계정으로 아래 검사를 실행한다. 운영 함수 배포 권한이 있는 담당자가 `privateReviewSession`을 배포하고 본인 세션의 읽기를 지원해야 하는 callable을 갱신한다. 팀장 대시보드의 팀 범위 읽기는 `getTeamScopedData`를 사용한다. 호출 함수 목록과 변경 범위는 배포 전 `npm run deploy:functions -- privateReviewSession getTeamScopedData --dry-run`으로 확인한다. 다른 업무 메뉴의 허용된 읽기 목록은 `functions/src/devPreviewPolicy.ts`에 있다. 이미 배포된 구버전 callable은 일반 팀장의 본인 미리보기를 거절할 수 있다.
4. 게시 후 응답으로 받은 실제 URL에서 허용 계정으로 로그인하여 커밋·직책·팀 메뉴·일보를 확인한다. 별도 계정 또는 인증 없이 같은 주소를 열었을 때 업무 화면과 정적 파일이 열리지 않아야 한다. 세션 만료 후 다시 연결하면 새로 권한을 확인한다.

## 빌드 및 업데이트

아래 명령의 환경 변수에는 관리자가 선택한 프로젝트와 위 설정을 지정한다. 최초 서비스 생성에서 `CY_REVIEW_IAP_AUDIENCE`가 정해지지 않았다면 우선 비워 두고, 서비스 생성 후 실제 값을 설정한다. 설정 전에는 접근이 닫혀 있다.

```bash
npm ci
npm --prefix functions ci
node ops/review/build.cjs
gcloud run deploy cy-erp-review --project="$REVIEW_PROJECT" --region=asia-northeast3 \
  --source=".tmp/private-review/$(git rev-parse HEAD)" --iap --no-allow-unauthenticated \
  --service-account="$REVIEW_RUNTIME_SERVICE_ACCOUNT" \
  --update-env-vars="CY_REVIEW_EMAIL=$CY_REVIEW_EMAIL,CY_REVIEW_IAP_AUDIENCE=$CY_REVIEW_IAP_AUDIENCE"
```

빌드에는 깨끗한 체크아웃과 운영 Hosting의 공개 Firebase 웹 설정이 필요하다. 배포 디렉터리에는 리뷰용 정적 빌드, 해당 커밋 파일, 웹 서버와 실행 의존성만 들어간다. 운영 토큰과 CLI 자격 증명은 복사하지 않는다.

자동 업데이트는 GitHub Environment `private-review`의 `CY_REVIEW_CLOUD_PROJECT`, `CY_REVIEW_WIF_PROVIDER`, `CY_REVIEW_DEPLOYER`로 해당 서비스에만 배포할 수 있는 신원을 연결하고, 저장소 변수 `CY_REVIEW_ENABLED=true`를 설정한다. `develop`에 반영한 커밋을 빌드하고 합성 데이터 검사를 통과한 뒤 같은 서비스로 배포한다. 이 워크플로에서 운영 Hosting, 규칙 또는 운영 함수를 배포하지 않는다.

## 조회 경계 검증

```bash
npm --prefix functions run build
node --test ops/review/server.test.cjs functions/lib/privateReview.test.js functions/lib/devPreviewPolicy.test.js functions/lib/devPreviewEndpoint.test.js
GCLOUD_PROJECT=demo-dev-user-preview firebase emulators:exec --project demo-dev-user-preview \
  --only auth,firestore,storage,functions 'node scripts/test-dev-preview-rules.mjs'
```

에뮬레이터 검사는 가상 팀의 자료만 읽히는지와 Firestore 수정·삭제, Storage 업로드, callable 변경 작업이 거절되는지를 확인한다. 로컬 에뮬레이터 포트는 프로젝트의 `firebase.json`을 사용하므로 다른 관리 서비스가 해당 포트를 점유하는 클라우드 VM에서는 별도 CI 러너에서 실행한다.
