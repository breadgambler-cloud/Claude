// LOL Browser — chrome UI logic (tab strip, omnibox, bookmarks, panels).
/* global browser */
const $ = (id) => document.getElementById(id);

const tabsEl = $('tabs');
const omnibox = $('omnibox');
const star = $('star');
const suggestionsEl = $('suggestions');
const bookmarksBar = $('bookmarksbar');
const panel = $('panel');
const panelTitle = $('panel-title');
const panelBody = $('panel-body');
const panelClear = $('panel-clear');
const findbar = $('findbar');
const findinput = $('findinput');
const findcount = $('findcount');

let tabs = [];
let activeTabId = null;
let bookmarks = [];
let downloads = new Map();
let omniboxFocused = false;
let sugIndex = -1;
let panelMode = null; // null | 'history' | 'downloads'

// ---------- tabs ----------

function renderTabs() {
  tabsEl.textContent = '';
  for (const t of tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (t.id === activeTabId ? ' active' : '');
    el.title = t.title;

    if (t.loading) {
      const sp = document.createElement('div');
      sp.className = 'spinner';
      el.appendChild(sp);
    } else if (t.favicon) {
      const img = document.createElement('img');
      img.className = 'favicon';
      img.src = t.favicon;
      img.onerror = () => img.remove();
      el.appendChild(img);
    }

    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = t.title || 'New Tab';
    el.appendChild(title);

    const close = document.createElement('span');
    close.className = 'close';
    close.textContent = '✕';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      browser.closeTab(t.id);
    });
    el.appendChild(close);

    el.addEventListener('click', () => browser.activateTab(t.id));
    el.addEventListener('auxclick', (e) => {
      if (e.button === 1) browser.closeTab(t.id);
    });
    tabsEl.appendChild(el);
  }
}

function syncActiveUI() {
  const t = tabs.find((x) => x.id === activeTabId);
  if (!t) return;
  if (!omniboxFocused) omnibox.value = t.url === 'about:blank' ? '' : t.url;
  $('back').disabled = !t.canGoBack;
  $('forward').disabled = !t.canGoForward;
  $('reload').innerHTML = t.loading ? '&#10005;' : '&#8635;';
  $('reload').title = t.loading ? 'Stop' : 'Reload (Ctrl+R)';
  star.textContent = t.bookmarked ? '★' : '☆';
  star.classList.toggle('bookmarked', !!t.bookmarked);
  document.title = (t.title ? t.title + ' - ' : '') + 'LOL Browser';
}

browser.onTabsAll(({ tabs: all, activeTabId: active }) => {
  tabs = all;
  activeTabId = active;
  renderTabs();
  syncActiveUI();
});

browser.onTabState((state) => {
  const i = tabs.findIndex((t) => t.id === state.id);
  if (i >= 0) tabs[i] = state;
  else tabs.push(state);
  renderTabs();
  if (state.id === activeTabId) syncActiveUI();
});

// ---------- toolbar ----------

$('back').addEventListener('click', () => browser.back());
$('forward').addEventListener('click', () => browser.forward());
$('reload').addEventListener('click', () => {
  const t = tabs.find((x) => x.id === activeTabId);
  if (t && t.loading) browser.stop();
  else browser.reload();
});
$('home').addEventListener('click', () => browser.home());
$('newtab').addEventListener('click', () => browser.newTab());
star.addEventListener('click', () => browser.toggleBookmark());
$('historybtn').addEventListener('click', () => togglePanel('history'));
$('downloadsbtn').addEventListener('click', () => togglePanel('downloads'));

// ---------- omnibox + suggestions ----------

function hideSuggestions() {
  suggestionsEl.classList.add('hidden');
  suggestionsEl.textContent = '';
  sugIndex = -1;
  if (!panelMode) browser.reserve(0);
}

