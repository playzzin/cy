# 배포 누락 방지 운영 절차

## 웹 배포

1. 9950X의 작업 브랜치에서 수정하고 로컬로 확인한다. 커밋·푸시 후 `develop` 대상 PR을 열고 **Quality Gate → verify**가 성공하면 병합한다.
2. 운영에 올릴 때 `develop`에서 `main`으로 PR을 연다. 이번에 나갈 변경과 검사 결과를 확인하고 병합한다.
3. `main` 커밋의 Quality Gate가 성공하면 **Firebase Hosting release**가 운영 웹을 자동 배포한다. Actions에서 배포 성공을 확인하고, [운영 버전 기록](https://cyee-9c1e4.web.app/release.json)의 `commit`과 배포한 커밋을 대조한다. 실제 사이트에서 바뀐 화면을 확인한다.

서버 함수·권한·인덱스가 포함된 배포는 아래의 [별도 서버 배포 절차](#서버-기능권한인덱스-변경)를 먼저 확인한다. 최신 운영 버전을 포함하지 않거나 서버 변경이 확인되지 않으면 웹 배포가 중단된다.

### GitHub 또는 Firebase에 연결되지 않을 때

`npm run deploy:check`는 GitHub의 현재 `main`, 두 Firebase Hosting API, 검증·운영 사이트의 실제 배포 버전을 읽는다. 한 곳만 볼 때는 `npm run deploy:check -- staging`이나 `npm run deploy:check -- production`을 쓴다. `ENOTFOUND`는 해당 실행 환경의 DNS 조회 실패다. 공식 Git 전송이 실패하면 배포 명령은 GitHub의 HTTPS API에서 같은 저장소의 현재 `main`을 확인한다. 두 방법이 모두 실패하면 업로드를 중단한다. Hosting API의 HTTPS 연결은 타입 검사·빌드 전에 확인한다. 실제 업로드 권한은 Firebase CLI가 검사한다.

### GitHub에서 Hosting 배포

Hosting 배포 코드를 변경하는 이 저장소의 `main` 대상 PR에는 **Hosting connectivity** 검사가 표시된다. GitHub 실행기가 배포 권한 없이 현재 `main`, 두 Hosting API와 두 사이트의 `release.json`을 조회한다. 로컬에서 DNS 오류가 났을 때 이 결과로 GitHub 실행기에서도 같은 문제가 있는지 확인할 수 있다. 단일 사이트를 배포할 때는 선택한 사이트의 연결과 배포 기록만 검사한다.

검증 사이트에 수동으로 공유하거나 같은 버전을 다시 배포할 때는 GitHub **Actions → Firebase Hosting release → Run workflow**에서 `main`과 대상 사이트를 선택한다. 기본은 `staging`이며, 운영에 다시 게시할 때는 `production`을 선택한다. 두 대상 모두 현재 `main`의 Quality Gate 성공 기록을 확인한다.

### 처음 연결할 때

배포 워크플로가 GitHub 기본 브랜치인 `main`에 있어야 한다. 각 GitHub Environment(`staging`, `production`)에 `CY_HOSTING_WIF_PROVIDER`를 설정한다. 서비스 계정을 가장하는 구성은 `CY_HOSTING_SERVICE_ACCOUNT`도 지정한다. Google Cloud의 신뢰 조건은 저장소 ID `1121336004`, 소유자 ID `221525849`, `refs/heads/main`, 해당 Environment와 Hosting 업로드 워크플로로 제한한다. 각 배포 주체에 해당 프로젝트의 Hosting 배포 권한만 부여한다. 기존 Firebase 연동에서는 프로젝트 전용 시크릿 `FIREBASE_SERVICE_ACCOUNT_CY_ERP_STAGING_9C1E4` 또는 `FIREBASE_SERVICE_ACCOUNT_CYEE_9C1E4`를 사용할 수 있다.

운영 웹 설정은 운영 사이트의 Firebase 공개 설정에서 읽는다. 워크플로는 새 서비스 계정이나 키를 생성하지 않는다. Google Cloud 연결 설정은 [배포 파이프라인용 Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)에 설명되어 있다.

배포할 커밋은 현재 운영 `release.json`에 기록된 커밋을 Git 이력에 포함해야 한다. 운영보다 이전에 만든 작업 폴더나 별도 브랜치에서는 최신 운영 변경을 먼저 합친다. 배포 명령은 이 조건과 검사 중 운영 버전 변경 여부를 확인하며, `--initialize-record`도 이력 검사를 생략하지 않는다.

최초 도입 시 기존 사이트에는 `release.json`이 없다. 서버·권한 설정의 실제 반영을 먼저 확인한 경우에만 `npm run release:deploy -- --initialize-record`로 기준 기록을 만든다.

배포 기록 조회 중 일시적인 DNS 오류나 HTTP 503 응답은 한 번 더 조회한다. 조회에 계속 실패하면 호스트와 오류를 표시하고 배포를 멈춘다. 커밋된 서버 소스와 규칙은 Git에 저장된 경로·권한·내용으로 비교한다. 기존 기록이 작업 폴더 바이트를 사용한 경우에는 그 기록의 운영 커밋을 기준으로 비교한다.

`npm run release:verify`는 운영 사이트의 웹 버전과 현재 커밋·배포 파일을 비교한다. 다른 검증 사이트는 `npm run release:verify -- https://검증사이트.web.app`으로 확인한다. 기록이 없거나 통신에 실패하면 성공으로 처리하지 않는다.

## 로컬 검사와 수동 배포

저장소 안쪽에 만든 릴리스 작업 폴더도 상위 폴더의 npm 설치를 사용할 수 있습니다. 두 폴더의 `package-lock.json`이 일치하고 중간에 일부 패키지만 설치된 폴더가 없으면 빌드와 검사에서 같은 설치 기록을 사용합니다. 소스, 실행 환경, 출력 파일과 테스트 유효기간에 대한 기존 검사는 계속 적용됩니다.

GitHub Quality Gate가 `frontend`, `server`, `rules` 전체를 검사한다. 로컬에서 전체 검사가 필요할 때는 `npm run verify:project`를 실행한다. Firebase 권한이 있는 로컬 환경에서 웹을 수동 배포할 때는 Quality Gate가 성공한 최신 `main`의 깨끗한 작업 폴더에서 `npm run deploy:main`을 실행한다. 같은 폴더에서 소스·설정·설치 의존성·실행 환경·날짜가 같고 1시간 이내면 전체 React 검사 통과 기록을 재사용한다.

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
