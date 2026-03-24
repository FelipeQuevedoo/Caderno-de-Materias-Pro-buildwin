const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("portableNotebook", {
  loadData: () => ipcRenderer.invoke("notebook:load"),
  saveData: (raw) => ipcRenderer.invoke("notebook:save", raw),
  saveAsData: (raw) => ipcRenderer.invoke("notebook:saveAs", raw),
  openExternalData: () => ipcRenderer.invoke("notebook:openExternal"),
  exportHtml: (payload) => ipcRenderer.invoke("notebook:exportHtml", payload),
  archiveDeletedSubject: (payload) => ipcRenderer.invoke("deleted-subject:archive", payload),
  listDeletedSubjects: () => ipcRenderer.invoke("deleted-subject:list"),
  restoreDeletedSubject: (id) => ipcRenderer.invoke("deleted-subject:restore", id),
  deleteDeletedSubjectBackup: (id) => ipcRenderer.invoke("deleted-subject:delete", id),
});