async function showSuggestions(query) {
  const q = query.trim();
  const items = [];
  if (q) {
    items.push({ kind: 'search', title: q, url: 'https://www.google.com/search?q=' + encodeURIComponent(q), label: 'Google Search' });
  }
  const hist = await browser.getHistory(q);
  const seen = new Set();
  for (const h of hist) {
    if (seen.has(h.url)) continue;
    seen.add(h.url);
    items.push({ kind: 'history', title: h.title, url: h.url });
    if (items.length >= 8) break;
  }
  for (const b of bookmarks) {
    if (items.length >= 10) break;
    if (seen.has(b.url)) continue;
    if (!q || b.url.toLowerCase().includes(q.toLowerCase()) || (b.title || '').toLowerCase().includes(q.toLowerCase())) {
      seen.add(b.url);
      items.push({ kind: 'bookmark', title: b.title, url: b.url });
    }
  }

  suggestionsEl.textContent = '';
  if (!items.length) return hideSuggestions();

  items.forEach((it, idx) => {
    const el = document.createElement('div');
    el.className = 'sug';
    el.dataset.url = it.kind === 'search' ? it.title : it.url;

    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = it.kind === 'search' ? '\u{1F50D}' : it.kind === 'bookmark' ? '★' : '\u{1F553}';
    el.appendChild(icon);

    const t = document.createElement('span');
    t.className = 't';
    t.textContent = it.title || it.url;
    el.appendChild(t);

    const u = document.createElement('span');
    u.className = 'u';
    u.textContent = it.kind === 'search' ? (it.label || '') : it.url;
    el.appendChild(u);

    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      navigateTo(el.dataset.url);
    });
    el.dataset.index = idx;
    suggestionsEl.appendChild(el);
  });

  suggestionsEl.classList.remove('hidden');
  if (!panelMode) browser.reserve(Math.min(300, suggestionsEl.scrollHeight));
}

function navigateTo(input) {
  hideSuggestions();
  omnibox.blur();
  browser.go(input);
}

omnibox.addEventListener('focus', () => {
  omniboxFocused = true;
  omnibox.select();
});
omnibox.addEventListener('blur', () => {
  omniboxFocused = false;
  setTimeout(hideSuggestions, 100);
  syncActiveUI();
});
omnibox.addEventListener('input', () => showSuggestions(omnibox.value));
omnibox.addEventListener('keydown', (e) => {
  const sugs = [...suggestionsEl.children];
  if (e.key === 'Enter') {
    if (sugIndex >= 0 && sugs[sugIndex]) navigateTo(sugs[sugIndex].dataset.url);
    else navigateTo(omnibox.value);
  } else if (e.key === 'Escape') {
    hideSuggestions();
    omnibox.blur();
    syncActiveUI();
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!sugs.length) return;
    sugIndex = e.key === 'ArrowDown' ? (sugIndex + 1) % sugs.length : (sugIndex - 1 + sugs.length) % sugs.length;
    sugs.forEach((s, i) => s.classList.toggle('selected', i === sugIndex));
  }
});

// ---------- bookmarks bar ----------

function renderBookmarks() {
  bookmarksBar.textContent = '';
  if (!bookmarks.length) {
    const hint = document.createElement('span');
    hint.className = 'empty';
    hint.textContent = 'Bookmark pages with the ☆ button and they show up here';
    bookmarksBar.appendChild(hint);
    return;
  }
  for (const b of bookmarks) {
    const el = document.createElement('div');
    el.className = 'bm';
    el.title = b.url;

    const img = document.createElement('img');
    try {
      img.src = new URL('/favicon.ico', b.url).href;
    } catch { /* invalid URL, skip favicon */ }
    img.onerror = () => img.remove();
    el.appendChild(img);

    const span = document.createElement('span');
    span.textContent = b.title || b.url;
    el.appendChild(span);

    el.addEventListener('click', () => browser.go(b.url));
    el.addEventListener('auxclick', (e) => {
      if (e.button === 1) browser.newTab(b.url);
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (confirm('Remove bookmark "' + (b.title || b.url) + '"?')) browser.removeBookmark(b.url);
    });
    bookmarksBar.appendChild(el);
  }
}

browser.onBookmarks((list) => {
  bookmarks = list;
  renderBookmarks();
  syncActiveUI();
});

// ---------- history / downloads panel ----------

function closePanel() {
  panelMode = null;
  panel.classList.add('hidden');
  browser.reserve(0);
}

async function togglePanel(mode) {
  if (panelMode === mode) return closePanel();
  panelMode = mode;
  panel.classList.remove('hidden');
  browser.reserve(-1);
  panelClear.classList.toggle('hidden', mode !== 'history');
  panelTitle.textContent = mode === 'history' ? 'History' : 'Downloads';
  renderPanel(mode === 'history' ? await browser.getHistory('') : null);
}

