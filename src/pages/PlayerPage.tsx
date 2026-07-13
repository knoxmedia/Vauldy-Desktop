import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useT } from "@/i18n";
import {
  fetchMediaDetail,
  fetchPlaybackPlan,
  playbackEnd,
  playbackStart,
  saveProgress,
} from "@/api/client";
import type { PlaybackPlan } from "@/api/types";
import LoadingState from "@/components/LoadingState";
import { IconCenterPlay } from "@/components/PlayerIcons";
import VideoControlBar from "@/components/VideoControlBar";
import { useWebHls } from "@/hooks/useWebHls";
import {
  isTauri,
  measureElementBounds,
  mpvPlayEmbedded,
  mpvRestoreEmbed,
  mpvSeek,
  mpvSetVolume,
  mpvStatus,
  mpvStop,
  mpvSyncEmbed,
  mpvTogglePause,
  toggleWindowFullscreen,
} from "@/hooks/useMpv";
import {
  buildMediaProfile,
  decidePlaybackEngine,
  getPlayerEnginePref,
  isDrmPlaybackMode,
  isHlsPlaybackMode,
  resolveWebPlaybackUrl,
  shouldSkipHlsForMpv,
  type EngineDecision,
} from "@/lib/playbackStrategy";
import { formatErrorMessage } from "@/lib/errors";
import { mediaPlaySrc, mediaPosterSrc, resolveMpvPlaybackUrl, resolvePlaybackUrl, withAccessToken } from "@/lib/mediaUrl";
import { usePlayerStore } from "@/store/player";

