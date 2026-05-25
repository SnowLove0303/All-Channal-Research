param(
  [ValidateSet("search", "fetch", "hot", "recommend", "question", "answer", "article", "observe")]
  [string]$Mode = "search",
  [string]$Query = "",
  [string]$Url = "",
  [int]$Limit = 10,
  [ValidateSet("all", "answer", "article", "question")]
  [string]$Type = "all",
  [ValidateSet("default", "created")]
  [string]$Sort = "default",
  [int]$MaxContent = 4000,
  [string]$CdpUrl = "",
  [int]$TimeoutMs = 30000,
  [string]$OutJson = "",
  [string]$OutMarkdown = "",
  [switch]$NewTab
)

$ErrorActionPreference = "Stop"

function Add-CdpCandidate {
  param(
    [System.Collections.Generic.List[string]]$Candidates,
    [string]$Value
  )
  $text = [string]$Value
  if (-not $text) { return }
  foreach ($part in ($text -split "[,;]")) {
    $candidate = $part.Trim()
    if (-not $candidate) { continue }
    if ($candidate -match "^\d+$") { $candidate = "http://127.0.0.1:$candidate" }
    if ($candidate -notmatch "^https?://") { continue }
    $candidate = $candidate.TrimEnd("/")
    if (-not $Candidates.Contains($candidate)) { $Candidates.Add($candidate) | Out-Null }
  }
}

function Resolve-CdpUrl {
  param([string]$Preferred)

  $candidates = [System.Collections.Generic.List[string]]::new()
  Add-CdpCandidate $candidates $Preferred
  Add-CdpCandidate $candidates $env:CHROME_DIDY_CDP_URL
  Add-CdpCandidate $candidates ([Environment]::GetEnvironmentVariable("CHROME_DIDY_CDP_URL", "User"))
  Add-CdpCandidate $candidates $env:CHROME_DIDY_CHROME_PORT
  Add-CdpCandidate $candidates ([Environment]::GetEnvironmentVariable("CHROME_DIDY_CHROME_PORT", "User"))

  $configPath = "F:\AIAPP\Codex\Codex1\data\config.json"
  if (Test-Path $configPath) {
    try {
      $config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
      Add-CdpCandidate $candidates $config.cdp_url
      Add-CdpCandidate $candidates $config.cdpUrl
    } catch {
      # Ignore malformed optional runtime config.
    }
  }

  foreach ($port in @(9222, 9223, 9224, 9225, 9333)) {
    Add-CdpCandidate $candidates "http://127.0.0.1:$port"
  }

  foreach ($candidate in $candidates) {
    try {
      $null = Invoke-RestMethod -Uri "$candidate/json/version" -TimeoutSec 2 -ErrorAction Stop
      return $candidate
    } catch {
      continue
    }
  }

  if ($candidates.Count -gt 0) { return $candidates[0] }
  return "http://127.0.0.1:9223"
}

function Resolve-CdpCandidates {
  param([string]$Preferred)

  $candidates = [System.Collections.Generic.List[string]]::new()
  Add-CdpCandidate $candidates $Preferred
  Add-CdpCandidate $candidates $env:CHROME_DIDY_CDP_URL
  Add-CdpCandidate $candidates ([Environment]::GetEnvironmentVariable("CHROME_DIDY_CDP_URL", "User"))
  Add-CdpCandidate $candidates $env:CHROME_DIDY_CHROME_PORT
  Add-CdpCandidate $candidates ([Environment]::GetEnvironmentVariable("CHROME_DIDY_CHROME_PORT", "User"))

  $configPath = "F:\AIAPP\Codex\Codex1\data\config.json"
  if (Test-Path $configPath) {
    try {
      $config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
      Add-CdpCandidate $candidates $config.cdp_url
      Add-CdpCandidate $candidates $config.cdpUrl
    } catch {
      # Ignore malformed optional runtime config.
    }
  }

  foreach ($port in @(9222, 9223, 9224, 9225, 9333)) {
    Add-CdpCandidate $candidates "http://127.0.0.1:$port"
  }

  $reachable = [System.Collections.Generic.List[string]]::new()
  foreach ($candidate in $candidates) {
    try {
      $null = Invoke-RestMethod -Uri "$candidate/json/version" -TimeoutSec 2 -ErrorAction Stop
      if (-not $reachable.Contains($candidate)) { $reachable.Add($candidate) | Out-Null }
    } catch {
      continue
    }
  }

  if ($reachable.Count -gt 0) { return $reachable.ToArray() }
  if ($candidates.Count -gt 0) { return @($candidates[0]) }
  return @("http://127.0.0.1:9223")
}

