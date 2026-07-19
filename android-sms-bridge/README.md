# 국민은행 SMS 브리지 (Android)

국민은행 입출금 문자를 받는 **회사 전용 Android 휴대폰**에서 허용된 발신자의 SMS만 Firebase HTTPS 함수로 전달하는 독립 앱입니다. 웹 프로젝트와 분리되어 있으며 Google Play 배포를 전제로 하지 않은 사내용 구성입니다.

## 제공 기능

- `RECEIVE_SMS` 런타임 권한 요청 및 `SMS_RECEIVED` 수신
- 전화번호·문자 발신자명의 **정확 일치 허용 목록** (기본 거부)
- 멀티파트 SMS 순서 결합
- Android Keystore AES-256-GCM으로 HMAC 비밀키와 대기 SMS 암호화
- WorkManager 네트워크 제약, 지수 백오프, 재부팅 후 미전송 작업 복원
- 거래가 없는 시간에도 서버가 기기 상태를 판단할 수 있는 15분 주기 서명 heartbeat
- 요청마다 기기 ID, 요청 시각, nonce 및 HMAC-SHA256 서명 전송
- 마지막 수신/성공/오류와 암호화 대기 건수만 표시하는 상태 화면
- SMS 원문·계좌·잔액·거래 상대를 로그 또는 상태 화면에 출력하지 않음
- 연결 테스트와 관리자의 수동 재시도

> WorkManager에는 SMS가 아니라 임의의 대기열 ID만 저장됩니다. 실제 SMS envelope은 Android Keystore 키로 암호화한 뒤 앱 전용 저장소에 보관하고, 성공 응답을 받으면 즉시 삭제합니다.

## 요구 환경

- Android 6.0(API 23) 이상, SMS 수신 가능한 전용 Android 휴대폰
- Android Studio의 JDK 17
- Android SDK 36
- 서버가 발급한 32바이트 이상의 기기별 HMAC 공유 비밀키
- HTTPS Firebase Function 주소

## 빌드 및 테스트

Android Studio에서 `android-sms-bridge` 폴더를 프로젝트로 열거나, 저장소 루트의 PowerShell에서 다음을 실행합니다.

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='C:\Users\playz\AppData\Local\Android\Sdk'
cd android-sms-bridge
.\gradlew.bat testDebugUnitTest lintDebug assembleDebug
```

생성 APK는 `app/build/outputs/apk/debug/app-debug.apk`입니다. 운영 배포에는 회사 소유 키로 서명한 release APK 또는 관리형 사내 배포(MDM)를 사용하세요. 키스토어와 비밀번호는 이 저장소에 넣지 않습니다.

## 서버 요청 규격

`POST` 본문은 UTF-8 JSON입니다.

```json
{
  "version": 1,
  "eventType": "bank_sms",
  "deviceId": "기기 UUID",
  "sender": "15889999",
  "message": "은행 SMS 원문",
  "receivedAt": 1760000000000,
  "queuedAt": 1760000000100,
  "nonce": "요청 UUID"
}
```

연결 테스트는 `eventType: "connection_test"`이고 `sender`와 `message`가 빈 문자열입니다. 서버는 이를 거래로 만들지 않고 인증·연결만 확인해야 합니다.

요청 헤더:

| 헤더 | 값 |
|---|---|
| `X-Sms-Bridge-Version` | `1` |
| `X-Sms-Bridge-Device` | 본문의 `deviceId`와 동일 |
| `X-Sms-Bridge-Timestamp` | 전송 시각 Unix epoch 밀리초 |
| `X-Sms-Bridge-Nonce` | 본문의 `nonce`와 동일 |
| `X-Sms-Bridge-Signature` | `sha256=<lowercase hex HMAC>` |

서명 입력은 다음 바이트를 그대로 이어 붙인 값입니다.

```text
<timestamp> + "\n" + <nonce> + "\n" + <HTTP raw body bytes>
```

Node/Firebase Functions 검증 핵심 예시:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

const timestamp = req.get("X-Sms-Bridge-Timestamp") ?? "";
const nonce = req.get("X-Sms-Bridge-Nonce") ?? "";
const supplied = (req.get("X-Sms-Bridge-Signature") ?? "").replace(/^sha256=/, "");
const signed = Buffer.concat([
  Buffer.from(`${timestamp}\n${nonce}\n`, "utf8"),
  req.rawBody,
]);
const expected = createHmac("sha256", deviceSecret).update(signed).digest("hex");
const valid = supplied.length === expected.length &&
  timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(expected, "hex"));
```

서버는 추가로 아래를 반드시 확인해야 합니다.

1. 기기 ID가 등록·활성 상태인지 확인합니다.
2. 본문/헤더의 기기 ID와 nonce가 일치하는지 확인합니다.
3. 요청 시각이 서버 시각 기준 ±5분 이내인지 확인합니다.
4. `(deviceId, nonce)`를 유일 키로 저장해 재전송을 멱등 처리합니다.
5. 같은 nonce가 이미 정상 처리됐다면 `200` 또는 `409`를 반환합니다. 앱은 둘 다 전달 완료로 간주합니다.
6. 서명 검증 전에는 원문을 파싱하거나 저장하지 않습니다.
7. 정상 응답은 `2xx`, 일시 장애는 `408`, `425`, `429` 또는 `5xx`, 영구 거부는 그 외 `4xx`로 반환합니다.
8. 함수 로그와 오류 추적 서비스에 요청 본문, 계좌번호, 잔액 또는 비밀키를 기록하지 않습니다.

