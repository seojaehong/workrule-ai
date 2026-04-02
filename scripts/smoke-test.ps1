$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$reportDir = Join-Path $repoRoot "evaluation\local-smoke"
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null

$start = Get-Date
$apiHealth = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get
$webHome = Invoke-WebRequest -Uri "http://127.0.0.1:3000" -UseBasicParsing

$reviewPayload = @{
    company_name = "스모크테스트 주식회사"
    company_rule_text = "제21조(배우자 출산휴가)`n회사는 배우자 출산 시 10일의 휴가를 부여한다."
    standard_rule_text = "제23조(배우자 출산휴가)`n회사는 관련 법령에 따라 배우자 출산휴가를 부여한다."
    industry = "서비스업"
    employee_count = 12
    focus_areas = @("배우자 출산휴가")
    review_date = "2026-04-02"
} | ConvertTo-Json -Depth 5

$reviewResponse = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/diagnose" -Method Post -ContentType "application/json" -Body $reviewPayload

$tmpUploadPath = Join-Path $reportDir "sample-upload.txt"
@"
제1조(목적)
회사는 질서를 유지하기 위하여 취업규칙을 둔다.
"@ | Set-Content -Path $tmpUploadPath -Encoding utf8

$uploadResponse = curl.exe -s -X POST -F "file=@$tmpUploadPath" "http://127.0.0.1:3000/api/ingest"
$uploadJson = $uploadResponse | ConvertFrom-Json

$elapsed = [int]((Get-Date) - $start).TotalSeconds
$report = @{
    checked_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz")
    elapsed_seconds = $elapsed
    api_health = $apiHealth
    web_status_code = $webHome.StatusCode
    diagnosis_company = $reviewResponse.summary.company_name
    diagnosis_total_findings = $reviewResponse.summary.total_findings
    ingestion_filename = $uploadJson.filename
    ingestion_parser = $uploadJson.parser
    ingestion_char_count = $uploadJson.char_count
} | ConvertTo-Json -Depth 5

$reportPath = Join-Path $reportDir "report.json"
$report | Set-Content -Path $reportPath -Encoding utf8

$summaryPath = Join-Path $repoRoot "evaluation\report.json"
$report | Set-Content -Path $summaryPath -Encoding utf8

Write-Output "Smoke test report: $reportPath"
