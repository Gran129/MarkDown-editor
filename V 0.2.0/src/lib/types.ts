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
  auto_save_enabled: boolean;
  auto_save_minutes: number;
  /** Kept for settings.json compatibility; derived from auto_save_minutes. */
  auto_save_ms: number;
  daily_notes_folder: string;
  daily_notes_template: string;
  font_size: number;
  line_height: number;
  default_vault: string | null;
  code_inline_on_selection: boolean;
  code_merge_paragraphs: boolean;
  /** 嵌入笔记时是否展开正文预览；关闭后仅保留点击直达。 */
  show_embed_note_content: boolean;
  /** 启用题目对错判定（需自行导入答案与解析）。 */
  quiz_enable_grading: boolean;
  /** 作答后自动显示对错与解析；关闭则显示手动按钮。 */
  quiz_auto_show_answer: boolean;
}

export interface TabState {
  path: string;
  title: string;
  isDirty: boolean;
  content: string;
  frontmatter: Record<string, unknown>;
  kind?: "note" | "office" | "pdf" | "xmind";
}

export interface TagInfo {
  tag: string;
  paths: string[];
}

/** 语法视图 = Markdown 源码；阅读视图 = 只读预览；编辑视图 = Word 式所见即所得 */
export type EditorViewMode = "source" | "reading" | "editing";

export type SavePromptMode = "close-tab" | "switch-vault" | "quit";

export interface SavePromptFile {
  path: string;
  title: string;
}

export interface SavePromptState {
  mode: SavePromptMode;
  files: SavePromptFile[];
  vaultPath?: string;
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
