export type QuestionKind = "single" | "multiple" | "boolean" | "fill" | "match";

export const BLANK_TOKEN = "___";
export const BLANK_DISPLAY = "〔空〕";

export interface QuestionMedia {
  id: string;
  src: string;
  width: number;
}

export interface QuestionOption {
  id: string;
  text: string;
  images: QuestionMedia[];
}

export interface QuestionMatchItem {
  id: string;
  text: string;
}

export interface QuestionData {
  id: string;
  kind: QuestionKind;
  prompt: string;
  promptImages: QuestionMedia[];
  options: QuestionOption[];
  left: QuestionMatchItem[];
  right: QuestionMatchItem[];
  /** Official key: single = option id; multiple = comma ids; fill = JSON string[]; match = JSON Record. */
  answer: string;
  explanation: string;
  collapsed: boolean;
}

export const QUESTION_KIND_LABEL: Record<QuestionKind, string> = {
  single: "单选题",
  multiple: "多选题",
  boolean: "判断题",
  fill: "填空题",
  match: "连线题",
};

export function isChoiceQuestion(kind: QuestionKind): boolean {
  return kind === "single" || kind === "multiple" || kind === "boolean";
}

export function isSinglePickQuestion(kind: QuestionKind): boolean {
  return kind === "single" || kind === "boolean";
}

export function generateQuestionId(): string {
  return `q_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

export function generateMediaId(): string {
  return `img_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function letterId(index: number): string {
  return String.fromCharCode(97 + index);
}

function defaultOptions(): QuestionOption[] {
  return Array.from({ length: 4 }, (_, i) => ({
    id: letterId(i),
    text: `选项 ${String.fromCharCode(65 + i)}`,
    images: [],
  }));
}

export function createQuestion(kind: QuestionKind): QuestionData {
  const id = generateQuestionId();
  if (kind === "fill") {
    return {
      id,
      kind,
      prompt: `请在空白处填入答案：${BLANK_TOKEN}`,
      promptImages: [],
      options: [],
      left: [],
      right: [],
      answer: "",
      explanation: "",
      collapsed: false,
    };
  }
  if (kind === "boolean") {
    return {
      id,
      kind,
      prompt: "请判断对错。",
      promptImages: [],
      options: [
        { id: "a", text: "正确", images: [] },
        { id: "b", text: "错误", images: [] },
      ],
      left: [],
      right: [],
      answer: "",
      explanation: "",
      collapsed: false,
    };
  }
  if (kind === "match") {
    return {
      id,
      kind,
      prompt: "请将左侧与右侧正确配对。",
      promptImages: [],
      options: [],
      left: [
        { id: "l1", text: "左侧 1" },
        { id: "l2", text: "左侧 2" },
        { id: "l3", text: "左侧 3" },
      ],
      right: [
        { id: "r1", text: "右侧 A" },
        { id: "r2", text: "右侧 B" },
        { id: "r3", text: "右侧 C" },
      ],
      answer: "",
      explanation: "",
      collapsed: false,
    };
  }
  return {
    id,
    kind,
    prompt: kind === "multiple" ? "请选择所有正确答案。" : "请选择正确答案。",
    promptImages: [],
    options: defaultOptions(),
    left: [],
    right: [],
    answer: "",
    explanation: "",
    collapsed: false,
  };
}

function asMediaList(raw: unknown): QuestionMedia[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const rec = item as Record<string, unknown>;
      const src = typeof rec.src === "string" ? rec.src : "";
      if (!src) return null;
      const width = Number(rec.width);
      return {
        id: typeof rec.id === "string" && rec.id ? rec.id : generateMediaId(),
        src,
        width: Number.isFinite(width) ? Math.min(100, Math.max(20, width)) : 80,
      };
    })
    .filter((item): item is QuestionMedia => Boolean(item));
}

function asOptions(raw: unknown): QuestionOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    if (typeof item === "string") {
      return { id: letterId(index), text: item, images: [] };
    }
    const rec = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      id: typeof rec.id === "string" && rec.id ? rec.id : letterId(index),
      text: typeof rec.text === "string" ? rec.text : `选项 ${String.fromCharCode(65 + index)}`,
      images: asMediaList(rec.images),
    };
  });
}

function asMatchItems(raw: unknown, prefix: string): QuestionMatchItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    if (typeof item === "string") return { id: `${prefix}${index + 1}`, text: item };
    const rec = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      id: typeof rec.id === "string" && rec.id ? rec.id : `${prefix}${index + 1}`,
      text: typeof rec.text === "string" ? rec.text : `${prefix} ${index + 1}`,
    };
  });
}

