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

  // AI APIs
  generateContent: (content, model, images) => ipcRenderer.invoke('ai-generate-content', content, model, images),
  saveAISettings: (settings) => ipcRenderer.invoke('ai-save-settings', settings),
  getAISettings: () => ipcRenderer.invoke('ai-get-settings'),
  onContentChunk: (callback) => ipcRenderer.on('ai-content-chunk', (_, chunk) => callback(chunk)),
  onImageChunk: (callback) => ipcRenderer.on('ai-image-chunk', (_, imageData) => callback(imageData)),

  // UI State persistence
  saveUIState: (uiState) => ipcRenderer.invoke('save-ui-state', uiState),
  getUIState: () => ipcRenderer.invoke('get-ui-state')
});
