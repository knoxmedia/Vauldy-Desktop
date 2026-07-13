use crate::embed_window;
use crate::mpv_ipc::{command, get_property_bool, get_property_f64, ipc_server_path, set_property};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::AppHandle;
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

static EMBED_MAINTAIN_ACTIVE: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MpvBounds {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    #[serde(default = "default_visible")]
    pub visible: bool,
}

fn default_visible() -> bool {
    true
}

#[derive(Default)]
pub struct MpvController {
    child: Mutex<Option<CommandChild>>,
    ipc_path: Mutex<Option<String>>,
    embedded: Mutex<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MpvStatus {
    pub playing: bool,
    pub paused: bool,
    pub position: f64,
    pub duration: f64,
    pub volume: f64,
    pub hovering: bool,
}

impl MpvController {
    fn start_embed_maintainer(app: AppHandle) {
        if EMBED_MAINTAIN_ACTIVE.swap(true, Ordering::SeqCst) {
            return;
        }
        thread::spawn(move || {
            while EMBED_MAINTAIN_ACTIVE.load(Ordering::SeqCst) {
                embed_window::maintain_embed_layer(&app);
                thread::sleep(Duration::from_millis(16));
            }
        });
    }

    fn stop_embed_maintainer() {
        EMBED_MAINTAIN_ACTIVE.store(false, Ordering::SeqCst);
    }

    fn stop_mpv_process(&self) {
        if let Some(path) = self.ipc_path.lock().ok().and_then(|g| g.clone()) {
            let _ = command(&path, &["quit"]);
        }
        if let Ok(mut guard) = self.child.lock() {
            if let Some(child) = guard.take() {
                let _ = child.kill();
            }
        }
        if let Ok(mut ipc) = self.ipc_path.lock() {
            *ipc = None;
        }
        if let Ok(mut embedded) = self.embedded.lock() {
            *embedded = false;
        }
        Self::stop_embed_maintainer();
    }

    pub fn stop(&self, app: &AppHandle) {
        self.stop_mpv_process();
        let _ = embed_window::hide_embed_window(app);
    }

    pub fn play(
        &self,
        app: &AppHandle,
        url: String,
        start_sec: f64,
        audio_only: bool,
    ) -> Result<(), String> {
        self.stop(app);
        self.launch_mpv(app, url, start_sec, audio_only, None)
    }

    pub fn play_embedded(
        &self,
        app: &AppHandle,
        bounds: MpvBounds,
        url: String,
        start_sec: f64,
    ) -> Result<(), String> {
        // 仅结束 mpv 进程，保留嵌入窗口；避免 sync command 内 close+create 死锁。
        self.stop_mpv_process();
        let wid = embed_window::ensure_embed_window(app)?;
        embed_window::sync_embed_bounds(
            app,
            bounds.x,
            bounds.y,
            bounds.width.max(1) as u32,
            bounds.height.max(1) as u32,
            bounds.visible,
        )?;
        Self::start_embed_maintainer(app.clone());
        self.launch_mpv(app, url, start_sec, false, Some(wid))?;
        embed_window::schedule_post_mpv_embed_refresh(app.clone());
        let _ = app.get_webview_window("main").and_then(|w| w.set_focus().ok());
        if let Ok(mut embedded) = self.embedded.lock() {
            *embedded = true;
        }
        Ok(())
    }

    pub fn sync_bounds(&self, app: &AppHandle, bounds: MpvBounds) -> Result<(), String> {
        embed_window::sync_embed_bounds(
            app,
            bounds.x,
            bounds.y,
            bounds.width.max(1) as u32,
            bounds.height.max(1) as u32,
            bounds.visible,
        )
    }

