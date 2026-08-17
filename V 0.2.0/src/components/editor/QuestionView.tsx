import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ChevronDown, ChevronUp, ImagePlus, Trash2 } from "lucide-react";

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
  BLANK_DISPLAY,
  BLANK_TOKEN,
  countBlanks,
  createQuestion,
  decodeQuestionPayload,
  encodeOfficialAnswer,
  encodeQuestionPayload,
  generateMediaId,
  gradeQuestion,
  parseOfficialAnswer,
  QUESTION_KIND_LABEL,
  isChoiceQuestion,
  isSinglePickQuestion,
  type QuestionData,
  type QuestionKind,
  type QuestionMedia,
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

function QuestionImages({
  images,
  notePath,
  vaultPath,
  editing,
  onChange,
}: {
  images: QuestionMedia[];
  notePath: string | null;
  vaultPath: string | null;
  editing: boolean;
  onChange: (images: QuestionMedia[]) => void;
}) {
  if (images.length === 0) return null;
  return (
    <div className="question-image-list">
      {images.map((image) => {
        const abs = resolveNoteMediaFile(notePath, vaultPath, image.src);
        const src = abs ? toDisplaySrc(abs) : "";
        return (
          <div key={image.id} className="question-image-wrap">
            {src ? (
              <img
                src={src}
                alt=""
                className="question-image"
                data-question-media={image.src}
                style={{ width: `${image.width}%` }}
              />
            ) : (
              <p className="text-xs text-muted-foreground">{image.src}</p>
            )}
            {editing && (
              <div className="question-image-tools">
                <input
                  type="range"
                  min={20}
                  max={100}
                  value={image.width}
                  aria-label="调整图片宽度"
                  onChange={(e) =>
                    onChange(
                      images.map((item) =>
                        item.id === image.id ? { ...item, width: Number(e.target.value) } : item,
                      ),
                    )
                  }
                />
                <span className="text-[10px] text-muted-foreground">{image.width}%</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  title="移除图片"
                  onClick={() => onChange(images.filter((item) => item.id !== image.id))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MatchBoard({
  data,
  matches,
  pendingLeft,
  interactive,
  onPickLeft,
  onPickRight,
}: {
  data: QuestionData;
  matches: Record<string, string>;
  pendingLeft: string | null;
  interactive: boolean;
  onPickLeft: (id: string) => void;
  onPickRight: (id: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);

  const [boardSize, setBoardSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const rect = wrap.getBoundingClientRect();
      setBoardSize({ w: rect.width, h: rect.height });
      const next: { x1: number; y1: number; x2: number; y2: number }[] = [];
      for (const [leftId, rightId] of Object.entries(matches)) {
        const leftEl = wrap.querySelector<HTMLElement>(`[data-match-id="${leftId}"]`);
        const rightEl = wrap.querySelector<HTMLElement>(`[data-match-id="${rightId}"]`);
        if (!leftEl || !rightEl) continue;
        const a = leftEl.getBoundingClientRect();
        const b = rightEl.getBoundingClientRect();
        next.push({
          x1: a.right - rect.left,
          y1: a.top + a.height / 2 - rect.top,
          x2: b.left - rect.left,
          y2: b.top + b.height / 2 - rect.top,
        });
      }
      setLines(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [matches, data.left, data.right, pendingLeft]);

  return (
    <div ref={wrapRef} className="question-match">
      <svg
        className="question-match-lines"
        aria-hidden
        width={boardSize.w}
        height={boardSize.h}
        viewBox={`0 0 ${Math.max(1, boardSize.w)} ${Math.max(1, boardSize.h)}`}
      >
        {lines.map((line, index) => (
          <line
            key={index}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="currentColor"
            strokeWidth="2"
          />
        ))}
      </svg>
      <div className="question-match-col">
        {data.left.map((item, index) => (
          <button
            key={item.id}
            type="button"
            data-match-id={item.id}
            className={cn(
              "question-match-item",
              pendingLeft === item.id && "is-pending",
              matches[item.id] && "is-paired",
            )}
            onClick={() => interactive && onPickLeft(item.id)}
          >
            {index + 1}. {item.text}
          </button>
        ))}
      </div>
      <div className="question-match-col">
        {data.right.map((item, index) => (
          <button
            key={item.id}
            type="button"
            data-match-id={item.id}
            className={cn(
              "question-match-item",
              Object.values(matches).includes(item.id) && "is-paired",
            )}
            onClick={() => interactive && onPickRight(item.id)}
          >
            {String.fromCharCode(65 + index)}. {item.text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function QuestionView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const viewMode = useAppStore((s) => s.viewMode);
  const settings = useAppStore((s) => s.settings);
  const notePath = useAppStore((s) => s.activeTabPath);
  const vaultPath = useAppStore((s) => s.vaultPath);
  const editing = viewMode === "editing";
  const reading = viewMode === "reading";

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
  const [picked, setPicked] = useState<string[]>([]);
  const [blanks, setBlanks] = useState<string[]>([]);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [pendingLeft, setPendingLeft] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [draftOptions, setDraftOptions] = useState<string[]>([]);
  const [draftBlanks, setDraftBlanks] = useState<string[]>([]);
  const [draftMatches, setDraftMatches] = useState<Record<string, string>>({});
  const [draftPending, setDraftPending] = useState<string | null>(null);
  const [draftExplain, setDraftExplain] = useState("");
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setPicked([]);
    setBlanks([]);
    setMatches({});
    setPendingLeft(null);
    setSubmitted(false);
    setReveal(false);
  }, [viewMode]);

  const gradingOn = reading && settings.quiz_enable_grading;
  const autoReveal = reading && settings.quiz_enable_grading && settings.quiz_auto_show_answer;
  const hasOfficial = Boolean(data.answer.trim());
  const showResult = gradingOn && hasOfficial && submitted && (autoReveal || reveal);
  const showSubmit =
    reading &&
    gradingOn &&
    hasOfficial &&
    data.kind !== "single" &&
    data.kind !== "boolean";
  const showRevealButton =
    reading && gradingOn && hasOfficial && submitted && !autoReveal && !reveal;

  const stop = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const pickImage = async (): Promise<QuestionMedia | null> => {
    if (!notePath) {
      window.alert("请先保存笔记，再为题目插入图片。");
      return null;
    }
    const pickedPath = await pickLocalImagePath();
    if (!pickedPath) return null;
    try {
      const relative = await copyIntoNoteResources(notePath, pickedPath);
      return { id: generateMediaId(), src: relative, width: 80 };
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "插入图片失败");
      return null;
    }
  };

  const toggleOption = (id: string) => {
    if (isSinglePickQuestion(data.kind)) {
      setPicked([id]);
      if (reading && gradingOn && hasOfficial) {
        setSubmitted(true);
        if (autoReveal) setReveal(true);
      } else {
        setSubmitted(false);
        setReveal(false);
      }
      return;
    }
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setSubmitted(false);
    setReveal(false);
  };

  const submitAttempt = () => {
    if (!reading) return;
    setSubmitted(true);
    if (autoReveal) setReveal(true);
  };

  const openImport = () => {
    const parsed = parseOfficialAnswer(data);
    setDraftOptions(parsed.optionIds);
    setDraftBlanks(
      Array.from({ length: Math.max(1, countBlanks(data.prompt)) }, (_, i) => parsed.blanks[i] ?? ""),
    );
    setDraftMatches(parsed.matches);
    setDraftPending(null);
    setDraftExplain(data.explanation);
    setImportOpen(true);
  };

  const applyImport = () => {
    const answer = encodeOfficialAnswer(data.kind, draftOptions, draftBlanks, draftMatches);
    patchPayload(updateAttributes, data, { answer, explanation: draftExplain });
    setImportOpen(false);
  };

  const correct = showResult
    ? gradeQuestion(data, { optionIds: picked, blanks, matches })
    : null;

  const promptParts = data.prompt.split(BLANK_TOKEN);
  const canInteractOptions = editor.isEditable || reading || editing;

  return (
    <NodeViewWrapper
      as="div"
      className={cn("question-block", selected && "is-selected", data.collapsed && "is-collapsed")}
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
          {showRevealButton && (
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            title={data.collapsed ? "展开题目" : "收起题目"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => patchPayload(updateAttributes, data, { collapsed: !data.collapsed })}
          >
            {data.collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            {data.collapsed ? "展开" : "收起"}
          </Button>
        </span>
      </div>

      {!data.collapsed && (
        <>
          {editing ? (
            <>
              <textarea
                ref={promptRef}
                className="question-prompt-input"
                value={data.prompt.replaceAll(BLANK_TOKEN, BLANK_DISPLAY)}
                placeholder={data.kind === "fill" ? "输入题干，用「插入填空」在光标处添加空白" : "输入题干"}
                onChange={(e) =>
                  patchPayload(updateAttributes, data, {
                    prompt: e.target.value.replaceAll(BLANK_DISPLAY, BLANK_TOKEN),
                  })
                }
              />
              <div className="mb-2 flex flex-wrap gap-1">
                {data.kind === "fill" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      const el = promptRef.current;
                      const display = data.prompt.replaceAll(BLANK_TOKEN, BLANK_DISPLAY);
                      const cursor = el?.selectionStart ?? display.length;
                      const nextDisplay = `${display.slice(0, cursor)}${BLANK_DISPLAY}${display.slice(cursor)}`;
                      patchPayload(updateAttributes, data, {
                        prompt: nextDisplay.replaceAll(BLANK_DISPLAY, BLANK_TOKEN),
                      });
                      const nextCursor = cursor + BLANK_DISPLAY.length;
                      requestAnimationFrame(() => {
                        el?.focus();
                        el?.setSelectionRange(nextCursor, nextCursor);
                      });
                    }}
                  >
                    插入填空
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    void pickImage().then((media) => {
                      if (media) {
                        patchPayload(updateAttributes, data, {
                          promptImages: [...data.promptImages, media],
                        });
                      }
                    })
                  }
                >
                  <ImagePlus className="mr-1 h-3.5 w-3.5" />
                  在题干插入图片
                </Button>
              </div>
            </>
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

          <QuestionImages
            images={data.promptImages}
            notePath={notePath}
            vaultPath={vaultPath}
            editing={editing}
            onChange={(promptImages) => patchPayload(updateAttributes, data, { promptImages })}
          />

          {(isChoiceQuestion(data.kind)) && (
            <div className="question-options">
              {data.options.map((option, index) => (
                <div key={option.id} className="question-option-block">
                  <label className="question-option">
                    <input
                      type={isSinglePickQuestion(data.kind) ? "radio" : "checkbox"}
                      name={`${data.id}-${viewMode}`}
                      checked={picked.includes(option.id)}
                      disabled={!canInteractOptions}
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
                    {editing && data.kind !== "boolean" && data.options.length > 2 && (
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
                  <QuestionImages
                    images={option.images}
                    notePath={notePath}
                    vaultPath={vaultPath}
                    editing={editing}
                    onChange={(images) =>
                      patchPayload(updateAttributes, data, {
                        options: data.options.map((item) =>
                          item.id === option.id ? { ...item, images } : item,
                        ),
                      })
                    }
                  />
                  {editing && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px]"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() =>
                        void pickImage().then((media) => {
                          if (!media) return;
                          patchPayload(updateAttributes, data, {
                            options: data.options.map((item) =>
                              item.id === option.id
                                ? { ...item, images: [...item.images, media] }
                                : item,
                            ),
                          });
                        })
                      }
                    >
                      <ImagePlus className="mr-1 h-3 w-3" />
                      在该选项插入图片
                    </Button>
                  )}
                </div>
              ))}
              {editing && data.kind !== "boolean" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    const nextId = String.fromCharCode(97 + data.options.length);
                    patchPayload(updateAttributes, data, {
                      options: [
                        ...data.options,
                        { id: nextId, text: `选项 ${nextId.toUpperCase()}`, images: [] },
                      ],
                    });
                  }}
                >
                  添加选项
                </Button>
              )}
            </div>
          )}

          {data.kind === "fill" && editing && (
            <p className="text-xs text-muted-foreground">
              本题共 {countBlanks(data.prompt)} 处填空。阅读视图中会在「〔空〕」位置显示输入框。
            </p>
          )}

          {data.kind === "match" && (
            <>
              {editing && (
                <div className="question-match-edit mb-2 grid grid-cols-2 gap-2">
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">左侧</p>
                    {data.left.map((item) => (
                      <input
                        key={item.id}
                        className="question-option-edit mb-1"
                        value={item.text}
                        onChange={(e) =>
                          patchPayload(updateAttributes, data, {
                            left: data.left.map((row) =>
                              row.id === item.id ? { ...row, text: e.target.value } : row,
                            ),
                          })
                        }
                      />
                    ))}
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">右侧</p>
                    {data.right.map((item) => (
                      <input
                        key={item.id}
                        className="question-option-edit mb-1"
                        value={item.text}
                        onChange={(e) =>
                          patchPayload(updateAttributes, data, {
                            right: data.right.map((row) =>
                              row.id === item.id ? { ...row, text: e.target.value } : row,
                            ),
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
              <MatchBoard
                data={data}
                matches={matches}
                pendingLeft={pendingLeft}
                interactive={!data.collapsed}
                onPickLeft={(id) => {
                  setPendingLeft(id);
                  setSubmitted(false);
                  setReveal(false);
                }}
                onPickRight={(id) => {
                  if (!pendingLeft) return;
                  setMatches((prev) => ({ ...prev, [pendingLeft]: id }));
                  setPendingLeft(null);
                  setSubmitted(false);
                  setReveal(false);
                }}
              />
            </>
          )}

          {showSubmit && (
            <Button type="button" size="sm" className="mt-2 h-7 text-xs" onClick={submitAttempt}>
              提交作答
            </Button>
          )}

          {showResult && (
            <div className={cn("question-result", correct ? "is-correct" : "is-wrong")}>
              <div className="font-medium">{correct ? "回答正确" : "回答错误"}</div>
              {data.explanation && <p className="mt-1 text-sm whitespace-pre-wrap">{data.explanation}</p>}
            </div>
          )}
        </>
      )}

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>导入客观题答案与解析</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {data.kind === "single" && "直接点选正确选项，不必填写编号。"}
            {data.kind === "boolean" && "点选「正确」或「错误」。"}
            {data.kind === "multiple" && "勾选全部正确选项。"}
            {data.kind === "fill" && "按填空顺序填写每空答案。"}
            {data.kind === "match" && "先点左侧再点右侧，用连线配对。"}
          </p>
          {isChoiceQuestion(data.kind) && (
            <div className="space-y-1">
              {data.options.map((option, index) => (
                <label key={option.id} className="flex items-center gap-2 text-sm">
                  <input
                    type={isSinglePickQuestion(data.kind) ? "radio" : "checkbox"}
                    name="import-answer"
                    checked={draftOptions.includes(option.id)}
                    onChange={() => {
                      if (isSinglePickQuestion(data.kind)) setDraftOptions([option.id]);
                      else {
                        setDraftOptions((prev) =>
                          prev.includes(option.id)
                            ? prev.filter((id) => id !== option.id)
                            : [...prev, option.id],
                        );
                      }
                    }}
                  />
                  {String.fromCharCode(65 + index)}. {option.text}
                </label>
              ))}
            </div>
          )}
          {data.kind === "fill" && (
            <div className="space-y-2">
              {Array.from({ length: Math.max(1, countBlanks(data.prompt)) }, (_, i) => (
                <label key={i} className="block text-sm">
                  第 {i + 1} 空
                  <input
                    className="question-option-edit mt-1"
                    value={draftBlanks[i] ?? ""}
                    onChange={(e) => {
                      const next = [...draftBlanks];
                      next[i] = e.target.value;
                      setDraftBlanks(next);
                    }}
                  />
                </label>
              ))}
            </div>
          )}
          {data.kind === "match" && (
            <MatchBoard
              data={data}
              matches={draftMatches}
              pendingLeft={draftPending}
              interactive
              onPickLeft={setDraftPending}
              onPickRight={(id) => {
                if (!draftPending) return;
                setDraftMatches((prev) => ({ ...prev, [draftPending]: id }));
                setDraftPending(null);
              }}
            />
          )}
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
