//! MPV 嵌入窗口（Windows）
//!
//! 策略（Kuriume / DWM alpha）：无 owner 的顶层 popup 叠在 **主窗口后面**，
//! Tauri 窗口透明区域透出后面的视频。点击落在上层 WebView，无需 WS_EX_TRANSPARENT。
//! 禁止 WS_EX_LAYERED，否则 mpv --wid GPU 子窗口会只出声不出画。

use std::sync::Mutex;
use tauri::{AppHandle, Manager, WebviewWindow};

static LAST_CLIENT_BOUNDS: Mutex<Option<(i32, i32, i32, i32, bool)>> = Mutex::new(None);
static LAST_SCREEN_BOUNDS: Mutex<Option<(i32, i32, i32, i32)>> = Mutex::new(None);

#[cfg(windows)]
static EMBED_HWND: Mutex<Option<isize>> = Mutex::new(None);

#[cfg(windows)]
static HOST_CLASS_ATOM: Mutex<Option<u16>> = Mutex::new(None);

pub fn ensure_embed_window(app: &AppHandle) -> Result<isize, String> {
    #[cfg(windows)]
    {
        ensure_native_hwnd(app)
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Err("embedded mpv requires Windows".into())
    }
}

#[cfg(windows)]
fn main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())
}

#[cfg(windows)]
fn frame_hwnd(app: &AppHandle) -> Result<windows::Win32::Foundation::HWND, String> {
    let hwnd = main_window(app)?.hwnd().map_err(|e| e.to_string())?;
    Ok(windows::Win32::Foundation::HWND(hwnd.0))
}

#[cfg(windows)]
fn is_window_valid(hwnd: isize) -> bool {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::IsWindow;
    unsafe { IsWindow(HWND(hwnd as *mut _)).as_bool() }
}

#[cfg(windows)]
fn window_scale_factor(app: &AppHandle) -> Result<f64, String> {
    main_window(app)?.scale_factor().map_err(|e| e.to_string())
}

