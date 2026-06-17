import { create } from "zustand";

import {
  addRecentVault,
  clearDraft,
  indexVault,
  listFiles,
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
import type { AppSettings, FileNode, TabState } from "@/lib/types";

interface AppStore {
  vaultPath: string | null;
  fileTree: FileNode[];
  tabs: TabState[];
  activeTabPath: string | null;
  leftSidebarOpen: boolean;
  rightPanelOpen: boolean;
  rightPanelTab: "backlinks" | "outgoing" | "tags" | "graph";
  theme: "light" | "dark" | "system";
  settings: AppSettings;
  searchOpen: boolean;
  quickSwitcherOpen: boolean;
  settingsOpen: boolean;
  helpOpen: boolean;
  tagFilter: string | null;

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
  setRightPanelTab: (tab: AppStore["rightPanelTab"]) => void;
  setTheme: (theme: AppStore["theme"]) => void;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  setSearchOpen: (open: boolean) => void;
  setQuickSwitcherOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  setTagFilter: (tag: string | null) => void;
}

const defaultSettings: AppSettings = {
  theme: "system",
  auto_save_ms: 2000,
  daily_notes_folder: "Daily",
  daily_notes_template: "",
  font_size: 16,
  default_vault: null,
};

function applyTheme(theme: "light" | "dark" | "system") {
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
}

export const useAppStore = create<AppStore>((set, get) => ({
  vaultPath: null,
  fileTree: [],
  tabs: [],
  activeTabPath: null,
  leftSidebarOpen: true,
  rightPanelOpen: true,
  rightPanelTab: "backlinks",
  theme: "system",
  settings: defaultSettings,
  searchOpen: false,
  quickSwitcherOpen: false,
  settingsOpen: false,
  helpOpen: false,
  tagFilter: null,

  init: async () => {
    const settings = await loadSettings();
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
    set({ vaultPath: selected, tabs: [], activeTabPath: null });
    await get().refreshFileTree();
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
    if (vault) await indexVault(vault);
    return;
  },

  markTabDirty: (path, dirty) => {
    set({
      tabs: get().tabs.map((t) => (t.path === path ? { ...t, isDirty: dirty } : t)),
    });
  },

  toggleLeftSidebar: () => set({ leftSidebarOpen: !get().leftSidebarOpen }),
  toggleRightPanel: () => set({ rightPanelOpen: !get().rightPanelOpen }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab, rightPanelOpen: true }),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
    void get().updateSettings({ theme });
  },
  updateSettings: async (partial) => {
    const settings = { ...get().settings, ...partial };
    await saveSettings(settings);
    set({ settings });
    if (partial.theme) applyTheme(partial.theme);
  },
  setSearchOpen: (open) => set({ searchOpen: open }),
  setQuickSwitcherOpen: (open) => set({ quickSwitcherOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setHelpOpen: (open) => set({ helpOpen: open }),
  setTagFilter: (tag) => set({ tagFilter: tag }),
}));