    fn launch_mpv(
        &self,
        app: &AppHandle,
        url: String,
        start_sec: f64,
        audio_only: bool,
        wid: Option<isize>,
    ) -> Result<(), String> {
        let ipc_path = ipc_server_path();
        let mut args = vec![
            "--no-terminal".to_string(),
            "--no-osc".to_string(),
            "--no-input-default-bindings".to_string(),
            "--keep-open=yes".to_string(),
            format!("--input-ipc-server={ipc_path}"),
        ];

        if audio_only {
            args.push("--no-video".to_string());
            args.push("--force-window=no".to_string());
        } else if let Some(hwnd) = wid {
            args.push("--vo=gpu".to_string());
            args.push("--hwdec=auto".to_string());
            args.push("--force-window=no".to_string());
            args.push("--ontop=no".to_string());
            args.push("--cursor-autohide=no".to_string());
            args.push("--input-cursor=no".to_string());
            args.push("--input-cursor-passthrough=yes".to_string());
            args.push("--keepaspect-window=no".to_string());
            args.push(format!("--wid={hwnd}"));
        } else {
            args.push("--force-window=yes".to_string());
        }

        if start_sec > 0.0 {
            args.push(format!("--start={start_sec}"));
        }
        if url.contains(".m3u8") || url.contains("/hls") || url.contains("master.m3u8") {
            args.push("--cache=yes".to_string());
        }
        args.push(url);

        let child = spawn_mpv(app, &args)?;
        if let Ok(mut guard) = self.child.lock() {
            *guard = Some(child);
        }
        if let Ok(mut ipc) = self.ipc_path.lock() {
            *ipc = Some(ipc_path);
        }
        Ok(())
    }

    fn ipc_path(&self) -> Result<String, String> {
        self.ipc_path
            .lock()
            .ok()
            .and_then(|g| g.clone())
            .ok_or_else(|| "mpv is not running".to_string())
    }

    pub fn set_pause(&self, paused: bool) -> Result<(), String> {
        set_property(&self.ipc_path()?, "pause", serde_json::Value::Bool(paused))
    }

    pub fn toggle_pause(&self) -> Result<(), String> {
        let path = self.ipc_path()?;
        let paused = get_property_bool(&path, "pause").unwrap_or(false);
        set_property(&path, "pause", serde_json::Value::Bool(!paused))
    }

    pub fn seek(&self, seconds: f64) -> Result<(), String> {
        command(
            &self.ipc_path()?,
            &["seek", &seconds.to_string(), "absolute"],
        )
    }

    pub fn set_volume(&self, volume: f64) -> Result<(), String> {
        set_property(
            &self.ipc_path()?,
            "volume",
            serde_json::json!(volume.clamp(0.0, 100.0)),
        )
    }

    /// Alt+Tab 后触发 vo 重配，缓解嵌入 HWND 黑屏
    pub fn refresh_video_output(&self) {
        let Ok(path) = self.ipc_path() else {
            return;
        };
        let _ = command(&path, &["set_property", "video-zoom", "0"]);
        let _ = command(&path, &["set_property", "window-scale", "1"]);
    }

    pub fn status(&self) -> MpvStatus {
        let embedded = self
            .embedded
            .lock()
            .ok()
            .map(|g| *g)
            .unwrap_or(false);
        if embedded {
            embed_window::refresh_click_through();
        }

        let playing = self
            .child
            .lock()
            .ok()
            .and_then(|g| g.as_ref().map(|_| true))
            .unwrap_or(false);
        if !playing {
            return MpvStatus {
                playing: false,
                paused: false,
                position: 0.0,
                duration: 0.0,
                volume: 100.0,
                hovering: false,
            };
        }
        let path = match self.ipc_path() {
            Ok(p) => p,
            Err(_) => {
                return MpvStatus {
                    playing: true,
                    paused: false,
                    position: 0.0,
                    duration: 0.0,
                    volume: 100.0,
                    hovering: embed_window::cursor_in_video_rect(),
                };
            }
        };
        let paused = get_property_bool(&path, "pause").unwrap_or(false);
        let position = get_property_f64(&path, "time-pos").unwrap_or(0.0);
        let duration = get_property_f64(&path, "duration").unwrap_or(0.0);
        let volume = get_property_f64(&path, "volume").unwrap_or(100.0);
        MpvStatus {
            playing: true,
            paused,
            position,
            duration,
            volume,
            hovering: embed_window::cursor_in_video_rect(),
        }
    }
}

fn spawn_mpv(app: &AppHandle, args: &[String]) -> Result<CommandChild, String> {
    if let Ok(sidecar) = app.shell().sidecar("mpv") {
        match sidecar.args(args).spawn() {
            Ok((_rx, child)) => return Ok(child),
            Err(err) => eprintln!("mpv sidecar spawn failed: {err}"),
        }
    }

    match app.shell().command("mpv").args(args).spawn() {
        Ok((_rx, child)) => Ok(child),
        Err(err) => Err(format!("failed to spawn mpv: {err}")),
    }
}
