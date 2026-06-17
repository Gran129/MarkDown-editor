import { useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Code2,
  Minus,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Undo,
  Redo,
  Save,
  Highlighter,
  MessageSquare,
  Brackets,
  Paperclip,
  GitBranch,
  FunctionSquare,
  Search,
  Underline as UnderlineIcon,
  Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon,
  IndentIncrease,
  IndentDecrease,
  AlignJustify,
  ChevronDown,
  Blocks,
  Upload,
  Globe,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useEditorStore } from "@/stores/editor-store";
import { MarkColorMenu } from "@/components/editor/MarkColorMenu";
import { CodeBlockColorMenu, pickLocalImagePath } from "@/components/editor/CodeBlockColorMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface EditorToolbarProps {
  editor: Editor | null;
  filePath?: string;
  noteNames?: string[];
}

const CALLOUT_TYPES = [
  { type: "note", label: "笔记" },
  { type: "tip", label: "提示" },
  { type: "warning", label: "警告" },
  { type: "important", label: "重要" },
  { type: "info", label: "信息" },
  { type: "success", label: "成功" },
  { type: "question", label: "问题" },
  { type: "quote", label: "引用" },
];

const HEADING_TITLES: Record<number, string> = {
  1: "一级标题（#）",
  2: "二级标题（##）",
  3: "三级标题（###）",
  4: "四级标题（####）",
  5: "五级标题（#####）",
  6: "六级标题（######）",
};

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8", active && "bg-accent")}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {children}
    </Button>
  );
}

