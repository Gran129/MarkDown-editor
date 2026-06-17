/** 生成短 block ID（不与 Obsidian 语法冲突） */
export function generateBlockId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

export interface ParagraphBlockMeta {
  blockId: string | null;
  textIndent: string | null;
  marginLeft: string | null;
  marginBefore: string | null;
  marginAfter: string | null;
  paragraphLineHeight: string | null;
}

const BLOCK_COMMENT_RE = /<!--\s*mded-block:([^>]+?)\s*-->/;

export function parseBlockComment(raw: string): Partial<ParagraphBlockMeta> {
  const meta: Partial<ParagraphBlockMeta> = {};
  for (const part of raw.split(";")) {
    const [key, value] = part.trim().split("=").map((s) => s.trim());
    if (!key || value === undefined) continue;
    switch (key) {
      case "id":
        meta.blockId = value;
        break;
      case "ti":
        meta.textIndent = value;
        break;
      case "ml":
        meta.marginLeft = value;
        break;
      case "mb":
        meta.marginBefore = value;
        break;
      case "ma":
        meta.marginAfter = value;
        break;
      case "lh":
        meta.paragraphLineHeight = value;
        break;
    }
  }
  return meta;
}

export function formatBlockComment(meta: ParagraphBlockMeta): string {
  const parts: string[] = [];
  if (meta.blockId) parts.push(`id=${meta.blockId}`);
  if (meta.textIndent) parts.push(`ti=${meta.textIndent}`);
  if (meta.marginLeft) parts.push(`ml=${meta.marginLeft}`);
  if (meta.marginBefore) parts.push(`mb=${meta.marginBefore}`);
  if (meta.marginAfter) parts.push(`ma=${meta.marginAfter}`);
  if (meta.paragraphLineHeight) parts.push(`lh=${meta.paragraphLineHeight}`);
  if (parts.length === 0) return "";
  return ` <!-- mded-block:${parts.join(";")} -->`;
}

export function stripBlockComment(line: string): { text: string; meta: Partial<ParagraphBlockMeta> } {
  const match = line.match(BLOCK_COMMENT_RE);
  if (!match) return { text: line, meta: {} };
  return {
    text: line.replace(BLOCK_COMMENT_RE, "").trimEnd(),
    meta: parseBlockComment(match[1]!),
  };
}

/** 从 Markdown 正文中按 blockId 提取段落纯文本 */
export function extractBlockTextFromMarkdown(md: string, blockId: string): string | null {
  for (const line of md.split("\n")) {
    const { text, meta } = stripBlockComment(line);
    if (meta.blockId === blockId && text.trim()) {
      return text.trim();
    }
  }
  return null;
}

export function buildParagraphStyle(meta: Partial<ParagraphBlockMeta>): string {
  const styles: string[] = [];
  if (meta.textIndent) styles.push(`text-indent:${meta.textIndent}`);
  if (meta.marginLeft) styles.push(`margin-left:${meta.marginLeft}`);
  if (meta.marginBefore) styles.push(`margin-top:${meta.marginBefore}`);
  if (meta.marginAfter) styles.push(`margin-bottom:${meta.marginAfter}`);
  if (meta.paragraphLineHeight) styles.push(`line-height:${meta.paragraphLineHeight}`);
  return styles.join(";");
}
