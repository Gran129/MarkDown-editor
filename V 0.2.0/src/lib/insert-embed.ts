import type { EditorView } from "@tiptap/pm/view";

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

/** Insert a block embed, splitting the paragraph when the caret is mid-block. */
export function insertEmbedAtPoint(
  view: EditorView,
  clientX: number,
  clientY: number,
  target: string,
): boolean {
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
  return true;
}

export function locateEmbedPreview(fileName: string): boolean {
  const escaped = fileName.replace(/"/g, "");
  const el =
    document.getElementById(`embed-${fileName}`) ??
    document.querySelector<HTMLElement>(`[data-embed][data-target$="${escaped}"]`);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("is-embed-located");
  window.setTimeout(() => el.classList.remove("is-embed-located"), 1400);
  return true;
}

export function resourceIsReferenced(markdown: string, relative: string, fileName: string): boolean {
  const haystack = markdown.replace(/\\/g, "/");
  return (
    haystack.includes(relative) ||
    haystack.includes(`![[${fileName}]]`) ||
    haystack.includes(`![[.resources/${fileName}]]`) ||
    haystack.includes(`](${relative})`) ||
    haystack.includes(`](.resources/${fileName})`)
  );
}
