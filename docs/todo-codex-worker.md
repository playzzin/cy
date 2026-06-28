# Todo Codex Click Bridge

`/todo`에서 요청 행의 `Codex` 버튼을 눌렀을 때 로컬 Codex CLI가 요청 내용을 더 명확한 작업 지시문으로 개선해 저장하는 브릿지입니다.

## 동작

1. 로컬에서 `npm run todo:codex-bridge`를 실행해 브릿지를 켭니다.
2. `/todo` 화면에서 `요청` 또는 `재요청` 상태의 작업에 있는 `Codex` 버튼을 누릅니다.
3. 브릿지가 해당 `taskId`만 받아 runner를 실행합니다.
4. `/todo` 화면이 작업을 `진행`으로 바꾸고 브릿지에 현재 요청 내용을 전달합니다.
5. 브릿지가 로컬 `codex exec`로 개선된 요청 문구 JSON을 생성해 화면에 돌려줍니다.
6. `/todo` 화면이 개선문을 `title`에 저장하고 작업을 `완료`로 바꾸며 피드백을 시스템 댓글로 남깁니다.
7. 실패하면 `/todo` 화면이 작업을 `재요청`으로 바꾸고 실패 내용을 시스템 댓글로 남깁니다.

감시 루프는 없습니다. 버튼 클릭이 있을 때만 실행됩니다.

## 준비

Codex CLI가 로그인되어 있어야 합니다.

```powershell
codex login
codex doctor
```

웹에서 버튼으로 실행하는 경로는 현재 로그인된 앱 권한으로 Firestore를 저장하므로 서비스 계정이 필요하지 않습니다.

터미널에서 `todo:codex-run -- --task-id`를 직접 실행하는 경우에만 Firestore Admin 권한이 필요합니다. 그때는 프로젝트 루트에 `service-account.json`을 두거나 환경 변수로 경로를 지정하세요.

```powershell
$env:FIREBASE_SERVICE_ACCOUNT="C:\Users\playz\cy\service-account.json"
```

`service-account.json`은 `.gitignore`에 포함되어 있으므로 커밋되지 않습니다.

## 실행

브릿지 실행:

```powershell
npm run todo:codex-bridge
```

그 다음 `/todo`에서 원하는 요청의 `Codex` 버튼을 누르세요.

브릿지 상태 확인:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8787/health
```

터미널에서 특정 작업을 직접 실행하려면:

```powershell
npm run todo:codex-run -- --task-id <taskId>
```

대상 확인만:

```powershell
npm run todo:codex-dry-run
```

## 선택 설정

```powershell
$env:TODO_CODEX_MODEL="gpt-5.3-codex-spark"
$env:TODO_CODEX_TIMEOUT_MS="1200000"
$env:TODO_CODEX_SANDBOX="read-only"
$env:TODO_CODEX_BRIDGE_PORT="8787"
```

React 앱에서 다른 브릿지 URL을 쓰려면 빌드 전에 설정하세요.

```powershell
$env:REACT_APP_TODO_CODEX_BRIDGE_URL="http://localhost:8787"
```

로그는 `.codex-todo-worker/`에 저장됩니다.
