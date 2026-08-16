# V 0.2.0 源码快照

本目录为当前主开发版本源码（应用版本 **0.2.1**）。

- 应用版本：`0.2.1`
- 发行：Windows 安装包联网版 / 便携版本地版，由 GitHub Actions 构建并上传到 GitHub Releases

## 使用

在本目录内执行开发与构建：

```powershell
cd "V 0.2.0"
npm install
npm run tauri dev
```

## 安装包

Windows 打包产物位于仓库根目录 [`releases/`](../releases/)：

- `MarkDown-editor_0.2.1_x64-setup.exe` — 安装程序
- `MarkDown-editor_0.2.1_portable.exe` — 便携版
- `INSTALL.zh-CN.txt` — 安装说明

一键打包（Windows）：

```powershell
cd "V 0.2.0"
.\scripts\build-all-versions.ps1
```
