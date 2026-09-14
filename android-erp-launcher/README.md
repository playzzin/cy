# 청연ENG ERP Android 접속 앱

Android에 설치한 청연ENG ERP 아이콘을 누르면 운영 대시보드가 열립니다.
Android Custom Tabs를 사용하므로 브라우저의 로그인과 웹 기능을 그대로 사용합니다.
국민은행 SMS 앱과 별개인 `kr.co.cy.erp` 패키지이며 SMS 권한을 요청하지 않습니다.

## 빌드와 검증

저장소 루트에서 `powershell -File scripts/build-erp-apk.ps1`을 실행합니다.
Android Studio JDK, Android SDK 36, build-tools 36.1.0이 필요합니다.
스크립트는 Android 린트, release 빌드, 서명 검증을 수행한 뒤
`public/downloads/cheongyeon-erp.apk`를 갱신합니다.

서명키는 이 프로젝트의 Git 제외 경로 `.signing/`에 보관합니다.
암호는 현재 Windows 계정의 DPAPI로 보호되어 있습니다.
향후 업데이트를 위해 동일한 서명키를 유지해야 합니다.
키와 암호를 소스, 웹 배포 폴더, 로그에 복사하지 마세요.

## 다운로드

- Android 앱: 대시보드의 “APK 설치” 버튼 → APK 다운로드 → 다운로드한 파일 열기 → 설치.
- Windows 바로가기: “바탕화면에 추가” 버튼 → 브라우저 설치 확인창 → 설치 → ERP 아이콘으로 접속. 별도 바로가기 파일을 내려받지 않습니다.
- Android 홈 화면 바로가기: “바탕화면에 추가” 버튼 → 브라우저의 설치 창 또는 홈 화면 추가 안내.

웹페이지는 기기 보안 확인을 건너뛰고 APK를 설치하거나 사용자의 바탕화면에 직접 파일을 저장할 수 없습니다.
브라우저가 설치 가능한 상태일 때 버튼을 누르면 저장해 둔 설치 이벤트를 즉시 실행합니다.
설치 확인은 사용자가 진행하며, 설치 창을 지원하지 않거나 준비되지 않은 경우에만 브라우저 메뉴 안내를 표시합니다.

설치 이벤트는 `public/pwa-install-capture.js`가 앱 코드보다 먼저 수신하고 페이지 안에 보관합니다.
개발 중 코드가 갱신되어도 이벤트를 유지하며, 안내창을 연 뒤 이벤트가 도착해도 설치 버튼을 표시합니다.
개발 서버에서는 `pwa-development-worker.js`가 캐시 없이 네트워크 요청만 처리하여 PWA 설치 조건을 지원합니다.
브라우저가 `beforeinstallprompt`를 보내지 않은 상태에서는 웹페이지가 설치 확인창을 강제로 열 수 없습니다.
