export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

export interface VaultInfo {
  path: string;
  name: string;
  last_opened: number;
}

export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
  score: number;
}

export interface BacklinkResult {
  source_path: string;
  source_title: string;
  context: string;
}

export interface AppSettings {
  theme: "light" | "dark" | "system";
  auto_save_ms: number;
  daily_notes_folder: string;
  daily_notes_template: string;
  font_size: number;
  line_height: number;
  default_vault: string | null;
}

export interface TabState {
  path: string;
  title: string;
  isDirty: boolean;
  content: string;
  frontmatter: Record<string, unknown>;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
}

export type AppEdition = "portable" | "installed";

export type UpdateStatus =
  | "up_to_date"
  | "update_available"
  | "skipped_portable"
  | "skipped_offline"
  | "check_failed";

export interface AppEditionInfo {
  edition: AppEdition;
  updateEnabled: boolean;
  networkOnline: boolean;
  currentVersion: string;
}

export interface UpdateCheckResult {
  status: UpdateStatus;
  edition: AppEdition;
  updateEnabled: boolean;
  networkOnline: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string;
  downloadUrl?: string;
  error?: string;
}

export interface DownloadProgress {
  percent: number;
  ready: boolean;
  error?: string;
}
