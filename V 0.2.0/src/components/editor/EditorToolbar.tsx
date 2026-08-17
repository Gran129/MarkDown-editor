import { useState, type ReactNode } from "react";
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
  Palette,
  Upload,
  Globe,
  FileSpreadsheet,
  ClipboardList,
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
import { generateBlockId } from "@/lib/block-utils";
import type { QuestionKind } from "@/lib/question";
import { useAppStore } from "@/stores/app-store";
import { useEditorStore } from "@/stores/editor-store";
import { MarkColorMenu } from "@/components/editor/MarkColorMenu";
import { pickLocalImagePath } from "@/components/editor/CodeBlockColorMenu";
import { CODE_LANGUAGES } from "@/components/editor/CodeBlockView";
import { MARK_COLOR_PRESETS } from "@/extensions/markdown-marks";
import { copyIntoNoteResources } from "@/lib/tauri-api";
import { applyToolbarCodeBlock } from "@/lib/code-block-command";
import { MEDIA_DIALOG_EXTENSIONS } from "@/lib/file-kinds";
import { open } from "@tauri-apps/plugin-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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

async function pickLocalMediaPath(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [
      { name: "Office / PDF / XMind", extensions: MEDIA_DIALOG_EXTENSIONS },
    ],
  });
  if (!selected || Array.isArray(selected)) return null;
  return selected;
}

const HEADING_TITLES: Record<number, string> = {
  1: "一级标题（#）",
  2: "二级标题（##）",
  3: "三级标题（###）",
  4: "四级标题（####）",
  5: "五级标题（#####）",
  6: "六级标题（######）",
};

