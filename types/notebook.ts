import type { JSONContent } from "@tiptap/core";

export type TextAlignMode = "left" | "center" | "right" | "justify";
export type PageKind = "blank" | "lined";
export type BackupPolicy = "none" | "10" | "20" | "30" | "forever";

export type LinedStyle = {
  background: string;
  lineColor: string;
  marginColor: string;
};

export type SubjectPage = {
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

export type Subject = {
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

export type SecuritySettings = {
  enabled: boolean;
  salt: string;
  hash: string;
};

export type NotebookSettings = {
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

export type Notebook = {
  title: string;
  coverImage: string;
  soundEnabled: boolean;
  subjects: Subject[];
  security: SecuritySettings;
  settings: NotebookSettings;
};

export type BackupPayload = {
  version: 1;
  protected: boolean;
  salt: string;
  iv: string;
  data: string;
};

export type FlowPage =
  | { key: string; kind: "cover" }
  | { key: string; kind: "index" }
  | { key: string; kind: "subjectFront"; subjectId: string }
  | { key: string; kind: "subjectPage"; subjectId: string; pageId: string };

export type SearchResult = {
  id: string;
  flowKey: string;
  subjectName: string;
  section: string;
  preview: string;
};

export type DeletedSubjectBackup = {
  id: string;
  subjectName: string;
  deletedAt: string;
  expiresAt: number | null;
  pageCount: number;
};

export type FontChoice = {
  label: string;
  value: string;
};

export type PageDefaults = Pick<NotebookSettings, "defaultFontFamily" | "defaultFontSize" | "defaultTextColor" | "defaultTextAlign" | "defaultPaperKind" | "defaultLineSpacing" | "defaultIndentLevel" | "defaultLinedStyle">;

export type EditorPayload = {
  html: string;
  text: string;
  json: JSONContent;
};
