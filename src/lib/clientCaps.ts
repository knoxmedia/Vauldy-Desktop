import { isTauri } from "@/hooks/useMpv";

export type ClientCaps = {
  videoCodecs: string[];
  audioCodecs: string[];
  maxHeight: number;
  qualities: string[];
  containers: string[];
  mcap: string;
};

function qualityToDims(q: string): { width: number; height: number } {
  const h = parseInt(q, 10);
  if (h >= 2160) return { width: 3840, height: 2160 };
  if (h >= 1440) return { width: 2560, height: 1440 };
  if (h >= 1080) return { width: 1920, height: 1080 };
  if (h >= 720) return { width: 1280, height: 720 };
  if (h >= 480) return { width: 854, height: 480 };
  return { width: 640, height: 360 };
}

function h264CodecStringForHeight(h: number): string {
  if (h >= 1080) return "avc1.640028";
  if (h >= 720) return "avc1.4D401F";
  return "avc1.42E01E";
}

function bitrateForDims(h: number): number {
  if (h >= 2160) return 12_000_000;
  if (h >= 1080) return 5_000_000;
  if (h >= 720) return 3_000_000;
  if (h >= 480) return 1_500_000;
  return 800_000;
}

async function collectDecodingMcaps(qualities: string[]): Promise<string> {
  const mc = typeof navigator !== "undefined" ? navigator.mediaCapabilities : undefined;
  if (!mc?.decodingInfo) return "";

  const jobs: Promise<string>[] = [];
  for (const q of qualities) {
    const { width, height } = qualityToDims(q);
    const br = bitrateForDims(height);
    const h264Codec = h264CodecStringForHeight(height);
    const h265Mime = 'video/mp4; codecs="hvc1.1.6.L93.B0"';
    const h264Mime = `video/mp4; codecs="${h264Codec}"`;
    const baseVideo = { width, height, bitrate: br, framerate: 30 as const };

    jobs.push(
      mc
        .decodingInfo({
          type: "media-source",
          video: { contentType: h264Mime, ...baseVideo },
        })
        .then(
          (r) =>
            `h264@${height}:${r.supported ? 1 : 0}${r.smooth ? 1 : 0}${r.powerEfficient ? 1 : 0}`,
        )
        .catch(() => `h264@${height}:000`),
    );
    jobs.push(
      mc
        .decodingInfo({
          type: "media-source",
          video: { contentType: h265Mime, ...baseVideo },
        })
        .then(
          (r) =>
            `h265@${height}:${r.supported ? 1 : 0}${r.smooth ? 1 : 0}${r.powerEfficient ? 1 : 0}`,
        )
        .catch(() => `h265@${height}:000`),
    );
  }

  return (await Promise.all(jobs)).join(",");
}

/** 与 web Player.tsx 一致：探测 WebView 可解码能力，供 /hls 路由决策 */
export async function detectWebClientCaps(): Promise<ClientCaps> {
  const probe = document.createElement("video");
  const supports = (mime: string) => {
    try {
      return probe.canPlayType(mime) !== "";
    } catch {
      return false;
    }
  };

  const containers: string[] = [];
  if (supports("video/mp4") || supports('video/mp4; codecs="avc1.42E01E"')) containers.push("mp4");
  if (supports("video/x-matroska") || supports('video/x-matroska; codecs="avc1.42E01E"')) {
    containers.push("mkv");
  }
  if (supports("video/webm") || supports('video/webm; codecs="vp09.00.10.08"')) containers.push("webm");
  if (supports("video/ogg") || supports("application/ogg") || supports('video/ogg; codecs="theora"')) {
    containers.push("ogg");
  }

  const videoCodecs: string[] = [];
  if (supports('video/mp4; codecs="avc1.42E01E"')) videoCodecs.push("h264");
  if (
    supports('video/mp4; codecs="hvc1.1.6.L93.B0"') ||
    supports('video/mp4; codecs="hev1.1.6.L93.B0"')
  ) {
    videoCodecs.push("h265");
  }
  if (supports('video/mp4; codecs="av01.0.05M.08"') || supports('video/webm; codecs="av1"')) {
    videoCodecs.push("av1");
  }
  if (
    supports('video/webm; codecs="vp09.00.10.08"') ||
    supports('video/webm; codecs="vp9"') ||
    supports("video/webm; codecs=vp9")
  ) {
    videoCodecs.push("vp9");
  }
  if (videoCodecs.includes("h264") || videoCodecs.includes("h265")) {
    containers.push("flv");
  }

  const audioCodecs: string[] = [];
  if (supports('audio/mp4; codecs="mp4a.40.2"')) audioCodecs.push("aac");
  if (supports("audio/mpeg")) audioCodecs.push("mp3");
  if (supports('audio/webm; codecs="opus"')) audioCodecs.push("opus");
  if (
    supports('audio/mp4; codecs="ac-3"') ||
    supports("audio/ac3") ||
    supports('video/mp4; codecs="avc1.42E01E, ac-3"')
  ) {
    audioCodecs.push("ac3");
  }
  if (supports('audio/mp4; codecs="ec-3"') || supports('video/mp4; codecs="avc1.42E01E, ec-3"')) {
    audioCodecs.push("eac3");
  }

  const maxHeight = Math.max(360, Math.min(2160, window.screen?.height || 1080));
  const qualities = ["360p", "480p", "720p", "1080p", "1440p", "2160p"].filter(
    (q) => parseInt(q, 10) <= maxHeight,
  );
  const mcap = await collectDecodingMcaps(qualities);

  return { videoCodecs, audioCodecs, maxHeight, qualities, containers, mcap };
}

/** 桌面端 mpv 可直播的扩展能力，让服务端返回 native 而非 jit_hls */
function expandCapsForMpv(web: ClientCaps): ClientCaps {
  const uniq = (items: string[]) => [...new Set(items.map((s) => s.trim().toLowerCase()).filter(Boolean))];

  return {
    videoCodecs: uniq([
      ...web.videoCodecs,
      "h264",
      "h265",
      "hevc",
      "vp9",
      "av1",
      "mpeg2",
      "vc1",
      "wmv3",
      "mpeg4",
    ]),
    audioCodecs: uniq([
      ...web.audioCodecs,
      "aac",
      "mp3",
      "opus",
      "vorbis",
      "ac3",
      "eac3",
      "dts",
      "dtshd",
      "truehd",
      "flac",
      "pcm",
    ]),
    containers: uniq([
      ...web.containers,
      "mp4",
      "m4v",
      "mov",
      "mkv",
      "matroska",
      "webm",
      "flv",
      "ogg",
      "ts",
      "m2ts",
      "mts",
      "avi",
      "wmv",
      "asf",
    ]),
    maxHeight: Math.max(web.maxHeight, 2160),
    qualities: uniq([...web.qualities, "360p", "480p", "720p", "1080p", "1440p", "2160p"]),
    mcap: web.mcap,
  };
}

export async function getPlaybackClientCaps(): Promise<ClientCaps> {
  const web = await detectWebClientCaps();
  if (!isTauri()) return web;
  return expandCapsForMpv(web);
}

export function clientCapsQuery(caps: ClientCaps): Record<string, string> {
  return {
    video_codecs: caps.videoCodecs.join(","),
    audio_codecs: caps.audioCodecs.join(","),
    max_height: String(caps.maxHeight),
    qualities: caps.qualities.join(","),
    containers: caps.containers.join(","),
    mcap: caps.mcap,
  };
}
