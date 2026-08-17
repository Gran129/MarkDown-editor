export type QuestionKind = "single" | "multiple" | "fill" | "match";

export interface QuestionOption {
  id: string;
  text: string;
}

export interface QuestionMatchItem {
  id: string;
  text: string;
}

export interface QuestionData {
  id: string;
  kind: QuestionKind;
  prompt: string;
  image: string | null;
  options: QuestionOption[];
  blanks: string[];
  left: QuestionMatchItem[];
  right: QuestionMatchItem[];
  /** Official key: single = option id; multiple = comma ids; fill = JSON string[]; match = JSON Record. */
  answer: string;
  explanation: string;
}

export const QUESTION_KIND_LABEL: Record<QuestionKind, string> = {
  single: "单选题",
  multiple: "多选题",
  fill: "填空题",
  match: "连线题",
};

export function generateQuestionId(): string {
  return `q_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

function letters(count: number): QuestionOption[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String.fromCharCode(97 + i),
    text: `选项 ${String.fromCharCode(65 + i)}`,
  }));
}

export function createQuestion(kind: QuestionKind): QuestionData {
  const id = generateQuestionId();
  if (kind === "fill") {
    return {
      id,
      kind,
      prompt: "请在空白处填入答案：___",
      image: null,
      options: [],
      blanks: [""],
      left: [],
      right: [],
      answer: "",
      explanation: "",
    };
  }
  if (kind === "match") {
    return {
      id,
      kind,
      prompt: "请将左侧与右侧正确配对。",
      image: null,
      options: [],
      blanks: [],
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
    };
  }
  return {
    id,
    kind,
    prompt: kind === "multiple" ? "请选择所有正确答案。" : "请选择正确答案。",
    image: null,
    options: letters(4),
    blanks: [],
    left: [],
    right: [],
    answer: "",
    explanation: "",
  };
}

export function parseQuestionPayload(raw: string): QuestionData | null {
  try {
    const parsed = JSON.parse(raw) as Partial<QuestionData>;
    if (!parsed || typeof parsed !== "object") return null;
    const kind = parsed.kind;
    if (kind !== "single" && kind !== "multiple" && kind !== "fill" && kind !== "match") {
      return null;
    }
    return {
      ...createQuestion(kind),
      ...parsed,
      kind,
      id: typeof parsed.id === "string" && parsed.id ? parsed.id : generateQuestionId(),
      prompt: typeof parsed.prompt === "string" ? parsed.prompt : "",
      image: typeof parsed.image === "string" && parsed.image ? parsed.image : null,
      options: Array.isArray(parsed.options) ? parsed.options : [],
      blanks: Array.isArray(parsed.blanks) ? parsed.blanks : [],
      left: Array.isArray(parsed.left) ? parsed.left : [],
      right: Array.isArray(parsed.right) ? parsed.right : [],
      answer: typeof parsed.answer === "string" ? parsed.answer : "",
      explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
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

export function serializeQuestionMarkdown(data: QuestionData): string {
  return `⟦question kind="${data.kind}" id="${data.id}"⟧\n${JSON.stringify(data)}\n⟦/question⟧`;
}

const QUESTION_START_RE = /^⟦question\s+kind="(single|multiple|fill|match)"\s+id="([^"]+)"⟧$/;
const QUESTION_END_RE = /^⟦\/question⟧$/;

export function preprocessQuestions(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const match = lines[i]!.match(QUESTION_START_RE);
    if (!match) {
      out.push(lines[i]!);
      i++;
      continue;
    }
    const kind = match[1] as QuestionKind;
    const id = match[2]!;
    const body: string[] = [];
    i++;
    while (i < lines.length && !QUESTION_END_RE.test(lines[i]!)) {
      body.push(lines[i]!);
      i++;
    }
    if (i < lines.length) i++;
    const parsed = parseQuestionPayload(body.join("\n")) ?? { ...createQuestion(kind), id };
    const payload = encodeQuestionPayload({ ...parsed, id, kind });
    out.push(
      `<div data-question="true" data-kind="${kind}" data-id="${id}" data-payload="${payload}" class="question-block"></div>`,
    );
  }
  return out.join("\n");
}

export function postprocessQuestions(md: string): string {
  return md.replace(
    /<div[^>]*data-question="true"[^>]*>[\s\S]*?<\/div>/gi,
    (full) => {
      const kind = (full.match(/data-kind="([^"]*)"/i)?.[1] ?? "single") as QuestionKind;
      const id = full.match(/data-id="([^"]*)"/i)?.[1] ?? generateQuestionId();
      const encoded = full.match(/data-payload="([^"]*)"/i)?.[1] ?? "";
      const data =
        decodeQuestionPayload(encoded) ??
        parseQuestionPayload(encoded) ?? { ...createQuestion(kind), id, kind };
      return serializeQuestionMarkdown({ ...data, id, kind });
    },
  );
}

export function gradeQuestion(
  data: QuestionData,
  attempt: { optionIds?: string[]; blanks?: string[]; matches?: Record<string, string> },
): boolean {
  if (!data.answer.trim()) return false;
  if (data.kind === "single") {
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
  if (data.kind === "single") {
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
  if (kind === "single") return optionIds[0] ?? "";
  if (kind === "multiple") return optionIds.join(",");
  if (kind === "fill") return JSON.stringify(blanks);
  return JSON.stringify(matches);
}
