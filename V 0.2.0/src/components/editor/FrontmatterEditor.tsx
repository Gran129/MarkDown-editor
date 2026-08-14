import { Input } from "@/components/ui/input";

interface FrontmatterEditorProps {
  frontmatter: Record<string, unknown>;
  onChange: (fm: Record<string, unknown>) => void;
  readOnly?: boolean;
}

export function FrontmatterEditor({
  frontmatter,
  onChange,
  readOnly = false,
}: FrontmatterEditorProps) {
  const title = typeof frontmatter.title === "string" ? frontmatter.title : "";
  const tags = Array.isArray(frontmatter.tags)
    ? frontmatter.tags.filter((t): t is string => typeof t === "string").join(", ")
    : "";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/80 bg-muted/25 px-5 py-2 text-sm">
      <label className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          标题
        </span>
        <Input
          className="h-7 w-44 bg-background/80 shadow-none"
          value={title}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => onChange({ ...frontmatter, title: e.target.value })}
          placeholder="笔记标题"
        />
      </label>
      <label className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          标签
        </span>
        <Input
          className="h-7 w-52 bg-background/80 shadow-none"
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