## 설치 및 최초 설정

현재 서버는 별도의 브리지 기기 관리 화면을 두지 않고 Firebase Secret Manager의 `BANK_SMS_DEVICE_SECRETS` JSON으로 기기를 등록합니다.

1. APK를 회사 전용 휴대폰에 설치하고 앱을 한 번 실행합니다. 개발 기기에서는 `adb install -r app/build/outputs/apk/debug/app-debug.apk`로 설치할 수 있습니다.
2. **문자 수신 권한 허용**을 누르고 Android 권한 창에서 허용합니다.
3. 앱 상태 화면에 표시된 기기 UUID를 복사합니다.
4. 관리자 PC에서 기기별 32바이트 이상 무작위 ASCII 비밀키를 새로 만듭니다. 실제 키를 저장소, 메신저 또는 문서에 남기지 마세요.
5. 기존 등록 기기가 있다면 누락하지 말고 `{"<기기 UUID>":"<무작위 비밀키>"}` 형식의 전체 JSON을 Firebase Secret Manager의 `BANK_SMS_DEVICE_SECRETS`에 설정한 뒤 `ingestBankSms` 함수를 배포합니다.
6. 앱에 `https://asia-northeast3-<Firebase 프로젝트 ID>.cloudfunctions.net/ingestBankSms` 주소, 실제 국민은행 문자에 표시되는 발신번호/발신자명, 4번에서 만든 동일한 비밀키를 입력합니다. 여러 발신자는 쉼표나 줄바꿈으로 구분합니다.
7. **설정 저장**을 누릅니다. 비밀키는 Android Keystore로 암호화되며 화면에 다시 표시되지 않습니다.
8. **서버 연결 테스트**를 누르고 `연결 테스트 성공`, 대기 항목 `0개`인지 확인합니다.
9. 소액 실거래로 입금·출금 각각 한 번씩 시험하고 웹의 은행 알림 후보 및 수신 시각과 대조합니다.

Secret Manager 등록과 배포 명령은 저장소 루트의 `docs/bank-notification-guide.md`를 따르세요. `.env.example`의 예시 값을 실제 앱에 복사하면 안 됩니다.

설정을 저장하면 내용이 없는 `connection_test`가 WorkManager를 통해 약 15분 주기로 전송됩니다. Android 절전 모드에서는 실행이 늦어질 수 있으므로 서버와 웹 화면은 마지막 heartbeat가 2시간 이상 없을 때만 연결 지연으로 표시해야 합니다.

`15889999`는 초기 입력을 돕기 위한 기본값일 뿐입니다. 휴대폰에 실제로 도착한 국민은행 문자 상세의 발신자를 확인해 정확히 등록해야 합니다. 번호 일부 일치나 와일드카드는 보안상 지원하지 않습니다.

## 운영 방법

- 휴대폰을 항상 충전하고 Wi-Fi 또는 이동통신 데이터에 연결합니다.
- Android 앱 정보에서 이 앱의 배터리 사용을 **제한 없음**으로 설정합니다.
- 매일 상태 화면에서 문자 권한, 서버 설정, 대기 항목과 마지막 성공 시각을 확인합니다.
- 대기 항목이 남으면 먼저 네트워크·서버 상태·기기 등록을 수정한 뒤 **대기 중인 항목 다시 보내기**를 누릅니다.
- 휴대폰을 재부팅해도 WorkManager가 미완료 작업을 복구합니다. 단, 사용자가 Android 설정에서 앱을 강제 종료하면 앱을 직접 한 번 열기 전까지 수신이 중지될 수 있습니다.
- 휴대폰 교체 시 새 기기 ID와 새 비밀키를 발급하고, 이전 기기를 서버에서 즉시 비활성화합니다.
- Android 잠금 해제 방식 변경·보안 초기화 후 암호화 대기열을 열 수 없다면 서버에서 해당 기기를 폐기하고 재등록합니다.

## 보안 및 한계

- 앱 백업은 비활성화했고 HTTP 평문 통신과 리다이렉트를 허용하지 않습니다.
- 화면 캡처를 차단하고 원문을 상태 화면이나 앱 로그에 표시하지 않습니다.
- 발신번호 허용 목록과 HMAC은 오발송·위변조 위험을 낮추지만, SMS 자체를 은행의 최종 원장으로 만들지는 못합니다. 거래는 서버에서 `검토 필요` 후보로 생성하세요.
- SMS 양식이 바뀔 수 있으므로 서버 파싱 실패함과 원장 대조 절차가 필요합니다.
- Google Play의 SMS 권한 정책이 엄격하므로 사내 MDM/관리형 배포를 권장합니다.
- 일부 최신 Android 기기는 SMS 권한을 제한 권한으로 취급합니다. 권한 창에서 허용할 수 없다면 회사 MDM/관리형 설치 프로그램에서 해당 권한을 허용 목록에 넣어야 합니다.
- 장기적으로 KB 기업뱅킹 또는 공인 거래 API가 제공되면 이 브리지는 보조 채널로 전환하세요.

## 단위 테스트 범위

- HMAC-SHA256 표준 벡터 및 정확한 canonical 입력
- 번호 구두점과 `+82` 정규화
- 한글/영문 발신자명 정확 일치
- 부분 일치 사칭 차단과 빈 허용 목록 기본 거부

실제 SMS 브로드캐스트, Android Keystore, 재부팅 복구는 Android 기기/에뮬레이터에서 별도로 검증해야 합니다.
