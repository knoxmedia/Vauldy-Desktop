use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::AppHandle;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

#[derive(Default)]
pub struct MpvController {
    child: Mutex<Option<CommandChild>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MpvStatus {
    pub playing: bool,
    pub paused: bool,
    pub position: f64,
    pub duration: f64,
    pub volume: f64,
}

impl MpvController {
    pub fn stop(&self) {
        if let Ok(mut guard) = self.child.lock() {
            if let Some(child) = guard.take() {
                let _ = child.kill();
            }
        }
    }

    pub fn play(
        &self,
        app: &AppHandle,
        url: String,
        start_sec: f64,
        audio_only: bool,
    ) -> Result<(), String> {
        self.stop();

        let mut args = vec!["--no-terminal".to_string(), "--force-window=yes".to_string()];
        if audio_only {
            args.push("--no-video".to_string());
        }
        if start_sec > 0.0 {
            args.push(format!("--start={start_sec}"));
        }
        args.push(url);

        let child = spawn_mpv(app, &args)?;
        if let Ok(mut guard) = self.child.lock() {
            *guard = Some(child);
        }
        Ok(())
    }

    pub fn set_pause(&self, _paused: bool) -> Result<(), String> {
        Ok(())
    }

    pub fn toggle_pause(&self) -> Result<(), String> {
        Ok(())
    }

    pub fn seek(&self, _seconds: f64) -> Result<(), String> {
        Ok(())
    }

    pub fn set_volume(&self, _volume: f64) -> Result<(), String> {
        Ok(())
    }

    pub fn status(&self) -> MpvStatus {
        MpvStatus {
            playing: self.child.lock().ok().and_then(|g| g.as_ref().map(|_| true)).unwrap_or(false),
            paused: false,
            position: 0.0,
            duration: 0.0,
            volume: 100.0,
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
