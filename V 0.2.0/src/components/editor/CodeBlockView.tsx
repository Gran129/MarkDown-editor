import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

export const CODE_LANGUAGES: Array<{ id: string; label: string }> = [
  { id: "plaintext", label: "纯文本" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "rust", label: "Rust" },
  { id: "go", label: "Go" },
  { id: "java", label: "Java" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "csharp", label: "C#" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "json", label: "JSON" },
  { id: "yaml", label: "YAML" },
  { id: "xml", label: "XML" },
  { id: "markdown", label: "Markdown" },
  { id: "bash", label: "Bash" },
  { id: "sql", label: "SQL" },
  { id: "php", label: "PHP" },
  { id: "ruby", label: "Ruby" },
  { id: "swift", label: "Swift" },
  { id: "kotlin", label: "Kotlin" },
  { id: "mermaid", label: "Mermaid" },
];

export function CodeBlockView({ node, updateAttributes, editor }: NodeViewProps) {
  const language = (node.attrs.language as string | null) || "plaintext";
  const known = CODE_LANGUAGES.some((item) => item.id === language);
  const langClass =
    language && language !== "plaintext" ? `hljs language-${language}` : "hljs";

  return (
    <NodeViewWrapper className="code-block-node" data-language={language}>
      <div className="code-block-lang" contentEditable={false}>
        <select
          value={known ? language : language || "plaintext"}
          aria-label="代码语言"
          disabled={!editor.isEditable}
          onMouseDown={(event) => event.stopPropagation()}
          onChange={(event) => {
            const next = event.target.value;
            updateAttributes({ language: next === "plaintext" ? "plaintext" : next });
          }}
        >
          {!known && language ? (
            <option value={language}>{language}</option>
          ) : null}
          {CODE_LANGUAGES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <pre>
        <NodeViewContent as="code" className={langClass} />
      </pre>
    </NodeViewWrapper>
  );
}
