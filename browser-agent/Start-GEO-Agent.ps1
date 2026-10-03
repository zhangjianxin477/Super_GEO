param(
  [string]$EnrollmentCode,
  [string]$ApiUrl = 'http://127.0.0.1:8787',
  [string]$Label = "$env:COMPUTERNAME · GEO 浏览器代理",
  [switch]$NoBrowser,
  [switch]$KeepBrowser,
  [switch]$OpenBrowser,
  [switch]$Restart,
  [switch]$Diagnostics
)

$ErrorActionPreference = 'Stop'
$agentHome = Split-Path -Parent $PSCommandPath
$localAppData = [Environment]::GetFolderPath('LocalApplicationData')
$programFiles = [Environment]::GetFolderPath('ProgramFiles')
$programFilesX86 = ${env:ProgramFiles(x86)}
$dataHome = Join-Path $localAppData 'GEO Browser Agent'
$legacyProfilePath = Join-Path $dataHome 'edge-profile'
$profileRoot = Join-Path $dataHome 'edge-profiles'
$profilePath = Join-Path $profileRoot 'manual'
$logsPath = Join-Path $dataHome 'logs'
$agentLog = Join-Path $logsPath 'agent.log'
$agentErrorLog = Join-Path $logsPath 'agent.error.log'
New-Item -ItemType Directory -Force -Path $dataHome,$legacyProfilePath,$profileRoot,$profilePath,$logsPath | Out-Null

