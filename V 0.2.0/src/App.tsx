import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

import { AppLayout } from "@/components/layout/AppLayout";
import { UpdateChecker } from "@/components/update/UpdateChecker";
import { useAppStore } from "@/stores/app-store";
import { indexVault } from "@/lib/tauri-api";

import { useEditorStore } from "@/stores/editor-store";

function useKeyboardShortcuts() {
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const setQuickSwitcherOpen = useAppStore((s) => s.setQuickSwitcherOpen);
  const setHelpOpen = useAppStore((s) => s.setHelpOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const setFindReplaceOpen = useEditorStore((s) => s.setFindReplaceOpen);
  const saveTab = useAppStore((s) => s.saveTab);
  const activeTabPath = useAppStore((s) => s.activeTabPath);
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const cycleViewMode = useAppStore((s) => s.cycleViewMode);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.altKey && e.code === "Digit1") {
        e.preventDefault();
        setViewMode("source");
        return;
      }
      if (mod && e.altKey && e.code === "Digit2") {
        e.preventDefault();
        setViewMode("reading");
        return;
      }
      if (mod && e.altKey && e.code === "Digit3") {
        e.preventDefault();
        setViewMode("editing");
        return;
      }
      if (mod && e.altKey && e.code === "Backslash") {
        e.preventDefault();
        cycleViewMode();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (mod && e.key.toLowerCase() === "o") {
        e.preventDefault();
        setQuickSwitcherOpen(true);
      } else if (mod && e.key === "/") {
        e.preventDefault();
        setHelpOpen(true);
      } else if (mod && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      } else if (mod && e.key.toLowerCase() === "h") {
        if (viewMode !== "editing") return;
        e.preventDefault();
        setFindReplaceOpen(true);
      } else if (mod && e.key.toLowerCase() === "s" && activeTabPath) {
        e.preventDefault();
        void saveTab(activeTabPath);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    setSearchOpen,
    setQuickSwitcherOpen,
    setHelpOpen,
    setSettingsOpen,
    setFindReplaceOpen,
    saveTab,
    activeTabPath,
    viewMode,
    setViewMode,
    cycleViewMode,
  ]);
}

function useVaultWatcher() {
  const refreshFileTree = useAppStore((s) => s.refreshFileTree);
  const refreshVaultTags = useAppStore((s) => s.refreshVaultTags);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unlisten = listen("vault-changed", () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void (async () => {
          await refreshFileTree();
          const vaultPath = useAppStore.getState().vaultPath;
          if (!vaultPath) return;
          try {
            await indexVault(vaultPath);
            await refreshVaultTags();
          } catch {
            /* index may not be ready yet */
          }
        })();
      }, 400);
    });
    return () => {
      if (timer) clearTimeout(timer);
      void unlisten.then((fn) => fn());
    };
  }, [refreshFileTree, refreshVaultTags]);
}

function useSystemThemeSync() {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.classList.toggle("dark", media.matches);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}

export default function App() {
  const init = useAppStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  useKeyboardShortcuts();
  useVaultWatcher();
  useSystemThemeSync();

  return (
    <>
      <AppLayout />
      <UpdateChecker />
    </>
  );
}