export function parseQuestionPayload(raw: string): QuestionData | null {
  try {
    const parsed = JSON.parse(raw) as Partial<QuestionData> & { image?: string | null };
    if (!parsed || typeof parsed !== "object") return null;
    const kind = parsed.kind;
    if (
      kind !== "single" &&
      kind !== "multiple" &&
      kind !== "boolean" &&
      kind !== "fill" &&
      kind !== "match"
    ) {
      return null;
    }
    const created = createQuestion(kind);
    const legacyImage =
      typeof parsed.image === "string" && parsed.image
        ? [{ id: generateMediaId(), src: parsed.image, width: 80 }]
        : [];
    return {
      ...created,
      ...parsed,
      kind,
      id: typeof parsed.id === "string" && parsed.id ? parsed.id : created.id,
      prompt: typeof parsed.prompt === "string" ? parsed.prompt : created.prompt,
      promptImages: asMediaList(parsed.promptImages).length
        ? asMediaList(parsed.promptImages)
        : legacyImage,
      options: asOptions(parsed.options),
      left: asMatchItems(parsed.left, "l"),
      right: asMatchItems(parsed.right, "r"),
      answer: typeof parsed.answer === "string" ? parsed.answer : "",
      explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
      collapsed: Boolean(parsed.collapsed),
    };
  } catch {
    return null;
  }
}

export function encodeQuestionPayload(data: QuestionData): string {
  return encodeURIComponent(JSON.stringify(data));
}

export function decodeQuestionPayload(encoded: string): QuestionData | null {
  try {
    return parseQuestionPayload(decodeURIComponent(encoded));
  } catch {
    return parseQuestionPayload(encoded);
  }
}

export function countBlanks(prompt: string): number {
  return prompt.split(BLANK_TOKEN).length - 1;
}

export function insertBlankToken(prompt: string, cursor: number): { prompt: string; cursor: number } {
  const next = `${prompt.slice(0, cursor)}${BLANK_TOKEN}${prompt.slice(cursor)}`;
  return { prompt: next, cursor: cursor + BLANK_TOKEN.length };
}

function escapeFence(value: string): string {
  return value.replace(/\n/g, " ").trim();
}

function mediaLines(images: QuestionMedia[], indent = ""): string[] {
  return images.map((img) => `${indent}图：${img.src} | ${Math.round(img.width)}%`);
}

export function serializeQuestionMarkdown(data: QuestionData): string {
  const lines: string[] = [
    `:::question ${data.kind}${data.collapsed ? " collapsed" : ""}`,
  ];
  lines.push(`题干：${data.prompt.replaceAll(BLANK_TOKEN, BLANK_DISPLAY)}`);
  lines.push(...mediaLines(data.promptImages));

  if (isChoiceQuestion(data.kind)) {
    const official = parseOfficialAnswer(data).optionIds;
    for (const option of data.options) {
      const mark = official.includes(option.id) ? "x" : " ";
      lines.push(`- [${mark}] ${escapeFence(option.text)}`);
      lines.push(...mediaLines(option.images, "  "));
    }
  }

  if (data.kind === "fill") {
    const blanks = parseOfficialAnswer(data).blanks;
    if (blanks.some((item) => item.trim())) {
      lines.push(`答案：${blanks.join(" ｜ ")}`);
    }
  }

  if (data.kind === "match") {
    lines.push("左：");
    for (const item of data.left) lines.push(`- ${escapeFence(item.text)}`);
    lines.push("右：");
    for (const item of data.right) lines.push(`- ${escapeFence(item.text)}`);
    const pairs = parseOfficialAnswer(data).matches;
    const pairLines = Object.entries(pairs)
      .map(([leftId, rightId]) => {
        const left = data.left.find((item) => item.id === leftId)?.text;
        const right = data.right.find((item) => item.id === rightId)?.text;
        if (!left || !right) return "";
        return `- ${left} = ${right}`;
      })
      .filter(Boolean);
    if (pairLines.length) {
      lines.push("答案：");
      lines.push(...pairLines);
    }
  }

  if (data.explanation.trim()) {
    lines.push(`解析：${data.explanation.replaceAll("\n", " / ")}`);
  }
  lines.push(":::");
  return lines.join("\n");
}

const OLD_JSON_START_RE =
  /^⟦question\s+kind="(single|multiple|boolean|fill|match)"\s+id="([^"]+)"⟧$/;
