# 插件系统（阶段 7，未交付）

当前版本**没有可用的插件界面或加载器**。仓库里只保留 API 骨架，供后续实现 sidecar / WASM 沙箱加载。

不要把它当作已发布功能：设置面板不展示插件开关，内置示例插件已移除。

## 前端 API

见 [`src/plugins/registry.ts`](../src/plugins/registry.ts)：

```typescript
import { registerPlugin } from "@/plugins/registry";

registerPlugin({
  id: "my-plugin",
  name: "我的插件",
  version: "1.0.0",
  description: "…",
  commands: [{ id: "cmd", label: "执行", handler: () => {} }],
});
```

## 后端 API

Rust 侧 [`list_plugins` / `enable_plugin`](../src-tauri/src/commands.rs) 读写 `plugins.json`。

插件包格式（规划）：

```
my-plugin.zip
├── manifest.json
├── main.js          # 或 WASM 模块
└── README.md
```

## 加载方式（规划）

1. **Tauri sidecar** — 独立进程，IPC 通信
2. **WASM 沙箱** — 浏览器内隔离执行

## Obsidian 兼容

长期目标：参考 Obsidian Plugin API，降低社区插件迁移成本。
