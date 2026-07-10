import { invoke } from "@tauri-apps/api/core";
import type { MpvStatus } from "@/api/types";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
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

export async function showMainWindow(): Promise<void> {
  if (!isTauri()) return;
  await invoke("show_main_window");
}

export async function hideToTray(): Promise<void> {
  if (!isTauri()) return;
  await invoke("hide_to_tray");
}
