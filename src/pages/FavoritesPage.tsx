import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchFavorites } from "@/api/client";
import type { MediaItem } from "@/api/types";
import { PageLayout } from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import MediaCard from "@/components/MediaCard";

export default function FavoritesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFavorites()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageLayout title={t("favorites.title")}>
      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState message={t("favorites.empty")} />
      ) : (
        <div className="media-grid">
          {items.map((item) => (
            <MediaCard key={item.id} item={item} onClick={() => navigate(`/media/${item.id}`)} />
          ))}
        </div>
      )}
    </PageLayout>
  );
}
