$ErrorActionPreference = "Stop"

$ports = 3000, 8000
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
        try {
            Stop-Process -Id $connection.OwningProcess -Force -ErrorAction Stop
            Write-Output "Stopped process $($connection.OwningProcess) on port $port"
        } catch {
            Write-Warning ("Could not stop process {0} on port {1}: {2}" -f $connection.OwningProcess, $port, $_.Exception.Message)
        }
    }
}
