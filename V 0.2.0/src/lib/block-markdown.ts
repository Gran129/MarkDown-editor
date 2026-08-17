import type { Node as PMNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/core";

import {
  buildParagraphStyle,
  formatBlockComment,
  parseBlockComment,
  stripBlockComment,
  type ParagraphBlockMeta,
} from "@/lib/block-utils";

const BLOCK_REF_START_RE =
  /^⟦block-ref\s+file="([^"]*)"\s+id="([^"]*)"\s+sync="([01])"(?:\s+role="(parent|child)")?(?:\s+text="([^"]*)")?⟧$/;
const BLOCK_REF_END_RE = /^⟦\/block-ref⟧$/;

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function findMatchingEnd(lines: string[], start: number): number {
  let depth = 1;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (BLOCK_REF_START_RE.test(line)) depth++;
    else if (BLOCK_REF_END_RE.test(line)) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function innerLinesToHtml(lines: string[]): string {
  if (lines.length === 0) return "<p></p>";
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const start = lines[i]!.trim().match(BLOCK_REF_START_RE);
    if (start) {
      const parsed = parseBlockFrom(lines, i);
      out.push(parsed.html);
      i = parsed.next;
      continue;
    }
    const text = lines[i]!;
    out.push(text.trim() ? `<p>${escapeAttr(text)}</p>` : "<p></p>");
    i++;
  }
  return out.join("") || "<p></p>";
}

function parseBlockFrom(lines: string[], i: number): { html: string; next: number } {
  const match = lines[i]!.trim().match(BLOCK_REF_START_RE);
  if (!match) {
    return { html: lines[i]!, next: i + 1 };
  }
  const [, file, blockId, sync, role, snapshotText] = match;
  const end = findMatchingEnd(lines, i + 1);
  let inner: string;
  let next: number;
  if (end >= 0) {
    inner = innerLinesToHtml(lines.slice(i + 1, end));
    next = end + 1;
  } else if (snapshotText) {
    inner = `<p>${escapeAttr(decodeURIComponent(snapshotText))}</p>`;
    next = i + 1;
  } else {
    inner = "<p></p>";
    next = i + 1;
  }
  const html = `<div data-block-ref="true" data-source-file="${escapeAttr(file!)}" data-block-id="${escapeAttr(blockId!)}" data-sync="${sync === "1" ? "true" : "false"}" data-role="${role === "child" ? "child" : "parent"}" class="block-reference">${inner}</div>`;
  return { html, next };
}

export function preprocessBlockRefs(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (BLOCK_REF_START_RE.test(lines[i]!.trim())) {
      const parsed = parseBlockFrom(lines, i);
      out.push(parsed.html);
      i = parsed.next;
      continue;
    }
    out.push(lines[i]!);
    i++;
  }
  return out.join("\n");
}