#[cfg(windows)]
fn logical_to_screen(
    app: &AppHandle,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<(i32, i32, i32, i32), String> {
    let scale = window_scale_factor(app)?;
    let mut cx = (x as f64 * scale).round() as i32;
    let mut cy = (y as f64 * scale).round() as i32;
    let mut cw = (width.max(1) as f64 * scale).round() as i32;
    let mut ch = (height.max(1) as f64 * scale).round() as i32;

    if let Ok(inner) = main_window(app)?.inner_size() {
        let max_w = inner.width as i32;
        let max_h = inner.height as i32;
        cx = cx.max(0);
        cy = cy.max(0);
        cw = cw.max(1).min(max_w.saturating_sub(cx).max(1));
        ch = ch.max(1).min(max_h.saturating_sub(cy).max(1));
    }

    let pos = main_window(app)?
        .inner_position()
        .map_err(|e| e.to_string())?;
    Ok((pos.x + cx, pos.y + cy, cw, ch))
}

#[cfg(windows)]
fn full_client_screen_rect(app: &AppHandle) -> Result<(i32, i32, i32, i32), String> {
    let inner = main_window(app)?.inner_size().map_err(|e| e.to_string())?;
    let pos = main_window(app)?
        .inner_position()
        .map_err(|e| e.to_string())?;
    Ok((
        pos.x,
        pos.y,
        inner.width.max(1) as i32,
        inner.height.max(1) as i32,
    ))
}

#[cfg(windows)]
unsafe extern "system" fn embed_host_wndproc(
    hwnd: windows::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::Foundation::{LRESULT, RECT};
    use windows::Win32::Graphics::Gdi::{FillRect, GetStockObject, BLACK_BRUSH, HBRUSH};
    use windows::Win32::UI::WindowsAndMessaging::{
        DefWindowProcW, GetClientRect, WM_ERASEBKGND, WM_PAINT,
    };

    // 铺黑底：透明 CSS 透出黑底而不是桌面壁纸
    if msg == WM_ERASEBKGND || msg == WM_PAINT {
        let mut rect = RECT::default();
        let _ = GetClientRect(hwnd, &mut rect);
        let brush = HBRUSH(GetStockObject(BLACK_BRUSH).0);
        if msg == WM_ERASEBKGND {
            let hdc = windows::Win32::Graphics::Gdi::HDC(wparam.0 as *mut _);
            let _ = FillRect(hdc, &rect, brush);
            return LRESULT(1);
        }
        use windows::Win32::Graphics::Gdi::{BeginPaint, EndPaint, PAINTSTRUCT};
        let mut ps = PAINTSTRUCT::default();
        let hdc = BeginPaint(hwnd, &mut ps);
        let _ = FillRect(hdc, &rect, brush);
        let _ = EndPaint(hwnd, &ps);
        return LRESULT(0);
    }
    DefWindowProcW(hwnd, msg, wparam, lparam)
}

/// 点击穿透由「视频在窗口后面」实现，此处无需处理。
#[cfg(windows)]
pub fn refresh_click_through() {}

#[cfg(not(windows))]
pub fn refresh_click_through() {}

pub fn maintain_embed_layer(app: &AppHandle) {
    #[cfg(windows)]
    {
        let Some((x, y, w, h, visible)) = LAST_CLIENT_BOUNDS.lock().ok().and_then(|g| *g) else {
            return;
        };
        let _ = sync_native_bounds(app, x, y, w as u32, h as u32, visible);
    }
    #[cfg(not(windows))]
    {
        let _ = app;
    }
}

#[cfg(windows)]
fn notify_embed_resized(embed: windows::Win32::Foundation::HWND, w: i32, h: i32) {
    use windows::Win32::Foundation::{LPARAM, WPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{SendMessageW, WM_SIZE};

    const SIZE_RESTORED: usize = 0;
    unsafe {
        let lparam = ((h as u32) << 16) | (w as u32 & 0xFFFF);
        let _ = SendMessageW(
            embed,
            WM_SIZE,
            WPARAM(SIZE_RESTORED),
            LPARAM(lparam as isize),
        );
    }
}

/// SetWindowPos(embed, frame, ...)：把 embed 插到 frame **后面**（更靠下），视频从透明区透出。
#[cfg(windows)]
fn place_behind_frame(
    embed: windows::Win32::Foundation::HWND,
    frame: windows::Win32::Foundation::HWND,
    x: i32,
    y: i32,
    w: i32,
    h: i32,
) -> Result<(), String> {
    use windows::Win32::UI::WindowsAndMessaging::{SetWindowPos, SWP_NOACTIVATE, SWP_SHOWWINDOW};

    unsafe {
        SetWindowPos(
            embed,
            frame,
            x,
            y,
            w,
            h,
            SWP_NOACTIVATE | SWP_SHOWWINDOW,
        )
        .map_err(|e| format!("SetWindowPos behind frame failed: {e}"))
    }
}

pub fn restore_embed_after_focus(app: &AppHandle) {
    #[cfg(windows)]
    {
        maintain_embed_layer(app);
        let _ = main_window(app).and_then(|w| w.set_focus().map_err(|e| e.to_string()));
    }
    #[cfg(not(windows))]
    {
        let _ = app;
    }
}

#[cfg(windows)]
fn ensure_host_window_class() -> Result<u16, String> {
    if let Ok(guard) = HOST_CLASS_ATOM.lock() {
        if let Some(atom) = *guard {
            return Ok(atom);
        }
    }

    use windows::core::w;
    use windows::Win32::Foundation::{GetLastError, ERROR_CLASS_ALREADY_EXISTS};
    use windows::Win32::Graphics::Gdi::{GetStockObject, BLACK_BRUSH, HBRUSH};
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::WindowsAndMessaging::{
        RegisterClassW, CS_HREDRAW, CS_VREDRAW, WNDCLASSW,
    };

    unsafe {
        let hinstance =
            GetModuleHandleW(None).map_err(|e| format!("GetModuleHandleW failed: {e}"))?;
        let class_name = w!("VauldyMpvEmbed");
        let wc = WNDCLASSW {
            style: CS_HREDRAW | CS_VREDRAW,
            lpfnWndProc: Some(embed_host_wndproc),
            hInstance: hinstance.into(),
            lpszClassName: class_name,
            hbrBackground: HBRUSH(GetStockObject(BLACK_BRUSH).0),
            ..Default::default()
        };
        let atom = RegisterClassW(&wc);
        if atom == 0 {
            let err = GetLastError();
            if err != ERROR_CLASS_ALREADY_EXISTS {
                return Err(format!("RegisterClassW failed: {err:?}"));
            }
        } else if let Ok(mut guard) = HOST_CLASS_ATOM.lock() {
            *guard = Some(atom);
        }
        Ok(atom.max(1))
    }
}

#[cfg(windows)]
fn create_behind_popup() -> Result<windows::Win32::Foundation::HWND, String> {
    use windows::core::w;
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, WINDOW_EX_STYLE, WINDOW_STYLE, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
        WS_POPUP,
    };

    let _ = ensure_host_window_class()?;

    unsafe {
        // 无 owner、无 LAYERED、无 TRANSPARENT：独立顶层窗，由 z-order 垫在主窗后面
        let hwnd = CreateWindowExW(
            WINDOW_EX_STYLE((WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW).0),
            w!("VauldyMpvEmbed"),
            w!(""),
            WINDOW_STYLE(WS_POPUP.0),
            0,
            0,
            1,
            1,
            None,
            None,
            None,
            None,
        )
        .map_err(|e| format!("CreateWindowExW failed: {e}"))?;
        Ok(hwnd)
    }
}

#[cfg(windows)]
fn destroy_stale_embed(hwnd: windows::Win32::Foundation::HWND) {
    use windows::Win32::UI::WindowsAndMessaging::DestroyWindow;
    unsafe {
        let _ = DestroyWindow(hwnd);
    }
}

#[cfg(windows)]
fn ensure_native_hwnd(_app: &AppHandle) -> Result<isize, String> {
    if let Ok(guard) = EMBED_HWND.lock() {
        if let Some(hwnd) = *guard {
            if is_window_valid(hwnd) {
                return Ok(hwnd);
            }
        }
    }

    if let Ok(mut guard) = EMBED_HWND.lock() {
        if let Some(hwnd) = guard.take() {
            if is_window_valid(hwnd) {
                destroy_stale_embed(windows::Win32::Foundation::HWND(hwnd as *mut _));
            }
        }
    }

    let hwnd = create_behind_popup()?;
    let wid = hwnd.0 as isize;
    if let Ok(mut guard) = EMBED_HWND.lock() {
        *guard = Some(wid);
    }
    eprintln!("[mpv-embed] created behind-popup hwnd={wid}");
    Ok(wid)
}

pub fn sync_embed_bounds(
    app: &AppHandle,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    visible: bool,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        sync_native_bounds(app, x, y, width, height, visible)
    }
    #[cfg(not(windows))]
    {
        let _ = (app, x, y, width, height, visible);
        Err("embedded mpv requires Windows".into())
    }
}

