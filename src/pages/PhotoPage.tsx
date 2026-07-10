import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchMediaDetail } from "@/api/client";
import LoadingState from "@/components/LoadingState";
import { photoMediumSrc, photoOriginalSrc } from "@/lib/mediaUrl";

export default function PhotoPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const mediaId = Number(id);
  const [uri, setUri] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMediaDetail(mediaId)
      .then(() => setUri(photoMediumSrc(mediaId)))
      .catch(() => setUri(null))
      .finally(() => setLoading(false));
  }, [mediaId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate(-1);
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 4));
      if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 0.5));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  if (loading) {
    return (
      <div className="photo-viewer">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="photo-viewer">
      <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8, zIndex: 2 }}>
        <button type="button" className="btn btn-secondary" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}>
          {t("photo.zoom_out")}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}>
          {t("photo.zoom_in")}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
          {t("common.back")}
        </button>
      </div>
      {uri ? (
        <img
          src={uri}
          alt=""
          style={{ transform: `scale(${zoom})` }}
          onDoubleClick={() => setUri(photoOriginalSrc(mediaId))}
        />
      ) : null}
    </div>
  );
}
