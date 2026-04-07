$ErrorActionPreference = 'SilentlyContinue'

# Stop any process listening on port 3000.
$connections = Get-NetTCPConnection -LocalPort 3000 -State Listen
$processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $processIds) {
    if ($processId -and $processId -gt 0) {
        Stop-Process -Id $processId -Force
    }
}

Write-Output "Stopped processes on port 3000: $($processIds -join ', ')"
