# 按版本打包 Windows 安装包，输出到各版本目录下的 release/
# 用法：在 V 0.2.0 目录执行 .\scripts\build-all-versions.ps1

$ErrorActionPreference = "Stop"
$env:Path = "C:\Program Files\nodejs;" + $env:Path
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent (Split-Path -Parent $scriptDir)

function Build-Version {
    param(
        [string]$VerFolder,
        [string]$Ver
    )

    $proj = Join-Path $root $VerFolder
    $releaseDir = Join-Path $proj "release"
    $targetDir = Join-Path $proj "src-tauri\target"
    New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

    $env:CARGO_TARGET_DIR = $targetDir

    Write-Host "`n========== [$VerFolder] v$Ver ==========" -ForegroundColor Cyan
    Set-Location $proj

    if (-not (Test-Path "node_modules")) {
        npm install
    }

    npm run build:win

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
    if (-not $setup) { throw "NSIS setup not found ($VerFolder)" }

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

    $setupDest = Join-Path $releaseDir "MarkDown-editor_${Ver}_x64-setup.exe"
    Copy-Item $setup.FullName $setupDest -Force
    Write-Host "Setup: $setupDest" -ForegroundColor Green

    if ($portable) {
        $portableDest = Join-Path $releaseDir "MarkDown-editor_${Ver}_portable.exe"
        Copy-Item $portable.FullName $portableDest -Force
        Write-Host "Portable: $portableDest" -ForegroundColor Green

        if ($Ver -eq "0.2.0") {
            $marker = Join-Path $releaseDir "MarkDown-editor.portable"
            Set-Content -Path $marker -Value "portable-local-edition" -Encoding ASCII -NoNewline
            Write-Host "Portable marker: $marker" -ForegroundColor Green
        }
    }

    $verifyExe = Join-Path $releaseDir "MarkDown-editor_${Ver}_portable.exe"
    $fileVer = (Get-Item $verifyExe).VersionInfo.FileVersion
    if ($fileVer -ne $Ver) {
        throw "Version mismatch: expected $Ver but built $fileVer ($VerFolder)"
    }
    $blob = [System.Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($verifyExe))
    if ($Ver -eq "0.1.0" -and $blob.Contains("check_for_updates")) {
        throw "v0.1.0 package incorrectly contains updater code"
    }

    Get-ChildItem $releaseDir | Format-Table Name, @{N='SizeMB';E={[math]::Round($_.Length/1MB,2)}} -AutoSize
}

Build-Version "V 0.1.0" "0.1.0"
Build-Version "V 0.2.0" "0.2.0"

Write-Host ""
Write-Host "Done. Artifacts are in each version's release/ folder." -ForegroundColor Green
