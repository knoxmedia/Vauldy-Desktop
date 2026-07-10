import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  addFavorite,
  fetchFavoriteStatus,
  fetchMediaDetail,
  removeFavorite,
} from "@/api/client";
import { PageLayout } from "@/components/AppShell";
import LoadingState from "@/components/LoadingState";
import { formatDuration, mediaPosterSrc, mediaReleaseYear } from "@/lib/mediaUrl";
import "./MediaDetailPage.css";

export default function MediaDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const mediaId = Number(id);
  const [item, setItem] = useState<Awaited<ReturnType<typeof fetchMediaDetail>> | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMediaDetail(mediaId), fetchFavoriteStatus(mediaId)])
      .then(([detail, fav]) => {
        setItem(detail);
        setFavorited(fav);
      })
      .catch(() => {
        setItem(null);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [mediaId]);

  if (loading) {
    return (
      <PageLayout title={t("media.overview")}>
        <LoadingState />
      </PageLayout>
    );
  }

  if (!item || error) {
    return (
      <PageLayout title={t("common.error")}>
        <div className="empty-state">{t("common.error")}</div>
      </PageLayout>
    );
  }

  const poster = mediaPosterSrc(item);
  const year = mediaReleaseYear(item);

  const primaryAction = () => {
    if (item.file_type === "video" || item.file_type === "audio") return navigate(`/player/${item.id}`);
    if (item.file_type === "image") return navigate(`/photo/${item.id}`);
    if (item.file_type === "document") return navigate(`/reader/${item.id}`);
  };

  const actionLabel =
    item.file_type === "video"
      ? t("media.play_video")
      : item.file_type === "audio"
        ? t("media.play_audio")
        : item.file_type === "image"
          ? t("media.view_photo")
          : t("media.read_document");

  async function toggleFavorite() {
    try {
      if (favorited) {
        await removeFavorite(item!.id);
        setFavorited(false);
      } else {
        await addFavorite(item!.id);
        setFavorited(true);
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <PageLayout title={item.title || item.file_path}>
      <div className="media-detail">
        <div className="media-detail-hero">
          {poster ? (
            <img src={poster} alt="" className="media-detail-poster" />
          ) : (
            <div className="media-detail-poster media-detail-placeholder">▶</div>
          )}
        </div>
        <div className="media-detail-body">
          <h1>{item.title || item.file_path}</h1>
          <div className="media-detail-meta">
            {year ? <span>{t("media.year")}: {year}</span> : null}
            {item.duration > 0 ? <span>{formatDuration(item.duration)}</span> : null}
          </div>
          {item.overview ? (
            <div className="media-detail-block">
              <h3>{t("media.overview")}</h3>
              <p>{item.overview}</p>
            </div>
          ) : null}
          <div className="media-detail-actions">
            <button type="button" className="btn btn-primary" onClick={primaryAction}>
              {actionLabel}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void toggleFavorite()}>
              {favorited ? t("common.unfavorite") : t("common.favorite")}
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
