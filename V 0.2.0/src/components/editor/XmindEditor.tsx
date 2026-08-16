import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadXmind, saveXmind } from "@/lib/tauri-api";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

export interface XmindTopic {
  id: string;
  title: string;
  children: XmindTopic[];
}

export interface XmindDoc {
  title: string;
  root: XmindTopic;
}

interface XmindEditorProps {
  path: string;
  readOnly?: boolean;
  compact?: boolean;
}

function newId(): string {
  return `topic-${Math.random().toString(36).slice(2, 9)}`;
}

function updateTopic(topic: XmindTopic, id: string, patch: Partial<XmindTopic>): XmindTopic {
  if (topic.id === id) return { ...topic, ...patch };
  return { ...topic, children: topic.children.map((child) => updateTopic(child, id, patch)) };
}

function addChild(topic: XmindTopic, parentId: string): XmindTopic {
  if (topic.id === parentId) {
    return {
      ...topic,
      children: [...topic.children, { id: newId(), title: "新主题", children: [] }],
    };
  }
  return { ...topic, children: topic.children.map((child) => addChild(child, parentId)) };
}

function removeTopic(topic: XmindTopic, id: string): XmindTopic {
  return {
    ...topic,
    children: topic.children
      .filter((child) => child.id !== id)
      .map((child) => removeTopic(child, id)),
  };
}

function TopicRow({
  topic,
  depth,
  readOnly,
  onChange,
  onAdd,
  onRemove,
}: {
  topic: XmindTopic;
  depth: number;
  readOnly: boolean;
  onChange: (id: string, title: string) => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-1" style={{ paddingLeft: depth * 16 }}>
        <span className="h-2 w-2 shrink-0 rounded-full bg-primary/70" />
        <Input
          className="h-7 text-sm"
          value={topic.title}
          readOnly={readOnly}
          onChange={(e) => onChange(topic.id, e.target.value)}
        />
        {!readOnly && (
          <>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="添加子主题" onClick={() => onAdd(topic.id)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
            {depth > 0 && (
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="删除" onClick={() => onRemove(topic.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        )}
      </div>
      <div className="mt-1 space-y-1">
        {topic.children.map((child) => (
          <TopicRow
            key={child.id}
            topic={child}
            depth={depth + 1}
            readOnly={readOnly}
            onChange={onChange}
            onAdd={onAdd}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}

export function XmindEditor({ path, readOnly = false, compact = false }: XmindEditorProps) {
  const markSelfWrite = useAppStore((s) => s.markSelfWrite);
  const [doc, setDoc] = useState<XmindDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadXmind(path)
      .then((next) => {
        if (!cancelled) {
          setDoc(next);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "无法打开 XMind 文件");
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  const persist = useCallback(
    async (next: XmindDoc) => {
      setDoc(next);
      if (readOnly) return;
      markSelfWrite(2000);
      await saveXmind(path, next);
    },
    [markSelfWrite, path, readOnly],
  );

  if (error) {
    return <p className="p-3 text-sm text-destructive">{error}</p>;
  }
  if (!doc) {
    return <p className="p-3 text-sm text-muted-foreground">正在加载思维导图…</p>;
  }

  return (
    <div className={cn("rounded-md border bg-background p-3", compact ? "max-h-[28rem] overflow-auto" : "min-h-0 flex-1 overflow-auto")}>
      <p className="mb-2 text-xs text-muted-foreground">{readOnly ? "阅读预览" : "原生编辑 · 修改后自动写入 .xmind"}</p>
      <TopicRow
        topic={doc.root}
        depth={0}
        readOnly={readOnly}
        onChange={(id, title) => void persist({ ...doc, root: updateTopic(doc.root, id, { title }) })}
        onAdd={(id) => void persist({ ...doc, root: addChild(doc.root, id) })}
        onRemove={(id) => void persist({ ...doc, root: removeTopic(doc.root, id) })}
      />
    </div>
  );
}
