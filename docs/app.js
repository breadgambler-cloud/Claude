/* LOL Browser — web edition.
   A launcher/browser that runs from a single link on any device (iPhone,
   Chromebook, desktop). It has an address bar + Google search, bookmarks and
   history stored on the device, and an in-page viewer for sites that allow
   embedding. Sites that block embedding (Google, YouTube, etc.) open in a real
   browser tab — a web page cannot embed those, so this is the honest behavior. */

const $ = (id) => document.getElementById(id);

const el = {
  omniForm: $('omniForm'), omni: $('omni'), star: $('starBtn'),
  back: $('backBtn'), fwd: $('fwdBtn'), home: $('homeBtn'), menu: $('menuBtn'),
  install: $('installBtn'),
  searchForm: $('searchForm'), search: $('search'),
  apps: $('apps'), bookmarks: $('bookmarks'), history: $('history'),
  addBookmark: $('addBookmark'), clearHistory: $('clearHistory'),
  homeView: $('home'), viewer: $('viewer'), frame: $('frame'),
  blocked: $('blocked'), blockedName: $('blockedName'),
  openTab: $('openTab'), backHome: $('backHome'),
  drawer: $('drawer'), iosNote: $('iosNote'),
};

// ---------- storage ----------
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
};

let bookmarks = store.get('bookmarks', [
  { name: 'YouTube', url: 'https://www.youtube.com' },
  { name: 'Wikipedia', url: 'https://www.wikipedia.org' },
  { name: 'Reddit', url: 'https://www.reddit.com' },
]);
let history = store.get('history', []);

const GOOGLE_APPS = [
  { name: 'Search', url: 'https://www.google.com', color: '#4285f4', glyph: 'G' },
  { name: 'Gmail', url: 'https://mail.google.com', color: '#ea4335', glyph: 'M' },
  { name: 'YouTube', url: 'https://www.youtube.com', color: '#ff0000', glyph: '▶' },
  { name: 'Drive', url: 'https://drive.google.com', color: '#1fa463', glyph: '△' },
  { name: 'Docs', url: 'https://docs.google.com', color: '#4285f4', glyph: '≡' },
  { name: 'Maps', url: 'https://maps.google.com', color: '#34a853', glyph: '⚑' },
  { name: 'Photos', url: 'https://photos.google.com', color: '#fbbc05', glyph: '❋' },
  { name: 'Calendar', url: 'https://calendar.google.com', color: '#4285f4', glyph: '▦' },
  { name: 'Translate', url: 'https://translate.google.com', color: '#4285f4', glyph: '文' },
  { name: 'News', url: 'https://news.google.com', color: '#ea4335', glyph: '❐' },
];

// ---------- input resolution ----------
function resolveInput(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[^\s]+\.[^\s]{2,}(\/.*)?$/.test(t) && !t.includes(' ')) return 'https://' + t;
  return 'https://www.google.com/search?q=' + encodeURIComponent(t);
}

// A pragmatic list of hosts known to block embedding — go straight to a new
// tab for these instead of showing an "it's blocked" flash.
const NO_EMBED = [
  'google.', 'youtube.', 'gmail.', 'accounts.google', 'mail.google',
  'facebook.', 'instagram.', 'twitter.', 'x.com', 'reddit.', 'amazon.',
  'apple.', 'microsoft.', 'live.com', 'netflix.', 'linkedin.', 'github.',
  'chase.', 'bankofamerica.', 'paypal.',
];
function likelyBlocksEmbed(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return NO_EMBED.some((n) => h.includes(n));
  } catch { return false; }
}

// ---------- navigation ----------
function openInNewTab(url) {
  addHistory(url);
  window.open(url, '_blank', 'noopener');
}

function navigate(url, { forceNewTab = false } = {}) {
  const target = resolveInput(url);
  if (!target) return;
  el.omni.value = target;
  updateStar(target);

  if (forceNewTab || likelyBlocksEmbed(target)) {
    // Show the viewer's "open in tab" screen so the action is obvious, and
    // also try to pop the tab immediately.
    showBlocked(target);
    openInNewTab(target);
    return;
  }

  // Try to embed; if it refuses to load, fall back to a new tab.
  addHistory(target);
  showViewer();
  el.blocked.classList.add('hidden');
  el.frame.classList.remove('hidden');
  let loaded = false;
  el.frame.onload = () => { loaded = true; };
  el.frame.src = target;
  clearTimeout(navigate._t);
  navigate._t = setTimeout(() => {
    if (!loaded) showBlocked(target);
  }, 3500);
}

