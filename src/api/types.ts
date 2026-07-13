export type UserRole = "admin" | "user" | "api_client";

export type Library = {
  id: number;
  name: string;
  type: string;
  path: string;
  folders?: string[];
  auto_scan: number;
  enabled?: number;
  media_count?: number;
  preview_url?: string;
  drm_enabled?: number;
};

export type MediaItem = {
  id: number;
  library_id: number;
  file_id: string;
  title: string;
  original_title?: string;
  file_path: string;
  file_type: string;
  duration: number;
  width: number;
  height: number;
  format: string;
  status: string;
  created_at?: string;
  last_play_at?: string;
  completed?: number;
  release_date?: string;
  year?: number;
  poster_url?: string;
  backdrop_url?: string;
  photo_taken_at?: string;
  photo_tags?: string[];
  scraped?: boolean;
  encrypted_asset?: boolean;
  music_album_id?: number;
  music_album_title?: string;
  music_artist?: string;
  library_type?: string;
  overview?: string;
};

export type HistoryItem = {
  media_id: number;
  title: string;
  file_type: string;
  library_id: number;
  library_type?: string;
  position: number;
  duration: number;
  completed?: number;
  poster_url?: string;
  backdrop_url?: string;
  last_play_at?: string;
  encrypted_asset?: boolean;
};

export type SessionUserInfo = {
  id: number;
  username: string;
  role: UserRole;
  can_play?: boolean;
  can_download?: boolean;
  avatar_url?: string;
  ui_locale?: string;
};

export type BrandingInfo = {
  app_name: string;
  favicon_url?: string;
};

export type PlaybackPlan = {
  status?: string;
  mode?: string;
  playUrl?: string;
  hls_master?: string;
  fallback?: string;
  session_id?: string;
  drm?: Record<string, string>;
  ready?: boolean;
};

export type DocumentDetail = {
  id: number;
  title: string;
  author?: string;
  format?: string;
  pages?: number;
  file_path?: string;
};

export type DocumentPreviewInfo = {
  needs_preview: boolean;
  preview_ready: boolean;
  preview_url?: string;
  conversion_enabled?: boolean;
};

export type ReadProgress = {
  position: number;
  percent: number;
  updated_at?: string;
};

export type MpvStatus = {
  playing: boolean;
  paused: boolean;
  position: number;
  duration: number;
  volume: number;
  hovering: boolean;
};
