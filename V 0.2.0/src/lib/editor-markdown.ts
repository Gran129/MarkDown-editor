import type { Editor } from "@tiptap/core";

import { syncBlockRefsInMarkdown, syncParagraphBlocksInMarkdown } from "@/lib/block-markdown";
import { finalizeWikiLinkMarkdown } from "@/lib/wiki-link-serialize";
import { syncTablesInMarkdown } from "@/lib/table-markdown";
import { postprocessMarkdown } from "@/lib/markdown-transform";
import { sanitizeBrokenWikiLinksInMarkdown } from "@/lib/link-attrs";

export function getMarkdownFromEditor(ed: Editor): string {
  const storage = ed.storage as { markdown: { getMarkdown: () => string } };
  const raw = storage.markdown.getMarkdown();
  const repaired = finalizeWikiLinkMarkdown(ed, raw);
  const withTables = syncTablesInMarkdown(ed, repaired);
  const withBlocks = syncBlockRefsInMarkdown(ed, withTables);
  const withParagraphs = syncParagraphBlocksInMarkdown(ed, withBlocks);
  const body = postprocessMarkdown(withParagraphs);
  return sanitizeBrokenWikiLinksInMarkdown(body);
}

export function autoSaveDelayMs(enabled: boolean, minutes: number): number {
  if (!enabled) return 0;
  const value = Number.isFinite(minutes) ? minutes : 1;
  return Math.max(1, value) * 60_000;
}
