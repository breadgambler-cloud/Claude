# LOL Browser 🌐

A fully working tabbed web browser you can run on your own computer. It's built on
**Electron**, which embeds the real **Chromium engine** — the same engine Chrome uses —
so every website works exactly like it does in Chrome, including:

- ✅ **Google account sign-in** — log into Gmail, YouTube, Drive, Docs, etc. Your login
  is saved on disk, so you stay signed in after closing the browser (just like Chrome).
- ✅ **Tabs** — open, close, and switch between as many tabs as you want.
- ✅ **Bookmarks** — star any page (`Ctrl+D` or the ☆ button) and it appears on the
  bookmarks bar. Right-click a bookmark to remove it. Saved permanently.
- ✅ **History** — every page you visit is remembered, searchable from the address bar,
  and browsable from the History panel (`Ctrl+H`). Clearable too.
- ✅ **Smart address bar (omnibox)** — type a URL to go there, or type anything else to
  search Google. Shows suggestions from your history and bookmarks as you type.
- ✅ **Downloads** — files download to your Downloads folder with a progress panel (`Ctrl+J`).
- ✅ **Find in page** (`Ctrl+F`), **zoom** (`Ctrl` `+`/`-`/`0`), **right-click menus**
  (open link in new tab, copy, search selection, inspect), and **DevTools** (`F12`).

## How to run it

You need [Node.js](https://nodejs.org) installed (version 18 or newer). Then:

```bash
git clone https://github.com/breadgambler-cloud/claude.git
cd claude
npm install
npm start
```

That's it — a browser window opens on Google, ready to use.

> On some Linux setups Electron's sandbox needs an extra kernel setting; if the window
> doesn't open, try `npm run start:linux-sandboxless` instead.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+T` | New tab |
| `Ctrl+W` | Close tab |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Next / previous tab |
| `Ctrl+L` | Focus the address bar |
| `Ctrl+R` | Reload (click again while loading to stop) |
| `Ctrl+D` | Bookmark the current page |
| `Ctrl+H` | History panel |
| `Ctrl+J` | Downloads panel |
| `Ctrl+F` | Find in page |
| `Ctrl +` / `Ctrl -` / `Ctrl 0` | Zoom in / out / reset |
| `Alt+←` / `Alt+→` | Back / forward |
| `F12` | Developer tools |

On macOS use `Cmd` instead of `Ctrl`.

## Where your data lives

Logins/cookies, bookmarks (`bookmarks.json`), and history (`history.json`) are stored in
Electron's per-app user data folder (e.g. `~/.config/lol-browser` on Linux,
`%APPDATA%/lol-browser` on Windows, `~/Library/Application Support/lol-browser` on macOS).
Delete that folder to reset the browser completely.

## How it works (for the curious)

- `main.js` — the browser core. Each tab is a Chromium `WebContentsView` placed below the
  toolbar. All tabs share one persistent session partition (`persist:main`), which is what
  keeps you signed into Google between runs. The user agent is cleaned up so Google's
  sign-in page treats it as regular Chrome.
- `preload.js` — a small, safe bridge between the UI and the browser core (no Node access
  is ever exposed to web pages).
- `ui/` — the browser's own interface: tab strip, toolbar, omnibox with suggestions,
  bookmarks bar, and the history/downloads panels.
