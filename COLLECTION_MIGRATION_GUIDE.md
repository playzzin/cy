# 출력일보 데이터 컬렉션 통합 안내

## 문제 상황
출력일보 데이터가 두 개의 컬렉션으로 나뉘어 저장되고 있었습니다:
- `daily_reports` (정식 컬렉션)
- `dailyReports` (중복 컬렉션)

## 해결 완료 작업

### 1. 코드 수정
- ✅ `DataManagementSection.tsx`: `dailyReports` 제거
- ✅ `SystemManagementPage.tsx`: `dailyReports` 제거
- ✅ 모든 서비스는 `daily_reports`를 사용하도록 통일

### 2. 데이터 마이그레이션
- 📋 `migrate-daily-reports.js` 스크립트 생성
- 🔄 `dailyReports` → `daily_reports`로 데이터 이전 준비 완료

## 다음 단계 (실행 필요)

### Firebase에서 데이터 마이그레이션 실행:

#### 방법 1: Firebase Console
1. Firebase Console > Functions 이동
2. 새 Function 생성
3. `migrate-daily-reports.js` 코드 복사하여 붙여넣기
4. Function 배포 및 실행

#### 방법 2: 로컬 실행
```bash
# Firebase CLI 설치 후
firebase functions:shell
# 스크립트 실행
```

### 마이그레이션 후 확인사항
1. ✅ `daily_reports` 컬렉션에 모든 데이터 이전 확인
2. ✅ 앱 정상 동작 테스트
3. ⚠️  `dailyReports` 컬렉션 수동 삭제 (Firebase Console)

## 파일 목록
- `migrate-daily-reports.js`: 데이터 마이그레이션 스크립트
- 수정된 파일: DataManagementSection.tsx, SystemManagementPage.tsx

## 중요
- 마이그레이션 실행 전 반드시 데이터 백업
- 테스트 환경에서 먼저 실행 권장
- 문제 발생 시 즉시 연락 요망
