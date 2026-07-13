mod embed_window;
mod mpv;
mod mpv_ipc;

use mpv::{MpvBounds, MpvController, MpvStatus};
use tauri::{
    include_image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};

#[tauri::command]
fn mpv_play(
    app: AppHandle,
    mpv: tauri::State<'_, MpvController>,
    url: String,
    start_sec: f64,
    audio_only: bool,
) -> Result<(), String> {
    mpv.play(&app, url, start_sec, audio_only)
}

#[tauri::command]
fn mpv_play_embedded(
    app: AppHandle,
    mpv: tauri::State<'_, MpvController>,
    url: String,
    start_sec: f64,
    bounds: MpvBounds,
) -> Result<(), String> {
    mpv.play_embedded(&app, bounds, url, start_sec)
}

#[tauri::command]
fn mpv_set_bounds(
    app: AppHandle,
    mpv: tauri::State<'_, MpvController>,
    bounds: MpvBounds,
) -> Result<(), String> {
    mpv.sync_bounds(&app, bounds)
}

#[tauri::command]
fn mpv_sync_embed(
    app: AppHandle,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    visible: bool,
) -> Result<(), String> {
    embed_window::sync_embed_bounds(&app, x, y, width, height, visible)
}

#[tauri::command]
fn mpv_restore_embed(app: AppHandle, mpv: tauri::State<'_, MpvController>) -> Result<(), String> {
    embed_window::restore_embed_after_focus(&app);
    mpv.refresh_video_output();
    Ok(())
}

#[tauri::command]
fn mpv_debug_embed(app: AppHandle) -> Result<String, String> {
    Ok(embed_window::debug_embed_state(&app))
}

#[tauri::command]
fn mpv_pause(mpv: tauri::State<'_, MpvController>) -> Result<(), String> {
    mpv.set_pause(true)
}

#[tauri::command]
fn mpv_resume(mpv: tauri::State<'_, MpvController>) -> Result<(), String> {
    mpv.set_pause(false)
}

#[tauri::command]
fn mpv_toggle_pause(mpv: tauri::State<'_, MpvController>) -> Result<(), String> {
    mpv.toggle_pause()
}

#[tauri::command]
fn mpv_seek(mpv: tauri::State<'_, MpvController>, seconds: f64) -> Result<(), String> {
    mpv.seek(seconds)
}

#[tauri::command]
fn mpv_set_volume(mpv: tauri::State<'_, MpvController>, volume: f64) -> Result<(), String> {
    mpv.set_volume(volume)
}

#[tauri::command]
fn mpv_stop(app: AppHandle, mpv: tauri::State<'_, MpvController>) -> Result<(), String> {
    mpv.stop(&app);
    Ok(())
}

#[tauri::command]
fn mpv_status(mpv: tauri::State<'_, MpvController>) -> Result<MpvStatus, String> {
    Ok(mpv.status())
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn hide_to_tray(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn quit_app(app: &AppHandle) {
    if let Some(mpv) = app.try_state::<MpvController>() {
        mpv.stop(app);
    }
    app.exit(0);
}

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    let icon = include_image!("icons/32x32.png");

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .tooltip("Vauldy")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                let _ = show_main_window(app.clone());
            }
            "quit" => {
                quit_app(&app);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            }
            | TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            } => {
                let _ = show_main_window(tray.app_handle().clone());
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(MpvController::default())
        .invoke_handler(tauri::generate_handler![
            mpv_play,
            mpv_play_embedded,
            mpv_set_bounds,
            mpv_sync_embed,
            mpv_restore_embed,
            mpv_debug_embed,
            mpv_pause,
            mpv_resume,
            mpv_toggle_pause,
            mpv_seek,
            mpv_set_volume,
            mpv_stop,
            mpv_status,
            show_main_window,
            hide_to_tray,
        ])
        .setup(|app| {
            setup_tray(app.handle())?;
            if let Err(err) = embed_window::configure_transparent_host(app.handle()) {
                eprintln!("[mpv-embed] transparent host setup failed: {err}");
            }
            // 启动时预创建嵌入窗口，避免 Windows 在 invoke 同步命令里建窗死锁。
            if let Err(err) = embed_window::ensure_embed_window(app.handle()) {
                eprintln!("[mpv-embed] pre-create failed: {err}");
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                let app = window.app_handle().clone();
                match event {
                    WindowEvent::Focused(true) => {
                        embed_window::restore_embed_after_focus(&app);
                    }
                    WindowEvent::Moved(_)
                    | WindowEvent::Resized(_)
                    | WindowEvent::ScaleFactorChanged { .. } => {
                        embed_window::maintain_embed_layer(&app);
                    }
                    _ => {}
                }
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {});
}
