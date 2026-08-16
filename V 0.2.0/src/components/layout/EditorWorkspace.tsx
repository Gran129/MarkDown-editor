import { memo } from "react";

import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { SourceEditor } from "@/components/editor/SourceEditor";
import { FrontmatterEditor } from "@/components/editor/FrontmatterEditor";
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
  return (
    <>
      {viewMode !== "source" && (
        <FrontmatterEditor
          frontmatter={activeTab.frontmatter}
          readOnly={viewMode === "reading"}
          onChange={onFrontmatterChange}
        />
      )}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {viewMode === "source" ? (
          <SourceEditor
            key={activeTab.path}
            path={activeTab.path}
            content={activeTab.content}
            frontmatter={activeTab.frontmatter}
            fontSize={settings.font_size}
            lineHeight={settings.line_height}
            autoSaveMs={settings.auto_save_ms}
          />
        ) : (
          <MarkdownEditor
            key={activeTab.path}
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
        )}
      </div>
    </>
  );
});
