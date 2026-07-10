import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchLibraries, fetchMedia, fetchUserHistory } from "@/api/client";
import type { HistoryItem, Library, MediaItem } from "@/api/types";
import { PageLayout } from "@/components/AppShell";
import LibraryCard from "@/components/LibraryCard";
import LoadingState from "@/components/LoadingState";
import MediaCard from "@/components/MediaCard";
import { useConfigStore } from "@/store/config";

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const appName = useConfigStore((s) => s.appName);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [recent, setRecent] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const libs = await fetchLibraries();
    setLibraries(libs.filter((l) => l.enabled !== 0));
    setHistory(await fetchUserHistory(12));
    const recentItems: MediaItem[] = [];
    for (const lib of libs.slice(0, 3)) {
      recentItems.push(...(await fetchMedia(lib.id, { sort: "created_desc", limit: 8 })));
    }
    setRecent(recentItems.slice(0, 12));
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return (
      <PageLayout title={appName}>
        <LoadingState />
      </PageLayout>
    );
  }

  return (
    <PageLayout title={appName}>
      {history.length > 0 ? (
        <section className="section">
          <h2 className="section-title">{t("home.continue")}</h2>
          <div className="media-row">
            {history.map((h) => (
              <MediaCard
                key={h.media_id}
                item={{
                  id: h.media_id,
                  library_id: h.library_id,
                  file_id: "",
                  title: h.title,
                  file_path: "",
                  file_type: h.file_type,
                  duration: h.duration,
                  width: 0,
                  height: 0,
                  format: "",
                  status: "",
                  poster_url: h.poster_url,
                  backdrop_url: h.backdrop_url,
                  encrypted_asset: h.encrypted_asset,
                }}
                aspect="landscape"
                progress={h.duration > 0 ? (h.position / h.duration) * 100 : 0}
                onClick={() => navigate(`/media/${h.media_id}`)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="section">
        <h2 className="section-title">{t("home.libraries")}</h2>
        <div style={{ display: "grid", gap: 16 }}>
          {libraries.map((lib) => (
            <LibraryCard key={lib.id} library={lib} onClick={() => navigate(`/library/${lib.id}`)} />
          ))}
        </div>
      </section>

      {recent.length > 0 ? (
        <section className="section">
          <h2 className="section-title">{t("home.recent")}</h2>
          <div className="media-row">
            {recent.map((item) => (
              <MediaCard key={item.id} item={item} onClick={() => navigate(`/media/${item.id}`)} />
            ))}
          </div>
        </section>
      ) : null}
    </PageLayout>
  );
}
