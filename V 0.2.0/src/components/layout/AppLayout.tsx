import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import { FileText, PenLine } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileTreeSidebar } from "@/components/sidebar/FileTree";
import { LinksPanel } from "@/components/backlinks/BacklinksPanel";
import { TagsPanel } from "@/components/tags/TagsPanel";
import { TabBar } from "@/components/layout/TabBar";
import { TopBar } from "@/components/layout/TopBar";
import { EditorWorkspace } from "@/components/layout/EditorWorkspace";
import {
  ResizableSidebar,
  SIDEBAR_WIDTH_LIMITS,
  saveSidebarWidths,
} from "@/components/layout/ResizableSidebar";
import { OutlinePanel } from "@/components/editor/OutlinePanel";
import { BlockRefPanel } from "@/components/editor/BlockRefPanel";
import { FindReplaceDialog } from "@/components/editor/FindReplaceDialog";
import { EditorErrorBoundary } from "@/components/editor/EditorErrorBoundary";
import { SearchDialog, QuickSwitcherDialog } from "@/components/search/SearchDialog";
import { SettingsDialog, HelpDialog } from "@/components/settings/SettingsDialog";
import { ExportDialog } from "@/components/settings/ExportDialog";
import { useAppStore } from "@/stores/app-store";
import { resolveNotePath, createFile, revealInExplorer, listRecentVaults } from "@/lib/tauri-api";
import {
  isAbsoluteFilePath,
  isNoteFileName,
  nativeNoteFileName,
  resolveNoteMediaFile,
  stripNoteExtension,
} from "@/lib/note-format";
import { isOfficeFileName } from "@/lib/office";
import { isBinaryOpenable, openableKindFromPath } from "@/lib/file-kinds";
import type { VaultInfo } from "@/lib/types";

function flattenNoteNames(nodes: import("@/lib/types").FileNode[]): string[] {
  const names: string[] = [];
  for (const n of nodes) {
    if (n.is_dir && n.children) names.push(...flattenNoteNames(n.children));
    else if (!n.is_dir && isNoteFileName(n.name)) names.push(stripNoteExtension(n.name));
  }
  return names;
}

