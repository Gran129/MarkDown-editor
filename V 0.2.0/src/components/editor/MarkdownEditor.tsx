import { convertFileSrc } from "@tauri-apps/api/core";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { mergeAttributes } from "@tiptap/core";
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
import { useCallback, useEffect, useMemo, useRef } from "react";

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
import { isRemoteMedia, resolveNoteMediaFile } from "@/lib/note-format";
import { isOfficeFileName } from "@/lib/office";
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
  active?: boolean;
  editable?: boolean;
  showToolbar?: boolean;
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
  active = true,
  editable = true,
  showToolbar = true,
  onWikiLinkClick,
  onEmbedClick,
  onTagClick,
}: MarkdownEditorProps) {
  const updateTabContent = useAppStore((s) => s.updateTabContent);
  const editableRef = useRef(editable);
  editableRef.current = editable;
  const saveTab = useAppStore((s) => s.saveTab);
  const tabs = useAppStore((s) => s.tabs);
  const setEditor = useEditorStore((s) => s.setEditor);
  const setEditorScrollEl = useEditorStore((s) => s.setEditorScrollEl);
  const setSelectedBlockRef = useEditorStore((s) => s.setSelectedBlockRef);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef(path);
  pathRef.current = path;

  const onWikiLinkClickRef = useRef(onWikiLinkClick);
  onWikiLinkClickRef.current = onWikiLinkClick;
  const onEmbedClickRef = useRef(onEmbedClick);
  onEmbedClickRef.current = onEmbedClick;
  const onTagClickRef = useRef(onTagClick);
  onTagClickRef.current = onTagClick;

  const frontmatterRef = useRef(frontmatter);
  frontmatterRef.current = frontmatter;
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const editorRef = useRef<Editor | null>(null);

  const getMarkdownFromEditor = useCallback((ed: Editor) => {
    const storage = ed.storage as { markdown: { getMarkdown: () => string } };
    const raw = storage.markdown.getMarkdown();
    const repaired = finalizeWikiLinkMarkdown(ed, raw);
    const withTables = syncTablesInMarkdown(ed, repaired);
    const withParagraphs = syncParagraphBlocksInMarkdown(ed, withTables);
    const body = postprocessMarkdown(withParagraphs);
    return sanitizeBrokenWikiLinksInMarkdown(body);
  }, []);

  const initialContent = useMemo(() => {
    try {
      return preprocessMarkdown(content, noteNames);
    } catch (error) {
      console.error("Failed to preprocess markdown:", error);
      return content;
    }
  }, [content, noteNames]);

  const extensions = useMemo(
    () => [
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
      Image.extend({
        renderHTML({ HTMLAttributes }) {
          const src = typeof HTMLAttributes.src === "string" ? HTMLAttributes.src : "";
          const resolved = (() => {
            if (!src || isRemoteMedia(src)) return src;
            const abs = resolveNoteMediaFile(
              pathRef.current,
              useAppStore.getState().vaultPath,
              src,
            );
            try {
              return convertFileSrc(abs);
            } catch {
              return abs;
            }
          })();
          return [
            "img",
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { src: resolved }),
          ];
        },
      }),
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
    [noteNames],
  );

  const editorProps = useMemo(
    () => ({
      attributes: {
        class: `tiptap prose prose-sm max-w-none focus:outline-none${editable ? "" : " is-readonly"}`,
        style: `font-size: ${fontSize}px; --editor-line-height: ${lineHeight}`,
      },
      handleClick: (view: import("@tiptap/pm/view").EditorView, _pos: number, event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const wikiEl = target.closest("[data-wiki-link]");
        if (wikiEl) {
          const noteTarget = resolveLinkTarget(
            wikiEl.getAttribute("data-target"),
            wikiEl.getAttribute("data-label") ?? wikiEl.textContent,
          );
          if (noteTarget) onWikiLinkClickRef.current(noteTarget);
          return true;
        }
        const embedEl = target.closest("[data-embed]");
        if (embedEl) {
          const embedTarget = resolveLinkTarget(
            embedEl.getAttribute("data-target"),
            embedEl.textContent,
          );
          if (embedTarget) {
            if (isOfficeFileName(embedTarget)) return true;
            onEmbedClickRef.current(embedTarget);
          }
          return true;
        }
        const tagEl = target.closest("[data-tag]");
        if (tagEl) {
          const tag = tagEl.getAttribute("data-tag-name");
          if (tag) onTagClickRef.current(tag);
          return true;
        }
        const blockRefEl = target.closest("[data-block-ref]");
        if (blockRefEl) {
          let sourceFile = blockRefEl.getAttribute("data-source-file") ?? "";
          let blockId = blockRefEl.getAttribute("data-block-id") ?? "";
          let sync = blockRefEl.getAttribute("data-sync") === "true";
          try {
            const pos = view.posAtDOM(blockRefEl, 0);
            const $pos = view.state.doc.resolve(pos);
            for (let depth = $pos.depth; depth >= 0; depth--) {
              const node = $pos.node(depth);
              if (node.type.name === "blockReference") {
                sourceFile = (node.attrs.sourceFile as string) || sourceFile;
                blockId = (node.attrs.blockId as string) || blockId;
                sync = Boolean(node.attrs.sync);
                break;
              }
            }
          } catch {
            /* fall back to DOM attributes */
          }
          setSelectedBlockRef({
            sourceFile,
            blockId,
            sync,
            nodePos: null,
          });
          return true;
        }
        return false;
      },
    }),
    [editable, fontSize, lineHeight, setSelectedBlockRef],
  );

  const editor = useEditor(
    {
      extensions,
      content: initialContent,
      editable,
      editorProps,
      shouldRerenderOnTransaction: false,
      onContentError: ({ error }) => {
        console.error("TipTap content error:", error);
      },
      onUpdate: ({ editor: ed }) => {
        if (!editableRef.current) return;
        const md = getMarkdownFromEditor(ed);
        updateTabContent(pathRef.current, md, frontmatterRef.current);

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
          void refreshSyncedBlockReferences(ed, pathRef.current, (p) =>
            tabsRef.current.find((t) => t.path === p)?.content,
          );
        }, 400);

        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
          const full = serializeWithFrontmatter(frontmatterRef.current, md);
          await saveDraft(pathRef.current, full);
          await saveTab(pathRef.current);
        }, autoSaveMs);
      },
    },
    [extensions],
  );

  editorRef.current = editor;

  useEffect(() => {
    return () => {
      const ed = editorRef.current;
      if (ed && !ed.isDestroyed) {
        try {
          ed.destroy();
        } catch {
          /* TipTap/React may race during teardown */
        }
      }
    };
  }, [path]);

  useEffect(() => {
    if (!active) {
      setEditorScrollEl(null);
      return;
    }
    setEditorScrollEl(editorContainerRef.current);
    return () => setEditorScrollEl(null);
  }, [setEditorScrollEl, editor, active]);

  useEffect(() => {
    if (!active) {
      setEditor(null);
      return;
    }
    setEditor(editor);
    return () => setEditor(null);
  }, [editor, setEditor, active]);

  useEffect(() => {
    return () => {
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed || !editableRef.current) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const md = getMarkdownFromEditor(ed);
      updateTabContent(pathRef.current, md, frontmatterRef.current);
    };
  }, [getMarkdownFromEditor, updateTabContent]);

  useEffect(() => {
    if (!editor || !active) return;
    editor.setEditable(editable);
    editor.view.dom.classList.toggle("is-readonly", !editable);
  }, [editor, editable, active]);

  useEffect(() => {
    if (!editor || !active) return;
    const el = editor.view.dom as HTMLElement;
    el.style.fontSize = `${fontSize}px`;
    el.style.setProperty("--editor-line-height", String(lineHeight));
    el.style.lineHeight = String(lineHeight);
  }, [editor, fontSize, lineHeight, active]);

  useEffect(() => {
    if (!editor || !active) return;
    const timer = window.setTimeout(() => {
      void refreshSyncedBlockReferences(editor, path, (p) =>
        tabsRef.current.find((t) => t.path === p)?.content,
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editor, path, active]);

  useEffect(() => {
    if (!editor || !active || !editorContainerRef.current) return;

    let mermaidTimer: ReturnType<typeof setTimeout> | null = null;

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

    const scheduleMermaid = () => {
      if (mermaidTimer) clearTimeout(mermaidTimer);
      mermaidTimer = setTimeout(() => {
        void renderMermaid();
      }, 120);
    };

    scheduleMermaid();
    editor.on("update", scheduleMermaid);
    return () => {
      if (mermaidTimer) clearTimeout(mermaidTimer);
      editor.off("update", scheduleMermaid);
    };
  }, [editor, active]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      {showToolbar && (
        <div className="w-full min-w-0 shrink-0 overflow-hidden">
          <EditorToolbar editor={editor} filePath={path} noteNames={noteNames} />
        </div>
      )}
      {showToolbar && <TableMenu editor={editor} />}
      <div ref={editorContainerRef} className="relative min-h-0 flex-1 overflow-auto">
        {editor ? (
          <EditorContent editor={editor} className="min-h-full" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            正在加载编辑器…
          </div>
        )}
        <LinkPreview
          editor={editor}
          containerRef={editorContainerRef}
          onInternalNavigate={onWikiLinkClick}
        />
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
