import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore } from "@/stores/app-store";

export function SavePromptDialog() {
  const prompt = useAppStore((s) => s.savePrompt);
  const confirmSavePrompt = useAppStore((s) => s.confirmSavePrompt);

  if (!prompt) return null;

  const names = prompt.files.map((f) => f.title).join("、");
  const heading =
    prompt.mode === "quit"
      ? "退出前保存更改？"
      : prompt.mode === "switch-vault"
        ? "切换知识库前保存更改？"
        : "关闭前保存更改？";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void confirmSavePrompt("cancel");
      }}
    >
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          void confirmSavePrompt("cancel");
        }}
      >
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          「{names}」已修改但尚未保存。不保存将丢失这些更改。
        </p>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => void confirmSavePrompt("cancel")}>
            取消
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void confirmSavePrompt("discard")}>
              不保存
            </Button>
            <Button onClick={() => void confirmSavePrompt("save")}>保存</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
