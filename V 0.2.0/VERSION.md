# V 0.2.0 源码快照

本目录为当前主开发版本源码（应用版本 **0.2.7**）。

- 应用版本：`0.2.7`
- 发行：Windows 安装包联网版 / 便携版本地版。修改 `package.json` / `tauri.conf.json` / `Cargo.toml` 中的版本号并推送后，会自动打 `vX.Y.Z` 标签、打包，并将产物上传到 GitHub Releases。

### v0.2.7
- 设置分为「常规 / 编辑」；代码块支持段落内行内代码、多段落合并为一个代码块
- 修复分栏拖动手柄滚动导致页面错位，以及 Mermaid 11 全局 Syntax error 横幅
- Mermaid 代码块锁定语言，并在每次输入后实时预览（语法不完整时保留上一张正确图）
- 支持 PDF / XMind 预览与编辑；与 Office 共用导入按钮；可新建并原生编辑 XMind
- 打开非 Markdown 文件时关闭语法视窗；阅读=预览，编辑=原生编辑并保存
- 左侧栏新增可调高度的资源栏（笔记隐藏 .resources），支持拖入、拖到正文插入预览与定位
- 文件预览块高亮选中、插入前提示、移除/上下移动/展开收起
- 有序列表：Enter 新建下一项；开头 Backspace 去掉序号并并入上一项；再按一次退出列表

## 使用

在本目录内执行开发与构建：

```powershell
cd "V 0.2.0"
npm install
npm run tauri dev
```

## 安装包

Windows 打包产物位于仓库根目录 [`releases/`](../releases/)：

- `MarkDown-editor_0.2.7_x64-setup.exe` — 安装程序
- `MarkDown-editor_0.2.7_portable.exe` — 便携版
- `INSTALL.zh-CN.txt` — 安装说明

一键打包（Windows）：

```powershell
cd "V 0.2.0"
.\scripts\build-all-versions.ps1
```
