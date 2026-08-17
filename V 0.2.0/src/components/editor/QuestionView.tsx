import { useMemo, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { pickLocalImagePath } from "@/components/editor/CodeBlockColorMenu";
import {
  createQuestion,
  decodeQuestionPayload,
  encodeQuestionPayload,
  gradeQuestion,
  parseOfficialAnswer,
  QUESTION_KIND_LABEL,
  type QuestionData,
  type QuestionKind,
} from "@/lib/question";
import { copyIntoNoteResources } from "@/lib/tauri-api";
import { resolveNoteMediaFile } from "@/lib/note-format";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

function toDisplaySrc(abs: string): string {
  if (/^https?:\/\//i.test(abs)) return abs;
  try {
    return convertFileSrc(abs);
  } catch {
    return abs;
  }
}

function patchPayload(
  updateAttributes: NodeViewProps["updateAttributes"],
  current: QuestionData,
  patch: Partial<QuestionData>,
) {
  const next = { ...current, ...patch };
  updateAttributes({
    id: next.id,
    kind: next.kind,
    payload: encodeQuestionPayload(next),
  });
}

export function QuestionView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const viewMode = useAppStore((s) => s.viewMode);
  const settings = useAppStore((s) => s.settings);
  const notePath = useAppStore((s) => s.activeTabPath);
  const vaultPath = useAppStore((s) => s.vaultPath);
  const editing = viewMode === "editing" && editor.isEditable;

  const data = useMemo(() => {
    const kind = (node.attrs.kind as QuestionKind) || "single";
    return (
      decodeQuestionPayload(node.attrs.payload as string) ?? {
        ...createQuestion(kind),
        id: (node.attrs.id as string) || "",
        kind,
      }
    );
  }, [node.attrs.id, node.attrs.kind, node.attrs.payload]);

  const [importOpen, setImportOpen] = useState(false);
  const [draftAnswer, setDraftAnswer] = useState("");
  const [draftExplain, setDraftExplain] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [blanks, setBlanks] = useState<string[]>([]);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [pendingLeft, setPendingLeft] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [reveal, setReveal] = useState(false);

  const gradingOn = settings.quiz_enable_grading;
  const autoReveal = settings.quiz_auto_show_answer;
  const hasOfficial = Boolean(data.answer.trim());
  const showResult = gradingOn && hasOfficial && submitted && (autoReveal || reveal);

  const imageAbs = data.image
    ? resolveNoteMediaFile(notePath, vaultPath, data.image)
    : "";
  const imageSrc = imageAbs ? toDisplaySrc(imageAbs) : "";

  const stop = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const openImport = () => {
    const parsed = parseOfficialAnswer(data);
    if (data.kind === "single" || data.kind === "multiple") {
      setDraftAnswer(parsed.optionIds.join(","));
    } else if (data.kind === "fill") {
      setDraftAnswer(parsed.blanks.join(" | "));
    } else {
      setDraftAnswer(
        Object.entries(parsed.matches)
          .map(([left, right]) => `${left}=${right}`)
          .join("\n"),
      );
    }
    setDraftExplain(data.explanation);
    setImportOpen(true);
  };

  const applyImport = () => {
    let answer = "";
    if (data.kind === "single") {
      answer = draftAnswer.trim().split(/[,\s]+/)[0] ?? "";
    } else if (data.kind === "multiple") {
      answer = draftAnswer
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(",");
    } else if (data.kind === "fill") {
      answer = JSON.stringify(
        draftAnswer
          .split("|")
          .map((s) => s.trim())
          .filter((s, _i, arr) => s.length > 0 || arr.length === 1),
      );
    } else {
      const pairs: Record<string, string> = {};
      for (const line of draftAnswer.split("\n")) {
        const [left, right] = line.split(/[=:：]/).map((s) => s.trim());
        if (left && right) pairs[left] = right;
      }
      answer = JSON.stringify(pairs);
    }
    patchPayload(updateAttributes, data, { answer, explanation: draftExplain });
    setImportOpen(false);
  };

  const insertImage = async () => {
    if (!notePath) {
      window.alert("请先保存笔记，再为题目插入图片。");
      return;
    }
    const pickedPath = await pickLocalImagePath();
    if (!pickedPath) return;
    try {
      const relative = await copyIntoNoteResources(notePath, pickedPath);
      patchPayload(updateAttributes, data, { image: relative });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "插入图片失败");
    }
  };

  const toggleOption = (id: string) => {
    if (editing) return;
    if (data.kind === "single") {
      setPicked([id]);
      setSubmitted(true);
      if (autoReveal) setReveal(true);
      return;
    }
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setSubmitted(false);
    setReveal(false);
  };

  const submitAttempt = () => {
    setSubmitted(true);
    if (autoReveal) setReveal(true);
  };

  const correct = showResult
    ? gradeQuestion(data, { optionIds: picked, blanks, matches })
    : null;

  const promptParts = data.prompt.split("___");

  return (
    <NodeViewWrapper
      as="div"
      className={cn("question-block", selected && "is-selected")}
      data-question="true"
      data-kind={data.kind}
      data-id={data.id}
      onMouseDown={stop}
      onClick={stop}
    >
      <div className="question-chrome" contentEditable={false}>
        <span className="text-xs font-semibold">{QUESTION_KIND_LABEL[data.kind]}</span>
        <span className="ml-auto flex items-center gap-1">
          {editing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onMouseDown={(e) => e.preventDefault()}
              onClick={openImport}
            >
              导入客观题答案与解析
            </Button>
          )}
          {!editing && gradingOn && hasOfficial && submitted && !autoReveal && !reveal && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setReveal(true)}
            >
              显示答案与解析
            </Button>
          )}
        </span>
      </div>

      {editing ? (
        <textarea
          className="question-prompt-input"
          value={data.prompt}
          placeholder="输入题干，填空题可用 ___ 表示空白"
          onChange={(e) => patchPayload(updateAttributes, data, { prompt: e.target.value })}
        />
      ) : data.kind === "fill" ? (
        <p className="question-prompt">
          {promptParts.map((part, i) => (
            <span key={i}>
              {part}
              {i < promptParts.length - 1 && (
                <input
                  className="question-blank"
                  value={blanks[i] ?? ""}
                  onChange={(e) => {
                    const next = [...blanks];
                    next[i] = e.target.value;
                    setBlanks(next);
                    setSubmitted(false);
                    setReveal(false);
                  }}
                />
              )}
            </span>
          ))}
        </p>
      ) : (
        <p className="question-prompt">{data.prompt}</p>
      )}

      {imageSrc && (
        <div className="question-image-wrap">
          <img src={imageSrc} alt="" className="question-image" />
          {editing && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-7 w-7"
              title="移除图片"
              onClick={() => patchPayload(updateAttributes, data, { image: null })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      {editing && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void insertImage()}
        >
          <ImagePlus className="mr-1 h-3.5 w-3.5" />
          插入图片
        </Button>
      )}

      {(data.kind === "single" || data.kind === "multiple") && (
        <div className="question-options">
          {data.options.map((option, index) => (
            <label key={option.id} className="question-option">
              <input
                type={data.kind === "single" ? "radio" : "checkbox"}
                name={data.id}
                checked={
                  editing
                    ? false
                    : picked.includes(option.id)
                }
                disabled={editing}
                onChange={() => toggleOption(option.id)}
              />
              {editing ? (
                <input
                  className="question-option-edit"
                  value={option.text}
                  onChange={(e) => {
                    const options = data.options.map((item) =>
                      item.id === option.id ? { ...item, text: e.target.value } : item,
                    );
                    patchPayload(updateAttributes, data, { options });
                  }}
                />
              ) : (
                <span>
                  {String.fromCharCode(65 + index)}. {option.text}
                </span>
              )}
              {editing && data.options.length > 2 && (
                <button
                  type="button"
                  className="ml-auto text-xs text-muted-foreground"
                  onClick={() =>
                    patchPayload(updateAttributes, data, {
                      options: data.options.filter((item) => item.id !== option.id),
                    })
                  }
                >
                  删除
                </button>
              )}
            </label>
          ))}
          {editing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                const nextId = String.fromCharCode(97 + data.options.length);
                patchPayload(updateAttributes, data, {
                  options: [...data.options, { id: nextId, text: `选项 ${nextId.toUpperCase()}` }],
                });
              }}
            >
              添加选项
            </Button>
          )}
        </div>
      )}

      {data.kind === "fill" && editing && (
        <p className="text-xs text-muted-foreground">在题干中用三个下划线 ___ 标记每一处填空。</p>
      )}

      {data.kind === "match" && (
        <div className="question-match">
          <div className="question-match-col">
            {data.left.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "question-match-item",
                  pendingLeft === item.id && "is-pending",
                  matches[item.id] && "is-paired",
                )}
                onClick={() => {
                  if (editing) return;
                  setPendingLeft(item.id);
                }}
              >
                {editing ? (
                  <input
                    className="question-option-edit"
                    value={item.text}
                    onChange={(e) => {
                      const left = data.left.map((row) =>
                        row.id === item.id ? { ...row, text: e.target.value } : row,
                      );
                      patchPayload(updateAttributes, data, { left });
                    }}
                  />
                ) : (
                  <>
                    {index + 1}. {item.text}
                    {matches[item.id] ? ` → ${data.right.find((r) => r.id === matches[item.id])?.text ?? ""}` : ""}
                  </>
                )}
              </button>
            ))}
          </div>
          <div className="question-match-col">
            {data.right.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="question-match-item"
                onClick={() => {
                  if (editing || !pendingLeft) return;
                  setMatches((prev) => ({ ...prev, [pendingLeft]: item.id }));
                  setPendingLeft(null);
                  setSubmitted(false);
                  setReveal(false);
                }}
              >
                {editing ? (
                  <input
                    className="question-option-edit"
                    value={item.text}
                    onChange={(e) => {
                      const right = data.right.map((row) =>
                        row.id === item.id ? { ...row, text: e.target.value } : row,
                      );
                      patchPayload(updateAttributes, data, { right });
                    }}
                  />
                ) : (
                  <>
                    {String.fromCharCode(65 + index)}. {item.text}
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {!editing && data.kind !== "single" && (
        <Button type="button" size="sm" className="mt-2 h-7 text-xs" onClick={submitAttempt}>
          提交作答
        </Button>
      )}

      {showResult && (
        <div className={cn("question-result", correct ? "is-correct" : "is-wrong")}>
          <div className="font-medium">{correct ? "回答正确" : "回答错误"}</div>
          {data.explanation && <p className="mt-1 text-sm">{data.explanation}</p>}
          {!correct && data.kind !== "match" && (
            <p className="mt-1 text-xs text-muted-foreground">
              参考答案：{data.kind === "fill" ? parseOfficialAnswer(data).blanks.join(" / ") : data.answer}
            </p>
          )}
        </div>
      )}

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>导入客观题答案与解析</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {data.kind === "single" && "填写正确选项 id，例如 a"}
            {data.kind === "multiple" && "填写全部正确选项 id，逗号分隔，例如 a,c"}
            {data.kind === "fill" && "按空顺序填写答案，用 | 分隔"}
            {data.kind === "match" && "每行一对：左侧id=右侧id，例如 l1=r2"}
          </p>
          <textarea
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={draftAnswer}
            onChange={(e) => setDraftAnswer(e.target.value)}
            placeholder="答案"
          />
          <textarea
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={draftExplain}
            onChange={(e) => setDraftExplain(e.target.value)}
            placeholder="解析（可选）"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>
              取消
            </Button>
            <Button onClick={applyImport}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </NodeViewWrapper>
  );
}
