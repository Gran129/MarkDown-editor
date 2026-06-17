import {
  FolderOpen,
  Moon,
  Sun,
  PanelLeft,
  PanelRight,
  Search,
  Settings,
  Calendar,
  HelpCircle,
  Save,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";
import { createFile } from "@/lib/tauri-api";
import { formatDailyNoteName } from "@/lib/markdown";

function IconButton({
  onClick,
  disabled,
  children,
  className,
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className ?? "h-8 w-8"}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

export function TopBar() {
  const openVault = useAppStore((s) => s.openVault);
  const vaultPath = useAppStore((s) => s.vaultPath);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const toggleLeftSidebar = useAppStore((s) => s.toggleLeftSidebar);
  const toggleRightPanel = useAppStore((s) => s.toggleRightPanel);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const setQuickSwitcherOpen = useAppStore((s) => s.setQuickSwitcherOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const setHelpOpen = useAppStore((s) => s.setHelpOpen);
  const settings = useAppStore((s) => s.settings);
  const openFile = useAppStore((s) => s.openFile);
  const refreshFileTree = useAppStore((s) => s.refreshFileTree);
  const activeTabPath = useAppStore((s) => s.activeTabPath);
  const activeTab = useAppStore((s) => s.tabs.find((t) => t.path === s.activeTabPath));
  const saveTab = useAppStore((s) => s.saveTab);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleDailyNote = async () => {
    if (!vaultPath) {
      await openVault();
      return;
    }
    const folder = settings.daily_notes_folder;
    const fileName = formatDailyNoteName();
    const path = `${vaultPath}/${folder}/${fileName}`.replace(/\\/g, "/");
    try {
      await createFile(path, settings.daily_notes_template || `# ${fileName.replace(".md", "")}\n`);
    } catch {
      await createFile(`${vaultPath}/${fileName}`, `# ${fileName.replace(".md", "")}\n`);
    }
    await refreshFileTree();
    await openFile(path.includes(folder) ? path : `${vaultPath}/${fileName}`);
  };

  const vaultName = vaultPath ? vaultPath.split(/[/\\]/).pop() : null;

  return (
    <header className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2">
      <IconButton onClick={toggleLeftSidebar}>
        <PanelLeft className="h-4 w-4" />
      </IconButton>

      <span className="text-sm font-semibold">MarkDown 编辑器</span>

      <Button variant="outline" size="sm" className="ml-2 h-7 gap-1 text-xs" onClick={() => void openVault()}>
        <FolderOpen className="h-3.5 w-3.5" />
        {vaultName ?? "打开 Vault"}
      </Button>

      <div className="flex-1" />

      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs"
        disabled={!activeTabPath}
        onClick={() => activeTabPath && void saveTab(activeTabPath)}
      >
        <Save className="h-3.5 w-3.5" />
        保存
        {activeTab?.isDirty && (
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="未保存" />
        )}
      </Button>

      <IconButton onClick={() => void handleDailyNote()}>
        <Calendar className="h-4 w-4" />
      </IconButton>
      <IconButton onClick={() => setQuickSwitcherOpen(true)}>
        <Search className="h-4 w-4" />
      </IconButton>
      <IconButton onClick={() => setSearchOpen(true)}>
        <Search className="h-4 w-4" />
      </IconButton>
      <IconButton onClick={() => setSettingsOpen(true)}>
        <Settings className="h-4 w-4" />
      </IconButton>
      <IconButton onClick={() => setHelpOpen(true)}>
        <HelpCircle className="h-4 w-4" />
      </IconButton>
      <IconButton onClick={toggleTheme}>
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </IconButton>
      <IconButton onClick={toggleRightPanel}>
        <PanelRight className="h-4 w-4" />
      </IconButton>
    </header>
  );
}
