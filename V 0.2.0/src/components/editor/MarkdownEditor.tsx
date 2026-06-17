import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import { ExtendedTableCell, ExtendedTableHeader } from "@/extensions/table-extended";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { common, createLowlight } from "lowlight";
import { Markdown } from "tiptap-markdown";
import mermaid from "mermaid";
import { useCallback, useEffect, useRef } from "react";

import {
  MarkdownBold,
  MarkdownCode,
  MarkdownHighlight,
  MarkdownStrike,
  MarkdownSubscript,
  MarkdownSuperscript,
  MarkdownUnderline,
} from "@/extensions/markdown-marks";
import { ParagraphBlock } from "@/extensions/paragraph-block";
import { BlockReference } from "@/extensions/block-reference";
import { ColoredCodeBlock } from "@/extensions/colored-code-block";
import { WikiLink } from "@/extensions/wiki-link";
import { TagMark } from "@/extensions/tag-mark";
import { Callout } from "@/extensions/callout";
import { Embed } from "@/extensions/embed";
import { MathBlock } from "@/extensions/math-block";
import { MathInline } from "@/extensions/math-inline";
import { useAppStore } from "@/stores/app-store";
import { useEditorStore } from "@/stores/editor-store";
import { saveDraft } from "@/lib/tauri-api";
import { resolveLinkTarget, sanitizeBrokenWikiLinksInMarkdown } from "@/lib/link-attrs";
import { preprocessMarkdown, postprocessMarkdown } from "@/lib/markdown-transform";
import { syncParagraphBlocksInMarkdown } from "@/lib/block-markdown";
import { refreshSameFileBlockReferences, refreshSyncedBlockReferences } from "@/lib/block-sync";
import { syncTablesInMarkdown } from "@/lib/table-markdown";
import { finalizeWikiLinkMarkdown } from "@/lib/wiki-link-serialize";
import { createWikiLinkSuggestionRenderer } from "@/lib/suggestion-renderer";

import { EditorToolbar } from "./EditorToolbar";
import { TableMenu } from "./TableMenu";
import { LinkPreview } from "./LinkPreview";

import "katex/dist/katex.min.css";

const lowlight = createLowlight(common);

mermaid.initialize({ startOnLoad: false, theme: "neutral" });

interface MarkdownEditorProps {
  path: string;
  content: string;
  frontmatter: Record<string, unknown>;
  fontSize: number;
  lineHeight: number;
  autoSaveMs: number;
  noteNames: string[];
  onWikiLinkClick: (target: string) => void;
  onEmbedClick: (target: string) => void;
  onTagClick: (tag: string) => void;
}

