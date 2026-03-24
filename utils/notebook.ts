import type { JSONContent } from "@tiptap/core";
import type { BackupPolicy, FlowPage, FontChoice, LinedStyle, Notebook, NotebookSettings, SearchResult, Subject, SubjectPage } from "../types/notebook";

type PartialNotebook = Partial<Notebook>;
type PageDefaults = Pick<NotebookSettings,
  | "defaultFontFamily"
  | "defaultFontSize"
  | "defaultTextColor"
  | "defaultTextAlign"
  | "defaultPaperKind"
  | "defaultLineSpacing"
  | "defaultIndentLevel"
  | "defaultLinedStyle"
>;

const defaultLinedStyle: LinedStyle = {
  background: "#FFFFFF",
  lineColor: "#4DADF9",
  marginColor: "#F56465",
};

const fontOptions: FontChoice[] = [
  { label: "Segoe UI", value: "Segoe UI" },
  { label: "Arial", value: "Arial" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Comic Sams", value: "Comic Sans MS" },
  { label: "Georgia", value: "Georgia" },
  { label: "Helvetica", value: "Helvetica" },
  { label: "Verdana", value: "Verdana" },
  { label: "Courier New", value: "Courier New" },
  { label: "Trebuchet MS", value: "Trebuchet MS" },
];

export const createId = () => Math.random().toString(36).slice(2, 11);

export const makePage = (
  title = "Pagina 1",
  topicLabel = "Assunto",
  topicStart = true,
  defaults?: PageDefaults,
): SubjectPage => ({
  id: createId(),
  title,
  topicLabel,
  topicStart,
  kind: defaults?.defaultPaperKind || "lined",
  contentHtml: "",
  contentText: "",
  contentJson: { type: "doc", content: [{ type: "paragraph" }] },
  fontFamily: defaults?.defaultFontFamily || "Segoe UI",
  fontSize: defaults?.defaultFontSize || "20px",
  textColor: defaults?.defaultTextColor || "#1f2937",
  textAlign: defaults?.defaultTextAlign || "left",
  lineSpacing: defaults?.defaultLineSpacing || 1,
  indentLevel: defaults?.defaultIndentLevel || 0,
  linedStyle: { ...(defaults?.defaultLinedStyle || defaultLinedStyle) },
});

export const createSubject = (
  name: string,
  color: string,
  settings: Pick<NotebookSettings, "defaultFontFamily" | "defaultFontSize" | "defaultTextColor" | "defaultTextAlign" | "defaultPaperKind" | "defaultLineSpacing" | "defaultIndentLevel" | "defaultLinedStyle"> = {
    defaultFontFamily: "Segoe UI",
    defaultFontSize: "20px",
    defaultTextColor: "#1f2937",
    defaultTextAlign: "left",
    defaultPaperKind: "lined",
    defaultLineSpacing: 1,
    defaultIndentLevel: 0,
    defaultLinedStyle: { ...defaultLinedStyle },
  },
): Subject => ({
  id: createId(),
  name,
  color,
  description: "",
  topic: "",
  professor: "",
  period: "",
  observations: "",
  objectives: "",
  pages: [makePage("Pagina 1", "Assunto", true, settings)],
});

const templateNotebook: Notebook = {
  title: "Meu Caderno",
  coverImage: "",
  soundEnabled: true,
  subjects: [createSubject("Matematica", "#3b82f6")],
  security: { enabled: false, salt: "", hash: "" },
  settings: {
    showToolbar: true,
    showRulers: true,
    deletedSubjectBackupPolicy: "10",
    defaultFontFamily: "Segoe UI",
    defaultFontSize: "20px",
    defaultTextColor: "#1f2937",
    defaultTextAlign: "left",
    defaultPaperKind: "lined",
    defaultLineSpacing: 1,
    defaultIndentLevel: 0,
    defaultLinedStyle: { ...defaultLinedStyle },
  },
};

export function stripHtml(raw: string): string {
  return raw.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeNotebook(raw: Partial<Notebook>): Notebook {
  const normalizedSettings: NotebookSettings = {
    ...templateNotebook.settings,
    ...(raw.settings || {}),
    defaultLinedStyle: { ...templateNotebook.settings.defaultLinedStyle, ...(raw.settings?.defaultLinedStyle || {}) },
  };
  const inputSubjects = Array.isArray(raw.subjects) ? raw.subjects : templateNotebook.subjects;
  const subjects = inputSubjects.map((item, index) => {
    const seed = createSubject(item?.name || `Materia ${index + 1}`, item?.color || "#3b82f6", normalizedSettings);
    const pagesInput = Array.isArray(item?.pages) && item.pages.length > 0 ? item.pages : seed.pages;
    return {
      ...seed,
      ...item,
      pages: pagesInput.map((page, pageIndex) => {
        const fallbackHtml = typeof page?.contentHtml === "string" ? page.contentHtml : "";
        return {
          ...makePage(page?.title || `Pagina ${pageIndex + 1}`, undefined, undefined, normalizedSettings),
          ...page,
          topicLabel: typeof page?.topicLabel === "string" && page.topicLabel.trim() ? page.topicLabel : pageIndex === 0 ? item?.topic || "Assunto" : pagesInput[Math.max(0, pageIndex - 1)]?.topicLabel || item?.topic || "Assunto",
          topicStart: typeof page?.topicStart === "boolean" ? page.topicStart : pageIndex === 0,
          contentHtml: fallbackHtml,
          contentText: typeof page?.contentText === "string" ? page.contentText : stripHtml(fallbackHtml),
          contentJson: page?.contentJson && typeof page.contentJson === "object" ? page.contentJson : null,
          fontSize: typeof page?.fontSize === "string" ? page.fontSize : normalizedSettings.defaultFontSize,
          lineSpacing: typeof page?.lineSpacing === "number" ? page.lineSpacing : normalizedSettings.defaultLineSpacing,
          indentLevel: typeof page?.indentLevel === "number" ? page.indentLevel : normalizedSettings.defaultIndentLevel,
          linedStyle: { ...defaultLinedStyle, ...(page?.linedStyle || {}) },
        };
      }),
    };
  });
  return {
    ...templateNotebook,
    ...raw,
    subjects,
    security: { ...templateNotebook.security, ...(raw.security || {}) },
    settings: normalizedSettings,
  };
}

export function extractPreview(text: string, query: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const index = normalized.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) {
    return normalized.slice(0, 100);
  }
  return normalized.slice(Math.max(0, index - 45), Math.min(normalized.length, index + query.length + 45));
}

export function searchNotebook(notebook: Notebook, flow: FlowPage[], rawQuery: string): SearchResult[] {
  const query = rawQuery.trim();
  if (!query) {
    return [];
  }
  const exact = query.startsWith('"') && query.endsWith('"') && query.length > 1;
  const cleaned = exact ? query.slice(1, -1).trim() : query;
  if (!cleaned) {
    return [];
  }
  const terms = exact ? [cleaned.toLowerCase()] : cleaned.toLowerCase().split(/\s+/).filter(Boolean);
  const results: SearchResult[] = [];

  for (const subject of notebook.subjects) {
    const frontText = [subject.name, subject.description, subject.topic, subject.professor, subject.period, subject.observations, subject.objectives].join(" ").toLowerCase();
    const frontMatch = exact ? frontText.includes(terms[0]) : terms.every((term) => frontText.includes(term));
    if (frontMatch) {
      results.push({ id: createId(), flowKey: `subject-front-${subject.id}`, subjectName: subject.name, section: "Abertura da materia", preview: extractPreview(frontText, terms[0]) });
    }
    subject.pages.forEach((page) => {
      const content = `${page.title} ${page.contentText || stripHtml(page.contentHtml)}`.toLowerCase();
      const match = exact ? content.includes(terms[0]) : terms.every((term) => content.includes(term));
      if (match) {
        results.push({ id: createId(), flowKey: `subject-page-${subject.id}-${page.id}`, subjectName: subject.name, section: page.title, preview: extractPreview(content, terms[0]) });
      }
    });
  }

  return results.filter((entry) => flow.some((item) => item.key === entry.flowKey));
}

export function buildNotebookHtml(notebook: Notebook): string {
  const subjects = notebook.subjects
    .map(
      (subject) => `
      <section style="page-break-after: always; margin-bottom: 28px;">
        <h2 style="color:${subject.color}; margin-bottom: 6px;">${subject.name}</h2>
        <p>${subject.description || ""}</p>
        <p><strong>Assunto:</strong> ${subject.topic || ""}</p>
        ${subject.pages
          .map(
            (page) => `
            <article style="margin: 24px 0; border-top: 1px solid #ddd; padding-top: 12px;">
              <h3>${page.title}</h3>
              ${page.contentHtml || "<p></p>"}
            </article>`,
          )
          .join("")}
      </section>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="UTF-8" /><title>${notebook.title}</title></head><body><h1>${notebook.title}</h1>${subjects}</body></html>`;
}

export function retentionDaysFromPolicy(policy: BackupPolicy): number | null {
  if (policy === "none") {
    return 0;
  }
  if (policy === "forever") {
    return null;
  }
  return Number(policy);
}