function CodeToolbarExtras({ editor }: { editor: Editor }) {
  const isBlock = editor.isActive("codeBlock");
  const isInline = editor.isActive("code");
  if (!isBlock && !isInline) return null;

  const blockLang = (editor.getAttributes("codeBlock").language as string | null) || "plaintext";
  const inlineLang = (editor.getAttributes("code").language as string | null) || "plaintext";
  const language = isBlock ? blockLang : inlineLang;
  const isMermaid = isBlock && blockLang === "mermaid";
  const langs = CODE_LANGUAGES.filter((item) => isBlock || item.id !== "mermaid");

  const setLanguage = (next: string) => {
    if (isBlock) {
      editor.chain().focus().updateAttributes("codeBlock", { language: next }).run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("code")
      .setMark("code", { ...editor.getAttributes("code"), language: next })
      .run();
  };

  const setColor = (color: string | null) => {
    if (isBlock) {
      editor.chain().focus().updateAttributes("codeBlock", { blockColor: color }).run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("code")
      .setMark("code", { ...editor.getAttributes("code"), color })
      .run();
  };

  return (
    <>
      <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
      {!isMermaid && (
        <select
          className="h-7 max-w-[7.25rem] rounded-md border border-border bg-background px-1 text-[11px]"
          value={langs.some((item) => item.id === language) ? language : language || "plaintext"}
          aria-label="代码语言"
          title="代码语言"
          onMouseDown={(event) => event.stopPropagation()}
          onChange={(event) => setLanguage(event.target.value)}
        >
          {!langs.some((item) => item.id === language) && language ? (
            <option value={language}>{language}</option>
          ) : null}
          {langs.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      )}
      <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-7" title="代码颜色">
            <Palette className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuLabel className="text-xs">
            {isBlock ? "代码块背景" : "行内代码颜色"}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {MARK_COLOR_PRESETS.map((preset) => (
            <DropdownMenuItem key={preset.label} onClick={() => setColor(preset.value)}>
              {preset.value ? (
                <span
                  className="mr-2 inline-block h-3 w-3 rounded-sm border border-border"
                  style={{ backgroundColor: preset.value }}
                />
              ) : (
                <span className="mr-2 inline-block h-3 w-3 rounded-sm border border-dashed border-border" />
              )}
              {preset.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

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
      className={cn("h-8 w-8 rounded-md", active && "bg-primary/10 text-primary")}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {children}
    </Button>
  );
}

function ToolbarGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="toolbar-group inline-flex max-w-full shrink-0 flex-wrap items-center gap-x-0.5 gap-y-1">
      <span className="toolbar-group-label">{label}</span>
      {children}
    </div>
  );
}

export function EditorToolbar({ editor, filePath, noteNames = [] }: EditorToolbarProps) {
  const settings = useAppStore((s) => s.settings);
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
  const [blockRefSel, setBlockRefSel] = useState<{ from: number; to: number } | null>(null);

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

  const insertMediaFile = async () => {
    if (!filePath) {
      window.alert("请先保存笔记，再插入 Office / PDF / XMind 文件。");
      return;
    }
    if (editor.isActive("embed")) {
      const replace = window.confirm(
        "当前已选中一个文件预览。继续插入会放在它后面；若直接替换选区内容可能丢失原预览。是否继续？",
      );
      if (!replace) return;
    }
    const picked = await pickLocalMediaPath();
    if (!picked) return;
    try {
      const relative = await copyIntoNoteResources(filePath, picked);
      if (editor.isActive("embed")) {
        const { to } = editor.state.selection;
        editor
          .chain()
          .focus()
          .insertContentAt(to, { type: "embed", attrs: { target: relative } })
          .run();
      } else {
        editor.chain().focus().setEmbed({ target: relative }).run();
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "插入文件失败");
    }
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
    const DEFAULT_SYNC_TEXT = "这是一个同步区块，允许用户编辑该区块中的内容。";
    const sel = blockRefSel ?? {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };
    const selected = editor.state.doc.textBetween(sel.from, sel.to).trim();
    const $from = editor.state.doc.resolve(sel.from);
    let para = $from.parent;
    let paraPos = sel.from;
    if (para.type.name !== "paragraph") {
      for (let depth = $from.depth; depth > 0; depth--) {
        const node = $from.node(depth);
        if (node.type.name === "paragraph") {
          para = node;
          paraPos = $from.before(depth);
          break;
        }
      }
    } else {
      paraPos = $from.before($from.depth);
    }

    const text = selected || para.textContent.trim() || DEFAULT_SYNC_TEXT;
    let blockId = (para.attrs.blockId as string | null) ?? "";
    if (para.type.name === "paragraph") {
      if (!para.textContent.trim()) {
        const tr = editor.state.tr.insertText(DEFAULT_SYNC_TEXT, paraPos + 1);
        blockId = generateBlockId();
        tr.setNodeMarkup(paraPos, undefined, { ...para.attrs, blockId });
        editor.view.dispatch(tr);
      } else if (!blockId) {
        blockId = generateBlockId();
        const pos = paraPos;
        editor.view.dispatch(
          editor.state.tr.setNodeMarkup(pos, undefined, { ...para.attrs, blockId }),
        );
      }
    } else {
      blockId = blockId || generateBlockId();
    }

    editor
      .chain()
      .focus()
      .insertBlockReference({
        sourceFile: filePath ?? "",
        blockId,
        sync: blockRefSync,
        content: text,
      })
      .run();
    setBlockRefOpen(false);
  };

  const insertQuestion = (kind: QuestionKind) => {
    editor.chain().focus().insertQuestion(kind).run();
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
      <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center gap-x-1 gap-y-1.5 border-b border-border/80 bg-muted/25 px-2 py-1.5">
        <ToolbarGroup label="编辑">
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
        <ToolbarButton
          onClick={() => setFindReplaceOpen(true)}
          title="查找与替换 (Ctrl+H)"
        >
          <Search className="h-4 w-4" />
        </ToolbarButton>
        {filePath && (
          <ToolbarButton
            onClick={() => void saveTab(filePath)}
            active={isDirty}
            title="保存到项目文件夹 (Ctrl+S)"
          >
            <Save className="h-4 w-4" />
          </ToolbarButton>
        )}
        </ToolbarGroup>

        <ToolbarGroup label="字体">
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
        </ToolbarGroup>

        <ToolbarGroup label="段落">
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
        <div className="flex items-center">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
            active={editor.isActive("heading", { level: 4 })}
            title={HEADING_TITLES[4]}
          >
            <Heading4 className="h-4 w-4" />
          </ToolbarButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-5 rounded-l-none px-0"
                title="五级、六级标题"
                aria-label="更多标题级别"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {[5, 6].map((level) => (
                <DropdownMenuItem
                  key={level}
                  onClick={() =>
                    editor
                      .chain()
                      .focus()
                      .toggleHeading({ level: level as 5 | 6 })
                      .run()
                  }
                >
                  {HEADING_TITLES[level]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="分隔线"
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        </ToolbarGroup>

        <ToolbarGroup label="代码">
        <div className="inline-flex shrink-0 items-center">
          <ToolbarButton
            onClick={() =>
              applyToolbarCodeBlock(editor, {
                inlineOnSelection: settings.code_inline_on_selection,
                mergeParagraphs: settings.code_merge_paragraphs,
              })
            }
            active={editor.isActive("codeBlock") || editor.isActive("code")}
            title="代码块（行内代码请在设置中开启「选中文字标成行内代码」后再点此按钮）"
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>
          <CodeToolbarExtras editor={editor} />
        </div>
        </ToolbarGroup>

        <ToolbarGroup label="插入">
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
        <ToolbarButton
          onClick={() => void insertMediaFile()}
          title="插入 Office / PDF / XMind（笔记内预览，可在编辑视图中打开编辑）"
        >
          <FileSpreadsheet className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={openImageDialog} title="插入图片">
          <ImageIcon className="h-4 w-4" />
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
        </ToolbarGroup>

        <ToolbarGroup label="题目">
        <ToolbarButton
          onClick={() => {
            setBlockRefSel({
              from: editor.state.selection.from,
              to: editor.state.selection.to,
            });
            setBlockRefOpen(true);
          }}
          title="引用当前段落为同步板块"
        >
          <Blocks className="h-4 w-4" />
        </ToolbarButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="题目"
              aria-label="插入题目"
            >
              <ClipboardList className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>题目</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => insertQuestion("single")}>单选题</DropdownMenuItem>
            <DropdownMenuItem onClick={() => insertQuestion("multiple")}>多选题</DropdownMenuItem>
            <DropdownMenuItem onClick={() => insertQuestion("fill")}>填空题</DropdownMenuItem>
            <DropdownMenuItem onClick={() => insertQuestion("match")}>连线题</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </ToolbarGroup>
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

      <Dialog
        open={blockRefOpen}
        onOpenChange={(open) => {
          setBlockRefOpen(open);
          if (!open && blockRefSel) {
            editor.chain().focus().setTextSelection(blockRefSel).run();
          }
        }}
      >
        <DialogContent
          className="max-w-sm"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            editor.chain().focus().run();
            if (blockRefSel) editor.commands.setTextSelection(blockRefSel);
          }}
        >
          <DialogHeader>
            <DialogTitle>引用段落板块</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            将当前段落引用为可同步的「板块」。未选中文字时会创建一个带默认说明的空白同步区块。
            创建后点击板块标题可在右侧面板查看来源并跳转。
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
            placeholder="笔记名、图片或 Office 文件路径"
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