export function AppLayout() {
  const leftSidebarOpen = useAppStore((s) => s.leftSidebarOpen);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);
  const rightPanelTab = useAppStore((s) => s.rightPanelTab);
  const setRightPanelTab = useAppStore((s) => s.setRightPanelTab);
  const leftSidebarWidth = useAppStore((s) => s.leftSidebarWidth);
  const rightPanelWidth = useAppStore((s) => s.rightPanelWidth);
  const setLeftSidebarWidth = useAppStore((s) => s.setLeftSidebarWidth);
  const setRightPanelWidth = useAppStore((s) => s.setRightPanelWidth);
  const tabs = useAppStore((s) => s.tabs);
  const activeTabPath = useAppStore((s) => s.activeTabPath);
  const activeTab = tabs.find((t) => t.path === activeTabPath);
  const fileTree = useAppStore((s) => s.fileTree);
  const vaultPath = useAppStore((s) => s.vaultPath);
  const settings = useAppStore((s) => s.settings);
  const updateTabContent = useAppStore((s) => s.updateTabContent);
  const openFile = useAppStore((s) => s.openFile);
  const setTagFilter = useAppStore((s) => s.setTagFilter);
  const refreshFileTree = useAppStore((s) => s.refreshFileTree);
  const viewMode = useAppStore((s) => s.viewMode);
  const fileOpenError = useAppStore((s) => s.fileOpenError);
  const clearFileOpenError = useAppStore((s) => s.clearFileOpenError);

  const noteNames = useMemo(() => flattenNoteNames(fileTree), [fileTree]);

  const handleFrontmatterChange = useCallback(
    (frontmatter: Record<string, unknown>) => {
      if (!activeTab) return;
      updateTabContent(activeTab.path, activeTab.content, frontmatter);
    },
    [activeTab, updateTabContent],
  );

  const handleWikiLinkClick = useCallback(async (target: string) => {
    if (!vaultPath) return;
    const path = await resolveNotePath(vaultPath, target);
    if (path) {
      await openFile(path);
    } else if (viewMode === "reading") {
      return;
    } else if (window.confirm(`笔记「${target}」不存在，是否创建？`)) {
      const newPath = `${vaultPath}/${nativeNoteFileName(target)}`;
      const created = await createFile(newPath, `# ${target}\n`);
      await refreshFileTree();
      await openFile(created);
    }
  }, [vaultPath, viewMode, openFile, refreshFileTree]);

  const handleEmbedClick = useCallback(async (target: string) => {
    if (!vaultPath) return;
    const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(target);
    if (isImage) {
      const abs = isAbsoluteFilePath(target)
        ? target
        : resolveNoteMediaFile(activeTabPath, vaultPath, target);
      await revealInExplorer(abs);
      return;
    }
    if (isOfficeFileName(target) || isBinaryOpenable(openableKindFromPath(target))) {
      return;
    }
    await handleWikiLinkClick(stripNoteExtension(target));
  }, [vaultPath, activeTabPath, handleWikiLinkClick]);

  const handleTagClick = useCallback(
    (tag: string) => startTransition(() => setTagFilter(tag)),
    [setTagFilter],
  );

  const persistSidebarWidths = (left: number, right: number) => {
    saveSidebarWidths(left, right);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {leftSidebarOpen && (
          <ResizableSidebar
            side="left"
            width={leftSidebarWidth}
            minWidth={SIDEBAR_WIDTH_LIMITS.left.min}
            maxWidth={SIDEBAR_WIDTH_LIMITS.left.max}
            onWidthChange={setLeftSidebarWidth}
            onResizeEnd={(w) => persistSidebarWidths(w, rightPanelWidth)}
            className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
          >
            <FileTreeSidebar />
          </ResizableSidebar>
        )}

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TabBar />
          {fileOpenError && (
            <div className="flex items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              <span>{fileOpenError}</span>
              <button
                type="button"
                className="shrink-0 rounded px-2 py-0.5 text-xs hover:bg-destructive/10"
                onClick={() => clearFileOpenError()}
              >
                关闭
              </button>
            </div>
          )}
          {activeTab ? (
            <EditorErrorBoundary resetKey={activeTab.path}>
              <EditorWorkspace
                activeTab={activeTab}
                viewMode={viewMode}
                settings={settings}
                noteNames={noteNames}
                onWikiLinkClick={handleWikiLinkClick}
                onEmbedClick={handleEmbedClick}
                onTagClick={handleTagClick}
                onFrontmatterChange={handleFrontmatterChange}
              />
            </EditorErrorBoundary>
          ) : (
            <WelcomeScreen />
          )}
        </main>

        {rightPanelOpen && (
          <ResizableSidebar
            side="right"
            width={rightPanelWidth}
            minWidth={SIDEBAR_WIDTH_LIMITS.right.min}
            maxWidth={SIDEBAR_WIDTH_LIMITS.right.max}
            onWidthChange={setRightPanelWidth}
            onResizeEnd={(w) => persistSidebarWidths(leftSidebarWidth, w)}
            className="border-l border-sidebar-border bg-sidebar text-sidebar-foreground"
          >
            <Tabs
              value={rightPanelTab}
              onValueChange={(v) =>
                startTransition(() => setRightPanelTab(v as typeof rightPanelTab))
              }
              className="flex h-full flex-col"
            >
              <TabsList className="mx-2 mt-2 grid w-auto grid-cols-2 gap-1 sm:grid-cols-4">
                <TabsTrigger value="outline" className="text-xs">
                  大纲
                </TabsTrigger>
                <TabsTrigger value="links" className="text-xs">
                  链接
                </TabsTrigger>
                <TabsTrigger value="tags" className="text-xs">
                  标签
                </TabsTrigger>
                <TabsTrigger value="blockref" className="text-xs">
                  板块
                </TabsTrigger>
              </TabsList>
              <div className="min-h-0 flex-1 overflow-hidden">
                {rightPanelTab === "outline" && <OutlinePanel />}
                {rightPanelTab === "links" && <LinksPanel />}
                {rightPanelTab === "tags" && <TagsPanel />}
                {rightPanelTab === "blockref" && <BlockRefPanel />}
              </div>
            </Tabs>
          </ResizableSidebar>
        )}
      </div>

      <SearchDialog />
      <QuickSwitcherDialog />
      <FindReplaceDialog />
      <SettingsDialog />
      <HelpDialog />
      <ExportDialog />
    </div>
  );
}

function WelcomeScreen() {
  const openVault = useAppStore((s) => s.requestOpenVault);
  const vaultPath = useAppStore((s) => s.vaultPath);
  const [recent, setRecent] = useState<VaultInfo[]>([]);

  useEffect(() => {
    if (vaultPath) return;
    void listRecentVaults()
      .then(setRecent)
      .catch(() => setRecent([]));
  }, [vaultPath]);

  if (vaultPath) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-8 text-center shadow-sm">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-6 w-6" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">选择笔记开始编辑</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            从左侧文件树中点击一个笔记，或新建笔记后开始写作。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="welcome-canvas flex flex-1 flex-col items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-2xl border border-border/80 bg-card p-8 text-center shadow-sm">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <PenLine className="h-6 w-6" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">MarkDown 编辑器</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          语法、阅读、Word 式编辑三种视图。打开一个文件夹作为知识库开始写作。
        </p>
        <button
          type="button"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          onClick={() => void openVault()}
        >
          打开 Vault
        </button>
        {recent.length > 0 && (
          <div className="mt-6 w-full text-left">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              最近打开
            </p>
            <ul className="space-y-1">
              {recent.map((vault) => (
                <li key={vault.path}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-transparent px-3 py-2 text-left transition-colors hover:border-border hover:bg-accent/70"
                    onClick={() => void openVault(vault.path)}
                  >
                    <div className="text-sm font-medium">{vault.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{vault.path}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-6 text-xs text-muted-foreground">
          <kbd className="app-kbd">Ctrl</kbd>
          <span className="mx-1">+</span>
          <kbd className="app-kbd">O</kbd>
          <span className="mx-2">快速切换</span>
          <kbd className="app-kbd">Ctrl</kbd>
          <span className="mx-1">+</span>
          <kbd className="app-kbd">S</kbd>
          <span className="ml-1">保存</span>
        </p>
      </div>
    </div>
  );
}
