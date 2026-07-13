import {
  IconExitFullscreen,
  IconFullscreen,
  IconMute,
  IconPause,
  IconPlay,
  IconVolume,
} from "@/components/PlayerIcons";
import { formatDuration } from "@/lib/mediaUrl";
import "./VideoControlBar.css";

export type VideoControlBarProps = {
  className?: string;
  style?: React.CSSProperties;
  playing: boolean;
  position: number;
  duration: number;
  volume: number;
  muted?: boolean;
  fullscreen?: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute?: () => void;
  onFullscreen: () => void;
  onMouseMove?: () => void;
  onMouseEnter?: () => void;
  onInteract?: () => void;
  playLabel: string;
  pauseLabel: string;
  fullscreenLabel: string;
  exitFullscreenLabel?: string;
  muteLabel?: string;
  unmuteLabel?: string;
};

export default function VideoControlBar({
  className = "",
  style,
  playing,
  position,
  duration,
  volume,
  muted = false,
  fullscreen = false,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onFullscreen,
  onMouseMove,
  onMouseEnter,
  onInteract,
  playLabel,
  pauseLabel,
  fullscreenLabel,
  exitFullscreenLabel = "退出全屏",
  muteLabel = "静音",
  unmuteLabel = "取消静音",
}: VideoControlBarProps) {
  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const displayMuted = muted || volume <= 0;
  const volumeValue = displayMuted ? 0 : volume;

  return (
    <div
      className={`video-control-bar ${className}`.trim()}
      style={style}
      onMouseMove={onMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseDown={onInteract}
    >
      <div className="video-control-bar__progress">
        <input
          type="range"
          className="video-control-bar__seek"
          min={0}
          max={100}
          step={0.1}
          value={progress}
          style={{ ["--progress" as string]: `${progress}%` }}
          onChange={(e) => {
            const pct = Number(e.target.value);
            if (duration > 0) onSeek((pct / 100) * duration);
          }}
          aria-label="Seek"
        />
      </div>
      <div className="video-control-bar__row">
        <div className="video-control-bar__left">
          <button
            type="button"
            className="video-control-bar__btn video-control-bar__btn--icon"
            onClick={onTogglePlay}
            aria-label={playing ? pauseLabel : playLabel}
            title={playing ? pauseLabel : playLabel}
          >
            {playing ? <IconPause className="video-control-bar__icon" /> : <IconPlay className="video-control-bar__icon" />}
          </button>
          <span className="video-control-bar__time">
            {formatDuration(position)} / {formatDuration(duration)}
          </span>
        </div>
        <div className="video-control-bar__right">
          <button
            type="button"
            className="video-control-bar__btn video-control-bar__btn--icon video-control-bar__mute"
            onClick={() => onToggleMute?.()}
            aria-label={displayMuted ? unmuteLabel : muteLabel}
            title={displayMuted ? unmuteLabel : muteLabel}
          >
            {displayMuted ? (
              <IconMute className="video-control-bar__icon" />
            ) : (
              <IconVolume className="video-control-bar__icon" />
            )}
          </button>
          <input
            type="range"
            className="video-control-bar__volume"
            min={0}
            max={100}
            value={volumeValue}
            style={{ ["--progress" as string]: `${volumeValue}%` }}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            aria-label="Volume"
          />
          <button
            type="button"
            className="video-control-bar__btn video-control-bar__btn--icon"
            onClick={onFullscreen}
            aria-label={fullscreen ? exitFullscreenLabel : fullscreenLabel}
            title={fullscreen ? exitFullscreenLabel : fullscreenLabel}
          >
            {fullscreen ? (
              <IconExitFullscreen className="video-control-bar__icon" />
            ) : (
              <IconFullscreen className="video-control-bar__icon" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
