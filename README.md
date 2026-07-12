# Vauldy Desktop

Desktop client for [Vauldy](https://github.com/knoxmedia/Vauldy) media server. Cross-platform (Windows / Linux / macOS) app built with **Tauri 2**, **React**, and **mpv**.

This repository is linked into the main Vauldy project as a git submodule at `Vauldy-Desktop/`.

## Phase 1 (MVP)

- Server setup & JWT login
- Home: libraries, continue watching, recently added
- Browse libraries & media grids
- Media detail, favorites
- Video/audio playback via **mpv** sidecar (HTML5 fallback in browser dev)
- Photo lightbox, PDF/Office/EPUB reader
- Settings: server URL, locale, tray close behavior
- System tray (minimize on close)

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| Rust | stable (for `tauri dev` / `tauri build`) |
| mpv | optional on PATH, or place sidecar in `bin/` |

Install Rust: https://rustup.rs/

## Development

```bash
npm install

# UI only (browser, uses HTML5 player)
npm run dev

# Full desktop app (requires Rust + mpv)
npm run tauri:dev
```

Default server: `http://127.0.0.1:8200` — demo login `admin` / `admin123`.

## mpv Sidecar

Place platform binaries under `bin/` (see `bin/README.md`). Tauri bundles them as external binaries. If mpv is on PATH, development works without sidecar files.

## Build installers

```bash
# Current platform (Windows / Linux / macOS)
npm run tauri:build

# Windows helper script (downloads mpv sidecar + builds)
.\build.ps1
```

Produces:
- Executable: `src-tauri/target/release/vauldy-desktop(.exe)`
- Bundled installers: `src-tauri/target/release/bundle/`
- Collected artifacts: `dist/desktop/<target-triple>/`

### All platforms

Cross-compilation requires native OS toolchains. Use GitHub Actions:

```bash
gh workflow run desktop-build.yml
```

Downloads artifacts for Windows x64, Linux x64, macOS Intel and Apple Silicon.

## Project layout

```
src/           React UI (routes, API client, stores)
src-tauri/     Rust shell (mpv, tray, window)
doc/           Requirements specification (SRS)
```

## Related

- [Desktop SRS](doc/桌面端需求规格书.md)
- [Vauldy server](https://github.com/knoxmedia/Vauldy)
- [Mobile client](https://github.com/knoxmedia/Vauldy-ReactNative)
