export function isBrokenLinkValue(value: unknown): boolean {
  if (value == null) return true;
  const s = String(value).trim();
  return s === "" || s === "null" || s === "undefined";
}

export function resolveLinkTarget(target: unknown, label?: unknown): string {
  const t = isBrokenLinkValue(target) ? "" : String(target).trim();
  const l = isBrokenLinkValue(label) ? "" : String(label).trim();
  return t || l;
}

export function resolveLinkLabel(target: unknown, label?: unknown): string {
  const resolvedTarget = resolveLinkTarget(target, label);
  const l = isBrokenLinkValue(label) ? "" : String(label).trim();
  return l || resolvedTarget;
}

export function parseWikiLinkText(text: string): { target: string; label: string } | null {
  const match = text.trim().match(/^\[\[(?:([^|\]]+)\|)?([^\]]+)\]\]$/);
  if (!match) return null;
  const target = resolveLinkTarget(match[1], match[2]);
  const label = resolveLinkLabel(match[1], match[2]);
  if (!target) return null;
  return { target, label };
}

export function parseEmbedText(text: string): { target: string; size: string | null } | null {
  const match = text.trim().match(/^!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
  if (!match) return null;
  const target = resolveLinkTarget(match[1]);
  if (!target) return null;
  return { target, size: match[2]?.trim() || null };
}

export function normalizeWikiLinkAttrs(attrs: Record<string, unknown>): {
  target: string;
  label: string;
  unresolved: boolean;
} {
  const target = resolveLinkTarget(attrs.target, attrs.label);
  const label = resolveLinkLabel(attrs.target, attrs.label);
  return {
    target,
    label,
    unresolved: Boolean(attrs.unresolved),
  };
}

const BROKEN_WIKI_LINK_RE = /\[\[(?:null|undefined)(?:\|[^\]]*)?\]\]/g;

/** 将已损坏的 [[null]] / [[undefined]] 从 Markdown 正文中移除或按顺序替换 */
export function repairBrokenWikiLinksInMarkdown(md: string, replacements: string[]): string {
  let index = 0;
  return md.replace(BROKEN_WIKI_LINK_RE, () => replacements[index++] ?? "[[]]");
}

export function sanitizeBrokenWikiLinksInMarkdown(md: string): string {
  return md.replace(BROKEN_WIKI_LINK_RE, "[[]]");
}
