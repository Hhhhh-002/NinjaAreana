param(
    [ValidateSet('dev', 'build', 'test', 'preview', 'install')]
    [string]$Mode = 'dev'
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

# Only the current PowerShell process uses this runtime. System PATH stays unchanged.
$taskNodeCommand = Get-Command node -ErrorAction SilentlyContinue
$taskCandidates = @(
    $(if ($taskNodeCommand) { $taskNodeCommand.Source }),
    $(Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe')
)
$taskNodePath = $null
foreach ($taskCandidate in $taskCandidates) {
    if ($taskCandidate -and (Test-Path -LiteralPath $taskCandidate)) {
        $taskSupported = & $taskCandidate -p "Number(process.versions.node.split('.')[0]) > 22 || (Number(process.versions.node.split('.')[0]) === 22 && Number(process.versions.node.split('.')[1]) >= 12)"
        if ($taskSupported -eq 'true') { $taskNodePath = $taskCandidate; break }
    }
}
if (!$taskNodePath) { throw 'Please install Node.js 22.12+ (24 LTS recommended), then run this script again.' }
$taskNpmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (!$taskNpmCommand) { throw 'npm.cmd was not found. Please install Node.js with npm.' }
$taskNpmCli = Join-Path (Split-Path $taskNpmCommand.Source) 'node_modules\npm\bin\npm-cli.js'
if (!(Test-Path -LiteralPath $taskNpmCli)) { throw "npm CLI not found: $taskNpmCli" }
$env:Path = (Split-Path $taskNodePath) + ';' + $env:Path
Write-Host "Runtime: $taskNodePath"
if ($Mode -eq 'install' -or !(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules'))) {
    & $taskNodePath $taskNpmCli ci
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
if ($Mode -ne 'install') {
    & $taskNodePath $taskNpmCli run $Mode
    exit $LASTEXITCODE
}
