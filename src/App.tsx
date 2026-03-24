import { AnimatePresence, motion } from "framer-motion";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronLeft,
  ChevronRight,
  Download,
  FileInput,
  FileOutput,
  ImagePlus,
  Indent,
  Italic,
  List,
  ListOrdered,
  Menu,
  Palette,
  Printer,
  Redo2,
  Subscript,
  Superscript,
  Table2,
  Trash2,
  Underline,
  Undo2,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent, useEffect, useMemo, useRef, useState } from "react";
import { Extension, Mark, mergeAttributes, type JSONContent } from "@tiptap/core";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import SubscriptExtension from "@tiptap/extension-subscript";
import SuperscriptExtension from "@tiptap/extension-superscript";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import UnderlineExtension from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from "@tiptap/react";

type TextAlignMode = "left" | "center" | "right" | "justify";
type PageKind = "blank" | "lined";
type BackupPolicy = "none" | "10" | "20" | "30" | "forever";

type LinedStyle = {
  background: string;
  lineColor: string;
  marginColor: string;
};

type SubjectPage = {
  id: string;
  title: string;
  topicLabel: string;
  topicStart: boolean;
  kind: PageKind;
  contentHtml: string;
  contentText: string;
  contentJson: JSONContent | null;
  fontFamily: string;
  fontSize: string;
  textColor: string;
  textAlign: TextAlignMode;
  lineSpacing: number;
  indentLevel: number;
  linedStyle: LinedStyle;
};

type Subject = {
  id: string;
  name: string;
  color: string;
  description: string;
  topic: string;
  professor: string;
  period: string;
  observations: string;
  objectives: string;
  pages: SubjectPage[];
};

type SecuritySettings = {
  enabled: boolean;
  salt: string;
  hash: string;
};

type NotebookSettings = {
  showToolbar: boolean;
  showRulers: boolean;
  deletedSubjectBackupPolicy: BackupPolicy;
  defaultFontFamily: string;
  defaultFontSize: string;
  defaultTextColor: string;
  defaultTextAlign: TextAlignMode;
  defaultPaperKind: PageKind;
  defaultLineSpacing: number;
  defaultIndentLevel: number;
  defaultLinedStyle: LinedStyle;
};

type Notebook = {
  title: string;
  coverImage: string;
  soundEnabled: boolean;
  subjects: Subject[];
  security: SecuritySettings;
  settings: NotebookSettings;
};

type BackupPayload = {
  version: 1;
  protected: boolean;
  salt: string;
  iv: string;
  data: string;
};

type FlowPage =
  | { key: string; kind: "cover" }
  | { key: string; kind: "index" }
  | { key: string; kind: "subjectFront"; subjectId: string }
  | { key: string; kind: "subjectPage"; subjectId: string; pageId: string };

type SearchResult = {
  id: string;
  flowKey: string;
  subjectName: string;
  section: string;
  preview: string;
};

type DeletedSubjectBackup = {
  id: string;
  subjectName: string;
  deletedAt: string;
  expiresAt: number | null;
  pageCount: number;
};

type FontChoice = {
  label: string;
  value: string;
};

type PageDefaults = Pick<NotebookSettings, "defaultFontFamily" | "defaultFontSize" | "defaultTextColor" | "defaultTextAlign" | "defaultPaperKind" | "defaultLineSpacing" | "defaultIndentLevel" | "defaultLinedStyle">;

type EditorPayload = {
  html: string;
  text: string;
  json: JSONContent;
};
type EditorContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
  tableContext: boolean;
};

type EditorBridge = {
  applyStylePatch: (patch: Partial<SubjectPage>) => void;
};

const highlightPresetColors = [
  { label: "Amarelo limao", value: "#fef08a" },
  { label: "Verde limao", value: "#bef264" },
  { label: "Azul claro", value: "#bae6fd" },
] as const;

const specialCharacters = ["§", "º", "ª", "°", "•", "✓", "→", "←", "—", "–", "©", "®", "Ω", "π", "±", "½"];


declare global {
  interface Window {
    portableNotebook?: {
      loadData: () => Promise<string | null>;
      saveData: (raw: string) => Promise<boolean>;
      saveAsData: (raw: string) => Promise<string | null>;
      openExternalData: () => Promise<string | null>;
      exportHtml: (payload: { title: string; html: string }) => Promise<string | null>;
      archiveDeletedSubject: (payload: { notebookTitle: string; subject: Subject; retentionDays: number | null }) => Promise<string | null>;
      listDeletedSubjects: () => Promise<DeletedSubjectBackup[]>;
      restoreDeletedSubject: (id: string) => Promise<Subject | null>;
      deleteDeletedSubjectBackup: (id: string) => Promise<boolean>;
    };
  }
}

const STORAGE_KEY = "portable-notebook-web-fallback";
const BACKUP_APP_SECRET = "caderno-portatil-app-secret-v1";

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

const createId = () => Math.random().toString(36).slice(2, 11);

const makePage = (
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

const createSubject = (
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

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: { fontSize?: string }) => {
              if (!attributes.fontSize) {
                return {};
              }
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

const BlockStyle = Extension.create({
  name: "blockStyle",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            renderHTML: (attributes: { indent?: number; lineSpacing?: number }) => {
              const styles: string[] = [];
              if (attributes.indent && attributes.indent > 0) {
                styles.push(`margin-left: ${attributes.indent * 28}px`);
              }
              if (attributes.lineSpacing && attributes.lineSpacing > 0) {
                styles.push(`line-height: ${attributes.lineSpacing}`);
              }
              return styles.length ? { style: styles.join("; ") } : {};
            },
          },
          lineSpacing: {
            default: 1,
          },
        },
      },
    ];
  },
});

const DoubleStrike = Mark.create({
  name: "doubleStrike",
  parseHTML() {
    return [{ tag: "span[data-double-strike]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-double-strike": "true",
        style: "text-decoration-line: line-through; text-decoration-style: double;",
      }),
      0,
    ];
  },
  addCommands() {
    return {
      setDoubleStrike:
        () =>
        ({ commands }: { commands: { setMark: (name: string) => boolean } }) =>
          commands.setMark(this.name),
      toggleDoubleStrike:
        () =>
        ({ commands }: { commands: { toggleMark: (name: string) => boolean } }) =>
          commands.toggleMark(this.name),
      unsetDoubleStrike:
        () =>
        ({ commands }: { commands: { unsetMark: (name: string) => boolean } }) =>
          commands.unsetMark(this.name),
    } as Record<string, () => (props: unknown) => boolean>;
  },
});

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 320,
        parseHTML: (element: HTMLElement) => Number(element.getAttribute("width") || element.style.width.replace("px", "")) || 320,
        renderHTML: (attributes: { width?: number }) => ({ width: attributes.width || 320 }),
      },
      height: {
        default: null,
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNodeView);
  },
});

function ResizableImageNodeView(props: NodeViewProps) {
  const { node, updateAttributes, selected } = props;
  const baseWidth = Number(node.attrs.width || 320);
  const baseHeight = node.attrs.height ? Number(node.attrs.height) : null;

  const startResize = (event: ReactMouseEvent<HTMLButtonElement>, mode: "right" | "bottom" | "corner") => {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = Number(node.attrs.width || 320);
    const startHeight = Number(node.attrs.height || 220);
    const onMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const width = mode === "bottom" ? startWidth : Math.max(120, startWidth + deltaX);
      const height = mode === "right" ? startHeight : Math.max(80, startHeight + deltaY);
      updateAttributes({ width, height: mode === "right" ? null : height });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <NodeViewWrapper className="resizable-image-wrapper">
      <div className={`resizable-image ${selected ? "selected" : ""}`}>
        <img src={node.attrs.src} alt={node.attrs.alt || "Imagem"} style={{ width: `${baseWidth}px`, height: baseHeight ? `${baseHeight}px` : "auto" }} />
        <button type="button" className="resize-handle right" onMouseDown={(event) => startResize(event, "right")} />
        <button type="button" className="resize-handle bottom" onMouseDown={(event) => startResize(event, "bottom")} />
        <button type="button" className="resize-handle corner" onMouseDown={(event) => startResize(event, "corner")} />
      </div>
    </NodeViewWrapper>
  );
}

