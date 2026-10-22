# Windows 사진 끌어놓기·전체 복사 1.3

Windows의 **사진 N장 한 번에 끌어놓기** 버튼은 선택된 원본 사진만 PC 보조 프로그램으로 전달하고, 모두 선택된 작은 Windows 사진창을 엽니다. 선택된 사진 하나를 카카오톡 대화창으로 끌어놓으면 여러 원본 파일을 함께 전달할 수 있습니다. 사용자가 저장 위치를 고르는 단계는 없으며 임시 사진은 보조 프로그램이 관리합니다.

사진창은 `IExplorerBrowser`의 Windows 기본 Shell view를 사용합니다. 브라우저가 HTTP로 드래그를 시작하는 방식이 아니라 사용자가 실제 파일 목록에서 직접 드래그합니다. 실제 Shell 항목 수·선택 수·파일 목록을 확인한 뒤에만 창 준비 완료를 반환합니다. 이 응답은 카카오톡 첨부나 전송 완료를 뜻하지 않습니다.

접힌 보조 메뉴의 **사진 N장 전체 복사**도 유지합니다. `CF_HDROP`과 `Shell IDList Array`를 제공하고 전용 STA 메시지 루프가 복사 정보를 유지합니다. Windows 파일 목록을 검증한 뒤 복사 결과를 반환하며, 카카오톡에서 붙여넣기가 되지 않는 환경에서는 끌어놓기를 사용합니다.

## 설치·업데이트·제거

- `CYPhotoClipboardSetup.exe` 실행 후 **설치하고 실행**. 1.0·1.1·1.2 사용자는 1.3 설치 파일로 업데이트하고 사이트를 새로고침합니다. 관리자 권한이 필요하지 않습니다.
- `%LOCALAPPDATA%\CY\PhotoClipboard`에 설치되며 시작 메뉴 바로가기와 현재 사용자 HKCU Run의 `CYPhotoClipboard` 값으로 로그인 시 실행됩니다.
- 브라우저가 로컬 네트워크 접근을 물으면 허용합니다. 보안 기능을 비활성화하거나 우회하지 않습니다.
- 사진은 `Cache` 하위의 표시된 전용 배치에 임시 보관합니다. 시작 시 및 15분 간격으로 24시간 지난 배치를 정리하되 현재 클립보드·사진창에서 사용 중이거나 사진창을 닫은 뒤 10분 유예기간에 있으면 유지합니다. 사진창을 닫을 때 배치의 마지막 사용 시간을 갱신하므로 재시작 후에도 보관 기간이 유지됩니다. 재분석 지점, 하위 폴더, 알 수 없는 파일이 있으면 삭제하지 않습니다. 원래 다운로드 폴더의 사진은 건드리지 않습니다.
- 알림 영역에서 **마지막 사진 전체 다시 복사**, **임시 사진 확인**, **종료**를 사용할 수 있습니다.
- 설치 파일의 **보조 프로그램 제거**는 실행 파일·바로가기·정확히 일치하는 자동 실행 값만 제거합니다. 기존 사진과 임시 폴더는 자동 삭제하지 않습니다.
- 설치 파일은 코드 서명되지 않았습니다. 서명만 허용하는 조직에서는 서명 인증서를 이용해 배포해야 합니다.

## 빌드·검증

Windows의 .NET Framework 컴파일러와 WinForms를 사용하며 추가 런타임 다운로드가 없습니다.

```text
node desktop/photo-clipboard/build.cjs --package
desktop\photo-clipboard\bin\HelperTests.exe artifacts\worker-id-clipboard-fix-20261022\native-tests
npm run test:ci -- --runTestsByPath src/utils/windowsPhotoClipboard.test.ts src/pages/manpower/WorkerIdImageShare.test.tsx
```

`--package`는 `public/downloads`의 설치 파일과 SHA-256을 갱신합니다. `HelperTests.exe`와 `SetupPreview.exe`는 배포하지 않습니다. 테스트 전용 `--serve <folder> <port>`는 다른 포트에서 실제 브라우저 요청을 받아 가상 사진으로 Windows 클립보드를 검증합니다. 설치나 자동 실행 등록은 하지 않습니다.

