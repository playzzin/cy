# Windows 사진 전체 복사

`WorkerIdImageShare`의 Windows 버튼은 선택된 원본 사진만 이 PC의 보조 프로그램으로 전달합니다. 보조 프로그램이 사진별 파일을 저장한 뒤 Windows `FileDrop` (`CF_HDROP`) 클립보드를 채웁니다. 카카오톡 전송은 사용자가 대화방에서 Ctrl+V로 첨부하고 직접 확인합니다.

## 설치·제거

- 사이트에서 `CYPhotoClipboardSetup.exe`를 내려받아 실행하고 **설치하고 실행**을 선택합니다. 관리자 권한은 필요하지 않습니다.
- 현재 사용자 `%LOCALAPPDATA%\CY\PhotoClipboard`에 설치되며, 시작 메뉴 바로가기와 HKCU Run의 `CYPhotoClipboard` 값으로 로그인 시 실행됩니다.
- Chrome/Edge에서 로컬 네트워크 접근을 물으면 허용합니다. 브라우저 보안 설정을 비활성화하지 않습니다.
- 사진은 Windows의 다운로드 폴더 안 `CY_신분증_사진`의 새 배치 폴더에 남습니다. 자동 삭제하지 않으므로 사용자가 관리합니다.
- Windows 알림 영역 메뉴에서 저장 폴더 열기, 마지막 배치 재복사, 종료가 가능합니다.
- 같은 설치 파일의 **보조 프로그램 제거**는 실행 파일·바로가기·해당 자동 실행 값만 지웁니다. 저장한 사진은 지우지 않습니다.
- 설치 파일은 코드 서명되지 않았습니다. 조직 정책이 서명된 앱만 허용하면 서명 인증서로 배포해야 합니다. SmartScreen/백신을 끄거나 우회하지 않습니다.

## 빌드·검증

Windows에 포함된 .NET Framework 4.x 컴파일러와 WinForms를 사용하며 추가 런타임 다운로드는 없습니다.

```text
node desktop/photo-clipboard/build.cjs --package
desktop\photo-clipboard\bin\HelperTests.exe artifacts\worker-id-windows-helper-20261022\native-tests
npm run test:ci -- --runTestsByPath src/utils/windowsPhotoClipboard.test.ts src/pages/manpower/WorkerIdImageShare.test.tsx
```

`--package`는 웹 다운로드용 설치 파일과 SHA-256을 `public/downloads`에 갱신합니다. 생성 바이너리를 소스와 함께 검토하고 배포 전에 빌드·테스트합니다. `HelperTests.exe`는 배포하지 않습니다. `--serve <test-folder>`는 실제 브라우저 검증 전용이며, 테스트 사진으로 실제 Windows 클립보드를 바꿉니다. 설치나 자동 실행 설정은 하지 않습니다.

## 연결 규약과 제한

- `127.0.0.1:43127`에만 바인딩. 정확한 Host와 `Origin: https://cyee-9c1e4.web.app`만 허용.
- `/v1/session`에서 앱 ID·프로토콜·5분 유효 메모리 토큰 반환. 각 요청에 `X-CY-Photo-Protocol: 1`, POST에 Bearer 토큰 필요. CORS는 지정 출처만 허용. 쿠키·Firebase 토큰·저장소 URL을 전달하지 않음.
- `/v1/save`: little-endian uint32 JSON 길이 + UTF-8 `{files:[{name,type,size}]}` + 순서대로 원본 파일 바이트. 최대 100장, 한 장 20MiB, 합계 200MiB. 헤더 16KiB, manifest 64KiB, 전체 요청 130초 제한.
- 허용 형식 JPEG/PNG/GIF/WebP/BMP의 파일 시그니처 검사, 경로/ADS/장치명 무력화, 서버 생성 폴더·숫자 접두사·확장자 사용. 요청자가 지정한 경로 읽기·URL 다운로드·명령 실행 없음.
- `/v1/copy`: 같은 세션에서 방금 저장한 배치 ID만 허용. 저장과 복사를 분리하여 취소된 화면이 새 복사를 시작하지 않게 함. 복사 완료 시에만 `copied:true`; 실패 시 파일은 유지하고 트레이 재복사 제공.
- 다른 앱·탭의 다음 복사는 클립보드를 교체함. 네트워크 응답 유실 시 이미 저장됐을 수 있으므로 성공/미저장으로 단정하지 않음. 전송 중 화면을 닫아도 이미 끝난 로컬 저장/복사를 되돌리지는 않음.
- Windows 10/11, Chrome/Edge 대상. PC 카카오톡 버전별 첨부 동작은 별도 실기 검증 필요. 한 PC의 동시 Windows 로그인 세션은 동일 포트를 공유하므로 한 보조 프로그램만 사용할 수 있음.

참고: [Microsoft 파일 클립보드 API](https://learn.microsoft.com/en-us/dotnet/api/system.windows.forms.clipboard.setfiledroplist), [Chrome 로컬 네트워크 권한](https://developer.chrome.com/blog/local-network-access).