const OLD_JSON_END_RE = /^⟦\/question⟧$/;
const FENCE_START_RE =
  /^:::question\s+(single|multiple|boolean|fill|match)(?:\s+(collapsed))?\s*$/;

function parseMediaLine(line: string): QuestionMedia | null {
  const match = line.match(/^\s*图：(.+?)(?:\s*\|\s*(\d+)\s*%?)?\s*$/);
  if (!match) return null;
  const width = Number(match[2] ?? 80);
  return {
    id: generateMediaId(),
    src: match[1]!.trim(),
    width: Number.isFinite(width) ? Math.min(100, Math.max(20, width)) : 80,
  };
}

function parseReadableQuestion(kind: QuestionKind, body: string[]): QuestionData {
  const data = createQuestion(kind);
  if (isChoiceQuestion(kind)) data.options = [];
  if (kind === "match") {
    data.left = [];
    data.right = [];
  }
  let section: "body" | "left" | "right" | "answers" = "body";
  const answerLines: string[] = [];
  let lastOption: QuestionOption | null = null;

  for (const raw of body) {
    const line = raw.trimEnd();
    const media = parseMediaLine(line);
    if (media) {
      if (lastOption) lastOption.images.push(media);
      else data.promptImages.push(media);
      continue;
    }
    if (/^左：/.test(line.trim())) {
      section = "left";
      lastOption = null;
      continue;
    }
    if (/^右：/.test(line.trim())) {
      section = "right";
      lastOption = null;
      continue;
    }
    if (/^答案：/.test(line.trim())) {
      const rest = line.replace(/^答案：/, "").trim();
      section = "answers";
      lastOption = null;
      if (rest) answerLines.push(rest);
      continue;
    }
    if (/^解析：/.test(line.trim())) {
      data.explanation = line.replace(/^解析：/, "").trim().replaceAll(" / ", "\n");
      lastOption = null;
      continue;
    }
    if (/^题干：/.test(line.trim())) {
      data.prompt = line.replace(/^题干：/, "").replaceAll(BLANK_DISPLAY, BLANK_TOKEN);
      lastOption = null;
      continue;
    }
    const option = line.match(/^- \[([ xX])\]\s*(.*)$/);
    if (option && isChoiceQuestion(kind)) {
      const item: QuestionOption = {
        id: letterId(data.options.length),
        text: option[2] ?? "",
        images: [],
      };
      data.options.push(item);
      lastOption = item;
      if (option[1] !== " ") {
        const ids = data.answer ? data.answer.split(",") : [];
        ids.push(item.id);
        data.answer = isSinglePickQuestion(kind) ? item.id : ids.join(",");
      }
      continue;
    }
    const bullet = line.match(/^- (.+)$/);
    if (bullet && kind === "match") {
      if (section === "left") data.left.push({ id: `l${data.left.length + 1}`, text: bullet[1]! });
      else if (section === "right") data.right.push({ id: `r${data.right.length + 1}`, text: bullet[1]! });
      else if (section === "answers") answerLines.push(bullet[1]!);
      lastOption = null;
      continue;
    }
  }

  if (kind === "fill" && answerLines.length) {
    data.answer = JSON.stringify(
      answerLines
        .join("｜")
        .split(/｜|\|/)
        .map((item) => item.trim()),
    );
  }
  if (kind === "match" && answerLines.length) {
    const matches: Record<string, string> = {};
    for (const line of answerLines) {
      const [leftText, rightText] = line.split("=").map((part) => part.trim());
      if (!leftText || !rightText) continue;
      const left = data.left.find((item) => item.text === leftText);
      const right = data.right.find((item) => item.text === rightText);
      if (left && right) matches[left.id] = right.id;
    }
    data.answer = JSON.stringify(matches);
  }
  if (isChoiceQuestion(kind) && data.options.length === 0) {
    data.options = kind === "boolean" ? createQuestion("boolean").options : defaultOptions();
  }
  return data;
}

function questionToHtml(data: QuestionData): string {
  const payload = encodeQuestionPayload(data);
  return `<div data-question="true" data-kind="${data.kind}" data-id="${data.id}" data-payload="${payload}" class="question-block"></div>`;
}