export function EditorToolbar({ editor, filePath, noteNames = [] }: EditorToolbarProps) {
  const saveTab = useAppStore((s) => s.saveTab);
  const setFindReplaceOpen = useEditorStore((s) => s.setFindReplaceOpen);
  const isDirty = useAppStore((s) =>
    filePath ? s.tabs.find((t) => t.path === filePath)?.isDirty : false,
  );

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const [imageStep, setImageStep] = useState<"choose" | "input">("choose");
  const [imageUrl, setImageUrl] = useState("");
  const [blockRefOpen, setBlockRefOpen] = useState(false);
  const [blockRefSync, setBlockRefSync] = useState(true);
  const [wikiOpen, setWikiOpen] = useState(false);
  const [wikiTarget, setWikiTarget] = useState("");
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedTarget, setEmbedTarget] = useState("");
  const [calloutOpen, setCalloutOpen] = useState(false);

  if (!editor) return null;

  const insertWikiLink = () => {
    const target = wikiTarget.trim();
    if (!target) return;
    editor.chain().focus().setWikiLink({ target }).run();
    setWikiOpen(false);
    setWikiTarget("");
  };

  const insertEmbed = () => {
    const target = embedTarget.trim();
    if (!target) return;
    editor.chain().focus().setEmbed({ target }).run();
    setEmbedOpen(false);
    setEmbedTarget("");
  };

  const insertCallout = (type: string) => {
    editor
      .chain()
      .focus()
      .setCallout({ type })
      .run();
    setCalloutOpen(false);
  };

  const insertMermaid = () => {
    editor
      .chain()
      .focus()
      .insertContent({
        type: "codeBlock",
        attrs: { language: "mermaid" },
        content: [{ type: "text", text: "flowchart LR\n  A[开始] --> B[结束]" }],
      })
      .run();
  };

  const insertMathBlock = () => {
    editor.chain().focus().setMathBlock({ latex: "E = mc^2" }).run();
  };

  const applyLink = () => {
    if (!linkUrl.trim()) return;
    const href = linkUrl.trim();
    if (linkText.trim()) {
      editor
        .chain()
        .focus()
        .insertContent(`<a href="${href}">${linkText.trim()}</a>`)
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setLinkOpen(false);
  };

  const insertBlockReference = () => {
    const { blockId } = editor.getAttributes("paragraph");
    if (!blockId) return;
    const text = editor.state.selection.$from.parent.textContent;
    editor
      .chain()
      .focus()
      .insertBlockReference({
        sourceFile: filePath ?? "",
        blockId: blockId as string,
        sync: blockRefSync,
        content: text,
      })
      .run();
    setBlockRefOpen(false);
  };

  const openImageDialog = () => {
    setImageUrl("");
    setImageStep("choose");
    setImageOpen(true);
  };

  const handlePickLocalImage = async () => {
    const picked = await pickLocalImagePath();
    if (picked) {
      editor.chain().focus().setImage({ src: picked }).run();
      setImageOpen(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="撤销 (Ctrl+Z)"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="重做 (Ctrl+Y)"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="加粗（保存为 **文本**）"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="斜体（保存为 *文本*）"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <MarkColorMenu
          editor={editor}
          mark="underline"
          title="下划线"
          active={editor.isActive("underline")}
          onToggle={() => editor.chain().focus().toggleUnderline().run()}
          icon={<UnderlineIcon className="h-4 w-4" />}
        />
        <MarkColorMenu
          editor={editor}
          mark="strike"
          title="删除线"
          active={editor.isActive("strike")}
          onToggle={() => editor.chain().focus().toggleStrike().run()}
          icon={<Strikethrough className="h-4 w-4" />}
        />
        <MarkColorMenu
          editor={editor}
          mark="highlight"
          title="高亮"
          active={editor.isActive("highlight")}
          onToggle={() => editor.chain().focus().toggleHighlight().run()}
          icon={<Highlighter className="h-4 w-4" />}
        />
        <MarkColorMenu
          editor={editor}
          mark="code"
          title="行内代码"
          active={editor.isActive("code")}
          onToggle={() => editor.chain().focus().toggleCode().run()}
          icon={<Code2 className="h-4 w-4" />}
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          active={editor.isActive("superscript")}
          title="上标（^文本^，Obsidian 兼容）"
        >
          <SuperscriptIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          active={editor.isActive("subscript")}
          title="下标"
        >
          <SubscriptIcon className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        {[1, 2, 3].map((level) => {
          const Icon = [Heading1, Heading2, Heading3][level - 1]!;
          return (
            <ToolbarButton
              key={level}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .toggleHeading({ level: level as 1 | 2 | 3 })
                  .run()
              }
              active={editor.isActive("heading", { level })}
              title={HEADING_TITLES[level]}
            >
              <Icon className="h-4 w-4" />
            </ToolbarButton>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="四级至六级标题"
              aria-label="四级至六级标题"
            >
              <Heading4 className="h-4 w-4" />
              <ChevronDown className="ml-0.5 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {[4, 5, 6].map((level) => (
              <DropdownMenuItem
                key={level}
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .toggleHeading({ level: level as 4 | 5 | 6 })
                    .run()
                }
              >
                {HEADING_TITLES[level]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleFirstLineIndent().run()}
          active={!!editor.getAttributes("paragraph").textIndent}
          title="首行缩进（2em）"
        >
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().increaseParagraphIndent().run()}
          title="增加段落缩进"
        >
          <IndentIncrease className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().decreaseParagraphIndent().run()}
          title="减少段落缩进"
        >
          <IndentDecrease className="h-4 w-4" />
        </ToolbarButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs">
              间距
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => editor.chain().focus().setParagraphSpacing("0.5em", "0.5em").run()}
            >
              紧凑
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => editor.chain().focus().setParagraphSpacing("1em", "1em").run()}
            >
              标准
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => editor.chain().focus().setParagraphSpacing("1.5em", "1.5em").run()}
            >
              宽松
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => editor.chain().focus().setParagraphLineSpacing("2").run()}
            >
              行距 2.0
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .setParagraphSpacing(null, null)
                  .setParagraphLineSpacing(null)
                  .run()
              }
            >
              重置间距
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="无序列表"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="有序列表"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive("taskList")}
          title="任务列表（- [ ]）"
        >
          <ListChecks className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="引用块"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
          title="代码块"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
        {editor.isActive("codeBlock") && <CodeBlockColorMenu editor={editor} />}
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="分隔线"
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          onClick={() => {
            setLinkUrl(editor.getAttributes("link").href ?? "");
            setLinkText(
              editor.state.doc.textBetween(
                editor.state.selection.from,
                editor.state.selection.to,
              ),
            );
            setLinkOpen(true);
          }}
          active={editor.isActive("link")}
          title="插入链接 (Ctrl+K) — 悬停预览，Ctrl+点击跳转"
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => {
            setWikiTarget("");
            setWikiOpen(true);
          }}
          title="插入 Wiki 链接 [[笔记]]"
        >
          <Brackets className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => {
            setEmbedTarget("");
            setEmbedOpen(true);
          }}
          title="嵌入内容 ![[笔记]]"
        >
          <Paperclip className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={openImageDialog} title="插入图片">
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setBlockRefOpen(true)}
          title="引用当前段落为板块（可同步）"
        >
          <Blocks className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
          title="插入 3×3 表格（点击表格内可打开编辑菜单）"
        >
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => setCalloutOpen(true)} title="插入标注块（Callout）">
          <MessageSquare className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={insertMermaid} title="插入 Mermaid 流程图">
          <GitBranch className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={insertMathBlock} title="插入数学公式块">
          <FunctionSquare className="h-4 w-4" />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          onClick={() => setFindReplaceOpen(true)}
          title="查找与替换 (Ctrl+H)"
        >
          <Search className="h-4 w-4" />
        </ToolbarButton>

        <div className="flex-1" />

        {filePath && (
          <ToolbarButton
            onClick={() => void saveTab(filePath)}
            active={isDirty}
            title="保存 (Ctrl+S)"
          >
            <Save className="h-4 w-4" />
          </ToolbarButton>
        )}
      </div>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>插入链接</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="显示文字（可选）"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
            />
            <Input
              placeholder="https://... 或文件路径"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyLink()}
            />
            {linkUrl && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="text-xs text-muted-foreground">预览</p>
                <p className="mt-1 font-medium text-primary underline">
                  {linkText || linkUrl}
                </p>
                <p className="mt-1 break-all text-xs text-muted-foreground">{linkUrl}</p>
                <p className="mt-2 text-xs">悬停可预览 · Ctrl+点击 跳转</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                editor.chain().focus().unsetLink().run();
                setLinkOpen(false);
              }}
            >
              移除链接
            </Button>
            <Button onClick={applyLink}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={imageOpen}
        onOpenChange={(open) => {
          setImageOpen(open);
          if (!open) setImageStep("choose");
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>插入图片</DialogTitle>
          </DialogHeader>
          {imageStep === "choose" ? (
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-20 flex-col gap-2"
                onClick={() => void handlePickLocalImage()}
              >
                <Upload className="h-5 w-5" />
                从本地导入
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-20 flex-col gap-2"
                onClick={() => setImageStep("input")}
              >
                <Globe className="h-5 w-5" />
                输入 URL
              </Button>
            </div>
          ) : (
            <>
              <Input
                placeholder="https://example.com/image.png"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && imageUrl) {
                    editor.chain().focus().setImage({ src: imageUrl }).run();
                    setImageOpen(false);
                  }
                }}
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setImageStep("choose")}>
                  返回
                </Button>
                <Button
                  onClick={() => {
                    if (imageUrl) editor.chain().focus().setImage({ src: imageUrl }).run();
                    setImageOpen(false);
                  }}
                >
                  插入
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={blockRefOpen} onOpenChange={setBlockRefOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>引用段落板块</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            将当前段落引用为可同步的「板块」。引用后点击板块可在右侧面板查看来源并跳转。
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={blockRefSync}
              onChange={(e) => setBlockRefSync(e.target.checked)}
            />
            开启同步（源段落修改时自动更新）
          </label>
          <DialogFooter>
            <Button onClick={insertBlockReference}>插入引用</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={wikiOpen} onOpenChange={setWikiOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>插入 Wiki 链接</DialogTitle>
          </DialogHeader>
          <Input
            list="wiki-note-names"
            placeholder="笔记名称"
            value={wikiTarget}
            onChange={(e) => setWikiTarget(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && insertWikiLink()}
          />
          <datalist id="wiki-note-names">
            {noteNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <DialogFooter>
            <Button onClick={insertWikiLink}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={embedOpen} onOpenChange={setEmbedOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>嵌入内容</DialogTitle>
          </DialogHeader>
          <Input
            list="embed-note-names"
            placeholder="笔记名或图片路径"
            value={embedTarget}
            onChange={(e) => setEmbedTarget(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && insertEmbed()}
          />
          <datalist id="embed-note-names">
            {noteNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <DialogFooter>
            <Button onClick={insertEmbed}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={calloutOpen} onOpenChange={setCalloutOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>插入标注块</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {CALLOUT_TYPES.map((c) => (
              <Button key={c.type} variant="outline" size="sm" onClick={() => insertCallout(c.type)}>
                {c.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
