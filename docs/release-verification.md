# 배포 누락 방지 운영 절차

## 웹 배포

운영 담당자는 GitHub `main`의 검증된 커밋에서 `npm run deploy:main`을 실행합니다. `release:deploy`와 `deploy:hosting`도 같은 절차를 사용합니다. 전체 검사 전, Firebase CLI 실행 직전, Firebase 사전 빌드가 끝난 직후에 GitHub `main`을 확인합니다. 검사하거나 빌드하는 중 다른 PC가 `main`을 갱신하면 업로드 전에 중단합니다.

1. 변경 파일을 검토하고 커밋·푸시한다. 개인 자료나 비밀 설정은 포함하지 않는다.
2. GitHub Quality Gate 성공을 확인한다.
3. 깨끗한 운영 작업 폴더에서 `npm run deploy:main`을 실행한다. 완료 시 출력된 커밋과 운영 사이트의 배포 기록을 확인한다.
4. 실제 사이트에서 수정한 업무 흐름을 확인한 뒤 요청자에게 확인 방법을 남긴다.

### GitHub 또는 Firebase에 연결되지 않을 때

`npm run deploy:check`는 GitHub의 현재 `main`, 두 Firebase Hosting API, 검증·운영 사이트의 실제 배포 버전을 읽는다. 한 곳만 볼 때는 `npm run deploy:check -- staging`이나 `npm run deploy:check -- production`을 쓴다. `ENOTFOUND`는 해당 실행 환경의 DNS 조회 실패다. 공식 Git 전송이 실패하면 배포 명령은 GitHub의 HTTPS API에서 같은 저장소의 현재 `main`을 확인한다. 두 방법이 모두 실패하면 업로드를 중단한다. Hosting API의 HTTPS 연결은 타입 검사·빌드 전에 확인한다. 실제 업로드 권한은 Firebase CLI가 검사한다.

### GitHub에서 Hosting 배포

Hosting 배포 코드를 변경하는 이 저장소의 `main` 대상 PR에는 **Hosting connectivity** 검사가 표시된다. GitHub 실행기가 배포 권한 없이 현재 `main`, 두 Hosting API와 두 사이트의 `release.json`을 조회한다. 로컬에서 DNS 오류가 났을 때 이 결과로 GitHub 실행기에서도 같은 문제가 있는지 확인할 수 있다. 단일 사이트를 배포할 때는 선택한 사이트의 연결과 배포 기록만 검사한다.

1. GitHub **Actions → Firebase Hosting release → Run workflow**에서 `main`을 선택한다. `check`는 연결과 현재 버전만 조회한다. `staging`, `production`, `both`는 해당 커밋의 Quality Gate 성공을 확인한 후 업로드한다. `both`는 검증 사이트의 실제 배포 버전이 확인된 뒤 운영 사이트를 배포한다.
2. GitHub에서 검증까지 자동으로 이어갈 때는 배포할 커밋 메시지 **마지막 줄**에 `[deploy hosting]`을 넣는다. 이 커밋이 `main`에 반영되고 Quality Gate가 통과하면 두 사이트에 배포한다. 표시가 없는 커밋에서는 연결 상태만 확인한다.
3. 각 GitHub Environment(`staging`, `production`)에 `CY_HOSTING_WIF_PROVIDER`를 설정한다. 서비스 계정을 가장하는 구성은 `CY_HOSTING_SERVICE_ACCOUNT`도 지정한다. Google Cloud의 신뢰 조건은 저장소 ID `1121336004`, 소유자 ID `221525849`, `refs/heads/main`, 해당 Environment와 Hosting 업로드 워크플로로 제한한다. 각 배포 주체에 해당 프로젝트의 Hosting 배포 권한만 부여한다. 이미 Firebase GitHub 연동을 구성한 저장소는 기존 프로젝트 전용 시크릿 `FIREBASE_SERVICE_ACCOUNT_CY_ERP_STAGING_9C1E4` 또는 `FIREBASE_SERVICE_ACCOUNT_CYEE_9C1E4`를 사용할 수 있다.

운영 웹 설정은 운영 사이트의 Firebase 공개 설정에서 읽는다. 워크플로는 새 서비스 계정이나 키를 생성하지 않는다. Google Cloud 연결 설정은 [배포 파이프라인용 Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)에 설명되어 있다.

배포할 커밋은 현재 운영 `release.json`에 기록된 커밋을 Git 이력에 포함해야 한다. 운영보다 이전에 만든 작업 폴더나 별도 브랜치에서는 최신 운영 변경을 먼저 합친다. 배포 명령은 이 조건과 검사 중 운영 버전 변경 여부를 확인하며, `--initialize-record`도 이력 검사를 생략하지 않는다.

