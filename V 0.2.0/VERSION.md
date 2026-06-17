# V 0.2.0 源码快照

本目录为 **v0.2.0 自动更新功能开发完成之后** 的完整项目源码（**当前主开发版本**）。

- 应用版本：`0.2.0`
- 新增功能：
  - **双发行模式**：便携版本地版 / 安装包联网版
  - 便携版：不参与 GitHub 更新检测，可完全离线
  - 安装版：联网时检查 GitHub Release 并提示更新；离线时跳过检测，下次联网启动再检查
  - 后台下载安装包，用户确认后于退出时静默安装（NSIS `/S`）

## 使用

在本目录内执行开发与构建：

```powershell
cd "V 0.2.0"
npm install
npm run tauri dev
```

## 安装包

Windows 打包产物位于本目录 `release/`：

- `MarkDown-editor_0.2.0_x64-setup.exe` — 安装程序
- `MarkDown-editor_0.2.0_portable.exe` — 便携版
- `INSTALL.zh-CN.txt` — 安装说明

一键打包两个版本：

```powershell
cd "V 0.2.0"
.\scripts\build-all-versions.ps1
```