export function MarkdownEditor({
  path,
  content,
  frontmatter,
  fontSize,
  lineHeight,
  autoSaveMs,
  noteNames,
  onWikiLinkClick,
  onEmbedClick,
  onTagClick,
}: MarkdownEditorProps) {
  const updateTabContent = useAppStore((s) => s.updateTabContent);
  const saveTab = useAppStore((s) => s.saveTab);
  const tabs = useAppStore((s) => s.tabs);
  const setEditor = useEditorStore((s) => s.setEditor);
  const setEditorScrollEl = useEditorStore((s) => s.setEditorScrollEl);
  const setSelectedBlockRef = useEditorStore((s) => s.setSelectedBlockRef);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const getMarkdownFromEditor = useCallback((ed: Editor) => {
    const storage = ed.storage as { markdown: { getMarkdown: () => string } };
    const raw = storage.markdown.getMarkdown();
    const repaired = finalizeWikiLinkMarkdown(ed, raw);
    const withTables = syncTablesInMarkdown(ed, repaired);
    const withParagraphs = syncParagraphBlocksInMarkdown(ed, withTables);
    const body = postprocessMarkdown(withParagraphs);
    return sanitizeBrokenWikiLinksInMarkdown(body);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        bold: false,
        strike: false,
        code: false,
        paragraph: false,
      }),
      MarkdownBold,
      MarkdownUnderline,
      MarkdownStrike,
      MarkdownCode,
      ParagraphBlock,
      BlockReference,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "editor-link", rel: "noopener noreferrer" },
      }),
      Image,
      Placeholder.configure({ placeholder: "开始写作…" }),
      Table.configure({ resizable: true }),
      TableRow,
      ExtendedTableCell,
      ExtendedTableHeader,
      ColoredCodeBlock.configure({ lowlight }),
      TaskList,
      TaskItem.configure({ nested: true }),
      MarkdownHighlight.configure({ multicolor: true }),
      MarkdownSuperscript,
      MarkdownSubscript,
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      WikiLink.configure({
        suggestion: {
          char: "[[",
          allowSpaces: true,
          items: ({ query }: { query: string }) =>
            noteNames
              .filter((n) => n.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 12)
              .map((n) => ({ id: n, label: n })),
          command: ({ editor: ed, range, props }) => {
            ed.chain()
              .focus()
              .deleteRange(range)
              .setWikiLink({ target: props.id, label: props.label })
              .run();
          },
          render: createWikiLinkSuggestionRenderer,
        },
      }),
      TagMark,
      Callout,
      Embed,
      MathBlock,
      MathInline,
    ],
    content: preprocessMarkdown(content, noteNames),
    editorProps: {
      attributes: {
        class: "tiptap prose prose-sm max-w-none focus:outline-none",
        style: `font-size: ${fontSize}px; --editor-line-height: ${lineHeight}`,
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement;
        const wikiEl = target.closest("[data-wiki-link]");
        if (wikiEl) {
          const noteTarget = resolveLinkTarget(
            wikiEl.getAttribute("data-target"),
            wikiEl.getAttribute("data-label") ?? wikiEl.textContent,
          );
          if (noteTarget) onWikiLinkClick(noteTarget);
          return true;
        }
        const embedEl = target.closest("[data-embed]");
        if (embedEl) {
          const embedTarget = resolveLinkTarget(
            embedEl.getAttribute("data-target"),
            embedEl.textContent,
          );
          if (embedTarget) onEmbedClick(embedTarget);
          return true;
        }
        const tagEl = target.closest("[data-tag]");
        if (tagEl) {
          const tag = tagEl.getAttribute("data-tag-name");
          if (tag) onTagClick(tag);
          return true;
        }
        const blockRefEl = target.closest("[data-block-ref]");
        if (blockRefEl) {
          setSelectedBlockRef({
            sourceFile: blockRefEl.getAttribute("data-source-file") ?? "",
            blockId: blockRefEl.getAttribute("data-block-id") ?? "",
            sync: blockRefEl.getAttribute("data-sync") === "true",
            nodePos: null,
          });
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md = getMarkdownFromEditor(ed);
      updateTabContent(path, md, frontmatter);

      if (blockSyncTimer.current) clearTimeout(blockSyncTimer.current);
      blockSyncTimer.current = setTimeout(() => {
        const $from = ed.state.selection.$from;
        if ($from.parent.type.name === "paragraph" && $from.parent.attrs.blockId) {
          refreshSameFileBlockReferences(
            ed,
            $from.parent.attrs.blockId as string,
            $from.parent.textContent,
          );
        }
        void refreshSyncedBlockReferences(ed, path, (p) =>
          tabs.find((t) => t.path === p)?.content,
        );
      }, 400);

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const full = serializeWithFrontmatter(frontmatter, md);
        await saveDraft(path, full);
        await saveTab(path);
      }, autoSaveMs);
    },
  });

  useEffect(() => {
    setEditorScrollEl(editorContainerRef.current);
    return () => setEditorScrollEl(null);
  }, [setEditorScrollEl]);

  useEffect(() => {
    setEditor(editor);
    return () => {
      if (editor) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        const md = getMarkdownFromEditor(editor);
        updateTabContent(path, md, frontmatter);
      }
      setEditor(null);
    };
  }, [editor, setEditor, getMarkdownFromEditor, updateTabContent, path, frontmatter]);

  useEffect(() => {
    if (!editor) return;
    const el = editor.view.dom as HTMLElement;
    el.style.fontSize = `${fontSize}px`;
    el.style.setProperty("--editor-line-height", String(lineHeight));
    el.style.lineHeight = String(lineHeight);
  }, [editor, fontSize, lineHeight]);

  useEffect(() => {
    if (!editor) return;
    void refreshSyncedBlockReferences(editor, path, (p) =>
      tabs.find((t) => t.path === p)?.content,
    );
  }, [editor, path, tabs]);

  useEffect(() => {
    if (!editor) return;
    const current = getMarkdownFromEditor(editor);
    if (current !== content) {
      editor.commands.setContent(preprocessMarkdown(content, noteNames));
    }
  }, [path, content, editor, noteNames, getMarkdownFromEditor]);

  useEffect(() => {
    if (!editor || !editorContainerRef.current) return;

    const renderMermaid = async () => {
      const blocks = editorContainerRef.current?.querySelectorAll("pre code.language-mermaid");
      if (!blocks?.length) return;

      for (const code of blocks) {
        const pre = code.parentElement;
        if (!pre || pre.dataset.mermaidRendered === "true") continue;
        const source = code.textContent?.trim();
        if (!source) continue;

        const container = document.createElement("div");
        container.className = "mermaid-diagram";
        pre.insertAdjacentElement("afterend", container);

        try {
          const { svg } = await mermaid.render(`mmd-${Math.random().toString(36).slice(2)}`, source);
          container.innerHTML = svg;
          pre.dataset.mermaidRendered = "true";
        } catch {
          container.remove();
        }
      }
    };

    void renderMermaid();
    editor.on("update", renderMermaid);
    return () => {
      editor.off("update", renderMermaid);
    };
  }, [editor]);

  return (
    <div className="flex h-full flex-col">
      <EditorToolbar editor={editor} filePath={path} noteNames={noteNames} />
      <TableMenu editor={editor} />
      <div ref={editorContainerRef} className="relative flex-1 overflow-auto">
        <EditorContent editor={editor} className="h-full" />
        <LinkPreview editor={editor} containerRef={editorContainerRef} />
      </div>
    </div>
  );
}

function serializeWithFrontmatter(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  if (Object.keys(frontmatter).length === 0) return body;
  const lines = Object.entries(frontmatter).map(([k, v]) => {
    if (Array.isArray(v)) return `${k}: [${v.map((i) => `"${i}"`).join(", ")}]`;
    return `${k}: ${v}`;
  });
  return `---\n${lines.join("\n")}\n---\n\n${body}`;
}

export function useEditorSaveShortcut(saveTab: (path: string) => void, path: string) {
  return useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void saveTab(path);
      }
    },
    [saveTab, path],
  );
}
