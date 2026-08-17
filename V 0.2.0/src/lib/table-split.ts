import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";

function emptyCellKeys(table: PMNode): Set<string> {
  const keys = new Set<string>();
  let row = 0;
  table.forEach((rowNode) => {
    let col = 0;
    rowNode.forEach((cell) => {
      if (!cell.textContent.trim()) keys.add(`${row}:${col}`);
      col += Number(cell.attrs.colspan ?? 1);
    });
    row += 1;
  });
  return keys;
}

function findTableContext($from: import("@tiptap/pm/model").ResolvedPos): {
  tablePos: number;
  table: PMNode;
  cellPos: number;
  cell: PMNode;
} | null {
  let cellPos: number | null = null;
  let cell: PMNode | null = null;
  let tablePos: number | null = null;
  let table: PMNode | null = null;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if ((node.type.name === "tableCell" || node.type.name === "tableHeader") && !cell) {
      cell = node;
      cellPos = $from.before(d);
    }
    if (node.type.name === "table") {
      table = node;
      tablePos = $from.before(d);
      break;
    }
  }
  if (table && tablePos != null && cell && cellPos != null) {
    return { tablePos, table, cellPos, cell };
  }
  return null;
}

function cloneCellContent(editor: Editor, cell: PMNode) {
  return cell.content.size ? cell.content : editor.schema.nodes.paragraph!.create();
}

/** Split a merged cell and copy the merged text into the new empty cells. */
export function splitMergedCellKeepContent(editor: Editor): boolean {
  const ctx = findTableContext(editor.state.selection.$from);
  if (!ctx) return false;
  const colspan = Number(ctx.cell.attrs.colspan ?? 1);
  const rowspan = Number(ctx.cell.attrs.rowspan ?? 1);
  if (colspan <= 1 && rowspan <= 1) return false;

  const beforeEmpty = emptyCellKeys(ctx.table);
  const content = cloneCellContent(editor, ctx.cell);
  const split = editor.chain().focus().splitCell().run();
  if (!split) {
    return editor
      .chain()
      .focus()
      .updateAttributes(ctx.cell.type.name, { colspan: 1, rowspan: 1 })
      .run();
  }

  const table = editor.state.doc.nodeAt(ctx.tablePos);
  if (!table || table.type.name !== "table") return true;
  const afterEmpty = emptyCellKeys(table);
  const created: string[] = [];
  afterEmpty.forEach((key) => {
    if (!beforeEmpty.has(key)) created.push(key);
  });
  if (created.length === 0) return true;

  let tr = editor.state.tr;
  let row = 0;
  table.forEach((rowNode, rowOffset) => {
    let col = 0;
    rowNode.forEach((cell, cellOffset) => {
      const key = `${row}:${col}`;
      if (created.includes(key) && !cell.textContent.trim()) {
        const abs = ctx.tablePos + 1 + rowOffset + 1 + cellOffset;
        const from = abs + 1;
        const to = abs + cell.nodeSize - 1;
        tr = tr.replaceWith(from, to, content);
      }
      col += Number(cell.attrs.colspan ?? 1);
    });
    row += 1;
  });
  if (tr.docChanged) editor.view.dispatch(tr);
  return true;
}
