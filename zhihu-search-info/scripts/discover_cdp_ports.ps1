param(
  [int[]]$Ports = @(9222, 9223, 9224, 9225, 9333),
  [switch]$Json
)

$ErrorActionPreference = "Stop"

function Get-EnvRows {
  Get-ChildItem Env: |
    Where-Object { $_.Name -match "CHROME|CDP|DIDY|BILIBILI|ZHIHU" } |
    Sort-Object Name |
    Select-Object Name, Value
}

function Get-ListenRows {
  Get-NetTCPConnection -State Listen |
    Where-Object {
      $_.LocalAddress -in @("127.0.0.1", "0.0.0.0") -and
      $_.LocalPort -ge 9000 -and
      $_.LocalPort -le 9999
    } |
    Select-Object LocalAddress, LocalPort, OwningProcess |
    Sort-Object LocalPort
}

function Get-CdpProbeRows {
  param([int[]]$ProbePorts)

  foreach ($port in $ProbePorts) {
    try {
      $version = Invoke-RestMethod -UseBasicParsing -Uri "http://127.0.0.1:$port/json/version" -TimeoutSec 2
      [pscustomobject]@{
        Port = $port
        Status = "OK"
        Browser = $version.Browser
        WebSocket = $version.webSocketDebuggerUrl
      }
    } catch {
      [pscustomobject]@{
        Port = $port
        Status = "FAIL"
        Browser = ""
        WebSocket = $_.Exception.Message
      }
    }
  }
}

function Get-CdpTabs {
  param([int[]]$ProbePorts)

  foreach ($port in $ProbePorts) {
    try {
      $version = Invoke-RestMethod -UseBasicParsing -Uri "http://127.0.0.1:$port/json/version" -TimeoutSec 2
      if (-not $version) { continue }
      $tabs = Invoke-RestMethod -UseBasicParsing -Uri "http://127.0.0.1:$port/json/list" -TimeoutSec 3
      foreach ($tab in $tabs) {
        if ($tab.url -match "zhihu\.com|bilibili\.com|b23\.tv") {
          [pscustomobject]@{
            Port = $port
            Id = $tab.id
            Type = $tab.type
            Title = $tab.title
            Url = $tab.url
            WebSocket = $tab.webSocketDebuggerUrl
          }
        }
      }
    } catch {
      continue
    }
  }
}

function Get-ChromeProcessRows {
  Get-CimInstance Win32_Process |
    Where-Object {
      $_.CommandLine -match "remote-debugging-port|\.chrome-dify|feishu-auto-create-app|zhihu|bilibili"
    } |
    Select-Object ProcessId, Name, CommandLine
}

$envRows = @(Get-EnvRows)
$listenRows = @(Get-ListenRows)
$probeRows = @(Get-CdpProbeRows -ProbePorts $Ports)
$tabs = @(Get-CdpTabs -ProbePorts $Ports)
$processRows = @(Get-ChromeProcessRows)

if ($Json) {
  [pscustomobject]@{
    environment = $envRows
    listeningPorts = $listenRows
    cdpProbes = $probeRows
    matchedTabs = $tabs
    processes = $processRows
  } | ConvertTo-Json -Depth 6
  exit 0
}

Write-Output "== Environment =="
$envRows | Format-Table -AutoSize
Write-Output ""
Write-Output "== Listening Ports 9000-9999 =="
$listenRows | Format-Table -AutoSize
Write-Output ""
Write-Output "== CDP Probe =="
$probeRows | Format-Table -AutoSize
Write-Output ""
Write-Output "== Zhihu/Bilibili Tabs =="
$tabs | Format-List
Write-Output ""
Write-Output "== Matching Processes =="
$processRows | Format-List
