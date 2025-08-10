const electron = require('electron');
const contextBridge = electron.contextBridge;
const ipcRenderer = electron.ipcRenderer;

contextBridge.exposeInMainWorld('electronAPI', {
  startScan: function(urls) { return ipcRenderer.invoke('start-scan', urls); },
  cancelScan: function() { return ipcRenderer.invoke('cancel-scan'); },
  onLog: function(callback) { ipcRenderer.on('log', callback); },
  onProgress: function(callback) { ipcRenderer.on('progress', callback); },
  onReport: function(callback) { ipcRenderer.on('report', callback); },
  showInFolder: function(filePath) { return ipcRenderer.invoke('show-in-folder', filePath); },
  openInBrowser: function(filePath) { return ipcRenderer.invoke('open-in-browser', filePath); },
  getAppData: function() { return ipcRenderer.invoke('get-app-data'); },
  exportExcel: function() { return ipcRenderer.invoke('export-excel'); }
});