function stripHtml(raw: string): string {
  return raw.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

async function deriveAesKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveBits", "deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: 120000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

async function hashPassword(password: string, saltBase64?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltBase64 ? base64ToBytes(saltBase64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveAesKey(password, salt);
  const raw = await crypto.subtle.exportKey("raw", key);
  return { hash: bytesToBase64(new Uint8Array(raw)), salt: bytesToBase64(salt) };
}

async function encryptBackup(payload: Notebook, passphrase: string): Promise<BackupPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, encoded);
  return {
    version: 1,
    protected: passphrase !== BACKUP_APP_SECRET,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
  };
}

async function decryptBackup(data: BackupPayload, passphrase: string): Promise<Notebook> {
  const key = await deriveAesKey(passphrase, base64ToBytes(data.salt));
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(base64ToBytes(data.iv)) }, key, toArrayBuffer(base64ToBytes(data.data)));
  return normalizeNotebook(JSON.parse(new TextDecoder().decode(decrypted)) as Partial<Notebook>);
}

function normalizeNotebook(raw: Partial<Notebook>): Notebook {
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

function extractPreview(text: string, query: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const index = normalized.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) {
    return normalized.slice(0, 100);
  }
  return normalized.slice(Math.max(0, index - 45), Math.min(normalized.length, index + query.length + 45));
}