function showViewer() {
  el.homeView.classList.add('hidden');
  el.viewer.classList.remove('hidden');
  el.back.disabled = false;
}
function showHome() {
  el.viewer.classList.add('hidden');
  el.homeView.classList.remove('hidden');
  el.frame.src = 'about:blank';
  el.back.disabled = true;
  el.omni.value = '';
  updateStar('');
  renderHistory();
}
function showBlocked(url) {
  showViewer();
  el.frame.classList.add('hidden');
  el.blocked.classList.remove('hidden');
  let host = url;
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
  el.blockedName.textContent =
    `“${host}” can't be shown inside this page — big sites like Google block embedding for security. ` +
    `It's opening in its own tab (tap below if it didn't).`;
  el.openTab.onclick = () => openInNewTab(url);
}

// ---------- bookmarks ----------
function faviconEl(item) {
  const wrap = document.createElement('div');
  wrap.className = 'fav';
  if (item.color) wrap.style.background = item.color;
  if (item.glyph) { wrap.textContent = item.glyph; return wrap; }
  try {
    const img = document.createElement('img');
    img.src = 'https://www.google.com/s2/favicons?sz=64&domain=' + new URL(item.url).hostname;
    img.alt = '';
    img.onerror = () => { img.remove(); wrap.textContent = (item.name || '?')[0].toUpperCase(); };
    wrap.style.background = '#5f6368';
    wrap.appendChild(img);
  } catch {
    wrap.textContent = (item.name || '?')[0].toUpperCase();
    wrap.style.background = '#5f6368';
  }
  return wrap;
}

function makeTile(item, { removable = false, onRemove } = {}) {
  const tile = document.createElement('div');
  tile.className = 'tile';
  tile.title = item.url;
  tile.appendChild(faviconEl(item));
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = item.name;
  tile.appendChild(name);
  tile.addEventListener('click', () => navigate(item.url));
  if (removable) {
    const rm = document.createElement('div');
    rm.className = 'rm';
    rm.textContent = '✕';
    rm.title = 'Remove';
    rm.addEventListener('click', (e) => { e.stopPropagation(); onRemove(); });
    tile.appendChild(rm);
  }
  return tile;
}

function renderApps() {
  el.apps.textContent = '';
  for (const a of GOOGLE_APPS) el.apps.appendChild(makeTile(a));
}

function renderBookmarks() {
  el.bookmarks.textContent = '';
  if (!bookmarks.length) {
    const e = document.createElement('div');
    e.className = 'empty';
    e.textContent = 'No bookmarks yet — tap “+ Add” or the ☆ in the address bar.';
    el.bookmarks.appendChild(e);
    return;
  }
  bookmarks.forEach((b, i) => {
    el.bookmarks.appendChild(makeTile(b, {
      removable: true,
      onRemove: () => { bookmarks.splice(i, 1); store.set('bookmarks', bookmarks); renderBookmarks(); },
    }));
  });
}

function isBookmarked(url) { return bookmarks.some((b) => b.url === url); }
function updateStar(url) {
  const on = url && isBookmarked(resolveInput(url) || url);
  el.star.textContent = on ? '★' : '☆';
  el.star.classList.toggle('on', !!on);
}
function toggleBookmark(url, name) {
  const target = resolveInput(url);
  if (!target) return;
  const i = bookmarks.findIndex((b) => b.url === target);
  if (i >= 0) bookmarks.splice(i, 1);
  else {
    let host = target;
    try { host = new URL(target).hostname.replace(/^www\./, ''); } catch {}
    bookmarks.push({ name: name || host, url: target });
  }
  store.set('bookmarks', bookmarks);
  renderBookmarks();
  updateStar(target);
}

