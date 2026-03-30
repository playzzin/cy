# 청연ENG ERP 통합 배포 및 저장 스크립트 (Smart Construction ERP Deployment)
Write-Host ">>> 1. GitHub 변경사항 저장 중..." -ForegroundColor Cyan
git add .
git commit -m "feat: 시스템 업데이트 및 배포 반영 (자동화 스크립트)"
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "!!! GitHub 저장 실패. 브랜치 이름을 확인하거나 로그인을 해주세요." -ForegroundColor Red
    # exit $LASTEXITCODE
}

Write-Host ">>> 2. 프로덕션 빌드 시작 (npm run build)..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "!!! 빌드 실패. 에러 메시지를 확인해 주세요." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ">>> 3. Firebase Hosting 배포 시작..." -ForegroundColor Cyan
firebase deploy --only hosting

if ($LASTEXITCODE -ne 0) {
    Write-Host "!!! 배포 실패. firebase login 상태를 확인해 주세요." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ">>> [성공] 모든 작업이 완료되었습니다! 🚀" -ForegroundColor Green
