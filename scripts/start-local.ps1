param(
    [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $repoRoot "evaluation\local-run"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$apiDir = Join-Path $repoRoot "apps\api"
$webDir = Join-Path $repoRoot "apps\web"
$apiLog = Join-Path $logDir "api.log"
$webLog = Join-Path $logDir "web.log"

if (-not (Test-Path (Join-Path $apiDir ".env"))) {
    Copy-Item (Join-Path $apiDir ".env.example") (Join-Path $apiDir ".env")
}

if (-not (Test-Path (Join-Path $webDir ".env.local"))) {
    Copy-Item (Join-Path $webDir ".env.local.example") (Join-Path $webDir ".env.local")
}

$apiCommand = '.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000'
$webCommand = 'npm.cmd run dev'

$apiProcess = Start-Process powershell -ArgumentList @(
    "-NoProfile",
    "-Command",
    "& { Set-Location '$apiDir'; $apiCommand *> '$apiLog' }"
) -PassThru -WindowStyle Hidden

$webProcess = Start-Process powershell -ArgumentList @(
    "-NoProfile",
    "-Command",
    "& { Set-Location '$webDir'; $webCommand *> '$webLog' }"
) -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 6

Write-Output "API PID: $($apiProcess.Id)"
Write-Output "Web PID: $($webProcess.Id)"
Write-Output "API log: $apiLog"
Write-Output "Web log: $webLog"
Write-Output "Open http://127.0.0.1:3000"

if ($OpenBrowser) {
    Start-Process "http://127.0.0.1:3000"
}
