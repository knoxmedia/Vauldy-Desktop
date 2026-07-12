Place platform-specific mpv binaries here for Tauri sidecar bundling.

Tauri expects files named with target triple suffix, for example:
- `mpv-x86_64-pc-windows-msvc.exe` (Windows x64)
- `mpv-x86_64-unknown-linux-gnu` (Linux x64)
- `mpv-aarch64-apple-darwin` (macOS Apple Silicon)
- `mpv-x86_64-apple-darwin` (macOS Intel)

Download automatically on Windows:

```powershell
.\scripts\download-mpv.ps1
```

During development you can also install mpv on PATH (`mpv` command).
Download: https://mpv.io/installation/
