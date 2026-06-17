import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileTreeSidebar } from "@/components/sidebar/FileTree";
import { LinksPanel } from "@/components/backlinks/BacklinksPanel";
import { TagsPanel } from "@/components/tags/TagsPanel";
import { TabBar } from "@/components/layout/TabBar";
import { TopBar } from "@/components/layout/TopBar";
import {
  ResizableSidebar,
  SIDEBAR_WIDTH_LIMITS,
  saveSidebarWidths,
} from "@/components/layout/ResizableSidebar";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { FrontmatterEditor } from "@/components/editor/FrontmatterEditor";
import { OutlinePanel } from "@/components/editor/OutlinePanel";
import { BlockRefPanel } from "@/components/editor/BlockRefPanel";
import { FindReplaceDialog } from "@/components/editor/FindReplaceDialog";
import { SearchDialog, QuickSwitcherDialog } from "@/components/search/SearchDialog";
import { SettingsDialog, HelpDialog } from "@/components/settings/SettingsDialog";
import { useAppStore } from "@/stores/app-store";
import { resolveNotePath, createFile } from "@/lib/tauri-api";

function flattenNoteNames(nodes: import("@/lib/types").FileNode[]): string[] {
  const names: string[] = [];
  for (const n of nodes) {
    if (n.is_dir && n.children) names.push(...flattenNoteNames(n.children));
    else if (!n.is_dir && n.name.endsWith(".md")) names.push(n.name.replace(/\.md$/i, ""));
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

  const noteNames = flattenNoteNames(fileTree);

  const handleWikiLinkClick = async (target: string) => {
    if (!vaultPath) return;
    const path = await resolveNotePath(vaultPath, target);
    if (path) {
      await openFile(path);
    } else if (window.confirm(`笔记「${target}」不存在，是否创建？`)) {
      const newPath = `${vaultPath}/${target}.md`;
      await createFile(newPath, `# ${target}\n`);
      await refreshFileTree();
      await openFile(newPath);
    }
  };

  const handleEmbedClick = async (target: string) => {
    if (!vaultPath) return;
    const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(target);
    if (isImage) return;
    await handleWikiLinkClick(target.replace(/\.md$/i, ""));
  };

  const persistSidebarWidths = (left: number, right: number) => {
    saveSidebarWidths(left, right);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
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
          {activeTab ? (
            <>
              <FrontmatterEditor
                frontmatter={activeTab.frontmatter}
                onChange={(fm) =>
                  updateTabContent(activeTab.path, activeTab.content, fm)
                }
              />
              <div className="flex-1 overflow-hidden">
                <MarkdownEditor
                  key={activeTab.path}
                  path={activeTab.path}
                  content={activeTab.content}
                  frontmatter={activeTab.frontmatter}
                  fontSize={settings.font_size}
                  lineHeight={settings.line_height}
                  autoSaveMs={settings.auto_save_ms}
                  noteNames={noteNames}
                  onWikiLinkClick={(t) => void handleWikiLinkClick(t)}
                  onEmbedClick={(t) => void handleEmbedClick(t)}
                  onTagClick={(tag) => setTagFilter(tag)}
                />
              </div>
            </>
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
            className="border-l border-border bg-background"
          >
            <Tabs
              value={rightPanelTab}
              onValueChange={(v) =>
                setRightPanelTab(v as typeof rightPanelTab)
              }
              className="flex h-full flex-col"
            >
              <TabsList className="mx-2 mt-2 grid w-auto grid-cols-4">
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
              <TabsContent value="outline" className="flex-1 overflow-hidden">
                <OutlinePanel />
              </TabsContent>
              <TabsContent value="links" className="flex-1 overflow-hidden">
                <LinksPanel />
              </TabsContent>
              <TabsContent value="tags" className="flex-1 overflow-hidden">
                <TagsPanel />
              </TabsContent>
              <TabsContent value="blockref" className="flex-1 overflow-hidden">
                <BlockRefPanel />
              </TabsContent>
            </Tabs>
          </ResizableSidebar>
        )}
      </div>

      <SearchDialog />
      <QuickSwitcherDialog />
      <FindReplaceDialog />
      <SettingsDialog />
      <HelpDialog />
    </div>
  );
}

function WelcomeScreen() {
  const openVault = useAppStore((s) => s.openVault);
  const vaultPath = useAppStore((s) => s.vaultPath);

  if (vaultPath) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-xl font-semibold">选择笔记开始编辑</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          从左侧文件树中点击一个笔记，或新建笔记后开始写作。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">MarkDown 编辑器</h1>
      <p className="max-w-md text-muted-foreground">
        Word 式所见即所得编辑，Obsidian 式 Vault 文件管理。打开一个文件夹作为知识库开始写作。
      </p>
      <button
        type="button"
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        onClick={() => void openVault()}
      >
        打开 Vault
      </button>
    </div>
  );
}
