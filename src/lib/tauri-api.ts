import { invoke } from "@tauri-apps/api/core";

import type {
  AppSettings,
  BacklinkResult,
  FileNode,
  GraphData,
  SearchResult,
  VaultInfo,
} from "./types";

export async function openVaultDialog(): Promise<string | null> {
  return invoke<string | null>("open_vault_dialog");
}

export async function listRecentVaults(): Promise<VaultInfo[]> {
  return invoke<VaultInfo[]>("list_recent_vaults");
}

export async function addRecentVault(path: string): Promise<void> {
  return invoke("add_recent_vault", { path });
}

export async function listFiles(vaultPath: string): Promise<FileNode[]> {
  return invoke<FileNode[]>("list_files", { vaultPath });
}

export async function readFile(path: string): Promise<string> {
  return invoke<string>("read_file", { path });
}

export async function writeFile(path: string, content: string): Promise<void> {
  return invoke("write_file", { path, content });
}

export async function createFile(path: string, content?: string): Promise<void> {
  return invoke("create_file", { path, content: content ?? "" });
}

export async function createFolder(path: string): Promise<void> {
  return invoke("create_folder", { path });
}

export async function renamePath(oldPath: string, newPath: string): Promise<void> {
  return invoke("rename_path", { oldPath, newPath });
}

export async function deletePath(path: string): Promise<void> {
  return invoke("delete_path", { path });
}

export async function movePath(source: string, destination: string): Promise<void> {
  return invoke("move_path", { source, destination });
}

export async function revealInExplorer(path: string): Promise<void> {
  return invoke("reveal_in_explorer", { path });
}

export async function startVaultWatcher(vaultPath: string): Promise<void> {
  return invoke("start_vault_watcher", { vaultPath });
}

export async function indexVault(vaultPath: string): Promise<void> {
  return invoke("index_vault", { vaultPath });
}

export async function searchNotes(
  vaultPath: string,
  query: string,
): Promise<SearchResult[]> {
  return invoke<SearchResult[]>("search_notes", { vaultPath, query });
}

export async function getBacklinks(
  vaultPath: string,
  noteName: string,
): Promise<BacklinkResult[]> {
  return invoke<BacklinkResult[]>("get_backlinks", { vaultPath, noteName });
}

export async function getGraphData(vaultPath: string): Promise<GraphData> {
  return invoke<GraphData>("get_graph_data", { vaultPath });
}

export async function resolveNotePath(
  vaultPath: string,
  noteName: string,
): Promise<string | null> {
  return invoke<string | null>("resolve_note_path", { vaultPath, noteName });
}

export async function updateWikiLinksOnRename(
  vaultPath: string,
  oldName: string,
  newName: string,
): Promise<void> {
  return invoke("update_wiki_links_on_rename", { vaultPath, oldName, newName });
}

export async function loadSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("load_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke("save_settings", { settings });
}

export async function saveDraft(path: string, content: string): Promise<void> {
  return invoke("save_draft", { path, content });
}

export async function loadDraft(path: string): Promise<string | null> {
  return invoke<string | null>("load_draft", { path });
}

export async function clearDraft(path: string): Promise<void> {
  return invoke("clear_draft", { path });
}

export async function listPlugins(): Promise<
  import("./types").PluginManifest[]
> {
  return invoke("list_plugins");
}

export async function enablePlugin(id: string, enabled: boolean): Promise<void> {
  return invoke("enable_plugin", { id, enabled });
}
