import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileTreeSidebar } from "@/components/sidebar/FileTree";
import { BacklinksPanel, OutgoingLinksPanel } from "@/components/backlinks/BacklinksPanel";
import { TagsPanel } from "@/components/tags/TagsPanel";
import { GraphView } from "@/components/graph/GraphView";
import { TabBar } from "@/components/layout/TabBar";
import { TopBar } from "@/components/layout/TopBar";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { FrontmatterEditor } from "@/components/editor/FrontmatterEditor";
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

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {leftSidebarOpen && (
          <aside className="w-60 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <FileTreeSidebar />
          </aside>
        )}

        <main className="flex flex-1 flex-col overflow-hidden">
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
                  autoSaveMs={settings.auto_save_ms}
                  noteNames={noteNames}
                  onWikiLinkClick={(t) => void handleWikiLinkClick(t)}
                  onTagClick={(tag) => setTagFilter(tag)}
                />
              </div>
            </>
          ) : (
            <WelcomeScreen />
          )}
        </main>

        {rightPanelOpen && (
          <aside className="w-64 shrink-0 border-l border-border bg-background">
            <Tabs
              value={rightPanelTab}
              onValueChange={(v) =>
                setRightPanelTab(v as typeof rightPanelTab)
              }
              className="flex h-full flex-col"
            >
              <TabsList className="mx-2 mt-2 grid w-auto grid-cols-4">
                <TabsTrigger value="backlinks" className="text-xs">
                  反链
                </TabsTrigger>
                <TabsTrigger value="outgoing" className="text-xs">
                  出链
                </TabsTrigger>
                <TabsTrigger value="tags" className="text-xs">
                  标签
                </TabsTrigger>
                <TabsTrigger value="graph" className="text-xs">
                  图谱
                </TabsTrigger>
              </TabsList>
              <TabsContent value="backlinks" className="flex-1 overflow-hidden">
                <BacklinksPanel />
              </TabsContent>
              <TabsContent value="outgoing" className="flex-1 overflow-hidden">
                <OutgoingLinksPanel />
              </TabsContent>
              <TabsContent value="tags" className="flex-1 overflow-hidden">
                <TagsPanel />
              </TabsContent>
              <TabsContent value="graph" className="flex-1 overflow-hidden">
                <GraphView />
              </TabsContent>
            </Tabs>
          </aside>
        )}
      </div>

      <SearchDialog />
      <QuickSwitcherDialog />
      <SettingsDialog />
      <HelpDialog />
    </div>
  );
}

function WelcomeScreen() {
  const openVault = useAppStore((s) => s.openVault);

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