function searchNotebook(notebook: Notebook, flow: FlowPage[], rawQuery: string): SearchResult[] {
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

function buildNotebookHtml(notebook: Notebook): string {
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

function retentionDaysFromPolicy(policy: BackupPolicy): number | null {
  if (policy === "none") {
    return 0;
  }
  if (policy === "forever") {
    return null;
  }
  return Number(policy);
}

function NotebookEditor({
  page,
  showToolbar,
  onChange,
  onPageFormatChange,
  bridgeRef,
}: {
  page: SubjectPage;
  showToolbar: boolean;
  onChange: (payload: EditorPayload) => void;
  onPageFormatChange: (patch: Partial<SubjectPage>) => void;
  bridgeRef?: React.RefObject<EditorBridge | null>;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const highlightInputRef = useRef<HTMLInputElement | null>(null);
  const [tableOpen, setTableOpen] = useState(false);
  const [highlightColor, setHighlightColor] = useState("#fef08a");
  const [specialCharsOpen, setSpecialCharsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<EditorContextMenuState>({ visible: false, x: 0, y: 0, tableContext: false });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      BulletList,
      OrderedList,
      ListItem,
      UnderlineExtension,
      SubscriptExtension,
      SuperscriptExtension,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      DoubleStrike,
      BlockStyle,
      ResizableImage.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: page.contentJson || page.contentHtml || "<p></p>",
    editorProps: {
      attributes: {
        class: "editor-body",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange({ html: currentEditor.getHTML(), text: currentEditor.getText(), json: currentEditor.getJSON() });
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor
      .chain()
      .focus()
      .setTextAlign(page.textAlign)
      .setColor(page.textColor)
      .setFontFamily(page.fontFamily)
      .setMark("textStyle", { fontSize: page.fontSize })
      .updateAttributes("paragraph", { lineSpacing: page.lineSpacing, indent: page.indentLevel })
      .updateAttributes("heading", { lineSpacing: page.lineSpacing, indent: page.indentLevel })
      .run();
  }, [editor, page.textAlign, page.textColor, page.fontFamily, page.fontSize, page.lineSpacing, page.indentLevel]);

  useEffect(() => {
    if (!bridgeRef) {
      return;
    }
    bridgeRef.current = {
      applyStylePatch: (patch) => {
        if (!editor) {
          return;
        }
        const chain = editor.chain().focus();
        if (patch.fontFamily) {
          chain.setFontFamily(patch.fontFamily);
        }
        if (patch.fontSize) {
          chain.setMark("textStyle", { fontSize: patch.fontSize });
        }
        if (patch.textColor) {
          chain.setColor(patch.textColor);
        }
        if (patch.textAlign) {
          chain.setTextAlign(patch.textAlign);
        }
        chain.run();
      },
    };
    return () => {
      bridgeRef.current = null;
    };
  }, [bridgeRef, editor]);

  useEffect(() => {
    const closeMenus = () => {
      setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      setTableOpen(false);
      setSpecialCharsOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".special-char-wrap, .table-wrap, .editor-context-menu")) {
        return;
      }
      closeMenus();
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", closeMenus, true);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", closeMenus, true);
    };
  }, []);

  const runEditorAction = (callback: () => void) => (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    callback();
  };

  const applyHighlightColor = (color: string) => {
    setHighlightColor(color);
    editor?.chain().focus().setHighlight({ color }).run();
  };

  const insertSpecialCharacter = (char: string) => {
    editor?.chain().focus().insertContent(char).run();
    setSpecialCharsOpen(false);
  };

  const openEditorContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setTableOpen(false);
    setSpecialCharsOpen(false);
    const target = event.target as HTMLElement | null;
    setContextMenu({ visible: true, x: event.clientX, y: event.clientY, tableContext: Boolean(target?.closest("table")) || editor?.isActive("table") || false });
  };

  const runContextCommand = async (command: string) => {
    if (!editor) return;
    try {
      if (command === "copy") {
        const selected = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, "\n");
        if (selected) await navigator.clipboard.writeText(selected);
      } else if (command === "cut") {
        const selected = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, "\n");
        if (selected) {
          await navigator.clipboard.writeText(selected);
          editor.chain().focus().deleteSelection().run();
        }
      } else if (command === "paste") {
        const text = await navigator.clipboard.readText();
        if (text) editor.chain().focus().insertContent(text).run();
      } else if (command === "pastePlain") {
        const text = await navigator.clipboard.readText();
        if (text) editor.chain().focus().insertContent(text).run();
      } else if (command === "pasteRich") {
        const text = await navigator.clipboard.readText();
        if (text) editor.chain().focus().insertContent(text).run();
      } else if (command === "selectAll") {
        editor.chain().focus().selectAll().run();
      } else if (command === "undo") {
        editor.chain().focus().undo().run();
      } else if (command === "redo") {
        editor.chain().focus().redo().run();
      } else if (command === "addRow") {
        editor.chain().focus().addRowAfter().run();
      } else if (command === "deleteRow") {
        editor.chain().focus().deleteRow().run();
      } else if (command === "addColumn") {
        editor.chain().focus().addColumnAfter().run();
      } else if (command === "deleteColumn") {
        editor.chain().focus().deleteColumn().run();
      } else if (command === "toggleHeader") {
        editor.chain().focus().toggleHeaderCell().run();
      }
    } catch {}
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const setLineSpacing = (lineSpacing: number) => {
    if (!editor) {
      return;
    }
    const nodes = ["paragraph", "heading"] as const;
    nodes.forEach((name) => {
      editor.chain().focus().updateAttributes(name, { lineSpacing }).run();
    });
    onPageFormatChange({ lineSpacing });
  };

  const applyIndent = (delta: number) => {
    if (!editor) {
      return;
    }
    const currentParagraphIndent = Number(editor.getAttributes("paragraph").indent || 0);
    const nextIndent = Math.max(0, Math.min(7, currentParagraphIndent + delta));
    editor.chain().focus().updateAttributes("paragraph", { indent: nextIndent }).run();
    editor.chain().focus().updateAttributes("heading", { indent: nextIndent }).run();
    onPageFormatChange({ indentLevel: nextIndent });
  };

  const insertImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editor) {
      return;
    }
    const accepted = ["image/jpeg", "image/jpg", "image/bmp", "image/png", "image/gif"];
    if (!accepted.includes(file.type)) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      editor.chain().focus().setImage({ src: String(reader.result || ""), alt: file.name, width: 320 }).run();
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  if (!editor) {
    return <div className="editor-loading">Carregando editor...</div>;
  }

  return (
    <div data-no-page-turn="true" className="editor-shell">
      {showToolbar && (
        <div className="toolbar">
          <button type="button" onMouseDown={runEditorAction(() => editor.chain().focus().toggleBold().run())} title="Negrito"><Bold size={15} /></button>
          <button type="button" onMouseDown={runEditorAction(() => editor.chain().focus().toggleItalic().run())} title="Italico"><Italic size={15} /></button>
          <button type="button" onMouseDown={runEditorAction(() => editor.chain().focus().toggleUnderline().run())} title="Sublinhado"><Underline size={15} /></button>
          <button type="button" onMouseDown={runEditorAction(() => editor.chain().focus().toggleStrike().run())} title="Tachado"><span className="strike-a">A</span></button>
          <button type="button" onMouseDown={runEditorAction(() => editor.chain().focus().toggleMark("doubleStrike").run())} title="Tachado duplo"><span className="double-strike-a">A</span></button>
          <button type="button" onMouseDown={runEditorAction(() => editor.chain().focus().toggleSubscript().run())} title="Subscrito"><Subscript size={15} /></button>
          <button type="button" onMouseDown={runEditorAction(() => editor.chain().focus().toggleSuperscript().run())} title="Sobrescrito"><Superscript size={15} /></button>

          <span className="tool-divider" />

          <button type="button" onMouseDown={runEditorAction(() => editor.chain().focus().setTextAlign("left").run())} title="Alinhar esquerda"><AlignLeft size={15} /></button>
          <button type="button" onMouseDown={runEditorAction(() => editor.chain().focus().setTextAlign("center").run())} title="Alinhar centro"><AlignCenter size={15} /></button>
          <button type="button" onMouseDown={runEditorAction(() => editor.chain().focus().setTextAlign("right").run())} title="Alinhar direita"><AlignRight size={15} /></button>
          <button type="button" onMouseDown={runEditorAction(() => editor.chain().focus().setTextAlign("justify").run())} title="Justificar"><AlignJustify size={15} /></button>
          <button type="button" onMouseDown={runEditorAction(() => editor.chain().focus().toggleBulletList().run())} title="Lista nao ordenada"><List size={15} /></button>
          <button type="button" onMouseDown={runEditorAction(() => editor.chain().focus().toggleOrderedList().run())} title="Lista ordenada"><ListOrdered size={15} /></button>
          <button type="button" onMouseDown={runEditorAction(() => applyIndent(1))} title="Aumentar recuo"><Indent size={15} /></button>
          <button type="button" onMouseDown={runEditorAction(() => applyIndent(-1))} title="Diminuir recuo"><Indent size={15} className="indent-flip" /></button>

          <select className="tool-select" value={String(page.lineSpacing)} onChange={(event) => setLineSpacing(Number(event.target.value))}>
            <option value="1">Esp. 1.0</option>
            <option value="1.5">Esp. 1.5</option>
            <option value="2">Esp. 2.0</option>
          </select>

          <div className="color-menu-wrap" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="highlight-tool" onMouseDown={runEditorAction(() => highlightInputRef.current?.click())} title="Marca-texto">
              <span className="marker-icon" />
            </button>
            <input
              ref={highlightInputRef}
              className="hidden"
              type="color"
              value={highlightColor}
              onChange={(event) => {
                applyHighlightColor(event.target.value);
              }}
            />
            <div className="highlight-presets">
              {highlightPresetColors.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`highlight-swatch ${highlightColor === preset.value ? "active" : ""}`}
                  style={{ background: preset.value }}
                  title={preset.label}
                  onMouseDown={runEditorAction(() => applyHighlightColor(preset.value))}
                />
              ))}
            </div>
          </div>

          <div className="special-char-wrap" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setSpecialCharsOpen((prev) => !prev); setTableOpen(false); }} title="Caractere especial">Ω</button>
            {specialCharsOpen && (
              <div className="special-char-panel" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                {specialCharacters.map((char) => (
                  <button key={char} type="button" onMouseDown={runEditorAction(() => insertSpecialCharacter(char))} title={`Inserir ${char}`}>{char}</button>
                ))}
              </div>
            )}
          </div>

          <button type="button" onMouseDown={runEditorAction(() => fileInputRef.current?.click())} title="Inserir imagem"><ImagePlus size={15} /></button>
          <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.bmp,.png,.gif,image/*" onChange={insertImage} className="hidden" />

          <div className="table-wrap" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setTableOpen((prev) => !prev); setSpecialCharsOpen(false); }} title="Inserir tabela"><Table2 size={15} /></button>
            {tableOpen && (
              <div className="table-grid-picker" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                {Array.from({ length: 64 }).map((_, index) => {
                  const row = Math.floor(index / 8) + 1;
                  const col = (index % 8) + 1;
                  return (
                    <button
                      type="button"
                      key={`${row}-${col}`}
                      className="table-cell-picker"
                      onMouseDown={runEditorAction(() => {
                        editor.chain().focus().insertTable({ rows: row, cols: col, withHeaderRow: true }).run();
                        setTableOpen(false);
                      })}
                      title={`${row} x ${col}`}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <button type="button" onMouseDown={runEditorAction(() => editor.chain().focus().addRowAfter().run())} title="Inserir linha"><span>+L</span></button>
          <button type="button" onMouseDown={runEditorAction(() => editor.chain().focus().deleteRow().run())} title="Excluir linha"><span>-L</span></button>
          <button type="button" onMouseDown={runEditorAction(() => editor.chain().focus().addColumnAfter().run())} title="Inserir coluna"><span>+C</span></button>
          <button type="button" onMouseDown={runEditorAction(() => editor.chain().focus().deleteColumn().run())} title="Excluir coluna"><span>-C</span></button>
          <button type="button" onMouseDown={runEditorAction(() => editor.chain().focus().toggleHeaderCell().run())} title="Alternar borda/header"><span>Bd</span></button>

          <button type="button" onMouseDown={runEditorAction(() => editor.chain().focus().undo().run())} title="Desfazer"><Undo2 size={15} /></button>
          <button type="button" onMouseDown={runEditorAction(() => editor.chain().focus().redo().run())} title="Refazer"><Redo2 size={15} /></button>
        </div>
      )}

      <div className="editor-content-wrap" onContextMenu={openEditorContextMenu}>
        <EditorContent editor={editor} />
      </div>
      {contextMenu.visible && (
        <div className="editor-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} data-no-page-turn="true">
          <button type="button" onMouseDown={runEditorAction(() => { void runContextCommand("copy"); })}>Copiar</button>
          <button type="button" onMouseDown={runEditorAction(() => { void runContextCommand("cut"); })}>Recortar</button>
          <button type="button" onMouseDown={runEditorAction(() => { void runContextCommand("pasteRich"); })}>Colar com formatacao</button>
          <button type="button" onMouseDown={runEditorAction(() => { void runContextCommand("pastePlain"); })}>Colar sem formatacao</button>
          <button type="button" onMouseDown={runEditorAction(() => { void runContextCommand("selectAll"); })}>Selecionar tudo</button>
          <button type="button" onMouseDown={runEditorAction(() => { void runContextCommand("undo"); })}>Desfazer</button>
          <button type="button" onMouseDown={runEditorAction(() => { void runContextCommand("redo"); })}>Refazer</button>
          {contextMenu.tableContext && (
            <>
              <span className="context-divider" />
              <button type="button" onMouseDown={runEditorAction(() => { void runContextCommand("addRow"); })}>Inserir linha</button>
              <button type="button" onMouseDown={runEditorAction(() => { void runContextCommand("deleteRow"); })}>Excluir linha</button>
              <button type="button" onMouseDown={runEditorAction(() => { void runContextCommand("addColumn"); })}>Inserir coluna</button>
              <button type="button" onMouseDown={runEditorAction(() => { void runContextCommand("deleteColumn"); })}>Excluir coluna</button>
              <button type="button" onMouseDown={runEditorAction(() => { void runContextCommand("toggleHeader"); })}>Alternar cabecalho</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [notebook, setNotebook] = useState<Notebook>(templateNotebook);
  const [activeIndex, setActiveIndex] = useState(0);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectColor, setNewSubjectColor] = useState("#6366f1");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [dragSubjectId, setDragSubjectId] = useState<string | null>(null);
  const [status, setStatus] = useState("Pronto.");
  const [isHydrated, setIsHydrated] = useState(false);
  const [locked, setLocked] = useState(false);
  const [unlockPass, setUnlockPass] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [backupPass, setBackupPass] = useState("");
  const [restorePass, setRestorePass] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingFlowKey, setPendingFlowKey] = useState<string | null>(null);
  const [pageJumpInput, setPageJumpInput] = useState("1");
  const [paperTypeMenuOpen, setPaperTypeMenuOpen] = useState(false);
  const [deletedBackups, setDeletedBackups] = useState<DeletedSubjectBackup[]>([]);
  const [coverContextMenu, setCoverContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [pageZoom, setPageZoom] = useState(1);
  const [appZoom, setAppZoom] = useState(1);
  const [rulerDrag, setRulerDrag] = useState<"indent" | "lineSpacing" | null>(null);

  const backupFileRef = useRef<HTMLInputElement | null>(null);
  const coverFileRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const editorBridgeRef = useRef<EditorBridge | null>(null);
  const hamburgerRef = useRef<HTMLDivElement | null>(null);
  const horizontalRulerRef = useRef<HTMLDivElement | null>(null);
  const verticalRulerRef = useRef<HTMLDivElement | null>(null);

  const flow = useMemo<FlowPage[]>(() => {
    const entries: FlowPage[] = [{ key: "cover", kind: "cover" }, { key: "index", kind: "index" }];
    notebook.subjects.forEach((subject) => {
      entries.push({ key: `subject-front-${subject.id}`, kind: "subjectFront", subjectId: subject.id });
      subject.pages.forEach((page) => {
        entries.push({ key: `subject-page-${subject.id}-${page.id}`, kind: "subjectPage", subjectId: subject.id, pageId: page.id });
      });
    });
    return entries;
  }, [notebook.subjects]);

  const activePage = flow[activeIndex] ?? flow[0];
  const currentSubject = activePage && "subjectId" in activePage ? notebook.subjects.find((subject) => subject.id === activePage.subjectId) || null : null;
  const currentNotebookPage = activePage?.kind === "subjectPage" && currentSubject ? currentSubject.pages.find((page) => page.id === activePage.pageId) || null : null;
  const currentPageIndex = currentSubject && currentNotebookPage ? currentSubject.pages.findIndex((page) => page.id === currentNotebookPage.id) : -1;

  const loadStoredNotebook = async (): Promise<string | null> => {
    if (window.portableNotebook?.loadData) {
      return window.portableNotebook.loadData();
    }
    return localStorage.getItem(STORAGE_KEY);
  };

  const saveStoredNotebook = async (raw: string): Promise<void> => {
    if (window.portableNotebook?.saveData) {
      await window.portableNotebook.saveData(raw);
      return;
    }
    localStorage.setItem(STORAGE_KEY, raw);
  };

  const refreshDeletedBackups = async () => {
    if (!window.portableNotebook?.listDeletedSubjects) {
      return;
    }
    const list = await window.portableNotebook.listDeletedSubjects();
    setDeletedBackups(list);
  };

  useEffect(() => {
    loadStoredNotebook()
      .then((raw) => {
        if (!raw) {
          return;
        }
        const loaded = normalizeNotebook(JSON.parse(raw) as Partial<Notebook>);
        setNotebook(loaded);
        if (loaded.security.enabled) {
          setLocked(true);
        }
      })
      .catch(() => setStatus("Falha ao carregar os dados."))
      .finally(() => {
        setIsHydrated(true);
        refreshDeletedBackups().catch(() => undefined);
      });
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    const timeout = window.setTimeout(() => {
      saveStoredNotebook(JSON.stringify(notebook)).catch(() => setStatus("Falha ao salvar dados."));
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [isHydrated, notebook]);

  useEffect(() => {
    setResults(searchNotebook(notebook, flow, search));
  }, [search, notebook, flow]);

  useEffect(() => {
    if (!flow[activeIndex]) {
      setActiveIndex(Math.max(0, flow.length - 1));
    }
  }, [flow, activeIndex]);

  useEffect(() => {
    if (!pendingFlowKey) {
      return;
    }
    const targetIndex = flow.findIndex((entry) => entry.key === pendingFlowKey);
    if (targetIndex >= 0) {
      setActiveIndex(targetIndex);
      setPendingFlowKey(null);
    }
  }, [pendingFlowKey, flow]);

  useEffect(() => {
    setPageJumpInput(String(activeIndex + 1));
  }, [activeIndex]);

  useEffect(() => {
    const closeContext = () => setCoverContextMenu(null);
    window.addEventListener("click", closeContext);
    return () => window.removeEventListener("click", closeContext);
  }, []);

  useEffect(() => {
    const onWindowMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (hamburgerRef.current?.contains(target || null)) {
        return;
      }
      setMenuOpen(false);
    };
    window.addEventListener("mousedown", onWindowMouseDown);
    return () => window.removeEventListener("mousedown", onWindowMouseDown);
  }, []);

  const playPageSound = () => {
    if (!notebook.soundEnabled) {
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new AudioContext();
    }
    const ctx = audioRef.current;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(420, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(130, ctx.currentTime + 0.22);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.25);
  };

  const goToIndex = (index: number) => {
    const bounded = Math.max(0, Math.min(index, flow.length - 1));
    if (bounded !== activeIndex) {
      setActiveIndex(bounded);
      playPageSound();
    }
  };

  const updateSubject = (subjectId: string, patch: Partial<Subject>) => {
    setNotebook((prev) => ({ ...prev, subjects: prev.subjects.map((subject) => (subject.id === subjectId ? { ...subject, ...patch } : subject)) }));
  };

  const updatePage = (subjectId: string, pageId: string, patch: Partial<SubjectPage>) => {
    setNotebook((prev) => ({
      ...prev,
      subjects: prev.subjects.map((subject) =>
        subject.id !== subjectId
          ? subject
          : {
              ...subject,
              pages: subject.pages.map((page) => (page.id === pageId ? { ...page, ...patch } : page)),
            },
      ),
    }));
  };

  const addPage = (subjectId: string, options?: { afterPageId?: string; topicLabel?: string }): string => {
    const pageId = createId();
    setNotebook((prev) => ({
      ...prev,
      subjects: prev.subjects.map((subject) =>
        subject.id !== subjectId
          ? subject
          : (() => {
              const pages = [...subject.pages];
              const insertAt = options?.afterPageId ? Math.max(0, pages.findIndex((page) => page.id === options.afterPageId) + 1) : pages.length;
              const referenceIndex = Math.max(0, insertAt - 1);
              const inheritedTopic = options?.topicLabel || pages[referenceIndex]?.topicLabel || subject.topic || "Assunto";
              const entry = { ...makePage(`Pagina ${pages.length + 1}`, inheritedTopic, false, notebook.settings), id: pageId };
              pages.splice(insertAt, 0, entry);
              const normalizedPages = pages.map((page, index) => ({ ...page, title: `Pagina ${index + 1}` }));
              return { ...subject, pages: normalizedPages };
            })(),
      ),
    }));
    return pageId;
  };

  const changeTopicFromPage = (subjectId: string, pageId: string, topicLabel: string) => {
    const nextLabel = topicLabel.trim() || "Assunto";
    setNotebook((prev) => ({
      ...prev,
      subjects: prev.subjects.map((subject) => {
        if (subject.id !== subjectId) {
          return subject;
        }
        const pages = [...subject.pages];
        const startIndex = pages.findIndex((page) => page.id === pageId);
        if (startIndex < 0) {
          return subject;
        }
        const nextTopicStart = pages.findIndex((page, idx) => idx > startIndex && page.topicStart);
        const endIndex = nextTopicStart >= 0 ? nextTopicStart : pages.length;
        const updated = pages.map((page, idx) => {
          if (idx < startIndex || idx >= endIndex) {
            return page;
          }
          return {
            ...page,
            topicLabel: nextLabel,
            topicStart: idx === startIndex,
          };
        });
        return { ...subject, pages: updated };
      }),
    }));
  };

  const nextPage = () => {
    if (activeIndex < flow.length - 1) {
      goToIndex(activeIndex + 1);
      return;
    }
    if (activePage?.kind === "subjectPage" && currentSubject) {
      const newPageId = addPage(currentSubject.id);
      setPendingFlowKey(`subject-page-${currentSubject.id}-${newPageId}`);
      setStatus(`Nova pagina criada em ${currentSubject.name}.`);
    }
  };

  const previousPage = () => goToIndex(activeIndex - 1);

  const topRightClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, textarea, select, .editor-paper, .toolbar, .hamburger-wrap, [data-no-page-turn='true']")) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    if (x > box.width * 0.75 && y < box.height * 0.22) {
      nextPage();
    }
  };

  const onWheelZoom = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey) {
      event.preventDefault();
      const next = Math.max(0.75, Math.min(1.5, appZoom + (event.deltaY < 0 ? 0.05 : -0.05)));
      setAppZoom(Number(next.toFixed(2)));
      return;
    }
    if (!event.altKey) {
      return;
    }
    event.preventDefault();
    const next = Math.max(0.8, Math.min(1.6, pageZoom + (event.deltaY < 0 ? 0.04 : -0.04)));
    setPageZoom(Number(next.toFixed(2)));
  };

  const onCoverImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const allowed = ["image/jpeg", "image/jpg", "image/bmp"];
    if (!allowed.includes(file.type)) {
      setStatus("A capa aceita somente .jpg, .jpeg ou .bmp.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setNotebook((prev) => ({ ...prev, coverImage: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const addSubject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newSubjectName.trim()) {
      return;
    }
    const subject = createSubject(newSubjectName.trim(), newSubjectColor, notebook.settings);
    setNotebook((prev) => ({ ...prev, subjects: [...prev.subjects, subject] }));
    setStatus(`Materia ${subject.name} criada.`);
    setNewSubjectName("");
  };

  const moveSubject = (subjectId: string, direction: -1 | 1) => {
    const currentIndex = notebook.subjects.findIndex((subject) => subject.id === subjectId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= notebook.subjects.length) {
      return;
    }
    const clone = [...notebook.subjects];
    const [item] = clone.splice(currentIndex, 1);
    clone.splice(targetIndex, 0, item);
    setNotebook((prev) => ({ ...prev, subjects: clone }));
  };

  const reorderByDnD = (targetSubjectId: string) => {
    if (!dragSubjectId || dragSubjectId === targetSubjectId) {
      return;
    }
    const clone = [...notebook.subjects];
    const sourceIndex = clone.findIndex((subject) => subject.id === dragSubjectId);
    const targetIndex = clone.findIndex((subject) => subject.id === targetSubjectId);
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }
    const [item] = clone.splice(sourceIndex, 1);
    clone.splice(targetIndex, 0, item);
    setNotebook((prev) => ({ ...prev, subjects: clone }));
    setDragSubjectId(null);
  };

  const deleteSubject = async (subject: Subject) => {
    const pagesWithContent = subject.pages
      .map((page, index) => ({ index: index + 1, hasContent: Boolean((page.contentText || stripHtml(page.contentHtml)).trim()) }))
      .filter((item) => item.hasContent)
      .map((item) => item.index);
    const warning = pagesWithContent.length
      ? `Atencao: A materia ${subject.name} contem texto salvo nas paginas ${pagesWithContent.join(", ")}. Tem certeza de que quer deletar?`
      : `Deseja realmente deletar a materia ${subject.name}?`;
    if (!window.confirm(warning)) {
      return;
    }

    const retentionDays = retentionDaysFromPolicy(notebook.settings.deletedSubjectBackupPolicy);
    if (retentionDays !== 0 && window.portableNotebook?.archiveDeletedSubject) {
      await window.portableNotebook.archiveDeletedSubject({ notebookTitle: notebook.title, subject, retentionDays });
      await refreshDeletedBackups();
    }

    setNotebook((prev) => {
      const subjects = prev.subjects.filter((item) => item.id !== subject.id);
      return { ...prev, subjects: subjects.length > 0 ? subjects : [createSubject("Nova materia", "#6366f1", prev.settings)] };
    });
    setStatus(`Materia ${subject.name} removida.`);
  };

  const updateFromEditor = (payload: EditorPayload) => {
    if (!currentSubject || !currentNotebookPage) {
      return;
    }
    updatePage(currentSubject.id, currentNotebookPage.id, {
      contentHtml: payload.html,
      contentText: payload.text,
      contentJson: payload.json,
    });
  };

  const updateCurrentPageStyle = (patch: Partial<SubjectPage>) => {
    if (!currentSubject || !currentNotebookPage) {
      return;
    }
    updatePage(currentSubject.id, currentNotebookPage.id, patch);
    editorBridgeRef.current?.applyStylePatch(patch);
  };

  const setIndentFromClientX = (clientX: number) => {
    if (!horizontalRulerRef.current || !currentNotebookPage) {
      return;
    }
    const bounds = horizontalRulerRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
    const nextIndent = Math.round(ratio * 7);
    if (nextIndent !== currentNotebookPage.indentLevel) {
      updateCurrentPageStyle({ indentLevel: nextIndent });
    }
  };

  const setLineSpacingFromClientY = (clientY: number) => {
    if (!verticalRulerRef.current || !currentNotebookPage) {
      return;
    }
    const bounds = verticalRulerRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height));
    const mapped = 2 - ratio;
    const nextSpacing = Number((Math.round(mapped * 10) / 10).toFixed(1));
    if (nextSpacing !== currentNotebookPage.lineSpacing) {
      updateCurrentPageStyle({ lineSpacing: nextSpacing });
    }
  };

  useEffect(() => {
    if (!rulerDrag) {
      return;
    }
    const onMove = (event: MouseEvent) => {
      if (rulerDrag === "indent") {
        setIndentFromClientX(event.clientX);
      } else {
        setLineSpacingFromClientY(event.clientY);
      }
    };
    const onUp = () => setRulerDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [rulerDrag, currentNotebookPage?.id, currentNotebookPage?.indentLevel, currentNotebookPage?.lineSpacing]);

  const startIndentDrag = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIndentFromClientX(event.clientX);
    setRulerDrag("indent");
  };

  const startLineSpacingDrag = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setLineSpacingFromClientY(event.clientY);
    setRulerDrag("lineSpacing");
  };

  const runJumpToPage = () => {
    const target = Number(pageJumpInput);
    if (!Number.isInteger(target) || target < 1 || target > flow.length) {
      setStatus(`Pagina ${pageJumpInput} nao existe.`);
      return;
    }
    goToIndex(target - 1);
  };

  const openNotebookFile = async () => {
    try {
      if (!window.portableNotebook?.openExternalData) {
        setStatus("Abrir arquivo disponivel apenas no modo desktop.");
        return;
      }
      const raw = await window.portableNotebook.openExternalData();
      if (!raw) {
        return;
      }
      const parsed = normalizeNotebook(JSON.parse(raw) as Partial<Notebook>);
      setNotebook(parsed);
      setActiveIndex(0);
      setStatus("Arquivo aberto com sucesso.");
    } catch {
      setStatus("Falha ao abrir o arquivo selecionado.");
    }
  };

  const saveNotebookAs = async () => {
    try {
      const raw = JSON.stringify(notebook, null, 2);
      if (!window.portableNotebook?.saveAsData) {
        const blob = new Blob([raw], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "notebook-export.json";
        link.click();
        URL.revokeObjectURL(url);
        setStatus("Arquivo exportado via navegador.");
        return;
      }
      const savedAt = await window.portableNotebook.saveAsData(raw);
      if (savedAt) {
        setStatus(`Arquivo salvo em ${savedAt}.`);
      }
    } catch {
      setStatus("Falha ao salvar como.");
    }
  };

  const exportNotebookHtml = async () => {
    const html = buildNotebookHtml(notebook);
    if (!window.portableNotebook?.exportHtml) {
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${notebook.title.replace(/\s+/g, "_")}.html`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
    const filePath = await window.portableNotebook.exportHtml({ title: notebook.title, html });
    if (filePath) {
      setStatus(`Exportacao HTML concluida em ${filePath}.`);
    }
  };

  const downloadBackup = async () => {
    try {
      const secret = backupPass.trim() || BACKUP_APP_SECRET;
      const payload = await encryptBackup(notebook, secret);
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${notebook.title.replace(/\s+/g, "_")}_backup.cnbk`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus("Backup criptografado gerado.");
    } catch {
      setStatus("Falha ao gerar backup criptografado.");
    }
  };

  const restoreBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupPayload;
      const passphrase = parsed.protected ? restorePass.trim() : BACKUP_APP_SECRET;
      if (!passphrase) {
        setStatus("Informe a senha para restauracao.");
        return;
      }
      const restored = await decryptBackup(parsed, passphrase);
      setNotebook(restored);
      setStatus("Backup restaurado com sucesso.");
    } catch {
      setStatus("Nao foi possivel restaurar o backup.");
    } finally {
      if (backupFileRef.current) {
        backupFileRef.current.value = "";
      }
    }
  };

  const enablePassword = async () => {
    if (!pendingPassword.trim()) {
      setStatus("Digite uma senha valida.");
      return;
    }
    const security = await hashPassword(pendingPassword.trim());
    setNotebook((prev) => ({ ...prev, security: { enabled: true, salt: security.salt, hash: security.hash } }));
    setPendingPassword("");
    setStatus("Senha ativada.");
  };

  const disablePassword = () => {
    setNotebook((prev) => ({ ...prev, security: { enabled: false, salt: "", hash: "" } }));
    setStatus("Senha removida.");
  };

  const unlockNotebook = async () => {
    if (!notebook.security.enabled) {
      setLocked(false);
      return;
    }
    const computed = await hashPassword(unlockPass, notebook.security.salt);
    if (computed.hash === notebook.security.hash) {
      setLocked(false);
      setUnlockPass("");
      setStatus("Caderno desbloqueado.");
    } else {
      setStatus("Senha incorreta.");
    }
  };

  const restoreDeletedSubject = async (backupId: string) => {
    if (!window.portableNotebook?.restoreDeletedSubject) {
      return;
    }
    const restored = await window.portableNotebook.restoreDeletedSubject(backupId);
    if (!restored) {
      setStatus("Backup nao encontrado.");
      return;
    }
    setNotebook((prev) => ({ ...prev, subjects: [...prev.subjects, normalizeNotebook({ subjects: [restored] }).subjects[0]] }));
    await refreshDeletedBackups();
    setStatus(`Materia ${restored.name} restaurada.`);
  };

  const removeDeletedBackup = async (backupId: string) => {
    if (!window.portableNotebook?.deleteDeletedSubjectBackup) {
      return;
    }
    await window.portableNotebook.deleteDeletedSubjectBackup(backupId);
    await refreshDeletedBackups();
  };

  if (locked) {
    return (
      <div className="lock-screen">
        <div className="lock-box">
          <h1>{notebook.title}</h1>
          <p>Este caderno esta protegido por senha.</p>
          <input type="password" value={unlockPass} onChange={(event) => setUnlockPass(event.target.value)} onKeyDown={(event) => event.key === "Enter" && unlockNotebook()} placeholder="Digite a senha" />
          <button onClick={unlockNotebook}>Desbloquear</button>
          <small>{status}</small>
        </div>
      </div>
    );
  }

  return (
    <div className="notebook-app" style={{ transform: `scale(${appZoom})`, transformOrigin: "top left", width: `${100 / appZoom}%` }}>
      <aside className="sidebar">
        <div>
          <h2>Caderno Portatil</h2>
          <p>Busca e criacao de materias. Configuracoes no menu hamburguer.</p>
        </div>

        <div className="panel">
          <label>Busca</label>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={'palavra, palavras ou "frase exata"'} />
          <div className="result-list">
            {results.map((result) => (
              <button key={result.id} onClick={() => goToIndex(flow.findIndex((entry) => entry.key === result.flowKey))}>
                <strong>{result.subjectName}</strong>
                <span>{result.section}</span>
                <small>{result.preview}</small>
              </button>
            ))}
          </div>
        </div>

        <form className="panel" onSubmit={addSubject}>
          <label>Nova materia</label>
          <input value={newSubjectName} onChange={(event) => setNewSubjectName(event.target.value)} placeholder="Nome da materia" />
          <label className="matter-color-field">
            <span>Cor da Materia</span>
            <div className="matter-color-input-wrap">
              <input type="color" value={newSubjectColor} onChange={(event) => setNewSubjectColor(event.target.value)} />
              <strong>{newSubjectColor}</strong>
            </div>
          </label>
          <button>Criar materia</button>
        </form>

        <small>{status}</small>
      </aside>

      <main className="book-shell">
        <div className="book-body" onWheel={onWheelZoom}>
          <div className="spiral-column">
            {Array.from({ length: 14 }).map((_, index) => (
              <span key={index} />
            ))}
          </div>

          <div className="book-page-area">
            <div className="hamburger-wrap" ref={hamburgerRef}>
              <button className="hamburger" onClick={() => setMenuOpen((prev) => !prev)}><Menu size={17} /></button>
              {menuOpen && (
                <div className="hamburger-menu">
                  <button onClick={openNotebookFile}><FileInput size={14} /> Abrir</button>
                  <button onClick={() => saveStoredNotebook(JSON.stringify(notebook)).then(() => setStatus("Arquivo salvo no modo portatil."))}><FileOutput size={14} /> Salvar</button>
                  <button onClick={saveNotebookAs}><FileOutput size={14} /> Salvar como</button>
                  <button onClick={() => window.print()}><Printer size={14} /> Imprimir</button>
                  <button onClick={exportNotebookHtml}><Download size={14} /> Exportar</button>
                  <button onClick={() => setSettingsOpen((prev) => !prev)}>{settingsOpen ? "Fechar" : "Configuracoes"}</button>
                  {settingsOpen && (
                    <div className="menu-settings" data-no-page-turn="true">
                      <p className="menu-section-title">Padrao visual</p>
                      <label className="menu-settings-row">Fonte padrao
                        <select value={notebook.settings.defaultFontFamily} onChange={(event) => setNotebook((prev) => ({ ...prev, settings: { ...prev.settings, defaultFontFamily: event.target.value } }))}>
                          {fontOptions.map((font) => (
                            <option key={font.value} value={font.value}>{font.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="menu-settings-row">Tamanho padrao
                        <select value={notebook.settings.defaultFontSize} onChange={(event) => setNotebook((prev) => ({ ...prev, settings: { ...prev.settings, defaultFontSize: event.target.value } }))}>
                          <option value="14px">14</option>
                          <option value="16px">16</option>
                          <option value="18px">18</option>
                          <option value="20px">20</option>
                          <option value="24px">24</option>
                          <option value="28px">28</option>
                        </select>
                      </label>
                      <label className="menu-settings-row">Cor do texto padrao
                        <input type="color" value={notebook.settings.defaultTextColor} onChange={(event) => setNotebook((prev) => ({ ...prev, settings: { ...prev.settings, defaultTextColor: event.target.value } }))} />
                      </label>
                      <label className="menu-settings-row">Papel padrao
                        <select value={notebook.settings.defaultPaperKind} onChange={(event) => setNotebook((prev) => ({ ...prev, settings: { ...prev.settings, defaultPaperKind: event.target.value as PageKind } }))}>
                          <option value="lined">Pautas</option>
                          <option value="blank">Liso</option>
                        </select>
                      </label>
                      <label className="menu-settings-row">Cor fundo padrao
                        <input type="color" value={notebook.settings.defaultLinedStyle.background} onChange={(event) => setNotebook((prev) => ({ ...prev, settings: { ...prev.settings, defaultLinedStyle: { ...prev.settings.defaultLinedStyle, background: event.target.value } } }))} />
                      </label>
                      <label className="menu-settings-row">Cor linha padrao
                        <input type="color" value={notebook.settings.defaultLinedStyle.lineColor} onChange={(event) => setNotebook((prev) => ({ ...prev, settings: { ...prev.settings, defaultLinedStyle: { ...prev.settings.defaultLinedStyle, lineColor: event.target.value } } }))} />
                      </label>
                      <label className="menu-settings-row">Cor margem padrao
                        <input type="color" value={notebook.settings.defaultLinedStyle.marginColor} onChange={(event) => setNotebook((prev) => ({ ...prev, settings: { ...prev.settings, defaultLinedStyle: { ...prev.settings.defaultLinedStyle, marginColor: event.target.value } } }))} />
                      </label>
                      <label className="menu-settings-row">Mostrar toolbar
                        <input type="checkbox" checked={notebook.settings.showToolbar} onChange={(event) => setNotebook((prev) => ({ ...prev, settings: { ...prev.settings, showToolbar: event.target.checked } }))} />
                      </label>
                      <label className="menu-settings-row">Mostrar reguas
                        <input type="checkbox" checked={notebook.settings.showRulers} onChange={(event) => setNotebook((prev) => ({ ...prev, settings: { ...prev.settings, showRulers: event.target.checked } }))} />
                      </label>

                      <p className="menu-section-title">Comportamento</p>
                      <label className="menu-settings-row">Som de virada
                        <input type="checkbox" checked={notebook.soundEnabled} onChange={(event) => setNotebook((prev) => ({ ...prev, soundEnabled: event.target.checked }))} />
                      </label>
                      <label className="menu-settings-row">Backup materia excluida
                        <select
                          value={notebook.settings.deletedSubjectBackupPolicy}
                          onChange={(event) =>
                            setNotebook((prev) => ({ ...prev, settings: { ...prev.settings, deletedSubjectBackupPolicy: event.target.value as BackupPolicy } }))
                          }
                        >
                          <option value="none">Sem backup</option>
                          <option value="10">10 dias</option>
                          <option value="20">20 dias</option>
                          <option value="30">30 dias</option>
                          <option value="forever">Sem prazo</option>
                        </select>
                      </label>
                      <button type="button" onClick={() => refreshDeletedBackups().catch(() => undefined)}>Atualizar backups de materias</button>
                      <div className="menu-inline-stack">
                        {deletedBackups.map((item) => (
                          <div key={item.id} className="backup-entry">
                            <div>
                              <strong>{item.subjectName}</strong>
                              <small>{new Date(item.deletedAt).toLocaleString()} | paginas: {item.pageCount}</small>
                            </div>
                            <div className="backup-actions">
                              <button type="button" onClick={() => restoreDeletedSubject(item.id)}>Restaurar</button>
                              <button type="button" onClick={() => removeDeletedBackup(item.id)}>Apagar</button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <p className="menu-section-title">Seguranca e backup</p>
                      <label className="menu-settings-row menu-settings-column">
                        <span>Senha extra backup</span>
                        <input type="password" value={backupPass} onChange={(event) => setBackupPass(event.target.value)} placeholder="Opcional" />
                      </label>
                      <button type="button" onClick={downloadBackup}><Download size={14} /> Backup criptografado</button>
                      <label className="menu-settings-row menu-settings-column">
                        <span>Senha para restaurar</span>
                        <input type="password" value={restorePass} onChange={(event) => setRestorePass(event.target.value)} placeholder="Obrigatoria se protegido" />
                      </label>
                      <input ref={backupFileRef} type="file" accept=".cnbk,.json" onChange={restoreBackup} />
                      <label className="menu-settings-row menu-settings-column">
                        <span>Senha do caderno</span>
                        <input type="password" value={pendingPassword} onChange={(event) => setPendingPassword(event.target.value)} placeholder="Definir senha" />
                      </label>
                      <div className="inline-actions menu-inline-actions">
                        <button type="button" onClick={enablePassword}>Ativar</button>
                        <button type="button" onClick={disablePassword}>Remover</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {notebook.settings.showRulers && (
              <>
                <div className="horizontal-ruler" ref={horizontalRulerRef} onMouseDown={startIndentDrag} data-no-page-turn="true">
                  {Array.from({ length: 21 }).map((_, index) => (
                    <span key={index}>{index * 2}</span>
                  ))}
                  {currentNotebookPage && (
                    <button
                      type="button"
                      className="ruler-marker ruler-marker-horizontal"
                      style={{ left: `${(currentNotebookPage.indentLevel / 7) * 100}%` }}
                      onMouseDown={startIndentDrag}
                      data-no-page-turn="true"
                      title={`Recuo: ${currentNotebookPage.indentLevel}`}
                    >
                      <span className="triangle-down" />
                      <span className="triangle-up" />
                    </button>
                  )}
                </div>
                <div className="vertical-ruler" ref={verticalRulerRef} onMouseDown={startLineSpacingDrag} data-no-page-turn="true">
                  {Array.from({ length: 17 }).map((_, index) => (
                    <span key={index}>{index * 2}</span>
                  ))}
                  {currentNotebookPage && (
                    <button
                      type="button"
                      className="ruler-marker ruler-marker-vertical"
                      style={{ top: `${(2 - currentNotebookPage.lineSpacing) * 100}%` }}
                      onMouseDown={startLineSpacingDrag}
                      data-no-page-turn="true"
                      title={`Entrelinhas: ${currentNotebookPage.lineSpacing.toFixed(1)}`}
                    >
                      <span className="triangle-right" />
                    </button>
                  )}
                </div>
              </>
            )}

            <AnimatePresence mode="wait">
              <div className="page-zoom-wrap" style={{ transform: `scale(${pageZoom})`, transformOrigin: "top center" }}>
              <motion.div
                key={activePage.key}
                drag={false}
                onClick={topRightClick}
                initial={{ rotateY: 24, x: 40, opacity: 0.2 }}
                animate={{ rotateY: 0, x: 0, opacity: 1 }}
                exit={{ rotateY: -16, x: -35, opacity: 0 }}
                transition={{ duration: 0.32 }}
                className="book-page"
              >
                {activePage.kind === "cover" && (
                  <div
                    className="cover-sheet"
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setCoverContextMenu({ x: event.clientX, y: event.clientY });
                    }}
                    style={{ backgroundImage: notebook.coverImage ? `linear-gradient(rgba(0,0,0,.38), rgba(0,0,0,.34)), url(${notebook.coverImage})` : undefined }}
                  >
                    <div className="cover-label" data-no-page-turn="true">
                      <p>Caderno de materias</p>
                      <input
                        className="cover-title-input"
                        value={notebook.title}
                        onChange={(event) => setNotebook((prev) => ({ ...prev, title: event.target.value }))}
                        placeholder="Meu Caderno"
                        style={{ width: `${Math.max(12, Math.min(30, notebook.title.length + 2))}ch` }}
                      />
                    </div>
                    {coverContextMenu && (
                      <div className="cover-context-menu" style={{ left: coverContextMenu.x, top: coverContextMenu.y }} data-no-page-turn="true">
                        <button type="button" onClick={() => { coverFileRef.current?.click(); setCoverContextMenu(null); }}>Inserir imagem</button>
                      </div>
                    )}
                  </div>
                )}

                {activePage.kind === "index" && (
                  <div className="index-sheet">
                    <p>Primeira folha</p>
                    <h2>Indice Geral</h2>
                    {notebook.subjects.map((subject, index) => (
                      <div
                        key={subject.id}
                        draggable
                        onDragStart={() => setDragSubjectId(subject.id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => reorderByDnD(subject.id)}
                        className="index-line"
                      >
                        <span className="dot" style={{ background: subject.color }} />
                        <div>
                          <strong>{subject.name}</strong>
                          <small>Posicao: {index + 1}</small>
                        </div>
                        <button onClick={() => moveSubject(subject.id, -1)}>Subir</button>
                        <button onClick={() => moveSubject(subject.id, 1)}>Descer</button>
                        <button onClick={() => deleteSubject(subject)}><Trash2 size={14} /> Excluir</button>
                      </div>
                    ))}
                  </div>
                )}

                {activePage.kind === "subjectFront" && currentSubject && (
                  <div className="subject-front-sheet">
                    <p>Abertura da materia</p>
                    <h2 style={{ color: currentSubject.color }}>{currentSubject.name}</h2>
                    <div className="subject-grid">
                      <label>Nome da materia<input value={currentSubject.name} onChange={(event) => updateSubject(currentSubject.id, { name: event.target.value })} /></label>
                      <label>Cor principal<input type="color" value={currentSubject.color} onChange={(event) => updateSubject(currentSubject.id, { color: event.target.value })} /></label>
                      <label className="full">Descricao<textarea value={currentSubject.description} onChange={(event) => updateSubject(currentSubject.id, { description: event.target.value })} /></label>
                      <label className="full">Assunto principal<input value={currentSubject.topic} onChange={(event) => updateSubject(currentSubject.id, { topic: event.target.value })} /></label>
                      <label>Professor<input value={currentSubject.professor} onChange={(event) => updateSubject(currentSubject.id, { professor: event.target.value })} /></label>
                      <label>Periodo/Horario<input value={currentSubject.period} onChange={(event) => updateSubject(currentSubject.id, { period: event.target.value })} /></label>
                      <label className="full">Observacoes<textarea value={currentSubject.observations} onChange={(event) => updateSubject(currentSubject.id, { observations: event.target.value })} /></label>
                      <label className="full">Objetivos<textarea value={currentSubject.objectives} onChange={(event) => updateSubject(currentSubject.id, { objectives: event.target.value })} /></label>
                    </div>
                    <button className="add-page" onClick={() => addPage(currentSubject.id)}>Adicionar pagina nesta materia</button>
                  </div>
                )}

                {activePage.kind === "subjectPage" && currentSubject && currentNotebookPage && (
                  <div className="subject-page-sheet" data-no-page-turn="true">
                    <div className="page-header">
                      <div>
                        <label className="topic-title-edit">
                          Assunto
                          <input
                            value={currentNotebookPage.topicLabel}
                            onChange={(event) => changeTopicFromPage(currentSubject.id, currentNotebookPage.id, event.target.value)}
                            placeholder="Ex: Polinomios"
                          />
                        </label>
                        <small>{currentSubject.name}</small>
                      </div>
                      <div className="paper-type-wrap">
                        <button type="button" className="paper-type-button" onClick={() => setPaperTypeMenuOpen((prev) => !prev)}>
                          <span className="paper-icon" />
                          {currentNotebookPage.kind === "lined" ? "Pautas" : "Liso"}
                        </button>
                        {paperTypeMenuOpen && (
                          <div className="paper-type-menu">
                            <button type="button" onClick={() => { updateCurrentPageStyle({ kind: "lined" }); setPaperTypeMenuOpen(false); }}>Pautas</button>
                            <button type="button" onClick={() => { updateCurrentPageStyle({ kind: "blank" }); setPaperTypeMenuOpen(false); }}>Liso</button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="format-row">
                      <select value={currentNotebookPage.fontFamily} onChange={(event) => updateCurrentPageStyle({ fontFamily: event.target.value })}>
                        {fontOptions.map((font) => (
                          <option key={font.value} value={font.value}>{font.label}</option>
                        ))}
                      </select>
                      <select value={currentNotebookPage.fontSize} onChange={(event) => updateCurrentPageStyle({ fontSize: event.target.value })} title="Tamanho da fonte">
                        <option value="12px">12</option>
                        <option value="14px">14</option>
                        <option value="16px">16</option>
                        <option value="18px">18</option>
                        <option value="20px">20</option>
                        <option value="24px">24</option>
                        <option value="28px">28</option>
                        <option value="32px">32</option>
                      </select>
                      <label className="color-tool" title="Cor da fonte">
                        <span className="color-glyph">A</span>
                        <span className="palette-dot" />
                        <input type="color" value={currentNotebookPage.textColor} onChange={(event) => updateCurrentPageStyle({ textColor: event.target.value })} />
                      </label>
                      <select value={currentNotebookPage.textAlign} onChange={(event) => updateCurrentPageStyle({ textAlign: event.target.value as TextAlignMode })}>
                        <option value="left">Esquerda</option>
                        <option value="center">Centro</option>
                        <option value="right">Direita</option>
                        <option value="justify">Justificado</option>
                      </select>
                      <label className="color-tool" title="Cor de fundo">
                        <span className="color-glyph">F</span>
                        <span className="palette-dot" />
                        <input
                          type="color"
                          value={currentNotebookPage.linedStyle.background}
                          onChange={(event) => updateCurrentPageStyle({ linedStyle: { ...currentNotebookPage.linedStyle, background: event.target.value } })}
                        />
                      </label>
                      <label className="color-tool" title="Cor da linha">
                        <span className="color-glyph">L</span>
                        <span className="palette-dot" />
                        <input
                          type="color"
                          value={currentNotebookPage.linedStyle.lineColor}
                          onChange={(event) => updateCurrentPageStyle({ linedStyle: { ...currentNotebookPage.linedStyle, lineColor: event.target.value } })}
                        />
                      </label>
                      <label className="color-tool" title="Cor da margem">
                        <span className="color-glyph">M</span>
                        <span className="palette-dot" />
                        <input
                          type="color"
                          value={currentNotebookPage.linedStyle.marginColor}
                          onChange={(event) => updateCurrentPageStyle({ linedStyle: { ...currentNotebookPage.linedStyle, marginColor: event.target.value } })}
                        />
                      </label>
                    </div>

                    <div
                      className="editor-paper"
                      style={{
                        background:
                          currentNotebookPage.kind === "blank"
                            ? currentNotebookPage.linedStyle.background
                            : `linear-gradient(to right, transparent 84px, ${currentNotebookPage.linedStyle.marginColor} 85px, ${currentNotebookPage.linedStyle.marginColor} 87px, transparent 88px), repeating-linear-gradient(${currentNotebookPage.linedStyle.background}, ${currentNotebookPage.linedStyle.background} 32px, ${currentNotebookPage.linedStyle.lineColor} 33px)`,
                      }}
                    >
                      <NotebookEditor key={currentNotebookPage.id} page={currentNotebookPage} showToolbar={notebook.settings.showToolbar} onChange={updateFromEditor} onPageFormatChange={updateCurrentPageStyle} bridgeRef={editorBridgeRef} />
                    </div>
                    {currentPageIndex > 0 && currentSubject.pages[currentPageIndex + 1]?.topicStart && (
                      <button
                        type="button"
                        className="append-prev-topic"
                        onClick={() => {
                          const prevTopic = currentNotebookPage.topicLabel || "Assunto";
                          const newPageId = addPage(currentSubject.id, { afterPageId: currentNotebookPage.id, topicLabel: prevTopic });
                          setPendingFlowKey(`subject-page-${currentSubject.id}-${newPageId}`);
                          setStatus(`Nova pagina adicionada ao assunto ${prevTopic}.`);
                        }}
                      >
                        Adicionar pagina em branco ao assunto anterior
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
              </div>
            </AnimatePresence>
            <input ref={coverFileRef} type="file" accept=".jpg,.jpeg,.bmp" onChange={onCoverImage} className="hidden" />

            <div className="pager">
              <button onClick={previousPage} disabled={activeIndex === 0}><ChevronLeft size={16} /> Anterior</button>
              <div className="page-jump">
                <span>Pagina</span>
                <input value={pageJumpInput} onChange={(event) => setPageJumpInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && runJumpToPage()} />
                <span>de {flow.length}</span>
              </div>
              <button onClick={nextPage}>Proxima <ChevronRight size={16} /></button>
            </div>
          </div>
        </div>

        <div className="subject-tab-rail">
          {notebook.subjects.map((subject) => {
            const isCurrent = currentSubject?.id === subject.id;
            const topicAnchors = subject.pages
              .map((page, index) => ({ page, index }))
              .filter((entry, index) => index === 0 || entry.page.topicStart)
              .filter((entry, index, all) => index === 0 || entry.page.topicLabel !== all[index - 1].page.topicLabel);
            return (
              <div key={subject.id} className={`subject-tab-item ${isCurrent ? "active" : ""}`}>
                <button className="subject-tab-handle" onClick={() => goToIndex(flow.findIndex((entry) => entry.key === `subject-front-${subject.id}`))} style={{ background: subject.color }} title={subject.name} />
                <div className="subject-tab-popover">
                  <button className="subject-tab-label" onClick={() => goToIndex(flow.findIndex((entry) => entry.key === `subject-front-${subject.id}`))} style={{ background: subject.color }}>
                    {subject.name}
                  </button>
                  <div className="subject-topic-links" style={{ borderColor: subject.color }}>
                    {topicAnchors.map((entry) => (
                      <button
                        key={`${subject.id}-${entry.page.id}`}
                        className="topic-link"
                        onClick={() => goToIndex(flow.findIndex((flowEntry) => flowEntry.key === `subject-page-${subject.id}-${entry.page.id}`))}
                      >
                        {entry.page.topicLabel || "Assunto"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}