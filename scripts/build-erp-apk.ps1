param(
    [string]$JavaHome = 'C:\Program Files\Android\Android Studio\jbr',
    [string]$AndroidHome = "$env:LOCALAPPDATA\Android\Sdk",
    [switch]$SignOnly
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$androidProject = Join-Path $projectRoot 'android-erp-launcher'
$signingDirectory = Join-Path $androidProject '.signing'
$keyStore = Join-Path $signingDirectory 'erp-release.p12'
$passwordFile = Join-Path $signingDirectory 'password.dpapi'
$previousJavaHome = $env:JAVA_HOME
$previousAndroidHome = $env:ANDROID_HOME

try {
    $env:JAVA_HOME = $JavaHome
    $env:ANDROID_HOME = $AndroidHome
    $keyTool = Join-Path $JavaHome 'bin\keytool.exe'
    $apkSigner = Join-Path $AndroidHome 'build-tools\36.1.0\apksigner.bat'
    if (!(Test-Path -LiteralPath $keyTool) -or !(Test-Path -LiteralPath $apkSigner)) {
        throw 'Android Studio JDK 또는 Android SDK build-tools 36.1.0을 찾을 수 없습니다.'
    }

    node (Join-Path $PSScriptRoot 'build-erp-downloads.cjs')
    if ($LASTEXITCODE -ne 0) { throw '아이콘 생성 실패' }

    $hasKey = Test-Path -LiteralPath $keyStore
    $hasPassword = Test-Path -LiteralPath $passwordFile
    if ($hasKey -ne $hasPassword) {
        throw '기존 서명키 또는 암호 파일이 누락되었습니다. 기존 키를 덮어쓰지 않습니다.'
    }
    if (!$hasKey) {
        New-Item -ItemType Directory -Path $signingDirectory -Force | Out-Null
        $randomBytes = New-Object byte[] 32
        $randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $randomGenerator.GetBytes($randomBytes)
        $randomGenerator.Dispose()
        $securePassword = ConvertTo-SecureString ([Convert]::ToBase64String($randomBytes)) -AsPlainText -Force
        ConvertFrom-SecureString $securePassword | Set-Content -LiteralPath $passwordFile
        $env:CY_ERP_KEYSTORE_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
        & $keyTool -genkeypair -keystore $keyStore -storetype PKCS12 -alias cy-erp -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=CY ERP, O=Cheongyeon ENG, C=KR' -storepass:env CY_ERP_KEYSTORE_PASSWORD -keypass:env CY_ERP_KEYSTORE_PASSWORD
        if ($LASTEXITCODE -ne 0) { throw 'APK 서명키 생성 실패' }
    } else {
        $securePassword = Get-Content -LiteralPath $passwordFile | ConvertTo-SecureString
        $env:CY_ERP_KEYSTORE_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
    }

    if (!$SignOnly) {
        & (Join-Path $androidProject 'gradlew.bat') -p $androidProject --no-daemon --console=plain lintRelease assembleRelease
        if ($LASTEXITCODE -ne 0) { throw 'Android 린트 또는 APK 빌드 실패' }
    }

    $unsignedApk = Join-Path $androidProject 'app\build\outputs\apk\release\app-release-unsigned.apk'
    $signedApk = Join-Path $androidProject 'app\build\outputs\apk\release\cheongyeon-erp.apk'
    & $apkSigner sign --ks $keyStore --ks-key-alias cy-erp --ks-pass env:CY_ERP_KEYSTORE_PASSWORD --key-pass env:CY_ERP_KEYSTORE_PASSWORD --out $signedApk $unsignedApk
    if ($LASTEXITCODE -ne 0) { throw 'APK 서명 실패' }
    & $apkSigner verify --verbose $signedApk
    if ($LASTEXITCODE -ne 0) { throw 'APK 서명 검증 실패' }

    $publishedApk = Join-Path $projectRoot 'public\downloads\cheongyeon-erp.apk'
    Copy-Item -LiteralPath $signedApk -Destination $publishedApk -Force
    Get-Item -LiteralPath $publishedApk | Select-Object FullName, Length
} finally {
    $env:JAVA_HOME = $previousJavaHome
    $env:ANDROID_HOME = $previousAndroidHome
    $env:CY_ERP_KEYSTORE_PASSWORD = $null
}
