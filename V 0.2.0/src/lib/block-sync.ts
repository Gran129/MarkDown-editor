import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";

import { extractBlockTextFromMarkdown } from "@/lib/block-utils";
import { readFile } from "@/lib/tauri-api";

let syncPaused = false;

export function isBlockSyncPaused(): boolean {
  return syncPaused;
}

function replaceInnerParagraph(tr: import("@tiptap/pm/state").Transaction, pos: number, node: PMNode, text: string) {
  const innerPos = pos + 1;
  const innerNode = node.firstChild;
  if (!innerNode) return tr;
  if (node.childCount === 1 && innerNode.textContent === text) return tr;
  const from = innerPos;
  const to = pos + node.nodeSize - 1;
  const paragraph = tr.doc.type.schema.nodes.paragraph!.create(
    innerNode.attrs,
    text ? tr.doc.type.schema.text(text) : null,
  );
  return tr.replaceWith(from, to, paragraph);
}

/** 刷新文档中开启同步的板块引用内容 */
export async function refreshSyncedBlockReferences(
  editor: Editor,
  currentFilePath: string,
  getTabContent: (path: string) => string | undefined,
): Promise<void> {
  if (syncPaused || editor.isDestroyed) return;

  const pending: { sourceFile: string; blockId: string; pos: number; size: number }[] = [];
  const sel = editor.state.selection;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "blockReference") return false;
    if (!node.attrs.sync) return false;
    if (sel.from >= pos && sel.to <= pos + node.nodeSize) return false;
    pending.push({
      sourceFile: (node.attrs.sourceFile as string) || currentFilePath,
      blockId: node.attrs.blockId as string,
      pos,
      size: node.nodeSize,
    });
    return false;
  });

  if (pending.length === 0) return;

  const contentCache = new Map<string, string>();
  const updates: { pos: number; node: PMNode; text: string }[] = [];

  for (const item of pending) {
    let md = contentCache.get(item.sourceFile);
    if (md === undefined) {
      const fromTab = getTabContent(item.sourceFile);
      if (fromTab !== undefined) md = fromTab;
      else {
        try {
          md = await readFile(item.sourceFile);
        } catch {
          md = "";
        }
      }
      contentCache.set(item.sourceFile, md);
    }

    const text = extractBlockTextFromMarkdown(md, item.blockId);
    if (text === null) continue;
    const node = editor.state.doc.nodeAt(item.pos);
    if (!node || node.type.name !== "blockReference") continue;
    if (node.firstChild?.textContent === text && node.childCount === 1) continue;
    updates.push({ pos: item.pos, node, text });
  }

  if (updates.length === 0 || editor.isDestroyed) return;

  syncPaused = true;
  try {
    let tr = editor.state.tr;
    for (const item of [...updates].sort((a, b) => b.pos - a.pos)) {
      const latest = tr.doc.nodeAt(item.pos);
      if (!latest || latest.type.name !== "blockReference") continue;
      tr = replaceInnerParagraph(tr, item.pos, latest, item.text);
    }
    if (tr.docChanged) editor.view.dispatch(tr);
  } finally {
    syncPaused = false;
  }
}

/** 源板块变更时，更新同文件内的同步引用 */
export function refreshSameFileBlockReferences(
  editor: Editor,
  blockId: string,
  newText: string,
): void {
  if (syncPaused || editor.isDestroyed) return;

  const sel = editor.state.selection;
  const updates: { pos: number }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "blockReference") return false;
    if (!node.attrs.sync) return false;
    if (node.attrs.blockId !== blockId) return false;
    if (sel.from >= pos && sel.to <= pos + node.nodeSize) return false;
    if (node.firstChild?.textContent === newText && node.childCount === 1) return false;
    updates.push({ pos });
    return false;
  });

  if (updates.length === 0) return;

  syncPaused = true;
  try {
    let tr = editor.state.tr;
    for (const item of [...updates].sort((a, b) => b.pos - a.pos)) {
      const node = tr.doc.nodeAt(item.pos);
      if (!node || node.type.name !== "blockReference") continue;
      tr = replaceInnerParagraph(tr, item.pos, node, newText);
    }
    if (tr.docChanged) editor.view.dispatch(tr);
  } finally {
    syncPaused = false;
  }
}
