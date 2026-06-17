# MarkDown 编辑器

跨平台桌面 Markdown 编辑器：**Word 式 WYSIWYG 编辑** + **Obsidian 式 Vault 文件管理**。

仓库：[Gran129/MarkDown-editor](https://github.com/Gran129/MarkDown-editor)

## 下载（Windows）

| 文件 | 说明 |
|------|------|
| [MarkDown-editor_0.1.0_x64-setup.exe](https://github.com/Gran129/MarkDown-editor/releases/latest/download/MarkDown-editor_0.1.0_x64-setup.exe) | NSIS 安装程序（推荐） |
| [MarkDown-editor_0.1.0_portable.exe](https://github.com/Gran129/MarkDown-editor/releases/latest/download/MarkDown-editor_0.1.0_portable.exe) | 便携版，免安装 |
| [INSTALL.zh-CN.txt](https://github.com/Gran129/MarkDown-editor/releases/latest/download/INSTALL.zh-CN.txt) | 安装说明 |

> 需要 **Windows 10/11** 与 **WebView2** 运行时。首次运行若出现 SmartScreen 提示，请选择「更多信息 → 仍要运行」。
## 功能

- Vault 工作区（本地文件夹作为知识库）
- 文件树 CRUD、拖拽移动、多 Tab 编辑
- TipTap WYSIWYG 编辑器 + 格式化工具栏
- Wiki 双向链接 `[[笔记]]`、反向链接 / 出链面板
- 标签系统 `#tag` + 标签面板筛选
- SQLite FTS5 全文搜索 + Quick Switcher
- Daily Notes 一键创建
- 关系图谱 Graph View
- 深色 / 浅色主题、设置面板、快捷键
- 崩溃恢复（draft 缓存）
- 插件 API 预留（后期扩展）
- 移动端规划（Tauri Mobile，后期）

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面壳 | Tauri 2 (Rust) |
| 前端 | React 19 + TypeScript + Vite |
| 编辑器 | TipTap 2 (ProseMirror) |
| 状态 | Zustand |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| 搜索 | SQLite FTS5 |
| 图谱 | @xyflow/react |

## 环境要求

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://www.rust-lang.org/tools/install)
- Windows: WebView2（Win10+ 自带）
- Linux: `webkit2gtk` 等依赖
- macOS: Xcode Command Line Tools

## 开发

```bash
# 安装依赖
npm install

# 启动开发模式（前端 + Tauri）
npm run tauri dev

# 仅前端
npm run dev

# 类型检查
npm run typecheck

# Lint
npm run lint
```

## 构建

```bash
npm run tauri build
```

产物位于 `src-tauri/target/release/bundle/`：

- Windows: NSIS 安装包（`.exe`）+ 便携版
- macOS: `.dmg` / `.app`
- Linux: `.AppImage` / `.deb`

Windows 一键打包：

```bash
npm run build:win
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+S | 保存 |
| Ctrl+O | 快速切换 |
| Ctrl+Shift+F | 全文搜索 |
| Ctrl+/ | 快捷键帮助 |
| Ctrl+B / I / K | 加粗 / 斜体 / 链接 |

## 项目结构

```
├── src/                 # React 前端
│   ├── components/      # UI 组件
│   ├── extensions/      # TipTap 扩展
│   ├── stores/          # Zustand 状态
│   └── lib/             # 工具函数
├── src-tauri/           # Rust 后端
│   └── src/
│       ├── commands.rs  # IPC 命令
│       ├── vault.rs     # Vault 扫描
│       ├── search.rs    # FTS5 索引
│       └── watcher.rs   # 文件监听
└── .github/workflows/   # CI
```

## 许可证

MIT
