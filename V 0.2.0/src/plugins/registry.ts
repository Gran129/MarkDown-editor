/**
 * Plugin API reserved for a later release.
 * Not wired into the UI in v0.2.0 — do not present this as a shipping feature.
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
