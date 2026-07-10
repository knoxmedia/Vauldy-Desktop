mod mpv;

use mpv::{MpvController, MpvStatus};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, RunEvent, WindowEvent,
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
fn mpv_stop(mpv: tauri::State<'_, MpvController>) -> Result<(), String> {
    mpv.stop();
    Ok(())
}

#[tauri::command]
fn mpv_status(mpv: tauri::State<'_, MpvController>) -> Result<MpvStatus, String> {
    Ok(mpv.status())
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
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

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show", "Show Vauldy", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                let _ = show_main_window(app.clone());
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                let _ = show_main_window(app.clone());
            }
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
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            if let RunEvent::ExitRequested { api, .. } = event {
                api.prevent_exit();
            }
        });
}
