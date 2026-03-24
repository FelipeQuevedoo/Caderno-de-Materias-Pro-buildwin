import { app, BrowserWindow, dialog, ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePortableDir() {
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
  if (portableDir) {
    return portableDir;
  }
  return path.dirname(app.getPath("exe"));
}

function portableDataDir() {
  return path.join(resolvePortableDir(), "portable-data");
}

function notebookDataPath() {
  return path.join(portableDataDir(), "notebook.json");
}

function deletedSubjectsBackupDir() {
  return path.join(portableDataDir(), "deleted-subject-backups");
}

async function ensureDataDir() {
  await fs.mkdir(portableDataDir(), { recursive: true });
}

async function ensureDeletedBackupDir() {
  await fs.mkdir(deletedSubjectsBackupDir(), { recursive: true });
}

async function writeAtomically(destination, raw) {
  const tempPath = `${destination}.tmp`;
  await fs.writeFile(tempPath, raw, "utf-8");
  await fs.rename(tempPath, destination);
}

async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

function sanitizeFilename(name) {
  return String(name || "materia").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60);
}

async function listBackupFiles() {
  await ensureDeletedBackupDir();
  const files = await fs.readdir(deletedSubjectsBackupDir());
  return files.filter((item) => item.endsWith(".json"));
}

async function cleanupExpiredDeletedSubjectBackups() {
  const files = await listBackupFiles();
  const now = Date.now();
  await Promise.all(
    files.map(async (fileName) => {
      const filePath = path.join(deletedSubjectsBackupDir(), fileName);
      try {
        const payload = await readJsonFile(filePath);
        if (payload.expiresAt && Number(payload.expiresAt) > 0 && Number(payload.expiresAt) < now) {
          await fs.unlink(filePath);
        }
      } catch {
        // Remove arquivos corrompidos para evitar listar lixo ao usuario.
        await fs.unlink(filePath).catch(() => undefined);
      }
    }),
  );
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1200,
    minHeight: 780,
    title: "Caderno Portatil",
    backgroundColor: "#d7c9b3",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await win.loadURL(devServerUrl);
    win.webContents.openDevTools({ mode: "detach" });
    return;
  }

  const distPath = path.resolve(__dirname, "..", "dist", "index.html");
  await win.loadFile(distPath);
}

ipcMain.handle("notebook:load", async () => {
  try {
    await ensureDataDir();
    const filePath = notebookDataPath();
    const raw = await fs.readFile(filePath, "utf-8");
    JSON.parse(raw);
    return raw;
  } catch {
    return null;
  }
});

ipcMain.handle("notebook:save", async (_event, raw) => {
  if (typeof raw !== "string") {
    throw new Error("Invalid notebook payload");
  }

  JSON.parse(raw);
  await ensureDataDir();
  await writeAtomically(notebookDataPath(), raw);
  return true;
});

ipcMain.handle("notebook:saveAs", async (_event, raw) => {
  if (typeof raw !== "string") {
    throw new Error("Invalid notebook payload");
  }
  JSON.parse(raw);
  const result = await dialog.showSaveDialog({
    defaultPath: path.join(resolvePortableDir(), "portable-data", "notebook-export.json"),
    filters: [{ name: "Caderno JSON", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePath) {
    return null;
  }
  await writeAtomically(result.filePath, raw);
  return result.filePath;
});

ipcMain.handle("notebook:openExternal", async () => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: "Arquivos de caderno", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  const raw = await fs.readFile(result.filePaths[0], "utf-8");
  return raw;
});

ipcMain.handle("notebook:exportHtml", async (_event, payload) => {
  if (!payload || typeof payload.html !== "string" || typeof payload.title !== "string") {
    throw new Error("Invalid HTML payload");
  }
  const result = await dialog.showSaveDialog({
    defaultPath: path.join(resolvePortableDir(), `${sanitizeFilename(payload.title)}.html`),
    filters: [{ name: "Documento HTML", extensions: ["html"] }],
  });
  if (result.canceled || !result.filePath) {
    return null;
  }
  await writeAtomically(result.filePath, payload.html);
  return result.filePath;
});

ipcMain.handle("deleted-subject:archive", async (_event, payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid archive payload");
  }
  const retentionDays = payload.retentionDays === null ? null : Number(payload.retentionDays);
  const deletedAt = new Date().toISOString();
  const expiresAt = retentionDays === null ? null : Date.now() + retentionDays * 24 * 60 * 60 * 1000;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fileName = `${id}-${sanitizeFilename(payload.subject?.name)}.json`;

  await ensureDeletedBackupDir();
  await writeAtomically(
    path.join(deletedSubjectsBackupDir(), fileName),
    JSON.stringify(
      {
        id,
        fileName,
        notebookTitle: payload.notebookTitle || "Meu Caderno",
        deletedAt,
        expiresAt,
        retentionDays,
        subject: payload.subject,
      },
      null,
      2,
    ),
  );
  await cleanupExpiredDeletedSubjectBackups();
  return id;
});

ipcMain.handle("deleted-subject:list", async () => {
  await cleanupExpiredDeletedSubjectBackups();
  const files = await listBackupFiles();
  const entries = await Promise.all(
    files.map(async (fileName) => {
      const payload = await readJsonFile(path.join(deletedSubjectsBackupDir(), fileName));
      return {
        id: payload.id,
        fileName: payload.fileName,
        subjectName: payload.subject?.name || "Materia sem nome",
        deletedAt: payload.deletedAt,
        expiresAt: payload.expiresAt,
        pageCount: Array.isArray(payload.subject?.pages) ? payload.subject.pages.length : 0,
      };
    }),
  );
  return entries.sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
});

ipcMain.handle("deleted-subject:restore", async (_event, id) => {
  const files = await listBackupFiles();
  const matched = files.find((fileName) => fileName.startsWith(`${id}-`) || fileName.includes(id));
  if (!matched) {
    return null;
  }
  const filePath = path.join(deletedSubjectsBackupDir(), matched);
  const payload = await readJsonFile(filePath);
  await fs.unlink(filePath).catch(() => undefined);
  return payload.subject ?? null;
});

ipcMain.handle("deleted-subject:delete", async (_event, id) => {
  const files = await listBackupFiles();
  const matched = files.find((fileName) => fileName.startsWith(`${id}-`) || fileName.includes(id));
  if (!matched) {
    return false;
  }
  await fs.unlink(path.join(deletedSubjectsBackupDir(), matched));
  return true;
});

app.whenReady().then(async () => {
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});