import { useAuthStore } from "@/store/auth";
import { useConfigStore } from "@/store/config";

export function normalizeListPosterUrl(raw: string): string {
  let s = (raw || "").trim();
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    try {
      const parsed = JSON.parse(s) as unknown;
      if (typeof parsed === "string") s = parsed;
      else s = s.slice(1, -1);
    } catch {
      s = s.slice(1, -1);
    }
  }
  return s.trim();
}

export function withAccessToken(url: string): string {
  const u = (url || "").trim();
  if (!u) return u;
  const token = useAuthStore.getState().token;
  if (!token) return u;
  const base = useConfigStore.getState().serverUrl || "";
  const full = u.startsWith("http") ? u : `${base}${u.startsWith("/") ? "" : "/"}${u}`;
  const sep = full.includes("?") ? "&" : "?";
  return `${full}${sep}access_token=${encodeURIComponent(token)}`;
}

export function absoluteUrl(path: string): string {
  const p = (path || "").trim();
  if (!p) return "";
  if (p.startsWith("http")) return p;
  const base = useConfigStore.getState().serverUrl || "";
  return `${base}${p.startsWith("/") ? "" : "/"}${p}`;
}

export function photoThumbSrc(id: number): string {
  return withAccessToken(`/api/v1/media/${id}/photo/thumb.jpg`);
}

export function photoMediumSrc(id: number): string {
  return withAccessToken(`/api/v1/media/${id}/photo/medium.jpg`);
}

export function photoOriginalSrc(id: number): string {
  return withAccessToken(`/api/v1/media/${id}/play`);
}

export function documentCoverSrc(id: number): string {
  return withAccessToken(`/api/v1/media/${id}/document/cover.jpg`);
}

export function derivedVideoPosterSrc(id: number): string {
  return withAccessToken(`/api/v1/media/${id}/poster.jpg`);
}

export function localPosterSrc(id: number, encryptedAsset?: boolean | number): string {
  if (encryptedAsset) return derivedVideoPosterSrc(id);
  return absoluteUrl(`/uploads/posters/${id}.jpg`);
}

export function albumArtworkSrc(albumId: number): string {
  return withAccessToken(`/api/v1/album/${albumId}/artwork`);
}

export function musicMediaPosterSrc(
  r: Pick<import("@/api/types").MediaItem, "id" | "poster_url" | "music_album_id" | "file_type">,
): string | null {
  if (r.file_type !== "audio") return mediaPosterSrc(r);
  if (r.music_album_id && r.music_album_id > 0) return albumArtworkSrc(r.music_album_id);
  const u = normalizeListPosterUrl(r.poster_url || "");
  return u ? withAccessToken(u) : null;
}

export function mediaPosterSrc(
  r: Pick<import("@/api/types").MediaItem, "id" | "poster_url" | "music_album_id" | "encrypted_asset"> & {
    file_type?: string;
  },
): string {
  if (r.file_type === "audio") return musicMediaPosterSrc({ ...r, file_type: "audio" }) ?? "";
  if (r.file_type === "image") return photoThumbSrc(r.id);
  if (r.file_type === "document") return documentCoverSrc(r.id);
  const u = normalizeListPosterUrl(r.poster_url || "");
  if (u) return withAccessToken(u);
  return localPosterSrc(r.id, r.encrypted_asset);
}

export function mediaPlaySrc(mediaId: number): string {
  return withAccessToken(`/api/v1/media/${mediaId}/play`);
}

export function documentPreviewSrc(mediaId: number): string {
  return withAccessToken(`/api/v1/media/${mediaId}/document/preview.pdf`);
}

export function formatDuration(sec: number): string {
  if (!sec || sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function mediaReleaseYear(
  m: Pick<import("@/api/types").MediaItem, "year" | "release_date" | "file_path">,
): string {
  if (typeof m.year === "number" && m.year > 0) return String(m.year);
  const rd = (m.release_date || "").trim();
  if (rd.length >= 4 && /^\d{4}/.test(rd)) return rd.slice(0, 4);
  const match = m.file_path?.match(/(19|20)\d{2}/);
  return match ? match[0] : "";
}

export function resolvePlaybackUrl(
  plan: {
    playUrl?: string;
    hls_master?: string;
    fallback?: string;
    mode?: string;
  },
  mediaId: number,
  opts?: { preferDirect?: boolean },
): string {
  const mode = (plan.mode || "").trim().toLowerCase();
  if (mode === "native" && plan.playUrl) {
    return withAccessToken(plan.playUrl);
  }

  const hlsModes = new Set(["hls", "hls_drm", "hls_aes_128", "hls_powerdrm", "jit_hls"]);
  const preferDirect = opts?.preferDirect ?? false;

  if (preferDirect) {
    if (plan.playUrl) return withAccessToken(plan.playUrl);
    if (plan.fallback) return withAccessToken(plan.fallback);
  }
  if (plan.hls_master && hlsModes.has(mode)) {
    return withAccessToken(plan.hls_master);
  }
  if (plan.playUrl) return withAccessToken(plan.playUrl);
  if (plan.hls_master) return withAccessToken(plan.hls_master);
  if (plan.fallback) return withAccessToken(plan.fallback);
  return mediaPlaySrc(mediaId);
}

/** mpv 优先源文件直链，不走 jit_hls / 预转码 HLS */
export function resolveMpvPlaybackUrl(
  plan: {
    playUrl?: string;
    hls_master?: string;
    fallback?: string;
    mode?: string;
  } | null | undefined,
  mediaId: number,
): string {
  const mode = (plan?.mode || "").trim().toLowerCase();
  if (mode === "hls_drm" || mode === "hls_powerdrm") {
    return resolvePlaybackUrl(plan!, mediaId);
  }
  if (plan?.playUrl) return withAccessToken(plan.playUrl);
  if (plan?.fallback) return withAccessToken(plan.fallback);
  return mediaPlaySrc(mediaId);
}
