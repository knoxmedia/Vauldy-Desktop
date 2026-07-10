import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  fetchMediaDetail,
  fetchPlaybackPlan,
  playbackEnd,
  playbackStart,
  saveProgress,
} from "@/api/client";
import LoadingState from "@/components/LoadingState";
import { isTauri, mpvPlay, mpvStatus, mpvStop, mpvTogglePause } from "@/hooks/useMpv";
import { mediaPlaySrc, mediaPosterSrc, resolvePlaybackUrl } from "@/lib/mediaUrl";
import { usePlayerStore } from "@/store/player";

export default function PlayerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const mediaId = Number(id);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [audioOnly, setAudioOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useWebPlayer, setUseWebPlayer] = useState(!isTauri());
  const lastPosition = useRef(0);
  const pollRef = useRef<number | null>(null);

  const audioOnlyRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const detail = await fetchMediaDetail(mediaId);
        const poster = mediaPosterSrc(detail);
        const isAudio = detail.file_type === "audio";
        audioOnlyRef.current = isAudio;
        setAudioOnly(isAudio);
        usePlayerStore.getState().setNowPlaying(detail, poster || null);
        await playbackStart(mediaId);

        let playUrl = mediaPlaySrc(mediaId);
        if (detail.file_type === "video") {
          const plan = await fetchPlaybackPlan(mediaId);
          playUrl = resolvePlaybackUrl(plan, mediaId);
        }
        if (!mounted) return;
        setUri(playUrl);

        if (isTauri()) {
          try {
            await mpvPlay(playUrl, 0, detail.file_type === "audio");
            setUseWebPlayer(false);
            pollRef.current = window.setInterval(() => {
              void mpvStatus().then((s) => {
                if (!s) return;
                lastPosition.current = s.position;
                usePlayerStore.getState().setPlaybackState(!s.paused, s.position, s.duration);
              });
            }, 1000);
          } catch {
            setUseWebPlayer(true);
          }
        }
      } catch {
        if (mounted) setError(t("player.error"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (pollRef.current) window.clearInterval(pollRef.current);
      void playbackEnd(mediaId);
      if (lastPosition.current > 0) {
        void saveProgress(mediaId, Math.floor(lastPosition.current));
      }
      void mpvStop();
      if (!audioOnlyRef.current) usePlayerStore.getState().clear();
    };
  }, [mediaId, t]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !useWebPlayer || !uri) return;

    const onTime = () => {
      lastPosition.current = video.currentTime;
      usePlayerStore.getState().setPlaybackState(!video.paused, video.currentTime, video.duration || 0);
    };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("ended", () => {
      void saveProgress(mediaId, Math.floor(video.currentTime), true);
    });
    return () => video.removeEventListener("timeupdate", onTime);
  }, [uri, useWebPlayer, mediaId]);

  if (loading) {
    return (
      <div className="player-page">
        <LoadingState label={t("player.loading")} />
      </div>
    );
  }

  if (error || !uri) {
    return (
      <div className="player-page">
        <div className="empty-state">
          <p>{error || t("player.error")}</p>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            {t("common.back")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="player-page">
      <div className="player-toolbar">
        <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
          {t("common.back")}
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => void mpvTogglePause()}>
            {t("player.pause")}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              const v = videoRef.current;
              if (v?.requestFullscreen) void v.requestFullscreen();
            }}
          >
            {t("player.fullscreen")}
          </button>
        </div>
      </div>
      <div className="player-video-wrap">
        {useWebPlayer ? (
          <video
            ref={videoRef}
            className="player-video"
            src={uri}
            controls
            autoPlay
            style={audioOnly ? { width: 0, height: 0 } : undefined}
          />
        ) : (
          <div className="empty-state" style={{ color: "var(--text-secondary)" }}>
            {audioOnly ? t("player.play") : "mpv"}
            {!isTauri() ? null : (
              <span style={{ fontSize: 12 }}>{t("player.mpv_unavailable")}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
