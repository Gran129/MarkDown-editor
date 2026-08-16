# MarkDown 编辑器

跨平台桌面 Markdown 编辑器：**Word 式 WYSIWYG 编辑** + **Obsidian 式 Vault 文件管理**。

仓库：[Gran129/MarkDown-editor](https://github.com/Gran129/MarkDown-editor)

## 下载（Windows v0.2.7）

| 文件 | 类型 | 说明 |
|------|------|------|
| `MarkDown-editor_0.2.7_x64-setup.exe` | 安装包联网版 | 联网时自动检查 GitHub 更新 |
| `MarkDown-editor_0.2.7_portable.exe` | 便携版本地版 | 不参与更新检测，可完全离线 |

安装包发布在 [GitHub Releases v0.2.7](https://github.com/Gran129/MarkDown-editor/releases/tag/v0.2.7)。仓库 [`releases/`](../releases/) 目录含安装说明；本地打包产物也会复制到该目录。

> 需要 **Windows 10/11** 与 **WebView2** 运行时。

## 功能

- Vault 工作区（本地文件夹作为知识库）
- 文件树 CRUD、拖拽移动、多 Tab 编辑
- 三种笔记视图，可随时切换：
  - **语法视图**：编辑原始 Markdown 源码（含 YAML frontmatter）
  - **阅读视图**：只读预览，无法修改正文或元数据
  - **编辑视图**：TipTap Word 式所见即所得，含格式化工具栏
- **Obsidian 式 Markdown**：Wiki 链接 `[[笔记]]`（输入 `[[` 自动补全）、嵌入 `![[笔记]]`（含图片与 Word / Excel / PowerPoint 原文件预览）、标签 `#tag`、标注块 `> [!note]`、任务列表 `- [ ]`、高亮 `==文本==`、数学公式 `$...$` / `$$...$$`、Mermaid 图表
- 大纲面板：按标题层级导航当前笔记
- 查找与替换（Ctrl+H）
- 标签系统 `#tag` + 标签面板筛选
- SQLite FTS5 全文搜索 + Quick Switcher
- Daily Notes 一键创建
- 深色 / 浅色 / 跟随系统主题、设置面板、快捷键
- 崩溃恢复（draft 缓存）
- **v0.2.0** 双发行模式：便携版本地版（离线、不检测更新）/ 安装包联网版（联网检查 GitHub 更新，离线时自动跳过）
- 启动时可记住默认 Vault；欢迎页列出最近打开的知识库
- **项目工作文件夹**：每个 Vault/项目在软件安装目录（便携版为程序所在目录；安装版若该目录不可写则用应用数据目录）下的 `projects/` 中有一份明文工作副本。打开项目时会把已有 `.mdte` / `.mde` / `.md` **解密导入一次**；之后 `Ctrl+S` 只写入该文件夹的 `.md`，不再每次加密。附件放在隐藏的 `.{笔记名}/.resources/`。
- **导出**：顶栏「导出」、文件树右键或 `Ctrl+Shift+E` 从项目工作文件夹导出明文 Markdown（`.md`）或加密格式（`.mdte`，正文 + 引用资源，AES-256-GCM / Argon2id，口令 `Tardis`）。默认保存回你打开的原 Vault 目录。

> 选择 `.mdte` 是为了避开已被占用的 `.mde`（Microsoft Access 编译数据库、GRAPHISOFT Archicad Education 模块）。磁盘头仍使用魔数 `MDE1`，所以旧 `.mde` 包可以继续打开。

> 插件系统与移动端仍在规划中，当前版本未交付。详见 `docs/PLUGINS.md`、`docs/MOBILE.md`。

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面壳 | Tauri 2 (Rust) |
| 前端 | React 19 + TypeScript + Vite |
| 编辑器 | TipTap 2 (ProseMirror) |
| 状态 | Zustand |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| 搜索 | SQLite FTS5 |

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

Windows 一键打包（需在 Windows 上执行，产物写入仓库根目录 `releases/`）：

```powershell
.\scripts\build-all-versions.ps1
```

打 `v*` 标签并推送后，GitHub Actions 会自动构建并把 exe 上传到 GitHub Releases。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+S | 保存到项目工作文件夹（明文 Markdown） |
| Ctrl+Shift+E | 从项目文件夹导出（Markdown 或加密 .mdte） |
| Ctrl+O | 快速切换 |
| Ctrl+Shift+F | 全文搜索 |
| Ctrl+/ | 快捷键帮助 |
| Ctrl+H | 查找与替换（编辑视图） |
| Ctrl+Alt+1 / 2 / 3 | 语法 / 阅读 / 编辑视图 |
| Ctrl+Alt+\ | 循环切换视图 |
| Ctrl+B / I / K | 加粗 / 斜体 / 链接 |
| `[[` | Wiki 链接自动补全 |

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
│       ├── mde.rs       # .mdte 加密编解码与导出
│       ├── project.rs   # 安装目录下的项目工作文件夹
│       ├── vault.rs     # Vault 扫描
│       ├── search.rs    # FTS5 索引
│       └── watcher.rs   # 文件监听
└── .github/workflows/   # CI
```

## 更新记录

> **维护说明**：每次功能变更、缺陷修复或版本发布时，请在本节**最上方**追加条目，并保持与 `package.json` / `Cargo.toml` / `tauri.conf.json` 中的版本号一致。修改这些版本号并推送后，会自动打标签、打包并上传到 GitHub Releases。

### v0.2.7

**发布**

- 安装包：`MarkDown-editor_0.2.7_x64-setup.exe`；便携版：`MarkDown-editor_0.2.7_portable.exe`
- 版本号变更后自动打 `v*` 标签并触发 Windows 打包与 Release 上传

**相对 v0.2.6**

- 设置分为「常规 / 编辑」；代码块支持段落内行内代码、多段落合并为一个代码块
- 修复分栏拖动手柄滚动与 Mermaid 11 全局 Syntax error 横幅
- Mermaid 代码块锁定语言，输入时实时预览（语法不完整时保留上一张正确图）
- 支持 PDF / XMind 预览与编辑；与 Office 共用导入按钮；可新建并原生编辑 XMind
- 打开非 Markdown 文件时关闭语法视窗
- 左侧栏资源栏（笔记 `.resources`）：拖入、拖到正文插入预览与定位
- 文件预览块高亮、插入前提示、移除 / 移动 / 展开收起
- 有序列表 Enter 下一项；项首 Backspace 去掉序号并入上一项，再按一次退出列表

### v0.2.1

**发布**

- Windows 安装包与便携版改由 GitHub Actions 自动构建，上传到 GitHub Releases，说明文件放在仓库 `releases/` 目录
- 安装包：`MarkDown-editor_0.2.1_x64-setup.exe`；便携版：`MarkDown-editor_0.2.1_portable.exe`

**相对 v0.2.0 安装包包含的后续改动**

- 项目工作文件夹：保存明文 `.md`，导出时再选择 Markdown 或加密 `.mdte`
- 笔记内预览 Word / Excel / PowerPoint
- 编辑器界面视觉打磨

### v0.2.0

**新增（编辑增强 · Obsidian 对齐）**

- 任务列表 `- [ ]` / `- [x]`，工具栏一键插入
- 高亮 `==文本==`（Obsidian 语法）
- 标注块（Callout）`> [!note]` 等 8 种类型
- 嵌入语法 `![[笔记/图片/Office 文件]]`
- Wiki 链接输入 `[[` 时自动补全笔记名
- 大纲面板：右侧面板按 H1–H6 跳转
- 查找与替换对话框（Ctrl+H）
- LaTeX 数学公式 `$...$` / `$$...$$`（KaTeX 渲染）
- Mermaid 流程图/图表（代码块实时预览）
- 工具栏扩展：H4、行内代码、Wiki 链接、嵌入、标注、Mermaid、公式

**改进**

- 文件树右键改为标准上下文菜单（新建笔记、新建文件夹、重命名、删除、在资源管理器中显示），不再使用浏览器 `prompt` 输入命令
- 新建/重命名/删除确认改为应用内对话框，交互与整体 UI 一致

**新增**

- **双发行模式**：便携版本地版（离线、不检测更新）/ 安装包联网版（联网检查 GitHub 更新）
- 安装版：启动时检测 GitHub Release，有新版时提示；后台下载，用户确认后于退出时静默安装
- 便携版：通过 `.portable` 标记或文件名识别，完全跳过更新逻辑
- 离线安装版：无网络时跳过检测，下次联网启动再检查
- 设置面板显示当前发行版本（本地版 / 联网版）与网络状态

**修复**

- Wiki 链接 `[[null]]`：修复 `null` 属性在模板字符串中被渲染为文字 "null" 的根因；增加 `data-label` 备份与切换 Tab 时的属性修复
- 右侧面板合并「反链 + 出链」为「链接」Tab（两者方向相反，并非同一概念）
- 左右侧栏支持拖拽调整宽度（含最小/最大限制），宽度自动记忆
- 移除关系图谱功能
- 移除旧版「版本低于 GitHub 最新版时静默卸载」逻辑，避免便携版/误打包二进制闪退
- 修正打包脚本路径，避免产物写入错误的嵌套目录

**后续（本分支）**

- 不再把未交付的插件系统当作已发布功能；移除示例插件与占位面板
- `![[嵌入]]` 真实渲染笔记摘录与图片
- 标签面板改为全库标签，并可过滤文件树
- 查找「全部替换」保留文档结构，不再把全文变成纯文本
- 欢迎页列出最近打开的知识库
- 设置中可填写 Daily Notes 模板，并记住默认 Vault
- 当日日记已存在时直接打开，不再在根目录另建一份
- 顶栏区分快速切换与全文搜索，并补上按钮说明
- 板块引用写入 HTML 属性，并可从当前段落插入
- 快速切换支持模糊匹配笔记名
- 知识库文件变化时重新建立搜索索引并刷新标签
- 主题选择「跟随系统」时会随系统深浅色切换
- macOS/Linux 安装版也能识别以便检查更新
- 增加语法 / 阅读 / 编辑三种视图，可从源码切换到预览或 Word 式编辑
- 打开 Vault 后在软件安装目录 `projects/` 下建立明文工作文件夹；保存只写 `.md`，导出时才从该文件夹加密为 `.mdte`
- 导出时可选择明文 Markdown（`.md`）或加密格式（`.mdte`）；默认保存到原 Vault 目录
- 嵌入 Word / Excel / PowerPoint：工具栏插入 `.docx` / `.xlsx` / `.pptx`（及旧版 `.doc` / `.xls` / `.ppt`）到笔记 `.resources`；阅读/编辑视图按原版式预览页面、工作表与幻灯片；可下载副本，或用 Word / Excel / PowerPoint 打开原文件编辑。旧版二进制格式仍可打开编辑，但不做画布预览。

### v0.1.0

**首发**

- Vault 工作区、文件树 CRUD、多 Tab 编辑
- TipTap WYSIWYG 编辑器与格式化工具栏
- Wiki 双向链接、反向链接 / 出链面板
- 标签系统与全文搜索（SQLite FTS5）、Quick Switcher
- Daily Notes、关系图谱 Graph View（v0.2.0 已移除）
- 深色 / 浅色主题、设置面板、快捷键、崩溃恢复（draft 缓存）
- Windows NSIS 安装包与便携版

## 许可证

MIT
