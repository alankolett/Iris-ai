"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electron", {
  ipcRenderer: {
    invoke: (channel, payload) => {
      return electron.ipcRenderer.invoke(channel, payload);
    },
    on: (channel, callback) => {
      const subscription = (_event, ...args) => callback(...args);
      electron.ipcRenderer.on(channel, subscription);
      return () => {
        electron.ipcRenderer.removeListener(channel, subscription);
      };
    },
    removeAllListeners: (channel) => {
      electron.ipcRenderer.removeAllListeners(channel);
    }
  },
  platform: process.platform,
  versions: process.versions
});
