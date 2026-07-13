import type { PlaybackPlan } from "@/api/types";
import type { MediaDetail } from "@/api/client";

export type PlayerEnginePref = "auto" | "mpv" | "web";

export type MediaProfile = {
  container: string;
  video_codec: string;
  audio_codec: string;
  bit_depth: number;
  hdr: string;
  has_complex_subtitle: boolean;
  height: number;
  is_bluray: boolean;
};

export type EngineDecision = {
  engine: "mpv" | "web";
  reason: string;
  confidence: "strict" | "recommend" | "fallback";
};

const STORAGE_KEY = "vauldy-desktop-player-engine";

export function getPlayerEnginePref(): PlayerEnginePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "mpv" || v === "web" || v === "auto") return v;
  } catch {
    /* ignore */
  }
  return "auto";
}

export function setPlayerEnginePref(pref: PlayerEnginePref): void {
  localStorage.setItem(STORAGE_KEY, pref);
}

function norm(s: string): string {
  return (s || "").trim().toLowerCase();
}

function parseMetaCodecs(metaJson?: string): {
  container: string;
  video_codec: string;
  audio_codec: string;
  has_complex_subtitle: boolean;
  bit_depth: number;
  hdr: string;
} {
  const out = {
    container: "",
    video_codec: "",
    audio_codec: "",
    has_complex_subtitle: false,
    bit_depth: 8,
    hdr: "",
  };
  if (!metaJson) return out;
  try {
    const raw = JSON.parse(metaJson) as {
      format?: { format_name?: string };
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        profile?: string;
        pix_fmt?: string;
        color_transfer?: string;
      }>;
    };
    out.container = norm(raw.format?.format_name || "");
    for (const st of raw.streams ?? []) {
      const type = norm(st.codec_type || "");
      const codec = norm(st.codec_name || "");
      if (type === "video" && !out.video_codec) {
        out.video_codec = codec;
        const pf = norm(st.pix_fmt || "");
        if (pf.includes("10") || pf.includes("12")) out.bit_depth = 10;
        const tr = norm(st.color_transfer || "");
        if (tr.includes("2084") || tr.includes("hlg")) out.hdr = "hdr10";
      }
      if (type === "audio" && !out.audio_codec) {
        out.audio_codec = codec;
      }
      if (type === "subtitle" && codec) {
        if (["ass", "ssa", "hdmv_pgs_subtitle", "pgssub", "dvd_subtitle"].includes(codec)) {
          out.has_complex_subtitle = true;
        }
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

export function buildMediaProfile(detail: MediaDetail, _plan?: PlaybackPlan): MediaProfile {
  const meta = parseMetaCodecs(detail.meta_json);
  const format = norm(detail.format || meta.container);
  const container = format.split(",")[0]?.trim() || format;
  const path = norm(detail.file_path || "");

  return {
    container,
    video_codec: meta.video_codec,
    audio_codec: meta.audio_codec,
    bit_depth: meta.bit_depth,
    hdr: meta.hdr,
    has_complex_subtitle: meta.has_complex_subtitle,
    height: detail.height || 0,
    is_bluray: container === "iso" || container === "bdmv" || path.endsWith(".iso"),
  };
}

export function isHlsPlaybackMode(mode?: string): boolean {
  const m = norm(mode || "");
  return ["hls", "hls_drm", "hls_aes_128", "hls_powerdrm", "jit_hls"].includes(m);
}

export function isDrmPlaybackMode(mode?: string): boolean {
  const m = norm(mode || "");
  return ["hls_drm", "hls_powerdrm"].includes(m);
}

/** Desktop mpv 直链播放，避免 /hls 触发 JIT 转码（如家庭流 1080p 上限） */
export function shouldSkipHlsForMpv(
  profile: MediaProfile,
  pref: PlayerEnginePref,
  isDesktop: boolean,
): boolean {
  if (!isDesktop || pref === "web") return false;
  if (pref === "mpv") return true;
  return decidePlaybackEngine(profile, undefined, pref).engine === "mpv";
}

/** Auto 下对 H.264/AAC/MP4 优先 Web，避免 mpv 弹层挡点击 */
export function decidePlaybackEngine(
  profile: MediaProfile,
  plan: PlaybackPlan | undefined,
  pref: PlayerEnginePref,
): EngineDecision {
  if (pref === "mpv") {
    return { engine: "mpv", reason: "用户设置：总是使用 mpv", confidence: "strict" };
  }
  if (pref === "web") {
    return { engine: "web", reason: "用户设置：总是使用 Web 播放", confidence: "strict" };
  }

  const container = norm(profile.container);
  const vcodec = norm(profile.video_codec);
  const acodec = norm(profile.audio_codec);
  const hdr = norm(profile.hdr);
  const mode = norm(plan?.mode || "");

  if (["hls_drm", "hls_powerdrm"].includes(mode)) {
    return { engine: "mpv", reason: "DRM 流需 mpv 播放", confidence: "strict" };
  }

  if (profile.is_bluray || container === "iso" || container === "bdmv") {
    return { engine: "mpv", reason: "蓝光原盘 Web 无法播放", confidence: "strict" };
  }

  const badContainers = ["mkv", "avi", "flv", "rmvb", "rm", "wmv", "asf", "ts", "m2ts", "mts"];
  if (badContainers.includes(container)) {
    return { engine: "mpv", reason: `容器 ${container} 浏览器不支持`, confidence: "strict" };
  }

  const badVcodecs = ["hevc", "h265", "vc1", "mpeg2", "wmv3", "av1"];
  if (badVcodecs.some((c) => vcodec.includes(c))) {
    return { engine: "mpv", reason: `${vcodec || "未知"} 视频编码需 mpv`, confidence: "recommend" };
  }

  const badAcodecs = ["ac3", "eac3", "dts", "dtshd", "truehd", "atmos", "dolby"];
  if (badAcodecs.some((a) => acodec.includes(a))) {
    return { engine: "mpv", reason: `${acodec || "未知"} 音频浏览器不支持`, confidence: "strict" };
  }

  if (hdr && hdr !== "none" && hdr !== "sdr") {
    return { engine: "mpv", reason: "HDR 内容建议 mpv", confidence: "recommend" };
  }

  if (profile.bit_depth >= 10) {
    return { engine: "mpv", reason: "10bit 视频浏览器支持有限", confidence: "recommend" };
  }

  if (profile.has_complex_subtitle) {
    return { engine: "mpv", reason: "ASS/PGS 字幕需 mpv", confidence: "recommend" };
  }

  if (profile.height >= 2160) {
    return { engine: "mpv", reason: "4K 分辨率建议 mpv 硬解", confidence: "recommend" };
  }

  const webContainers = ["mp4", "m4v", "mov", "webm"];
  const webVideo = ["h264", "avc", "avc1"];
  const webAudio = ["aac", "mp3", "opus", "vorbis", ""];

  if (
    webContainers.some((c) => container.includes(c)) &&
    (vcodec === "" || webVideo.some((c) => vcodec.includes(c))) &&
    (acodec === "" || webAudio.includes(acodec) || webAudio.some((c) => acodec.includes(c))) &&
    (mode === "native" || mode === "")
  ) {
    return { engine: "web", reason: "H.264/AAC 浏览器可直接播放", confidence: "fallback" };
  }

  if (mode === "native") {
    return { engine: "mpv", reason: "服务端已判定可直链播放", confidence: "fallback" };
  }

  return { engine: "mpv", reason: "当前媒体特征建议使用 mpv", confidence: "recommend" };
}

export function resolveWebPlaybackUrl(
  plan: PlaybackPlan,
  mediaId: number,
  mode?: string,
): string {
  const m = norm(mode || plan.mode || "");
  if (m === "native" && plan.playUrl) {
    return plan.playUrl;
  }
  if (isHlsPlaybackMode(m) && plan.hls_master) {
    return plan.hls_master;
  }
  if (plan.playUrl) return plan.playUrl;
  if (plan.hls_master) return plan.hls_master;
  if (plan.fallback) return plan.fallback;
  return `/api/v1/media/${mediaId}/play`;
}
