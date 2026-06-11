param(
  [string]$OutputRoot = "release",
  [string]$RuntimeNodePath
)

$ErrorActionPreference = "Stop"

function New-CleanDirectory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Copy-PackageItem {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Source,
    [Parameter(Mandatory = $true)]
    [string]$Destination
  )

  Copy-Item -LiteralPath $Source -Destination $Destination -Recurse -Force
}

function Resolve-NodeRuntimePath {
  param(
    [string]$ConfiguredPath
  )

  if ($ConfiguredPath) {
    if (-not (Test-Path -LiteralPath $ConfiguredPath)) {
      throw "Configured Node runtime was not found: $ConfiguredPath"
    }

    return (Resolve-Path -LiteralPath $ConfiguredPath).Path
  }

  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCommand -and $nodeCommand.Source -and (Test-Path -LiteralPath $nodeCommand.Source)) {
    return $nodeCommand.Source
  }

  throw "Node runtime was not found. Pass -RuntimeNodePath or make sure node.exe is available on PATH."
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$packageName = "quality-inspection-board-win-x64-$timestamp"
$releaseRoot = Join-Path $projectRoot $OutputRoot
$packageRoot = Join-Path $releaseRoot $packageName
$zipPath = Join-Path $releaseRoot "$packageName.zip"

$RuntimeNodePath = Resolve-NodeRuntimePath -ConfiguredPath $RuntimeNodePath

New-CleanDirectory -Path $releaseRoot
New-CleanDirectory -Path $packageRoot

$itemsToCopy = @(
  "server.js",
  "package.json",
  "package-lock.json",
  "public",
  "server",
  "node_modules",
  "samples"
)

foreach ($item in $itemsToCopy) {
  $sourcePath = Join-Path $projectRoot $item
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Missing package item: $item"
  }

  Copy-PackageItem -Source $sourcePath -Destination $packageRoot
}

New-Item -ItemType Directory -Path (Join-Path $packageRoot "data") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageRoot "data\uploads") -Force | Out-Null

Copy-Item -LiteralPath $RuntimeNodePath -Destination (Join-Path $packageRoot "node.exe") -Force

$startScript = @(
  "@echo off",
  "setlocal",
  "cd /d ""%~dp0""",
  "start ""Quality Inspection Board Server"" ""%~dp0node.exe"" ""%~dp0server.js""",
  "echo Quality Inspection Board server started.",
  "echo TV page: http://localhost:8094/tv.html",
  "echo Import page: http://localhost:8094/import.html",
  "echo Health: http://localhost:8094/health",
  "pause"
) -join [Environment]::NewLine

$stopScript = @(
  "@echo off",
  "taskkill /FI ""WINDOWTITLE eq Quality Inspection Board Server"" /T /F",
  "if errorlevel 1 (",
  "  echo No running Quality Inspection Board Server window was found.",
  ") else (",
  "  echo Quality Inspection Board Server stopped.",
  ")",
  "pause"
) -join [Environment]::NewLine

$hiddenRunnerScript = @(
  '$ErrorActionPreference = "Stop"',
  '$root = Split-Path -Parent $MyInvocation.MyCommand.Path',
  'Set-Location -LiteralPath $root',
  '$logDir = Join-Path $root "logs"',
  'New-Item -ItemType Directory -Path $logDir -Force | Out-Null',
  '$env:PORT = if ($env:PORT) { $env:PORT } else { "8094" }',
  '$stdoutLog = Join-Path $logDir "server-out.log"',
  '$stderrLog = Join-Path $logDir "server-error.log"',
  '& (Join-Path $root "node.exe") (Join-Path $root "server.js") 1>> $stdoutLog 2>> $stderrLog'
) -join [Environment]::NewLine

$installTaskScript = @(
  '$ErrorActionPreference = "Stop"',
  '$taskName = "QualityInspectionBoard"',
  '$root = Split-Path -Parent $MyInvocation.MyCommand.Path',
  '$runner = Join-Path $root "run-server-hidden.ps1"',
  '$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)',
  'if (-not $isAdmin) { throw "Please run this script as Administrator." }',
  'if (-not (Test-Path -LiteralPath $runner)) { throw "Missing runner script: $runner" }',
  '$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$runner"""',
  '$trigger = New-ScheduledTaskTrigger -AtStartup',
  '$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest',
  '$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Seconds 0)',
  'Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Quality Inspection Board background service task" -Force | Out-Null',
  'Start-ScheduledTask -TaskName $taskName',
  'Write-Host "Installed and started scheduled task: $taskName"',
  'Write-Host "TV page: http://localhost:8094/tv.html"',
  'Write-Host "Import page: http://localhost:8094/import.html"',
  'Write-Host "Health: http://localhost:8094/health"'
) -join [Environment]::NewLine