function renderPanel(historyItems) {
  panelBody.textContent = '';
  if (panelMode === 'history') {
    if (!historyItems || !historyItems.length) {
      panelBody.innerHTML = '<div class="panel-empty">No history yet</div>';
      return;
    }
    for (const h of historyItems) {
      const row = document.createElement('div');
      row.className = 'row';
      const time = document.createElement('span');
      time.className = 'time';
      time.textContent = new Date(h.time).toLocaleString();
      const t = document.createElement('span');
      t.className = 't';
      t.textContent = h.title || h.url;
      const u = document.createElement('span');
      u.className = 'u';
      u.textContent = h.url;
      row.append(time, t, u);
      row.addEventListener('click', () => {
        closePanel();
        browser.go(h.url);
      });
      panelBody.appendChild(row);
    }
  } else if (panelMode === 'downloads') {
    if (!downloads.size) {
      panelBody.innerHTML = '<div class="panel-empty">No downloads this session</div>';
      return;
    }
    for (const d of [...downloads.values()].reverse()) {
      const row = document.createElement('div');
      row.className = 'row';
      const t = document.createElement('span');
      t.className = 't';
      t.textContent = d.filename;
      const u = document.createElement('span');
      u.className = 'u';
      const pct = d.total ? Math.round((d.received / d.total) * 100) + '%' : '';
      u.textContent = d.state === 'completed' ? 'Done — ' + d.path : d.state + ' ' + pct;
      row.append(t, u);
      panelBody.appendChild(row);
    }
  }
}

panelClear.addEventListener('click', () => {
  if (confirm('Clear all browsing history?')) {
    browser.clearHistory();
    renderPanel([]);
  }
});
$('panel-close').addEventListener('click', closePanel);

browser.onDownload((d) => {
  downloads.set(d.filename, d);
  if (panelMode === 'downloads') renderPanel();
});

// ---------- find in page ----------

function openFind() {
  findbar.classList.remove('hidden');
  findinput.focus();
  findinput.select();
}
function closeFind() {
  findbar.classList.add('hidden');
  findcount.textContent = '';
  browser.findStop();
}
findinput.addEventListener('input', () => {
  if (findinput.value) browser.findStart({ text: findinput.value });
  else browser.findStop();
});
findinput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') browser.findStart({ text: findinput.value, forward: !e.shiftKey, findNext: true });
  if (e.key === 'Escape') closeFind();
});
$('findnext').addEventListener('click', () => browser.findStart({ text: findinput.value, forward: true, findNext: true }));
$('findprev').addEventListener('click', () => browser.findStart({ text: findinput.value, forward: false, findNext: true }));
$('findclose').addEventListener('click', closeFind);
browser.onFindResult(({ activeMatchOrdinal, matches }) => {
  findcount.textContent = matches ? activeMatchOrdinal + '/' + matches : '0/0';
});

// ---------- keyboard shortcuts ----------

window.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key === 't') { e.preventDefault(); browser.newTab(); }
  else if (ctrl && e.key === 'w') { e.preventDefault(); if (activeTabId != null) browser.closeTab(activeTabId); }
  else if (ctrl && e.key === 'l') { e.preventDefault(); omnibox.focus(); }
  else if (ctrl && e.key === 'r') { e.preventDefault(); browser.reload(); }
  else if (ctrl && e.key === 'd') { e.preventDefault(); browser.toggleBookmark(); }
  else if (ctrl && e.key === 'h') { e.preventDefault(); togglePanel('history'); }
  else if (ctrl && e.key === 'j') { e.preventDefault(); togglePanel('downloads'); }
  else if (ctrl && e.key === 'f') { e.preventDefault(); openFind(); }
  else if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); browser.zoom(1); }
  else if (ctrl && e.key === '-') { e.preventDefault(); browser.zoom(-1); }
  else if (ctrl && e.key === '0') { e.preventDefault(); browser.zoom(0); }
  else if (ctrl && e.key === 'Tab') {
    e.preventDefault();
    if (!tabs.length) return;
    const i = tabs.findIndex((t) => t.id === activeTabId);
    const next = e.shiftKey ? (i - 1 + tabs.length) % tabs.length : (i + 1) % tabs.length;
    browser.activateTab(tabs[next].id);
  }
  else if (e.key === 'F12') { e.preventDefault(); browser.toggleDevTools(); }
  else if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); browser.back(); }
  else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); browser.forward(); }
  else if (e.key === 'Escape' && panelMode) closePanel();
});

// Shortcuts forwarded from the main process when the page had focus.
browser.onShortcut((key) => {
  if (key === 'l') omnibox.focus();
  else if (key === 'd') browser.toggleBookmark();
  else if (key === 'h') togglePanel('history');
  else if (key === 'j') togglePanel('downloads');
  else if (key === 'f') openFind();
});

// ---------- init ----------

browser.requestTabs();
browser.requestBookmarks();
