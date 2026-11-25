# CY 클라우드 개발 서버와 9950X

청연 ERP의 주 개발 서버는 Codex Cloud에서 실행한다. 9950X와 클라우드는 같은 GitHub 저장소의 `develop`을 기준으로 작업 브랜치를 만들고 커밋과 PR로 변경을 주고받는다.

| 위치 | 역할 |
| --- | --- |
| 9950X | 기능 수정, 관련 테스트, Windows·엑셀·파일 업로드 확인 |
| Codex Cloud | 개발 서버 실행, 작업 브랜치 편집·통합, 검증용 Firebase로 미리보기 |
| GitHub Actions | PR의 프런트엔드·서버·규칙 검사, Linux에서 개발 서버 기동 및 응답 확인 |
| Firebase Hosting | 검증 사이트와 운영 사이트를 별도 프로젝트로 제공 |

## 클라우드 환경 설정

| 항목 | 값 |
| --- | --- |
| 저장소와 브랜치 | `playzzin/cy` · `develop` |
| 작업 폴더 | `/workspace/cy` |
| 런타임 | Node.js 22, npm |
| 설치 스크립트 | `cd /workspace/cy && bash ops/cloud/server.sh setup` |
| 시작 지침(Start skill) | `cd /workspace/cy && bash ops/cloud/server.sh start`를 백그라운드에서 시작한 뒤 아래 준비 검사를 실행 |
| 준비 검사 | `cd /workspace/cy && bash ops/cloud/server.sh check` |
| HTTP Previews | 개인용 HTTP 포트 `3000` |

ChatGPT 설정 → Codex Cloud → Environments에서 청연 환경을 생성하거나 편집한다. 저장소로 `playzzin/cy`, ref로 `develop`, 마운트 이름으로 `cy`를 선택한다. 설치와 시작을 검증한 뒤 Publish 또는 Republish를 누르고 새 작업을 이 환경에서 연다. 작업의 HTTP Previews에서 포트 3000에 발급된 비공개 주소로 9950X에서도 접속할 수 있다. [Codex Cloud 환경 설정](https://learn.chatgpt.com/docs/environments/cloud-environments)

설치 명령은 앱과 Functions의 각 lockfile을 사용하고 검증 Hosting(`cy-erp-staging-9c1e4.web.app`)에서 공개 웹 앱 설정을 받는다. 제한된 네트워크에서는 패키지 레지스트리와 이 검증 도메인의 HTTPS 연결이 필요하다. 설정은 프로젝트와 앱 ID를 확인한 뒤 Git에서 제외한 `.firebase/staging-env.json`에 저장한다. 새 작업의 서버는 저장된 설정으로 시작한다. 인증과 데이터 조회는 브라우저에서 검증 Firebase에 연결한다.

처음 띄우거나 서버를 재시작할 때는 클라우드 터미널에서 다음과 같이 실행한다. 포트가 이미 사용 중이면 먼저 `check`로 현재 작업의 서버인지 확인한다.

```bash
cd /workspace/cy
bash ops/cloud/server.sh start > /tmp/cy-dev-server.log 2>&1 &
bash ops/cloud/server.sh check
```

준비 검사는 시작 시점의 Git 커밋과 검증 프로젝트, webpack 컴파일, 실제 HTTP 화면과 JavaScript 번들을 확인한다. GitHub의 Linux 검사는 Chrome에서 `/login`을 열어 React가 이메일·비밀번호 입력란을 표시하는지도 확인한다. 코드를 편집하면 개발 서버가 자동으로 갱신한다. 다른 커밋으로 전환한 뒤에는 해당 개발 서버를 재시작해 시작 커밋을 맞춘다. 실행 로그는 `/tmp/cy-dev-server.log`에서 확인한다.

9950X에서도 `npm run dev:cloud`를 실행할 수 있다. 기본 주소는 `127.0.0.1:3000`이며 `localhost:3000`으로도 접속할 수 있다. 두 주소의 Google 로그인은 Firebase 팝업을 사용한다. 검증 프로젝트의 Authentication → 설정 → 승인된 도메인에 `127.0.0.1`과 `localhost`를 각각 등록한다. PC에 설정 파일이 없으면 첫 실행 때 검증 Hosting에서 받는다. 작업 세션이 꺼진 뒤에도 열 수 있는 고정 주소는 [검증 사이트](https://cy-erp-staging-9c1e4.web.app)다. 여기에 반영하려면 아래의 검증 배포 명령을 실행한다.

### 9950X에서 운영 자료로 작업하기

근로자·현장·일보·정산을 운영 ERP와 함께 읽고 수정할 때는 기존 3000번 서버의 터미널에서 `Ctrl+C`를 누르고 `npm run dev:live`를 실행한다. [로컬 로그인 화면](http://localhost:3000/login)에서 평소 운영 계정으로 로그인한다. `127.0.0.1:3000`으로 접속하면 운영 로그인에 등록된 `localhost:3000`으로 이동한다. 화면 상단에 **운영 데이터 연결**이 표시된다. 저장·수정·삭제는 해당 계정의 권한으로 운영 Firebase 프로젝트 `cyee-9c1e4`에 반영된다.

## 평소 작업 순서

1. 9950X의 깨끗한 작업 폴더에서 `git fetch origin` 후 `git switch -c codex/9950x-작업명 origin/develop`으로 시작한다. 기존 폴더에 미커밋 작업이 있으면 별도 checkout을 사용한다.
2. 기능을 수정하고 관련 테스트를 실행한다. 수정한 파일을 지정해서 커밋하고 `git push -u origin HEAD`로 올린 뒤 `develop` 대상 PR을 연다.
3. 클라우드에서 9950X의 수정본을 보려면 해당 브랜치를 선택하고 `git rev-parse HEAD`로 커밋을 대조한다. `develop` 병합 후에는 깨끗한 개발 사본에서 `git pull --ff-only origin develop`을 실행하고 서버를 다시 시작한다. 잠금 파일이 바뀌면 이 사본의 서버를 종료한 뒤 설치 명령도 다시 실행한다. **Cloud development server** 검사 로그에는 Linux에서 실제 실행해 확인한 SHA와 Firebase 프로젝트가 표시된다.
4. 운영 반영 시 `develop`에서 `main`으로 PR을 열고 검사를 확인한다. 병합된 `main` 커밋의 GitHub Actions가 성공하면 Firebase 배포 권한이 있는 한 곳에서 `npm run deploy:main`을 실행한다. 마지막 출력의 커밋과 운영 `release.json`이 일치해야 한다.

검증 사이트에 공유할 때는 깨끗한 개발 커밋에서 `npm run staging:deploy`를 실행한다. 검증용 데이터, 파일 저장소와 서버 기능의 지원 범위는 [검증 환경 안내](staging-and-ledger-review.md)에 정리했다. 운영 배포와 서버 변경 대조 방법은 [배포 검증 안내](release-verification.md)를 따른다.

작업 세션의 외부 연결 상태는 `npm run deploy:check`로 확인한다. GitHub 호스팅 실행기에서 같은 코드를 배포하는 방법은 [GitHub에서 Hosting 배포](release-verification.md#github에서-hosting-배포)에 정리했다.
