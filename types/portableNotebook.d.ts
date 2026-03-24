export {}

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