#[cfg(windows)]
fn sync_native_bounds(
    app: &AppHandle,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    visible: bool,
) -> Result<(), String> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{IsIconic, ShowWindow, SW_HIDE};

    let wid = ensure_native_hwnd(app)?;
    let embed = HWND(wid as *mut _);
    let frame = frame_hwnd(app)?;

    if visible && unsafe { IsIconic(frame).as_bool() } {
        unsafe {
            let _ = ShowWindow(embed, SW_HIDE);
        }
        return Ok(());
    }

    // 盖住整个客户区铺黑底，避免透明 CSS 漏出桌面壁纸；mpv 在窗内 letterbox
    let (screen_x, screen_y, w, h) = if visible {
        full_client_screen_rect(app)?
    } else {
        logical_to_screen(app, x, y, width, height)?
    };

    if let Ok(mut guard) = LAST_CLIENT_BOUNDS.lock() {
        // 维持线程仍用“可见”标记；尺寸以全客户区为准
        *guard = Some((0, 0, w, h, visible));
    }
    if let Ok(mut guard) = LAST_SCREEN_BOUNDS.lock() {
        *guard = Some((screen_x, screen_y, w, h));
    }

    if visible {
        place_behind_frame(embed, frame, screen_x, screen_y, w, h)?;
        notify_embed_resized(embed, w, h);
        // 触发一次黑底重绘
        use windows::Win32::Graphics::Gdi::InvalidateRect;
        unsafe {
            let _ = InvalidateRect(embed, None, true);
        }
    } else {
        unsafe {
            let _ = ShowWindow(embed, SW_HIDE);
        }
    }
    Ok(())
}

