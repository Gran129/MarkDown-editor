import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

/**
 * Word-like ordered-list keys:
 * - Enter always creates the next numbered item
 * - First Backspace at the start of an item removes its number and joins
 *   the remainder as a line-break of the previous item
 * - Second Backspace with no typing in between exits the ordered list
 */
export const OrderedListKeys = Extension.create({
  name: "orderedListKeys",
  priority: 1000,

  addStorage() {
    return { pendingExit: false };
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        this.storage.pendingExit = false;
        if (!this.editor.isActive("orderedList")) return false;
        return this.editor.commands.splitListItem("listItem");
      },
      Backspace: () => {
        if (!this.editor.isActive("orderedList")) {
          this.storage.pendingExit = false;
          return false;
        }
        const { $from, empty } = this.editor.state.selection;
        if (!empty || $from.parentOffset > 0) {
          this.storage.pendingExit = false;
          return false;
        }

        if (this.storage.pendingExit) {
          this.storage.pendingExit = false;
          return (
            this.editor.commands.liftListItem("listItem") ||
            this.editor.commands.toggleOrderedList()
          );
        }

        const emptyItem =
          $from.parent.content.size === 0 || $from.parent.textContent.length === 0;
        this.storage.pendingExit = true;
        if (emptyItem) {
          return (
            this.editor.commands.joinBackward() ||
            this.editor.commands.liftListItem("listItem")
          );
        }
        if (this.editor.chain().joinBackward().setHardBreak().run()) {
          return true;
        }
        return this.editor.commands.liftListItem("listItem");
      },
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin({
        props: {
          handleTextInput() {
            storage.pendingExit = false;
            return false;
          },
          handleKeyDown(_view, event) {
            if (event.key !== "Backspace" && event.key !== "Enter") {
              storage.pendingExit = false;
            }
            return false;
          },
        },
      }),
    ];
  },
});
