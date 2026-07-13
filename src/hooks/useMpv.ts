import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MpvStatus } from "@/api/types";

export type MpvBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  visible?: boolean;
};

export { getCurrentWindow };

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** 视口内 getBoundingClientRect（逻辑 CSS 像素；物理换算在 Rust 端用 scale_factor） */
export function measureElementBounds(el: HTMLElement): MpvBounds {
  const rect = el.getBoundingClientRect();
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
    visible: rect.width > 0 && rect.height > 0,
  };
}

export async function mpvPlayEmbedded(
  url: string,
  bounds: MpvBounds,
  startSec = 0,
): Promise<void> {
  if (!isTauri()) return;
  await invoke("mpv_play_embedded", { url, startSec, bounds });
}

export async function mpvRestoreEmbed(): Promise<void> {
  if (!isTauri()) return;
  await invoke("mpv_restore_embed");
}

export async function mpvSyncEmbed(bounds: MpvBounds): Promise<void> {
  if (!isTauri()) return;
  await invoke("mpv_sync_embed", {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    visible: bounds.visible ?? true,
  });
}

export async function mpvSetBounds(bounds: MpvBounds): Promise<void> {
  if (!isTauri()) return;
  await invoke("mpv_set_bounds", { bounds });
}

export async function mpvPlay(url: string, startSec = 0, audioOnly = false): Promise<void> {
  if (!isTauri()) return;
  await invoke("mpv_play", { url, startSec, audioOnly });
}

export async function mpvPause(): Promise<void> {
  if (!isTauri()) return;
  await invoke("mpv_pause");
}

export async function mpvResume(): Promise<void> {
  if (!isTauri()) return;
  await invoke("mpv_resume");
}

export async function mpvTogglePause(): Promise<void> {
  if (!isTauri()) return;
  await invoke("mpv_toggle_pause");
}

export async function mpvSeek(seconds: number): Promise<void> {
  if (!isTauri()) return;
  await invoke("mpv_seek", { seconds });
}

export async function mpvSetVolume(volume: number): Promise<void> {
  if (!isTauri()) return;
  await invoke("mpv_set_volume", { volume });
}

export async function mpvStop(): Promise<void> {
  if (!isTauri()) return;
  await invoke("mpv_stop");
}

export async function mpvStatus(): Promise<MpvStatus | null> {
  if (!isTauri()) return null;
  return invoke<MpvStatus>("mpv_status");
}

export async function toggleWindowFullscreen(): Promise<boolean> {
  const win = getCurrentWindow();
  const fs = await win.isFullscreen();
  await win.setFullscreen(!fs);
  return !fs;
}

export async function showMainWindow(): Promise<void> {
  if (!isTauri()) return;
  await invoke("show_main_window");
}

export async function hideToTray(): Promise<void> {
  if (!isTauri()) return;
  await invoke("hide_to_tray");
}
