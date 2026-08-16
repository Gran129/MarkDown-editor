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
import { OrderedListKeys } from "@/extensions/ordered-list-keys";
import { WikiLink } from "@/extensions/wiki-link";
import { TagMark } from "@/extensions/tag-mark";
import { Callout } from "@/extensions/callout";
import { Embed } from "@/extensions/embed";
import { MathBlock } from "@/extensions/math-block";
import { MathInline } from "@/extensions/math-inline";
import { useAppStore } from "@/stores/app-store";
import { useEditorStore } from "@/stores/editor-store";
import { saveDraft } from "@/lib/tauri-api";
import { getMarkdownFromEditor } from "@/lib/editor-markdown";
import { serializeFrontmatter } from "@/lib/markdown";
import { resolveLinkTarget } from "@/lib/link-attrs";
import { isRemoteMedia, resolveNoteMediaFile } from "@/lib/note-format";
import { isOfficeFileName } from "@/lib/office";
import { preprocessMarkdown } from "@/lib/markdown-transform";
import { refreshSameFileBlockReferences, refreshSyncedBlockReferences } from "@/lib/block-sync";
import { createWikiLinkSuggestionRenderer } from "@/lib/suggestion-renderer";
import { insertEmbedAtPoint, isResourceDrag, resourcePathFromEvent } from "@/lib/insert-embed";
import { endResourceDrag, getResourceDrag } from "@/lib/resource-drag";
import { cn } from "@/lib/utils";

import { EditorToolbar } from "./EditorToolbar";
import { TableMenu } from "./TableMenu";
import { LinkPreview } from "./LinkPreview";

import "katex/dist/katex.min.css";

const lowlight = createLowlight(common);

interface MarkdownEditorProps {
  path: string;
  content: string;
  frontmatter: Record<string, unknown>;
  fontSize: number;
  lineHeight: number;
  autoSaveEnabled?: boolean;
  autoSaveMinutes?: number;
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
  autoSaveEnabled = false,
  autoSaveMinutes = 1,
  noteNames,
  active = true,
  editable = true,
  showToolbar = true,
  onWikiLinkClick,
  onEmbedClick,
  onTagClick,
}: MarkdownEditorProps) {
  const updateTabContent = useAppStore((s) => s.updateTabContent);
  const markSelfWrite = useAppStore((s) => s.markSelfWrite);
  const editableRef = useRef(editable);
  editableRef.current = editable;
  const tabs = useAppStore((s) => s.tabs);
  const setEditor = useEditorStore((s) => s.setEditor);
  const setEditorScrollEl = useEditorStore((s) => s.setEditorScrollEl);
  const setSelectedBlockRef = useEditorStore((s) => s.setSelectedBlockRef);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const dropCaretRef = useRef<HTMLDivElement>(null);
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
  const noteNamesRef = useRef(noteNames);
  noteNamesRef.current = noteNames;
  const autoSaveEnabledRef = useRef(autoSaveEnabled);
  autoSaveEnabledRef.current = autoSaveEnabled;
  const autoSaveMinutesRef = useRef(autoSaveMinutes);
  autoSaveMinutesRef.current = autoSaveMinutes;

  const initialContent = useMemo(() => {
    try {
      return preprocessMarkdown(content, noteNames);
    } catch (error) {
      console.error("Failed to preprocess markdown:", error);
      return content;
    }
    // Only used on first mount of this editor instance (keyed by path).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      OrderedListKeys,
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
            noteNamesRef.current
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
    [],
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
      handleDragOver: (view: import("@tiptap/pm/view").EditorView, event: DragEvent) => {
        if (!isResourceDrag(event)) return false;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        const caret = dropCaretRef.current;
        const container = editorContainerRef.current;
        if (!caret || !container) return true;
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (!coords) {
          caret.style.display = "none";
          return true;
        }
        try {
          const at = view.coordsAtPos(coords.pos);
          const rect = container.getBoundingClientRect();
          caret.style.display = "block";
          caret.style.top = `${at.top - rect.top + container.scrollTop}px`;
          caret.style.left = `${at.left - rect.left + container.scrollLeft}px`;
          caret.style.height = `${Math.max(16, at.bottom - at.top)}px`;
        } catch {
          caret.style.display = "none";
        }
        return true;
      },
      handleDrop: (view: import("@tiptap/pm/view").EditorView, event: DragEvent) => {
        const resource = resourcePathFromEvent(event);
        if (dropCaretRef.current) dropCaretRef.current.style.display = "none";
        if (!resource) return false;
        event.preventDefault();
        return insertEmbedAtPoint(view, event.clientX, event.clientY, resource);
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
      immediatelyRender: false,
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
        if (!autoSaveEnabledRef.current) return;
        const delay = Math.max(1, autoSaveMinutesRef.current) * 60_000;
        saveTimer.current = setTimeout(async () => {
          const full = serializeFrontmatter(frontmatterRef.current, md);
          markSelfWrite(2000);
          await saveDraft(pathRef.current, full);
        }, delay);
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
  }, [updateTabContent]);

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
    const onOver = (event: DragEvent) => {
      if (!getResourceDrag()) return;
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(".editor-drop-surface, .tiptap")) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const onDrop = (event: DragEvent) => {
      const resource = resourcePathFromEvent(event);
      if (!resource) return;
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(".editor-drop-surface, .tiptap")) return;
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed) return;
      event.preventDefault();
      insertEmbedAtPoint(ed.view, event.clientX, event.clientY, resource);
      endResourceDrag();
    };
    const onEnd = () => endResourceDrag();
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragend", onEnd);
    return () => {
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", onEnd);
    };
  }, []);

  useEffect(() => {
    if (!editor || !active) return;
    const timer = window.setTimeout(() => {
      void refreshSyncedBlockReferences(editor, path, (p) =>
        tabsRef.current.find((t) => t.path === p)?.content,
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editor, path, active]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div
        className={cn(
          "w-full min-w-0 shrink-0 overflow-hidden",
          !showToolbar && "pointer-events-none invisible h-0 overflow-hidden",
        )}
        aria-hidden={!showToolbar}
      >
        <EditorToolbar editor={editor} filePath={path} noteNames={noteNames} />
      </div>
      <div
        className={cn(!showToolbar && "pointer-events-none invisible h-0 overflow-hidden")}
        aria-hidden={!showToolbar}
      >
        <TableMenu editor={editor} />
      </div>
      <div
        ref={editorContainerRef}
        className="editor-drop-surface relative min-h-0 flex-1 overflow-auto"
        onDragOver={(event) => {
          if (!isResourceDrag(event.nativeEvent)) return;
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          const resource = resourcePathFromEvent(event.nativeEvent);
          if (!resource || !editor || editor.isDestroyed) return;
          event.preventDefault();
          insertEmbedAtPoint(editor.view, event.clientX, event.clientY, resource);
          endResourceDrag();
        }}
        onDragLeave={() => {
          if (dropCaretRef.current) dropCaretRef.current.style.display = "none";
        }}
      >
        {editor ? (
          <EditorContent editor={editor} className="min-h-full" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            正在加载编辑器…
          </div>
        )}
        <div ref={dropCaretRef} className="editor-drop-caret" aria-hidden />
        <LinkPreview
          editor={editor}
          containerRef={editorContainerRef}
          onInternalNavigate={onWikiLinkClick}
        />
      </div>
    </div>
  );
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
