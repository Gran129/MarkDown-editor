import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  try {
    const parsed = parseYaml(match[1] ?? "") as Record<string, unknown>;
    return {
      frontmatter: parsed ?? {},
      body: match[2] ?? "",
    };
  } catch {
    return { frontmatter: {}, body: content };
  }
}

export function serializeFrontmatter(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  if (Object.keys(frontmatter).length === 0) {
    return body;
  }
  const yaml = stringifyYaml(frontmatter).trim();
  return `---\n${yaml}\n---\n\n${body}`;
}

export function getNoteTitle(
  path: string,
  frontmatter: Record<string, unknown>,
): string {
  if (typeof frontmatter.title === "string" && frontmatter.title) {
    return frontmatter.title;
  }
  const name = path.split(/[/\\]/).pop() ?? path;
  return name.replace(/\.md$/i, "");
}

import { isBrokenLinkValue } from "@/lib/link-attrs";

export function extractWikiLinks(content: string): string[] {
  const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const links: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const target = match[1]!.trim();
    if (!isBrokenLinkValue(target)) links.push(target);
  }
  return [...new Set(links)];
}

export function extractTags(content: string, frontmatter: Record<string, unknown>): string[] {
  const inlineTags = [...content.matchAll(/(?:^|\s)#([a-zA-Z\u4e00-\u9fff][\w\u4e00-\u9fff-]*)/g)].map(
    (m) => m[1]!,
  );
  const fmTags = Array.isArray(frontmatter.tags)
    ? frontmatter.tags.filter((t): t is string => typeof t === "string")
    : [];
  return [...new Set([...inlineTags, ...fmTags])];
}

export function formatDailyNoteName(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}.md`;
}

export function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}
