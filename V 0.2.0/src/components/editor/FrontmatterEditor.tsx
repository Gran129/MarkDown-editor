import { Input } from "@/components/ui/input";
import { getNoteTitle } from "@/lib/markdown";

interface FrontmatterEditorProps {
  filePath: string;
  frontmatter: Record<string, unknown>;
  onChange: (fm: Record<string, unknown>) => void;
  readOnly?: boolean;
}

export function FrontmatterEditor({
  filePath,
  frontmatter,
  onChange,
  readOnly = false,
}: FrontmatterEditorProps) {
  const storedTitle = typeof frontmatter.title === "string" ? frontmatter.title : "";
  const title = storedTitle || getNoteTitle(filePath, frontmatter);
  const tags = Array.isArray(frontmatter.tags)
    ? frontmatter.tags.filter((t): t is string => typeof t === "string").join(", ")
    : "";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/80 bg-muted/25 px-5 py-2.5 text-sm">
      <label className="flex min-w-[8rem] flex-1 basis-[12rem] items-center gap-2">
        <span className="shrink-0 text-sm font-medium text-muted-foreground">标题</span>
        <Input
          className="h-8 w-full min-w-0 bg-background/80 text-sm shadow-none"
          value={title}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => onChange({ ...frontmatter, title: e.target.value })}
          placeholder="笔记标题"
        />
      </label>
      <label className="flex min-w-[8rem] flex-1 basis-[14rem] items-center gap-2">
        <span className="shrink-0 text-sm font-medium text-muted-foreground">标签</span>
        <Input
          className="h-8 w-full min-w-0 bg-background/80 text-sm shadow-none"
          value={tags}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) =>
            onChange({
              ...frontmatter,
              tags: e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }
          placeholder="tag1, tag2"
        />
      </label>
    </div>
  );
}