export function preprocessQuestions(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const fence = lines[i]!.match(FENCE_START_RE);
    if (fence) {
      const kind = fence[1] as QuestionKind;
      const collapsed = fence[2] === "collapsed";
      const body: string[] = [];
      i++;
      while (i < lines.length && lines[i]!.trim() !== ":::") {
        body.push(lines[i]!);
        i++;
      }
      if (i < lines.length) i++;
      out.push(questionToHtml({ ...parseReadableQuestion(kind, body), collapsed }));
      continue;
    }
    const old = lines[i]!.match(OLD_JSON_START_RE);
    if (old) {
      const kind = old[1] as QuestionKind;
      const id = old[2]!;
      const body: string[] = [];
      i++;
      while (i < lines.length && !OLD_JSON_END_RE.test(lines[i]!)) {
        body.push(lines[i]!);
        i++;
      }
      if (i < lines.length) i++;
      const parsed = parseQuestionPayload(body.join("\n")) ?? { ...createQuestion(kind), id };
      out.push(questionToHtml({ ...parsed, id, kind }));
      continue;
    }
    out.push(lines[i]!);
    i++;
  }
  return out.join("\n");
}

export function postprocessQuestions(md: string): string {
  return md.replace(/<div[^>]*data-question="true"[^>]*>[\s\S]*?<\/div>/gi, (full) => {
    const kind = (full.match(/data-kind="([^"]*)"/i)?.[1] ?? "single") as QuestionKind;
    const id = full.match(/data-id="([^"]*)"/i)?.[1] ?? generateQuestionId();
    const encoded = full.match(/data-payload="([^"]*)"/i)?.[1] ?? "";
    const data =
      decodeQuestionPayload(encoded) ??
      parseQuestionPayload(encoded) ?? { ...createQuestion(kind), id, kind };
    return serializeQuestionMarkdown({ ...data, id, kind });
  });
}

export function gradeQuestion(
  data: QuestionData,
  attempt: { optionIds?: string[]; blanks?: string[]; matches?: Record<string, string> },
): boolean {
  if (!data.answer.trim()) return false;
  if (isSinglePickQuestion(data.kind)) {
    return (attempt.optionIds?.[0] ?? "") === data.answer.trim();
  }
  if (data.kind === "multiple") {
    const expected = data.answer
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .sort();
    const got = [...(attempt.optionIds ?? [])].sort();
    return expected.length > 0 && expected.join(",") === got.join(",");
  }
  if (data.kind === "fill") {
    let expected: string[] = [];
    try {
      const parsed = JSON.parse(data.answer) as unknown;
      expected = Array.isArray(parsed) ? parsed.map((v) => String(v).trim()) : [String(parsed)];
    } catch {
      expected = data.answer.split("|").map((s) => s.trim());
    }
    const got = attempt.blanks ?? [];
    if (expected.length === 0) return false;
    return expected.every((ans, i) => normalizeBlank(got[i] ?? "") === normalizeBlank(ans));
  }
  let expected: Record<string, string> = {};
  try {
    expected = JSON.parse(data.answer) as Record<string, string>;
  } catch {
    return false;
  }
  const got = attempt.matches ?? {};
  const keys = Object.keys(expected);
  if (keys.length === 0) return false;
  return keys.every((key) => got[key] === expected[key]);
}

function normalizeBlank(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function parseOfficialAnswer(data: QuestionData): {
  optionIds: string[];
  blanks: string[];
  matches: Record<string, string>;
} {
  if (isSinglePickQuestion(data.kind)) {
    return { optionIds: data.answer.trim() ? [data.answer.trim()] : [], blanks: [], matches: {} };
  }
  if (data.kind === "multiple") {
    return {
      optionIds: data.answer
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      blanks: [],
      matches: {},
    };
  }
  if (data.kind === "fill") {
    try {
      const parsed = JSON.parse(data.answer) as unknown;
      const blanks = Array.isArray(parsed) ? parsed.map((v) => String(v)) : [String(parsed)];
      return { optionIds: [], blanks, matches: {} };
    } catch {
      return {
        optionIds: [],
        blanks: data.answer ? data.answer.split("|") : [],
        matches: {},
      };
    }
  }
  try {
    return { optionIds: [], blanks: [], matches: JSON.parse(data.answer) as Record<string, string> };
  } catch {
    return { optionIds: [], blanks: [], matches: {} };
  }
}

export function encodeOfficialAnswer(
  kind: QuestionKind,
  optionIds: string[],
  blanks: string[],
  matches: Record<string, string>,
): string {
  if (isSinglePickQuestion(kind)) return optionIds[0] ?? "";
  if (kind === "multiple") return optionIds.join(",");
  if (kind === "fill") return JSON.stringify(blanks);
  return JSON.stringify(matches);
}

export function questionReferencesFile(data: QuestionData, fileName: string): boolean {
  const hay = JSON.stringify(data);
  return hay.includes(fileName);
}
