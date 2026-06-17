import { Input } from "@/components/ui/input";

interface FrontmatterEditorProps {
  frontmatter: Record<string, unknown>;
  onChange: (fm: Record<string, unknown>) => void;
}

export function FrontmatterEditor({ frontmatter, onChange }: FrontmatterEditorProps) {
  const title = typeof frontmatter.title === "string" ? frontmatter.title : "";
  const tags = Array.isArray(frontmatter.tags)
    ? frontmatter.tags.filter((t): t is string => typeof t === "string").join(", ")
    : "";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-sm">
      <label className="flex items-center gap-2">
        <span className="text-muted-foreground whitespace-nowrap">标题</span>
        <Input
          className="h-7 w-40"
          value={title}
          onChange={(e) => onChange({ ...frontmatter, title: e.target.value })}
          placeholder="笔记标题"
        />
      </label>
      <label className="flex items-center gap-2">
        <span className="text-muted-foreground whitespace-nowrap">标签</span>
        <Input
          className="h-7 w-48"
          value={tags}
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
