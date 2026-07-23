// Secure bridge between the browser-chrome UI and the main process.
const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (cb) => {
  const handler = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('browser', {
  // tabs
  newTab: (url) => ipcRenderer.send('tab:new', url),
  closeTab: (id) => ipcRenderer.send('tab:close', id),
  activateTab: (id) => ipcRenderer.send('tab:activate', id),
  requestTabs: () => ipcRenderer.send('tabs:request'),
  onTabState: on('tab:state'),
  onTabsAll: on('tabs:all'),

  // navigation
  go: (input) => ipcRenderer.send('nav:go', input),
  back: () => ipcRenderer.send('nav:back'),
  forward: () => ipcRenderer.send('nav:forward'),
  reload: () => ipcRenderer.send('nav:reload'),
  stop: () => ipcRenderer.send('nav:stop'),
  home: () => ipcRenderer.send('nav:home'),

  // bookmarks
  toggleBookmark: () => ipcRenderer.send('bookmark:toggle'),
  removeBookmark: (url) => ipcRenderer.send('bookmark:remove', url),
  requestBookmarks: () => ipcRenderer.send('bookmarks:request'),
  onBookmarks: on('bookmarks:all'),

  // history
  getHistory: (query) => ipcRenderer.invoke('history:get', query),
  clearHistory: () => ipcRenderer.send('history:clear'),

  // find in page
  findStart: (opts) => ipcRenderer.send('find:start', opts),
  findStop: () => ipcRenderer.send('find:stop'),
  onFindResult: on('find:result'),

  // misc
  reserve: (px) => ipcRenderer.send('ui:reserve', px),
  zoom: (dir) => ipcRenderer.send('zoom', dir),
  toggleDevTools: () => ipcRenderer.send('devtools:toggle'),
  onDownload: on('download:update'),
  onShortcut: on('ui:shortcut'),
});
