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
  FileSearch,
  Download,
  PenLine,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ViewModeSwitch } from "@/components/editor/ViewModeSwitch";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { createFile } from "@/lib/tauri-api";
import { formatDailyNoteName } from "@/lib/markdown";
import { stripNoteExtension } from "@/lib/note-format";

function IconButton({
  onClick,
  disabled,
  children,
  className,
  title,
  pressed,
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  title?: string;
  pressed?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground",
        pressed && "bg-accent text-foreground",
        className,
      )}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={pressed}
    >
      {children}
    </Button>
  );
}

function ChromeDivider() {
  return <div className="chrome-divider mx-1.5" aria-hidden />;
}

export function TopBar() {
  const openVault = useAppStore((s) => s.openVault);
  const vaultPath = useAppStore((s) => s.vaultPath);
  const sourceVaultPath = useAppStore((s) => s.sourceVaultPath);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const leftSidebarOpen = useAppStore((s) => s.leftSidebarOpen);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);
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
  const openExportDialog = useAppStore((s) => s.openExportDialog);

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
    const title = stripNoteExtension(fileName);
    try {
      const created = await createFile(path, settings.daily_notes_template || `# ${title}\n`);
      await refreshFileTree();
      await openFile(created);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("已存在")) {
        console.error(message);
      }
    }
    await refreshFileTree();
    await openFile(path);
  };

  const displayPath = sourceVaultPath ?? vaultPath;
  const vaultName = displayPath ? displayPath.split(/[/\\]/).pop() : null;

  return (
    <header className="flex h-11 shrink-0 items-center gap-0.5 border-b border-border/80 bg-background/90 px-2 backdrop-blur-sm">
      <IconButton onClick={toggleLeftSidebar} title="切换左侧栏" pressed={leftSidebarOpen}>
        <PanelLeft className="h-4 w-4" />
      </IconButton>

      <div className="ml-1 flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
          <PenLine className="h-3.5 w-3.5" />
        </span>
        <span className="truncate text-sm font-semibold tracking-tight">MarkDown 编辑器</span>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="ml-2 h-8 max-w-[240px] gap-1.5 rounded-full border-border/80 bg-muted/40 px-3 text-xs font-medium"
        onClick={() => void openVault()}
        title={displayPath ?? "打开 Vault"}
      >
        <FolderOpen className="h-3.5 w-3.5 text-primary" />
        <span className="truncate">{vaultName ?? "打开 Vault"}</span>
      </Button>

      <ChromeDivider />

      <ViewModeSwitch />

      <div className="flex-1" />

      <Button
        variant={activeTab?.isDirty ? "default" : "outline"}
        size="sm"
        className="h-8 gap-1.5 rounded-lg px-3 text-xs"
        disabled={!activeTabPath}
        onClick={() => activeTabPath && void saveTab(activeTabPath)}
        title="保存到项目文件夹 (Ctrl+S)"
      >
        <Save className="h-3.5 w-3.5" />
        保存
        {activeTab?.isDirty && (
          <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" aria-label="未保存" />
        )}
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 rounded-lg px-3 text-xs"
        disabled={!activeTabPath}
        title="导出 (Ctrl+Shift+E)"
        onClick={() => activeTabPath && openExportDialog(activeTabPath)}
      >
        <Download className="h-3.5 w-3.5" />
        导出
      </Button>

      <ChromeDivider />

      <IconButton onClick={() => void handleDailyNote()} title="今日日记">
        <Calendar className="h-4 w-4" />
      </IconButton>
      <IconButton onClick={() => setQuickSwitcherOpen(true)} title="快速切换 (Ctrl+O)">
        <FileSearch className="h-4 w-4" />
      </IconButton>
      <IconButton onClick={() => setSearchOpen(true)} title="全文搜索 (Ctrl+Shift+F)">
        <Search className="h-4 w-4" />
      </IconButton>
      <IconButton onClick={() => setSettingsOpen(true)} title="设置">
        <Settings className="h-4 w-4" />
      </IconButton>
      <IconButton onClick={() => setHelpOpen(true)} title="快捷键">
        <HelpCircle className="h-4 w-4" />
      </IconButton>
      <IconButton onClick={toggleTheme} title={theme === "dark" ? "切换浅色" : "切换深色"}>
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </IconButton>
      <IconButton onClick={toggleRightPanel} title="切换右侧栏" pressed={rightPanelOpen}>
        <PanelRight className="h-4 w-4" />
      </IconButton>
    </header>
  );
}
