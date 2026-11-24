# CY 클라우드 개발 서버와 9950X

9950X에서 작업 브랜치를 편집하고, 클라우드에서 같은 Git 커밋으로 개발 서버를 실행한다. 개발 통합 기준은 `develop`, 운영 기준은 `main`이다. PC와 클라우드는 커밋과 PR로 변경을 주고받는다.

| 위치 | 역할 |
| --- | --- |
| 9950X | 기능 수정, 관련 테스트, Windows·엑셀·파일 업로드 확인 |
| Codex Cloud | 개발 서버 실행, 통합 코드 미리보기, 검증용 Firebase 데이터 사용 |
| GitHub Actions | PR의 프런트엔드·서버·규칙 검사와 최종 `verify` |
| Firebase Hosting | 검증 사이트와 운영 사이트를 별도 프로젝트로 제공 |

## 클라우드 환경 설정

| 항목 | 값 |
| --- | --- |
| 저장소와 브랜치 | `playzzin/cy` · `develop` |
| 작업 폴더 | `/workspace/cy` |
| 런타임 | Node.js 22, npm |
| 환경 설치 명령 | `cd /workspace/cy && npm run cloud:setup` |
| 작업 세션에서 실행할 명령 | `cd /workspace/cy && HOST=0.0.0.0 npm run dev:cloud` |
| 미리보기 | 비공개 포트 미리보기를 지원하는 환경에서 3000 열기 |

환경 설치 단계에서 npm 의존성과 검증 Hosting의 공개 웹 앱 설정을 받는다. 프로젝트와 앱 ID를 확인한 설정은 Git에서 제외한 `.firebase/staging-env.json`에 저장한다. 작업 세션은 이 파일로 개발 서버를 시작한다. 검증 Firebase에 로그인하거나 데이터를 조회하는 브라우저에는 인터넷 연결이 필요하다. 설정 갱신 명령은 `npm run staging:config`다.

9950X에서도 `npm run dev:cloud`를 실행할 수 있다. 기본 주소는 `127.0.0.1:3000`이다. PC에 설정 파일이 없으면 첫 실행 때 검증 Hosting에서 받는다. 작업 세션이 꺼진 뒤에도 열 수 있는 고정 주소는 [검증 사이트](https://cy-erp-staging-9c1e4.web.app)다. 여기에 반영하려면 아래의 검증 배포 명령을 실행한다.

## 평소 작업 순서

1. 9950X의 깨끗한 작업 폴더에서 `git fetch origin` 후 `git switch -c codex/9950x-작업명 origin/develop`으로 시작한다. 기존 폴더에 미커밋 작업이 있으면 별도 checkout을 사용한다.
2. 기능을 수정하고 관련 테스트를 실행한다. 수정한 파일을 지정해서 커밋하고 `git push -u origin HEAD`로 올린 뒤 `develop` 대상 PR을 연다.
3. 병합 전에 클라우드에서 확인하려면 개발 서버용 checkout에서 같은 작업 브랜치와 커밋을 선택한다. `git rev-parse HEAD`로 양쪽 버전을 대조한다. PR이 통과해 병합되면 클라우드의 깨끗한 `develop`에서 `git pull --ff-only origin develop` 후 미리보기를 확인한다. 잠금 파일이 바뀌면 설치 명령도 다시 실행한다.
4. 운영 반영 시 `develop`에서 `main`으로 PR을 열고 검사를 확인한다. 병합된 `main` 커밋의 GitHub Actions가 성공하면 Firebase 배포 권한이 있는 한 곳에서 `npm run deploy:main`을 실행한다. 마지막 출력의 커밋과 운영 `release.json`이 일치해야 한다.

검증 사이트에 공유할 때는 깨끗한 개발 커밋에서 `npm run staging:deploy`를 실행한다. 검증용 데이터, 파일 저장소와 서버 기능의 지원 범위는 [검증 환경 안내](staging-and-ledger-review.md)에 정리했다. 운영 배포와 서버 변경 대조 방법은 [배포 검증 안내](release-verification.md)를 따른다.
