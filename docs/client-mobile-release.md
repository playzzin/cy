# 모바일 요구사항 운영 반영

기준 운영 커밋: c728b2fd7be589daca23ab6a1d2a897649bb68cd.

이번 변경은 모바일 조회·상세, 사진 파일 공유, 정산 고정 월 선택, 가불 안내, 팀 계정 승인, 팀장 메뉴/접근 정책, 반응형 레이아웃과 표 초기화다. 기존 운영 AI 설정·알림 기능·메뉴의 별도 변경은 포함하지 않는다.

서버 대상: teamAccountApprovals, teamOffDutyRequests, getTeamScopedData, teamWorkerRequests. 기존 서버 함수의 런타임 자원 설정은 유지한다. Firestore 규칙·인덱스는 기존 소스 유지, Storage 규칙은 현재 운영 규칙과 일치시키며 재배포하지 않는다.

프런트는 위 서버 반영을 확인한 후 REACT_APP_TEAM_ACCOUNT_APPROVALS_ENABLED=true로 빌드한다. 기본 소스 설정은 비활성이다. 복구 시 이전 Hosting 버전으로 복원하거나 해당 빌드 변수를 false로 설정한다. 서버 권한 검증은 유지한다.

배포 후 사용자가 허용한 범위는 화면·접근·조회다. 실제 승인, 신청 생성, 지급 상태 변경, 데이터 정리, 외부 메시지 전송은 실행하지 않는다. Android·카카오톡 실기기 검수는 별도다.
