import { create } from "zustand";
import { startTransition } from "react";

import {
  addRecentVault,
  clearDraft,
  indexVault,
  listFiles,
  listVaultTags,
  loadDraft,
  loadSettings,
  openVaultDialog,
  readFile,
  saveSettings,
  startVaultWatcher,
  writeFile,
} from "@/lib/tauri-api";
import { getMarkdownFromEditor } from "@/lib/editor-markdown";
import {
  getNoteTitle,
  parseFrontmatter,
  serializeFrontmatter,
  tryParseFrontmatter,
} from "@/lib/markdown";
import type { AppSettings, EditorViewMode, FileNode, TabState, TagInfo } from "@/lib/types";
import { loadSidebarWidths } from "@/components/layout/ResizableSidebar";
import { useEditorStore } from "@/stores/editor-store";

interface AppStore {
  vaultPath: string | null;
  sourceVaultPath: string | null;
  fileTree: FileNode[];
  tabs: TabState[];
  activeTabPath: string | null;
  leftSidebarOpen: boolean;
  leftSidebarWidth: number;
  rightPanelOpen: boolean;
  rightPanelWidth: number;
  rightPanelTab: "outline" | "links" | "tags" | "blockref";
  theme: "light" | "dark" | "system";
  settings: AppSettings;
  searchOpen: boolean;
  quickSwitcherOpen: boolean;
  settingsOpen: boolean;
  helpOpen: boolean;
  exportTargetPath: string | null;
  tagFilter: string | null;
  vaultTags: TagInfo[];
  viewMode: EditorViewMode;
  fileOpenError: string | null;
  ignoreVaultEventsUntil: number;

  init: () => Promise<void>;
  openVault: (path?: string) => Promise<void>;
  refreshFileTree: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  closeTab: (path: string) => void;
  setActiveTab: (path: string) => void;
  updateTabContent: (path: string, content: string, frontmatter: Record<string, unknown>) => void;
  saveTab: (path: string) => Promise<void>;
  markTabDirty: (path: string, dirty: boolean) => void;
  toggleLeftSidebar: () => void;
  toggleRightPanel: () => void;
  setLeftSidebarWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setRightPanelTab: (tab: AppStore["rightPanelTab"]) => void;
  setTheme: (theme: AppStore["theme"]) => void;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  setSearchOpen: (open: boolean) => void;
  setQuickSwitcherOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  openExportDialog: (path: string) => void;
  closeExportDialog: () => void;
  setTagFilter: (tag: string | null) => void;
  refreshVaultTags: () => Promise<void>;
  setViewMode: (mode: EditorViewMode) => void;
  cycleViewMode: () => void;
  clearFileOpenError: () => void;
  markSelfWrite: (ms?: number) => void;
}

const defaultSettings: AppSettings = {
  theme: "system",
  auto_save_enabled: false,
  auto_save_minutes: 1,
  auto_save_ms: 60_000,
  daily_notes_folder: "Daily",
  daily_notes_template: "",
  font_size: 16,
  line_height: 1.75,
  default_vault: null,
};

function clampAutoSaveMinutes(value: number): number {
  if (!Number.isFinite(value)) return defaultSettings.auto_save_minutes;
  return Math.min(60, Math.max(1, Math.round(value)));
}

function deriveAutoSaveMs(minutes: number): number {
  return clampAutoSaveMinutes(minutes) * 60_000;
}

function applyTheme(theme: "light" | "dark" | "system") {
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
}

function clampLineHeight(value: number): number {
  if (!Number.isFinite(value)) return defaultSettings.line_height;
  return Math.min(2.4, Math.max(1.2, value));
}

function normalizeSettings(loaded: Partial<AppSettings> & { auto_save_ms?: number }): AppSettings {
  const minutes = loaded.auto_save_minutes
    ? clampAutoSaveMinutes(loaded.auto_save_minutes)
    : loaded.auto_save_ms && loaded.auto_save_ms >= 60_000
      ? clampAutoSaveMinutes(loaded.auto_save_ms / 60_000)
      : defaultSettings.auto_save_minutes;
  return {
    ...defaultSettings,
    ...loaded,
    auto_save_enabled: Boolean(loaded.auto_save_enabled),
    auto_save_minutes: minutes,
    auto_save_ms: deriveAutoSaveMs(minutes),
    line_height: clampLineHeight(loaded.line_height ?? defaultSettings.line_height),
  };
}

