import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import { serializeFrontmatter, tryParseFrontmatter } from "@/lib/markdown";
import { saveDraft } from "@/lib/tauri-api";
import { useAppStore } from "@/stores/app-store";
import { useEditorStore } from "@/stores/editor-store";

interface SourceEditorProps {
  path: string;
  content: string;
  frontmatter: Record<string, unknown>;
  fontSize: number;
  lineHeight: number;
  autoSaveEnabled?: boolean;
  autoSaveMinutes?: number;
  active?: boolean;
}

export function SourceEditor({
  path,
  content,
  frontmatter,
  fontSize,
  lineHeight,
  autoSaveEnabled = false,
  autoSaveMinutes = 1,
  active = true,
}: SourceEditorProps) {
  const updateTabContent = useAppStore((s) => s.updateTabContent);
  const markTabDirty = useAppStore((s) => s.markTabDirty);
  const markSelfWrite = useAppStore((s) => s.markSelfWrite);
  const setSourceScrollEl = useEditorStore((s) => s.setSourceScrollEl);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [text, setText] = useState(() => serializeFrontmatter(frontmatter, content));

  useEffect(() => {
    if (!active) {
      setSourceScrollEl(null);
      return;
    }
    setSourceScrollEl(textareaRef.current);
    return () => setSourceScrollEl(null);
  }, [setSourceScrollEl, active]);

  useEffect(() => {
    const next = serializeFrontmatter(frontmatter, content);
    if (document.activeElement !== textareaRef.current) {
      setText(next);
    }
  }, [content, frontmatter, path]);

  const applyText = useCallback(
    (next: string) => {
      setText(next);
      markTabDirty(path, true);
      const parsed = tryParseFrontmatter(next);
      if (parsed) {
        updateTabContent(path, parsed.body, parsed.frontmatter);
      }
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (!autoSaveEnabled) return;
      const delay = Math.max(1, autoSaveMinutes) * 60_000;
      saveTimer.current = setTimeout(() => {
        markSelfWrite(2000);
        void saveDraft(path, next);
      }, delay);
    },
    [autoSaveEnabled, autoSaveMinutes, markSelfWrite, markTabDirty, path, updateTabContent],
  );

  useEffect(() => {
    const el = textareaRef.current;
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const latest = el?.value;
      if (latest == null) return;
      const parsed = tryParseFrontmatter(latest);
      if (parsed) {
        updateTabContent(path, parsed.body, parsed.frontmatter);
      }
    };
  }, [path, updateTabContent]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const el = event.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = `${text.slice(0, start)}\t${text.slice(end)}`;
    applyText(next);
    requestAnimationFrame(() => {
      el.selectionStart = start + 1;
      el.selectionEnd = start + 1;
    });
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div className="flex h-8 shrink-0 items-center border-b border-border px-4 text-xs text-muted-foreground">
        Markdown 源码 · 编写语法后可切换到阅读或编辑视图预览效果
      </div>
      <textarea
        ref={textareaRef}
        className="source-editor min-h-0 w-full flex-1"
        value={text}
        spellCheck={false}
        aria-label="Markdown 源码"
        style={{ fontSize: `${fontSize}px`, lineHeight }}
        onChange={(event) => applyText(event.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
