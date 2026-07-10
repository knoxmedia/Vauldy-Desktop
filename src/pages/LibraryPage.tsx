import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchLibraries, fetchMedia } from "@/api/client";
import type { Library, MediaItem } from "@/api/types";
import { PageLayout } from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import MediaCard from "@/components/MediaCard";
import { libraryFileType } from "@/lib/library";

export default function LibraryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const libraryId = Number(id);
  const [library, setLibrary] = useState<Library | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchLibraries()
      .then(async (libs) => {
        const lib = libs.find((l) => l.id === libraryId) ?? null;
        setLibrary(lib);
        const ft = lib ? libraryFileType(lib.type) : undefined;
        const media = await fetchMedia(libraryId, {
          sort: "created_desc",
          limit: 200,
          file_type: ft,
        });
        setItems(media);
      })
      .catch(() => {
        setLibrary(null);
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [libraryId]);

  return (
    <PageLayout title={library?.name || t("browse.title")}>
      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState message={t("library.empty")} />
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
