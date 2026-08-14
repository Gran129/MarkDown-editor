import { create } from "zustand";

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
import {
  getNoteTitle,
  parseFrontmatter,
  serializeFrontmatter,
} from "@/lib/markdown";
import type { AppSettings, EditorViewMode, FileNode, TabState, TagInfo } from "@/lib/types";
import { loadSidebarWidths } from "@/components/layout/ResizableSidebar";

interface AppStore {
  vaultPath: string | null;
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
  tagFilter: string | null;
  vaultTags: TagInfo[];
  viewMode: EditorViewMode;

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
  setTagFilter: (tag: string | null) => void;
  refreshVaultTags: () => Promise<void>;
  setViewMode: (mode: EditorViewMode) => void;
  cycleViewMode: () => void;
}

const defaultSettings: AppSettings = {
  theme: "system",
  auto_save_ms: 2000,
  daily_notes_folder: "Daily",
  daily_notes_template: "",
  font_size: 16,
  line_height: 1.75,
  default_vault: null,
};

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

function normalizeSettings(loaded: Partial<AppSettings>): AppSettings {
  return {
    ...defaultSettings,
    ...loaded,
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
  tagFilter: null,
  vaultTags: [],
  viewMode: loadViewMode(),

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

    await addRecentVault(selected);
    await startVaultWatcher(selected);
    await indexVault(selected);
    set({ vaultPath: selected, tabs: [], activeTabPath: null, tagFilter: null });
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
      set({ activeTabPath: path });
      return;
    }

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
    set({
      tabs: [...tabs, tab],
      activeTabPath: path,
    });
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
    const full = serializeFrontmatter(tab.frontmatter, tab.content);
    await writeFile(path, full);
    await clearDraft(path);
    get().markTabDirty(path, false);
    const vault = get().vaultPath;
    if (vault) {
      await indexVault(vault);
      await get().refreshVaultTags();
    }
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
    const settings: AppSettings = {
      ...defaultSettings,
      ...merged,
      line_height: clampLineHeight(merged.line_height ?? defaultSettings.line_height),
    };
    await saveSettings(settings);
    set({ settings });
    if (partial.theme) applyTheme(partial.theme);
  },
  setSearchOpen: (open) => set({ searchOpen: open }),
  setQuickSwitcherOpen: (open) => set({ quickSwitcherOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setHelpOpen: (open) => set({ helpOpen: open }),
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
