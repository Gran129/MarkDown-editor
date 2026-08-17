import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";

import { extractBlockTextFromMarkdown } from "@/lib/block-utils";
import { readFile } from "@/lib/tauri-api";

let syncPaused = false;

export function isBlockSyncPaused(): boolean {
  return syncPaused;
}

function replaceInnerContent(tr: import("@tiptap/pm/state").Transaction, pos: number, node: PMNode, source: PMNode) {
  const from = pos + 1;
  const to = pos + node.nodeSize - 1;
  return tr.replaceWith(from, to, source.content);
}

function replaceInnerParagraph(tr: import("@tiptap/pm/state").Transaction, pos: number, node: PMNode, text: string) {
  const innerNode = node.firstChild;
  if (!innerNode) return tr;
  if (node.childCount === 1 && innerNode.textContent === text) return tr;
  const from = pos + 1;
  const to = pos + node.nodeSize - 1;
  const paragraph = tr.doc.type.schema.nodes.paragraph!.create(
    innerNode.attrs,
    text ? tr.doc.type.schema.text(text) : null,
  );
  return tr.replaceWith(from, to, paragraph);
}

function collectSynced(editor: Editor, currentFilePath: string) {
  const sel = editor.state.selection;
  const items: { pos: number; node: PMNode; blockId: string; sourceFile: string }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "blockReference") return true;
    if (!node.attrs.sync) return true;
    if (sel.from >= pos && sel.to <= pos + node.nodeSize) return true;
    items.push({
      pos,
      node,
      blockId: String(node.attrs.blockId ?? ""),
      sourceFile: String(node.attrs.sourceFile || currentFilePath),
    });
    return true;
  });
  return items;
}

function sourceNodeFor(editor: Editor, blockId: string, exceptPos: number): PMNode | null {
  let parent: PMNode | null = null;
  let any: PMNode | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "blockReference") return true;
    if (String(node.attrs.blockId ?? "") !== blockId) return true;
    if (pos === exceptPos) return true;
    if (node.attrs.role !== "child") parent = node;
    any = node;
    return true;
  });
  return parent ?? any;
}

/** 刷新文档中开启同步的板块引用内容 */
export async function refreshSyncedBlockReferences(
  editor: Editor,
  currentFilePath: string,
  getTabContent: (path: string) => string | undefined,
): Promise<void> {
  if (syncPaused || editor.isDestroyed) return;

  const pending = collectSynced(editor, currentFilePath);
  if (pending.length === 0) return;

  const contentCache = new Map<string, string>();
  const updates: { pos: number; node: PMNode; source?: PMNode; text?: string }[] = [];

  for (const item of pending) {
    const live = sourceNodeFor(editor, item.blockId, item.pos);
    if (live) {
      updates.push({ pos: item.pos, node: item.node, source: live });
      continue;
    }
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
    if (item.node.firstChild?.textContent === text && item.node.childCount === 1) continue;
    updates.push({ pos: item.pos, node: item.node, text });
  }

  if (updates.length === 0 || editor.isDestroyed) return;

  syncPaused = true;
  try {
    let tr = editor.state.tr;
    for (const item of [...updates].sort((a, b) => b.pos - a.pos)) {
      const latest = tr.doc.nodeAt(item.pos);
      if (!latest || latest.type.name !== "blockReference") continue;
      if (item.source) tr = replaceInnerContent(tr, item.pos, latest, item.source);
      else if (item.text != null) tr = replaceInnerParagraph(tr, item.pos, latest, item.text);
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
  _newText: string,
): void {
  if (syncPaused || editor.isDestroyed) return;

  const sel = editor.state.selection;
  let source: PMNode | null = null;
  const targets: number[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "blockReference") return true;
    if (!node.attrs.sync) return true;
    if (String(node.attrs.blockId ?? "") !== blockId) return true;
    if (sel.from >= pos && sel.to <= pos + node.nodeSize) {
      source = node;
      return true;
    }
    targets.push(pos);
    return true;
  });
  if (!source || targets.length === 0) return;

  syncPaused = true;
  try {
    let tr = editor.state.tr;
    for (const pos of [...targets].sort((a, b) => b - a)) {
      const node = tr.doc.nodeAt(pos);
      if (!node || node.type.name !== "blockReference") continue;
      tr = replaceInnerContent(tr, pos, node, source);
    }
    if (tr.docChanged) editor.view.dispatch(tr);
  } finally {
    syncPaused = false;
  }
}
