# V 0.2.0 源码快照

本目录为当前主开发版本源码（应用版本 **0.2.10**）。

- 应用版本：`0.2.10`
- 发行：Windows 安装包联网版 / 便携版本地版。修改 `package.json` / `tauri.conf.json` / `Cargo.toml` 中的版本号并推送后，会自动打 `vX.Y.Z` 标签、打包，并将产物上传到 GitHub Releases。
- 完整版本记录见仓库根目录 [`CHANGELOG.md`](../CHANGELOG.md)。

### v0.2.10
- 资源栏：拖入后显示定位图标；可移除文件
- 题目：编辑预览不判分，阅读按设置作答；切回编辑清除作答
- 题目图片可插在题干/选项，数量不限，宽度可调
- 工具栏分组调整；行内代码只走设置中的代码块按钮
- 连线题可视化连线；提交作答仅在阅读+判分+已导入答案时出现
- 导入答案改为点选/填空/连线，不必输入 ID
- 填空题「插入填空」；同步区块空段落 Enter 跳出
- 题目展开/收起；语法视图目录跳转更准确
- 题目源码改为 `:::question` 语法
- 安装版设置页可手动检查更新；Release 汇总历史说明

## 使用

在本目录内执行开发与构建：

```powershell
cd "V 0.2.0"
npm install
npm run tauri dev
```

## 安装包

Windows 打包产物位于仓库根目录 [`releases/`](../releases/)：

- `MarkDown-editor_0.2.10_x64-setup.exe` — 安装程序
- `MarkDown-editor_0.2.10_portable.exe` — 便携版
- `INSTALL.zh-CN.txt` — 安装说明

一键打包（Windows）：

```powershell
cd "V 0.2.0"
.\scripts\build-all-versions.ps1
```
