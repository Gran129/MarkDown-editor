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
  Network,
  Save,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";
import { createFile } from "@/lib/tauri-api";
import { formatDailyNoteName } from "@/lib/markdown";

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
  const setRightPanelTab = useAppStore((s) => s.setRightPanelTab);
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
      // folder may not exist - create at root
      await createFile(`${vaultPath}/${fileName}`, `# ${fileName.replace(".md", "")}\n`);
    }
    await refreshFileTree();
    await openFile(path.includes(folder) ? path : `${vaultPath}/${fileName}`);
  };

  const vaultName = vaultPath ? vaultPath.split(/[/\\]/).pop() : null;

  return (
    <header className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleLeftSidebar} title="切换侧栏">
        <PanelLeft className="h-4 w-4" />
      </Button>

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
        title="保存 (Ctrl+S)"
      >
        <Save className="h-3.5 w-3.5" />
        保存
        {activeTab?.isDirty && (
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="未保存" />
        )}
      </Button>

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void handleDailyNote()} title="今日日记">
        <Calendar className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQuickSwitcherOpen(true)} title="快速切换 (Ctrl+O)">
        <Search className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSearchOpen(true)} title="搜索 (Ctrl+Shift+F)">
        <Search className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setRightPanelTab("graph")}
        title="关系图谱"
      >
        <Network className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSettingsOpen(true)} title="设置">
        <Settings className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setHelpOpen(true)} title="帮助 (Ctrl+/)">
        <HelpCircle className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme} title="切换主题">
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleRightPanel} title="切换右面板">
        <PanelRight className="h-4 w-4" />
      </Button>
    </header>
  );
}
