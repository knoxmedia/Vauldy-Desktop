use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::time::Duration;

#[cfg(windows)]
mod platform {
    use std::io;
    use std::os::windows::fs::OpenOptionsExt;
    use std::os::windows::io::{FromRawHandle, RawHandle};
    use std::thread;
    use std::time::Duration;
    use windows::Win32::Storage::FileSystem::{
        CreateFileW, FILE_ATTRIBUTE_NORMAL, FILE_GENERIC_READ, FILE_GENERIC_WRITE,
        FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
    };

    pub fn connect_pipe(path: &str) -> Result<std::fs::File, String> {
        let wide: Vec<u16> = path
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        for attempt in 0..40 {
            let handle = unsafe {
                CreateFileW(
                    windows::core::PCWSTR(wide.as_ptr()),
                    FILE_GENERIC_READ.0 | FILE_GENERIC_WRITE.0,
                    FILE_SHARE_READ | FILE_SHARE_WRITE,
                    None,
                    OPEN_EXISTING,
                    FILE_ATTRIBUTE_NORMAL,
                    None,
                )
            };
            if let Ok(handle) = handle {
                if handle.is_invalid() {
                    return Err("invalid pipe handle".into());
                }
                let raw = handle.0 as RawHandle;
                let file = unsafe { std::fs::File::from_raw_handle(raw) };
                // Keep handle ownership with File; do not CloseHandle separately.
                return Ok(file);
            }
            let _ = thread::sleep(Duration::from_millis(50 + attempt * 10));
        }
        Err(format!("failed to connect mpv ipc pipe: {path}"))
    }

    pub fn pipe_path() -> String {
        format!(r"\\.\pipe\mpv-vauldy-{}", std::process::id())
    }
}

#[cfg(not(windows))]
mod platform {
    use std::path::PathBuf;

    pub fn connect_pipe(path: &str) -> Result<std::fs::File, String> {
        std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(path)
            .map_err(|e| format!("failed to connect mpv ipc socket: {e}"))
    }

    pub fn pipe_path() -> String {
        let mut path = std::env::temp_dir();
        path.push(format!("mpv-vauldy-{}.sock", std::process::id()));
        path.to_string_lossy().into_owned()
    }
}

pub fn ipc_server_path() -> String {
    platform::pipe_path()
}

pub fn ipc_command(path: &str, command: Value) -> Result<Value, String> {
    let mut file = platform::connect_pipe(path)?;
    let mut payload = serde_json::to_string(&command).map_err(|e| e.to_string())?;
    payload.push('\n');
    file.write_all(payload.as_bytes())
        .map_err(|e| format!("ipc write failed: {e}"))?;
    file.flush().map_err(|e| format!("ipc flush failed: {e}"))?;

    let mut reader = BufReader::new(file);
    let mut line = String::new();
    for _ in 0..32 {
        line.clear();
        if reader.read_line(&mut line).map_err(|e| e.to_string())? == 0 {
            std::thread::sleep(Duration::from_millis(20));
            continue;
        }
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let value: Value = serde_json::from_str(trimmed).map_err(|e| e.to_string())?;
        if value.get("request_id").is_some() || value.get("data").is_some() {
            return Ok(value);
        }
    }
    Err("no ipc response from mpv".into())
}

pub fn set_property(path: &str, name: &str, value: Value) -> Result<(), String> {
    let _ = ipc_command(
        path,
        json!({
            "command": ["set_property", name, value],
            "request_id": 1
        }),
    )?;
    Ok(())
}

pub fn get_property_f64(path: &str, name: &str) -> Result<f64, String> {
    let resp = ipc_command(
        path,
        json!({
            "command": ["get_property", name],
            "request_id": 2
        }),
    )?;
    if let Some(err) = resp.get("error").and_then(|v| v.as_str()) {
        if err != "success" {
            return Err(format!("mpv get_property {name}: {err}"));
        }
    }
    resp.get("data")
        .and_then(|v| v.as_f64())
        .ok_or_else(|| format!("mpv property {name} missing"))
}

pub fn get_property_bool(path: &str, name: &str) -> Result<bool, String> {
    let resp = ipc_command(
        path,
        json!({
            "command": ["get_property", name],
            "request_id": 3
        }),
    )?;
    resp.get("data")
        .and_then(|v| v.as_bool())
        .ok_or_else(|| format!("mpv property {name} missing"))
}

pub fn command(path: &str, args: &[&str]) -> Result<(), String> {
    let _ = ipc_command(
        path,
        json!({
            "command": args,
            "request_id": 4
        }),
    )?;
    Ok(())
}
