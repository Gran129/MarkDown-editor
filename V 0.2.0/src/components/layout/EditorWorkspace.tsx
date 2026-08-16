import { memo } from "react";

import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { SourceEditor } from "@/components/editor/SourceEditor";
import { FrontmatterEditor } from "@/components/editor/FrontmatterEditor";
import { cn } from "@/lib/utils";
import type { AppSettings, EditorViewMode, TabState } from "@/lib/types";

interface EditorWorkspaceProps {
  activeTab: TabState;
  viewMode: EditorViewMode;
  settings: AppSettings;
  noteNames: string[];
  onWikiLinkClick: (target: string) => void;
  onEmbedClick: (target: string) => void;
  onTagClick: (tag: string) => void;
  onFrontmatterChange: (frontmatter: Record<string, unknown>) => void;
}

export const EditorWorkspace = memo(function EditorWorkspace({
  activeTab,
  viewMode,
  settings,
  noteNames,
  onWikiLinkClick,
  onEmbedClick,
  onTagClick,
  onFrontmatterChange,
}: EditorWorkspaceProps) {
  const isSource = viewMode === "source";
  const isRich = !isSource;

  return (
    <>
      <div className={cn(isSource && "pointer-events-none invisible h-0 overflow-hidden")} aria-hidden={isSource}>
        <FrontmatterEditor
          frontmatter={activeTab.frontmatter}
          readOnly={viewMode === "reading"}
          onChange={onFrontmatterChange}
        />
      </div>
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        {/* Keep TipTap mounted while in source mode to avoid React/TipTap DOM teardown races. */}
        <div
          className={cn(
            "absolute inset-0 flex min-h-0 min-w-0 flex-col",
            isSource && "pointer-events-none invisible",
          )}
          aria-hidden={isSource}
        >
          <MarkdownEditor
            key={activeTab.path}
            active={isRich}
            path={activeTab.path}
            content={activeTab.content}
            frontmatter={activeTab.frontmatter}
            fontSize={settings.font_size}
            lineHeight={settings.line_height}
            autoSaveMs={settings.auto_save_ms}
            noteNames={noteNames}
            editable={viewMode === "editing"}
            showToolbar={viewMode === "editing"}
            onWikiLinkClick={onWikiLinkClick}
            onEmbedClick={onEmbedClick}
            onTagClick={onTagClick}
          />
        </div>
        <div
          className={cn(
            "absolute inset-0 flex min-h-0 min-w-0 flex-col",
            isRich && "pointer-events-none invisible",
          )}
          aria-hidden={isRich}
        >
          <SourceEditor
            key={activeTab.path}
            active={isSource}
            path={activeTab.path}
            content={activeTab.content}
            frontmatter={activeTab.frontmatter}
            fontSize={settings.font_size}
            lineHeight={settings.line_height}
            autoSaveMs={settings.auto_save_ms}
          />
        </div>
      </div>
    </>
  );
});