pub fn clear_embed_bounds() {
    if let Ok(mut guard) = LAST_CLIENT_BOUNDS.lock() {
        *guard = None;
    }
    if let Ok(mut guard) = LAST_SCREEN_BOUNDS.lock() {
        *guard = None;
    }
}

pub fn cursor_in_video_rect() -> bool {
    let bounds = match LAST_SCREEN_BOUNDS.lock().ok().and_then(|g| g.as_ref().copied()) {
        Some(b) => b,
        None => return false,
    };
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::{POINT, RECT};
        use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
        let (x, y, w, h) = bounds;
        let rect = RECT {
            left: x,
            top: y,
            right: x + w,
            bottom: y + h,
        };
        let mut pt = POINT::default();
        unsafe {
            if GetCursorPos(&mut pt).is_err() {
                return false;
            }
        }
        pt.x >= rect.left && pt.x < rect.right && pt.y >= rect.top && pt.y < rect.bottom
    }
    #[cfg(not(windows))]
    {
        let _ = bounds;
        false
    }
}

pub fn hide_embed_window(app: &AppHandle) -> Result<(), String> {
    let _ = app;
    clear_embed_bounds();
    #[cfg(windows)]
    {
        if let Ok(guard) = EMBED_HWND.lock() {
            if let Some(hwnd) = *guard {
                use windows::Win32::Foundation::HWND;
                use windows::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_HIDE};
                unsafe {
                    let _ = ShowWindow(HWND(hwnd as *mut _), SW_HIDE);
                }
            }
        }
    }
    Ok(())
}

pub fn schedule_post_mpv_embed_refresh(app: AppHandle) {
    #[cfg(windows)]
    {
        std::thread::spawn(move || {
            for ms in [16_u64, 32, 64, 128, 256, 512, 1000] {
                std::thread::sleep(std::time::Duration::from_millis(ms));
                maintain_embed_layer(&app);
            }
        });
    }
    #[cfg(not(windows))]
    {
        let _ = app;
    }
}

/// 启动时把窗口/WebView 背景设为全透明，CSS 不透明区域仍可盖住后面视频。
pub fn configure_transparent_host(app: &AppHandle) -> Result<(), String> {
    let win = main_window(app)?;
    use tauri::window::Color;
    win.set_background_color(Some(Color(0, 0, 0, 0)))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(windows)]
pub fn debug_embed_state(app: &AppHandle) -> String {
    let embed = EMBED_HWND.lock().ok().and_then(|g| *g).unwrap_or(0);
    let bounds = LAST_CLIENT_BOUNDS.lock().ok().and_then(|g| *g);
    let screen = LAST_SCREEN_BOUNDS.lock().ok().and_then(|g| *g);
    let scale = window_scale_factor(app).unwrap_or(1.0);
    format!(
        "mode=behind-popup embed={embed} scale={scale} logical={bounds:?} screen={screen:?}"
    )
}

#[cfg(not(windows))]
pub fn debug_embed_state(_app: &AppHandle) -> String {
    "n/a".into()
}
