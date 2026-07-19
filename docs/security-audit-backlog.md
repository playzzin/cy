# Security Audit Backlog

## 목적

`npm audit` 결과를 무리하게 일괄 수정하지 않고, 운영 영향도와 변경 위험도에 따라 순차 처리한다.

## 현재 관찰 결과

2026-07-03 로컬 기준:

- 루트 앱: 51 vulnerabilities, critical 1, high 19
- Firebase Functions: 22 vulnerabilities, critical 1, high 11
- `server/` Barobill 로컬 서버: 9 vulnerabilities, high 5

## 처리 원칙

1. 외부 입력을 받는 서버/Functions 취약점을 우선 처리한다.
2. `npm audit fix --force`는 사용하지 않는다. CRA, Firebase Admin, Excel 계층은 breaking change 가능성이 크다.
3. 런타임에 포함되지 않는 개발 도구 취약점과 운영 요청 경로 취약점을 분리한다.
4. fix 없음 항목은 대체 라이브러리, 격리, 입력 제한 중 하나로 대응한다.

## P0 - 운영 노출 경로

- `server/` Barobill 로컬 서버
  - 기본 bind host를 `127.0.0.1`로 제한했다.
  - production 실행 시 `BAROBILL_LOCAL_API_TOKEN`을 필수화했다.
  - CORS 기본 전체 허용을 제거하고 loopback 또는 allowlist 기반으로 바꿨다.
  - 다음 작업: `soap`, `express`, transitive `axios`, `xmldom`, `qs`, `path-to-regexp` 업그레이드 검증.

- Firebase Functions
  - `firebase-admin`, `firebase-functions`, `google-gax`, `protobufjs`, `@grpc/grpc-js` 계층이 핵심이다.
  - 다음 작업: Functions dependency만 별도 브랜치에서 업그레이드하고 emulator/smoke test를 추가한다.

## P1 - 파일 업로드/Excel 처리

- `xlsx`는 audit에서 fix 없음으로 표시된다.
- 대응 후보:
  - 신규 업로드 파서는 `exceljs` 우선 사용
  - 기존 `xlsx` 경로는 파일 크기, MIME, 확장자, sheet 수 제한 추가
  - 신뢰할 수 없는 파일 파싱을 client-only로 둘지, server-side 격리로 옮길지 결정

## P2 - 프론트 라우팅/빌드 도구

- `react-router-dom` 6.x 취약점은 same-origin redirect/open redirect 계열이다.
- 현재 앱의 redirect 입력값 사용부를 먼저 점검하고, 이후 minor/major 업그레이드를 검토한다.
- CRA/react-scripts transitive 취약점은 `svgo`, `serialize-javascript`, `webpack-dev-server`, `jest` 계층에 걸쳐 있다.
- 대응 후보:
  - 단기: 운영 런타임에 포함되는 항목과 dev-only 항목 분리
  - 중기: CRA 유지 보수 비용 평가
  - 장기: Vite 또는 다른 빌드 체계 이전 계획 수립

## P3 - 관측성/환경 변수

- Sentry DSN은 환경 변수 기반으로 전환했다.
- 다음 작업:
  - 배포 환경에 `REACT_APP_SENTRY_DSN` 등록
  - sample rate 운영값 결정
  - 주요 업무 실패 지점에 Sentry context 추가

## 검증 체크리스트

- `npm run verify:project`
- `npm run build`
- `npm run verify:hosting-build`
- `node --check server/index.js`
- Functions 변경 시 emulator 또는 배포 전 callable/onRequest smoke test
