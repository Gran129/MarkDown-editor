import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

import { AppLayout } from "@/components/layout/AppLayout";
import { useAppStore } from "@/stores/app-store";

function useKeyboardShortcuts() {
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const setQuickSwitcherOpen = useAppStore((s) => s.setQuickSwitcherOpen);
  const setHelpOpen = useAppStore((s) => s.setHelpOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const saveTab = useAppStore((s) => s.saveTab);
  const activeTabPath = useAppStore((s) => s.activeTabPath);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
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
    saveTab,
    activeTabPath,
  ]);
}

function useVaultWatcher() {
  const refreshFileTree = useAppStore((s) => s.refreshFileTree);

  useEffect(() => {
    const unlisten = listen("vault-changed", () => {
      void refreshFileTree();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refreshFileTree]);
}

export default function App() {
  const init = useAppStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  useKeyboardShortcuts();
  useVaultWatcher();

  return <AppLayout />;
}
