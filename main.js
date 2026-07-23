// LOL Browser — main process.
// A real tabbed browser: each tab is a Chromium WebContentsView attached to the
// window below the toolbar UI. The "persist:main" session keeps cookies and
// site data on disk, so Google (and any other) account logins survive restarts.

const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  session,
  Menu,
  shell,
  clipboard,
} = require('electron');
const path = require('path');
const fs = require('fs');

const CHROME_HEIGHT = 96; // px reserved at the top for tab strip + toolbar + bookmarks bar
const HOME_URL = 'https://www.google.com';
const PARTITION = 'persist:main';

// Google blocks OAuth/sign-in from user agents it thinks are embedded shells.
// Present as plain Chrome (which is what the engine actually is).
const stripUA = (ua) =>
  ua
    .replace(/\sElectron\/[\d.]+/i, '')
    .replace(new RegExp('\\s' + app.getName().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/[\\d.]+', 'i'), '')
    .replace(/\slol-browser\/[\d.]+/i, '');

const userDataFile = (name) => path.join(app.getPath('userData'), name);

function loadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveJson(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to save', file, err);
  }
}

class Browser {
  constructor() {
    this.win = null;
    this.tabs = new Map(); // id -> { id, view }
    this.tabOrder = [];
    this.activeTabId = null;
    this.nextTabId = 1;
    this.bookmarks = loadJson(userDataFile('bookmarks.json'), []);
    this.history = loadJson(userDataFile('history.json'), []);
    // Extra pixels the UI reserves below the toolbar (suggestion dropdown),
    // or -1 when a full-screen panel (history/downloads) covers the page.
    this.reservedPx = 0;
  }

  createWindow() {
    this.win = new BrowserWindow({
      width: 1280,
      height: 840,
      minWidth: 500,
      minHeight: 300,
      backgroundColor: '#202124',
      title: 'LOL Browser',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.win.loadFile(path.join(__dirname, 'ui', 'index.html'));

    this.win.on('resize', () => this.layout());
    this.win.on('maximize', () => this.layout());
    this.win.on('unmaximize', () => this.layout());
    this.win.on('enter-full-screen', () => this.layout());
    this.win.on('leave-full-screen', () => this.layout());
    this.win.on('closed', () => {
      this.win = null;
      this.tabs.clear();
    });

    this.win.webContents.on('did-finish-load', () => {
      if (this.tabs.size === 0) this.newTab(HOME_URL);
      this.pushBookmarks();
    });
  }

  ses() {
    return session.fromPartition(PARTITION);
  }

  layout() {
    if (!this.win) return;
    const [w, h] = this.win.getContentSize();
    const top = CHROME_HEIGHT + Math.max(0, this.reservedPx);
    for (const id of this.tabOrder) {
      const tab = this.tabs.get(id);
      if (!tab) continue;
      if (id === this.activeTabId && this.reservedPx >= 0) {
        tab.view.setBounds({ x: 0, y: top, width: w, height: Math.max(0, h - top) });
        tab.view.setVisible(true);
      } else {
        tab.view.setVisible(false);
      }
    }
  }

  newTab(url = HOME_URL, activate = true) {
    if (!this.win) return null;
    const id = this.nextTabId++;
    const view = new WebContentsView({
      webPreferences: {
        partition: PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    const tab = { id, view };
    this.tabs.set(id, tab);
    this.tabOrder.push(id);
    this.win.contentView.addChildView(view);

    const wc = view.webContents;
    wc.setWindowOpenHandler(({ url: target }) => {
      // Open popups/target=_blank as new tabs, but let real OAuth popups
      // (accounts.google.com sign-in flows) open as actual windows so the
      // opener relationship works.
      if (/^https:\/\/accounts\.google\.com\//.test(target)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 480,
            height: 640,
            webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true },
          },
        };
      }
      this.newTab(target, true);
      return { action: 'deny' };
    });

    const sendState = () => this.pushTabState(id);
    wc.on('page-title-updated', sendState);
    wc.on('did-start-loading', sendState);
    wc.on('did-stop-loading', sendState);
    wc.on('did-navigate', (_e, navUrl) => {
      this.recordHistory(navUrl, wc.getTitle());
      sendState();
    });
    wc.on('did-navigate-in-page', (_e, navUrl, isMain) => {
      if (isMain) this.recordHistory(navUrl, wc.getTitle());
      sendState();
    });
    wc.on('page-favicon-updated', (_e, favicons) => {
      tab.favicon = favicons && favicons.length ? favicons[favicons.length - 1] : null;
      sendState();
    });
    wc.on('context-menu', (_e, params) => this.showContextMenu(wc, params));
    wc.on('before-input-event', (e, input) => {
      if (input.type !== 'keyDown') return;
      if (this.handleShortcut(input, wc)) e.preventDefault();
    });
    wc.on('found-in-page', (_e, result) => {
      this.sendToUI('find:result', { tabId: id, matches: result.matches, activeMatchOrdinal: result.activeMatchOrdinal });
    });

    wc.loadURL(url).catch(() => {});
    if (activate) this.activateTab(id);
    else this.pushTabState(id);
    return id;
  }

  activateTab(id) {
    if (!this.tabs.has(id)) return;
    this.activeTabId = id;
    this.layout();
    this.pushAllTabs();
  }

  closeTab(id) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    this.win.contentView.removeChildView(tab.view);
    tab.view.webContents.close();
    this.tabs.delete(id);
    this.tabOrder = this.tabOrder.filter((t) => t !== id);
    if (this.activeTabId === id) {
      this.activeTabId = this.tabOrder[this.tabOrder.length - 1] ?? null;
    }
    if (this.tabOrder.length === 0) {
      this.newTab(HOME_URL);
    } else {
      this.layout();
      this.pushAllTabs();
    }
  }

  activeTab() {
    return this.tabs.get(this.activeTabId) || null;
  }

  tabState(id) {
    const tab = this.tabs.get(id);
    if (!tab) return null;
    const wc = tab.view.webContents;
    const url = wc.getURL();
    return {
      id,
      url,
      title: wc.getTitle() || url || 'New Tab',
      loading: wc.isLoading(),
      canGoBack: wc.navigationHistory.canGoBack(),
      canGoForward: wc.navigationHistory.canGoForward(),
      favicon: tab.favicon || null,
      active: id === this.activeTabId,
      bookmarked: this.bookmarks.some((b) => b.url === url),
    };
  }

  pushTabState(id) {
    const state = this.tabState(id);
    if (state) this.sendToUI('tab:state', state);
  }

  pushAllTabs() {
    this.sendToUI('tabs:all', {
      tabs: this.tabOrder.map((id) => this.tabState(id)).filter(Boolean),
      activeTabId: this.activeTabId,
    });
  }

  pushBookmarks() {
    this.sendToUI('bookmarks:all', this.bookmarks);
    const tab = this.activeTab();
    if (tab) this.pushTabState(tab.id);
  }

  sendToUI(channel, payload) {
    if (this.win && !this.win.isDestroyed()) this.win.webContents.send(channel, payload);
  }

  recordHistory(url, title) {
    if (!url || url === 'about:blank') return;
    this.history.unshift({ url, title: title || url, time: Date.now() });
    if (this.history.length > 5000) this.history.length = 5000;
    saveJson(userDataFile('history.json'), this.history);
  }

  toggleBookmark(url, title) {
    if (!url) return;
    const idx = this.bookmarks.findIndex((b) => b.url === url);
    if (idx >= 0) this.bookmarks.splice(idx, 1);
    else this.bookmarks.push({ url, title: title || url, added: Date.now() });
    saveJson(userDataFile('bookmarks.json'), this.bookmarks);
    this.pushBookmarks();
  }

  removeBookmark(url) {
    this.bookmarks = this.bookmarks.filter((b) => b.url !== url);
    saveJson(userDataFile('bookmarks.json'), this.bookmarks);
    this.pushBookmarks();
  }

  // Shortcuts that must work even when the page (not the toolbar) has focus.
  // Returns true when the key was handled and should not reach the page.
  handleShortcut(input, wc) {
    const ctrl = input.control || input.meta;
    const key = input.key.toLowerCase();
    if (ctrl && key === 't') return this.newTab(HOME_URL, true), true;
    if (ctrl && key === 'w') return this.closeTab(this.activeTabId), true;
    if (ctrl && key === 'r') return wc.reload(), true;
    if (ctrl && (key === 'l' || key === 'd' || key === 'h' || key === 'j' || key === 'f')) {
      this.win.webContents.focus();
      this.sendToUI('ui:shortcut', key);
      return true;
    }
    if (ctrl && key === 'tab') {
      const i = this.tabOrder.indexOf(this.activeTabId);
      if (i >= 0 && this.tabOrder.length > 1) {
        const next = input.shift
          ? (i - 1 + this.tabOrder.length) % this.tabOrder.length
          : (i + 1) % this.tabOrder.length;
        this.activateTab(this.tabOrder[next]);
      }
      return true;
    }
    if (input.key === 'F12') return wc.toggleDevTools(), true;
    if (input.alt && input.key === 'ArrowLeft' && wc.navigationHistory.canGoBack()) return wc.navigationHistory.goBack(), true;
    if (input.alt && input.key === 'ArrowRight' && wc.navigationHistory.canGoForward()) return wc.navigationHistory.goForward(), true;
    return false;
  }

  showContextMenu(wc, params) {
    const template = [];
    if (params.linkURL) {
      template.push(
        { label: 'Open link in new tab', click: () => this.newTab(params.linkURL, true) },
        { label: 'Copy link address', click: () => clipboard.writeText(params.linkURL) },
        { type: 'separator' }
      );
    }
    if (params.selectionText) {
      template.push(
        { role: 'copy' },
        {
          label: `Search Google for “${params.selectionText.slice(0, 30)}”`,
          click: () => this.newTab('https://www.google.com/search?q=' + encodeURIComponent(params.selectionText), true),
        },
        { type: 'separator' }
      );
    }
    if (params.isEditable) {
      template.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { type: 'separator' });
    }
    if (params.mediaType === 'image' && params.srcURL) {
      template.push(
        { label: 'Open image in new tab', click: () => this.newTab(params.srcURL, true) },
        { label: 'Copy image address', click: () => clipboard.writeText(params.srcURL) },
        { type: 'separator' }
      );
    }
    template.push(
      { label: 'Back', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
      { label: 'Forward', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
      { label: 'Reload', click: () => wc.reload() },
      { type: 'separator' },
      { label: 'Inspect', click: () => wc.inspectElement(params.x, params.y) }
    );
    Menu.buildFromTemplate(template).popup({ window: this.win });
  }
}

// Turn address-bar input into a URL: URLs load directly, everything else
// becomes a Google search.
function resolveInput(input) {
  const text = String(input || '').trim();
  if (!text) return HOME_URL;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(text)) return text;
  if (/^about:|^chrome:|^file:/.test(text)) return text;
  if (/^[^\s]+\.[^\s]{2,}(\/.*)?$/.test(text) && !text.includes(' ')) return 'https://' + text;
  if (/^localhost(:\d+)?(\/.*)?$/.test(text)) return 'http://' + text;
  return 'https://www.google.com/search?q=' + encodeURIComponent(text);
}

const browser = new Browser();

function registerIpc() {
  ipcMain.on('tab:new', (_e, url) => browser.newTab(url ? resolveInput(url) : HOME_URL, true));
  ipcMain.on('tab:close', (_e, id) => browser.closeTab(id));
  ipcMain.on('tab:activate', (_e, id) => browser.activateTab(id));
  ipcMain.on('tabs:request', () => browser.pushAllTabs());

  ipcMain.on('nav:go', (_e, input) => {
    const tab = browser.activeTab();
    if (tab) tab.view.webContents.loadURL(resolveInput(input)).catch(() => {});
  });
  ipcMain.on('nav:back', () => {
    const tab = browser.activeTab();
    if (tab && tab.view.webContents.navigationHistory.canGoBack()) tab.view.webContents.navigationHistory.goBack();
  });
  ipcMain.on('nav:forward', () => {
    const tab = browser.activeTab();
    if (tab && tab.view.webContents.navigationHistory.canGoForward()) tab.view.webContents.navigationHistory.goForward();
  });
  ipcMain.on('nav:reload', () => {
    const tab = browser.activeTab();
    if (tab) tab.view.webContents.reload();
  });
  ipcMain.on('nav:stop', () => {
    const tab = browser.activeTab();
    if (tab) tab.view.webContents.stop();
  });
  ipcMain.on('nav:home', () => {
    const tab = browser.activeTab();
    if (tab) tab.view.webContents.loadURL(HOME_URL);
  });

  ipcMain.on('bookmark:toggle', () => {
    const tab = browser.activeTab();
    if (tab) browser.toggleBookmark(tab.view.webContents.getURL(), tab.view.webContents.getTitle());
  });
  ipcMain.on('bookmark:remove', (_e, url) => browser.removeBookmark(url));
  ipcMain.on('bookmarks:request', () => browser.pushBookmarks());

  ipcMain.handle('history:get', (_e, query) => {
    const q = String(query || '').toLowerCase();
    const items = q
      ? browser.history.filter((h) => h.url.toLowerCase().includes(q) || (h.title || '').toLowerCase().includes(q))
      : browser.history;
    return items.slice(0, 200);
  });
  ipcMain.on('history:clear', () => {
    browser.history = [];
    saveJson(userDataFile('history.json'), browser.history);
  });

  ipcMain.on('find:start', (_e, { text, forward, findNext }) => {
    const tab = browser.activeTab();
    if (tab && text) tab.view.webContents.findInPage(text, { forward: forward !== false, findNext: !!findNext });
  });
  ipcMain.on('find:stop', () => {
    const tab = browser.activeTab();
    if (tab) tab.view.webContents.stopFindInPage('clearSelection');
  });

  ipcMain.on('zoom', (_e, dir) => {
    const tab = browser.activeTab();
    if (!tab) return;
    const wc = tab.view.webContents;
    if (dir === 0) wc.setZoomLevel(0);
    else wc.setZoomLevel(wc.getZoomLevel() + (dir > 0 ? 0.5 : -0.5));
  });

  ipcMain.on('devtools:toggle', () => {
    const tab = browser.activeTab();
    if (tab) tab.view.webContents.toggleDevTools();
  });

  // UI reserves space below the toolbar: px > 0 pushes the page down
  // (suggestion dropdown), -1 hides the page (full-screen panel), 0 restores.
  ipcMain.on('ui:reserve', (_e, px) => {
    browser.reservedPx = typeof px === 'number' ? px : 0;
    browser.layout();
  });
}

function setupSession() {
  const ses = browser.ses();

  // Downloads: save to the user's Downloads folder and report progress.
  ses.on('will-download', (_e, item) => {
    const target = path.join(app.getPath('downloads'), item.getFilename());
    item.setSavePath(target);
    const send = (state) =>
      browser.sendToUI('download:update', {
        filename: item.getFilename(),
        state,
        received: item.getReceivedBytes(),
        total: item.getTotalBytes(),
        path: target,
      });
    item.on('updated', (_ev, state) => send(state));
    item.once('done', (_ev, state) => {
      send(state);
      if (state === 'completed') shell.showItemInFolder(target);
    });
  });

  // Permission prompts: allow the common, safe ones; deny the rest quietly.
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    const allowed = ['clipboard-sanitized-write', 'fullscreen', 'notifications', 'media'];
    callback(allowed.includes(permission));
  });
}

app.whenReady().then(() => {
  app.userAgentFallback = stripUA(app.userAgentFallback);
  setupSession();
  registerIpc();
  browser.createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) browser.createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
