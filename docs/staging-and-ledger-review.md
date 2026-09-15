# 원장 대조와 검증 서버

## 원장 대조 사용법

1. 숙소 관리의 월별 공과금 대장 또는 차량 관리의 월별 대장을 연다.
2. 검사할 월을 선택하고 변경한 내용이 있다면 저장한다.
3. `원장·청구·정산 대조`를 펼쳐 `자료 새로 불러오기` 후 `월 전체 대조하기`를 누른다.
4. 원장 금액, 청구 금액, 저장된 팀 정산 또는 연결된 개인 공제의 차이를 확인한다.

화면 검색·팀 필터와 관계없이 해당 월의 불러온 원장을 검사한다. 기존 배정/부담 대상/일할 계산을 재사용한다. 현재 화면에서 제외된 저장 숙소 비용, 처분 차량 및 사용 기간 밖의 차량 비용, 원장 중복과 저장 누락도 추가 확인으로 표시한다. 조회 실패를 정상 또는 0건으로 처리하지 않는다.

작성 중인 청구가 아직 저장 정산에 연결되지 않았다면 `청구 확정 대기`로 구분한다. 부담 대상 누락이나 이미 연결된 공제의 오류는 작성 중이어도 추가 확인으로 표시한다. 확정된 정산은 그대로 읽고 현재 청구와 비교한다. 검사는 어떤 원장·청구·정산도 수정하지 않는다. 사무실 부담은 구분하고, 개인 차량비나 구 방식의 합산 정산처럼 연결 번호가 없는 항목은 추가 확인으로 남긴다. 실제 은행 지급 여부는 검사하지 않는다. 결과는 조회 시점의 자료 기준이며 저장·월 변경·재조회 시 폐기한다.

## 독립된 검증 서버

- 프로젝트: `cy-erp-staging-9c1e4`
- 주소: https://cy-erp-staging-9c1e4.web.app
- 데이터베이스: 서울 `asia-northeast3`, 운영 프로젝트와 별도
- Google / 이메일 로그인 활성화. 초기 관리자는 Firebase 도구에 로그인된 프로젝트 계정이며 Google 로그인으로 접속한다.
- 시험 자료: 2026년 9월, 가상팀·숙소·차량. 숙소 전기료에는 1,000원 차이, 차량 렌트비는 정산까지 일치하는 사례를 넣었다.
- `seed-staging.cjs`는 시험 자료가 없는 경우에만 생성한다. 운영 자료 복사나 기존 시험 자료 초기화는 하지 않는다.

### 재배포

```text
npm run staging:config
node scripts/prepare-staging-indexes.cjs
firebase deploy --config firebase.staging.json --project cy-erp-staging-9c1e4 --only firestore --non-interactive
npm run staging:deploy
```

커밋된 코드만 검증 서버에 배포한다. 검증 빌드는 운영 환경 파일의 외부 연동 값을 비우고 전용 Firebase 설정을 주입한다. 배포 기록의 프로젝트 ID와 환경이 대상 주소에 맞지 않으면 배포가 중단된다. 화면 상단에 검증 서버 표시가 있고 검색 엔진 색인을 금지한다. `build` 폴더는 마지막에 빌드한 환경의 결과이므로 운영 배포 전에 반드시 운영 빌드를 새로 만든다.

### 무료 구성의 범위

현재 Hosting, Authentication, Firestore와 검색 색인을 준비한다. 무료 Hosting이 제한하는 APK 등 실행 파일 배포는 검증 서버에서 제외한다. 파일 업로드(Storage), 서버 함수/예약 알림, 자동 삭제(TTL) 정책은 Blaze 결제 연결 후 배포해야 한다. 검증에서는 결제 승인 전 외부 금융·문자·메일 연동과 운영 비밀값을 가져오지 않는다. 별도 확인 없이 운영 프로젝트의 서버 함수 설정을 그대로 복사하지 않는다.

Google 로그인 초기 설정은 Firebase CLI 15.30.1 이상에서 지원한다. `node scripts/staging-project.cjs auth`는 현재 프로젝트 계정을 지원 이메일로 사용하고 임시 설정을 작업 후 제거한다. 이 작업의 로컬 설치 위치는 `tmp/firebase-staging-tools`이며 Git에 포함하지 않는다.

공식 안내: [Firebase 로그인 제공자 설정](https://firebase.google.com/docs/auth/configure-providers-cli), [Storage 결제 요구사항](https://firebase.google.com/docs/storage/web/start).
