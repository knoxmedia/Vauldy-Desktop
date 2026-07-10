import type { MediaItem } from "@/api/types";
import { formatDuration, mediaPosterSrc, mediaReleaseYear } from "@/lib/mediaUrl";
import "./MediaCard.css";

type Props = {
  item: MediaItem;
  onClick: () => void;
  aspect?: "poster" | "landscape";
  progress?: number;
};

export default function MediaCard({ item, onClick, aspect = "poster", progress }: Props) {
  const poster = mediaPosterSrc(item);
  const year = mediaReleaseYear(item);
  const landscape = aspect === "landscape";

  return (
    <button type="button" className={`media-card ${landscape ? "landscape" : ""}`} onClick={onClick}>
      <div className={`media-card-poster ${landscape ? "landscape" : ""}`}>
        {poster ? (
          <img src={poster} alt="" loading="lazy" />
        ) : (
          <div className="media-card-placeholder">▶</div>
        )}
        {item.file_type === "video" && item.duration > 0 ? (
          <span className="media-card-duration">{formatDuration(item.duration)}</span>
        ) : null}
        {typeof progress === "number" && progress > 0 ? (
          <div className="media-card-progress">
            <div style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
        ) : null}
      </div>
      <div className="media-card-meta">
        <div className="media-card-title">{item.title || item.file_path}</div>
        {year ? <div className="media-card-year">{year}</div> : null}
      </div>
    </button>
  );
}
