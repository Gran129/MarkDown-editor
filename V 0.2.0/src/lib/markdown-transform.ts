import {
  isBrokenLinkValue,
  resolveLinkLabel,
  resolveLinkTarget,
  sanitizeBrokenWikiLinksInMarkdown,
} from "@/lib/link-attrs";
import { postprocessHtmlTables, preprocessMdedTables } from "@/lib/table-markdown";
import {
  postprocessBlockRefs,
  preprocessBlockRefs,
  preprocessParagraphBlocks,
} from "@/lib/block-markdown";
import {
  postprocessMdedInlineMarks,
  preprocessMdedInlineMarks,
} from "@/lib/inline-markdown";

const CALLOUT_TYPES = [
  "note",
  "tip",
  "important",
  "warning",
  "caution",
  "failure",
  "danger",
  "bug",
  "example",
  "quote",
  "abstract",
  "info",
  "success",
  "question",
  "faq",
  "help",
] as const;

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}

function defaultCalloutTitle(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

const CALLOUT_HEADER_RE = new RegExp(String.raw`^> \[!(\w+)](?:\s+(.+))?$`);

function preprocessCallouts(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const header = lines[i]?.match(CALLOUT_HEADER_RE);
    if (header && CALLOUT_TYPES.includes(header[1] as (typeof CALLOUT_TYPES)[number])) {
      const type = header[1]!;
      const title = header[2]?.trim() || defaultCalloutTitle(type);
      const body: string[] = [];
      i++;
      while (i < lines.length && lines[i]?.startsWith("> ")) {
        body.push(lines[i]!.slice(2));
        i++;
      }
      const content = body.join("\n").trim();
      out.push(
        `<div data-callout="${type}" data-title="${escapeAttr(title)}" class="callout callout-${type}"><p>${content.replace(/\n/g, "<br/>")}</p></div>`,
      );
      continue;
    }
    out.push(lines[i]!);
    i++;
  }

  return out.join("\n");
}

function postprocessCallouts(md: string): string {
  return md.replace(
    /<div[^>]*data-callout="(\w+)"[^>]*data-title="([^"]*)"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*?<\/div>/gi,
    (_, type: string, title: string, content: string) => {
      const plain = content.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
      const defaultTitle = defaultCalloutTitle(type);
      const titleLine = title && title !== defaultTitle ? ` [!${type}] ${title}` : ` [!${type}]`;
      const body = plain
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n");
      return `>${titleLine}\n${body}`;
    },
  );
}

function preprocessEmbeds(md: string): string {
  return md.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target: string, size?: string) => {
    const attrs = size ? ` data-size="${escapeAttr(size)}"` : "";
    return `<span data-embed="true" data-target="${escapeAttr(target)}"${attrs} class="embed">![[${target}]]</span>`;
  });
}

function postprocessEmbeds(md: string): string {
  return md.replace(
    /<span[^>]*data-embed="true"[^>]*data-target="([^"]+)"[^>]*>[\s\S]*?<\/span>/gi,
    (_, target: string) => `![[${target}]]`,
  );
}

function preprocessWikiLinks(md: string, noteNames: string[]): string {
  const cleaned = sanitizeBrokenWikiLinksInMarkdown(md);
  return cleaned.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, rawTarget: string, rawLabel?: string) => {
    if (isBrokenLinkValue(rawTarget) && isBrokenLinkValue(rawLabel)) {
      return "[[]]";
    }
    const target = resolveLinkTarget(rawTarget, rawLabel);
    if (!target) return "[[]]";
    const display = resolveLinkLabel(rawTarget, rawLabel);
    const unresolved = !noteNames.some((n) => n.toLowerCase() === target.toLowerCase());
    return `<span data-wiki-link="true" data-target="${escapeAttr(target)}" data-label="${escapeAttr(display)}" class="wiki-link${unresolved ? " unresolved" : ""}">[[${display}]]</span>`;
  });
}

function postprocessWikiLinks(md: string): string {
  return md.replace(
    /<span[^>]*data-wiki-link="true"[^>]*(?:data-target="([^"]*)")?(?:[^>]*data-label="([^"]*)")?[^>]*>\[\[(?:([^|\]]+)\|)?([^\]]+)\]\]<\/span>/gi,
    (_match, attrTarget: string, attrLabel: string, alias: string | undefined, display: string) => {
      const target = resolveLinkTarget(attrTarget, alias || display);
      if (!target) return `[[]]`;
      const label = resolveLinkLabel(attrTarget, attrLabel || alias || display);
      return label !== target ? `[[${target}|${label}]]` : `[[${target}]]`;
    },
  );
}

