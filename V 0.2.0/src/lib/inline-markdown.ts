/** MDED 行内扩展语法（不与 Obsidian [[、==、%% 等冲突） */

const MDED_INLINE_RE =
  /⟦mded-(ul|strike|hl|code)(?:\s+color=([0-9a-fA-F]{3,8}))?⟧([^⟦]+?)⟦\/mded-\1⟧/g;

function hexColor(c: string | undefined): string | null {
  if (!c) return null;
  return c.startsWith("#") ? c : `#${c}`;
}

export function preprocessMdedInlineMarks(md: string): string {
  return md.replace(MDED_INLINE_RE, (_, kind: string, color: string | undefined, text: string) => {
    const c = hexColor(color);
    switch (kind) {
      case "ul":
        return c
          ? `<span data-mded-ul="true" data-color="${c}" style="text-decoration:underline;color:${c}">${text}</span>`
          : `<u>${text}</u>`;
      case "strike":
        return c
          ? `<span data-mded-strike="true" data-color="${c}" style="text-decoration:line-through;color:${c}">${text}</span>`
          : `<s>${text}</s>`;
      case "hl":
        return c
          ? `<mark data-mded-hl="true" data-color="${c}" style="background-color:${c}">${text}</mark>`
          : `<mark>${text}</mark>`;
      case "code":
        return c
          ? `<code data-mded-code="true" data-color="${c}" style="color:${c}">${text}</code>`
          : `<code>${text}</code>`;
      default:
        return text;
    }
  });
}

function stripColor(c: string | null | undefined): string {
  if (!c) return "";
  return c.replace(/^#/, "");
}

export function postprocessMdedInlineMarks(md: string): string {
  let result = md;

  result = result.replace(
    /<span[^>]*data-mded-ul="true"[^>]*data-color="([^"]*)"[^>]*>([\s\S]*?)<\/span>/gi,
    (_, color: string, text: string) =>
      `⟦mded-ul color=${stripColor(color)}⟧${text}⟦/mded-ul⟧`,
  );
  result = result.replace(/<u\b[^>]*>([\s\S]*?)<\/u>/gi, (_, text: string) =>
    text.includes("⟦mded-") ? text : `<u>${text}</u>`,
  );

  result = result.replace(
    /<span[^>]*data-mded-strike="true"[^>]*data-color="([^"]*)"[^>]*>([\s\S]*?)<\/span>/gi,
    (_, color: string, text: string) =>
      `⟦mded-strike color=${stripColor(color)}⟧${text}⟦/mded-strike⟧`,
  );

  result = result.replace(
    /<mark[^>]*data-mded-hl="true"[^>]*data-color="([^"]*)"[^>]*>([\s\S]*?)<\/mark>/gi,
    (_, color: string, text: string) =>
      `⟦mded-hl color=${stripColor(color)}⟧${text}⟦/mded-hl⟧`,
  );

  result = result.replace(
    /<code[^>]*data-mded-code="true"[^>]*data-color="([^"]*)"[^>]*>([\s\S]*?)<\/code>/gi,
    (_, color: string, text: string) =>
      `⟦mded-code color=${stripColor(color)}⟧${text}⟦/mded-code⟧`,
  );

  return result;
}
