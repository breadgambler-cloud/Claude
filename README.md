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

## How to get it — just download and run (no setup)

You don't need to install anything or touch a terminal. GitHub builds the app for you
automatically and puts ready-to-run files on the **Releases** page:

1. Go to the repo's **[Releases](../../releases)** page.
2. Open the release named **"LOL Browser (latest build)"**.
3. Download the file for your system and run it:
   - **Windows** — the `.exe` (the `Setup` one installs it; the `portable` one runs with no install)
   - **macOS** — the `.dmg` (open it, drag the app into Applications)
   - **Linux** — the `.AppImage` (make it executable, then double-click) or the `.deb`

That's it — the browser opens on Google, ready to use, with real Google sign-in.

> The builds aren't code-signed, so the first launch may show a Windows SmartScreen or
> macOS Gatekeeper warning — choose **"Run anyway" / "Open"**. Everything (logins,
> bookmarks, history) is stored locally on your own computer.

The build runs automatically whenever the code changes (see the **Actions** tab). If no
release exists yet, open the **Actions** tab, wait for the latest "Build LOL Browser" run
to finish, and the Releases page will populate.

## Alternative: run from source

If you'd rather run it yourself with [Node.js](https://nodejs.org) (18+):

```bash
git clone https://github.com/breadgambler-cloud/claude.git
cd claude
npm install
npm start
```

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
