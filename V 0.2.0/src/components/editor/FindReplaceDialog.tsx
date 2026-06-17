import { useState } from "react";
import type { Editor } from "@tiptap/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useEditorStore } from "@/stores/editor-store";

function findNext(editor: Editor, query: string, from = 0): boolean {
  if (!query) return false;
  const lower = query.toLowerCase();
  let foundPos: { from: number; to: number } | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (foundPos) return false;
    if (!node.isText || !node.text) return;
    const idx = node.text.toLowerCase().indexOf(lower);
    if (idx >= 0 && pos + idx >= from) {
      foundPos = { from: pos + idx, to: pos + idx + query.length };
      return false;
    }
  });

  if (foundPos) {
    editor.chain().focus().setTextSelection(foundPos).scrollIntoView().run();
    return true;
  }
  return false;
}

export function FindReplaceDialog() {
  const open = useEditorStore((s) => s.findReplaceOpen);
  const setOpen = useEditorStore((s) => s.setFindReplaceOpen);
  const editor = useEditorStore((s) => s.editor);

  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");

  const handleFindNext = () => {
    if (!editor || !findText) return;
    const { from } = editor.state.selection;
    const start = from + 1;
    if (!findNext(editor, findText, start)) {
      findNext(editor, findText, 0);
    }
  };

  const handleReplace = () => {
    if (!editor || !findText) return;
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to);
    if (selected.toLowerCase() === findText.toLowerCase()) {
      editor.chain().focus().insertContent(replaceText).run();
    }
    handleFindNext();
  };

  const handleReplaceAll = () => {
    if (!editor || !findText) return;
    const { doc } = editor.state;
    let fullText = "";
    doc.descendants((node) => {
      if (node.isText && node.text) fullText += node.text;
    });
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const replaced = fullText.replace(regex, replaceText);
    if (replaced !== fullText) {
      editor.commands.setContent(replaced);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>查找与替换</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="查找"
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleFindNext();
            }}
          />
          <Input
            placeholder="替换为"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleReplace();
            }}
          />
        </div>
        <DialogFooter className="flex-wrap gap-2 sm:justify-start">
          <Button variant="outline" size="sm" onClick={handleFindNext} disabled={!editor}>
            查找下一个
          </Button>
          <Button variant="outline" size="sm" onClick={handleReplace} disabled={!editor}>
            替换
          </Button>
          <Button variant="outline" size="sm" onClick={handleReplaceAll} disabled={!editor}>
            全部替换
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
