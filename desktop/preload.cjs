const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('UmbralDesktop', Object.freeze({
  isDesktop: true,
  platform: process.platform,
}));
