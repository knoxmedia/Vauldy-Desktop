import { useEffect, type RefObject } from "react";
import Hls from "hls.js";

export function useWebHls(videoRef: RefObject<HTMLVideoElement | null>, src: string | null, useHls: boolean) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (!useHls) {
      video.src = src;
      return () => {
        video.removeAttribute("src");
        video.load();
      };
    }

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => {
        hls.destroy();
      };
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    }
    return () => {
      video.removeAttribute("src");
      video.load();
    };
  }, [videoRef, src, useHls]);
}
