'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Exposer uniquement ce dont la page hors-ligne a besoin
contextBridge.exposeInMainWorld('electronAPI', {
  retry: () => ipcRenderer.send('retry'),
});