export default function PlayerPage() {
  const t = useT();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const mediaId = Number(id);
  const startSec = Number(searchParams.get("t") || "0") || 0;

  const surfaceRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLVideoElement>(null);
  const hideUiTimer = useRef<number | null>(null);
  const syncRafRef = useRef<number | null>(null);
  const mpvFallbackTried = useRef(false);
  const surfaceClickTimer = useRef<number | null>(null);

  const [uri, setUri] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlaybackPlan | null>(null);
  const [engineDecision, setEngineDecision] = useState<EngineDecision | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [audioOnly, setAudioOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useMpvVideo, setUseMpvVideo] = useState(false);
  const [useWebVideo, setUseWebVideo] = useState(false);
  const [showChrome, setShowChrome] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const volumeBeforeMute = useRef(100);
  const mutedRef = useRef(false);

  const lastPosition = useRef(0);
  const pollRef = useRef<number | null>(null);

  const useHls = Boolean(
    useWebVideo && plan && isHlsPlaybackMode(plan.mode) && (plan.hls_master || uri?.includes(".m3u8")),
  );

  useWebHls(mediaRef, uri, useHls);

  const CHROME_HIDE_MS = 2500;

  const revealChrome = useCallback(() => {
    setShowChrome(true);
    if (hideUiTimer.current) window.clearTimeout(hideUiTimer.current);
    hideUiTimer.current = window.setTimeout(() => setShowChrome(false), CHROME_HIDE_MS);
  }, []);

  const hideChromeNow = useCallback(() => {
    if (hideUiTimer.current) window.clearTimeout(hideUiTimer.current);
    hideUiTimer.current = null;
    setShowChrome(false);
  }, []);

  const keepChromeVisible = useCallback(() => {
    setShowChrome(true);
    if (hideUiTimer.current) window.clearTimeout(hideUiTimer.current);
    hideUiTimer.current = null;
  }, []);

  const syncMpvBounds = useCallback(() => {
    const el = surfaceRef.current;
    if (!el || !useMpvVideo) return;
    const bounds = measureElementBounds(el);
    void mpvSyncEmbed(bounds);
  }, [useMpvVideo]);

  const scheduleSyncMpvBounds = useCallback(() => {
    if (syncRafRef.current) cancelAnimationFrame(syncRafRef.current);
    syncRafRef.current = requestAnimationFrame(() => {
      syncRafRef.current = null;
      syncMpvBounds();
    });
  }, [syncMpvBounds]);

  const resyncAfterLayout = useCallback(() => {
    for (const delay of [0, 50, 150, 300, 600]) {
      window.setTimeout(() => scheduleSyncMpvBounds(), delay);
    }
  }, [scheduleSyncMpvBounds]);

  const startMpvPlayback = useCallback(
    async (playUrl: string, cancelled: () => boolean) => {
      for (let i = 0; i < 60; i++) {
        if (cancelled()) return;
        const el = surfaceRef.current;
        if (el && el.clientWidth > 0 && el.clientHeight > 0) break;
        await new Promise((r) => window.setTimeout(r, 50));
      }
      const surface = surfaceRef.current;
      if (!surface || surface.clientWidth <= 0) {
        throw new Error("surface missing");
      }
      const bounds = measureElementBounds(surface);
      await mpvPlayEmbedded(playUrl, bounds, startSec);
      if (cancelled()) return;

      setUseMpvVideo(true);
      setUseWebVideo(false);
      scheduleSyncMpvBounds();
      for (const delay of [0, 80, 200, 500, 1000]) {
        window.setTimeout(() => {
          void mpvRestoreEmbed();
          scheduleSyncMpvBounds();
        }, delay);
      }

      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = window.setInterval(() => {
        void (async () => {
          const s = await mpvStatus();
          if (!s) return;
          // 不用 s.hovering 强制显示控件，否则指针在窗内时永远不会自动隐藏
          lastPosition.current = s.position;
          setPlaying(!s.paused);
          setPosition(s.position);
          setDuration(s.duration);
          if (!mutedRef.current) setVolume(s.volume);
          usePlayerStore.getState().setPlaybackState(!s.paused, s.position, s.duration);
        })();
      }, 500);
    },
    [scheduleSyncMpvBounds, startSec],
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    setUri(null);
    setPlan(null);
    setEngineDecision(null);
    setIsVideo(false);
    setUseMpvVideo(false);
    setUseWebVideo(false);
    mpvFallbackTried.current = false;

    (async () => {
      try {
        const detail = await fetchMediaDetail(mediaId);
        const poster = mediaPosterSrc(detail);
        const video = detail.file_type === "video";
        const audio = detail.file_type === "audio";
        setAudioOnly(audio);
        setIsVideo(video);
        usePlayerStore.getState().setNowPlaying(detail, poster || null);
        await playbackStart(mediaId);

        let playUrl = mediaPlaySrc(mediaId);
        let playbackPlan: PlaybackPlan | null = null;
        let decision: EngineDecision | null = null;

        if (video) {
          const pref = getPlayerEnginePref();
          const profile = buildMediaProfile(detail);
          const skipHls = shouldSkipHlsForMpv(profile, pref, isTauri());

          if (skipHls) {
            playbackPlan = { mode: "native", playUrl: mediaPlaySrc(mediaId) };
            decision = decidePlaybackEngine(profile, playbackPlan, pref);
            playUrl = resolveMpvPlaybackUrl(playbackPlan, mediaId);
          } else {
            playbackPlan = await fetchPlaybackPlan(mediaId);
            decision = decidePlaybackEngine(profile, playbackPlan, pref);

            if (decision.engine === "web") {
              const webPath = resolveWebPlaybackUrl(playbackPlan, mediaId, playbackPlan.mode);
              playUrl = withAccessToken(webPath);
            } else if (isDrmPlaybackMode(playbackPlan.mode)) {
              playUrl = resolvePlaybackUrl(playbackPlan, mediaId);
            } else {
              playUrl = resolveMpvPlaybackUrl(playbackPlan, mediaId);
            }
          }
        }

        if (!mounted) return;
        if (!playUrl?.trim()) throw new Error("empty playback url");

        setPlan(playbackPlan);
        setEngineDecision(decision);
        setUri(playUrl);

        if (video && decision?.engine === "web") {
          setUseWebVideo(true);
        }
      } catch (e: unknown) {
        if (mounted) {
          const msg = formatErrorMessage(e);
          setError(msg || t("pages.player.play_prep_failed"));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
      if (syncRafRef.current) cancelAnimationFrame(syncRafRef.current);
      syncRafRef.current = null;
      if (hideUiTimer.current) window.clearTimeout(hideUiTimer.current);
      void playbackEnd(mediaId);
      if (lastPosition.current > 0) {
        void saveProgress(mediaId, Math.floor(lastPosition.current));
      }
      void mpvStop();
      usePlayerStore.getState().clear();
    };
  }, [mediaId, startSec, t]);

  useEffect(() => {
    if (!uri || !isVideo || !isTauri() || useMpvVideo || useWebVideo || error) return;

    let cancelled = false;

    (async () => {
      try {
        await startMpvPlayback(uri, () => cancelled);
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = formatErrorMessage(e);
          setError(msg || t("pages.player.play_prep_failed"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uri, isVideo, useMpvVideo, useWebVideo, error, startMpvPlayback, t]);

  const tryMpvFallback = useCallback(async () => {
    if (!uri || !plan || !isTauri() || mpvFallbackTried.current || useMpvVideo) return;
    mpvFallbackTried.current = true;
    const mpvUrl = resolveMpvPlaybackUrl(plan, mediaId);
    setUseWebVideo(false);
    setEngineDecision({ engine: "mpv", reason: t("desktop.player_engine.fallback_mpv"), confidence: "recommend" });
    try {
      await startMpvPlayback(mpvUrl, () => false);
    } catch (e: unknown) {
      setError(formatErrorMessage(e) || t("pages.player.play_prep_failed"));
    }
  }, [uri, plan, mediaId, useMpvVideo, startMpvPlayback, t]);

  useEffect(() => {
    if (!useMpvVideo) return;
    const el = surfaceRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => scheduleSyncMpvBounds());
    ro.observe(el);

    const onResize = () => scheduleSyncMpvBounds();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);

    let unlistenScale: (() => void) | undefined;
    let unlistenFocus: (() => void) | undefined;
    let unlistenMoved: (() => void) | undefined;
    let unlistenResized: (() => void) | undefined;
    const win = getCurrentWindow();

    void win.onScaleChanged(() => resyncAfterLayout()).then((fn) => {
      unlistenScale = fn;
    }).catch(() => undefined);
    void win.onFocusChanged(({ payload: focused }) => {
      if (focused) {
        void mpvRestoreEmbed();
        resyncAfterLayout();
        for (const delay of [50, 150, 400]) {
          window.setTimeout(() => {
            void mpvRestoreEmbed();
            scheduleSyncMpvBounds();
          }, delay);
        }
      }
    }).then((fn) => {
      unlistenFocus = fn;
    }).catch(() => undefined);
    void win.onMoved(() => scheduleSyncMpvBounds()).then((fn) => {
      unlistenMoved = fn;
    }).catch(() => undefined);
    void win.onResized(() => resyncAfterLayout()).then((fn) => {
      unlistenResized = fn;
    }).catch(() => undefined);

    scheduleSyncMpvBounds();

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      unlistenScale?.();
      unlistenFocus?.();
      unlistenMoved?.();
      unlistenResized?.();
      void mpvSyncEmbed({ x: 0, y: 0, width: 1, height: 1, visible: false });
    };
  }, [useMpvVideo, scheduleSyncMpvBounds, resyncAfterLayout]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !uri || useMpvVideo || !useWebVideo) return;

    const onTime = () => {
      lastPosition.current = media.currentTime;
      setPosition(media.currentTime);
      setDuration(media.duration || 0);
      setPlaying(!media.paused);
      usePlayerStore.getState().setPlaybackState(!media.paused, media.currentTime, media.duration || 0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => {
      void tryMpvFallback();
    };

    media.addEventListener("timeupdate", onTime);
    media.addEventListener("play", onPlay);
    media.addEventListener("pause", onPause);
    media.addEventListener("error", onError);
    media.addEventListener("ended", () => {
      void saveProgress(mediaId, Math.floor(media.currentTime), true);
    });

    if (!useHls && startSec > 0) media.currentTime = startSec;
    if (!useHls) {
      void media.play().catch(() => {
        void tryMpvFallback();
      });
    } else {
      const onLoaded = () => {
        if (startSec > 0) media.currentTime = startSec;
        void media.play().catch(() => {
          void tryMpvFallback();
        });
      };
      media.addEventListener("loadedmetadata", onLoaded);
      return () => {
        media.removeEventListener("timeupdate", onTime);
        media.removeEventListener("play", onPlay);
        media.removeEventListener("pause", onPause);
        media.removeEventListener("error", onError);
        media.removeEventListener("loadedmetadata", onLoaded);
      };
    }

    return () => {
      media.removeEventListener("timeupdate", onTime);
      media.removeEventListener("play", onPlay);
      media.removeEventListener("pause", onPause);
      media.removeEventListener("error", onError);
    };
  }, [uri, useMpvVideo, useWebVideo, useHls, mediaId, startSec, tryMpvFallback]);

  useEffect(() => {
    revealChrome();
    return () => {
      if (hideUiTimer.current) window.clearTimeout(hideUiTimer.current);
      if (surfaceClickTimer.current) window.clearTimeout(surfaceClickTimer.current);
    };
  }, [revealChrome]);

  useEffect(() => {
    if (!isTauri()) {
      const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
      document.addEventListener("fullscreenchange", onFs);
      return () => document.removeEventListener("fullscreenchange", onFs);
    }
    let unlisten: (() => void) | undefined;
    void getCurrentWindow()
      .onResized(() => {
        void getCurrentWindow()
          .isFullscreen()
          .then(setFullscreen)
          .catch(() => undefined);
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => undefined);
    void getCurrentWindow()
      .isFullscreen()
      .then(setFullscreen)
      .catch(() => undefined);
    return () => unlisten?.();
  }, []);

  const handleTogglePlay = () => {
    revealChrome();
    if (useMpvVideo) {
      void mpvTogglePause();
      return;
    }
    const media = mediaRef.current;
    if (!media) return;
    if (media.paused) void media.play();
    else media.pause();
  };

  const handleSurfaceClick = () => {
    // 延迟区分单击/双击，避免双击全屏时误触发暂停
    if (surfaceClickTimer.current) {
      window.clearTimeout(surfaceClickTimer.current);
      surfaceClickTimer.current = null;
      return;
    }
    surfaceClickTimer.current = window.setTimeout(() => {
      surfaceClickTimer.current = null;
      handleTogglePlay();
    }, 220);
  };

  const handleSurfaceDoubleClick = () => {
    if (surfaceClickTimer.current) {
      window.clearTimeout(surfaceClickTimer.current);
      surfaceClickTimer.current = null;
    }
    void handleFullscreen();
  };

  const handleSeek = (seconds: number) => {
    if (useMpvVideo) {
      void mpvSeek(seconds);
      return;
    }
    const media = mediaRef.current;
    if (media) media.currentTime = seconds;
  };

  const handleVolume = (v: number) => {
    setVolume(v);
    if (v > 0) {
      setMuted(false);
      mutedRef.current = false;
      volumeBeforeMute.current = v;
    } else {
      setMuted(true);
      mutedRef.current = true;
    }
    if (useMpvVideo) {
      void mpvSetVolume(v);
      return;
    }
    const media = mediaRef.current;
    if (media) {
      media.muted = v <= 0;
      media.volume = Math.max(v, 0) / 100;
    }
  };

  const handleToggleMute = () => {
    if (muted || volume <= 0) {
      const restore = volumeBeforeMute.current > 0 ? volumeBeforeMute.current : 100;
      setMuted(false);
      mutedRef.current = false;
      setVolume(restore);
      if (useMpvVideo) {
        void mpvSetVolume(restore);
      } else {
        const media = mediaRef.current;
        if (media) {
          media.muted = false;
          media.volume = restore / 100;
        }
      }
      return;
    }
    volumeBeforeMute.current = volume > 0 ? volume : 100;
    setMuted(true);
    mutedRef.current = true;
    if (useMpvVideo) {
      void mpvSetVolume(0);
    } else {
      const media = mediaRef.current;
      if (media) media.muted = true;
    }
  };

  const handleFullscreen = async () => {
    if (useMpvVideo && isTauri()) {
      const next = await toggleWindowFullscreen();
      setFullscreen(next);
      resyncAfterLayout();
      return;
    }
    const media = mediaRef.current;
    if (!media) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      setFullscreen(false);
      return;
    }
    if (media.requestFullscreen) {
      await media.requestFullscreen();
      setFullscreen(true);
    }
  };

  const mpvBooting = Boolean(uri && isVideo && isTauri() && !useMpvVideo && !useWebVideo && !error);

  useEffect(() => {
    const active = Boolean(isTauri() && (useMpvVideo || mpvBooting));
    document.documentElement.classList.toggle("mpv-embed-active", active);
    return () => {
      document.documentElement.classList.remove("mpv-embed-active");
    };
  }, [useMpvVideo, mpvBooting]);

  if (!uri && loading) {
    return (
      <div className="player-page">
        <LoadingState label={t("pages.player.preparing")} />
      </div>
    );
  }

  if (error || !uri) {
    return (
      <div className="player-page">
        <div className="empty-state">
          <p>{error || t("pages.player.play_prep_failed")}</p>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            {t("common.back")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`player-page${useMpvVideo || mpvBooting ? " player-page--mpv" : ""}`}
      onMouseMove={revealChrome}
      onMouseLeave={hideChromeNow}
    >
      {engineDecision ? (
        <div
          className={`player-engine-badge${showChrome ? "" : " player-engine-badge--hidden"}`}
          title={engineDecision.reason}
        >
          {engineDecision.engine === "web"
            ? t("desktop.player_engine.badge_web")
            : t("desktop.player_engine.badge_mpv")}
        </div>
      ) : null}

      <button
        type="button"
        className={`player-back-btn${showChrome ? "" : " player-back-btn--hidden"}`}
        onMouseEnter={revealChrome}
        onClick={() => navigate(-1)}
        aria-label={t("pages.player.aria_back")}
        title={t("common.back")}
      >
        <ArrowLeftOutlined />
      </button>

      <div ref={surfaceRef} className="player-surface" data-mpv-embed-placeholder>
        {mpvBooting ? <LoadingState label={t("pages.player.preparing")} /> : null}
        {!useMpvVideo ? (
          <video
            ref={mediaRef}
            className="player-video"
            src={useHls ? undefined : uri}
            autoPlay={!useHls}
            playsInline
            style={audioOnly ? { width: 0, height: 0, opacity: 0 } : undefined}
          />
        ) : null}
      </div>

      <div
        className="player-gesture-layer"
        onClick={handleSurfaceClick}
        onDoubleClick={handleSurfaceDoubleClick}
        aria-hidden
      >
        {!playing ? (
          <button
            type="button"
            className="player-center-play"
            onClick={(e) => {
              e.stopPropagation();
              if (surfaceClickTimer.current) {
                window.clearTimeout(surfaceClickTimer.current);
                surfaceClickTimer.current = null;
              }
              handleTogglePlay();
            }}
            aria-label={t("common.play")}
            title={t("common.play")}
          >
            <IconCenterPlay className="player-center-play__icon" />
          </button>
        ) : null}
      </div>

      <VideoControlBar
        className={showChrome ? "" : "video-control-bar--hidden"}
        playing={playing}
        position={position}
        duration={duration}
        volume={volume}
        muted={muted}
        fullscreen={fullscreen}
        onTogglePlay={handleTogglePlay}
        onSeek={handleSeek}
        onVolumeChange={handleVolume}
        onToggleMute={handleToggleMute}
        onFullscreen={handleFullscreen}
        onMouseMove={revealChrome}
        onMouseEnter={keepChromeVisible}
        onInteract={revealChrome}
        playLabel={t("common.play")}
        pauseLabel={t("common.pause")}
        fullscreenLabel={t("music_player_bar.aria_fullscreen")}
        muteLabel="静音"
        unmuteLabel="取消静音"
      />
    </div>
  );
}
