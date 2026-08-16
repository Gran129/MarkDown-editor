import mermaid from "mermaid";

let initialized = false;

function stripOrphanMermaidDom() {
  document.querySelectorAll("body > svg[aria-roledescription='error']").forEach((el) => el.remove());
  document.querySelectorAll("body > [id^='dmermaid'], body > [id^='dmm']").forEach((el) => el.remove());
  document.querySelectorAll(".error-icon").forEach((el) => {
    if (el instanceof HTMLElement && !el.closest(".ProseMirror, .mermaid-diagram")) {
      el.remove();
    }
  });
}

function ensureMermaid() {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "neutral",
    suppressErrorRendering: true,
    securityLevel: "loose",
  });
  (mermaid as unknown as { parseError?: () => void }).parseError = () => {
    /* keep last good preview; never paint the global error banner */
  };
  initialized = true;
}

function cleanupMermaidDom(id: string) {
  document.getElementById(id)?.remove();
  document.getElementById(`d${id}`)?.remove();
  stripOrphanMermaidDom();
}

export function looksLikeMermaid(source: string): boolean {
  const first = source
    .trim()
    .split(/\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("%%"));
  if (!first) return false;
  return /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap|timeline|journey|quadrantChart|sankey|xychart|block-beta|C4Context|C4Container|requirementDiagram|kanban)\b/i.test(
    first,
  );
}

export async function renderMermaidSvg(source: string): Promise<string | null> {
  ensureMermaid();
  const text = source.replace(/\r\n/g, "\n").trim();
  if (!text || !looksLikeMermaid(text)) {
    stripOrphanMermaidDom();
    return null;
  }
  const id = `mmd${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  try {
    let parsed: unknown = true;
    try {
      parsed = await mermaid.parse(text, { suppressErrors: true } as { suppressErrors: boolean });
    } catch {
      cleanupMermaidDom(id);
      return null;
    }
    if (parsed === false) {
      cleanupMermaidDom(id);
      return null;
    }
    const { svg } = await mermaid.render(id, text);
    cleanupMermaidDom(id);
    if (!svg || /syntax error/i.test(svg)) return null;
    return svg;
  } catch {
    cleanupMermaidDom(id);
    return null;
  }
}
