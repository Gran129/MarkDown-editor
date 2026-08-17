# V 0.2.0 源码快照

本目录为当前主开发版本源码（应用版本 **0.2.11**）。

- 应用版本：`0.2.11`
- 发行：Windows 安装包联网版 / 便携版本地版。修改 `package.json` / `tauri.conf.json` / `Cargo.toml` 中的版本号并推送后，会自动打 `vX.Y.Z` 标签、打包，并将产物上传到 GitHub Releases。
- 完整版本记录见仓库根目录 [`CHANGELOG.md`](../CHANGELOG.md)。

### v0.2.11
- 同步区块移到插入栏；题目类型一键插入；新增判断题
- 修复选中文本创建同步区块被上一段覆盖；支持父子级与三层嵌套
- 同步区块可复制、转为普通、删除
- 拆分合并单元格保留内容；删除行/列图标更明确
- 聚焦题目时再插入不会覆盖；代码块不再泄漏区块 HTML
- 修复反链不显示；快速切换图标调整

## 使用

在本目录内执行开发与构建：

```powershell
cd "V 0.2.0"
npm install
npm run tauri dev
```

## 安装包

Windows 打包产物位于仓库根目录 [`releases/`](../releases/)：

- `MarkDown-editor_0.2.11_x64-setup.exe` — 安装程序
- `MarkDown-editor_0.2.11_portable.exe` — 便携版
- `INSTALL.zh-CN.txt` — 安装说明

一键打包（Windows）：

```powershell
cd "V 0.2.0"
.\scripts\build-all-versions.ps1
```
