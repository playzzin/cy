# Windows 사진 전체 복사 1.1

Windows의 **사진 N장 전체 복사** 버튼은 선택된 원본 사진만 PC 보조 프로그램으로 전달합니다. 다운로드 폴더에 따로 저장하는 단계 없이, 내부 임시 파일 목록을 Windows `FileDrop` (`CF_HDROP`) 클립보드에 넣습니다. 복사 직후 파일 목록·개수·실제 파일 존재를 다시 확인한 뒤에만 성공을 반환합니다. 카카오톡 첨부/전송 여부는 카카오톡에서 별도 확인합니다.

## 설치·업데이트·제거

- `CYPhotoClipboardSetup.exe` 실행 후 **설치하고 실행**. 1.0 사용자는 1.1 설치 파일로 업데이트하고 사이트를 새로고침합니다. 관리자 권한이 필요하지 않습니다.
- `%LOCALAPPDATA%\CY\PhotoClipboard`에 설치되며 시작 메뉴 바로가기와 현재 사용자 HKCU Run의 `CYPhotoClipboard` 값으로 로그인 시 실행됩니다.
- 브라우저가 로컬 네트워크 접근을 물으면 허용합니다. 보안 기능을 비활성화하거나 우회하지 않습니다.
- 사진은 `Cache` 하위의 표시된 전용 배치에 임시 보관합니다. 시작 시 및 15분 간격으로 24시간 지난 배치를 정리하되 현재 클립보드에서 참조 중이면 유지합니다. 재분석 지점, 하위 폴더, 알 수 없는 파일이 있으면 삭제하지 않습니다. 원래 다운로드 폴더의 사진은 건드리지 않습니다.
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

## 프로토콜과 오류 구분

- loopback `127.0.0.1:43127`만 사용. 정확한 Host와 `Origin: https://cyee-9c1e4.web.app`만 허용합니다. 쿠키, Firebase 토큰, 원격 이미지 URL은 전달하지 않습니다.
- `/v1/session`은 읽기 전용으로 `protocol:2`, `version:1.1.0`, 5분 유효 메모리 토큰을 반환합니다. 구버전 확인을 위해 session 요청의 헤더 `X-CY-Photo-Protocol:1`도 허용하며, 실제 작업은 `2`와 Bearer 토큰을 요구합니다.
- `/v1/prepare`: little-endian uint32 JSON 길이 + UTF-8 `{files:[{name,type,size}]}` + 각 원본 바이트. 임시 배치 ID와 사진 개수만 반환하고 경로를 공개하지 않습니다.
- `/v1/copy`: 같은 세션에서 준비한 배치 ID만 복사합니다. 화면 취소 시 후속 복사를 시작하지 않습니다. 응답 유실 시 결과가 불명확하므로 재복사를 안내합니다.
- 연결 실패, 구버전, 사진 전달 실패, 지원하지 않는 이미지, 임시 파일 생성 실패, 복사 결과 미확인을 구분합니다.
- 최대 100장, 장당 20MiB, 합계 200MiB. 헤더 16KiB, manifest 64KiB, 요청 130초 제한. JPEG/PNG/GIF/WebP/BMP 시그니처 검증, 파일 경로/ADS/장치명 무력화, 전용 새 폴더만 사용합니다.
- 임의 파일 읽기, 원격 URL 다운로드, 셸 명령 실행, 외부 전송 기능이 없습니다. 다음 앱/사용자의 복사는 기존 클립보드를 바꿉니다. 클립보드 기록 창에 파일 목록이 보이는지는 별개의 Windows 기능입니다.

참고: [Microsoft 파일 클립보드 API](https://learn.microsoft.com/en-us/dotnet/api/system.windows.forms.clipboard.setfiledroplist), [Chrome 로컬 네트워크 권한](https://developer.chrome.com/blog/local-network-access).