function Find-Node {
  # Prefer the supported local Node 24 runtime when it is installed. Older system-wide
  # Node installations are kept as a fallback for the lightweight local relay only.
  $candidates = @(
    (Join-Path $localAppData 'Node.js-v24.21.0\node.exe'),
    (Join-Path 'D:\Node.js' 'node.exe'),
    (Join-Path $programFiles 'nodejs\node.exe'),
    $(if ($programFilesX86) { Join-Path $programFilesX86 'nodejs\node.exe' })
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  if (@($candidates).Count -gt 0) { return [string](@($candidates)[0]) }
  $command = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  throw '未找到 Node.js。请安装 Node.js 20.18+ 或 24 LTS 后重试。'
}

function Find-Edge {
  $candidates = @(
    (Join-Path $programFiles 'Microsoft\Edge\Application\msedge.exe'),
    $(if ($programFilesX86) { Join-Path $programFilesX86 'Microsoft\Edge\Application\msedge.exe' }),
    (Join-Path $localAppData 'Microsoft\Edge\Application\msedge.exe')
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  if (@($candidates).Count -gt 0) { return [string](@($candidates)[0]) }
  throw '未找到 Microsoft Edge。请安装 Edge 后重试。'
}

function Test-LocalAgent {
  try {
    return Invoke-RestMethod -Uri 'http://127.0.0.1:23891/v1/health' -TimeoutSec 2
  } catch { return $null }
}

function Stop-LocalAgent {
  try {
    $connection = Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort 23891 -State Listen -ErrorAction Stop | Select-Object -First 1
    if ($connection -and $connection.OwningProcess) {
      Stop-Process -Id $connection.OwningProcess -Force -ErrorAction Stop
      Start-Sleep -Milliseconds 450
    }
  } catch { }
}

function Stop-ControlledEdge {
  # Close only Edge processes using this product's isolated profiles. Ask Edge to
  # close its own windows first: force-killing it writes a crash marker and the next
  # platform launch can be blocked by the browser-level “restore pages” dialog.
  $processes = @()
  $controlledProfiles = @($legacyProfilePath, $profileRoot) | Where-Object { $_ }
  try {
    $processes = @(Get-CimInstance -ClassName Win32_Process -ErrorAction SilentlyContinue | Where-Object {
      if ($_.Name -ne 'msedge.exe' -or -not $_.CommandLine) { return $false }
      foreach ($controlledProfile in $controlledProfiles) {
        if ($_.CommandLine.IndexOf($controlledProfile, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { return $true }
      }
      return $false
    })
  } catch { $processes = @() }

  foreach ($process in $processes) {
    try {
      $nativeProcess = [System.Diagnostics.Process]::GetProcessById($process.ProcessId)
      if (-not $nativeProcess.HasExited) { [void]$nativeProcess.CloseMainWindow() }
    } catch { }
  }
  if ($processes.Count -gt 0) {
    Start-Sleep -Milliseconds 1600
    $remaining = @($processes | Where-Object {
      try { -not [System.Diagnostics.Process]::GetProcessById($_.ProcessId).HasExited } catch { $false }
    })
    foreach ($process in $remaining) {
      try { Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop } catch { }
    }
    if ($remaining.Count -gt 0) { Write-Host '少数受控 GEO Edge 进程未响应，已在等待后关闭以加载新版扩展。' -ForegroundColor Yellow }
    Start-Sleep -Milliseconds 500
  }
}
$expectedAgentVersion = '0.3.25'
# Diagnostics are loopback-only and opt-in. They exist solely to verify page/extension hand-off
# without accessing credentials, cookies, or sending full page contents anywhere.
if ($Diagnostics) { $env:GEO_BROWSER_DIAGNOSTICS = '1' } else { Remove-Item Env:GEO_BROWSER_DIAGNOSTICS -ErrorAction SilentlyContinue }
$node = Find-Node
$health = Test-LocalAgent
# The relay can remain alive after an upgrade. Restart only this localhost relay when its
# version differs, so the updated extension and metadata contract are used together.
if ($health -and ($Restart -or $health.version -ne $expectedAgentVersion)) {
  $restartReason = if ($Restart) { '已请求重启' } else { "检测到旧版 v$($health.version)" }
  Write-Host "$restartReason，正在安全启动 GEO 本地 Agent v$expectedAgentVersion…" -ForegroundColor Yellow
  # The old service worker remains loaded until its controlled profile exits. Close only
  # GEO-owned profiles, then restart the localhost relay from this installation.
  Stop-ControlledEdge
  Stop-LocalAgent
  $health = $null
}
$configPath = Join-Path $env:USERPROFILE '.geo-browser-agent\config.json'

function Read-SetupValue {
  param(
    [string]$Prompt,
    [string]$Title,
    [string]$DefaultValue = ''
  )
  try {
    Add-Type -AssemblyName Microsoft.VisualBasic -ErrorAction Stop
    return [Microsoft.VisualBasic.Interaction]::InputBox($Prompt, $Title, $DefaultValue)
  } catch {
    $value = Read-Host "$Title - $Prompt"
    return $value
  }
}

if (-not (Test-Path -LiteralPath $configPath)) {
  Write-Host '这是此电脑的首次 GEO Local Agent 配对。只需完成一次。' -ForegroundColor Cyan
  if (-not $EnrollmentCode) {
    $EnrollmentCode = Read-SetupValue -Title '配对 GEO Local Agent' -Prompt '请从 GEO 系统的「Harness 管理 > 添加设备」复制一次性配对码，然后粘贴到这里：'
  }
  if ([string]::IsNullOrWhiteSpace($EnrollmentCode)) {
    throw '未输入配对码。请在 GEO 系统创建一次性配对码后，再双击此文件重试。'
  }
  if ($ApiUrl -eq 'http://127.0.0.1:8787') {
    $selectedApiUrl = Read-SetupValue -Title '确认 GEO 系统地址' -Prompt '确认 GEO 系统地址。当前本机测试可直接保留默认值；部署给同事时请输入企业 GEO 系统地址：' -DefaultValue $ApiUrl
    if ([string]::IsNullOrWhiteSpace($selectedApiUrl)) { throw '未填写 GEO 系统地址。请重新双击启动文件后完成配对。' }
    $ApiUrl = $selectedApiUrl.Trim()
  }
  if ([string]::IsNullOrWhiteSpace($Label) -or $Label -eq "$env:COMPUTERNAME · GEO 浏览器代理") {
    $selectedLabel = Read-SetupValue -Title '命名此设备' -Prompt '请为本浏览器代理命名（例如：张三的 Windows 浏览器）：' -DefaultValue $Label
    if (-not [string]::IsNullOrWhiteSpace($selectedLabel)) { $Label = $selectedLabel.Trim() }
  }
  & $node (Join-Path $agentHome 'agent.mjs') enroll --api $ApiUrl --code $EnrollmentCode --label $Label
  if ($LASTEXITCODE -ne 0) { throw '本地 GEO Agent 配对失败。请确认一次性配对码尚未过期、系统地址可访问，并重试。' }
}

if (-not $health) {
  Start-Process -WindowStyle Hidden -FilePath $node -WorkingDirectory $agentHome -ArgumentList @('agent.mjs','start') -RedirectStandardOutput $agentLog -RedirectStandardError $agentErrorLog
  for ($attempt = 0; $attempt -lt 10 -and -not $health; $attempt++) {
    Start-Sleep -Milliseconds 600
    $health = Test-LocalAgent
  }
}
if (-not $health) { throw "本地 Agent 未成功启动。请查看日志：$agentErrorLog" }

Write-Host 'GEO 本地 Agent 已在线。' -ForegroundColor Green
Write-Host '本地状态：http://127.0.0.1:23891/v1/health'
Write-Host "日志目录：$logsPath"

if ($OpenBrowser -and -not $NoBrowser) {
  if (-not $KeepBrowser) { Stop-ControlledEdge }
  $edge = Find-Edge
  $extensionPath = Join-Path $agentHome 'extension'
  $arguments = @(
    "--user-data-dir=`"$profilePath`"",
    "--disable-extensions-except=`"$extensionPath`"",
    "--load-extension=`"$extensionPath`"",
    '--disable-session-crashed-bubble',
    '--no-first-run',
    '--no-default-browser-check',
    '--new-window',
    'https://www.doubao.com/chat/'
  )
  Start-Process -FilePath $edge -ArgumentList $arguments
  Write-Host '已手动打开新的受控 Edge 窗口并直达豆包。请在该窗口登录；扩展已自动加载。' -ForegroundColor Cyan
} else {
  Write-Host '浏览器不会在启动器中自动打开；请回到 GEO 系统的测试批次，点击「启动本地自动采集」。系统会按本次授权打开受控浏览器并自动执行。' -ForegroundColor Cyan
}





