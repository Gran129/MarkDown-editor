import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

function selectionPlainText(editor: Editor): string {
  const { from, to, empty, $from } = editor.state.selection;
  if (empty) return $from.parent.textContent;
  return editor.state.doc.textBetween(from, to, "\n", "\n");
}

function replaceRangeWithCodeBlock(editor: Editor, from: number, to: number, text: string): boolean {
  const node = editor.schema.nodes.codeBlock!.create(
    { language: "plaintext" },
    text ? editor.schema.text(text) : null,
  );
  return editor
    .chain()
    .focus()
    .command(({ tr, dispatch }) => {
      if (dispatch) {
        tr.replaceWith(from, to, node);
        const pos = Math.min(from + 1, tr.doc.content.size);
        tr.setSelection(TextSelection.near(tr.doc.resolve(pos)));
      }
      return true;
    })
    .run();
}

export function applyToolbarCodeBlock(
  editor: Editor,
  options: { inlineOnSelection: boolean; mergeParagraphs: boolean },
) {
  const { from, to, empty, $from, $to } = editor.state.selection;

  if (!empty && options.inlineOnSelection) {
    const sameBlock = $from.parent === $to.parent;
    const partial = from > $from.start() || to < $to.end();
    if (sameBlock && partial) {
      return editor.chain().focus().toggleCode().run();
    }
  }

  if ($from.parent.type.name === "codeBlock" && empty) {
    return editor.chain().focus().setParagraph().run();
  }

  const text = selectionPlainText(editor);

  if (!empty && options.mergeParagraphs) {
    const crossesBlocks = $from.parent !== $to.parent;
    if (crossesBlocks) {
      return replaceRangeWithCodeBlock(editor, from, to, text);
    }
  }

  if (!empty) {
    const start = $from.before($from.depth);
    const end = $to.after($to.depth);
    return replaceRangeWithCodeBlock(editor, start, end, text);
  }

  const start = $from.before($from.depth);
  const end = $from.after($from.depth);
  return replaceRangeWithCodeBlock(editor, start, end, text);
}
