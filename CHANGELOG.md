# Changelog

All notable changes to Vauldy Desktop are documented in this file.

---

## [0.1.0] - 2026-07-14

### Phase 1 MVP -- First Public Release

Initial release of the Vauldy Desktop client, a cross-platform (Windows, Linux, macOS) desktop application for the [Vauldy](https://github.com/knoxmedia/Vauldy) self-hosted media server. Built with **Tauri 2** (Rust) and **React 19** + TypeScript.

---

### Highlights

- **Native desktop experience** with system tray integration, minimize-to-tray, and close interception.
- **mpv-powered video playback** with embedded window overlay on Windows (`--wid` parenting) and standalone mpv windows on Linux/macOS.
- **Dual-engine playback strategy** -- the client automatically selects between mpv native playback and HTML5/hls.js fallback based on media codec profiles (HEVC, HDR, 10-bit, ASS/PGS subtitles, etc.). Users can also force a preferred engine in settings.
- **5 UI locales** out of the box: Simplified Chinese (zh-CN), Traditional Chinese (zh-TW), English (en), Japanese (ja), Korean (ko).
- **Dynamic branding** pulls the server's configured app name and favicon at runtime.
- **Full media type support** -- video, audio, photos, and documents (PDF, Office, EPUB).

---

### Features

#### Server Connection & Auth
- Server URL setup wizard with health check
- JWT-based login with session persistence
- Automatic redirect to login on 401 responses

#### Home Dashboard
- Library cards with composite preview thumbnails
- Continue Watching shelf (deduplicated per media, latest position)
- Recently Added media grid

#### Media Browsing & Search
- Library-level media grid with configurable sorting
- Full-text search across titles, overviews, genres, and tags
- File type filtering (video, audio, image, document)

#### TV Series & Anime
- Library series listing with season/episode counts
- Season-episode browser per series
- Multi-version episode support
- Legacy route redirects for backward compatibility

#### Music
- Album, artist, and genre browsing per music library
- Album/artist detail views with artwork
- LRC lyrics display with ASR recognition support

#### Video & Audio Playback
- **Auto engine selection**: Inspects media codec profiles (container, codec, bit depth, HDR, subtitle types) and auto-selects mpv or HTML5/hls.js
- **mpv embed (Windows)**: Transparent child window synced on move/resize/scale, with 16ms background maintainer thread for z-order stability
- **IPC control**: Play, pause, seek, volume, stop, status polling via Tauri Rust commands
- **HTML5/hls.js fallback**: Direct playback for browser-compatible media, avoiding the mpv overlay
- **Playback progress tracking**: Position synced to server for resume and history
- **Audio-only mode**: mpv launched with `--no-video` for music tracks

#### Photo Lightbox
- Full-screen photo viewer with cached thumbnails and medium previews
- Original image download
- Place/person browsing with face detection integration
- Tag browsing (AI classification tags)

#### Document Reader
- PDF preview rendering via server-side conversion
- Office document support (DOC, DOCX, XLS, XLSX, PPT, PPTX)
- EPUB reading support
- Read progress save/resume
- Document metadata editing (title, author, publisher, year, tags)

#### Media Detail Pages
- Rich metadata: title, overview, rating, genres, release date, duration, codec info
- Cast/person listing with character names
- Subtitle listing with format and status
- Manual media match (scrape from TMDB, Douban, etc.)
- Watched/unwatched toggle, favorite add/remove

#### Favorites & Playlists
- Flat favorites list with custom folders
- Playlists with create, rename, delete, and custom artwork
- Drag-and-drop item reorder
- Sequential auto-advance playback

#### Playback History
- Per-user history with resume positions
- Deduplication (one entry per media, latest position)

#### Settings
- Server URL configuration
- UI locale selection (synced from server profile)
- Player engine preference (auto / mpv / web)
- Tray close behavior

#### System Tray
- Brand logo tray icon
- Minimize-to-tray on window close
- Tray menu: Show Main Window / Quit
- Left click restores window

#### Localization (i18n)
- 5 locales: zh-CN, zh-TW, en, ja, ko
- Ant Design component localization per locale
- Server-pushed locale sync from user profile

#### Branding
- Dynamic app name and favicon from server
- Window title reflects server branding
- Tray icon loaded from bundled app icon

#### Admin Dashboard
- All admin features accessible via web UI routing
- Libraries, users, transcoding, scanning, scraping, AI providers, system options

---

### Known Limitations

| Limitation | Details |
|---|---|
| **mpv embed is Windows-only** | Linux/macOS use standalone mpv windows. Embedded overlay relies on Win32 API. |
| **Admin panel via web UI only** | No native admin UI in this release. |
| **No local media upload** | Media must be added on the server side. |
| **No full offline caching** | All content is streamed from the server. |
| **mpv sidecar must be bundled manually** | Pre-built mpv binaries placed in `src-tauri/bin/` before packaging. `build.ps1` automates this for Windows. |
| **No hardware decoding UI** | mpv uses `--hwdec=auto` with no user toggle. |
| **No multi-window support** | Single webview window. PiP/detached player not yet implemented. |
| **No platform auto-start** | Start-on-login not configurable from the desktop client. |

---

### Tech Stack

| Layer | Technology |
|---|---|
| Desktop Shell | Tauri 2 (Rust edition 2021) |
| UI Framework | React 19 + TypeScript 5.7 |
| Component Library | Ant Design 6.5 |
| State Management | Zustand 5 |
| Routing | React Router DOM v7 |
| i18n | i18next + react-i18next |
| HTTP Client | Axios |
| Streaming | hls.js |
| Build | Vite 6 |
| Playback Engine | mpv (sidecar + JSON IPC) |
| Windows API | win32 crate 0.58 (embed window) |

#### Build Artifacts
- **Windows**: `.exe` + `.msi`
- **Linux**: binary + `.deb` + `.AppImage`
- **macOS**: `.app` + `.dmg`
- All platforms include mpv sidecar bundled alongside the executable.

---

### Installation

**Server requirement**: Vauldy Media Server with API v1 endpoints (default: `http://127.0.0.1:8200`).

#### Pre-built Binaries
Download from the [GitHub Releases page](https://github.com/knoxmedia/Vauldy-Desktop/releases).

#### Build from Source
```bash
git clone --recurse-submodules https://github.com/knoxmedia/Vauldy.git
cd Vauldy/Vauldy-Desktop

npm install
npm run tauri:build

# Windows convenience script (downloads mpv + builds)
.\build.ps1
```

#### Development
```bash
npm run dev        # Browser-only (HTML5 player)
npm run tauri:dev  # Full desktop app (Tauri + mpv)
```

---

### What's Next

Planned for Phase 2:
- Native admin dashboard
- Multi-window support (detached player, PiP)
- Keyboard shortcuts and global media keys
- Local media upload and download management
- Offline caching with sync
- macOS/Linux embedded video overlay
- Auto-start on login
- External subtitle file loading
