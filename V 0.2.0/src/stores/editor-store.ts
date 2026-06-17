import { create } from "zustand";

import type { Editor } from "@tiptap/react";



export interface SelectedBlockRef {

  sourceFile: string;

  blockId: string;

  sync: boolean;

  nodePos: number | null;

}



interface EditorStore {

  editor: Editor | null;

  editorScrollEl: HTMLElement | null;

  findReplaceOpen: boolean;

  selectedBlockRef: SelectedBlockRef | null;

  setEditor: (editor: Editor | null) => void;

  setEditorScrollEl: (el: HTMLElement | null) => void;

  setFindReplaceOpen: (open: boolean) => void;

  setSelectedBlockRef: (ref: SelectedBlockRef | null) => void;

  setBlockReferenceSync: (sync: boolean) => void;

  jumpToBlockSource: () => Promise<void>;

  scrollToHeading: (text: string) => void;

  scrollToBlock: (blockId: string) => void;

}



export const useEditorStore = create<EditorStore>((set, get) => ({

  editor: null,

  editorScrollEl: null,

  findReplaceOpen: false,

  selectedBlockRef: null,

  setEditor: (editor) => set({ editor }),

  setEditorScrollEl: (el) => set({ editorScrollEl: el }),

  setFindReplaceOpen: (open) => set({ findReplaceOpen: open }),

  setSelectedBlockRef: (ref) => {

    set({ selectedBlockRef: ref });

    if (ref) {

      import("@/stores/app-store").then(({ useAppStore }) => {

        useAppStore.getState().setRightPanelTab("blockref");

      });

    }

  },



  setBlockReferenceSync: (sync) => {
    const { editor, selectedBlockRef } = get();
    if (!editor || !selectedBlockRef) return;

    editor.state.doc.descendants((node, pos) => {
      if (node.type.name !== "blockReference") return;
      if (node.attrs.blockId !== selectedBlockRef.blockId) return;
      editor
        .chain()
        .command(({ tr }) => {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, sync });
          return true;
        })
        .run();
    });

    set({ selectedBlockRef: { ...selectedBlockRef, sync } });
  },



  jumpToBlockSource: async () => {

    const { selectedBlockRef, scrollToBlock } = get();

    if (!selectedBlockRef) return;



    const { useAppStore } = await import("@/stores/app-store");

    const { openFile, vaultPath, activeTabPath } = useAppStore.getState();

    const source = selectedBlockRef.sourceFile || activeTabPath;



    if (source && source !== activeTabPath) {

      await openFile(source);

    } else if (!source && !vaultPath) {

      return;

    }



    scrollToBlock(selectedBlockRef.blockId);

  },



  scrollToHeading: (text) => {

    const { editor, editorScrollEl } = get();

    if (!editor) return;



    const target = text.toLowerCase();

    let headingPos: number | null = null;



    editor.state.doc.descendants((node, pos) => {

      if (headingPos !== null) return false;

      if (node.type.name === "heading") {

        const headingText = node.textContent.toLowerCase();

        if (headingText === target || headingText.includes(target)) {

          headingPos = pos;

          return false;

        }

      }

    });



    if (headingPos === null) return;



    editor.chain().focus().setTextSelection(headingPos + 1).run();



    const scrollEl = editorScrollEl;

    if (!scrollEl) {

      editor.commands.scrollIntoView();

      return;

    }



    requestAnimationFrame(() => {

      const coords = editor.view.coordsAtPos(headingPos!);

      const scrollRect = scrollEl.getBoundingClientRect();

      const headingTopInContent = scrollEl.scrollTop + (coords.top - scrollRect.top);

      const targetScrollTop = headingTopInContent - scrollRect.height * 0.25;



      scrollEl.scrollTo({

        top: Math.max(0, targetScrollTop),

        behavior: "smooth",

      });

    });

  },



  scrollToBlock: (blockId) => {

    const { editor, editorScrollEl } = get();

    if (!editor) return;



    let blockPos: number | null = null;

    editor.state.doc.descendants((node, pos) => {

      if (blockPos !== null) return false;

      if (

        (node.type.name === "paragraph" && node.attrs.blockId === blockId) ||

        (node.type.name === "blockReference" && node.attrs.blockId === blockId)

      ) {

        blockPos = pos;

        return false;

      }

    });



    if (blockPos === null) return;

    editor.chain().focus().setTextSelection(blockPos + 1).run();



    const scrollEl = editorScrollEl;

    if (!scrollEl) {

      editor.commands.scrollIntoView();

      return;

    }



    requestAnimationFrame(() => {

      const coords = editor.view.coordsAtPos(blockPos!);

      const scrollRect = scrollEl.getBoundingClientRect();

      const topInContent = scrollEl.scrollTop + (coords.top - scrollRect.top);

      scrollEl.scrollTo({ top: Math.max(0, topInContent - 80), behavior: "smooth" });

    });

  },

}));

