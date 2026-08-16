import type { Editor } from "@tiptap/core";

export function applyToolbarCodeBlock(
  editor: Editor,
  options: { inlineOnSelection: boolean; mergeParagraphs: boolean },
) {
  const { from, to, empty } = editor.state.selection;
  if (!empty && options.inlineOnSelection) {
    const $from = editor.state.selection.$from;
    const $to = editor.state.selection.$to;
    const sameBlock = $from.parent === $to.parent;
    const partial = from > $from.start() || to < $to.end();
    if (sameBlock && partial) {
      return editor.chain().focus().toggleCode().run();
    }
  }

  if (!empty && options.mergeParagraphs) {
    const $from = editor.state.selection.$from;
    const $to = editor.state.selection.$to;
    const crossesBlocks = $from.parent !== $to.parent;
    if (crossesBlocks) {
      const text = editor.state.doc.textBetween(from, to, "\n\n", "\n");
      return editor
        .chain()
        .focus()
        .deleteSelection()
        .insertContent({
          type: "codeBlock",
          attrs: { language: "plaintext" },
          content: text ? [{ type: "text", text }] : [],
        })
        .run();
    }
  }

  return editor.chain().focus().toggleCodeBlock({ language: "plaintext" }).run();
}
