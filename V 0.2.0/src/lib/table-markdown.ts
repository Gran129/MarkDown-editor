import type { Node as PMNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/core";

import type { TableColAlign } from "@/extensions/table-extended";

/** MDED 表格单元格元数据前缀（不与 Obsidian [[、==、%% 等冲突） */
const MDED_META_RE = /^⟦mded\s+([^⟧]+)⟧/;
const PIPE_TABLE_LINE_RE = /^\|(.+)\|$/;
const SEPARATOR_CELL_RE = /^:?-+:?$/;

export interface ParsedCellMeta {
  colspan: number;
  rowspan: number;
  align: TableColAlign;
  backgroundColor: string | null;
  text: string;
}

function parseMetaString(raw: string): Omit<ParsedCellMeta, "text"> {
  const meta = {
    colspan: 1,
    rowspan: 1,
    align: null as TableColAlign,
    backgroundColor: null as string | null,
  };
  for (const part of raw.split(";")) {
    const [key, value] = part.trim().split("=").map((s) => s.trim());
    if (!key || !value) continue;
    switch (key) {
      case "colspan":
        meta.colspan = Math.max(1, Number.parseInt(value, 10) || 1);
        break;
      case "rowspan":
        meta.rowspan = Math.max(1, Number.parseInt(value, 10) || 1);
        break;
      case "align":
        if (value === "left" || value === "center" || value === "right") meta.align = value;
        break;
      case "bg":
        meta.backgroundColor = value.startsWith("#") ? value : `#${value}`;
        break;
    }
  }
  return meta;
}

export function parseCellContent(raw: string): ParsedCellMeta {
  const trimmed = raw.trim();
  const match = trimmed.match(MDED_META_RE);
  if (!match) {
    return { colspan: 1, rowspan: 1, align: null, backgroundColor: null, text: trimmed };
  }
  const meta = parseMetaString(match[1]!);
  return { ...meta, text: trimmed.slice(match[0].length).trim() };
}

function formatMeta(meta: Omit<ParsedCellMeta, "text">): string {
  const parts: string[] = [];
  if (meta.colspan > 1) parts.push(`colspan=${meta.colspan}`);
  if (meta.rowspan > 1) parts.push(`rowspan=${meta.rowspan}`);
  if (meta.align && meta.align !== "left") parts.push(`align=${meta.align}`);
  if (meta.backgroundColor) {
    parts.push(`bg=${meta.backgroundColor.replace(/^#/, "")}`);
  }
  if (parts.length === 0) return "";
  return `⟦mded ${parts.join(";")}⟧`;
}

function escapeCellText(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function splitPipeRow(line: string): string[] {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  let escaped = false;
  for (const char of inner) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => SEPARATOR_CELL_RE.test(c.trim()));
}

function parseSeparatorAlign(cell: string): TableColAlign {
  const t = cell.trim();
  if (t.startsWith(":") && t.endsWith(":")) return "center";
  if (t.endsWith(":")) return "right";
  return "left";
}

function formatSeparatorCell(align: TableColAlign): string {
  if (align === "center") return ":---:";
  if (align === "right") return "---:";
  return ":---";
}

function renderCellHtml(cell: ParsedCellMeta, tag: "td" | "th"): string {
  const attrs: string[] = [];
  if (cell.colspan > 1) attrs.push(`colspan="${cell.colspan}"`);
  if (cell.rowspan > 1) attrs.push(`rowspan="${cell.rowspan}"`);
  const styles: string[] = [];
  if (cell.align) {
    attrs.push(`data-col-align="${cell.align}"`);
    styles.push(`text-align:${cell.align}`);
  }
  if (cell.backgroundColor) {
    attrs.push(`data-bg-color="${cell.backgroundColor}"`);
    styles.push(`background-color:${cell.backgroundColor}`);
  }
  if (styles.length) attrs.push(`style="${styles.join(";")}"`);
  const attrStr = attrs.length ? ` ${attrs.join(" ")}` : "";
  const body = cell.text ? `<p>${escapeHtml(cell.text)}</p>` : "<p></p>";
  return `<${tag}${attrStr}>${body}</${tag}>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pipeTableBlockToHtml(lines: string[]): string {
  if (lines.length < 2) return lines.join("\n");

  const headerCells = splitPipeRow(lines[0]!);
  const secondCells = splitPipeRow(lines[1]!);
  const hasSeparator = isSeparatorRow(secondCells);
  const colAligns = hasSeparator
    ? secondCells.map(parseSeparatorAlign)
    : headerCells.map(() => "left" as TableColAlign);

  const bodyStart = hasSeparator ? 2 : 1;
  const bodyLines = lines.slice(bodyStart);

  const headerHtml = headerCells
    .map((raw, i) => {
      const parsed = parseCellContent(raw);
      if (!parsed.align && colAligns[i]) parsed.align = colAligns[i]!;
      return renderCellHtml(parsed, "th");
    })
    .join("");

  const bodyHtml = bodyLines
    .map((line) => {
      const cells = splitPipeRow(line).map(parseCellContent);
      const row = cells
        .map((cell, i) => {
          if (!cell.align && colAligns[i]) cell.align = colAligns[i]!;
          return renderCellHtml(cell, "td");
        })
        .join("");
      return `<tr>${row}</tr>`;
    })
    .join("");

  return `<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

/** 将含 MDED 扩展语法的 pipe 表格转为 HTML，供 TipTap 解析 */
export function preprocessMdedTables(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  let inCodeBlock = false;

  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      out.push(line);
      i++;
      continue;
    }
    if (inCodeBlock || !PIPE_TABLE_LINE_RE.test(line.trim())) {
      out.push(line);
      i++;
      continue;
    }

    const block: string[] = [];
    while (i < lines.length && PIPE_TABLE_LINE_RE.test(lines[i]!.trim())) {
      block.push(lines[i]!);
      i++;
    }
    out.push(pipeTableBlockToHtml(block));
  }

  return out.join("\n");
}

