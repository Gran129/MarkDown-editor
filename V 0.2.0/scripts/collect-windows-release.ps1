# 将 Tauri Windows 产物收集到仓库根目录 releases/ 与本目录 release/
# 在 V 0.2.0 目录执行： .\scripts\collect-windows-release.ps1

$ErrorActionPreference = "Stop"

$proj = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $proj

$confPath = Join-Path $proj "src-tauri\tauri.conf.json"
$conf = Get-Content $confPath -Raw | ConvertFrom-Json
$ver = [string]$conf.version
if (-not $ver) { throw "Cannot read version from tauri.conf.json" }

$repoRoot = Split-Path -Parent $proj
$releaseDir = Join-Path $proj "release"
$releasesDir = Join-Path $repoRoot "releases"
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
New-Item -ItemType Directory -Force -Path $releasesDir | Out-Null

$targetDir = if ($env:CARGO_TARGET_DIR) { $env:CARGO_TARGET_DIR } else { Join-Path $proj "src-tauri\target" }

$bundleDirs = @(
    Join-Path $targetDir "x86_64-pc-windows-msvc\release\bundle\nsis"
    Join-Path $targetDir "release\bundle\nsis"
)

$setup = $null
foreach ($dir in $bundleDirs) {
    if (Test-Path $dir) {
        $setup = Get-ChildItem $dir -Filter "*setup.exe" | Select-Object -First 1
        if ($setup) { break }
    }
}
if (-not $setup) { throw "NSIS setup.exe not found under $targetDir" }

$portableDirs = @(
    Join-Path $targetDir "x86_64-pc-windows-msvc\release"
    Join-Path $targetDir "release"
)
$portable = $null
foreach ($dir in $portableDirs) {
    if (Test-Path $dir) {
        $portable = Get-ChildItem $dir -Filter "*.exe" |
            Where-Object { $_.Name -notmatch "setup|wix|installer" } |
            Select-Object -First 1
        if ($portable) { break }
    }
}
if (-not $portable) { throw "Portable exe not found under $targetDir" }

$setupName = "MarkDown-editor_${ver}_x64-setup.exe"
$portableName = "MarkDown-editor_${ver}_portable.exe"

foreach ($destRoot in @($releaseDir, $releasesDir)) {
    Copy-Item $setup.FullName (Join-Path $destRoot $setupName) -Force
    Copy-Item $portable.FullName (Join-Path $destRoot $portableName) -Force
    Set-Content -Path (Join-Path $destRoot "MarkDown-editor.portable") -Value "portable-local-edition" -Encoding ASCII -NoNewline
}

$installSrc = Join-Path $releasesDir "INSTALL.zh-CN.txt"
if (Test-Path $installSrc) {
    Copy-Item $installSrc (Join-Path $releaseDir "INSTALL.zh-CN.txt") -Force
}

Write-Host "Collected Windows artifacts for v$ver" -ForegroundColor Green
Write-Host "  $releasesDir\$setupName"
Write-Host "  $releasesDir\$portableName"
Get-ChildItem $releasesDir | Format-Table Name, @{N = "SizeMB"; E = { [math]::Round($_.Length / 1MB, 2) } } -AutoSize
