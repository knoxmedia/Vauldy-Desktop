import axios, { type AxiosInstance } from "axios";
import { useAuthStore } from "@/store/auth";
import { useConfigStore } from "@/store/config";
import type {
  BrandingInfo,
  DocumentDetail,
  DocumentPreviewInfo,
  HistoryItem,
  Library,
  MediaItem,
  PlaybackPlan,
  ReadProgress,
  SessionUserInfo,
} from "./types";

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

function createApi(): AxiosInstance {
  const instance = axios.create({ timeout: 120000 });
  instance.interceptors.request.use((config) => {
    const base = useConfigStore.getState().serverUrl;
    if (base) config.baseURL = base;
    const token = useAuthStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      const status = err?.response?.status;
      const url: string = err?.config?.url || "";
      if (status === 401 && !url.includes("/user/login")) {
        useAuthStore.getState().clearSession();
        onUnauthorized?.();
      }
      return Promise.reject(err);
    },
  );
  return instance;
}

const api = createApi();

export async function checkHealth(): Promise<boolean> {
  const { data } = await api.get<{ status: string }>("/health");
  return data?.status === "ok";
}

export async function fetchBranding(): Promise<BrandingInfo> {
  const { data } = await api.get<BrandingInfo>("/api/v1/branding");
  return data;
}

export async function login(username: string, password: string): Promise<string> {
  const { data } = await api.post<{ token: string }>("/api/v1/user/login", { username, password });
  return data.token;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/api/v1/user/logout");
  } catch {
    /* ignore */
  }
}

export async function fetchUserInfo(): Promise<SessionUserInfo> {
  const { data } = await api.get<SessionUserInfo>("/api/v1/user/info");
  return data;
}

export async function updateUserProfile(payload: { ui_locale?: string }) {
  const { data } = await api.put("/api/v1/user/profile", payload);
  return data;
}

export async function fetchLibraries(): Promise<Library[]> {
  const { data } = await api.get<{ items?: Library[] }>("/api/v1/library");
  return data?.items ?? [];
}

export async function fetchMedia(
  libraryId?: number,
  opts?: {
    sort?: "id_desc" | "created_desc" | "taken_desc";
    limit?: number;
    file_type?: string;
    q?: string;
  },
): Promise<MediaItem[]> {
  const params: Record<string, string | number> = {};
  if (libraryId !== undefined) params.library_id = libraryId;
  if (opts?.sort) params.sort = opts.sort;
  if (opts?.limit !== undefined) params.limit = opts.limit;
  if (opts?.file_type) params.file_type = opts.file_type;
  if (opts?.q) params.q = opts.q;
  const { data } = await api.get<{ items?: MediaItem[] }>("/api/v1/media", { params });
  return data?.items ?? [];
}

export async function fetchMediaDetail(mediaId: number): Promise<MediaItem> {
  const { data } = await api.get<MediaItem>(`/api/v1/media/${mediaId}`);
  return data;
}

export async function fetchUserHistory(limit = 24): Promise<HistoryItem[]> {
  const { data } = await api.get<{ items?: HistoryItem[] }>("/api/v1/user/history", { params: { limit } });
  return data?.items ?? [];
}

export async function fetchFavorites(): Promise<MediaItem[]> {
  const { data } = await api.get<{ items?: MediaItem[] }>("/api/v1/favorites");
  return data?.items ?? [];
}

export async function fetchFavoriteStatus(mediaId: number): Promise<boolean> {
  const { data } = await api.get<{ favorited: boolean }>(`/api/v1/media/${mediaId}/favorite`);
  return data.favorited;
}

export async function addFavorite(mediaId: number): Promise<void> {
  await api.post(`/api/v1/media/${mediaId}/favorite`);
}

export async function removeFavorite(mediaId: number): Promise<void> {
  await api.delete(`/api/v1/media/${mediaId}/favorite`);
}

export async function fetchPlaybackPlan(mediaId: number): Promise<PlaybackPlan> {
  const { data } = await api.get<PlaybackPlan>(`/api/v1/media/${mediaId}/hls`);
  return data;
}

export async function saveProgress(mediaId: number, position: number, completed = false): Promise<void> {
  await api.post(`/api/v1/media/${mediaId}/progress`, { position, completed });
}

export async function fetchDocumentDetail(mediaId: number): Promise<DocumentDetail> {
  const { data } = await api.get<DocumentDetail>(`/api/v1/media/${mediaId}/document`);
  return data;
}

export async function fetchDocumentPreviewInfo(mediaId: number): Promise<DocumentPreviewInfo> {
  const { data } = await api.get<DocumentPreviewInfo>(`/api/v1/media/${mediaId}/document/preview/info`);
  return data;
}

export async function fetchReadProgress(mediaId: number): Promise<ReadProgress | null> {
  const { data } = await api.get<ReadProgress | null>(`/api/v1/media/${mediaId}/read-progress`);
  return data;
}

export async function saveReadProgress(mediaId: number, position: number, percent: number): Promise<void> {
  await api.post(`/api/v1/media/${mediaId}/read-progress`, { position, percent });
}

export async function playbackStart(mediaId: number): Promise<void> {
  try {
    await api.post(`/api/v1/media/${mediaId}/playback/start`);
  } catch {
    /* ignore */
  }
}

export async function playbackEnd(mediaId: number): Promise<void> {
  try {
    await api.post(`/api/v1/media/${mediaId}/playback/end`);
  } catch {
    /* ignore */
  }
}
