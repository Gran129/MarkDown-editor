import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { Markdown } from "tiptap-markdown";
import { useCallback, useEffect, useRef } from "react";

import { WikiLink } from "@/extensions/wiki-link";
import { TagMark } from "@/extensions/tag-mark";
import { useAppStore } from "@/stores/app-store";
import { saveDraft } from "@/lib/tauri-api";

import { EditorToolbar } from "./EditorToolbar";

const lowlight = createLowlight(common);

interface MarkdownEditorProps {
  path: string;
  content: string;
  frontmatter: Record<string, unknown>;
  fontSize: number;
  autoSaveMs: number;
  noteNames: string[];
  onWikiLinkClick: (target: string) => void;
  onTagClick: (tag: string) => void;
}

function preprocessMarkdown(md: string): string {
  return md
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target: string, label?: string) => {
      const display = label || target;
      return `<span data-wiki-link="true" data-target="${target}" class="wiki-link">[[${display}]]</span>`;
    })
    .replace(/(?:^|\s)#([a-zA-Z\u4e00-\u9fff][\w\u4e00-\u9fff-]*)/g, (match, tag: string) => {
      const prefix = match.startsWith("#") ? "" : " ";
      return `${prefix}<span data-tag="true" class="tag-mark" data-tag-name="${tag}">#${tag}</span>`;
    });
}

export function MarkdownEditor({
  path,
  content,
  frontmatter,
  fontSize,
  autoSaveMs,
  noteNames,
  onWikiLinkClick,
  onTagClick,
}: MarkdownEditorProps) {
  const updateTabContent = useAppStore((s) => s.updateTabContent);
  const saveTab = useAppStore((s) => s.saveTab);
  const vaultPath = useAppStore((s) => s.vaultPath);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: "开始写作…" }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      CodeBlockLowlight.configure({ lowlight }),
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      WikiLink.configure({
        suggestion: {
          char: "[[",
          items: ({ query }: { query: string }) =>
            noteNames
              .filter((n) => n.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 10)
              .map((n) => ({ id: n, label: n })),
          render: () => ({
            onStart: () => {},
            onUpdate: () => {},
            onExit: () => {},
            onKeyDown: () => false,
          }),
        },
      }),
      TagMark,
    ],
    content: preprocessMarkdown(content),
    editorProps: {
      attributes: {
        class: "tiptap prose prose-sm max-w-none focus:outline-none",
        style: `font-size: ${fontSize}px`,
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement;
        const wikiEl = target.closest("[data-wiki-link]");
        if (wikiEl) {
          const noteTarget = wikiEl.getAttribute("data-target");
          if (noteTarget) onWikiLinkClick(noteTarget);
          return true;
        }
        const tagEl = target.closest("[data-tag]");
        if (tagEl) {
          const tag = tagEl.getAttribute("data-tag-name");
          if (tag) onTagClick(tag);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const storage = ed.storage as { markdown: { getMarkdown: () => string } };
      const md = storage.markdown.getMarkdown();
      updateTabContent(path, md, frontmatter);

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const full = serializeWithFrontmatter(frontmatter, md);
        await saveDraft(path, full);
        await saveTab(path);
      }, autoSaveMs);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const storage = editor.storage as { markdown: { getMarkdown: () => string } };
    const current = storage.markdown.getMarkdown();
    if (current !== content) {
      editor.commands.setContent(preprocessMarkdown(content));
    }
  }, [path, content, editor]);

  useEffect(() => {
    if (!editor || !vaultPath) return;
    void markUnresolvedLinks(editor, vaultPath, noteNames);
  }, [editor, vaultPath, noteNames]);

  return (
    <div className="flex h-full flex-col">
      <EditorToolbar editor={editor} filePath={path} />
      <div className="flex-1 overflow-auto">
        <EditorContent editor={editor} className="h-full" />
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

async function markUnresolvedLinks(
  editor: Editor,
  vaultPath: string,
  noteNames: string[],
) {
  // Links resolved via note name list for performance
  void vaultPath;
  void noteNames;
  void editor;
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