// ---------- history ----------
function addHistory(url) {
  if (!url) return;
  let title = url;
  try { title = new URL(url).hostname.replace(/^www\./, '') + new URL(url).pathname; } catch {}
  history.unshift({ url, title, time: Date.now() });
  // de-dupe consecutive same-url
  history = history.filter((h, idx) => idx === 0 || h.url !== history[0].url || idx === history.findIndex((x) => x.url === h.url));
  if (history.length > 300) history.length = 300;
  store.set('history', history);
}
function renderHistory() {
  el.history.textContent = '';
  if (!history.length) {
    const e = document.createElement('div');
    e.className = 'empty';
    e.textContent = 'Pages you open will show up here.';
    el.history.appendChild(e);
    return;
  }
  history.slice(0, 20).forEach((h) => {
    const row = document.createElement('div');
    row.className = 'hrow';
    const t = document.createElement('div');
    t.className = 'ht';
    t.textContent = h.title || h.url;
    const u = document.createElement('div');
    u.className = 'hu';
    try { u.textContent = new URL(h.url).hostname.replace(/^www\./, ''); } catch { u.textContent = h.url; }
    row.append(t, u);
    row.addEventListener('click', () => navigate(h.url));
    el.history.appendChild(row);
  });
}

// ---------- events ----------
el.omniForm.addEventListener('submit', (e) => { e.preventDefault(); navigate(el.omni.value); el.omni.blur(); });
el.searchForm.addEventListener('submit', (e) => { e.preventDefault(); if (el.search.value.trim()) { navigate(el.search.value); el.search.value = ''; } });
el.star.addEventListener('click', () => toggleBookmark(el.omni.value));
el.home.addEventListener('click', showHome);
el.backHome.addEventListener('click', showHome);
el.back.addEventListener('click', showHome);
el.fwd.addEventListener('click', () => {});
el.openTab.addEventListener('click', () => openInNewTab(el.omni.value));

el.addBookmark.addEventListener('click', () => {
  const url = prompt('Add a bookmark — enter a web address:');
  if (!url) return;
  const name = prompt('Name for this bookmark:', (() => { try { return new URL(resolveInput(url)).hostname.replace(/^www\./, ''); } catch { return url; } })());
  if (name === null) return;
  bookmarks.push({ name: name || url, url: resolveInput(url) });
  store.set('bookmarks', bookmarks);
  renderBookmarks();
});

el.clearHistory.addEventListener('click', () => {
  if (confirm('Clear all history on this device?')) { history = []; store.set('history', history); renderHistory(); }
});

// drawer
function openDrawer() { el.drawer.classList.remove('hidden'); }
function closeDrawer() { el.drawer.classList.add('hidden'); }
el.menu.addEventListener('click', openDrawer);
el.drawer.addEventListener('click', (e) => { if (e.target === el.drawer) closeDrawer(); });
el.drawer.querySelectorAll('.drawer-item').forEach((b) => b.addEventListener('click', () => {
  const a = b.dataset.action;
  closeDrawer();
  if (a === 'home') showHome();
  else if (a === 'newtab') { const u = prompt('Open which web address in a new tab?'); if (u) openInNewTab(resolveInput(u)); }
  else if (a === 'install') doInstall();
  else if (a === 'clear') { if (confirm('Clear all history on this device?')) { history = []; store.set('history', history); renderHistory(); } }
}));

// ---------- PWA install ----------
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  el.install.classList.remove('hidden');
});
function doInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(() => { deferredPrompt = null; el.install.classList.add('hidden'); });
  } else {
    alert(isIOS()
      ? 'To install on iPhone/iPad:\n\n1. Tap the Share button (□↑) in Safari.\n2. Choose “Add to Home Screen”.\n\nIt then opens like a real app.'
      : 'To install: open your browser menu and choose “Install app” / “Add to Home screen”.');
  }
}
el.install.addEventListener('click', doInstall);
window.addEventListener('appinstalled', () => el.install.classList.add('hidden'));

function isIOS() {
  return /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
if (isIOS()) {
  el.iosNote.textContent = 'On iPhone/iPad: tap Share (□↑) → “Add to Home Screen” to install.';
}

// ---------- service worker (offline shell) ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// ---------- init ----------
renderApps();
renderBookmarks();
renderHistory();
updateStar('');

// Deep link: index.html?go=<url> opens straight into a site.
const params = new URLSearchParams(location.search);
if (params.get('go')) navigate(params.get('go'));