export function preprocessParagraphBlocks(md: string): string {
  const lines = md.split("\n");
  let inFence = false;
  let inQuestion = false;
  let blockDepth = 0;
  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (/^```/.test(trimmed)) {
        inFence = !inFence;
        return line;
      }
      if (!inFence && /^:::question\b/.test(trimmed)) inQuestion = true;
      if (inQuestion && trimmed === ":::") {
        inQuestion = false;
        return line;
      }
      if (!inFence && BLOCK_REF_START_RE.test(trimmed)) blockDepth++;
      if (blockDepth && BLOCK_REF_END_RE.test(trimmed)) {
        blockDepth--;
        return line;
      }
      if (inFence || inQuestion || blockDepth > 0) return line;
      if (trimmed.startsWith("<")) return line;

      const { text, meta } = stripBlockComment(line);
      if (Object.keys(meta).length === 0) return line;

      const style = buildParagraphStyle(meta);
      const attrs: string[] = [];
      if (meta.blockId) attrs.push(`data-block-id="${meta.blockId}"`);
      if (style) attrs.push(`style="${style}"`);
      if (meta.textIndent) attrs.push(`data-text-indent="${meta.textIndent}"`);
      if (meta.marginLeft) attrs.push(`data-margin-left="${meta.marginLeft}"`);
      if (meta.marginBefore) attrs.push(`data-margin-before="${meta.marginBefore}"`);
      if (meta.marginAfter) attrs.push(`data-margin-after="${meta.marginAfter}"`);
      if (meta.paragraphLineHeight)
        attrs.push(`data-line-height="${meta.paragraphLineHeight}"`);

      if (attrs.length === 0) return text;
      return `<p ${attrs.join(" ")}>${text || "<br/>"}</p>`;
    })
    .join("\n");
}

function paragraphMetaFromNode(node: PMNode): ParagraphBlockMeta {
  return {
    blockId: (node.attrs.blockId as string | null) ?? null,
    textIndent: (node.attrs.textIndent as string | null) ?? null,
    marginLeft: (node.attrs.marginLeft as string | null) ?? null,
    marginBefore: (node.attrs.marginBefore as string | null) ?? null,
    marginAfter: (node.attrs.marginAfter as string | null) ?? null,
    paragraphLineHeight: (node.attrs.paragraphLineHeight as string | null) ?? null,
  };
}

export function syncParagraphBlocksInMarkdown(editor: Editor, markdown: string): string {
  const paragraphs: { text: string; meta: ParagraphBlockMeta }[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name !== "paragraph") return;
    if (node.textContent.length === 0 && !node.attrs.blockId) return;
    paragraphs.push({ text: node.textContent, meta: paragraphMetaFromNode(node) });
  });

  if (paragraphs.length === 0) return markdown;

  let index = 0;
  let inFence = false;
  let inQuestion = false;
  let blockDepth = 0;
  const lines = markdown.split("\n");
  const out = lines.map((line) => {
    const trimmed = line.trim();
    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      return line;
    }
    if (!inFence && /^:::question\b/.test(trimmed)) inQuestion = true;
    if (inQuestion && trimmed === ":::") {
      inQuestion = false;
      return line;
    }
    if (!inFence && BLOCK_REF_START_RE.test(trimmed)) blockDepth++;
    if (blockDepth && BLOCK_REF_END_RE.test(trimmed)) {
      blockDepth--;
      return line;
    }
    if (inFence || inQuestion || blockDepth > 0) return line;
    if (!line.trim() || line.startsWith("#") || line.startsWith("|") || line.startsWith(">")) {
      return line;
    }
    if (line.startsWith("<") || line.includes("data-block-ref") || line.includes("data-question")) {
      return line;
    }
    if (line.match(/^⟦block-ref/) || line.match(/^⟦question/) || line.match(/^⟦\/question⟧/)) {
      return line;
    }

    const para = paragraphs[index];
    index++;
    if (!para) return line;

    const comment = formatBlockComment(para.meta);
    if (!comment) return line;
    const base = para.text || line.replace(/<!--\s*mded-block:[^>]+-->/, "").trim();
    return `${base}${comment}`;
  });

  return out.join("\n");
}

function serializeBlockRefInner(node: PMNode): string {
  const parts: string[] = [];
  node.forEach((child) => {
    if (child.type.name === "blockReference") {
      parts.push(serializeBlockRefNode(child));
    } else if (child.type.name === "paragraph") {
      const comment = formatBlockComment(paragraphMetaFromNode(child));
      parts.push(`${child.textContent}${comment}`);
    } else {
      parts.push(child.textContent);
    }
  });
  return parts.join("\n");
}

export function serializeBlockRefNode(node: PMNode): string {
  const file = String(node.attrs.sourceFile ?? "");
  const blockId = String(node.attrs.blockId ?? "");
  const sync = node.attrs.sync === false ? "0" : "1";
  const role = node.attrs.role === "child" ? "child" : "parent";
  const inner = serializeBlockRefInner(node);
  return `⟦block-ref file="${file}" id="${blockId}" sync="${sync}" role="${role}"⟧\n${inner}\n⟦/block-ref⟧`;
}

export function syncBlockRefsInMarkdown(editor: Editor, markdown: string): string {
  const nodes: PMNode[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "blockReference") {
      nodes.push(node);
      return false;
    }
  });
  if (nodes.length === 0) return markdown;

  let index = 0;
  return markdown.replace(
    /<div[^>]*data-block-ref="true"[^>]*>[\s\S]*?<\/div>\s*|⟦block-ref[\s\S]*?⟦\/block-ref⟧\s*|⟦block-ref[^\n]*⟧\s*/gi,
    (match) => {
      const node = nodes[index];
      if (!node) return match;
      index++;
      return `${serializeBlockRefNode(node)}\n`;
    },
  );
}

export function postprocessBlockRefs(md: string): string {
  return md.replace(
    /<div[^>]*data-block-ref="true"[^>]*>[\s\S]*?<\/div>/gi,
    (full) => {
      const file = full.match(/data-source-file="([^"]*)"/i)?.[1] ?? "";
      const blockId = full.match(/data-block-id="([^"]*)"/i)?.[1] ?? "";
      const sync = /data-sync="false"/i.test(full) ? "0" : "1";
      const role = /data-role="child"/i.test(full) ? "child" : "parent";
      const inner = full
        .replace(/^<div[^>]*>/i, "")
        .replace(/<\/div>$/i, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<p[^>]*>/gi, "")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .trim();
      return `⟦block-ref file="${file}" id="${blockId}" sync="${sync}" role="${role}"⟧\n${inner}\n⟦/block-ref⟧`;
    },
  );
}

export function parseBlockRefLine(line: string) {
  return line.match(BLOCK_REF_START_RE);
}

export { parseBlockComment, stripBlockComment };
