import type { Editor } from "@tiptap/core";
import type { EditorView } from "@tiptap/pm/view";

import { decodeQuestionPayload, questionReferencesFile } from "@/lib/question";
import { getResourceDrag, isResourceDragEvent } from "@/lib/resource-drag";

export function isResourceDrag(event: DragEvent): boolean {
  return Boolean(getResourceDrag()) || isResourceDragEvent(event);
}

export function resourcePathFromEvent(event: DragEvent): string {
  const active = getResourceDrag();
  if (active) return active;
  const typed = event.dataTransfer?.getData("text/resource-path")?.trim() ?? "";
  if (typed.includes(".resources/")) return typed;
  const plain = event.dataTransfer?.getData("text/plain")?.trim() ?? "";
  return plain.includes(".resources/") ? plain : "";
}

let lastInsert = { at: 0, target: "" };

/** Insert a block embed, splitting the paragraph when the caret is mid-block. */
export function insertEmbedAtPoint(
  view: EditorView,
  clientX: number,
  clientY: number,
  target: string,
): boolean {
  const now = Date.now();
  if (lastInsert.target === target && now - lastInsert.at < 120) {
    return true;
  }

  const coords = view.posAtCoords({ left: clientX, top: clientY });
  if (!coords) return false;
  const embedType = view.state.schema.nodes.embed;
  if (!embedType) return false;
  const node = embedType.create({ target });

  let tr = view.state.tr;
  let insertPos = coords.pos;
  const $pos = tr.doc.resolve(insertPos);

  if ($pos.parent.isTextblock) {
    const offset = $pos.parentOffset;
    const size = $pos.parent.content.size;
    if (offset > 0 && offset < size) {
      tr = tr.split(insertPos);
      insertPos += 1;
      insertPos = tr.doc.resolve(insertPos).before();
    } else if (offset === 0) {
      insertPos = $pos.before();
    } else {
      insertPos = $pos.after();
    }
  }

  tr = tr.insert(insertPos, node);
  view.dispatch(tr.scrollIntoView());
  lastInsert.at = now;
  lastInsert.target = target;
  return true;
}

export function locateEmbedPreview(fileName: string): boolean {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(
      "[data-embed][data-target], [data-question-media], img.question-image",
    ),
  );
  const el =
    nodes.find((node) => {
      const hay = [
        node.getAttribute("data-target") ?? "",
        node.getAttribute("data-question-media") ?? "",
        node.getAttribute("src") ?? "",
        node.getAttribute("alt") ?? "",
      ].join("\n");
      return hay.includes(fileName);
    }) ?? document.getElementById(`embed-${fileName}`);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("is-embed-located");
  window.setTimeout(() => el.classList.remove("is-embed-located"), 1400);
  return true;
}

export function resourceIsReferenced(
  markdown: string,
  relative: string,
  fileName: string,
  editor?: Editor | null,
): boolean {
  if (editor && !editor.isDestroyed) {
    let found = false;
    editor.state.doc.descendants((node) => {
      if (found) return false;
      if (node.type.name === "embed") {
        const target = String(node.attrs.target ?? "");
        if (target.endsWith(fileName) || target.includes(relative) || target.includes(fileName)) {
          found = true;
        }
      }
      if (node.type.name === "question") {
        const data = decodeQuestionPayload(String(node.attrs.payload ?? ""));
        if (data && questionReferencesFile(data, fileName)) found = true;
      }
      if (node.type.name === "image") {
        const src = String(node.attrs.src ?? "");
        if (src.includes(fileName) || src.includes(relative)) found = true;
      }
    });
    if (found) return true;
  }
  const haystack = markdown.replace(/\\/g, "/");
  return (
    haystack.includes(relative) ||
    haystack.includes(fileName) ||
    haystack.includes(`![[${fileName}]]`) ||
    haystack.includes(`![[.resources/${fileName}]]`) ||
    haystack.includes(`](${relative})`) ||
    haystack.includes(`](.resources/${fileName})`) ||
    haystack.includes(`图：${relative}`) ||
    haystack.includes(`图：.resources/${fileName}`)
  );
}
