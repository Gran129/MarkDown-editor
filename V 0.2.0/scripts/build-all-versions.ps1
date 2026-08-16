# 打包当前版本的 Windows 安装包与便携版，输出到 releases/
# 用法：在 V 0.2.0 目录执行 .\scripts\build-all-versions.ps1

$ErrorActionPreference = "Stop"
$env:Path = "C:\Program Files\nodejs;" + $env:Path
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$proj = Split-Path -Parent $scriptDir

Set-Location $proj
$env:CARGO_TARGET_DIR = Join-Path $proj "src-tauri\target"

if (-not (Test-Path "node_modules")) {
    npm install
}

Write-Host "Building Windows NSIS installer..." -ForegroundColor Cyan
npm run build:win
if ($LASTEXITCODE -ne 0) { throw "tauri build failed" }

& (Join-Path $scriptDir "collect-windows-release.ps1")

Write-Host ""
Write-Host "Done. Artifacts are in releases/ (repo root) and release/ (this folder)." -ForegroundColor Green
