/** Ranges that should not be treated as document headings (frontmatter, fences, questions). */
export function skippedOutlineRanges(value: string): [number, number][] {
  const ranges: [number, number][] = [];
  if (value.startsWith("---\n") || value.startsWith("---\r\n")) {
    const end = value.indexOf("\n---", 4);
    if (end >= 0) ranges.push([0, end + 4]);
  }

  let offset = 0;
  let inFence = false;
  let inQuestion = false;
  for (const line of value.split("\n")) {
    const trimmed = line.trim();
    const next = offset + line.length + 1;
    if (!inFence && /^:::question\b/.test(trimmed)) inQuestion = true;
    if (/^```/.test(trimmed)) inFence = !inFence;
    if (inFence || inQuestion) ranges.push([offset, next]);
    if (inQuestion && trimmed === ":::") inQuestion = false;
    offset = next;
  }
  return ranges;
}

function inRanges(index: number, ranges: [number, number][]): boolean {
  return ranges.some(([start, end]) => index >= start && index < end);
}

export function findSourceHeadingOffset(value: string, text: string): number | null {
  const skipped = skippedOutlineRanges(value);
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingRe = new RegExp(`^#{1,6}[ \\t]+${escaped}[ \\t]*$`, "gm");
  let match: RegExpExecArray | null;
  while ((match = headingRe.exec(value))) {
    if (!inRanges(match.index, skipped)) return match.index;
  }
  return null;
}

/** Measure wrapped textarea content so outline jumps land on the visual line. */
export function scrollTextareaToOffset(el: HTMLTextAreaElement, offset: number) {
  const style = window.getComputedStyle(el);
  const mirror = document.createElement("div");
  const props = [
    "boxSizing",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "letterSpacing",
    "textTransform",
    "wordSpacing",
    "textIndent",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "lineHeight",
    "tabSize",
  ] as const;
  for (const prop of props) {
    mirror.style[prop] = style[prop as keyof CSSStyleDeclaration] as string;
  }
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.left = "-9999px";
  mirror.style.top = "0";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "anywhere";
  mirror.style.wordBreak = "break-word";
  mirror.style.width = `${el.clientWidth}px`;

  const before = document.createElement("span");
  before.textContent = el.value.slice(0, offset);
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.append(before, marker);
  document.body.appendChild(mirror);
  const top = marker.offsetTop;
  document.body.removeChild(mirror);

  el.focus();
  el.setSelectionRange(offset, offset);
  el.scrollTop = Math.max(0, top - 48);
}