`HelperTests.exe --test-photo-window <전용 테스트 캐시> <test-1.jpg·test-2.jpg 가상 사진 폴더>`는 실제 Shell 선택 데이터, 창 재사용, 다른 배치 거절, 취소·timeout, 캐시 보호를 검사합니다. `--serve-photo-window <전용 테스트 캐시> <port>`는 실제 UI 스레드로 브라우저 연결을 검사하며 클립보드 복사를 차단합니다. 해당 테스트 캐시에 `stop-photo-window-server` 파일을 만들면 테스트 서버와 창이 종료됩니다. 실제 신분증 폴더를 테스트에 사용하지 않습니다.

`HelperTests.exe --test-native-clipboard <가상 JPG·PNG 2장이 있는 폴더> persist`는 실제 클립보드의 파일 목록, Shell 형식, 살아 있는 소유 프로세스, 반복 복사, 잘못된 배치 거부, 종료 후 유지를 검사합니다. 마지막 인수를 `replacement`로 바꾸면 다른 앱이 복사한 내용을 종료 시 덮어쓰지 않는지 확인합니다. 이 검사는 현재 클립보드를 가상 자료로 변경하므로 실제 신분증 폴더를 사용하지 않습니다.

## 프로토콜과 오류 구분

- loopback `127.0.0.1:43127`만 사용. 정확한 Host와 `Origin: https://cyee-9c1e4.web.app`만 허용합니다. 쿠키, Firebase 토큰, 원격 이미지 URL은 전달하지 않습니다.
- `/v1/session`은 읽기 전용으로 `protocol:2`, `version:1.3.0`, `clipboardMode:shell-files-v1`, `photoWindowMode:shell-view-v1`, 5분 유효 메모리 토큰을 반환합니다. 새 사진창 기능은 capability와 1.3 이상을 확인한 뒤 사진을 전달합니다. 기존 전체 복사는 1.2에서도 동작합니다. 구버전 확인을 위해 session 요청의 헤더 `X-CY-Photo-Protocol:1`도 허용하며, 실제 작업은 `2`와 Bearer 토큰을 요구합니다.
- `/v1/prepare`: little-endian uint32 JSON 길이 + UTF-8 `{files:[{name,type,size}]}` + 각 원본 바이트. 임시 배치 ID와 사진 개수만 반환하고 경로를 공개하지 않습니다.
- `/v1/copy`: 같은 세션에서 준비한 배치 ID만 복사합니다. 화면 취소 시 후속 복사를 시작하지 않습니다. 응답 유실 시 결과가 불명확하므로 재복사를 안내합니다.
- `/v1/open-photo-window`: 같은 세션에서 준비한 배치 ID만 받습니다. UI STA에서 사진창을 만들고 전체 선택을 확인한 뒤 `{batchId,photoCount,opened}`를 반환합니다. 동일 배치는 기존 창을 다시 표시하고, 다른 배치의 창이 이미 열렸으면 `photo-window-busy`로 거절합니다. 파일 경로·원격 URL·외부 창 핸들은 요청으로 받지 않습니다.
- 사진창 열기 결과를 공유·복사 성공 로그로 기록하지 않습니다. 사진창 준비 실패, 기존 창 사용 중, 응답 유실을 각각 안내하며 자동으로 카카오톡을 조작하거나 전송하지 않습니다.
- 연결 실패, 구버전, 사진 전달 실패, 지원하지 않는 이미지, 임시 파일 생성 실패, 복사 결과 미확인을 구분합니다.
- 최대 100장, 장당 20MiB, 합계 200MiB. 헤더 16KiB, manifest 64KiB, 요청 130초 제한. JPEG/PNG/GIF/WebP/BMP 시그니처 검증, 파일 경로/ADS/장치명 무력화, 전용 새 폴더만 사용합니다.
- 임의 파일 읽기, 원격 URL 다운로드, 셸 명령 실행, 외부 전송 기능이 없습니다. 다음 앱/사용자의 복사는 기존 클립보드를 바꿉니다. 클립보드 기록 창에 파일 목록이 보이는지는 별개의 Windows 기능입니다.

참고: [Microsoft Shell 항목 배열](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-shcreateshellitemarrayfromidlists), [Shell 데이터 객체](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-ishellitemarray-bindtohandler), [OLE 클립보드 유지](https://learn.microsoft.com/en-us/windows/win32/api/ole2/nf-ole2-olesetclipboard), [Chrome 로컬 네트워크 권한](https://developer.chrome.com/blog/local-network-access).
