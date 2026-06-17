/**
 * Plugin API - reserved for Phase 7
 *
 * Plugins can register:
 * - Editor TipTap extensions
 * - Command palette commands
 * - Settings panel sections
 *
 * Loading: Tauri sidecar or WASM sandbox (future)
 */

export interface PluginCommand {
  id: string;
  label: string;
  handler: () => void | Promise<void>;
}

export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  commands?: PluginCommand[];
  onLoad?: () => void | Promise<void>;
  onUnload?: () => void | Promise<void>;
}

const registry = new Map<string, PluginDefinition>();

export function registerPlugin(plugin: PluginDefinition): void {
  registry.set(plugin.id, plugin);
}

export function getPlugin(id: string): PluginDefinition | undefined {
  return registry.get(id);
}

export function getAllPlugins(): PluginDefinition[] {
  return [...registry.values()];
}

/** Example built-in plugin stub */
export const examplePlugin: PluginDefinition = {
  id: "example",
  name: "示例插件",
  version: "0.1.0",
  description: "插件系统占位示例",
  commands: [
    {
      id: "example.hello",
      label: "示例：Hello",
      handler: () => {
        console.info("Hello from plugin system");
      },
    },
  ],
};
