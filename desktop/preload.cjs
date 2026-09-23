const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('OnePieceDesktop', Object.freeze({
  isDesktop: true,
  platform: process.platform,
}));
