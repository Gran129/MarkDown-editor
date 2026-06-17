# 在本机 PowerShell 中运行此脚本，创建 GitHub 仓库并推送源码
# 用法：右键「使用 PowerShell 运行」，或在项目目录执行： .\scripts\publish-github.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ProjectRoot

$env:Path = "C:\Program Files\Git\cmd;C:\Program Files\GitHub CLI;" + $env:Path

Write-Host "检查 GitHub 登录状态..." -ForegroundColor Cyan
gh auth status
if ($LASTEXITCODE -ne 0) {
    Write-Host "请先登录 GitHub CLI：" -ForegroundColor Yellow
    gh auth login --hostname github.com --git-protocol https --web
}

git branch -M main

Write-Host "创建仓库 MarkDown编辑器 并推送..." -ForegroundColor Cyan
gh repo create "MarkDown-editor" `
    --public `
    --description "Word式Markdown编辑器，Obsidian式Vault文件管理（Tauri 2 + React + TipTap）" `
    --source=. `
    --remote=origin `
    --push

if ($LASTEXITCODE -eq 0) {
    $url = gh repo view --json url -q .url
    Write-Host "`n完成！仓库地址：" -ForegroundColor Green
    Write-Host $url
} else {
    Write-Host "`n若仓库已存在，可手动推送：" -ForegroundColor Yellow
    Write-Host '  git remote add origin https://github.com/你的用户名/MarkDown编辑器.git'
    Write-Host "  git push -u origin main"
}
