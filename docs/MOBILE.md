# 移动端规划（阶段 8）

第一版仅交付桌面三端（Windows / macOS / Linux）。移动端为后续迭代。

## 推荐方案：Tauri Mobile

Tauri 2 已支持 iOS / Android，可与桌面共享 Rust 后端：

- `src-tauri/` 中 Vault、搜索、文件 IO 逻辑复用
- 前端 UI 简化为单栏：文件列表 + 编辑器
- 暂不移植：关系图谱、插件系统

## 备选方案：React Native

- 共享 `@shared/editor-core` 包（TipTap 配置 + Markdown 工具）
- Rust 逻辑通过 FFI 或独立 API 服务暴露

## 移动端 MVP 范围

- [ ] 打开 Vault（本地目录 / iCloud / SAF）
- [ ] 文件列表 + 编辑 + 保存
- [ ] Wiki 链接跳转
- [ ] 全文搜索（简化版）
- [ ] 深色 / 浅色主题

## 启动命令（未来）

```bash
# Tauri Mobile (when enabled)
npm run tauri ios dev
npm run tauri android dev
```
