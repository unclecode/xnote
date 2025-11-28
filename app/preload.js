const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Data persistence
  getData: (key) => ipcRenderer.invoke('get-data', key),
  setData: (key, value) => ipcRenderer.invoke('set-data', key, value),
  getAllData: () => ipcRenderer.invoke('get-all-data'),
  setAllData: (data) => ipcRenderer.invoke('set-all-data', data),

  // Window controls
  hideWindow: () => ipcRenderer.send('window-hide'),
  closeWindow: () => ipcRenderer.send('window-close'),
  quitApp: () => ipcRenderer.send('app-quit'),

  // Download/export
  downloadMarkdown: (content, suggestedName) => ipcRenderer.invoke('download-markdown', content, suggestedName),

  // Share via Gist
  shareGist: (content, filename, isPublic) => ipcRenderer.invoke('share-gist', content, filename, isPublic)
});