function preprocessHighlights(md: string): string {
  return md.replace(/(?<![=])==([^=\n]+?)==(?!=[=])/g, "<mark>$1</mark>");
}

function postprocessInlineHtml(md: string): string {
  let result = md;
  result = result.replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
  result = result.replace(/<b\b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**");
  result = result.replace(/<em\b[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");
  result = result.replace(/<i\b[^>]*>([\s\S]*?)<\/i>/gi, "*$1*");
  result = result.replace(/<mark\b[^>]*>([\s\S]*?)<\/mark>/gi, "==$1==");
  result = result.replace(/<del\b[^>]*>([\s\S]*?)<\/del>/gi, "~~$1~~");
  result = result.replace(/<s\b[^>]*>([\s\S]*?)<\/s>/gi, "~~$1~~");
  return result;
}

function preprocessTags(md: string): string {
  return md.replace(/(?:^|\s)#([a-zA-Z\u4e00-\u9fff][\w\u4e00-\u9fff-]*)/g, (match, tag: string) => {
    const prefix = match.startsWith("#") ? "" : " ";
    return `${prefix}<span data-tag="true" class="tag-mark" data-tag-name="${tag}">#${tag}</span>`;
  });
}

function postprocessTags(md: string): string {
  return md.replace(
    /<span[^>]*data-tag="true"[^>]*data-tag-name="([^"]+)"[^>]*>#([^<]*)<\/span>/gi,
    (_, tag: string) => `#${tag}`,
  );
}

function preprocessMath(md: string): string {
  let result = md.replace(/^\$\$\s*\r?\n([\s\S]*?)\r?\n\$\$\s*$/gm, (_, tex: string) => {
    const latex = tex.trim();
    if (!latex) return _;
    return `<div data-math-block="${escapeAttr(latex)}" class="math-block"></div>`;
  });

  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (match, tex: string) => {
    const latex = tex.trim();
    if (!latex || match.includes("data-math-block")) return match;
    return `<div data-math-block="${escapeAttr(latex)}" class="math-block"></div>`;
  });

  result = result.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (match, tex: string) => {
    const latex = tex.trim();
    if (!latex || match.includes("data-math-inline")) return match;
    return `<span data-math-inline="${escapeAttr(latex)}" class="math-inline"></span>`;
  });

  return result;
}

function postprocessMath(md: string): string {
  let result = md.replace(
    /<div[^>]*data-math-block="([^"]*)"[^>]*>\s*<\/div>/gi,
    (_, latex: string) => `$$\n${latex}\n$$`,
  );
  result = result.replace(
    /<div[^>]*data-math-block="([^"]*)"[^>]*>[\s\S]*?<\/div>/gi,
    (_, latex: string) => `$$\n${latex}\n$$`,
  );
  result = result.replace(
    /<span[^>]*data-math-inline="([^"]*)"[^>]*>\s*<\/span>/gi,
    (_, latex: string) => `$${latex}$`,
  );
  result = result.replace(
    /<span[^>]*data-math-inline="([^"]*)"[^>]*>[\s\S]*?<\/span>/gi,
    (_, latex: string) => `$${latex}$`,
  );
  return result;
}

export function preprocessMarkdown(md: string, noteNames: string[] = []): string {
  let result = md;
  result = preprocessMdedTables(result);
  result = preprocessBlockRefs(result);
  result = preprocessParagraphBlocks(result);
  result = preprocessMdedInlineMarks(result);
  result = preprocessCallouts(result);
  result = preprocessEmbeds(result);
  result = preprocessWikiLinks(result, noteNames);
  result = preprocessHighlights(result);
  result = preprocessTags(result);
  result = preprocessMath(result);
  return result;
}

export function postprocessMarkdown(md: string): string {
  let result = md;
  result = postprocessCallouts(result);
  result = postprocessEmbeds(result);
  result = postprocessWikiLinks(result);
  result = postprocessTags(result);
  result = postprocessMath(result);
  result = postprocessBlockRefs(result);
  result = postprocessHtmlTables(result);
  result = postprocessMdedInlineMarks(result);
  result = postprocessInlineHtml(result);
  return result;
}

export function extractHeadings(
  content: string,
): { level: number; text: string; id: string }[] {
  const headings: { level: number; text: string; id: string }[] = [];
  for (const line of content.split("\n")) {
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (m) {
      const text = m[2]!.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1").trim();
      const id = text
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fff]+/g, "-")
        .replace(/^-|-$/g, "");
      headings.push({ level: m[1]!.length, text, id });
    }
  }
  return headings;
}