const VIEW_MODE_STORAGE_KEY = "md-editor-view-mode";
const VIEW_MODE_ORDER: EditorViewMode[] = ["source", "reading", "editing"];

function isEditorViewMode(value: string | null): value is EditorViewMode {
  return value === "source" || value === "reading" || value === "editing";
}

function loadViewMode(): EditorViewMode {
  try {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (isEditorViewMode(stored)) return stored;
  } catch {
    /* ignore quota / private-mode failures */
  }
  return "editing";
}

function persistViewMode(mode: EditorViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore quota / private-mode failures */
  }
}

const initialSidebarWidths = loadSidebarWidths();

export const useAppStore = create<AppStore>((set, get) => ({
  vaultPath: null,
  sourceVaultPath: null,
  fileTree: [],
  tabs: [],
  activeTabPath: null,
  leftSidebarOpen: true,
  leftSidebarWidth: initialSidebarWidths.left,
  rightPanelOpen: true,
  rightPanelWidth: initialSidebarWidths.right,
  rightPanelTab: "outline",
  theme: "system",
  settings: defaultSettings,
  searchOpen: false,
  quickSwitcherOpen: false,
  settingsOpen: false,
  helpOpen: false,
  exportTargetPath: null,
  tagFilter: null,
  vaultTags: [],
  viewMode: loadViewMode(),
  fileOpenError: null,
  ignoreVaultEventsUntil: 0,

  init: async () => {
    const loaded = await loadSettings();
    const settings = normalizeSettings(loaded);
    set({ settings, theme: settings.theme });
    applyTheme(settings.theme);
    if (settings.default_vault) {
      await get().openVault(settings.default_vault);
    }
  },

  openVault: async (path?: string) => {
    const selected = path ?? (await openVaultDialog());
    if (!selected) return;

    const workPath = await addRecentVault(selected);
    await startVaultWatcher(workPath);
    await indexVault(workPath);
    set({
      vaultPath: workPath,
      sourceVaultPath: selected,
      tabs: [],
      activeTabPath: null,
      tagFilter: null,
    });
    if (get().settings.default_vault) {
      await get().updateSettings({ default_vault: selected });
    }
    await get().refreshFileTree();
    await get().refreshVaultTags();
  },

  refreshFileTree: async () => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    const fileTree = await listFiles(vaultPath);
    set({ fileTree });
  },

  openFile: async (path: string) => {
    const { tabs } = get();
    const existing = tabs.find((t) => t.path === path);
    if (existing) {
      startTransition(() => set({ activeTabPath: path, fileOpenError: null }));
      return;
    }

    try {
      let raw = await readFile(path);
      const draft = await loadDraft(path);
      if (draft) raw = draft;

      const { frontmatter, body } = parseFrontmatter(raw);
      const title = getNoteTitle(path, frontmatter);
      const tab: TabState = {
        path,
        title,
        isDirty: !!draft,
        content: body,
        frontmatter,
      };
      startTransition(() => {
        set({
          tabs: [...get().tabs, tab],
          activeTabPath: path,
          fileOpenError: null,
        });
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "无法读取该笔记，请检查文件是否存在或是否已损坏。";
      console.error("openFile failed:", path, error);
      set({ fileOpenError: message });
    }
  },

  clearFileOpenError: () => set({ fileOpenError: null }),

  markSelfWrite: (ms = 1500) => {
    set({ ignoreVaultEventsUntil: Date.now() + ms });
  },

  closeTab: (path: string) => {
    const { tabs, activeTabPath } = get();
    const next = tabs.filter((t) => t.path !== path);
    let nextActive = activeTabPath;
    if (activeTabPath === path) {
      nextActive = next.length > 0 ? next[next.length - 1]!.path : null;
    }
    set({ tabs: next, activeTabPath: nextActive });
  },

  setActiveTab: (path: string) => set({ activeTabPath: path }),

  updateTabContent: (path, content, frontmatter) => {
    const { tabs } = get();
    set({
      tabs: tabs.map((t) =>
        t.path === path
          ? {
              ...t,
              content,
              frontmatter,
              title: getNoteTitle(path, frontmatter),
              isDirty: true,
            }
          : t,
      ),
    });
  },

  saveTab: async (path: string) => {
    const tab = get().tabs.find((t) => t.path === path);
    if (!tab) return;

    let content = tab.content;
    let frontmatter = tab.frontmatter;
    const viewMode = get().viewMode;
    const editorState = useEditorStore.getState();

    if (viewMode === "source") {
      const latest = editorState.sourceScrollEl?.value;
      if (latest != null) {
        const parsed = tryParseFrontmatter(latest);
        if (parsed) {
          content = parsed.body;
          frontmatter = parsed.frontmatter;
        }
      }
    } else if (viewMode === "editing") {
      const editor = editorState.editor;
      if (editor && !editor.isDestroyed) {
        try {
          content = getMarkdownFromEditor(editor);
        } catch (error) {
          console.error("Failed to flush editor before save:", error);
        }
      }
    }

    const full = serializeFrontmatter(frontmatter, content);
    get().markSelfWrite(2000);
    const savedPath = await writeFile(path, full);
    await clearDraft(path);
    if (savedPath !== path) {
      await clearDraft(savedPath);
    }
    set({
      tabs: get().tabs.map((item) =>
        item.path === path
          ? {
              ...item,
              path: savedPath,
              title: getNoteTitle(savedPath, frontmatter),
              content,
              frontmatter,
              isDirty: false,
            }
          : item,
      ),
      activeTabPath: get().activeTabPath === path ? savedPath : get().activeTabPath,
    });
    return;
  },

  markTabDirty: (path, dirty) => {
    set({
      tabs: get().tabs.map((t) => (t.path === path ? { ...t, isDirty: dirty } : t)),
    });
  },

  toggleLeftSidebar: () => set({ leftSidebarOpen: !get().leftSidebarOpen }),
  toggleRightPanel: () => set({ rightPanelOpen: !get().rightPanelOpen }),
  setLeftSidebarWidth: (width) => set({ leftSidebarWidth: width }),
  setRightPanelWidth: (width) => set({ rightPanelWidth: width }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab, rightPanelOpen: true }),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
    void get().updateSettings({ theme });
  },
  updateSettings: async (partial) => {
    const merged = { ...get().settings, ...partial };
    const settings = normalizeSettings(merged);
    await saveSettings(settings);
    set({ settings });
    if (partial.theme) applyTheme(partial.theme);
  },
  setSearchOpen: (open) => set({ searchOpen: open }),
  setQuickSwitcherOpen: (open) => set({ quickSwitcherOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setHelpOpen: (open) => set({ helpOpen: open }),
  openExportDialog: (path) => set({ exportTargetPath: path }),
  closeExportDialog: () => set({ exportTargetPath: null }),
  setTagFilter: (tag) => set({ tagFilter: tag }),
  refreshVaultTags: async () => {
    const { vaultPath } = get();
    if (!vaultPath) {
      set({ vaultTags: [] });
      return;
    }
    try {
      const vaultTags = await listVaultTags(vaultPath);
      set({ vaultTags });
    } catch {
      set({ vaultTags: [] });
    }
  },
  setViewMode: (mode) => {
    persistViewMode(mode);
    set({ viewMode: mode });
    if (mode !== "editing") {
      void import("@/stores/editor-store").then(({ useEditorStore }) => {
        useEditorStore.getState().setFindReplaceOpen(false);
      });
    }
  },
  cycleViewMode: () => {
    const current = get().viewMode;
    const index = VIEW_MODE_ORDER.indexOf(current);
    const next = VIEW_MODE_ORDER[(index + 1) % VIEW_MODE_ORDER.length] ?? "editing";
    get().setViewMode(next);
  },
}));