$uninstallTaskScript = @(
  '$ErrorActionPreference = "Stop"',
  '$taskName = "QualityInspectionBoard"',
  '$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)',
  'if (-not $isAdmin) { throw "Please run this script as Administrator." }',
  '$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue',
  'if ($task) {',
  '  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue',
  '  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false',
  '  Write-Host "Uninstalled scheduled task: $taskName"',
  '} else {',
  '  Write-Host "Scheduled task was not found: $taskName"',
  '}'
) -join [Environment]::NewLine

$statusTaskScript = @(
  '$ErrorActionPreference = "Continue"',
  '$taskName = "QualityInspectionBoard"',
  '$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue',
  'if ($task) {',
  '  $info = Get-ScheduledTaskInfo -TaskName $taskName',
  '  Write-Host "TaskName: $taskName"',
  '  Write-Host "State: $($task.State)"',
  '  Write-Host "LastRunTime: $($info.LastRunTime)"',
  '  Write-Host "LastTaskResult: $($info.LastTaskResult)"',
  '} else {',
  '  Write-Host "Scheduled task is not installed: $taskName"',
  '}',
  'try {',
  '  $health = Invoke-RestMethod -Uri "http://localhost:8094/health" -TimeoutSec 3',
  '  Write-Host "Health: ok=$($health.ok), service=$($health.service), db=$($health.db)"',
  '} catch {',
  '  Write-Host "Health check failed: $($_.Exception.Message)"',
  '}'
) -join [Environment]::NewLine

$installTaskCmd = @(
  "@echo off",
  "powershell -NoProfile -ExecutionPolicy Bypass -File ""%~dp0install-startup-task.ps1""",
  "pause"
) -join [Environment]::NewLine

$uninstallTaskCmd = @(
  "@echo off",
  "powershell -NoProfile -ExecutionPolicy Bypass -File ""%~dp0uninstall-startup-task.ps1""",
  "pause"
) -join [Environment]::NewLine

$statusTaskCmd = @(
  "@echo off",
  "powershell -NoProfile -ExecutionPolicy Bypass -File ""%~dp0status-startup-task.ps1""",
  "pause"
) -join [Environment]::NewLine

$readme = @(
  "Quality Inspection Board Windows Package",
  "",
  "How to run:",
  "Option A - production background startup:",
  "1. Right-click install-startup-task.cmd and choose Run as administrator.",
  "2. The app will run hidden as a Windows Scheduled Task named QualityInspectionBoard.",
  "3. It will start automatically when Windows starts.",
  "",
  "Option B - manual foreground startup:",
  "1. Double-click start-server.cmd.",
  "",
  "Open in your browser:",
  "   - TV board: http://localhost:8094/tv.html",
  "   - Import page: http://localhost:8094/import.html",
  "   - Health check: http://localhost:8094/health",
  "",
  "Notes:",
  "- This folder already includes the Node runtime.",
  "- The database file is stored at data/quality-inspection-board.db.",
  "- Uploaded files are cached in data/uploads.",
  "- Background logs are stored in logs/server-out.log and logs/server-error.log.",
  "- A seed import workbook is included at samples/quality-inspection-seed.xlsx.",
  "- To check background status, run status-startup-task.cmd.",
  "- To remove background startup, right-click uninstall-startup-task.cmd and choose Run as administrator.",
  "- To stop a manual foreground run, double-click stop-server.cmd or close the console window named ""Quality Inspection Board Server""."
) -join [Environment]::NewLine

Set-Content -LiteralPath (Join-Path $packageRoot "start-server.cmd") -Value $startScript -Encoding ASCII
Set-Content -LiteralPath (Join-Path $packageRoot "stop-server.cmd") -Value $stopScript -Encoding ASCII
Set-Content -LiteralPath (Join-Path $packageRoot "run-server-hidden.ps1") -Value $hiddenRunnerScript -Encoding UTF8
Set-Content -LiteralPath (Join-Path $packageRoot "install-startup-task.ps1") -Value $installTaskScript -Encoding UTF8
Set-Content -LiteralPath (Join-Path $packageRoot "uninstall-startup-task.ps1") -Value $uninstallTaskScript -Encoding UTF8
Set-Content -LiteralPath (Join-Path $packageRoot "status-startup-task.ps1") -Value $statusTaskScript -Encoding UTF8
Set-Content -LiteralPath (Join-Path $packageRoot "install-startup-task.cmd") -Value $installTaskCmd -Encoding ASCII
Set-Content -LiteralPath (Join-Path $packageRoot "uninstall-startup-task.cmd") -Value $uninstallTaskCmd -Encoding ASCII
Set-Content -LiteralPath (Join-Path $packageRoot "status-startup-task.cmd") -Value $statusTaskCmd -Encoding ASCII
Set-Content -LiteralPath (Join-Path $packageRoot "README-DEPLOY.txt") -Value $readme -Encoding UTF8

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $packageRoot "*") -DestinationPath $zipPath -CompressionLevel Optimal -Force

Write-Host "Package directory: $packageRoot"
Write-Host "Package archive: $zipPath"