최초 도입 시 기존 사이트에는 `release.json`이 없다. 서버·권한 설정의 실제 반영을 먼저 확인한 경우에만 `npm run release:deploy -- --initialize-record`로 기준 기록을 만든다.

배포 기록 조회 중 일시적인 DNS 오류나 HTTP 503 응답은 한 번 더 조회한다. 조회에 계속 실패하면 호스트와 오류를 표시하고 배포를 멈춘다. 커밋된 서버 소스와 규칙은 Git에 저장된 경로·권한·내용으로 비교한다. 기존 기록이 작업 폴더 바이트를 사용한 경우에는 그 기록의 운영 커밋을 기준으로 비교한다.

`npm run release:verify`는 운영 사이트의 웹 버전과 현재 커밋·배포 파일을 비교한다. 다른 검증 사이트는 `npm run release:verify -- https://검증사이트.web.app`으로 확인한다. 기록이 없거나 통신에 실패하면 성공으로 처리하지 않는다.

## 검사 재사용과 실행 순서

저장소 안쪽에 만든 릴리스 작업 폴더도 상위 폴더의 npm 설치를 사용할 수 있습니다. 두 폴더의 `package-lock.json`이 일치하고 중간에 일부 패키지만 설치된 폴더가 없으면 빌드와 검사에서 같은 설치 기록을 사용합니다. 소스, 실행 환경, 출력 파일과 테스트 유효기간에 대한 기존 검사는 계속 적용됩니다.

1. 서버 자원 설정 등 배포에 필요한 코드 수정을 먼저 마무리한다. 전체 검사를 마친 뒤 소스를 다시 수정하면 통과 기록을 재사용할 수 없다.
2. 최종 소스에서 `npm run verify:project`를 한 번 실행하고 커밋·푸시한다. 같은 파일 내용으로 커밋만 만든 경우 React 검사 기록은 유지된다.
3. GitHub Quality Gate의 최종 `verify` 성공을 확인한다. `frontend`, `server`, `rules`는 독립적으로 실행하며, 하나라도 실패·취소·생략되면 `verify`도 실패한다. CI에서는 로컬 통과 기록을 재사용하지 않는다.
4. 필요한 서버 배포·확인 후 웹 배포 명령을 실행한다. 같은 작업 폴더에서 소스·설정·설치 의존성·실행 환경·날짜가 같고 1시간 이내면 전체 React 검사 통과 기록을 재사용한다. 검증 생략 옵션은 사용하지 않는다.

React 검사 환경에서는 npm 호출 설명과 `CODEX_TOOL_CALL_ID`만 제거한다. 이 값들은 테스트 자식 프로세스에도 전달하지 않는다. 실제 앱 환경 변수, `PATH`, 임시 폴더, 알 수 없는 환경 변수는 계속 검증 입력에 포함한다. 외부 엑셀 자료·에뮬레이터를 사용하는 검사, 선택 검사, 강제 검사 및 실패한 검사는 재사용하지 않는다.

재사용할 수 없으면 소스·설정, 의존성, 실행 환경, 날짜, 유효기간 등의 원인만 출력한다. 환경 변수 값은 기록하지 않는다. 전체 검사를 명시적으로 다시 실행하려면 `npm run verify:project -- --force-tests` 또는 `npm run test:ci -- --force`를 사용한다.

## 서버 기능·권한·인덱스 변경

웹 기록은 빌드한 소스의 지문이며, 서버 반영의 증거가 아니다. 서버·권한·배포 설정 지문이 바뀌면 기본 배포 명령은 중단한다.

1. 변경 범위의 서버 테스트와 에뮬레이터 권한 검사를 수행한다.
2. 필요한 인덱스를 배포하고 READY 상태가 될 때까지 확인한다.
3. 해당 서버 기능과 권한만 명시적으로 배포한다.
4. 서버 상태, 예약 작업의 실제 성공 기록, 관련 사용자 화면을 확인한다.
5. 위 결과를 작업 기록에 남기고 `--initialize-record`로 새 웹 배포 기준을 설정한다.

## 검증 환경

검증 환경은 별도 Firebase 프로젝트 `cy-erp-staging-9c1e4`와 가상 자료를 사용한다. `firebase.staging.json` 및 전용 빌드 명령으로 운영 데이터 연결과 분리한다. 구성·배포 절차와 무료 범위의 제한은 [검증 서버 안내](staging-and-ledger-review.md)를 참고한다.

## 되돌리기

웹 장애 시 Firebase Hosting의 이전 정상 릴리스로 복원한 뒤 해당 커밋을 기준으로 `release:verify`를 실행한다. 서버·데이터 변경은 웹 복원만으로 되돌아가지 않으므로 별도 호환성 확인과 복구 절차를 적용한다. 실제 지급·원장 자료를 배포 복구 과정에서 덮어쓰지 않는다.
