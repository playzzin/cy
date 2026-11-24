# 청연 ERP 개발 환경

새 기능은 `playzzin/cy`의 최신 `develop`을 기준으로 작업 브랜치를 만든다. 기존 작업이나 PR을 이어갈 때는 그 브랜치와 커밋을 사용한다.

Codex Cloud 개발 서버는 포트 3000에서 검증용 Firebase 프로젝트 `cy-erp-staging-9c1e4`에 연결한다. 저장 환경 설치에는 `bash ops/cloud/server.sh setup`, 개발 서버 시작에는 `bash ops/cloud/server.sh start`, 기동 확인에는 `bash ops/cloud/server.sh check`를 사용한다. 9950X에서 수정한 작업은 커밋과 `develop` 대상 PR로 클라우드와 동기화한다.

미리보기 설정과 실행 예는 [클라우드 개발 안내](docs/cloud-development.md)에 있다. 운영 반영은 `main`의 [배포 절차](docs/release-verification.md)를 따른다.
