# Todo Codex 자동 처리

`/todo`의 요청을 실제 코드 수정, 검증, 피드백 기록까지 처리하는 로컬 Codex 워커입니다.

## 처리 기준

- 요청 등록 시 **Codex 자동 처리**를 선택한 업무만 상시 워커가 자동으로 처리합니다.
- Codex는 관련 코드를 확인한 뒤 필요한 파일만 수정하고, 가능한 범위의 검증을 실행합니다.
- 수정 파일과 검증 결과가 모두 확인되어야 상태를 `완료`로 바꿉니다.
- 요청이 모호하거나 위험한 작업, 변경 파일 또는 검증 결과가 없는 작업은 `검토`로 바꾸고 사유와 피드백을 남깁니다.
- 자동 처리에서 실패한 업무는 반복 실행을 막기 위해 자동 처리를 해제하고 `검토`로 전환합니다. 오류를 해결한 뒤 화면의 `Codex` 버튼으로 다시 실행할 수 있습니다.
- Codex는 커밋, 푸시, 배포, 외부 메시지 발송, 권한/자격 증명 변경, 라이브 데이터 변경·삭제를 수행하지 않습니다.
- 한 번에 하나의 Codex 작업만 이 저장소를 수정하도록 잠금 처리합니다.

## 준비

Codex CLI 로그인과 Firestore Admin 권한이 필요합니다. 프로젝트 루트에 `service-account.json`을 두거나 환경 변수로 서비스 계정 파일의 경로를 지정하세요. 이 파일은 절대 커밋하지 마세요.

```powershell
codex login
$env:FIREBASE_SERVICE_ACCOUNT="C:\Users\playz\cy\service-account.json"
```

`.env.local`에 다음 값을 둘 수 있습니다.

```env
REACT_APP_TODO_CODEX_BRIDGE_URL=http://127.0.0.1:8787
TODO_CODEX_SANDBOX=workspace-write
TODO_CODEX_AUTO_ENABLED=true
TODO_CODEX_AUTO_INTERVAL_MS=60000
```

`TODO_CODEX_AUTO_ENABLED`은 `todo:codex-auto` 워커를 직접 실행할 때만 필요합니다. 아래 통합 명령은 `--watch` 자체를 명시적 자동 처리 승인으로 사용합니다.

## 화면에서 한 건 실행

1. 별도 터미널에서 브리지를 실행합니다.

```powershell
npm run todo:codex-bridge
```

2. `/todo`에서 `요청` 또는 `재요청` 상태 업무의 `Codex` 버튼을 누릅니다.
3. 작업은 `진행`으로 바뀐 뒤, 완료 또는 검토 상태와 함께 수정 파일·검증 결과·피드백이 댓글로 남습니다.

브리지 상태는 다음으로 확인합니다.

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8787/health
```

## 요청 등록 즉시 자동 처리

자동 처리 워커는 요청 등록 화면에서 **Codex 자동 처리**를 체크한 업무만 감시합니다. 브리지와 감시 워커를 함께 실행하려면 다음 한 줄을 사용합니다.

```powershell
npm run todo:codex-automation
```

워커는 Firestore 변경 알림과 60초 간격 점검을 함께 사용합니다. `/todo` 화면의 Codex 상태 표시에서 브리지 및 자동 감시 상태를 확인할 수 있습니다. 중지하려면 실행 중인 터미널에서 `Ctrl+C`를 누릅니다.

감시 워커만 별도로 실행해야 할 때는 `TODO_CODEX_AUTO_ENABLED=true`를 설정한 뒤 기존 명령을 사용할 수 있습니다.

```powershell
npm run todo:codex-auto
```

## 개별 실행 및 점검

```powershell
npm run todo:codex-run -- --task-id <taskId>
npm run todo:codex-dry-run
```

실행 로그는 `.codex-todo-worker/`에 저장됩니다. 작업이 비정상 종료되어 잠금 파일이 남은 경우, 실행 중인 Codex 워커가 없음을 확인한 뒤 이 폴더의 `workspace.lock`만 삭제하고 다시 실행하세요.
