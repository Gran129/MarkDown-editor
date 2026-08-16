# Windows 发行包

本目录存放 **Windows 安装包说明** 与便携版标记。实际 `.exe` 由 GitHub Actions 在打 `v*` 标签后构建，并上传到 [GitHub Releases](https://github.com/Gran129/MarkDown-editor/releases)，不会提交进 Git。

## 当前版本 v0.2.7

| 文件 | 类型 | 说明 |
|------|------|------|
| `MarkDown-editor_0.2.7_x64-setup.exe` | 安装包联网版 | 双击安装到电脑，联网时检查更新 |
| `MarkDown-editor_0.2.7_portable.exe` | 便携版本地版 | 免安装，可完全离线 |
| `MarkDown-editor.portable` | 标记文件 | 与便携版 exe 放在同一目录 |
| `INSTALL.zh-CN.txt` | 说明 | 中文安装说明 |

下载地址：<https://github.com/Gran129/MarkDown-editor/releases/tag/v0.2.7>

## 本地打包（在 Windows 上）

```powershell
cd "V 0.2.0"
npm ci
.\scripts\build-all-versions.ps1
```

产物会复制到仓库根目录 `releases/` 以及 `V 0.2.0/release/`。
