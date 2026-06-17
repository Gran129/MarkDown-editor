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

export interface GraphNode {
  id: string;
  label: string;
  link_count: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface AppSettings {
  theme: "light" | "dark" | "system";
  auto_save_ms: number;
  daily_notes_folder: string;
  daily_notes_template: string;
  font_size: number;
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