$ResolvedCdpUrls = @(Resolve-CdpCandidates -Preferred $CdpUrl)
if ($CdpUrl) {
  $ResolvedCdpUrls = @((Resolve-CdpUrl -Preferred $CdpUrl))
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw "node.exe was not found on PATH." }

$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) { throw "npm was not found on PATH." }

$script = Join-Path $PSScriptRoot "zhihu_cdp.js"
$skillRoot = Split-Path -Parent $PSScriptRoot
$chromeDidySkill = "F:\AIAPP\Codex\.codex\skills\chrome-control-suite"
$runtimeRoot = if ($env:CHROME_DIDY_PLAYWRIGHT_RUNTIME) { $env:CHROME_DIDY_PLAYWRIGHT_RUNTIME } elseif ([Environment]::GetEnvironmentVariable("CHROME_DIDY_PLAYWRIGHT_RUNTIME", "User")) { [Environment]::GetEnvironmentVariable("CHROME_DIDY_PLAYWRIGHT_RUNTIME", "User") } elseif (Test-Path (Join-Path $chromeDidySkill ".runtime\playwright")) { Join-Path $chromeDidySkill ".runtime\playwright" } else { Join-Path $skillRoot ".runtime\playwright" }
$nodeModules = Join-Path $runtimeRoot "node_modules"
$packageDir = Join-Path $nodeModules "playwright"

if (-not (Test-Path $packageDir)) {
  New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
  & $npm.Source @("install", "--prefix", $runtimeRoot, "--no-audit", "--no-fund", "--no-save", "playwright")
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$oldNodePath = $env:NODE_PATH
$env:NODE_PATH = if ($oldNodePath) { "$nodeModules;$oldNodePath" } else { $nodeModules }

function New-NodeArgs {
  param([string]$CurrentCdpUrl)

  $args = @(
    $script,
    "--mode", $Mode,
    "--cdp-url", $CurrentCdpUrl,
    "--limit", "$Limit",
    "--type", $Type,
    "--sort", $Sort,
    "--max-content", "$MaxContent",
    "--timeout-ms", "$TimeoutMs"
  )

  if ($Query) { $args += @("--query", $Query) }
  if ($Url) { $args += @("--url", $Url) }
  if ($OutJson) { $args += @("--out-json", $OutJson) }
  if ($OutMarkdown) { $args += @("--out-markdown", $OutMarkdown) }
  if ($NewTab) { $args += "--new-tab" }
  return $args
}

function Test-BlockedPayload {
  param([string]$Text)

  try {
    $payload = $Text | ConvertFrom-Json
    if ($payload.ok -eq $false -and ($payload.blocker -or $payload.source -eq "blocked")) { return $true }
    return $false
  } catch {
    return $false
  }
}

try {
  $lastOutput = ""
  $lastExitCode = 1
  for ($index = 0; $index -lt $ResolvedCdpUrls.Count; $index += 1) {
    $currentCdpUrl = $ResolvedCdpUrls[$index]
    $nodeArgs = New-NodeArgs -CurrentCdpUrl $currentCdpUrl
    $output = & $node.Source @nodeArgs 2>&1
    $lastExitCode = $LASTEXITCODE
    $lastOutput = ($output | Out-String).TrimEnd()
    $blocked = Test-BlockedPayload -Text $lastOutput

    if ($lastExitCode -eq 0 -and -not $blocked) {
      if ($lastOutput) { Write-Output $lastOutput }
      exit 0
    }

    if ($CdpUrl -or -not $blocked -or $index -ge ($ResolvedCdpUrls.Count - 1)) {
      if ($lastOutput) { Write-Output $lastOutput }
      exit $lastExitCode
    }
  }

  if ($lastOutput) { Write-Output $lastOutput }
  exit $lastExitCode
} finally {
  $env:NODE_PATH = $oldNodePath
}