function getCellAlignFromNode(cell: PMNode): TableColAlign {
  return (cell.attrs.colAlign as TableColAlign) ?? null;
}

function getCellBgFromNode(cell: PMNode): string | null {
  return (cell.attrs.backgroundColor as string | null) ?? null;
}

function serializeCell(cell: PMNode): ParsedCellMeta {
  return {
    colspan: (cell.attrs.colspan as number) ?? 1,
    rowspan: (cell.attrs.rowspan as number) ?? 1,
    align: getCellAlignFromNode(cell),
    backgroundColor: getCellBgFromNode(cell),
    text: cell.textContent,
  };
}

export function serializeTableNode(table: PMNode): string {
  const rows: PMNode[] = [];
  table.forEach((row) => rows.push(row));
  if (rows.length === 0) return "";

  const lines: string[] = [];
  const firstRow = rows[0]!;
  const headerCells: ParsedCellMeta[] = [];
  firstRow.forEach((cell) => headerCells.push(serializeCell(cell)));

  lines.push(
    `| ${headerCells.map((c) => `${formatMeta(c)}${escapeCellText(c.text)}`).join(" | ")} |`,
  );

  const colAligns = headerCells.map((c) => c.align ?? "left");
  lines.push(`| ${colAligns.map(formatSeparatorCell).join(" | ")} |`);

  for (let r = 1; r < rows.length; r++) {
    const cells: ParsedCellMeta[] = [];
    rows[r]!.forEach((cell) => cells.push(serializeCell(cell)));
    lines.push(
      `| ${cells.map((c) => `${formatMeta(c)}${escapeCellText(c.text)}`).join(" | ")} |`,
    );
  }

  return lines.join("\n");
}

/** 用编辑器中的表格节点覆盖 markdown 里的表格（HTML 或 pipe） */
export function syncTablesInMarkdown(editor: Editor, markdown: string): string {
  const tableNodes: PMNode[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "table") tableNodes.push(node);
  });

  if (tableNodes.length === 0) return markdown;

  const tablePattern =
    /<table[\s\S]*?<\/table>|\|[^\n]+\|\n(?:\|[^\n]+\|\n?)+/gi;

  let index = 0;
  return markdown.replace(tablePattern, (match) => {
    const node = tableNodes[index];
    if (!node) return match;
    index++;
    return serializeTableNode(node);
  });
}

/** 将残留的 HTML 表格转为 MDED pipe 表格 */
export function postprocessHtmlTables(md: string): string {
  return md.replace(/<table[\s\S]*?<\/table>/gi, (html) => htmlTableToMded(html));
}

function htmlTableToMded(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return html;

  const rows = [...table.querySelectorAll("tr")];
  if (rows.length === 0) return html;

  const parsedRows = rows.map((row) =>
    [...row.querySelectorAll("th,td")].map((cell) => {
      const el = cell as HTMLElement;
      const align = (el.getAttribute("data-col-align") ||
        el.style.textAlign ||
        null) as TableColAlign;
      const bg = el.getAttribute("data-bg-color") || el.style.backgroundColor || null;
      return {
        colspan: Number.parseInt(el.getAttribute("colspan") || "1", 10) || 1,
        rowspan: Number.parseInt(el.getAttribute("rowspan") || "1", 10) || 1,
        align: align === "left" || align === "center" || align === "right" ? align : null,
        backgroundColor: bg || null,
        text: el.textContent?.trim() ?? "",
      } satisfies ParsedCellMeta;
    }),
  );

  const header = parsedRows[0]!;
  const body = parsedRows.slice(1);
  const lines: string[] = [];

  lines.push(
    `| ${header.map((c) => `${formatMeta(c)}${escapeCellText(c.text)}`).join(" | ")} |`,
  );
  lines.push(
    `| ${header.map((c) => formatSeparatorCell(c.align ?? "left")).join(" | ")} |`,
  );
  for (const row of body) {
    lines.push(
      `| ${row.map((c) => `${formatMeta(c)}${escapeCellText(c.text)}`).join(" | ")} |`,
    );
  }
  return lines.join("\n");
}
